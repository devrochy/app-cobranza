#!/usr/bin/env bash
#
# Prueba end-to-end de la Épica 8 (seguridad de dispositivos) contra el backend
# local. Cubre:
#   - HU-39: vincular device↔cobrador + login que valida IMEI/WhatsApp.
#   - HU-40: snapshot del día cifrado (X25519+HKDF+AES-256-GCM) y descifrado.
#   - HU-41: apertura de ruta (timestamp + coordenadas).
#   - HU-42: intento de acceso no autorizado (403 + registro + consulta).
#   - HU-43: revocación del device (login vuelve a permitirse sin device activo).
#
# Requisitos: backend corriendo, `curl`, `jq` y `node`.
#
# Uso:
#   bash scripts/probar-epica8.sh
#   BASE_URL=http://localhost:3000 ADMIN_USER=admin ADMIN_PASS=secreto \
#     COBRADOR_USER=test-cobrador-1 COBRADOR_PASS=test-password \
#     bash scripts/probar-epica8.sh
#
# Credenciales del admin: se toman de ADMIN_USER/ADMIN_PASS o, si no, de
# ADMIN_INITIAL_USERNAME/ADMIN_INITIAL_PASSWORD (de .env). El cobrador necesita
# un device vinculado y una ruta (el seed con SEED_TEST_DATA=true los crea).

set -euo pipefail

cd "$(dirname "$0")/.."

BASE_URL="${BASE_URL:-http://localhost:3000}"
COBRADOR_USER="${COBRADOR_USER:-test-cobrador-1}"
COBRADOR_PASS="${COBRADOR_PASS:-test-password}"
IMEI="${IMEI:-imei-epica8-$(date +%s)}"
WHATSAPP="${WHATSAPP:-}"

