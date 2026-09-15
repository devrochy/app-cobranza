#!/usr/bin/env bash
# Levanta el backend en modo watch sin `nest start --watch` (en algunas máquinas
# su watcher no detecta cambios): compila con tsc y reinicia con `node --watch`.
set -euo pipefail

echo "==> Compilación inicial"
npx tsc -p tsconfig.json

echo "==> tsc en modo watch + node --watch (Ctrl+C para salir)"
npx tsc -w -p tsconfig.json &
TSC_PID=$!
trap 'kill "$TSC_PID" 2>/dev/null || true' EXIT INT TERM

node --watch --enable-source-maps dist/src/main.js
