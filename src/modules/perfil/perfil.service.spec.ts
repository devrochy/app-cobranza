import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Socio } from "../socios/socio.entity";
import { PerfilService } from "./perfil.service";

describe("PerfilService", () => {
  let service: PerfilService;

  const cobradorRepo = { findOne: jest.fn(), save: jest.fn() };
  const socioRepo = { findOne: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerfilService,
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

  it("lanza NotFound si el cobrador no existe", async () => {
    cobradorRepo.findOne.mockResolvedValue(null);

    await expect(
      service.actualizar("cobrador", 99, { nombre: "x", apellido: "y" }),
    ).rejects.toThrow(NotFoundException);
    expect(cobradorRepo.save).not.toHaveBeenCalled();
  });

  it("rechaza el rol admin sin tocar repositorios", async () => {
    await expect(
      service.actualizar("admin", 1, { nombre: "x", apellido: "y" }),
    ).rejects.toThrow(ForbiddenException);

    expect(cobradorRepo.findOne).not.toHaveBeenCalled();
    expect(socioRepo.findOne).not.toHaveBeenCalled();
  });
});
