import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { SociosService } from "../socios/socios.service";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { CobradoresService } from "../cobradores/cobradores.service";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { PasswordService } from "../security/password.service";
import { Device } from "../sincronizacion-offline/device.entity";
import { RutasService } from "../rutas/rutas.service";
import { RutaConfigService } from "../rutas/ruta-config.service";
import { GastosService } from "../rutas/gastos.service";
import { InyeccionesService } from "../rutas/inyecciones.service";
import { RutasNotasService } from "../rutas/rutas-notas.service";
import { LiquidacionesService } from "../rutas/liquidaciones.service";
import { TrayectoriasService } from "../rutas/trayectorias.service";
import { ClienteService } from "../cartera/cliente.service";
import { PrestamoService } from "../cartera/prestamo.service";
import { PagosService } from "../cartera/pagos.service";
import { Cuota } from "../cartera/cuota.entity";
import { ArchivoSubido } from "../cartera/cliente.service";

const PASSWORD_PRUEBA = "test-password";
const MARCADOR_SOCIO = "test-socio-1";

/**
 * Seed de datos de prueba para desarrollo local (pruebas visuales del panel).
 * - Gate: solo corre si `SEED_TEST_DATA=true` (nunca en producción).
 * - Idempotente: si ya existe el socio marcador `test-socio-1`, se omite.
 * - Usa los servicios reales del dominio (generación de cuotas, caja, geography,
 *   hash de password) para que los datos sean coherentes con la operación.
 * - Todos los datos son sintéticos con prefijos `test-`.
 */
