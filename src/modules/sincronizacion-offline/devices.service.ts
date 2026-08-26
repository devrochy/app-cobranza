import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes, randomUUID } from "crypto";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Device } from "./device.entity";

export interface DeviceRegistrado {
  codigo: string;
  apiKey: string;
  rutaId: number | null;
}

/**
 * Registro y autenticación de dispositivos por API key (HU-64, precursor de la
 * Épica 8). La API key tiene el formato `<codigo>.<secreto>`: el codigo permite
 * localizar el dispositivo y el secreto se valida contra su hash (bcrypt).
 */
@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    private readonly password: PasswordService,
  ) {}

  async registrar(input: { rutaId?: number | null } = {}): Promise<DeviceRegistrado> {
    const codigo = randomUUID();
    const secreto = randomBytes(32).toString("hex");
    const device = this.deviceRepo.create({
      codigo,
      apiKeyHash: await this.password.hash(secreto),
      cobradorId: null,
      imei: null,
      whatsappNumber: null,
      rutaId: input.rutaId ?? null,
      estado: "activo",
      fechaVinculacion: null,
    });
    const saved = await this.deviceRepo.save(device);
    return { codigo: saved.codigo, apiKey: `${saved.codigo}.${secreto}`, rutaId: saved.rutaId };
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
}