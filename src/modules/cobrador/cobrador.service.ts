import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ClienteTarjetaService, ClienteTarjetaPublic } from "../cartera/cliente-tarjeta.service";
import { ClienteService, ClientePublic, ClienteCambioPublic, ClienteEvidenciaInput, CreateClienteInput, ActualizarClienteInput } from "../cartera/cliente.service";
import { EstadoCuentaService, EstadoCuentaPrestamoPublic } from "../cartera/estado-cuenta.service";
import { DetalleCuotaService, DetalleCuotaPublic } from "../cartera/detalle-cuota.service";
import { AbonosService } from "../cartera/abonos.service";
import { CreatePrestamoInput, PrestamoService, PrestamoPublic } from "../cartera/prestamo.service";
import { CuotaService } from "../cartera/cuota.service";
import { RutasAperturaService } from "../rutas/rutas-apertura.service";
import { RegistrarVisitaInput, VisitasService, VisitaPublic } from "../cartera/visitas.service";
import { CobradoresPermisosService, PermisoCobradorEstado } from "../cobradores/cobradores-permisos.service";
import { COBRADOR_PERMISOS, CobradorPermisoNombre } from "../cobradores/cobrador-permiso.entity";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { SocioPermisoNombre } from "../socios/socio-permiso.entity";
import { Ruta } from "../rutas/ruta.entity";
import { RutaConfigService, RutaConfigPublic } from "../rutas/ruta-config.service";
import { ArchivoSubido, GastosService, GastoPublic, RegistrarGastoInput } from "../rutas/gastos.service";
import { ClienteDiaPublic, ListaClientesDelDiaService } from "../rutas/lista-clientes-dia.service";
import { RutaOptimizacionService, TrayectoPublic } from "../rutas/ruta-optimizacion.service";
import { PosicionCobradorService, PosicionPublic } from "../rutas/posicion-cobrador.service";
import { TrayectoriasService } from "../rutas/trayectorias.service";
import { RutasNotasService, RutaNotaPublic } from "../rutas/rutas-notas.service";
import { RequesterOwned } from "../../common/ownership";
import { ParadaGeoJSON } from "../../domain/trayectorias";

/**
 * Permiso de socio equivalente a cada permiso del cobrador (inverso del guard).
 * La APK consume los permisos con nombres de cobrador, así que para un socio
 * se mapea su matriz socio_permisos a estos nombres.
 */
const PERMISO_SOCIO_A_COBRADOR: Partial<Record<CobradorPermisoNombre, SocioPermisoNombre>> = {
  ver_cartera: "ver_reportes",
  registrar_pago: "configurar_ruta",
  registrar_abono: "configurar_ruta",
  registrar_no_pago: "configurar_ruta",
  registrar_prestamo: "configurar_ruta",
  registrar_gasto: "registrar_gasto",
  anotar_notas_ruta: "anotar_notas_ruta",
  actualizar_cliente: "actualizar_cliente",
  eliminar_abono: "eliminar_abono",
  eliminar_gasto: "eliminar_gastos",
  eliminar_prestamo: "eliminar_prestamos",
  eliminar_pago: "borrar_ultima_cuota",
  generar_reporte: "generar_reporte",
  registrar_inyeccion: "configurar_ruta",
};

/** Permisos del cobrador que tienen equivalente en la matriz del socio. */
const COBRADOR_PERMISOS_FILTERED = COBRADOR_PERMISOS.filter(
  (p) => PERMISO_SOCIO_A_COBRADOR[p] !== undefined,
) as CobradorPermisoNombre[];

