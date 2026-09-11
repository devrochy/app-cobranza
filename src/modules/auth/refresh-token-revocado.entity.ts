import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Lista negra de refresh tokens revocados (por `jti`). Permite logout real:
 * al revocar un refresh token, `AuthService.refresh` lo rechaza aunque el JWT
 * siga siendo criptográficamente válido.
 */
@Entity("refresh_token_revocados")
export class RefreshTokenRevocado {
  @PrimaryColumn({ type: "varchar" })
  jti!: string;

  @Column({ name: "revocado_en", type: "timestamptz" })
  revocadoEn!: Date;

  @Column({ name: "expira_en", type: "timestamptz", nullable: true })
  expiraEn!: Date | null;
}
