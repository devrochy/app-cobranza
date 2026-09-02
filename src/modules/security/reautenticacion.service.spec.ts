import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Cobrador } from "../cobradores/cobrador.entity";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { PasswordService } from "./password.service";
import { ReautenticacionService } from "./reautenticacion.service";

describe("ReautenticacionService", () => {
  let service: ReautenticacionService;
  let password: { compare: jest.Mock };

  const adminRepo = { findOne: jest.fn() };
  const socioRepo = { findOne: jest.fn() };
  const cobradorRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    password = { compare: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReautenticacionService,
        { provide: getRepositoryToken(AdminUser), useValue: adminRepo },
        { provide: getRepositoryToken(Socio), useValue: socioRepo },
        { provide: getRepositoryToken(Cobrador), useValue: cobradorRepo },
        { provide: PasswordService, useValue: password },
      ],
    }).compile();

    service = module.get(ReautenticacionService);
  });

  it("valida la contraseña del cobrador consultando su hash", async () => {
    cobradorRepo.findOne.mockResolvedValue({ id: 20, passwordHash: "hash-cobrador" });
    password.compare.mockResolvedValue(true);

    await expect(service.validar({ rol: "cobrador", sub: 20 }, "secreto")).resolves.toBeUndefined();
    expect(cobradorRepo.findOne).toHaveBeenCalledWith({
      where: { id: 20 },
      select: { id: true, passwordHash: true },
    });
  });

  it("rechaza si el cobrador no existe", async () => {
    cobradorRepo.findOne.mockResolvedValue(null);

    await expect(service.validar({ rol: "cobrador", sub: 99 }, "x")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rechaza si la contraseña no coincide", async () => {
    cobradorRepo.findOne.mockResolvedValue({ id: 20, passwordHash: "hash-cobrador" });
    password.compare.mockResolvedValue(false);

    await expect(service.validar({ rol: "cobrador", sub: 20 }, "mala")).rejects.toThrow(
      UnauthorizedException,
    );
  });
});