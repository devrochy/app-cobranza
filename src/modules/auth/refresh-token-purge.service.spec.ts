import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RefreshTokenRevocado } from "./refresh-token-revocado.entity";
import { RefreshTokenPurgeService } from "./refresh-token-purge.service";

describe("RefreshTokenPurgeService", () => {
  let service: RefreshTokenPurgeService;
  let revocadoRepo: Repository<RefreshTokenRevocado>;

  const mockRevocadoRepo = { delete: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenPurgeService,
        { provide: getRepositoryToken(RefreshTokenRevocado), useValue: mockRevocadoRepo },
      ],
    }).compile();

    service = module.get(RefreshTokenPurgeService);
    revocadoRepo = module.get(getRepositoryToken(RefreshTokenRevocado));
  });

  it("purga los tokens revocados ya expirados y devuelve cuántos borró", async () => {
    (revocadoRepo.delete as jest.Mock).mockResolvedValue({ affected: 3 });

    const borrados = await service.purgar(new Date("2026-09-12T00:00:00Z"));

    expect(borrados).toBe(3);
    expect(revocadoRepo.delete).toHaveBeenCalledWith(
      expect.objectContaining({ expiraEn: expect.anything() }),
    );
  });

  it("devuelve 0 si no había nada que purgar", async () => {
    (revocadoRepo.delete as jest.Mock).mockResolvedValue({ affected: 0 });

    expect(await service.purgar()).toBe(0);
  });
});
