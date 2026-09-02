import "dotenv/config";
import { join } from "path";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { validateRequiredEnv } from "./config/config-validation";
import { resolverOrigenesCors } from "./config/cors";

async function bootstrap(): Promise<void> {
  const missingEnv = validateRequiredEnv({
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  });
  if (missingEnv.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas: ${missingEnv.join(", ")}. ` +
        "Revísalas en .env (ver .env.example).",
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set("trust proxy", 1);
  app.enableCors({
    origin: resolverOrigenesCors(
      process.env.CORS_ORIGINS,
      process.env.NODE_ENV ?? "development",
    ),
  });
  // Sirve las evidencias/fotos subidas (gastos y clientes) en /uploads/*.
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads/" });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
