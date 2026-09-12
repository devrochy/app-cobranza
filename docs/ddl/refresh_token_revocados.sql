-- DDL para producción (TypeORM corre con `synchronize: false` cuando NODE_ENV=production).
-- En dev/e2e la tabla la crea `synchronize` a partir de `RefreshTokenRevocado`.
-- Blacklist de refresh tokens revocados (logout real / refresh de un solo uso).
CREATE TABLE IF NOT EXISTS refresh_token_revocados (
  jti varchar NOT NULL,
  revocado_en timestamptz NOT NULL,
  expira_en timestamptz,
  PRIMARY KEY (jti)
);
