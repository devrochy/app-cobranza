import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { PropietariosService } from "../propietarios/propietarios.service";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { Gestor } from "../gestores/gestor.entity";
import { GestoresService } from "../gestores/gestores.service";
import { GestoresPermisosService } from "../gestores/gestores-permisos.service";
import { PasswordService } from "../security/password.service";
import { Device } from "../sincronizacion-offline/device.entity";
import { Cartera } from "../carteras/cartera.entity";
import { CarterasService } from "../carteras/carteras.service";
import { CarteraConfigService } from "../carteras/cartera-config.service";
import { CarteraOptimizacionService } from "../carteras/cartera-optimizacion.service";
import { GastosService } from "../carteras/gastos.service";
import { InyeccionesService } from "../carteras/inyecciones.service";
import { CarterasNotasService } from "../carteras/carteras-notas.service";
import { LiquidacionesService } from "../carteras/liquidaciones.service";
import { TrayectoriasService } from "../carteras/trayectorias.service";
import { ClienteService } from "../clientes/cliente.service";
import { PrestamoService } from "../clientes/prestamo.service";
import { PagosService } from "../clientes/pagos.service";
import { AbonosService } from "../clientes/abonos.service";
import { Cuota } from "../clientes/cuota.entity";
import { Prestamo } from "../clientes/prestamo.entity";
import { ArchivoSubido } from "../clientes/cliente.service";

const PASSWORD_PRUEBA = "test-password";
const MARCADOR_PROPIETARIO = "test-propietario-1";

/**
 * Matriz de permisos de la APK para los gestores de prueba (ver_cartera +
 * operaciones de campo). Sin ellos, la APK recibe 403 en sus endpoints
 * (matriz gestor_permisos vacía → todo deshabilitado).
 */
