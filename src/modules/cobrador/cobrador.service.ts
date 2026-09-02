import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ClienteTarjetaService, ClienteTarjetaPublic } from "../cartera/cliente-tarjeta.service";
import { AbonosService } from "../cartera/abonos.service";
import { CreatePrestamoInput, PrestamoService, PrestamoPublic } from "../cartera/prestamo.service";
import { CuotaService } from "../cartera/cuota.service";
import { RutasAperturaService } from "../rutas/rutas-apertura.service";
import { RegistrarVisitaInput, VisitasService, VisitaPublic } from "../cartera/visitas.service";
import { CobradoresPermisosService, PermisoCobradorEstado } from "../cobradores/cobradores-permisos.service";
import { Ruta } from "../rutas/ruta.entity";
import { RutaConfigService, RutaConfigPublic } from "../rutas/ruta-config.service";
import { ArchivoSubido, GastosService, GastoPublic, RegistrarGastoInput } from "../rutas/gastos.service";
import { ClienteDiaPublic, ListaClientesDelDiaService } from "../rutas/lista-clientes-dia.service";
import { RutaOptimizacionService, TrayectoPublic } from "../rutas/ruta-optimizacion.service";
import { TrayectoriasService } from "../rutas/trayectorias.service";
import { RequesterOwned } from "../../common/ownership";
import { ParadaGeoJSON } from "../../domain/trayectorias";

export interface RutaApkPublic {
  id: number;
  nombre: string;
  estatus: string;
  config: RutaConfigPublic;
  permisos: PermisoCobradorEstado[];
}

export interface DiaApkPublic {
  clientes: ClienteDiaPublic[];
  trayectos: TrayectoPublic | null;
}

@Injectable()
export class CobradorService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    private readonly rutaConfigService: RutaConfigService,
    private readonly permisosService: CobradoresPermisosService,
    private readonly listaClientesService: ListaClientesDelDiaService,
    private readonly rutaOptimizacionService: RutaOptimizacionService,
    private readonly visitasService: VisitasService,
    private readonly prestamoService: PrestamoService,
    private readonly gastosService: GastosService,
    private readonly trayectoriasService: TrayectoriasService,
    private readonly clienteTarjetaService: ClienteTarjetaService,
    private readonly cuotaService: CuotaService,
    private readonly abonosService: AbonosService,
    private readonly aperturasService: RutasAperturaService,
  ) {}

  async misRutas(cobradorId: number): Promise<RutaApkPublic[]> {
    const rutas = await this.rutaRepo.find({
      where: { cobrador: { id: cobradorId } },
      order: { id: "ASC" },
    });

    const permisos = await this.permisosService.getMatriz(cobradorId);

    return Promise.all(
      rutas.map(async (ruta) => {
        const config = await this.rutaConfigService.getMatriz(ruta.id, {
          rol: "cobrador",
          sub: cobradorId,
        });
        return {
          id: ruta.id,
          nombre: ruta.nombre,
          estatus: ruta.estatus,
          config,
          permisos,
        };
      }),
    );
  }

  async dia(rutaId: number, requester: RequesterOwned): Promise<DiaApkPublic> {
    const [clientes, trayectos] = await Promise.all([
      this.listaClientesService.obtener(rutaId, requester),
      this.consultarTrayecto(rutaId, requester),
    ]);
    return { clientes, trayectos };
  }

  private async consultarTrayecto(
    rutaId: number,
    requester: RequesterOwned,
  ): Promise<TrayectoPublic | null> {
    try {
      return await this.rutaOptimizacionService.consultar(rutaId, requester);
    } catch (err) {
      if (err instanceof NotFoundException) {
        return null;
      }
      throw err;
    }
  }

  async registrarVisita(
    rutaId: number,
    input: RegistrarVisitaInput,
    requester: RequesterOwned,
  ): Promise<VisitaPublic> {
    return this.visitasService.registrar(rutaId, input, requester);
  }

  async registrarGasto(
    rutaId: number,
    input: RegistrarGastoInput,
    archivos: ArchivoSubido[],
    requester: RequesterOwned,
  ): Promise<GastoPublic> {
    return this.gastosService.registrar(rutaId, input, archivos, requester);
  }

  async registrarTrayectoriaReal(
    rutaId: number,
    puntos: ParadaGeoJSON[],
    requester: RequesterOwned,
  ): Promise<{ id: number; tipo: "real" }> {
    return this.trayectoriasService.registrarReal(rutaId, puntos, requester);
  }

  async obtenerTarjeta(
    rutaId: number,
    clienteId: number,
    requester: RequesterOwned,
  ): Promise<ClienteTarjetaPublic> {
    return this.clienteTarjetaService.obtener(rutaId, clienteId, requester);
  }

  async listarPrestamosDeCliente(
    rutaId: number,
    clienteId: number,
    requester: RequesterOwned,
  ): Promise<PrestamoPublic[]> {
    return this.prestamoService.listarPorCliente(rutaId, clienteId, requester);
  }

  async crearPrestamo(
    rutaId: number,
    input: CreatePrestamoInput,
    requester: RequesterOwned,
    fechaOtorgado: Date = new Date(),
  ): Promise<PrestamoPublic> {
    return this.prestamoService.crear(rutaId, input, requester, fechaOtorgado);
  }

  async editarCuota(
    rutaId: number,
    cuotaId: number,
    input: { valorEsperado?: number; fechaVencimiento?: string },
    ctx: { password: string; motivo: string },
    requester: RequesterOwned,
  ) {
    return this.cuotaService.editarCuota(rutaId, cuotaId, input, ctx, requester);
  }

  async eliminarCuota(
    rutaId: number,
    cuotaId: number,
    ctx: { password: string; motivo: string },
    requester: RequesterOwned,
  ) {
    return this.cuotaService.eliminarCuota(rutaId, cuotaId, ctx, requester);
  }

  async eliminarAbono(
    rutaId: number,
    abonoId: number,
    ctx: { password: string; motivo: string },
    requester: RequesterOwned,
  ) {
    return this.abonosService.eliminarAbono(rutaId, abonoId, ctx, requester);
  }

  async registrarApertura(
    rutaId: number,
    input: { latitud?: number; longitud?: number },
    requester: RequesterOwned,
    ahora: Date = new Date(),
  ) {
    return this.aperturasService.registrar(rutaId, input, requester, ahora);
  }
}