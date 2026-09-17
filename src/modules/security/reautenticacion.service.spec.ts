import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Gestor } from "../gestores/gestor.entity";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { PasswordService } from "./password.service";
import { ReautenticacionService } from "./reautenticacion.service";

describe("ReautenticacionService", () => {
  let service: ReautenticacionService;
  let password: { compare: jest.Mock };

  const adminRepo = { findOne: jest.fn() };
  const propietarioRepo = { findOne: jest.fn() };
  const gestorRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    password = { compare: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReautenticacionService,
        { provide: getRepositoryToken(AdminUser), useValue: adminRepo },
        { provide: getRepositoryToken(Propietario), useValue: propietarioRepo },
        { provide: getRepositoryToken(Gestor), useValue: gestorRepo },
        { provide: PasswordService, useValue: password },
      ],
    }).compile();

    service = module.get(ReautenticacionService);
  });

  it("valida la contraseña del gestor consultando su hash", async () => {
    gestorRepo.findOne.mockResolvedValue({ id: 20, passwordHash: "hash-gestor" });
    password.compare.mockResolvedValue(true);

    await expect(service.validar({ rol: "gestor", sub: 20 }, "secreto")).resolves.toBeUndefined();
    expect(gestorRepo.findOne).toHaveBeenCalledWith({
      where: { id: 20 },
      select: { id: true, passwordHash: true },
    });
  });

  it("rechaza si el gestor no existe", async () => {
    gestorRepo.findOne.mockResolvedValue(null);

    await expect(service.validar({ rol: "gestor", sub: 99 }, "x")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rechaza si la contraseña no coincide", async () => {
    gestorRepo.findOne.mockResolvedValue({ id: 20, passwordHash: "hash-gestor" });
    password.compare.mockResolvedValue(false);

    await expect(service.validar({ rol: "gestor", sub: 20 }, "mala")).rejects.toThrow(
      UnauthorizedException,
    );
  });
});