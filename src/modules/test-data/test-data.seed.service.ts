import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { SociosService } from "../socios/socios.service";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { Cobrador } from "../cobradores/cobrador.entity";
import { CobradoresService } from "../cobradores/cobradores.service";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { PasswordService } from "../security/password.service";
import { Device } from "../sincronizacion-offline/device.entity";
import { Ruta } from "../rutas/ruta.entity";
import { RutasService } from "../rutas/rutas.service";
import { RutaConfigService } from "../rutas/ruta-config.service";
import { RutaOptimizacionService } from "../rutas/ruta-optimizacion.service";
import { GastosService } from "../rutas/gastos.service";
import { InyeccionesService } from "../rutas/inyecciones.service";
import { RutasNotasService } from "../rutas/rutas-notas.service";
import { LiquidacionesService } from "../rutas/liquidaciones.service";
import { TrayectoriasService } from "../rutas/trayectorias.service";
import { ClienteService } from "../cartera/cliente.service";
import { PrestamoService } from "../cartera/prestamo.service";
import { PagosService } from "../cartera/pagos.service";
import { AbonosService } from "../cartera/abonos.service";
import { Cuota } from "../cartera/cuota.entity";
import { Prestamo } from "../cartera/prestamo.entity";
import { ArchivoSubido } from "../cartera/cliente.service";

const PASSWORD_PRUEBA = "test-password";
const MARCADOR_SOCIO = "test-socio-1";

/**
 * Matriz de permisos de la APK para los cobradores de prueba (ver_cartera +
 * operaciones de campo). Sin ellos, la APK recibe 403 en sus endpoints
 * (matriz cobrador_permisos vacía → todo deshabilitado).
 */
