import { diskStorage } from "multer";
import { extname, join } from "path";
import { mkdirSync } from "fs";
import { BadRequestException } from "@nestjs/common";
import type { Request } from "express";

export const CLIENTE_UPLOAD_DIR =
  process.env.UPLOAD_DIR_CLIENTES ?? join(process.cwd(), "uploads", "clientes");

const MIMETYPES_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

export const clienteFotosMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      mkdirSync(CLIENTE_UPLOAD_DIR, { recursive: true });
      cb(null, CLIENTE_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (
    _req: Request,
    file: { mimetype: string; originalname: string },
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (MIMETYPES_PERMITIDOS.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException("La foto del cliente debe ser una imagen"), false);
    }
  },
  limits: {
    // Hasta 15MB por archivo: la APK envía hasta 3 fotos juntas al crear un
    // cliente (foto facial + documento frente/reverso) y la cámara del
    // celular puede generar archivos grandes (quality 0.6 en la APK).
    fileSize: 15 * 1024 * 1024,
  },
};
