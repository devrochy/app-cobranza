import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Cobrador } from "./cobrador.entity";
import { COBRADOR_PERMISOS, CobradorPermiso } from "./cobrador-permiso.entity";
import { CobradoresPermisosService } from "./cobradores-permisos.service";

describe("CobradoresPermisosService", () => {
  let service: CobradoresPermisosService;
  let cobradorRepo: { findOne: jest.Mock; find: jest.Mock };
  let permisoRepo: { find: jest.Mock; findOne: jest.Mock };
  let manager: { delete: jest.Mock; save: jest.Mock };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {},
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    manager = { delete: jest.fn(), save: jest.fn() };
    mockQueryRunner.manager = manager;
    const mockDataSource = { createQueryRunner: jest.fn(() => mockQueryRunner) };

    cobradorRepo = { findOne: jest.fn(), find: jest.fn() };
    permisoRepo = { find: jest.fn(), findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobradoresPermisosService,
        { provide: getRepositoryToken(Cobrador), useValue: cobradorRepo },
        { provide: getRepositoryToken(CobradorPermiso), useValue: permisoRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(CobradoresPermisosService);
  });

  function cobradorFixture(overrides: Partial<Cobrador> = {}): Cobrador {
    return {
      id: 1,
      socioId: 1,
      usuario: "cobrador1",
      passwordHash: "hash",
      nombre: "Carlos",
      apellido: "López",
      correo: "carlos@correo.com",
      telefono: "+59171111111",
      codigo: "CB001",
      estatus: "activo",
      createdAt: new Date(),
      ...overrides,
    } as Cobrador;
  }

  describe("getMatriz", () => {
    it("devuelve la matriz completa de permisos con ausentes en false", async () => {
      cobradorRepo.findOne.mockResolvedValue(cobradorFixture());
      permisoRepo.find.mockResolvedValue([
        { permiso: "registrar_pago", habilitado: true },
      ]);

      const matriz = await service.getMatriz(1);

      expect(matriz).toHaveLength(COBRADOR_PERMISOS.length);
      expect(matriz.find((p) => p.permiso === "registrar_pago")?.habilitado).toBe(true);
      expect(matriz.find((p) => p.permiso === "ver_cartera")?.habilitado).toBe(false);
    });

    it("lanza NotFoundException si el cobrador no existe", async () => {
      cobradorRepo.findOne.mockResolvedValue(null);

      await expect(service.getMatriz(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe("setMatriz", () => {
    it("reemplaza la matriz (delete + insert de los 12) y devuelve el resultado", async () => {
      cobradorRepo.findOne.mockResolvedValue(cobradorFixture());
      const filasGuardadas: Array<{ permiso: string; habilitado: boolean }> = [];
      manager.save.mockImplementation(async (_e: unknown, filas: Array<{ permiso: string; habilitado: boolean }>) => {
        filasGuardadas.push(...filas);
        return filas;
      });
      permisoRepo.find.mockImplementation(async () =>
        filasGuardadas.map((f) => ({ permiso: f.permiso, habilitado: f.habilitado })),
      );

      const matriz = await service.setMatriz(1, { registrar_pago: true });

      expect(manager.delete).toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(matriz.find((p) => p.permiso === "registrar_pago")?.habilitado).toBe(true);
      expect(matriz.find((p) => p.permiso === "ver_cartera")?.habilitado).toBe(false);
    });

    it("lanza BadRequestException si recibe una clave fuera del catálogo", async () => {
      cobradorRepo.findOne.mockResolvedValue(cobradorFixture());

      await expect(
        service.setMatriz(
          1,
          { registrar_pago: true, permiso_inventado: true } as Parameters<
            typeof service.setMatriz
          >[1],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("hace rollback si el guardado falla", async () => {
      cobradorRepo.findOne.mockResolvedValue(cobradorFixture());
      manager.save.mockRejectedValue(new Error("boom"));

      await expect(service.setMatriz(1, { registrar_pago: true })).rejects.toThrow(
        "boom",
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe("assertOwnedBySocio", () => {
    it("resuelve si el cobrador pertenece al socio", async () => {
      cobradorRepo.findOne.mockResolvedValue(cobradorFixture({ socioId: 7 }));

      await expect(service.assertOwnedBySocio(1, 7)).resolves.toBeUndefined();
    });

    it("lanza ForbiddenException si el cobrador no pertenece al socio", async () => {
      cobradorRepo.findOne.mockResolvedValue(cobradorFixture({ socioId: 7 }));

      await expect(service.assertOwnedBySocio(1, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("lanza NotFoundException si el cobrador no existe", async () => {
      cobradorRepo.findOne.mockResolvedValue(null);

      await expect(service.assertOwnedBySocio(999, 7)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