const PERMISOS_APK = {
  registrar_prestamo: true,
  registrar_pago: true,
  registrar_abono: true,
  registrar_gasto: true,
  registrar_no_pago: true,
  anotar_notas_ruta: true,
  actualizar_cliente: true,
  eliminar_prestamo: true,
  eliminar_pago: true,
  eliminar_abono: true,
  eliminar_gasto: true,
  registrar_inyeccion: true,
  ver_cartera: true,
  generar_reporte: true,
};

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
    @InjectRepository(Cobrador)
    private readonly cobradorRepo: Repository<Cobrador>,
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
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
    private readonly abonosService: AbonosService,
    private readonly gastosService: GastosService,
    private readonly inyeccionesService: InyeccionesService,
    private readonly notasService: RutasNotasService,
    private readonly liquidacionesService: LiquidacionesService,
    private readonly trayectoriasService: TrayectoriasService,
    private readonly rutaOptimizacionService: RutaOptimizacionService,
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
    if (!existe) {
      const requester = { rol: "admin" as const, sub: admin.id };
      await this.semilla(requester);
      this.logger.log("Data de prueba cargada (socios, cobradores, rutas, cartera, operación).");
      return;
    }

    // El socio marcador ya existe: re-sincroniza los permisos de la APK y
    // siembra la cartera de prueba (préstamos + pagos + abonos) si falta.
    const requester = { rol: "admin" as const, sub: admin.id };
    await this.sincronizarDataDePrueba(requester);
    this.logger.log("Data de prueba sincronizada (permisos APK + cartera).");
  }

  private async sincronizarDataDePrueba(requester: { rol: "admin"; sub: number }): Promise<void> {
    const socio = await this.socioRepo.findOne({ where: { usuario: MARCADOR_SOCIO } });
    if (!socio) {
      return;
    }

    // Permisos APK habilitados para todos los cobradores del socio de prueba.
    const cobradores = await this.cobradorRepo.find({
      where: { socio: { id: socio.id } },
    });
    for (const cobrador of cobradores) {
      await this.cobradoresPermisos.setMatriz(cobrador.id, PERMISOS_APK);
    }

    // Cartera: préstamos + pagos + abonos si la ruta aún no tiene préstamos.
    const rutas = await this.rutaRepo.find({
      where: { socio: { id: socio.id } },
    });
    for (const ruta of rutas) {
      const total = await this.prestamoRepo.count({ where: { ruta: { id: ruta.id } } });
      if (total === 0) {
        const clientes = await this.clienteService.listar(ruta.id, requester);
        await this.sembrarPrestamosYPagos(
          ruta.id,
          clientes.map((c) => ({ id: c.id })),
          ruta.nombre === "test-Ruta Centro",
          requester,
        );
      }
    }

    // Manizales: crea la ruta demo (COP) si aún no existe.
    const manizales = rutas.find((r) => r.nombre === "test-Ruta Manizales");
    if (!manizales) {
      const cobrador = cobradores[0];
      if (cobrador) {
        await this.sembrarManizales(cobrador.id, socio.id, requester);
      }
    }
  }

  private async sembrarPrestamosYPagos(
    rutaId: number,
    clientes: { id: number }[],
    conMora: boolean,
    requester: { rol: "admin"; sub: number },
  ): Promise<void> {
    const hace25Dias = this.haceDias(25);
    const rango = conMora ? clientes.slice(0, 6) : clientes;
    for (const cliente of rango) {
      await this.prestamoService.crear(
        rutaId,
        {
          clienteId: cliente.id,
          valor: conMora
            ? 1000 + (Math.round(cliente.id * 137) % 500)
            : 800 + (Math.round(cliente.id * 113) % 400),
          numCuotas: conMora ? 8 : 6,
          diasEntreCuotas: 7,
        },
        requester,
        conMora ? hace25Dias : undefined,
      );
    }

    await this.pagarAlgunasCuotas(rutaId, requester);
    await this.registrarAbonoParcial(rutaId, requester);
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
    await this.cobradoresPermisos.setMatriz(cobradorA.id, PERMISOS_APK);
    await this.cobradoresPermisos.setMatriz(cobradorB.id, PERMISOS_APK);

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
    // Pagos "de hoy" de algunas cuotas + abono parcial FIFO (canvas de cuotas).
    await this.sembrarPrestamosYPagos(rutaA.id, clientesA, true, requester);
    await this.sembrarPrestamosYPagos(rutaB.id, clientesB, false, requester);

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

    // Ruta de prueba en Manizales (COP) con clientes de nombres reales,
    // multi-préstamo y trayecto planificado generado (pruebas de trayectos/día).
    await this.sembrarManizales(cobradorA.id, socio.id, requester);
  }

  private async sembrarManizales(
    cobradorId: number,
    socioId: number,
    requester: { rol: "admin"; sub: number },
  ): Promise<void> {
    const ruta = await this.rutasService.create(
      {
        nombre: "test-Ruta Manizales",
        descripcion: "Ruta demo Manizales (COP)",
        socioId,
        cobradorId,
        tipoInteres: 22,
        numCuotas: 6,
        moneda: "COP",
        saldoInicial: 15000000,
        costoCobro: 5000,
      },
      requester,
    );
    await this.rutaConfigService.setMatriz(
      ruta.id,
      {
        reconocimientoFacialActivo: true,
        registroDocumentoCliente: true,
        permitirCambioFechaPrestamo: true,
      },
      requester,
    );

    const datosClientes = [
      { nombre: "Laura", apellido: "Martínez", negocio: "Tienda La Aurora", telefono: "+573184935933" },
      { nombre: "Andrés", apellido: "Giraldo", negocio: "Cafetería El Bosque", telefono: "+573184935934" },
      { nombre: "María Fernanda", apellido: "López", negocio: "Panadería La Rosa", telefono: "+573184935935" },
      { nombre: "Carlos", apellido: "Ramírez", negocio: "Ferretería El Centro", telefono: "+573184935936" },
      { nombre: "Daniela", apellido: "Castaño", negocio: "Boutique Manizales", telefono: "+573184935937" },
      { nombre: "José", apellido: "Ospina", negocio: "Miscelánea San José", telefono: "+573184935938" },
      { nombre: "Valentina", apellido: "Arias", negocio: "Salón de belleza", telefono: "+573184935939" },
      { nombre: "Sebastián", apellido: "Quintero", negocio: "Taller Don Sebastián", telefono: "+573184935940" },
    ];

    const clientes: { id: number }[] = [];
    for (let i = 0; i < datosClientes.length; i++) {
      const dato = datosClientes[i];
      const cliente = await this.clienteService.crear(
        ruta.id,
        {
          nombre: dato.nombre,
          apellido: dato.apellido,
          telefonoWhatsapp: dato.telefono,
          latitud: 5.07 + i * 0.012,
          longitud: -75.52 + (i % 3) * 0.014,
          negocio: dato.negocio,
        },
        [
          this.evidenciaCliente("foto_facial", `test-foto-mz-${i + 1}.jpg`),
          this.evidenciaCliente("documento_frente", `test-doc-mz-${i + 1}.jpg`),
        ],
        requester,
      );
      clientes.push({ id: cliente.id });
    }

    // Préstamos: 1 vigente por cliente + casos multi-préstamo:
    // - id % 3 === 1: segundo préstamo liquidado (2 préstamos).
    // - id % 3 === 2: segundo cancelado + tercero vigente (3 préstamos).
    for (const cliente of clientes) {
      const prestamo = await this.prestamoService.crear(
        ruta.id,
        {
          clienteId: cliente.id,
          valor: 500000 + (Math.round(cliente.id * 137) % 300000),
          numCuotas: 6,
          diasEntreCuotas: 7,
        },
        requester,
      );
      if (cliente.id % 3 === 1) {
        const extra = await this.prestamoService.crear(
          ruta.id,
          {
            clienteId: cliente.id,
            valor: 200000,
            numCuotas: 3,
            diasEntreCuotas: 7,
          },
          requester,
        );
        if (prestamo.id) {
          await this.prestamoRepo.update(prestamo.id, { estatus: "liquidado" });
        }
        if (extra.id) {
          await this.prestamoRepo.update(extra.id, { estatus: "cancelado" });
        }
      } else if (cliente.id % 3 === 2) {
        const extra = await this.prestamoService.crear(
          ruta.id,
          {
            clienteId: cliente.id,
            valor: 250000,
            numCuotas: 3,
            diasEntreCuotas: 7,
          },
          requester,
        );
        if (extra.id) {
          await this.prestamoRepo.update(extra.id, { estatus: "liquidado" });
        }
      }
    }

    await this.pagarAlgunasCuotas(ruta.id, requester);
    await this.registrarAbonoParcial(ruta.id, requester);
    await this.rutaOptimizacionService.generar(ruta.id, requester);
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

  private async registrarAbonoParcial(
    rutaId: number,
    requester: { rol: "admin"; sub: number },
  ): Promise<void> {
    const cuota = await this.cuotaRepo.findOne({
      where: { prestamo: { ruta: { id: rutaId } }, estatus: "pendiente" },
      order: { id: "ASC" },
    });
    if (!cuota) {
      return;
    }
    await this.abonosService.registrarAbono(
      rutaId,
      { prestamoId: cuota.prestamoId, valor: 100, metodoPago: "efectivo" },
      requester,
    );
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