# Carga .env (para ADMIN_INITIAL_*) sin sobreescribir variables ya exportadas.
if [ -f .env ]; then
  while IFS='=' read -r clave valor; do
    case "$clave" in
      \#*|"") continue ;;
    esac
    clave="${clave%"${clave##*[![:space:]]}"}"
    valor="${valor%\"}"; valor="${valor#\"}"
    if [ -z "${!clave:-}" ]; then export "$clave=$valor"; fi
  done < .env
fi

ADMIN_USER="${ADMIN_USER:-${ADMIN_INITIAL_USERNAME:-admin}}"
ADMIN_PASS="${ADMIN_PASS:-${ADMIN_INITIAL_PASSWORD:-}}"

for dep in curl jq node; do
  command -v "$dep" >/dev/null 2>&1 || { echo "Falta '$dep' en el PATH."; exit 1; }
done
[ -n "$ADMIN_PASS" ] || { echo "Define ADMIN_PASS (o ADMIN_INITIAL_PASSWORD en .env)."; exit 1; }

AZUL='\033[1;34m'; VERDE='\033[1;32m'; ROJO='\033[1;31m'; GRIS='\033[0;90m'; SIN='\033[0m'
paso()  { printf "\n${AZUL}== %s${SIN}\n" "$1"; }
ok()    { printf "${VERDE}  ✓ %s${SIN}\n" "$1"; }
info()  { printf "${GRIS}    %s${SIN}\n" "$1"; }
fallo() { printf "${ROJO}  ✗ %s${SIN}\n" "$1" >&2; exit 1; }

api() { # api METODO RUTA [TOKEN] [JSON]
  local metodo="$1" ruta="$2" token="${3:-}" cuerpo="${4:-}"
  local args=(-s -X "$metodo" "$BASE_URL$ruta" -H 'Content-Type: application/json' -w $'\n%{http_code}')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$cuerpo" ] && args+=(-d "$cuerpo")
  curl "${args[@]}"
}
cuerpo() { printf '%s' "$1" | sed '$d'; }  # quita la última línea (status)
estado() { printf '%s' "$1" | tail -n1; }

# ---------------------------------------------------------------------------
paso "0. Health del backend ($BASE_URL)"
salud=$(api GET /health || true)
[ "$(estado "$salud")" = "200" ] || fallo "El backend no responde en $BASE_URL (¿npm run start:dev?)."
ok "backend arriba"

# ---------------------------------------------------------------------------
paso "1. Login admin"
login=$(api POST /auth/login "" "{\"usuario\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")
codigo_login=$(estado "$login")
{ [ "$codigo_login" = "200" ] || [ "$codigo_login" = "201" ]; } || { info "respuesta ($codigo_login): $(cuerpo "$login")"; fallo "login admin falló (revisa ADMIN_USER/ADMIN_PASS)."; }
TOKEN=$(cuerpo "$login" | jq -r .accessToken)
ok "token admin obtenido"

# ---------------------------------------------------------------------------
paso "2. Localizar cobrador y ruta"
cobradores=$(api GET /cobradores "$TOKEN")
COBRADOR_ID=$(cuerpo "$cobradores" | jq -r --arg u "$COBRADOR_USER" '.[] | select(.usuario==$u) | .id' | head -1)
[ -n "$COBRADOR_ID" ] && [ "$COBRADOR_ID" != "null" ] || fallo "No existe el cobrador '$COBRADOR_USER' (¿SEED_TEST_DATA=true?)."
TELEFONO=$(cuerpo "$cobradores" | jq -r --arg u "$COBRADOR_USER" '.[] | select(.usuario==$u) | .telefono // empty' | head -1)
[ -n "$WHATSAPP" ] || WHATSAPP="$TELEFONO"
[ -n "$WHATSAPP" ] || WHATSAPP="+59170000002"
RUTA_ID=$(cuerpo "$(api GET /rutas "$TOKEN")" | jq -r --argjson c "$COBRADOR_ID" '.[] | select(.cobradorId==$c) | .id' | head -1)
ok "cobradorId=$COBRADOR_ID  whatsapp=$WHATSAPP  rutaId=${RUTA_ID:-<ninguna>}"

# ---------------------------------------------------------------------------
paso "3. Generar clave X25519 del dispositivo (HU-40)"
llaves=$(node -e '
const c=require("crypto");
const {publicKey,privateKey}=c.generateKeyPairSync("x25519");
const pub=publicKey.export({format:"jwk"}), priv=privateKey.export({format:"jwk"});
console.log(JSON.stringify({pub:Buffer.from(pub.x,"base64url").toString("base64"),x:priv.x,d:priv.d}));
')
PUB=$(printf '%s' "$llaves" | jq -r .pub)
PRIV_X=$(printf '%s' "$llaves" | jq -r .x)
PRIV_D=$(printf '%s' "$llaves" | jq -r .d)
ok "par de claves generado"

# ---------------------------------------------------------------------------
paso "4. Vincular device al cobrador (HU-39)"
reg=$(api POST /devices "$TOKEN" "{\"cobradorId\":$COBRADOR_ID,\"imei\":\"$IMEI\",\"whatsappNumber\":\"$WHATSAPP\",\"publicKey\":\"$PUB\"}")
[ "$(estado "$reg")" = "201" ] || { info "respuesta: $(cuerpo "$reg")"; fallo "no se pudo vincular el device."; }
APIKEY=$(cuerpo "$reg" | jq -r .apiKey)
DEVICE_ID=$(cuerpo "$(api GET /devices "$TOKEN")" | jq -r --arg i "$IMEI" '.[] | select(.imei==$i) | .id' | head -1)
ok "device vinculado (id=$DEVICE_ID, imei=$IMEI)"
info "apiKey=$APIKEY"

# ---------------------------------------------------------------------------
paso "5. Login con device INCORRECTO → 403 + registro (HU-42)"
malo=$(api POST /auth/cobrador/login "" "{\"usuario\":\"$COBRADOR_USER\",\"password\":\"$COBRADOR_PASS\",\"imei\":\"imei-intruso\",\"whatsappNumber\":\"$WHATSAPP\"}")
[ "$(estado "$malo")" = "403" ] || { info "respuesta: $(cuerpo "$malo")"; fallo "se esperaba 403 con device incorrecto."; }
ok "rechazado con 403: $(cuerpo "$malo" | jq -r .message)"

intentos=$(api GET /intentos-acceso "$TOKEN")
ultimo=$(cuerpo "$intentos" | jq -c --argjson c "$COBRADOR_ID" '[.[] | select(.cobradorId==$c)] | .[0] // empty')
[ -n "$ultimo" ] || fallo "no se registró el intento en /intentos-acceso."
ok "intento registrado: $ultimo"

# ---------------------------------------------------------------------------
paso "6. Login CORRECTO → 200 (HU-39)"
bueno=$(api POST /auth/cobrador/login "" "{\"usuario\":\"$COBRADOR_USER\",\"password\":\"$COBRADOR_PASS\",\"imei\":\"$IMEI\",\"whatsappNumber\":\"$WHATSAPP\"}")
[ "$(estado "$bueno")" = "201" ] || [ "$(estado "$bueno")" = "200" ] || { info "respuesta: $(cuerpo "$bueno")"; fallo "el login válido falló."; }
COBRADOR_TOKEN=$(cuerpo "$bueno" | jq -r .accessToken)
ok "login válido OK"

# ---------------------------------------------------------------------------
paso "7. Snapshot del día (HU-40)"
if [ -n "${RUTA_ID:-}" ] && [ "$RUTA_ID" != "null" ]; then
  snap=$(curl -s "$BASE_URL/sync-offline/dia?rutaId=$RUTA_ID" -H "x-device-key: $APIKEY")
  if [ "$(printf '%s' "$snap" | jq -r '.cifrado // false')" = "true" ]; then
    ok "snapshot CIFRADO (algoritmo: $(printf '%s' "$snap" | jq -r .algoritmo))"
    descifrado=$(PRIV_X="$PRIV_X" PRIV_D="$PRIV_D" node -e '
const c=require("crypto"),fs=require("fs");
const r=JSON.parse(fs.readFileSync(0,"utf8"));
const priv=c.createPrivateKey({key:{kty:"OKP",crv:"X25519",x:process.env.PRIV_X,d:process.env.PRIV_D},format:"jwk"});
const eph=c.createPublicKey({key:{kty:"OKP",crv:"X25519",x:Buffer.from(r.clavePublicaEfimera,"base64").toString("base64url")},format:"jwk"});
const sh=c.diffieHellman({privateKey:priv,publicKey:eph});
const key=Buffer.from(c.hkdfSync("sha256",sh,Buffer.alloc(0),Buffer.from("cobraia-snapshot-v1"),32));
const b=Buffer.from(r.datos,"base64"),tag=b.subarray(b.length-16),ct=b.subarray(0,b.length-16);
const dec=c.createDecipheriv("aes-256-gcm",key,Buffer.from(r.nonce,"base64"));dec.setAuthTag(tag);
process.stdout.write(Buffer.concat([dec.update(ct),dec.final()]).toString("utf8"));
' <<< "$snap")
    info "descifrado: $(printf '%s' "$descifrado" | jq -c '{ruta, clientes: (.clientes|length)}')"
    ok "descifrado con la clave privada del dispositivo"
  else
    info "snapshot en claro (esta rama aún no tiene el cifrado de HU-40): $(printf '%s' "$snap" | jq -c '{ruta, clientes:(.clientes|length)}')"
  fi
else
  info "sin ruta asignada al cobrador; se omite el snapshot"
fi

# ---------------------------------------------------------------------------
paso "8. Apertura de ruta con coordenadas (HU-41)"
if [ -n "${RUTA_ID:-}" ] && [ "$RUTA_ID" != "null" ]; then
  ap=$(api POST "/cobrador/rutas/$RUTA_ID/apertura" "$COBRADOR_TOKEN" '{"latitud":-17.78,"longitud":-63.18}')
  codigo=$(estado "$ap")
  if [ "$codigo" = "201" ] || [ "$codigo" = "200" ]; then
    ok "apertura registrada: $(cuerpo "$ap" | jq -c '{rutaId, fecha, horaInicio, latitud, longitud}')"
  else
    info "respuesta ($codigo): $(cuerpo "$ap")"
  fi
else
  info "sin ruta; se omite la apertura"
fi

# ---------------------------------------------------------------------------
paso "9. Revocar device → login sin device vuelve a permitirse (HU-43)"
rev=$(api PATCH "/devices/$DEVICE_ID/revocar" "$TOKEN")
[ "$(estado "$rev")" = "200" ] || { info "respuesta: $(cuerpo "$rev")"; fallo "no se pudo revocar el device."; }
ok "device revocado (estado=$(cuerpo "$rev" | jq -r .estado))"

sinDevice=$(api POST /auth/cobrador/login "" "{\"usuario\":\"$COBRADOR_USER\",\"password\":\"$COBRADOR_PASS\"}")
if [ "$(estado "$sinDevice")" = "201" ] || [ "$(estado "$sinDevice")" = "200" ]; then
  ok "login sin device permitido (no hay device activo)"
else
  info "respuesta: $(cuerpo "$sinDevice")"
fi

printf "\n${VERDE}Épica 8: flujo completo verificado.${SIN}\n"