export interface RutaApkPublic {
  id: number;
  nombre: string;
  estatus: string;
  tipoInteres: number;
  numCuotas: number;
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
    private readonly clienteService: ClienteService,
    private readonly estadoCuentaService: EstadoCuentaService,
    private readonly cuotaService: CuotaService,
    private readonly abonosService: AbonosService,
    private readonly aperturasService: RutasAperturaService,
    private readonly posicionService: PosicionCobradorService,
    private readonly detalleCuotaService: DetalleCuotaService,
    private readonly permisosSocioService: PermisosSocioService,
    private readonly notasService: RutasNotasService,
  ) {}

  /**
   * HU-35/51: rutas del usuario de la APK. Para rol cobrador filtra por
   * ruta.cobradorId y expone su matriz cobrador_permisos; para rol socio
   * filtra por ruta.socioId y expone la matriz socio_permisos con los
   * permisos que tienen equivalente en la matriz del cobrador (la APK los
   * consume con nombres de cobrador).
   */
  async misRutas(requester: RequesterOwned): Promise<RutaApkPublic[]> {
    const where =
      requester.rol === "socio"
        ? { socioId: requester.sub }
        : { cobrador: { id: requester.sub } };
    const rutas = await this.rutaRepo.find({
      where,
      order: { id: "ASC" },
    });

    const permisos = await this.permisosParaApk(requester);

    return Promise.all(
      rutas.map(async (ruta) => {
        const config = await this.rutaConfigService.getMatriz(ruta.id, requester);
        return {
          id: ruta.id,
          nombre: ruta.nombre,
          estatus: ruta.estatus,
          tipoInteres: ruta.tipoInteres,
          numCuotas: ruta.numCuotas,
          config,
          permisos,
        };
      }),
    );
  }

  private async permisosParaApk(requester: RequesterOwned): Promise<PermisoCobradorEstado[]> {
    if (requester.rol === "socio") {
      const matrizSocio = await this.permisosSocioService.getMatriz(requester.sub);
      const habilitados = new Map(matrizSocio.map((p) => [p.permiso, p.habilitado]));
      return COBRADOR_PERMISOS_FILTERED.map((permiso) => {
        const equivalente = PERMISO_SOCIO_A_COBRADOR[permiso];
        return {
          permiso,
          habilitado: equivalente ? (habilitados.get(equivalente) ?? false) : false,
        };
      });
    }
    return this.permisosService.getMatriz(requester.sub);
  }

  async dia(rutaId: number, requester: RequesterOwned): Promise<DiaApkPublic> {
    const [clientes, trayectos] = await Promise.all([
      this.listaClientesService.obtener(rutaId, requester),
      this.consultarTrayecto(rutaId, requester),
    ]);
    return { clientes, trayectos };
  }

  async generarTrayecto(
    rutaId: number,
    requester: RequesterOwned,
  ): Promise<TrayectoPublic["ordenClientes"]> {
    return this.rutaOptimizacionService.generar(rutaId, requester);
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

  async listarClientesDeRuta(
    rutaId: number,
    requester: RequesterOwned,
  ): Promise<ClientePublic[]> {
    return this.clienteService.listar(rutaId, requester);
  }

  async crearCliente(
    rutaId: number,
    input: CreateClienteInput,
    evidencias: ClienteEvidenciaInput[],
    requester: RequesterOwned,
  ): Promise<ClientePublic> {
    return this.clienteService.crear(rutaId, input, evidencias, requester);
  }

  async actualizarCliente(
    rutaId: number,
    clienteId: number,
    input: ActualizarClienteInput,
    requester: RequesterOwned,
  ): Promise<ClientePublic | ClienteCambioPublic> {
    return this.clienteService.actualizar(rutaId, clienteId, input, requester);
  }

  async listarNotas(rutaId: number, requester: RequesterOwned): Promise<RutaNotaPublic[]> {
    return this.notasService.listar(rutaId, requester);
  }

  async crearNota(
    rutaId: number,
    nota: string,
    requester: RequesterOwned,
  ): Promise<RutaNotaPublic> {
    return this.notasService.crear(rutaId, { nota }, requester);
  }

  async agregarEvidenciasCliente(
    rutaId: number,
    clienteId: number,
    evidencias: ClienteEvidenciaInput[],
    requester: RequesterOwned,
  ): Promise<{ clienteId: number }> {
    return this.clienteService.agregarEvidencias(rutaId, clienteId, evidencias, requester);
  }

  async obtenerEstadoCuentaPrestamo(
    rutaId: number,
    prestamoId: number,
    requester: RequesterOwned,
  ): Promise<EstadoCuentaPrestamoPublic> {
    return this.estadoCuentaService.obtener(rutaId, prestamoId, requester);
  }

  async obtenerDetalleCuota(
    rutaId: number,
    prestamoId: number,
    cuotaId: number,
    requester: RequesterOwned,
  ): Promise<DetalleCuotaPublic> {
    return this.detalleCuotaService.obtener(rutaId, prestamoId, cuotaId, requester);
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

  async registrarPosicion(
    rutaId: number,
    input: { latitud: number; longitud: number },
    requester: RequesterOwned,
  ): Promise<PosicionPublic> {
    return this.posicionService.registrar(rutaId, input, requester);
  }
}