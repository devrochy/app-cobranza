import type { Plugin } from "@opencode-ai/plugin"

/**
 * env-guard
 *
 * Capa adicional de seguridad para secretos, complementaria a las reglas de
 * `permission.bash` en opencode.json (que ya bloquean `cat .env*`, etc.).
 *
 * Este plugin se auto-carga porque vive en `.opencode/plugin/` — no necesita
 * entrada en opencode.json.
 *
 * Qué hace:
 * 1. Bloquea que la herramienta `edit`/`write` sobrescriba archivos `.env*`
 *    reales (fuera de `.env.example`) desde una sesión de agente, para que
 *    los secretos locales del desarrollador nunca se toquen por accidente.
 * 2. Redacta (enmascara) cualquier valor que luzca como un secreto si
 *    aparece en la salida de un comando bash, como segunda línea de defensa
 *    por si un comando no cubierto por `permission.bash` termina imprimiendo
 *    contenido de un archivo de entorno.
 */

const ENV_FILE_PATTERN = /(^|\/)\.env(\..+)?$/
const ALLOWED_ENV_FILE = /\.env\.example$/

const SECRET_LOOKING_LINE =
  /(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\s*=\s*.+/gi

function redactSecrets(text: string): string {
  return text.replace(SECRET_LOOKING_LINE, (match) => {
    const [key] = match.split("=")
    return `${key}=***REDACTED-BY-ENV-GUARD***`
  })
}

export default (async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "edit" && input.tool !== "write") return

      const path: string | undefined = (output.args as any)?.filePath
      if (!path) return

      if (ENV_FILE_PATTERN.test(path) && !ALLOWED_ENV_FILE.test(path)) {
        throw new Error(
          `env-guard: bloqueado un intento de escribir en "${path}". ` +
            `Los archivos .env reales no deben ser creados ni modificados ` +
            `por un agente. Si necesitas documentar una variable nueva, ` +
            `edita ".env.example" en su lugar.`,
        )
      }
    },

    "tool.execute.after": async (input, output) => {
      if (input.tool !== "bash") return
      if (typeof (output as any).output !== "string") return
      ;(output as any).output = redactSecrets((output as any).output)
    },
  }
}) satisfies Plugin
