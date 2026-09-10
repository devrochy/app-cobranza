import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes, randomUUID } from "crypto";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Device, DeviceEstado } from "./device.entity";

export interface DeviceRegistrado {
  codigo: string;
  apiKey: string;
  cobradorId: number | null;
  imei: string | null;
  whatsappNumber: string | null;
}

export interface DeviceVinculacionInput {
  cobradorId: number;
  imei: string;
  whatsappNumber: string;
  publicKey: string;
}

export interface DevicePublic {
  id: number;
  cobradorId: number | null;
  imei: string | null;
  whatsappNumber: string | null;
  estado: DeviceEstado;
  fechaVinculacion: Date | null;
  createdAt: Date;
}

/**
 * Registro y autenticación de dispositivos (HU-39, HU-64). El vínculo correcto
 * es **device ↔ cobrador** (1:1): un dispositivo activo por cobrador; al
 * vincular uno nuevo se revoca el anterior. La API key tiene el formato
 * `<codigo>.<secreto>`: el codigo localiza el dispositivo y el secreto se
 * valida contra su hash (bcrypt).
 */
@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    private readonly password: PasswordService,
  ) {}

  async registrar(input: DeviceVinculacionInput): Promise<DeviceRegistrado> {
    // Vínculo 1:1 estricto: revoca el dispositivo activo anterior del cobrador.
    await this.deviceRepo.update(
      { cobradorId: input.cobradorId, estado: "activo" },
      { estado: "revocado" },
    );
    const codigo = randomUUID();
    const secreto = randomBytes(32).toString("hex");
    const device = this.deviceRepo.create({
      codigo,
      apiKeyHash: await this.password.hash(secreto),
      cobradorId: input.cobradorId,
      imei: input.imei,
      whatsappNumber: input.whatsappNumber,
      publicKey: input.publicKey,
      rutaId: null,
      estado: "activo",
      fechaVinculacion: new Date(),
    });
    const saved = await this.deviceRepo.save(device);
    return {
      codigo: saved.codigo,
      apiKey: `${saved.codigo}.${secreto}`,
      cobradorId: saved.cobradorId,
      imei: saved.imei,
      whatsappNumber: saved.whatsappNumber,
    };
  }

  async listar(): Promise<DevicePublic[]> {
    const devices = await this.deviceRepo.find({ order: { id: "DESC" } });
    return devices.map((d) => this.toPublic(d));
  }

  async revocar(id: number): Promise<DevicePublic> {
    const device = await this.deviceRepo.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException("El dispositivo no existe");
    }
    device.estado = "revocado";
    const saved = await this.deviceRepo.save(device);
    return this.toPublic(saved);
  }

  async obtenerPorCobrador(cobradorId: number): Promise<Device | null> {
    return this.deviceRepo.findOne({
      where: { cobradorId, estado: "activo" },
    });
  }

  async autenticar(apiKey: string): Promise<Device | null> {
    const [codigo, secreto] = apiKey.split(".");
    if (!codigo || !secreto) {
      return null;
    }
    const device = await this.deviceRepo.findOne({ where: { codigo } });
    if (!device || device.estado !== "activo") {
      return null;
    }
    const ok = await this.password.compare(secreto, device.apiKeyHash);
    return ok ? device : null;
  }

  private toPublic(device: Device): DevicePublic {
    return {
      id: device.id,
      cobradorId: device.cobradorId,
      imei: device.imei,
      whatsappNumber: device.whatsappNumber,
      estado: device.estado,
      fechaVinculacion: device.fechaVinculacion,
      createdAt: device.createdAt,
    };
  }
}
