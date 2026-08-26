import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Socio } from "./socio.entity";
import { SOCIO_PERMISOS, SocioPermiso } from "./socio-permiso.entity";
import { PermisosSocioService } from "./permisos-socio.service";

describe("PermisosSocioService", () => {
  let service: PermisosSocioService;
  let socioRepo: { findOne: jest.Mock };
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
    manager = {
      delete: jest.fn(),
      save: jest.fn(),
    };
    mockQueryRunner.manager = manager;
    const mockDataSource = {
      createQueryRunner: jest.fn(() => mockQueryRunner),
    };

    socioRepo = { findOne: jest.fn() };
    permisoRepo = { find: jest.fn(), findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermisosSocioService,
        { provide: getRepositoryToken(Socio), useValue: socioRepo },
        { provide: getRepositoryToken(SocioPermiso), useValue: permisoRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(PermisosSocioService);
  });

  describe("getMatriz", () => {
    it("devuelve la matriz completa de permisos con ausentes en false", async () => {
      socioRepo.findOne.mockResolvedValue({ id: 1 });
      permisoRepo.find.mockResolvedValue([
        { permiso: "ver_reportes", habilitado: true },
        { permiso: "registrar_cobrador", habilitado: true },
      ]);

      const matriz = await service.getMatriz(1);

      expect(matriz).toHaveLength(SOCIO_PERMISOS.length);
      expect(matriz.find((p) => p.permiso === "ver_reportes")?.habilitado).toBe(true);
      expect(matriz.find((p) => p.permiso === "registrar_cobrador")?.habilitado).toBe(true);
      expect(matriz.find((p) => p.permiso === "eliminar_rutas")?.habilitado).toBe(false);
    });

    it("lanza NotFoundException si el socio no existe", async () => {
      socioRepo.findOne.mockResolvedValue(null);

      await expect(service.getMatriz(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe("setMatriz", () => {
    it("reemplaza la matriz (delete + insert de todos los permisos) y devuelve el resultado", async () => {
      socioRepo.findOne.mockResolvedValue({ id: 1 });
      const filasGuardadas: Array<{ permiso: string; habilitado: boolean }> = [];
      manager.save.mockImplementation(async (_e: unknown, filas: Array<{ permiso: string; habilitado: boolean }>) => {
        filasGuardadas.push(...filas);
        return filas;
      });
      permisoRepo.find.mockImplementation(async () =>
        filasGuardadas.map((f) => ({ permiso: f.permiso, habilitado: f.habilitado })),
      );

      const matriz = await service.setMatriz(1, {
        ver_reportes: true,
        registrar_cobrador: true,
      });

      expect(manager.delete).toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalledTimes(1);
      const filas = manager.save.mock.calls[0][1] as Array<{ permiso: string; habilitado: boolean }>;
      expect(filas).toHaveLength(SOCIO_PERMISOS.length);
      expect(filas.find((f) => f.permiso === "ver_reportes")?.habilitado).toBe(true);
      expect(filas.find((f) => f.permiso === "eliminar_rutas")?.habilitado).toBe(false);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

      expect(matriz.find((p) => p.permiso === "ver_reportes")?.habilitado).toBe(true);
      expect(matriz.find((p) => p.permiso === "eliminar_rutas")?.habilitado).toBe(false);
    });

    it("lanza BadRequestException si recibe una clave fuera del catálogo", async () => {
      socioRepo.findOne.mockResolvedValue({ id: 1 });

      await expect(
        service.setMatriz(
          1,
          { ver_reportes: true, permiso_inventado: true } as unknown as Parameters<
            typeof service.setMatriz
          >[1],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("lanza NotFoundException si el socio no existe", async () => {
      socioRepo.findOne.mockResolvedValue(null);

      await expect(service.setMatriz(999, { ver_reportes: true })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("hace rollback si el guardado falla", async () => {
      socioRepo.findOne.mockResolvedValue({ id: 1 });
      manager.save.mockRejectedValue(new Error("boom"));

      await expect(service.setMatriz(1, { ver_reportes: true })).rejects.toThrow(
        "boom",
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe("tienePermiso", () => {
    it("devuelve true si la fila del permiso está habilitada", async () => {
      permisoRepo.findOne.mockResolvedValue({ permiso: "registrar_socio", habilitado: true });

      await expect(service.tienePermiso(1, "registrar_socio")).resolves.toBe(true);
      expect(permisoRepo.findOne).toHaveBeenCalledWith({
        where: { socio: { id: 1 }, permiso: "registrar_socio", habilitado: true },
      });
    });

    it("devuelve false si no hay fila habilitada", async () => {
      permisoRepo.findOne.mockResolvedValue(null);

      await expect(service.tienePermiso(1, "eliminar_rutas")).resolves.toBe(false);
    });
  });
});
