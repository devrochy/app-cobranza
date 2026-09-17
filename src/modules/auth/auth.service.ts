import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Gestor } from "../gestores/gestor.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { Device } from "../sincronizacion-offline/device.entity";
import { IntentosAccesoService } from "../sincronizacion-offline/intentos-acceso.service";
import { RefreshTokenRevocado } from "./refresh-token-revocado.entity";

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

export interface PropietarioLoginResult extends AuthTokenPair {
  propietario: {
    id: number;
    usuario: string;
    nombre: string;
    apellido: string;
  };
}

export interface GestorLoginResult extends AuthTokenPair {
  gestor: {
    id: number;
    usuario: string;
    nombre: string;
    apellido: string;
  };
}

export type RolUsuario = "admin" | "propietario" | "gestor";

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
    @InjectRepository(Propietario)
    private readonly propietarioRepo: Repository<Propietario>,
    @InjectRepository(Gestor)
    private readonly gestorRepo: Repository<Gestor>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(RefreshTokenRevocado)
    private readonly revocadoRepo: Repository<RefreshTokenRevocado>,
    private readonly intentosAcceso: IntentosAccesoService,
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

  async loginPropietario(usuario: string, password: string): Promise<PropietarioLoginResult> {
    const propietario = await this.propietarioRepo.findOne({
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

    if (!propietario) {
      await this.password.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const passwordOk = await this.password.compare(password, propietario.passwordHash);
    if (propietario.estatus !== "activo" || !passwordOk) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const tokens = await this.issueTokens("propietario", propietario);
    return {
      ...tokens,
      propietario: {
        id: propietario.id,
        usuario: propietario.usuario,
        nombre: propietario.nombre,
        apellido: propietario.apellido,
      },
    };
  }

  async loginGestor(
    usuario: string,
    password: string,
    device?: { imei?: string; whatsappNumber?: string },
  ): Promise<GestorLoginResult> {
    const gestor = await this.gestorRepo.findOne({
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

    if (!gestor) {
      await this.password.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const passwordOk = await this.password.compare(password, gestor.passwordHash);
    if (gestor.estatus !== "activo" || !passwordOk) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    // HU-39: si el gestor tiene un dispositivo vinculado, el login debe venir
    // de ese dispositivo (IMEI + WhatsApp). Si aún no tiene, se permite el login
    // para que el administrador pueda vincularlo después.
    const registrado = await this.deviceRepo.findOne({
      where: { gestorId: gestor.id, estado: "activo" },
    });
    if (registrado) {
      const coincide =
        device?.imei === registrado.imei &&
        device?.whatsappNumber === registrado.whatsappNumber;
      if (!coincide) {
        // HU-42: registrar el intento no autorizado antes de rechazar.
        await this.intentosAcceso.registrar({
          gestorId: gestor.id,
          imei: device?.imei ?? null,
          whatsappNumber: device?.whatsappNumber ?? null,
          motivo: "imei_no_coincide",
        });
        throw new ForbiddenException(
          "Dispositivo no autorizado para este gestor",
        );
      }
    }

    const tokens = await this.issueTokens("gestor", gestor);
    return {
      ...tokens,
      gestor: {
        id: gestor.id,
        usuario: gestor.usuario,
        nombre: gestor.nombre,
        apellido: gestor.apellido,
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokenPair> {
    let payload: AuthTokenPayload & { exp?: number };
    try {
      payload = await this.jwt.verifyAsync<AuthTokenPayload & { exp?: number }>(refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    }

    if (payload.tipo !== "refresh") {
      throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    }

    if (payload.jti) {
      const revocado = await this.revocadoRepo.findOne({
        where: { jti: payload.jti },
      });
      if (revocado) {
        throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
      }
    }

    if (payload.rol === "propietario") {
      const propietario = await this.propietarioRepo.findOne({
        where: { id: payload.sub },
        select: { id: true, usuario: true, estatus: true },
      });
      if (!propietario || propietario.estatus !== "activo") {
        throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
      }
      return this.rotarYemitir(payload, "propietario", propietario);
    }

    if (payload.rol === "gestor") {
      const gestor = await this.gestorRepo.findOne({
        where: { id: payload.sub },
        select: { id: true, usuario: true, estatus: true },
      });
      if (!gestor || gestor.estatus !== "activo") {
        throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
      }
      return this.rotarYemitir(payload, "gestor", gestor);
    }

    const admin = await this.repo.findOne({
      where: { id: payload.sub },
      select: { id: true, usuario: true, estado: true },
    });

    if (!admin || admin.estado !== "activo") {
      throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    }

    return this.rotarYemitir(payload, "admin", admin);
  }

  /**
   * Rota el refresh token: revoca el `jti` usado (single-use) y emite un par
   * nuevo. El reuso se detecta con la verificación previa de la blacklist.
   */
  private async rotarYemitir(
    payload: AuthTokenPayload & { exp?: number },
    rol: RolUsuario,
    sub: TokenSubject,
  ): Promise<AuthTokenPair> {
    if (payload.jti) {
      await this.revocadoRepo.upsert(
        {
          jti: payload.jti,
          revocadoEn: new Date(),
          expiraEn: payload.exp ? new Date(payload.exp * 1000) : null,
        },
        ["jti"],
      );
    }
    return this.issueTokens(rol, sub);
  }

  /**
   * Revoca un refresh token insertando su `jti` en la blacklist (idempotente y
   * best-effort: si el token es inválido/expirado no hace nada).
   */
  async revocar(refreshToken: string): Promise<void> {
    let payload: (AuthTokenPayload & { exp?: number }) | null;
    try {
      payload = await this.jwt.verifyAsync<AuthTokenPayload & { exp?: number }>(
        refreshToken,
        { secret: this.config.get<string>("JWT_REFRESH_SECRET") },
      );
    } catch {
      return;
    }

    if (payload.tipo !== "refresh" || !payload.jti) {
      return;
    }

    await this.revocadoRepo.upsert(
      {
        jti: payload.jti,
        revocadoEn: new Date(),
        expiraEn: payload.exp ? new Date(payload.exp * 1000) : null,
      },
      ["jti"],
    );
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
