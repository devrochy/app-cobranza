import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { validateRequiredEnv } from "./config/config-validation";

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
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
