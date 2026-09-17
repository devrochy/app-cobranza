import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { ReportesDiariosService } from "./reportes-diarios.service";
import { ReporteDiario } from "./reporte-diario.entity";
import { Ruta } from "./ruta.entity";
import { LiquidacionesService } from "./liquidaciones.service";
import { EstadisticasRutaService } from "./estadisticas-ruta.service";

interface QbFake {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  getMany: jest.Mock;
}

function qbFake(filas: ReporteDiario[]): QbFake {
  const qb = {
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    getMany: jest.fn().mockResolvedValue(filas),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  return qb;
}

describe("ReportesDiariosService", () => {
  let service: ReportesDiariosService;
  let rutaRepo: { findOne: jest.Mock };
  let reporteRepo: { createQueryBuilder: jest.Mock };
  let liquidaciones: { calcularTotales: jest.Mock };
  let estadisticas: { clientesDelDia: jest.Mock };

  const admin = { rol: "admin" as const, sub: 1 };

  function reporteFixture(overrides: Partial<ReporteDiario> = {}): ReporteDiario {
    return {
      id: 1,
      rutaId: 5,
      fecha: "2026-09-16",
      cobradoDia: 123.45,
      prestadoDia: 1000,
      clientesVisitadosJson: [{ clienteId: 1, nombre: "test-Cliente Uno" }],
      clientesSinPagoJson: [],
      trayectoriasJson: null,
      horaInicio: "09:15",
      horaFin: "17:40",
      createdAt: new Date(),
      ...overrides,
    } as ReporteDiario;
  }

  beforeEach(async () => {
    rutaRepo = { findOne: jest.fn().mockResolvedValue({ id: 5, socioId: 1 }) };
    reporteRepo = {
      createQueryBuilder: jest.fn(() => qbFake([reporteFixture()])),
    };
    liquidaciones = { calcularTotales: jest.fn() };
    estadisticas = { clientesDelDia: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportesDiariosService,
        { provide: getRepositoryToken(Ruta), useValue: rutaRepo },
        { provide: getRepositoryToken(ReporteDiario), useValue: reporteRepo },
        { provide: LiquidacionesService, useValue: liquidaciones },
        { provide: EstadisticasRutaService, useValue: estadisticas },
        { provide: DataSource, useValue: { manager: {} } },
      ],
    }).compile();

    service = moduleRef.get(ReportesDiariosService);
  });

  describe("historial", () => {
    it("mapea las filas persistidas (jsonb incluido)", async () => {
      const resultado = await service.historial(5, null, null, admin);

      expect(resultado).toEqual([
        {
          id: 1,
          rutaId: 5,
          fecha: "2026-09-16",
          cobradoDia: 123.45,
          prestadoDia: 1000,
          clientesVisitados: [{ clienteId: 1, nombre: "test-Cliente Uno" }],
          clientesSinPago: [],
          horaInicio: "09:15",
          horaFin: "17:40",
        },
      ]);
    });

    it("normaliza listados nulos a arreglos vacíos", async () => {
      reporteRepo.createQueryBuilder.mockReturnValue(
        qbFake([reporteFixture({ clientesVisitadosJson: null, clientesSinPagoJson: null })]),
      );

      const [reporte] = await service.historial(5, null, null, admin);

      expect(reporte.clientesVisitados).toEqual([]);
      expect(reporte.clientesSinPago).toEqual([]);
    });

    it("lanza NotFound si la ruta no existe", async () => {
      rutaRepo.findOne.mockResolvedValue(null);

      await expect(service.historial(99, null, null, admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("reporteDia", () => {
    beforeEach(() => {
      liquidaciones.calcularTotales.mockResolvedValue({
        estimadoACobrar: 1000,
        sumaCartera: 0,
        totalCobradoPeriodo: 250,
        totalCobradoDia: 250,
        totalPrestado: 500,
        totalGastos: 50,
        totalInyeccion: 0,
      });
    });

    it("lanza NotFound si la ruta no existe", async () => {
      rutaRepo.findOne.mockResolvedValue(null);

      await expect(service.reporteDia(99, "2026-09-17", admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
