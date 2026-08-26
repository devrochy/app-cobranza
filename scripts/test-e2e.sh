#!/usr/bin/env bash
# Pruebas e2e con verificación previa de conectividad a la BD.
# Evita la tormenta de reintentos de TypeORM (~30s x suite, percibida como loop
# infinito) cuando la BD está caída. Requiere la BD arriba: docker compose up -d
set -euo pipefail

node - <<'EOF'
const { config } = require("dotenv");
config();
const { Client } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("==> Falta DATABASE_URL en .env (revisa .env.example).");
  process.exit(1);
}

const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
client
  .connect()
  .then(() => client.end())
  .then(() => console.log("==> BD disponible"))
  .catch((err) => {
    console.error("==> No se pudo conectar a la BD: " + err.message);
    console.error("==> Levanta Postgres/PostGIS con: docker compose up -d");
    process.exit(1);
  });
EOF

echo "==> E2E"
npm run test:e2e -- --forceExit

echo "==> OK: e2e pasaron correctamente."