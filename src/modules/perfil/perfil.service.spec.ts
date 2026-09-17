import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Gestor } from "../gestores/gestor.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { PasswordService } from "../security/password.service";
import { PerfilService } from "./perfil.service";

describe("PerfilService", () => {
  let service: PerfilService;

  const adminRepo = { findOne: jest.fn(), save: jest.fn(), update: jest.fn() };
  const gestorRepo = { findOne: jest.fn(), save: jest.fn(), update: jest.fn() };
  const propietarioRepo = { findOne: jest.fn(), save: jest.fn(), update: jest.fn() };
  const passwordService = { compare: jest.fn(), hash: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerfilService,
        { provide: getRepositoryToken(AdminUser), useValue: adminRepo },
        { provide: getRepositoryToken(Gestor), useValue: gestorRepo },
        { provide: getRepositoryToken(Propietario), useValue: propietarioRepo },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    service = module.get(PerfilService);
  });

  it("actualiza nombre y apellido de un gestor", async () => {
    const gestor = {
      id: 7,
      usuario: "cob1",
      nombre: "Viejo",
      apellido: "Anterior",
    };
    gestorRepo.findOne.mockResolvedValue(gestor);
    gestorRepo.save.mockImplementation(async (e: unknown) => e);

    const res = await service.actualizar("gestor", 7, {
      nombre: "Nuevo",
      apellido: "Pérez",
    });

    expect(gestorRepo.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(gestorRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Nuevo", apellido: "Pérez" }),
    );
    expect(res).toEqual({
      id: 7,
      usuario: "cob1",
      nombre: "Nuevo",
      apellido: "Pérez",
    });
  });

  it("actualiza nombre y apellido de un propietario", async () => {
    const propietario = { id: 3, usuario: "soc1", nombre: "A", apellido: "B" };
    propietarioRepo.findOne.mockResolvedValue(propietario);
    propietarioRepo.save.mockImplementation(async (e: unknown) => e);

    const res = await service.actualizar("propietario", 3, {
      nombre: "Ana",
      apellido: "Gómez",
    });

    expect(propietarioRepo.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(propietarioRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Ana", apellido: "Gómez" }),
    );
    expect(res).toEqual({
      id: 3,
      usuario: "soc1",
      nombre: "Ana",
      apellido: "Gómez",
    });
  });

  it("actualiza nombre y apellido de un admin", async () => {
    const admin = { id: 1, usuario: "admin", nombre: null, apellido: null };
    adminRepo.findOne.mockResolvedValue(admin);
    adminRepo.save.mockImplementation(async (e: unknown) => e);

    const res = await service.actualizar("admin", 1, {
      nombre: "Root",
      apellido: "Admin",
    });

    expect(adminRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(adminRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Root", apellido: "Admin" }),
    );
    expect(res).toEqual({
      id: 1,
      usuario: "admin",
      nombre: "Root",
      apellido: "Admin",
    });
  });

  it("lanza NotFound si el gestor no existe", async () => {
    gestorRepo.findOne.mockResolvedValue(null);

    await expect(
      service.actualizar("gestor", 99, { nombre: "x", apellido: "y" }),
    ).rejects.toThrow(NotFoundException);
    expect(gestorRepo.save).not.toHaveBeenCalled();
  });

  it("lanza NotFound si el admin no existe", async () => {
    adminRepo.findOne.mockResolvedValue(null);

    await expect(
      service.actualizar("admin", 99, { nombre: "x", apellido: "y" }),
    ).rejects.toThrow(NotFoundException);
    expect(adminRepo.save).not.toHaveBeenCalled();
  });

  describe("obtener", () => {
    it("devuelve el perfil del admin normalizando nulos", async () => {
      adminRepo.findOne.mockResolvedValue({
        id: 1,
        usuario: "admin",
        nombre: null,
        apellido: null,
      });

      await expect(service.obtener("admin", 1)).resolves.toEqual({
        id: 1,
        usuario: "admin",
        nombre: "",
        apellido: "",
      });
    });

    it("devuelve el perfil de un propietario", async () => {
      propietarioRepo.findOne.mockResolvedValue({
        id: 3,
        usuario: "soc1",
        nombre: "Ana",
        apellido: "Gómez",
      });

      await expect(service.obtener("propietario", 3)).resolves.toEqual({
        id: 3,
        usuario: "soc1",
        nombre: "Ana",
        apellido: "Gómez",
      });
    });

    it("lanza NotFound si el usuario no existe", async () => {
      gestorRepo.findOne.mockResolvedValue(null);

      await expect(service.obtener("gestor", 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("cambiarPassword", () => {
    it("valida la contraseña actual y guarda la nueva hasheada (admin)", async () => {
      adminRepo.findOne.mockResolvedValue({ id: 1, passwordHash: "hash-actual" });
      passwordService.compare.mockResolvedValue(true);
      passwordService.hash.mockResolvedValue("hash-nueva");

      await service.cambiarPassword("admin", 1, {
        passwordActual: "clave-vieja",
        passwordNueva: "clave-nueva",
      });

      expect(passwordService.compare).toHaveBeenCalledWith("clave-vieja", "hash-actual");
      expect(passwordService.hash).toHaveBeenCalledWith("clave-nueva");
      expect(adminRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { passwordHash: "hash-nueva" },
      );
    });

    it("valida la contraseña actual y guarda la nueva (propietario)", async () => {
      propietarioRepo.findOne.mockResolvedValue({ id: 3, passwordHash: "hash-propietario" });
      passwordService.compare.mockResolvedValue(true);
      passwordService.hash.mockResolvedValue("hash-nueva-propietario");

      await service.cambiarPassword("propietario", 3, {
        passwordActual: "clave-vieja",
        passwordNueva: "clave-nueva",
      });

      expect(propietarioRepo.update).toHaveBeenCalledWith(
        { id: 3 },
        { passwordHash: "hash-nueva-propietario" },
      );
    });

    it("valida la contraseña actual y guarda la nueva (gestor)", async () => {
      gestorRepo.findOne.mockResolvedValue({ id: 7, passwordHash: "hash-cob" });
      passwordService.compare.mockResolvedValue(true);
      passwordService.hash.mockResolvedValue("hash-nueva-cob");

      await service.cambiarPassword("gestor", 7, {
        passwordActual: "clave-vieja",
        passwordNueva: "clave-nueva",
      });

      expect(gestorRepo.update).toHaveBeenCalledWith(
        { id: 7 },
        { passwordHash: "hash-nueva-cob" },
      );
    });

    it("lanza BadRequest si la contraseña actual es incorrecta", async () => {
      adminRepo.findOne.mockResolvedValue({ id: 1, passwordHash: "hash-actual" });
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.cambiarPassword("admin", 1, {
          passwordActual: "incorrecta",
          passwordNueva: "clave-nueva",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(adminRepo.update).not.toHaveBeenCalled();
    });

    it("lanza NotFound si el usuario no existe", async () => {
      adminRepo.findOne.mockResolvedValue(null);

      await expect(
        service.cambiarPassword("admin", 99, {
          passwordActual: "x",
          passwordNueva: "clave-nueva",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