@Injectable()
export class TestDataSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TestDataSeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    private readonly password: PasswordService,
    private readonly sociosService: SociosService,
    private readonly permisosSocio: PermisosSocioService,
    private readonly cobradoresService: CobradoresService,
    private readonly cobradoresPermisos: CobradoresPermisosService,
    private readonly rutasService: RutasService,
    private readonly rutaConfigService: RutaConfigService,
    private readonly clienteService: ClienteService,
    private readonly prestamoService: PrestamoService,
    private readonly pagosService: PagosService,
    private readonly gastosService: GastosService,
    private readonly inyeccionesService: InyeccionesService,
    private readonly notasService: RutasNotasService,
    private readonly liquidacionesService: LiquidacionesService,
    private readonly trayectoriasService: TrayectoriasService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Difiere al siguiente tick para que el AdminUserSeedService cree el admin
    // primero (el orden de los hooks de bootstrap no está garantizado).
    setTimeout(() => {
      void this.bootstrap().catch((err: unknown) => {
        this.logger.error(`Falló el seed de datos de prueba: ${String(err)}`);
      });
    }, 0);
  }

  async bootstrap(): Promise<void> {
    if (this.config.get<string>("NODE_ENV") === "production") {
      return;
    }
    if (this.config.get<string>("SEED_TEST_DATA") !== "true") {
      return;
    }
    const admin = await this.adminRepo.findOne({ where: { estado: "activo" } });
    if (!admin) {
      this.logger.warn(
        "SEED_TEST_DATA activo pero no hay admin activo; se omite (el seed de admin lo crea).",
      );
      return;
    }
    const existe = await this.socioRepo.findOne({ where: { usuario: MARCADOR_SOCIO } });
    if (existe) {
      this.logger.log("Data de prueba ya presente; se omite.");
      return;
    }

    const requester = { rol: "admin" as const, sub: admin.id };
    await this.semilla(requester);
    this.logger.log("Data de prueba cargada (socios, cobradores, rutas, cartera, operación).");
  }

  private async semilla(requester: { rol: "admin"; sub: number }): Promise<void> {
    const socio = await this.sociosService.create({
      usuario: MARCADOR_SOCIO,
      password: PASSWORD_PRUEBA,
      nombre: "test-Socio",
      apellido: "Demo",
      correo: "test-socio-1@correo.test",
      telefono: "+59170000001",
      codigo: "TEST-SC-001",
      moneda: "BOB",
      estatus: "activo",
    });
    await this.permisosSocio.setMatriz(socio.id, {
      configurar_ruta: true,
      ver_reportes: true,
      generar_reporte: true,
      descargar_reporte: true,
      registrar_gasto: true,
      eliminar_gastos: true,
      eliminar_inyeccion: true,
      anotar_notas_ruta: true,
      actualizar_cliente: true,
      registrar_ruta: true,
      registrar_cobrador: true,
    });

    const cobradorA = await this.cobradoresService.create({
      socioId: socio.id,
      usuario: "test-cobrador-1",
      password: PASSWORD_PRUEBA,
      nombre: "test-Carlos",
      apellido: "Lopez",
      correo: "test-cobrador-1@correo.test",
      telefono: "+59170000002",
      codigo: "TEST-CB-001",
      estatus: "activo",
    });
    const cobradorB = await this.cobradoresService.create({
      socioId: socio.id,
      usuario: "test-cobrador-2",
      password: PASSWORD_PRUEBA,
      nombre: "test-Pedro",
      apellido: "Gomez",
      correo: "test-cobrador-2@correo.test",
      telefono: "+59170000003",
      codigo: "TEST-CB-002",
      estatus: "activo",
    });

    // Permisos de la APK para los cobradores de prueba (ver_cartera y
    // operaciones de campo). Sin ellos, la APK recibe 403 en todos sus
    // endpoints (matriz cobrador_permisos vacía → todo deshabilitado).
    const permisosApk = {
      registrar_prestamo: false,
      registrar_pago: true,
      registrar_abono: false,
      registrar_gasto: true,
      registrar_no_pago: true,
      anotar_notas_ruta: true,
      actualizar_cliente: false,
      eliminar_prestamo: false,
      eliminar_pago: false,
      eliminar_abono: false,
      eliminar_gasto: false,
      registrar_inyeccion: false,
      ver_cartera: true,
      generar_reporte: true,
    };
    await this.cobradoresPermisos.setMatriz(cobradorA.id, permisosApk);
    await this.cobradoresPermisos.setMatriz(cobradorB.id, permisosApk);

    // Ruta A: fotos de cliente requeridas + fechas editables (préstamos atrasados → mora).
    const rutaA = await this.rutasService.create(
      {
        nombre: "test-Ruta Centro",
        descripcion: "Ruta demo céntrica",
        socioId: socio.id,
        cobradorId: cobradorA.id,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 5000,
        costoCobro: 250,
      },
      requester,
    );
    await this.rutaConfigService.setMatriz(
      rutaA.id,
      {
        reconocimientoFacialActivo: true,
        registroDocumentoCliente: true,
        permitirCambioFechaPrestamo: true,
      },
      requester,
    );

    // Dispositivo vinculado al cobrador A para probar el modo offline de la APK
    // (HU-64). API key conocida: <codigo>.<secreto> — el codigo es fijo para que
    // la APK de prueba pueda usarla desde .env.local.
    const deviceCodigo = "00000000-0000-4000-8000-000000000001";
    const deviceSecreto = "test-device-secreto";
    await this.deviceRepo.save(
      this.deviceRepo.create({
        codigo: deviceCodigo,
        apiKeyHash: await this.password.hash(deviceSecreto),
        cobradorId: cobradorA.id,
        rutaId: rutaA.id,
        estado: "activo",
        fechaVinculacion: new Date(),
      }),
    );
    this.logger.log(
      `Device de prueba APK: api key = ${deviceCodigo}.${deviceSecreto}`,
    );

    const rutaB = await this.rutasService.create(
      {
        nombre: "test-Ruta Norte",
        descripcion: "Ruta demo norte",
        socioId: socio.id,
        cobradorId: cobradorB.id,
        tipoInteres: 15,
        numCuotas: 6,
        moneda: "BOB",
        saldoInicial: 3000,
        costoCobro: 200,
      },
      requester,
    );

    const clientesA = await this.seedClientes(rutaA.id, "A", 8, requester, true);
    const clientesB = await this.seedClientes(rutaB.id, "B", 8, requester, false);

    // Préstamos con mora (hace ~25 días) en ruta A; recientes en ruta B.
    const hace25Dias = this.haceDias(25);
    for (const cliente of clientesA.slice(0, 6)) {
      await this.prestamoService.crear(
        rutaA.id,
        {
          clienteId: cliente.id,
          valor: 1000 + Math.round(cliente.id * 137) % 500,
          numCuotas: 8,
          diasEntreCuotas: 7,
        },
        requester,
        hace25Dias,
      );
    }
    for (const cliente of clientesB) {
      await this.prestamoService.crear(
        rutaB.id,
        {
          clienteId: cliente.id,
          valor: 800 + Math.round(cliente.id * 113) % 400,
          numCuotas: 6,
          diasEntreCuotas: 7,
        },
        requester,
      );
    }

    // Pagos "de hoy" de algunas cuotas para que el dashboard muestre cobranza.
    await this.pagarAlgunasCuotas(rutaA.id, requester);
    await this.pagarAlgunasCuotas(rutaB.id, requester);

    // Gastos (uno con evidencia, uno aprobado) + inyecciones + notas.
    const gasto = await this.gastosService.registrar(
      rutaA.id,
      { descripcion: "test-Combustible", valor: 120 },
      [this.evidenciaPlaceholder("factura-test.pdf")],
      requester,
    );
    await this.gastosService.aprobar(rutaA.id, gasto.id, requester);
    await this.gastosService.registrar(
      rutaA.id,
      { descripcion: "test-Limpieza", valor: 40 },
      [],
      requester,
    );
    await this.inyeccionesService.crear(
      rutaA.id,
      { valor: 1500, comentario: "test-Aporte inicial" },
      requester,
    );
    await this.inyeccionesService.crear(
      rutaB.id,
      { valor: 900, comentario: "test-Aporte semanal" },
      requester,
    );
    await this.notasService.crear(rutaA.id, { nota: "test-Nota: cliente X amplió plazo" }, requester);

    await this.liquidacionesService.generar(
      rutaA.id,
      { comentario: "test-liquidacion demo" },
      requester,
    );
    await this.trayectoriasService.generarReporteDiario(rutaA.id, requester);
  }

  private async seedClientes(
    rutaId: number,
    sufijo: string,
    cantidad: number,
    requester: { rol: "admin"; sub: number },
    conFotos: boolean,
  ): Promise<{ id: number }[]> {
    const clientes: { id: number }[] = [];
    for (let i = 0; i < cantidad; i++) {
      const evidencias = conFotos
        ? [
            this.evidenciaCliente("foto_facial", `test-foto-${i + 1}.jpg`),
            this.evidenciaCliente("documento_frente", `test-doc-frente-${i + 1}.jpg`),
          ]
        : [];
      const cliente = await this.clienteService.crear(
        rutaId,
        {
          nombre: `test-Cliente${sufijo}${i + 1}`,
          apellido: "Perez",
          telefonoWhatsapp: `+5917000${String(100 + i)}`,
          latitud: -17.78 + i * 0.015,
          longitud: -63.18 + i * 0.015,
          negocio: `test-Negocio${sufijo}${i + 1}`,
        },
        evidencias,
        requester,
      );
      clientes.push({ id: cliente.id });
    }
    return clientes;
  }

  private async pagarAlgunasCuotas(
    rutaId: number,
    requester: { rol: "admin"; sub: number },
  ): Promise<void> {
    const cuotas = await this.cuotaRepo.find({
      where: { prestamo: { ruta: { id: rutaId } }, estatus: "pendiente" },
      take: 3,
      order: { id: "ASC" },
    });
    for (const cuota of cuotas) {
      await this.pagosService.registrarPagoDeCuota(
        rutaId,
        { cuotaId: cuota.id, valor: cuota.valorEsperado, metodoPago: "efectivo" },
        requester,
      );
    }
  }

  private evidenciaPlaceholder(nombre: string): ArchivoSubido {
    return {
      originalname: nombre,
      mimetype: "application/pdf",
      size: 1024,
      filename: `test-${nombre}`,
      path: `/uploads/gastos/test-${nombre}`,
    };
  }

  private evidenciaCliente(tipo: "foto_facial" | "documento_frente", nombre: string) {
    return {
      tipo,
      archivo: {
        originalname: nombre,
        mimetype: "image/jpeg",
        size: 1024,
        filename: nombre,
        path: `/uploads/clientes/${nombre}`,
      } as ArchivoSubido,
    };
  }

  private haceDias(dias: number): Date {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - dias);
    return fecha;
  }
}