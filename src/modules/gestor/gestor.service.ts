import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ClienteTarjetaService, ClienteTarjetaPublic } from "../clientes/cliente-tarjeta.service";
import { ClienteService, ClientePublic, ClienteCambioPublic, ClienteEvidenciaInput, CreateClienteInput, ActualizarClienteInput } from "../clientes/cliente.service";
import { EstadoCuentaService, EstadoCuentaPrestamoPublic } from "../clientes/estado-cuenta.service";
import { DetalleCuotaService, DetalleCuotaPublic } from "../clientes/detalle-cuota.service";
import { AbonosService } from "../clientes/abonos.service";
import { PagosService } from "../clientes/pagos.service";
import { CreatePrestamoInput, PrestamoService, PrestamoPublic } from "../clientes/prestamo.service";
import { CuotaService } from "../clientes/cuota.service";
import { CarterasAperturaService } from "../carteras/carteras-apertura.service";
import { CarterasService, CarteraPublic } from "../carteras/carteras.service";
import { RegistrarVisitaInput, VisitasService, VisitaPublic } from "../clientes/visitas.service";
import { GestoresPermisosService, PermisoGestorEstado } from "../gestores/gestores-permisos.service";
import { GESTOR_PERMISOS, GestorPermisoNombre } from "../gestores/gestor-permiso.entity";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { PropietarioPermisoNombre } from "../propietarios/propietario-permiso.entity";
import { Cartera } from "../carteras/cartera.entity";
import { CarteraConfigService, CarteraConfigPublic } from "../carteras/cartera-config.service";
import { ArchivoSubido, GastosService, GastoPublic, RegistrarGastoInput } from "../carteras/gastos.service";
import { ClienteDiaPublic, ListaClientesDelDiaService } from "../carteras/lista-clientes-dia.service";
import { CarteraOptimizacionService, TrayectoPublic } from "../carteras/cartera-optimizacion.service";
import { PosicionGestorService, PosicionPublic } from "../carteras/posicion-gestor.service";
import { LiquidacionesService, LiquidacionPublic } from "../carteras/liquidaciones.service";
import { TrayectoriasService } from "../carteras/trayectorias.service";
import { CarterasNotasService, CarteraNotaPublic } from "../carteras/carteras-notas.service";
import { RequesterOwned } from "../../common/ownership";
import { ParadaGeoJSON } from "../../domain/trayectorias";

/**
 * Permiso de propietario equivalente a cada permiso del gestor (inverso del guard).
 * La APK consume los permisos con nombres de gestor, así que para un propietario
 * se mapea su matriz propietario_permisos a estos nombres.
 */
const PERMISO_PROPIETARIO_A_GESTOR: Partial<Record<GestorPermisoNombre, PropietarioPermisoNombre>> = {
  ver_cartera: "ver_reportes",
  registrar_pago: "configurar_cartera",
  registrar_abono: "configurar_cartera",
  registrar_no_pago: "configurar_cartera",
  registrar_prestamo: "configurar_cartera",
  registrar_gasto: "registrar_gasto",
  anotar_notas_cartera: "anotar_notas_cartera",
  actualizar_cliente: "actualizar_cliente",
  eliminar_abono: "eliminar_abono",
  eliminar_gasto: "eliminar_gastos",
  eliminar_prestamo: "eliminar_prestamos",
  eliminar_pago: "borrar_ultima_cuota",
  generar_reporte: "generar_reporte",
  registrar_inyeccion: "configurar_cartera",
};

/** Permisos del gestor que tienen equivalente en la matriz del propietario. */
const GESTOR_PERMISOS_FILTERED = GESTOR_PERMISOS.filter(
  (p) => PERMISO_PROPIETARIO_A_GESTOR[p] !== undefined,
) as GestorPermisoNombre[];

export interface CarteraApkPublic {
  id: number;
  nombre: string;
  estatus: string;
  tipoInteres: number;
  numCuotas: number;
  config: CarteraConfigPublic;
  permisos: PermisoGestorEstado[];
}

export interface DiaApkPublic {
  clientes: ClienteDiaPublic[];
  trayectos: TrayectoPublic | null;
}

