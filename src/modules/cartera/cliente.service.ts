import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { Ruta } from "../rutas/ruta.entity";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { RutaConfigDefaults } from "../rutas/ruta-config.service";
import { Cliente, ClienteEstatus } from "./cliente.entity";
import { ClienteEvidencia, ClienteEvidenciaTipo } from "./cliente-evidencia.entity";
import { CambioClientePendiente, CambioClienteEstado } from "./cambio-cliente-pendiente.entity";
import { ColorRiesgo } from "../../domain/color-riesgo";
import { fromPoint, toPoint } from "../../common/geo";

export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  filename: string;
  path: string;
}

export interface ClienteEvidenciaInput {
  tipo: ClienteEvidenciaTipo;
  archivo: ArchivoSubido;
}

export interface CreateClienteInput {
  nombre: string;
  apellido: string;
  negocio?: string;
  telefonoWhatsapp: string;
  latitud: number;
  longitud: number;
  topeMaximoDeuda?: number;
  latitudDomicilio?: number;
  longitudDomicilio?: number;
}

export interface RequesterCarteraContext {
  rol: RolUsuario;
  sub: number;
}

export interface ClientePublic {
  id: number;
  rutaId: number;
  nombre: string;
  apellido: string;
  negocio: string | null;
  telefonoWhatsapp: string;
  latitud: number;
  longitud: number;
  latitudDomicilio: number | null;
  longitudDomicilio: number | null;
  topeMaximoDeuda: number | null;
  estatus: ClienteEstatus;
  colorRiesgo: ColorRiesgo;
  fotoUrl: string | null;
  createdAt: Date;
}

export interface ClienteGlobalPublic extends ClientePublic {
  rutaNombre: string;
}

export interface ListarClientesGlobalFiltros {
  busqueda?: string;
  estatus?: ClienteEstatus;
  colorRiesgo?: ColorRiesgo;
}

export interface ActualizarClienteInput {
  nombre?: string;
  apellido?: string;
  negocio?: string | null;
  telefonoWhatsapp?: string;
  latitud?: number;
  longitud?: number;
  latitudDomicilio?: number;
  longitudDomicilio?: number;
}

export interface ClienteCambioPublic {
  id: number;
  clienteId: number;
  camposPropuestos: Record<string, unknown>;
  estado: CambioClienteEstado;
  solicitadoPorRol: string;
  solicitadoPorId: number;
  revisadoPor: number | null;
  revisadoEn: Date | null;
  motivoRechazo: string | null;
  createdAt: Date;
}

