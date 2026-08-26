import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { UNAUTHORIZED_GUARD_MESSAGE } from "../auth/jwt-auth.guard";
import { Device } from "./device.entity";
import { DevicesService } from "./devices.service";

export const DEVICE_API_KEY_HEADER = "x-device-key";

export interface RequestWithDevice extends Request {
  device?: Device;
}

/**
 * Autentica al dispositivo por su API key (header `x-device-key`, formato
 * `<codigo>.<secreto>`). Adjunta el dispositivo resuelto en `request.device`.
 */
@Injectable()
export class DeviceApiKeyGuard implements CanActivate {
  constructor(private readonly devicesService: DevicesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithDevice>();
    const apiKey = request.headers[DEVICE_API_KEY_HEADER];

    if (!apiKey || typeof apiKey !== "string") {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }

    const device = await this.devicesService.autenticar(apiKey);
    if (!device) {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }

    request.device = device;
    return true;
  }
}