import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { Ruta } from "../rutas/ruta.entity";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { RutaConfigDefaults } from "../rutas/ruta-config.service";
import { Cliente, ClienteEstatus } from "./cliente.entity";
import { ClienteEvidencia, ClienteEvidenciaTipo } from "./cliente-evidencia.entity";
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
    private readonly dataSource: DataSource,
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

  private toPublic(cliente: Cliente, rutaId: number): ClientePublic {
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
      createdAt: cliente.createdAt,
    };
  }
}
