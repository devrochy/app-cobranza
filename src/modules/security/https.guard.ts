import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

/**
 * Enforcement de canal cifrado (HU-01 "sobre un canal cifrado (HTTPS/TLS)").
 * En NODE_ENV=production exige que la petición llegue con terminación TLS
 * (conexión directa segura o header X-Forwarded-Proto=https aportado por el
 * proxy). En cualquier otro entorno (desarrollo/test local) permite HTTP.
 */
@Injectable()
export class HttpsGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const nodeEnv = this.config.get<string>("NODE_ENV") ?? "development";
    if (nodeEnv !== "production") {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const proto = req.header("x-forwarded-proto");
    if (req.secure || proto === "https") {
      return true;
    }

    throw new ServiceUnavailableException("Canal HTTPS requerido");
  }
}
