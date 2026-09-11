import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Socio } from "../socios/socio.entity";
import { PerfilService } from "./perfil.service";

describe("PerfilService", () => {
  let service: PerfilService;

  const adminRepo = { findOne: jest.fn(), save: jest.fn() };
  const cobradorRepo = { findOne: jest.fn(), save: jest.fn() };
  const socioRepo = { findOne: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerfilService,
        { provide: getRepositoryToken(AdminUser), useValue: adminRepo },
        { provide: getRepositoryToken(Cobrador), useValue: cobradorRepo },
        { provide: getRepositoryToken(Socio), useValue: socioRepo },
      ],
    }).compile();

    service = module.get(PerfilService);
  });

  it("actualiza nombre y apellido de un cobrador", async () => {
    const cobrador = {
      id: 7,
      usuario: "cob1",
      nombre: "Viejo",
      apellido: "Anterior",
    };
    cobradorRepo.findOne.mockResolvedValue(cobrador);
    cobradorRepo.save.mockImplementation(async (e: unknown) => e);

    const res = await service.actualizar("cobrador", 7, {
      nombre: "Nuevo",
      apellido: "Pérez",
    });

    expect(cobradorRepo.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(cobradorRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Nuevo", apellido: "Pérez" }),
    );
    expect(res).toEqual({
      id: 7,
      usuario: "cob1",
      nombre: "Nuevo",
      apellido: "Pérez",
    });
  });

  it("actualiza nombre y apellido de un socio", async () => {
    const socio = { id: 3, usuario: "soc1", nombre: "A", apellido: "B" };
    socioRepo.findOne.mockResolvedValue(socio);
    socioRepo.save.mockImplementation(async (e: unknown) => e);

    const res = await service.actualizar("socio", 3, {
      nombre: "Ana",
      apellido: "Gómez",
    });

    expect(socioRepo.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(socioRepo.save).toHaveBeenCalledWith(
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

  it("lanza NotFound si el cobrador no existe", async () => {
    cobradorRepo.findOne.mockResolvedValue(null);

    await expect(
      service.actualizar("cobrador", 99, { nombre: "x", apellido: "y" }),
    ).rejects.toThrow(NotFoundException);
    expect(cobradorRepo.save).not.toHaveBeenCalled();
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

    it("devuelve el perfil de un socio", async () => {
      socioRepo.findOne.mockResolvedValue({
        id: 3,
        usuario: "soc1",
        nombre: "Ana",
        apellido: "Gómez",
      });

      await expect(service.obtener("socio", 3)).resolves.toEqual({
        id: 3,
        usuario: "soc1",
        nombre: "Ana",
        apellido: "Gómez",
      });
    });

    it("lanza NotFound si el usuario no existe", async () => {
      cobradorRepo.findOne.mockResolvedValue(null);

      await expect(service.obtener("cobrador", 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
