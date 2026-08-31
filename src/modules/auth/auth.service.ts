import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Socio } from "../socios/socio.entity";

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends AuthTokenPair {
  admin: {
    id: number;
    usuario: string;
    nombre: string | null;
    apellido: string | null;
  };
}

export interface SocioLoginResult extends AuthTokenPair {
  socio: {
    id: number;
    usuario: string;
    nombre: string;
    apellido: string;
  };
}

export interface CobradorLoginResult extends AuthTokenPair {
  cobrador: {
    id: number;
    usuario: string;
    nombre: string;
    apellido: string;
  };
}

export type RolUsuario = "admin" | "socio" | "cobrador";

export interface AuthTokenPayload {
  sub: number;
  tipo: "access" | "refresh";
  rol: RolUsuario;
  usuario?: string;
  jti?: string;
}

interface TokenSubject {
  id: number;
  usuario: string;
}

const UNAUTHORIZED_MESSAGE = "Credenciales inválidas";
const INVALID_REFRESH_MESSAGE = "Refresh token inválido";

/**
 * Hash fijo usado para igualar el tiempo de respuesta cuando el usuario no
 * existe (evita enumeración de usuarios por timing side-channel).
 */
const DUMMY_PASSWORD_HASH =
  "$2b$10$RVANvKBhcoZpwL/ok5c54eT0Owd7s9S579mdCvfkG6RTH75RrMWKK";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly repo: Repository<AdminUser>,
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
    @InjectRepository(Cobrador)
    private readonly cobradorRepo: Repository<Cobrador>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly password: PasswordService,
  ) {}

  async login(usuario: string, password: string): Promise<LoginResult> {
    const admin = await this.repo.findOne({
      where: { usuario },
      select: {
        id: true,
        usuario: true,
        passwordHash: true,
        estado: true,
        nombre: true,
        apellido: true,
      },
    });

    if (!admin) {
      await this.password.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const passwordOk = await this.password.compare(password, admin.passwordHash);
    if (admin.estado !== "activo" || !passwordOk) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const tokens = await this.issueTokens("admin", admin);
    return {
      ...tokens,
      admin: {
        id: admin.id,
        usuario: admin.usuario,
        nombre: admin.nombre,
        apellido: admin.apellido,
      },
    };
  }

  async loginSocio(usuario: string, password: string): Promise<SocioLoginResult> {
    const socio = await this.socioRepo.findOne({
      where: { usuario },
      select: {
        id: true,
        usuario: true,
        passwordHash: true,
        estatus: true,
        nombre: true,
        apellido: true,
      },
    });

    if (!socio) {
      await this.password.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const passwordOk = await this.password.compare(password, socio.passwordHash);
    if (socio.estatus !== "activo" || !passwordOk) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const tokens = await this.issueTokens("socio", socio);
    return {
      ...tokens,
      socio: {
        id: socio.id,
        usuario: socio.usuario,
        nombre: socio.nombre,
        apellido: socio.apellido,
      },
    };
  }

  async loginCobrador(usuario: string, password: string): Promise<CobradorLoginResult> {
    const cobrador = await this.cobradorRepo.findOne({
      where: { usuario },
      select: {
        id: true,
        usuario: true,
        passwordHash: true,
        estatus: true,
        nombre: true,
        apellido: true,
      },
    });

    if (!cobrador) {
      await this.password.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const passwordOk = await this.password.compare(password, cobrador.passwordHash);
    if (cobrador.estatus !== "activo" || !passwordOk) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const tokens = await this.issueTokens("cobrador", cobrador);
    return {
      ...tokens,
      cobrador: {
        id: cobrador.id,
        usuario: cobrador.usuario,
        nombre: cobrador.nombre,
        apellido: cobrador.apellido,
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokenPair> {
    let payload: AuthTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AuthTokenPayload>(refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    }

    if (payload.tipo !== "refresh") {
      throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    }

    if (payload.rol === "socio") {
      const socio = await this.socioRepo.findOne({
        where: { id: payload.sub },
        select: { id: true, usuario: true, estatus: true },
      });
      if (!socio || socio.estatus !== "activo") {
        throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
      }
      return this.issueTokens("socio", socio);
    }

    if (payload.rol === "cobrador") {
      const cobrador = await this.cobradorRepo.findOne({
        where: { id: payload.sub },
        select: { id: true, usuario: true, estatus: true },
      });
      if (!cobrador || cobrador.estatus !== "activo") {
        throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
      }
      return this.issueTokens("cobrador", cobrador);
    }

    const admin = await this.repo.findOne({
      where: { id: payload.sub },
      select: { id: true, usuario: true, estado: true },
    });

    if (!admin || admin.estado !== "activo") {
      throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    }

    return this.issueTokens("admin", admin);
  }

  private async issueTokens(rol: RolUsuario, sub: TokenSubject): Promise<AuthTokenPair> {
    const accessExpiresIn =
      (this.config.get<string>("JWT_EXPIRES_IN") || "15m") as JwtSignOptions["expiresIn"];
    const refreshExpiresIn =
      (this.config.get<string>("JWT_REFRESH_EXPIRES_IN") || "7d") as JwtSignOptions["expiresIn"];

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        {
          sub: sub.id,
          usuario: sub.usuario,
          rol,
          tipo: "access",
        } satisfies AuthTokenPayload,
        {
          secret: this.config.get<string>("JWT_SECRET"),
          expiresIn: accessExpiresIn,
        },
      ),
      this.jwt.signAsync(
        {
          sub: sub.id,
          rol,
          tipo: "refresh",
          jti: randomUUID(),
        } satisfies AuthTokenPayload,
        {
          secret: this.config.get<string>("JWT_REFRESH_SECRET"),
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }
}
