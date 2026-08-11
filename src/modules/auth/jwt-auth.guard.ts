import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { AuthTokenPayload } from "./auth.service";

export const UNAUTHORIZED_GUARD_MESSAGE = "No autorizado";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthTokenPayload }>();
    const header = request.headers.authorization;

    if (!header) {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }

    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }

    let payload: AuthTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AuthTokenPayload>(token, {
        secret: this.config.get<string>("JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }

    if (payload.tipo !== "access") {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }

    request.user = payload;
    return true;
  }
}
