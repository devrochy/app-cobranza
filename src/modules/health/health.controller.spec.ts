import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";

/**
 * Este spec es el ejemplo de referencia de la skill `tdd-workflow`:
 * fue escrito ANTES de `health.controller.ts` (Red), luego se implementó
 * lo mínimo para pasarlo (Green). Úsalo como plantilla de estilo para
 * los siguientes módulos de dominio.
 */
describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("responde status 'ok'", () => {
    const result = controller.check();
    expect(result.status).toBe("ok");
  });

  it("incluye un timestamp en formato ISO 8601", () => {
    const result = controller.check();
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
