import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Device } from "./device.entity";
import { DeviceApiKeyGuard, DEVICE_API_KEY_HEADER } from "./device-api-key.guard";
import { DevicesService } from "./devices.service";

describe("DeviceApiKeyGuard", () => {
  let guard: DeviceApiKeyGuard;
  const mockDevicesService = { autenticar: jest.fn() };

  const context = (headerValue: string | undefined) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { [DEVICE_API_KEY_HEADER]: headerValue } }),
      }),
    }) as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceApiKeyGuard,
        { provide: DevicesService, useValue: mockDevicesService },
      ],
    }).compile();
    guard = module.get(DeviceApiKeyGuard);
  });

  it("autoriza y adjunta el dispositivo cuando la API key es válida", async () => {
    const request = { headers: { [DEVICE_API_KEY_HEADER]: "codigo.secreto" } };
    (mockDevicesService.autenticar as jest.Mock).mockResolvedValue({ id: 1 } as Device);

    const ctx = { switchToHttp: () => ({ getRequest: () => request }) } as never;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request).toMatchObject({ device: { id: 1 } });
  });

  it("rechaza sin header", async () => {
    await expect(guard.canActivate(context(undefined))).rejects.toThrow(UnauthorizedException);
  });

  it("rechaza con API key inválida", async () => {
    (mockDevicesService.autenticar as jest.Mock).mockResolvedValue(null);
    await expect(guard.canActivate(context("codigo.mal"))).rejects.toThrow(UnauthorizedException);
  });
});