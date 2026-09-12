import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PerfilController } from "./perfil.controller";
import { PerfilService } from "./perfil.service";

describe("PerfilController", () => {
  let controller: PerfilController;
  const mockService = { actualizar: jest.fn(), obtener: jest.fn(), cambiarPassword: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerfilController],
      providers: [
        { provide: PerfilService, useValue: mockService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(PerfilController);
  });

  it("delega en el servicio con el rol y sub del usuario autenticado", async () => {
    mockService.actualizar.mockResolvedValue({
      id: 7,
      usuario: "cob1",
      nombre: "Nuevo",
      apellido: "Pérez",
    });

    await controller.actualizar({ nombre: "Nuevo", apellido: "Pérez" }, {
      user: { rol: "cobrador", sub: 7 },
    } as never);

    expect(mockService.actualizar).toHaveBeenCalledWith("cobrador", 7, {
      nombre: "Nuevo",
      apellido: "Pérez",
    });
  });

  it("obtener delega en el servicio con el rol y sub del usuario autenticado", async () => {
    mockService.obtener.mockResolvedValue({
      id: 7,
      usuario: "cob1",
      nombre: "Nuevo",
      apellido: "Pérez",
    });

    await controller.obtener({
      user: { rol: "cobrador", sub: 7 },
    } as never);

    expect(mockService.obtener).toHaveBeenCalledWith("cobrador", 7);
  });

  it("cambiarPassword delega en el servicio con el rol y sub del usuario autenticado", async () => {
    mockService.cambiarPassword.mockResolvedValue(undefined);

    await controller.cambiarPassword(
      { passwordActual: "vieja", passwordNueva: "nueva123" },
      { user: { rol: "admin", sub: 1 } } as never,
    );

    expect(mockService.cambiarPassword).toHaveBeenCalledWith("admin", 1, {
      passwordActual: "vieja",
      passwordNueva: "nueva123",
    });
  });
});
