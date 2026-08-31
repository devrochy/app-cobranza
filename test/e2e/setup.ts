/**
 * Setup global para pruebas e2e: hace fail-fast la conexión a la BD.
 * Si la BD no está disponible, TypeORM falla en segundos con un error claro en
 * lugar de la tormenta de reintentos default (10 intentos x 3s por cada app boot,
 * ~30s x ~44 suites) que se percibía como un loop infinito.
 *
 * Las e2e corren contra una BD dedicada (`app_cobranza_e2e`), separada de la de
 * desarrollo (que puede tener data de prueba del TestDataSeedService). El schema
 * se crea solo (TypeORM `synchronize` en desarrollo). Crear la BD:
 *   createdb app_cobranza_e2e   (o: docker exec app_cobranza_postgres createdb -U postgres app_cobranza_e2e)
 */
const base = (process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/app_cobranza?schema=public");
process.env.DATABASE_URL = base.replace(/\/app_cobranza\?/, "/app_cobranza_e2e?");
process.env.TYPEORM_RETRY_ATTEMPTS = "1";
process.env.TYPEORM_RETRY_DELAY = "500";