@Injectable()
export class GestorService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    private readonly carteraConfigService: CarteraConfigService,
    private readonly permisosService: GestoresPermisosService,
    private readonly listaClientesService: ListaClientesDelDiaService,
    private readonly carteraOptimizacionService: CarteraOptimizacionService,
    private readonly visitasService: VisitasService,
    private readonly prestamoService: PrestamoService,
    private readonly gastosService: GastosService,
    private readonly trayectoriasService: TrayectoriasService,
    private readonly clienteTarjetaService: ClienteTarjetaService,
    private readonly clienteService: ClienteService,
    private readonly estadoCuentaService: EstadoCuentaService,
    private readonly cuotaService: CuotaService,
    private readonly abonosService: AbonosService,
    private readonly pagosService: PagosService,
    private readonly aperturasService: CarterasAperturaService,
    private readonly posicionService: PosicionGestorService,
    private readonly liquidacionesService: LiquidacionesService,
    private readonly detalleCuotaService: DetalleCuotaService,
    private readonly permisosPropietarioService: PermisosPropietarioService,
    private readonly notasService: CarterasNotasService,
    private readonly carterasService: CarterasService,
  ) {}

  /**
   * HU-09: edición de la metadata de la cartera (nombre/descripción) desde la APK,
   * gated por el permiso `actualizar_cartera` y con ownership del gestor.
   */
  async actualizarCartera(
    carteraId: number,
    input: { nombre: string; descripcion?: string | null },
    requester: RequesterOwned,
  ): Promise<CarteraPublic> {
    return this.carterasService.actualizarInformacion(carteraId, input, requester);
  }

  /**
   * HU-09a: edición de la configuración de la cartera (tipoInteres/numCuotas) desde
   * la APK, gated por `actualizar_cartera` y con ownership del gestor.
   */
  async actualizarConfiguracionCartera(
    carteraId: number,
    input: { tipoInteres?: number; numCuotas?: number },
    requester: RequesterOwned,
  ): Promise<CarteraPublic> {
    return this.carterasService.actualizarConfiguracion(carteraId, input, requester);
  }

  /**
   * HU-35/51: carteras del usuario de la APK. Para rol gestor filtra por
   * cartera.gestorId y expone su matriz gestor_permisos; para rol propietario
   * filtra por cartera.propietarioId y expone la matriz propietario_permisos con los
   * permisos que tienen equivalente en la matriz del gestor (la APK los
   * consume con nombres de gestor).
   */
  async misCarteras(requester: RequesterOwned): Promise<CarteraApkPublic[]> {
    const where =
      requester.rol === "propietario"
        ? { propietario: { id: requester.sub } }
        : { gestor: { id: requester.sub } };
    const carteras = await this.carteraRepo.find({
      where,
      order: { id: "ASC" },
    });

    const permisos = await this.permisosParaApk(requester);

    return Promise.all(
      carteras.map(async (cartera) => {
        const config = await this.carteraConfigService.getMatriz(cartera.id, requester);
        return {
          id: cartera.id,
          nombre: cartera.nombre,
          estatus: cartera.estatus,
          tipoInteres: cartera.tipoInteres,
          numCuotas: cartera.numCuotas,
          config,
          permisos,
        };
      }),
    );
  }

  private async permisosParaApk(requester: RequesterOwned): Promise<PermisoGestorEstado[]> {
    if (requester.rol === "propietario") {
      const matrizPropietario = await this.permisosPropietarioService.getMatriz(requester.sub);
      const habilitados = new Map(matrizPropietario.map((p) => [p.permiso, p.habilitado]));
      return GESTOR_PERMISOS_FILTERED.map((permiso) => {
        const equivalente = PERMISO_PROPIETARIO_A_GESTOR[permiso];
        return {
          permiso,
          habilitado: equivalente ? (habilitados.get(equivalente) ?? false) : false,
        };
      });
    }
    return this.permisosService.getMatriz(requester.sub);
  }

  async dia(carteraId: number, requester: RequesterOwned): Promise<DiaApkPublic> {
    const [clientes, trayectos] = await Promise.all([
      this.listaClientesService.obtener(carteraId, requester),
      this.consultarTrayecto(carteraId, requester),
    ]);
    return { clientes, trayectos };
  }

  async generarTrayecto(
    carteraId: number,
    requester: RequesterOwned,
  ): Promise<TrayectoPublic["ordenClientes"]> {
    return this.carteraOptimizacionService.generar(carteraId, requester);
  }

  private async consultarTrayecto(
    carteraId: number,
    requester: RequesterOwned,
  ): Promise<TrayectoPublic | null> {
    try {
      return await this.carteraOptimizacionService.consultar(carteraId, requester);
    } catch (err) {
      if (err instanceof NotFoundException) {
        return null;
      }
      throw err;
    }
  }

  async registrarVisita(
    carteraId: number,
    input: RegistrarVisitaInput,
    requester: RequesterOwned,
  ): Promise<VisitaPublic> {
    return this.visitasService.registrar(carteraId, input, requester);
  }

  async registrarGasto(
    carteraId: number,
    input: RegistrarGastoInput,
    archivos: ArchivoSubido[],
    requester: RequesterOwned,
  ): Promise<GastoPublic> {
    return this.gastosService.registrar(carteraId, input, archivos, requester);
  }

  async registrarTrayectoriaReal(
    carteraId: number,
    puntos: ParadaGeoJSON[],
    requester: RequesterOwned,
  ): Promise<{ id: number; tipo: "real" }> {
    return this.trayectoriasService.registrarReal(carteraId, puntos, requester);
  }

  async obtenerTarjeta(
    carteraId: number,
    clienteId: number,
    requester: RequesterOwned,
  ): Promise<ClienteTarjetaPublic> {
    return this.clienteTarjetaService.obtener(carteraId, clienteId, requester);
  }

  async listarPrestamosDeCliente(
    carteraId: number,
    clienteId: number,
    requester: RequesterOwned,
  ): Promise<PrestamoPublic[]> {
    return this.prestamoService.listarPorCliente(carteraId, clienteId, requester);
  }

  async listarClientesDeCartera(
    carteraId: number,
    requester: RequesterOwned,
  ): Promise<ClientePublic[]> {
    return this.clienteService.listar(carteraId, requester);
  }

  async crearCliente(
    carteraId: number,
    input: CreateClienteInput,
    evidencias: ClienteEvidenciaInput[],
    requester: RequesterOwned,
  ): Promise<ClientePublic> {
    return this.clienteService.crear(carteraId, input, evidencias, requester);
  }

  async actualizarCliente(
    carteraId: number,
    clienteId: number,
    input: ActualizarClienteInput,
    requester: RequesterOwned,
  ): Promise<ClientePublic | ClienteCambioPublic> {
    return this.clienteService.actualizar(carteraId, clienteId, input, requester);
  }

  async listarNotas(carteraId: number, requester: RequesterOwned): Promise<CarteraNotaPublic[]> {
    return this.notasService.listar(carteraId, requester);
  }

  async crearNota(
    carteraId: number,
    nota: string,
    requester: RequesterOwned,
  ): Promise<CarteraNotaPublic> {
    return this.notasService.crear(carteraId, { nota }, requester);
  }

  async agregarEvidenciasCliente(
    carteraId: number,
    clienteId: number,
    evidencias: ClienteEvidenciaInput[],
    requester: RequesterOwned,
  ): Promise<{ clienteId: number }> {
    return this.clienteService.agregarEvidencias(carteraId, clienteId, evidencias, requester);
  }

  async obtenerEstadoCuentaPrestamo(
    carteraId: number,
    prestamoId: number,
    requester: RequesterOwned,
  ): Promise<EstadoCuentaPrestamoPublic> {
    return this.estadoCuentaService.obtener(carteraId, prestamoId, requester);
  }

  async obtenerDetalleCuota(
    carteraId: number,
    prestamoId: number,
    cuotaId: number,
    requester: RequesterOwned,
  ): Promise<DetalleCuotaPublic> {
    return this.detalleCuotaService.obtener(carteraId, prestamoId, cuotaId, requester);
  }

  async crearPrestamo(
    carteraId: number,
    input: CreatePrestamoInput,
    requester: RequesterOwned,
    fechaOtorgado: Date = new Date(),
  ): Promise<PrestamoPublic> {
    return this.prestamoService.crear(carteraId, input, requester, fechaOtorgado);
  }

  async editarCuota(
    carteraId: number,
    cuotaId: number,
    input: { valorEsperado?: number; fechaVencimiento?: string },
    ctx: { password: string; motivo: string },
    requester: RequesterOwned,
  ) {
    return this.cuotaService.editarCuota(carteraId, cuotaId, input, ctx, requester);
  }

  async eliminarCuota(
    carteraId: number,
    cuotaId: number,
    ctx: { password: string; motivo: string },
    requester: RequesterOwned,
  ) {
    return this.cuotaService.eliminarCuota(carteraId, cuotaId, ctx, requester);
  }

  async eliminarAbono(
    carteraId: number,
    abonoId: number,
    ctx: { password: string; motivo: string },
    requester: RequesterOwned,
  ) {
    return this.abonosService.eliminarAbono(carteraId, abonoId, ctx, requester);
  }

  async eliminarPago(
    carteraId: number,
    pagoId: number,
    ctx: { password: string; motivo: string },
    requester: RequesterOwned,
  ) {
    return this.pagosService.eliminarPago(carteraId, pagoId, ctx, requester);
  }

  generarLiquidacion(
    carteraId: number,
    input: { comentario?: string | null },
    requester: RequesterOwned,
  ): Promise<LiquidacionPublic> {
    return this.liquidacionesService.generar(carteraId, input, requester);
  }

  listarLiquidaciones(
    carteraId: number,
    requester: RequesterOwned,
  ): Promise<LiquidacionPublic[]> {
    return this.liquidacionesService.listar(carteraId, requester);
  }

  exportarLiquidacionPdf(
    carteraId: number,
    liquidacionId: number,
    requester: RequesterOwned,
  ) {
    return this.liquidacionesService.exportarPdf(carteraId, liquidacionId, requester);
  }

  async registrarApertura(
    carteraId: number,
    input: { latitud?: number; longitud?: number },
    requester: RequesterOwned,
    ahora: Date = new Date(),
  ) {
    return this.aperturasService.registrar(carteraId, input, requester, ahora);
  }

  async registrarPosicion(
    carteraId: number,
    input: { latitud: number; longitud: number },
    requester: RequesterOwned,
  ): Promise<PosicionPublic> {
    return this.posicionService.registrar(carteraId, input, requester);
  }
}