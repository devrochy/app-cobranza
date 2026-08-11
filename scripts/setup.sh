#!/usr/bin/env bash
# Setup inicial del entorno local (MVP local, sin dependencias de producción).
set -euo pipefail

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Se creó .env a partir de .env.example. Revísalo antes de continuar."
fi

echo "==> Instalando dependencias"
npm install

echo "==> Listo. Próximos pasos:"
echo "  1. Revisa/completa .env"
echo "  2. Levanta Postgres local (docker-compose, cuando se agregue) o tu instancia local"
echo "  3. npm run test   # confirma que el skeleton pasa en verde"
echo "  4. opencode        # inicia tu primera sesión"
