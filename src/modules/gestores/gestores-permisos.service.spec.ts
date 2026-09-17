import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Gestor } from "./gestor.entity";
import { GESTOR_PERMISOS, GestorPermiso } from "./gestor-permiso.entity";
import { GestoresPermisosService } from "./gestores-permisos.service";

describe("GestoresPermisosService", () => {
  let service: GestoresPermisosService;
  let gestorRepo: { findOne: jest.Mock; find: jest.Mock };
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

    gestorRepo = { findOne: jest.fn(), find: jest.fn() };
    permisoRepo = { find: jest.fn(), findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GestoresPermisosService,
        { provide: getRepositoryToken(Gestor), useValue: gestorRepo },
        { provide: getRepositoryToken(GestorPermiso), useValue: permisoRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(GestoresPermisosService);
  });

  function gestorFixture(overrides: Partial<Gestor> = {}): Gestor {
    return {
      id: 1,
      propietarioId: 1,
      usuario: "gestor1",
      passwordHash: "hash",
      nombre: "Carlos",
      apellido: "López",
      correo: "carlos@correo.com",
      telefono: "+59171111111",
      codigo: "CB001",
      estatus: "activo",
      createdAt: new Date(),
      ...overrides,
    } as Gestor;
  }

  describe("getMatriz", () => {
    it("devuelve la matriz completa de permisos con ausentes en false", async () => {
      gestorRepo.findOne.mockResolvedValue(gestorFixture());
      permisoRepo.find.mockResolvedValue([
        { permiso: "registrar_pago", habilitado: true },
      ]);

      const matriz = await service.getMatriz(1);

      expect(matriz).toHaveLength(GESTOR_PERMISOS.length);
      expect(matriz.find((p) => p.permiso === "registrar_pago")?.habilitado).toBe(true);
      expect(matriz.find((p) => p.permiso === "ver_cartera")?.habilitado).toBe(false);
    });

    it("lanza NotFoundException si el gestor no existe", async () => {
      gestorRepo.findOne.mockResolvedValue(null);

      await expect(service.getMatriz(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe("setMatriz", () => {
    it("reemplaza la matriz (delete + insert de los 12) y devuelve el resultado", async () => {
      gestorRepo.findOne.mockResolvedValue(gestorFixture());
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
      gestorRepo.findOne.mockResolvedValue(gestorFixture());

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
      gestorRepo.findOne.mockResolvedValue(gestorFixture());
      manager.save.mockRejectedValue(new Error("boom"));

      await expect(service.setMatriz(1, { registrar_pago: true })).rejects.toThrow(
        "boom",
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe("assertOwnedByPropietario", () => {
    it("resuelve si el gestor pertenece al propietario", async () => {
      gestorRepo.findOne.mockResolvedValue(gestorFixture({ propietarioId: 7 }));

      await expect(service.assertOwnedByPropietario(1, 7)).resolves.toBeUndefined();
    });

    it("lanza ForbiddenException si el gestor no pertenece al propietario", async () => {
      gestorRepo.findOne.mockResolvedValue(gestorFixture({ propietarioId: 7 }));

      await expect(service.assertOwnedByPropietario(1, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("lanza NotFoundException si el gestor no existe", async () => {
      gestorRepo.findOne.mockResolvedValue(null);

      await expect(service.assertOwnedByPropietario(999, 7)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("tienePermiso", () => {
    it("devuelve true si el gestor tiene el permiso habilitado", async () => {
      permisoRepo.findOne.mockResolvedValue({ permiso: "registrar_pago", habilitado: true });

      await expect(service.tienePermiso(1, "registrar_pago")).resolves.toBe(true);
      expect(permisoRepo.findOne).toHaveBeenCalledWith({
        where: { gestor: { id: 1 }, permiso: "registrar_pago", habilitado: true },
      });
    });

    it("devuelve false si el permiso está deshabilitado o ausente", async () => {
      permisoRepo.findOne.mockResolvedValue(null);

      await expect(service.tienePermiso(1, "eliminar_pago")).resolves.toBe(false);
    });
  });
});
