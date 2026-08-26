/**
 * Setup global para pruebas e2e: hace fail-fast la conexión a la BD.
 * Si la BD no está disponible, TypeORM falla en segundos con un error claro en
 * lugar de la tormenta de reintentos default (10 intentos x 3s por cada app boot,
 * ~30s x ~44 suites) que se percibía como un loop infinito.
 */
process.env.TYPEORM_RETRY_ATTEMPTS = "1";
process.env.TYPEORM_RETRY_DELAY = "500";