const PERMISOS_APK = {
  registrar_prestamo: true,
  registrar_pago: true,
  registrar_abono: true,
  registrar_gasto: true,
  registrar_no_pago: true,
  anotar_notas_cartera: true,
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
 * - Idempotente: si ya existe el propietario marcador `test-propietario-1`, se omite.
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
    @InjectRepository(Propietario)
    private readonly propietarioRepo: Repository<Propietario>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Gestor)
    private readonly gestorRepo: Repository<Gestor>,
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    private readonly password: PasswordService,
    private readonly propietariosService: PropietariosService,
    private readonly permisosPropietario: PermisosPropietarioService,
    private readonly gestoresService: GestoresService,
    private readonly gestoresPermisos: GestoresPermisosService,
    private readonly carterasService: CarterasService,
    private readonly carteraConfigService: CarteraConfigService,
    private readonly clienteService: ClienteService,
    private readonly prestamoService: PrestamoService,
    private readonly pagosService: PagosService,
    private readonly abonosService: AbonosService,
    private readonly gastosService: GastosService,
    private readonly inyeccionesService: InyeccionesService,
    private readonly notasService: CarterasNotasService,
    private readonly liquidacionesService: LiquidacionesService,
    private readonly trayectoriasService: TrayectoriasService,
    private readonly carteraOptimizacionService: CarteraOptimizacionService,
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
    const existe = await this.propietarioRepo.findOne({ where: { usuario: MARCADOR_PROPIETARIO } });
    if (!existe) {
      const requester = { rol: "admin" as const, sub: admin.id };
      await this.semilla(requester);
      this.logger.log("Data de prueba cargada (propietarios, gestores, carteras, cartera, operación).");
      return;
    }

    // El propietario marcador ya existe: re-sincroniza los permisos de la APK y
    // siembra la cartera de prueba (préstamos + pagos + abonos) si falta.
    const requester = { rol: "admin" as const, sub: admin.id };
    await this.sincronizarDataDePrueba(requester);
    this.logger.log("Data de prueba sincronizada (permisos APK + cartera).");
  }

  private async sincronizarDataDePrueba(requester: { rol: "admin"; sub: number }): Promise<void> {
    const propietario = await this.propietarioRepo.findOne({ where: { usuario: MARCADOR_PROPIETARIO } });
    if (!propietario) {
      return;
    }

    // Permisos APK habilitados para todos los gestores del propietario de prueba.
    const gestores = await this.gestorRepo.find({
      where: { propietario: { id: propietario.id } },
    });
    for (const gestor of gestores) {
      await this.gestoresPermisos.setMatriz(gestor.id, PERMISOS_APK);
    }

    // Cartera: préstamos + pagos + abonos si la cartera aún no tiene préstamos.
    const carteras = await this.carteraRepo.find({
      where: { propietario: { id: propietario.id } },
    });
    for (const cartera of carteras) {
      const total = await this.prestamoRepo.count({ where: { cartera: { id: cartera.id } } });
      if (total === 0) {
        const clientes = await this.clienteService.listar(cartera.id, requester);
        await this.sembrarPrestamosYPagos(
          cartera.id,
          clientes.map((c) => ({ id: c.id })),
          cartera.nombre === "test-Cartera Centro",
          requester,
        );
      }
    }

    // Manizales: crea la cartera demo (COP) si aún no existe.
    const manizales = carteras.find((r) => r.nombre === "test-Cartera Manizales");
    if (!manizales) {
      const gestor = gestores[0];
      if (gestor) {
        await this.sembrarManizales(gestor.id, propietario.id, requester);
      }
    }

    // Cartera inactiva: crea una cartera en estado "bloqueado" si aún no existe, para
    // que la APK muestre la tarjeta de cartera no activa (roja/opaca).
    const inactiva = carteras.find((r) => r.nombre === "test-Cartera Inactiva");
    if (!inactiva) {
      const gestor = gestores[0];
      if (gestor) {
        await this.sembrarCarteraInactiva(gestor.id, propietario.id, requester);
      }
    }
  }

  private async sembrarPrestamosYPagos(
    carteraId: number,
    clientes: { id: number }[],
    conMora: boolean,
    requester: { rol: "admin"; sub: number },
  ): Promise<void> {
    const hace25Dias = this.haceDias(25);
    const rango = conMora ? clientes.slice(0, 6) : clientes;
    for (const cliente of rango) {
      await this.prestamoService.crear(
        carteraId,
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

    await this.pagarAlgunasCuotas(carteraId, requester);
    await this.registrarAbonoParcial(carteraId, requester);
  }

  private async semilla(requester: { rol: "admin"; sub: number }): Promise<void> {
    const propietario = await this.propietariosService.create({
      usuario: MARCADOR_PROPIETARIO,
      password: PASSWORD_PRUEBA,
      nombre: "test-Propietario",
      apellido: "Demo",
      correo: "test-propietario-1@correo.test",
      telefono: "+59170000001",
      codigo: "TEST-SC-001",
      moneda: "BOB",
      estatus: "activo",
    });
    await this.permisosPropietario.setMatriz(propietario.id, {
      configurar_cartera: true,
      ver_reportes: true,
      generar_reporte: true,
      descargar_reporte: true,
      registrar_gasto: true,
      eliminar_gastos: true,
      eliminar_inyeccion: true,
      anotar_notas_cartera: true,
      actualizar_cliente: true,
      registrar_cartera: true,
      registrar_gestor: true,
    });

    const gestorA = await this.gestoresService.create({
      propietarioId: propietario.id,
      usuario: "test-gestor-1",
      password: PASSWORD_PRUEBA,
      nombre: "test-Carlos",
      apellido: "Lopez",
      correo: "test-gestor-1@correo.test",
      telefono: "+59170000002",
      codigo: "TEST-CB-001",
      estatus: "activo",
    });
    const gestorB = await this.gestoresService.create({
      propietarioId: propietario.id,
      usuario: "test-gestor-2",
      password: PASSWORD_PRUEBA,
      nombre: "test-Pedro",
      apellido: "Gomez",
      correo: "test-gestor-2@correo.test",
      telefono: "+59170000003",
      codigo: "TEST-CB-002",
      estatus: "activo",
    });

    // Permisos de la APK para los gestores de prueba (ver_cartera y
    // operaciones de campo). Sin ellos, la APK recibe 403 en todos sus
    // endpoints (matriz gestor_permisos vacía → todo deshabilitado).
    await this.gestoresPermisos.setMatriz(gestorA.id, PERMISOS_APK);
    await this.gestoresPermisos.setMatriz(gestorB.id, PERMISOS_APK);

    // Cartera A: fotos de cliente requeridas + fechas editables (préstamos atrasados → mora).
    const carteraA = await this.carterasService.create(
      {
        nombre: "test-Cartera Centro",
        descripcion: "Cartera demo céntrica",
        propietarioId: propietario.id,
        gestorId: gestorA.id,
        tipoInteres: 20,
        numCuotas: 8,
        moneda: "BOB",
        saldoInicial: 5000,
        costoCobro: 250,
      },
      requester,
    );
    await this.carteraConfigService.setMatriz(
      carteraA.id,
      {
        reconocimientoFacialActivo: true,
        registroDocumentoCliente: true,
        permitirCambioFechaPrestamo: true,
        eliminarPagosApk: true,
        eliminarAbonosApk: true,
        generarReportesApk: true,
      },
      requester,
    );

    // Dispositivo vinculado al gestor A para probar el modo offline de la APK
    // (HU-64). API key conocida: <codigo>.<secreto> — el codigo es fijo para que
    // la APK de prueba pueda usarla desde .env.local.
    const deviceCodigo = "00000000-0000-4000-8000-000000000001";
    const deviceSecreto = "test-device-secreto";
    await this.deviceRepo.save(
      this.deviceRepo.create({
        codigo: deviceCodigo,
        apiKeyHash: await this.password.hash(deviceSecreto),
        gestorId: gestorA.id,
        carteraId: carteraA.id,
        estado: "activo",
        fechaVinculacion: new Date(),
      }),
    );
    this.logger.log(
      `Device de prueba APK: api key = ${deviceCodigo}.${deviceSecreto}`,
    );

    const carteraB = await this.carterasService.create(
      {
        nombre: "test-Cartera Norte",
        descripcion: "Cartera demo norte",
        propietarioId: propietario.id,
        gestorId: gestorB.id,
        tipoInteres: 15,
        numCuotas: 6,
        moneda: "BOB",
        saldoInicial: 3000,
        costoCobro: 200,
      },
      requester,
    );

    const clientesA = await this.seedClientes(carteraA.id, "A", 8, requester);
    const clientesB = await this.seedClientes(carteraB.id, "B", 8, requester);

    // Norte también habilita borrar pagos/abonos y generar reportes en la APK.
    await this.carteraConfigService.setMatriz(
      carteraB.id,
      {
        eliminarPagosApk: true,
        eliminarAbonosApk: true,
        generarReportesApk: true,
      },
      requester,
    );

    // Préstamos con mora (hace ~25 días) en cartera A; recientes en cartera B.
    // Pagos "de hoy" de algunas cuotas + abono parcial FIFO (canvas de cuotas).
    await this.sembrarPrestamosYPagos(carteraA.id, clientesA, true, requester);
    await this.sembrarPrestamosYPagos(carteraB.id, clientesB, false, requester);

    // Gastos (uno con evidencia, uno aprobado) + inyecciones + notas.
    const gasto = await this.gastosService.registrar(
      carteraA.id,
      { descripcion: "test-Combustible", valor: 120 },
      [this.evidenciaPlaceholder("factura-test.pdf")],
      requester,
    );
    await this.gastosService.aprobar(carteraA.id, gasto.id, requester);
    await this.gastosService.registrar(
      carteraA.id,
      { descripcion: "test-Limpieza", valor: 40 },
      [],
      requester,
    );
    await this.inyeccionesService.crear(
      carteraA.id,
      { valor: 1500, comentario: "test-Aporte inicial" },
      requester,
    );
    await this.inyeccionesService.crear(
      carteraB.id,
      { valor: 900, comentario: "test-Aporte semanal" },
      requester,
    );
    await this.notasService.crear(carteraA.id, { nota: "test-Nota: cliente X amplió plazo" }, requester);

    await this.liquidacionesService.generar(
      carteraA.id,
      { comentario: "test-liquidacion demo" },
      requester,
    );
    await this.trayectoriasService.generarReporteDiario(carteraA.id, requester);

    // Cartera de prueba en Manizales (COP) con clientes de nombres reales,
    // multi-préstamo y trayecto planificado generado (pruebas de trayectos/día).
    await this.sembrarManizales(gestorA.id, propietario.id, requester);

    // Cartera inactiva (bloqueada) para ver la tarjeta no activa en la APK.
    await this.sembrarCarteraInactiva(gestorA.id, propietario.id, requester);
  }

  private async sembrarManizales(
    gestorId: number,
    propietarioId: number,
    requester: { rol: "admin"; sub: number },
  ): Promise<void> {
    const cartera = await this.carterasService.create(
      {
        nombre: "test-Cartera Manizales",
        descripcion: "Cartera demo Manizales (COP)",
        propietarioId,
        gestorId,
        tipoInteres: 22,
        numCuotas: 6,
        moneda: "COP",
        saldoInicial: 15000000,
        costoCobro: 5000,
      },
      requester,
    );
    await this.carteraConfigService.setMatriz(
      cartera.id,
      {
        reconocimientoFacialActivo: true,
        registroDocumentoCliente: true,
        permitirCambioFechaPrestamo: true,
        eliminarPagosApk: true,
        eliminarAbonosApk: true,
        generarReportesApk: true,
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
        cartera.id,
        {
          nombre: dato.nombre,
          apellido: dato.apellido,
          telefonoWhatsapp: dato.telefono,
          latitud: 5.07 + i * 0.012,
          longitud: -75.52 + (i % 3) * 0.014,
          negocio: dato.negocio,
          tipoDocumento: "ci",
          numeroDocumento: String(1000000 + i),
        },
        [],
        requester,
      );
      clientes.push({ id: cliente.id });
    }

    // Préstamos: 1 vigente por cliente + casos multi-préstamo:
    // - id % 3 === 1: segundo préstamo liquidado (2 préstamos).
    // - id % 3 === 2: segundo cancelado + tercero vigente (3 préstamos).
    for (const cliente of clientes) {
      const prestamo = await this.prestamoService.crear(
        cartera.id,
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
          cartera.id,
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
          cartera.id,
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

    await this.pagarAlgunasCuotas(cartera.id, requester);
    await this.registrarAbonoParcial(cartera.id, requester);
    await this.carteraOptimizacionService.generar(cartera.id, requester);
  }

  private async sembrarCarteraInactiva(
    gestorId: number,
    propietarioId: number,
    requester: { rol: "admin"; sub: number },
  ): Promise<void> {
    const existente = await this.carteraRepo.findOne({
      where: { nombre: "test-Cartera Inactiva" },
    });
    if (existente) {
      return;
    }
    const cartera = await this.carterasService.create(
      {
        nombre: "test-Cartera Inactiva",
        descripcion: "Cartera demo inactiva (bloqueada) para pruebas de la APK",
        propietarioId,
        gestorId,
        tipoInteres: 18,
        numCuotas: 6,
        moneda: "BOB",
        saldoInicial: 0,
        costoCobro: 0,
      },
      requester,
    );
    // Marca la cartera como bloqueada: en el dominio no existe "inactivo", el
    // estado no-activo disponible es "bloqueado". La APK la muestra como
    // tarjeta roja/opaca (estatus !== "activo").
    await this.carteraRepo.update(cartera.id, { estatus: "bloqueado" });
  }

  private async seedClientes(
    carteraId: number,
    sufijo: string,
    cantidad: number,
    requester: { rol: "admin"; sub: number },
  ): Promise<{ id: number }[]> {
    const clientes: { id: number }[] = [];
    for (let i = 0; i < cantidad; i++) {
      const cliente = await this.clienteService.crear(
        carteraId,
        {
          nombre: `test-Cliente${sufijo}${i + 1}`,
          apellido: "Perez",
          telefonoWhatsapp: `+5917000${String(100 + i)}`,
          latitud: -17.78 + i * 0.015,
          longitud: -63.18 + i * 0.015,
          negocio: `test-Negocio${sufijo}${i + 1}`,
          tipoDocumento: "ci",
          numeroDocumento: String(2000000 + i),
        },
        [],
        requester,
      );
      clientes.push({ id: cliente.id });
    }
    return clientes;
  }

  private async pagarAlgunasCuotas(
    carteraId: number,
    requester: { rol: "admin"; sub: number },
  ): Promise<void> {
    const cuotas = await this.cuotaRepo.find({
      where: { prestamo: { cartera: { id: carteraId } }, estatus: "pendiente" },
      take: 3,
      order: { id: "ASC" },
    });
    for (const cuota of cuotas) {
      await this.pagosService.registrarPagoDeCuota(
        carteraId,
        { cuotaId: cuota.id, valor: cuota.valorEsperado, metodoPago: "efectivo" },
        requester,
      );
    }
  }

  private async registrarAbonoParcial(
    carteraId: number,
    requester: { rol: "admin"; sub: number },
  ): Promise<void> {
    const cuota = await this.cuotaRepo.findOne({
      where: { prestamo: { cartera: { id: carteraId } }, estatus: "pendiente" },
      order: { id: "ASC" },
    });
    if (!cuota) {
      return;
    }
    await this.abonosService.registrarAbono(
      carteraId,
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

  private haceDias(dias: number): Date {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - dias);
    return fecha;
  }
}