import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { GeoJSONFeatureCollection, GeoJSONLineString, ParadaGeoJSON, TrayectoGeo, trayectoriasAGeoJSON } from "../../domain/trayectorias";
import { Cartera } from "./cartera.entity";
import { CarteraOptimizadaLog } from "./cartera-optimizada-log.entity";
import { ReporteDiario } from "./reporte-diario.entity";
import { ReportesDiariosService } from "./reportes-diarios.service";

export interface RequesterTrayectoriasContext {
  rol: RolUsuario;
  sub: number;
}

export interface ReporteDiarioPublic {
  id: number;
  carteraId: number;
  fecha: string;
  trayectoriasJson: unknown;
}

@Injectable()
export class TrayectoriasService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(CarteraOptimizadaLog)
    private readonly logRepo: Repository<CarteraOptimizadaLog>,
    @InjectRepository(ReporteDiario)
    private readonly reporteRepo: Repository<ReporteDiario>,
    private readonly reportesDiariosService: ReportesDiariosService,
    private readonly dataSource: DataSource,
  ) {}

  async registrarReal(
    carteraId: number,
    puntos: ParadaGeoJSON[],
    requester: RequesterTrayectoriasContext,
  ): Promise<{ id: number; tipo: "real" }> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const geojson = trayectoriasAGeoJSON([puntos]);

    const saved = await this.dataSource.transaction(async (manager) => {
      const logRepo = manager.getRepository(CarteraOptimizadaLog);
      const log = logRepo.create({
        cartera: { id: carteraId } as Cartera,
        carteraId,
        reporteDiarioId: null,
        fecha: this.fechaLocal(new Date()),
        ordenClientesJson: puntos,
        waypointsGeojson: geojson,
        distanciaEstimadaKm: 0,
        tiempoEstimadoMin: 0,
        recalculado: false,
        motivoRecalculo: null,
        tipo: "real",
      });
      const guardado = await logRepo.save(log);

      // Consolida el reporte del día en la misma transacción (HU-49): si falla,
      // se revierte el log para no dejar un registro huérfano sin reporte. Los
      // agregados (totales/visitas/horas) se leen de datos ya confirmados.
      await this.generarReporteDiario(carteraId, requester, manager);
      return guardado;
    });

    return { id: saved.id, tipo: "real" };
  }

  async generarReporteDiario(
    carteraId: number,
    requester: RequesterTrayectoriasContext,
    manager?: EntityManager,
  ): Promise<ReporteDiarioPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const logRepo = manager ? manager.getRepository(CarteraOptimizadaLog) : this.logRepo;
    const reporteRepo = manager ? manager.getRepository(ReporteDiario) : this.reporteRepo;

    const fecha = this.fechaLocal(new Date());

    const planificada = await logRepo.findOne({
      where: { cartera: { id: carteraId }, tipo: "planificada", fecha },
      order: { id: "DESC" },
    });
    const real = await logRepo.findOne({
      where: { cartera: { id: carteraId }, tipo: "real", fecha },
      order: { id: "DESC" },
    });

    const features: GeoJSONLineString[] = [];

    // La planificada guarda `orden_clientes_json` como Trayecto[][] plano (HU-55).
    const planificadaTrayectos = (planificada?.ordenClientesJson as TrayectoGeo[]) ?? [];
    const planificadaFC = trayectoriasAGeoJSON(planificadaTrayectos, "planificada");
    features.push(...planificadaFC.features);

    // La real guarda `orden_clientes_json` como un array plano de paradas (1 trayecto).
    const realPuntos = (real?.ordenClientesJson as ParadaGeoJSON[]) ?? [];
    const realFC = trayectoriasAGeoJSON(realPuntos.length ? [realPuntos] : [], "real");
    features.push(...realFC.features);

    const trayectoriasJson: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features,
    };

    let existente = await reporteRepo.findOne({ where: { cartera: { id: carteraId }, fecha } });
    const campos = await this.reportesDiariosService.computarCampos(carteraId, fecha);
    if (!existente) {
      existente = reporteRepo.create({
        cartera: { id: carteraId } as Cartera,
        carteraId,
        fecha,
        trayectoriasJson,
        ...campos,
      });
    } else {
      existente.trayectoriasJson = trayectoriasJson;
      Object.assign(existente, campos);
    }
    const saved = await reporteRepo.save(existente);
    return { id: saved.id, carteraId, fecha: saved.fecha, trayectoriasJson: saved.trayectoriasJson };
  }

  async consultar(carteraId: number, requester: RequesterTrayectoriasContext): Promise<ReporteDiarioPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const fecha = this.fechaLocal(new Date());
    const reporte = await this.reporteRepo.findOne({ where: { cartera: { id: carteraId }, fecha } });
    if (!reporte) {
      throw new NotFoundException("No hay reporte diario para esta cartera");
    }
    return {
      id: reporte.id,
      carteraId: reporte.carteraId,
      fecha: reporte.fecha,
      trayectoriasJson: reporte.trayectoriasJson,
    };
  }

  private fechaLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}