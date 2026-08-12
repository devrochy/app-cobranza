import { Test, TestingModule } from "@nestjs/testing";
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get(PasswordService);
  });

  it("hash devuelve un hash distinto del texto plano que compare valida", async () => {
    const hash = await service.hash("s3cret-password");

    expect(hash).not.toBe("s3cret-password");
    expect(await service.compare("s3cret-password", hash)).toBe(true);
  });

  it("compare devuelve false para una contraseña incorrecta", async () => {
    const hash = await service.hash("s3cret-password");

    expect(await service.compare("wrong-password", hash)).toBe(false);
  });
});
