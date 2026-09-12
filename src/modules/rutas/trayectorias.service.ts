import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { GeoJSONFeatureCollection, GeoJSONLineString, ParadaGeoJSON, TrayectoGeo, trayectoriasAGeoJSON } from "../../domain/trayectorias";
import { Ruta } from "./ruta.entity";
import { RutaOptimizadaLog } from "./ruta-optimizada-log.entity";
import { ReporteDiario } from "./reporte-diario.entity";

export interface RequesterTrayectoriasContext {
  rol: RolUsuario;
  sub: number;
}

export interface ReporteDiarioPublic {
  id: number;
  rutaId: number;
  fecha: string;
  trayectoriasJson: unknown;
}

@Injectable()
export class TrayectoriasService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(RutaOptimizadaLog)
    private readonly logRepo: Repository<RutaOptimizadaLog>,
    @InjectRepository(ReporteDiario)
    private readonly reporteRepo: Repository<ReporteDiario>,
    private readonly dataSource: DataSource,
  ) {}

  async registrarReal(
    rutaId: number,
    puntos: ParadaGeoJSON[],
    requester: RequesterTrayectoriasContext,
  ): Promise<{ id: number; tipo: "real" }> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const geojson = trayectoriasAGeoJSON([puntos]);

    const saved = await this.dataSource.transaction(async (manager) => {
      const logRepo = manager.getRepository(RutaOptimizadaLog);
      const log = logRepo.create({
        ruta: { id: rutaId } as Ruta,
        rutaId,
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
      // se revierte el log para no dejar un registro huérfano sin reporte.
      await this.generarReporteDiario(rutaId, requester, manager);
      return guardado;
    });

    return { id: saved.id, tipo: "real" };
  }

  async generarReporteDiario(
    rutaId: number,
    requester: RequesterTrayectoriasContext,
    manager?: EntityManager,
  ): Promise<ReporteDiarioPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const logRepo = manager ? manager.getRepository(RutaOptimizadaLog) : this.logRepo;
    const reporteRepo = manager ? manager.getRepository(ReporteDiario) : this.reporteRepo;

    const fecha = this.fechaLocal(new Date());

    const planificada = await logRepo.findOne({
      where: { ruta: { id: rutaId }, tipo: "planificada", fecha },
      order: { id: "DESC" },
    });
    const real = await logRepo.findOne({
      where: { ruta: { id: rutaId }, tipo: "real", fecha },
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

    let existente = await reporteRepo.findOne({ where: { ruta: { id: rutaId }, fecha } });
    if (!existente) {
      existente = reporteRepo.create({
        ruta: { id: rutaId } as Ruta,
        rutaId,
        fecha,
        cobradoDia: 0,
        prestadoDia: 0,
        clientesVisitadosJson: null,
        clientesSinPagoJson: null,
        trayectoriasJson,
        horaInicio: null,
        horaFin: null,
      });
    } else {
      existente.trayectoriasJson = trayectoriasJson;
    }
    const saved = await reporteRepo.save(existente);
    return { id: saved.id, rutaId, fecha: saved.fecha, trayectoriasJson: saved.trayectoriasJson };
  }

  async consultar(rutaId: number, requester: RequesterTrayectoriasContext): Promise<ReporteDiarioPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const fecha = this.fechaLocal(new Date());
    const reporte = await this.reporteRepo.findOne({ where: { ruta: { id: rutaId }, fecha } });
    if (!reporte) {
      throw new NotFoundException("No hay reporte diario para esta ruta");
    }
    return {
      id: reporte.id,
      rutaId: reporte.rutaId,
      fecha: reporte.fecha,
      trayectoriasJson: reporte.trayectoriasJson,
    };
  }

  private fechaLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}