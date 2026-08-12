import { ConfigService } from "@nestjs/config";
import { ExecutionContext, ServiceUnavailableException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { HttpsGuard } from "./https.guard";

describe("HttpsGuard", () => {
  function makeConfig(nodeEnv: string) {
    return { get: jest.fn((key: string) => (key === "NODE_ENV" ? nodeEnv : undefined)) };
  }

  function mockContext(opts: { secure?: boolean; xForwardedProto?: string }) {
    const req = {
      secure: opts.secure ?? false,
      header: (name: string) => (name === "x-forwarded-proto" ? opts.xForwardedProto : undefined),
    };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  async function build(nodeEnv: string): Promise<HttpsGuard> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpsGuard,
        { provide: ConfigService, useValue: makeConfig(nodeEnv) },
      ],
    }).compile();
    return module.get(HttpsGuard);
  }

  it("permite todo en desarrollo (HTTP local)", async () => {
    const devGuard = await build("development");
    expect(devGuard.canActivate(mockContext({}))).toBe(true);
  });

  it("permite todo en test", async () => {
    const testGuard = await build("test");
    expect(testGuard.canActivate(mockContext({}))).toBe(true);
  });

  it("en producción permite si el header X-Forwarded-Proto es https", async () => {
    const prodGuard = await build("production");
    expect(
      prodGuard.canActivate(mockContext({ xForwardedProto: "https" })),
    ).toBe(true);
  });

  it("en producción permite si la conexión es secure directamente", async () => {
    const prodGuard = await build("production");
    expect(prodGuard.canActivate(mockContext({ secure: true }))).toBe(true);
  });

  it("en producción rechaza una petición HTTP sin terminación TLS", async () => {
    const prodGuard = await build("production");
    expect(() => prodGuard.canActivate(mockContext({}))).toThrow(
      ServiceUnavailableException,
    );
  });
});
