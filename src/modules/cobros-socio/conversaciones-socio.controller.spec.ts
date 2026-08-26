import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { ConversacionesSocioController } from "./conversaciones-socio.controller";
import { ConversacionSocioChatService } from "./conversacion-socio-chat.service";

describe("ConversacionesSocioController", () => {
  let controller: ConversacionesSocioController;
  let service: ConversacionSocioChatService;

  const mockService = {
    listarConversaciones: jest.fn(),
    obtenerHistorial: jest.fn(),
    enviarMensaje: jest.fn(),
  };

  const req = {
    user: { sub: 7, rol: "admin" } as AuthTokenPayload,
  } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversacionesSocioController],
      providers: [
        { provide: ConversacionSocioChatService, useValue: mockService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(ConversacionesSocioController);
    service = module.get(ConversacionSocioChatService);
  });

  it("listar conversaciones delega en el servicio", async () => {
    await controller.listar();
    expect(service.listarConversaciones).toHaveBeenCalled();
  });

  it("obtener historial delega con el requester", async () => {
    await controller.obtener(3, req);
    expect(service.obtenerHistorial).toHaveBeenCalledWith(3, { rol: "admin", sub: 7 });
  });

  it("enviar mensaje delega con el requester", async () => {
    await controller.enviar(3, { contenido: "Hola" }, req);
    expect(service.enviarMensaje).toHaveBeenCalledWith(3, "Hola", { rol: "admin", sub: 7 });
  });
});