@Injectable()
export class ClienteService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(RutaConfig)
    private readonly configRepo: Repository<RutaConfig>,
    @InjectRepository(Cliente)
    private readonly repo: Repository<Cliente>,
    @InjectRepository(ClienteEvidencia)
    private readonly evidenciaRepo: Repository<ClienteEvidencia>,
    @InjectRepository(CambioClientePendiente)
    private readonly cambioRepo: Repository<CambioClientePendiente>,
    private readonly dataSource: DataSource,
    private readonly permisosSocio: PermisosSocioService,
  ) {}

  async crear(
    rutaId: number,
    input: CreateClienteInput,
    evidencias: ClienteEvidenciaInput[] = [],
    requester: RequesterCarteraContext,
  ): Promise<ClientePublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const config =
      (await this.configRepo.findOne({ where: { ruta: { id: rutaId } } })) ??
      (RutaConfigDefaults as RutaConfig);

    const tiposPresentes = new Set(evidencias.map((e) => e.tipo));
    if (config.reconocimientoFacialActivo && !tiposPresentes.has("foto_facial")) {
      throw new BadRequestException("La foto facial es obligatoria");
    }
    if (config.registroDocumentoCliente && !tiposPresentes.has("documento_frente")) {
      throw new BadRequestException("La foto de documento es obligatoria");
    }

    const cliente = this.repo.create({
      ruta: { id: rutaId } as Ruta,
      rutaId,
      nombre: input.nombre,
      apellido: input.apellido,
      negocio: input.negocio ?? null,
      telefonoWhatsapp: input.telefonoWhatsapp,
      ubicacion: toPoint(input.latitud, input.longitud),
      ubicacionDomicilio:
        input.latitudDomicilio !== undefined && input.longitudDomicilio !== undefined
          ? toPoint(input.latitudDomicilio, input.longitudDomicilio)
          : null,
      topeMaximoDeuda: input.topeMaximoDeuda ?? null,
      estatus: "activo",
      colorRiesgo: "blanco",
    });
    const saved = await this.dataSource.transaction(async (manager) => {
      const clienteRepo = manager.getRepository(Cliente);
      const evidenciaRepo = manager.getRepository(ClienteEvidencia);
      const clienteGuardado = await clienteRepo.save(cliente);

      for (const evidencia of evidencias) {
        const nueva = evidenciaRepo.create({
          cliente: { id: clienteGuardado.id } as ClienteEvidencia["cliente"],
          clienteId: clienteGuardado.id,
          tipo: evidencia.tipo,
          rutaArchivo: evidencia.archivo.path,
          nombreOriginal: evidencia.archivo.originalname,
          mimetype: evidencia.archivo.mimetype,
          tamaño: evidencia.archivo.size,
          creadoPorRol: requester.rol,
          creadoPorId: requester.sub,
        });
        await evidenciaRepo.save(nueva);
      }

      return clienteGuardado;
    });

    return this.toPublic(saved, rutaId);
  }

  async agregarEvidencias(
    rutaId: number,
    clienteId: number,
    evidencias: ClienteEvidenciaInput[],
    requester: RequesterCarteraContext,
  ): Promise<{ clienteId: number }> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const cliente = await this.repo.findOne({
      where: { id: clienteId, ruta: { id: rutaId } },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe");
    }

    const config =
      (await this.configRepo.findOne({ where: { ruta: { id: rutaId } } })) ??
      (RutaConfigDefaults as RutaConfig);

    const tiposPresentes = new Set(evidencias.map((e) => e.tipo));
    if (config.reconocimientoFacialActivo && !tiposPresentes.has("foto_facial")) {
      throw new BadRequestException("La foto facial es obligatoria");
    }
    if (config.registroDocumentoCliente && !tiposPresentes.has("documento_frente")) {
      throw new BadRequestException("La foto de documento es obligatoria");
    }

    for (const evidencia of evidencias) {
      let existente = await this.evidenciaRepo.findOne({
        where: { cliente: { id: clienteId }, tipo: evidencia.tipo },
      });
      if (!existente) {
        existente = this.evidenciaRepo.create({
          cliente: { id: clienteId } as ClienteEvidencia["cliente"],
          clienteId,
          tipo: evidencia.tipo,
          rutaArchivo: evidencia.archivo.path,
          nombreOriginal: evidencia.archivo.originalname,
          mimetype: evidencia.archivo.mimetype,
          tamaño: evidencia.archivo.size,
          creadoPorRol: requester.rol,
          creadoPorId: requester.sub,
        });
      } else {
        existente.rutaArchivo = evidencia.archivo.path;
        existente.nombreOriginal = evidencia.archivo.originalname;
        existente.mimetype = evidencia.archivo.mimetype;
        existente.tamaño = evidencia.archivo.size;
        existente.creadoPorRol = requester.rol;
        existente.creadoPorId = requester.sub;
      }
      await this.evidenciaRepo.save(existente);
    }

    return { clienteId };
  }

  async actualizar(
    rutaId: number,
    clienteId: number,
    input: ActualizarClienteInput,
    requester: RequesterCarteraContext,
  ): Promise<ClientePublic | ClienteCambioPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const cliente = await this.repo.findOne({ where: { id: clienteId, ruta: { id: rutaId } } });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe en esta ruta");
    }

    const tieneCampos = Object.values(input).some((v) => v !== undefined);
    if (!tieneCampos) {
      throw new BadRequestException("No hay campos para actualizar");
    }

    const puedeEditar = await this.puedeEditar(requester);
    if (puedeEditar) {
      this.aplicarCambios(cliente, input);
      const saved = await this.repo.save(cliente);
      return this.toPublic(saved, rutaId);
    }

    // Sin permiso: se crea una propuesta pendiente para aprobación posterior.
    const cambio = this.cambioRepo.create({
      cliente: { id: cliente.id } as CambioClientePendiente["cliente"],
      clienteId: cliente.id,
      camposPropuestos: this.camposPropuestos(input),
      estado: "pendiente",
      solicitadoPorRol: requester.rol,
      solicitadoPorId: requester.sub,
      revisadoPor: null,
      revisadoEn: null,
      motivoRechazo: null,
    });
    const saved = await this.cambioRepo.save(cambio);
    return this.toCambioPublic(saved);
  }

  async decidirPropuesta(
    rutaId: number,
    cambioId: number,
    decision: "aprobar" | "rechazar",
    requester: RequesterCarteraContext,
    motivoRechazo?: string,
  ): Promise<ClienteCambioPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);
    const puedeEditar = await this.puedeEditar(requester);
    if (!puedeEditar) {
      throw new ForbiddenException("Acceso denegado");
    }

    const cambio = await this.cambioRepo.findOne({
      where: { id: cambioId, cliente: { ruta: { id: rutaId } } },
      relations: { cliente: true },
    });
    if (!cambio) {
      throw new NotFoundException("La propuesta no existe en esta ruta");
    }
    if (cambio.estado !== "pendiente") {
      throw new BadRequestException("La propuesta ya fue decidida");
    }
    if (decision === "rechazar" && !motivoRechazo) {
      throw new BadRequestException("El rechazo requiere un motivo");
    }

    const resuelto = await this.dataSource.transaction(async (manager) => {
      const cambioRepo = manager.getRepository(CambioClientePendiente);
      const clienteRepo = manager.getRepository(Cliente);

      cambio.revisadoPor = requester.sub;
      cambio.revisadoEn = new Date();
      if (decision === "aprobar") {
        cambio.estado = "aprobado";
        const clienteActualizado = cambio.cliente;
        this.aplicarCamposPropuestos(clienteActualizado, cambio.camposPropuestos);
        await clienteRepo.save(clienteActualizado);
      } else {
        cambio.estado = "rechazado";
        cambio.motivoRechazo = motivoRechazo ?? null;
      }
      return cambioRepo.save(cambio);
    });

    return this.toCambioPublic(resuelto);
  }

  private async puedeEditar(requester: RequesterCarteraContext): Promise<boolean> {
    if (requester.rol === "admin") {
      return true;
    }
    if (requester.rol !== "socio") {
      return false;
    }
    return this.permisosSocio.tienePermiso(requester.sub, "actualizar_cliente");
  }

  private aplicarCambios(cliente: Cliente, input: ActualizarClienteInput): void {
    if (input.nombre !== undefined) cliente.nombre = input.nombre;
    if (input.apellido !== undefined) cliente.apellido = input.apellido;
    if (input.negocio !== undefined) cliente.negocio = input.negocio;
    if (input.telefonoWhatsapp !== undefined) cliente.telefonoWhatsapp = input.telefonoWhatsapp;
    if (input.latitud !== undefined && input.longitud !== undefined) {
      cliente.ubicacion = toPoint(input.latitud, input.longitud);
    }
    if (input.latitudDomicilio !== undefined && input.longitudDomicilio !== undefined) {
      cliente.ubicacionDomicilio = toPoint(input.latitudDomicilio, input.longitudDomicilio);
    } else if (input.latitudDomicilio === null || input.longitudDomicilio === null) {
      cliente.ubicacionDomicilio = null;
    }
  }

  private camposPropuestos(input: ActualizarClienteInput): Record<string, unknown> {
    const campos: Record<string, unknown> = {};
    if (input.nombre !== undefined) campos.nombre = input.nombre;
    if (input.apellido !== undefined) campos.apellido = input.apellido;
    if (input.negocio !== undefined) campos.negocio = input.negocio;
    if (input.telefonoWhatsapp !== undefined) campos.telefonoWhatsapp = input.telefonoWhatsapp;
    if (input.latitud !== undefined) campos.latitud = input.latitud;
    if (input.longitud !== undefined) campos.longitud = input.longitud;
    if (input.latitudDomicilio !== undefined) campos.latitudDomicilio = input.latitudDomicilio;
    if (input.longitudDomicilio !== undefined) campos.longitudDomicilio = input.longitudDomicilio;
    return campos;
  }

  private aplicarCamposPropuestos(cliente: Cliente, campos: Record<string, unknown>): void {
    if (campos.nombre !== undefined) cliente.nombre = String(campos.nombre);
    if (campos.apellido !== undefined) cliente.apellido = String(campos.apellido);
    if (campos.negocio !== undefined) cliente.negocio = campos.negocio === null ? null : String(campos.negocio);
    if (campos.telefonoWhatsapp !== undefined) cliente.telefonoWhatsapp = String(campos.telefonoWhatsapp);
    if (campos.latitud !== undefined && campos.longitud !== undefined) {
      cliente.ubicacion = toPoint(Number(campos.latitud), Number(campos.longitud));
    }
    if (campos.latitudDomicilio !== undefined || campos.longitudDomicilio !== undefined) {
      if (campos.latitudDomicilio !== null && campos.longitudDomicilio !== null) {
        cliente.ubicacionDomicilio = toPoint(Number(campos.latitudDomicilio), Number(campos.longitudDomicilio));
      } else {
        cliente.ubicacionDomicilio = null;
      }
    }
  }

  private toCambioPublic(cambio: CambioClientePendiente): ClienteCambioPublic {
    return {
      id: cambio.id,
      clienteId: cambio.clienteId,
      camposPropuestos: cambio.camposPropuestos,
      estado: cambio.estado,
      solicitadoPorRol: cambio.solicitadoPorRol,
      solicitadoPorId: cambio.solicitadoPorId,
      revisadoPor: cambio.revisadoPor,
      revisadoEn: cambio.revisadoEn,
      motivoRechazo: cambio.motivoRechazo,
      createdAt: cambio.createdAt,
    };
  }

  async listar(rutaId: number, requester: RequesterCarteraContext): Promise<ClientePublic[]> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);
    const clientes = await this.repo.find({
      where: { ruta: { id: rutaId } },
      order: { id: "ASC" },
    });
    const fotos = await this.fotosFacialesDeClientes(clientes.map((c) => c.id));
    return clientes.map((cliente) =>
      this.toPublic(cliente, rutaId, fotos.get(cliente.id) ?? null),
    );
  }

  private async fotosFacialesDeClientes(
    clienteIds: number[],
  ): Promise<Map<number, string>> {
    if (clienteIds.length === 0) {
      return new Map();
    }
    const evidencias = await this.evidenciaRepo.find({
      where: {
        cliente: { id: In(clienteIds) },
        tipo: "foto_facial",
      },
    });
    const map = new Map<number, string>();
    for (const e of evidencias) {
      if (!map.has(e.clienteId)) {
        map.set(e.clienteId, e.rutaArchivo);
      }
    }
    return map;
  }

  async listarGlobal(
    requester: RequesterCarteraContext,
    filtros: ListarClientesGlobalFiltros = {},
  ): Promise<ClienteGlobalPublic[]> {
    const qb = this.repo
      .createQueryBuilder("cliente")
      .innerJoinAndSelect("cliente.ruta", "ruta")
      .orderBy("cliente.id", "ASC");
    if (requester.rol === "socio") {
      qb.andWhere("ruta.socio_id = :socioId", { socioId: requester.sub });
    }
    if (filtros.estatus) {
      qb.andWhere("cliente.estatus = :estatus", { estatus: filtros.estatus });
    }
    if (filtros.colorRiesgo) {
      qb.andWhere("cliente.colorRiesgo = :riesgo", { riesgo: filtros.colorRiesgo });
    }
    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
      qb.andWhere(
        "(cliente.nombre ILIKE :termino OR cliente.apellido ILIKE :termino OR " +
          "cliente.telefono_whatsapp ILIKE :termino OR cliente.negocio ILIKE :termino)",
        { termino: `%${busqueda}%` },
      );
    }
    const clientes = await qb.getMany();
    return clientes.map((cliente) => ({
      ...this.toPublic(cliente, cliente.rutaId),
      rutaNombre: cliente.ruta.nombre,
    }));
  }

  async listarCambios(
    rutaId: number,
    estado: CambioClienteEstado | undefined,
    requester: RequesterCarteraContext,
  ): Promise<ClienteCambioPublic[]> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);
    const cambios = await this.cambioRepo.find({
      where: {
        cliente: { ruta: { id: rutaId } },
        ...(estado ? { estado } : {}),
      },
      relations: { cliente: true },
      order: { createdAt: "DESC" },
    });
    return cambios.map((cambio) => this.toCambioPublic(cambio));
  }

  async setEstatus(
    rutaId: number,
    clienteId: number,
    estatus: ClienteEstatus,
    requester: RequesterCarteraContext,
  ): Promise<ClientePublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);
    const cliente = await this.repo.findOne({
      where: { id: clienteId, ruta: { id: rutaId } },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe");
    }
    cliente.estatus = estatus;
    const saved = await this.repo.save(cliente);
    return this.toPublic(saved, rutaId);
  }

  private toPublic(cliente: Cliente, rutaId: number, fotoUrl: string | null = null): ClientePublic {
    const { latitud, longitud } = fromPoint(cliente.ubicacion);
    const domicilio = cliente.ubicacionDomicilio ? fromPoint(cliente.ubicacionDomicilio) : null;
    return {
      id: cliente.id,
      rutaId,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      negocio: cliente.negocio,
      telefonoWhatsapp: cliente.telefonoWhatsapp,
      latitud,
      longitud,
      latitudDomicilio: domicilio?.latitud ?? null,
      longitudDomicilio: domicilio?.longitud ?? null,
      topeMaximoDeuda: cliente.topeMaximoDeuda,
      estatus: cliente.estatus,
      colorRiesgo: cliente.colorRiesgo,
      fotoUrl,
      createdAt: cliente.createdAt,
    };
  }
}
