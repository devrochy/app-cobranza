import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { ColorListaDelDia, colorListaDelDia } from "../../domain/lista-clientes-dia";
import { Ruta } from "./ruta.entity";
import { RutaConfig } from "./ruta-config.entity";
import { RutaOptimizadaLog } from "./ruta-optimizada-log.entity";
import { RutaOptimizacionService } from "./ruta-optimizacion.service";

export interface RequesterListaDiaContext {
  rol: RolUsuario;
  sub: number;
}

export interface ClienteDiaPublic {
  clienteId: number;
  nombre: string;
  enTrayecto: boolean;
  color: ColorListaDelDia;
}

export interface MarkerClientePublic {
  clienteId: number;
  nombre: string;
  tipo: "negocio" | "domicilio";
  latitud: number;
  longitud: number;
  color: ColorListaDelDia;
  enTrayecto: boolean;
}

@Injectable()
export class ListaClientesDelDiaService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(RutaConfig)
    private readonly configRepo: Repository<RutaConfig>,
    @InjectRepository(RutaOptimizadaLog)
    private readonly logRepo: Repository<RutaOptimizadaLog>,
    private readonly rutaOptimizacionService: RutaOptimizacionService,
  ) {}

  async obtener(rutaId: number, requester: RequesterListaDiaContext): Promise<ClienteDiaPublic[]> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const config = await this.configRepo.findOne({ where: { ruta: { id: rutaId } } });
    const umbral = config?.cuotasAtrasoUmbral ?? 1;

    let enTrayectoIds = new Set<number>();
    try {
      const planificado = await this.rutaOptimizacionService.consultar(rutaId, requester);
      enTrayectoIds = new Set(
        (planificado.ordenClientes ?? []).flat().map((p) => p.clienteId),
      );
    } catch {
      enTrayectoIds = new Set();
    }

    const clientes = await this.listarClientesConEstado(rutaId);
    const pagaronHoy = new Set(await this.clientesConVisitaPagoHoy(rutaId));

    return clientes.map((c) => ({
      clienteId: c.clienteId,
      nombre: c.nombre,
      enTrayecto: enTrayectoIds.has(c.clienteId),
      color: colorListaDelDia(
        c.atraso,
        umbral,
        c.esNuevo,
        pagaronHoy.has(c.clienteId),
      ),
    }));
  }

  async obtenerMapa(rutaId: number, requester: RequesterListaDiaContext): Promise<MarkerClientePublic[]> {
    const clientes = await this.obtener(rutaId, requester);
    const coords = await this.coordenadasDeClientes(rutaId);

    const markers: MarkerClientePublic[] = [];
    for (const cliente of clientes) {
      const c = coords.find((x) => x.clienteId === cliente.clienteId);
      if (!c) continue;
      markers.push({
        clienteId: cliente.clienteId,
        nombre: cliente.nombre,
        tipo: "negocio",
        latitud: c.negocio.latitud,
        longitud: c.negocio.longitud,
        color: cliente.color,
        enTrayecto: cliente.enTrayecto,
      });
      if (c.domicilio) {
        markers.push({
          clienteId: cliente.clienteId,
          nombre: cliente.nombre,
          tipo: "domicilio",
          latitud: c.domicilio.latitud,
          longitud: c.domicilio.longitud,
          color: cliente.color,
          enTrayecto: cliente.enTrayecto,
        });
      }
    }
    return markers;
  }

  private async coordenadasDeClientes(
    rutaId: number,
  ): Promise<Array<{
    clienteId: number;
    negocio: { latitud: number; longitud: number };
    domicilio: { latitud: number; longitud: number } | null;
  }>> {
    const filas = await this.logRepo.manager
      .createQueryBuilder()
      .select("c.id", "clienteId")
      .addSelect("ST_Y(c.ubicacion::geometry)", "latNegocio")
      .addSelect("ST_X(c.ubicacion::geometry)", "lngNegocio")
      .addSelect("ST_Y(c.ubicacion_domicilio::geometry)", "latDomicilio")
      .addSelect("ST_X(c.ubicacion_domicilio::geometry)", "lngDomicilio")
      .from("clientes", "c")
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = 'activo'")
      .getRawMany<{
        clienteId: string;
        latNegocio: string;
        lngNegocio: string;
        latDomicilio: string | null;
        lngDomicilio: string | null;
      }>();

    return filas.map((f) => ({
      clienteId: Number(f.clienteId),
      negocio: { latitud: Number(f.latNegocio), longitud: Number(f.lngNegocio) },
      domicilio:
        f.latDomicilio !== null && f.lngDomicilio !== null
          ? { latitud: Number(f.latDomicilio), longitud: Number(f.lngDomicilio) }
          : null,
    }));
  }

  private async listarClientesConEstado(
    rutaId: number,
  ): Promise<Array<{ clienteId: number; nombre: string; atraso: number; esNuevo: boolean }>> {
    const hoy = this.fechaLocal(new Date());
    const filas = await this.logRepo.manager
      .createQueryBuilder()
      .select("c.id", "clienteId")
      .addSelect("c.nombre || ' ' || c.apellido", "nombre")
      .addSelect(
        "COUNT(CASE WHEN cu.estatus IN ('pendiente','atrasada') AND cu.fecha_vencimiento < :hoy THEN 1 END)",
        "atraso",
      )
      .addSelect(
        "CASE WHEN COUNT(cu.id) = 0 THEN true ELSE false END",
        "esNuevo",
      )
      .from("clientes", "c")
      .leftJoin("prestamos", "p", "p.cliente_id = c.id AND p.estatus = 'vigente'")
      .leftJoin("cuotas", "cu", "cu.prestamo_id = p.id")
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = 'activo'")
      .groupBy("c.id")
      .orderBy("c.nombre", "ASC")
      .setParameter("hoy", hoy)
      .getRawMany<{ clienteId: string; nombre: string; atraso: string; esNuevo: string }>();

    return filas.map((f) => {
      const esNuevo = String(f.esNuevo);
      return {
        clienteId: Number(f.clienteId),
        nombre: f.nombre,
        atraso: Number(f.atraso),
        esNuevo: esNuevo === "true" || esNuevo === "t" || esNuevo === "1",
      };
    });
  }

  private async clientesConVisitaPagoHoy(rutaId: number): Promise<number[]> {
    const hoy = this.fechaLocal(new Date());
    const filas = await this.logRepo.manager
      .createQueryBuilder()
      .select("DISTINCT v.cliente_id", "clienteId")
      .from("visitas", "v")
      .where("v.ruta_id = :rutaId", { rutaId })
      .andWhere("v.fecha = :hoy", { hoy })
      .andWhere("v.resultado = 'pago'")
      .getRawMany<{ clienteId: string }>();
    return filas.map((f) => Number(f.clienteId));
  }

  private fechaLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}