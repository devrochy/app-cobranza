import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

let sdk: NodeSDK | null = null;

/**
 * Inicializa OpenTelemetry (traces de requests HTTP y de acceso a BD vía
 * auto-instrumentación) si `OTEL_EXPORTER_OTLP_ENDPOINT` está configurado.
 * Sin endpoint es no-op (no se exporta nada y no hay overhead de exportación).
 *
 * Debe ejecutarse ANTES de cargar los módulos instrumentados; por eso `main.ts`
 * lo importa como primer módulo después de `dotenv/config`.
 */
export function iniciarTracing(env: NodeJS.ProcessEnv = process.env): boolean {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return false;
  }
  sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME ?? "app-cobranza",
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint.replace(/\/$/, "")}/v1/traces`,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  return true;
}

// Auto-inicio al importar (ver docstring).
iniciarTracing();
