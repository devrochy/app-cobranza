import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  ReglaNegociacionIa,
  REGLAS_NEGOCIACION_IA_DEFAULTS,
} from "./regla-negociacion-ia.entity";
import { ReglasNegociacionIaService } from "./reglas-negociacion-ia.service";

describe("ReglasNegociacionIaService", () => {
  let service: ReglasNegociacionIaService;

  const mockRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReglasNegociacionIaService,
        { provide: getRepositoryToken(ReglaNegociacionIa), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(ReglasNegociacionIaService);
  });

  it("obtener devuelve los defaults cuando no existe fila", async () => {
    mockRepo.find.mockResolvedValue([]);

    const res = await service.obtener();

    expect(res).toEqual({
      ...REGLAS_NEGOCIACION_IA_DEFAULTS,
      configuradoPor: null,
      vigenteDesde: null,
    });
  });

  it("obtener devuelve la fila vigente cuando existe", async () => {
    mockRepo.find.mockResolvedValue([
      {
        id: 1,
        maxDiasProrroga: 5,
        minAbonoAceptablePct: 25,
        maxReprogramacionesPorCliente: 2,
        umbralSaldoAutonomo: 500,
        configuradoPor: 7,
        vigenteDesde: new Date("2026-08-20T00:00:00Z"),
      },
    ]);

    const res = await service.obtener();

    expect(res.maxDiasProrroga).toBe(5);
    expect(res.minAbonoAceptablePct).toBe(25);
    expect(res.umbralSaldoAutonomo).toBe(500);
    expect(res.configuradoPor).toBe(7);
  });

  it("guardar hace upsert de la fila única con configuradoPor", async () => {
    mockRepo.find.mockResolvedValue([]);
    mockRepo.create.mockImplementation((e: Partial<ReglaNegociacionIa>) => e as ReglaNegociacionIa);
    mockRepo.save.mockResolvedValue({ id: 1 });

    const valores = {
      maxDiasProrroga: 5,
      minAbonoAceptablePct: 25,
      maxReprogramacionesPorCliente: 2,
      umbralSaldoAutonomo: 500,
    };

    await service.guardar(valores, 7);

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...valores, configuradoPor: 7 }),
    );
    const creado = mockRepo.create.mock.calls[0][0];
    expect(creado.vigenteDesde).toBeInstanceOf(Date);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it("guardar reutiliza la fila existente (upsert) si ya hay una", async () => {
    const existente = {
      id: 1,
      maxDiasProrroga: 1,
      minAbonoAceptablePct: 10,
      maxReprogramacionesPorCliente: 1,
      umbralSaldoAutonomo: 100,
      configuradoPor: 1,
      vigenteDesde: new Date(),
    } as ReglaNegociacionIa;
    mockRepo.find.mockResolvedValue([existente]);

    await service.guardar(
      {
        maxDiasProrroga: 9,
        minAbonoAceptablePct: 30,
        maxReprogramacionesPorCliente: 3,
        umbralSaldoAutonomo: 900,
      },
      7,
    );

    expect(mockRepo.create).not.toHaveBeenCalled();
    expect(existente.maxDiasProrroga).toBe(9);
    expect(existente.minAbonoAceptablePct).toBe(30);
    expect(existente.umbralSaldoAutonomo).toBe(900);
    expect(existente.configuradoPor).toBe(7);
    expect(existente.vigenteDesde).toBeInstanceOf(Date);
    expect(mockRepo.save).toHaveBeenCalledWith(existente);
  });
});
