import { diskStorage } from "multer";
import { extname, join } from "path";
import { mkdirSync } from "fs";
import { BadRequestException } from "@nestjs/common";
import type { Request } from "express";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads", "gastos");

const MIMETYPES_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const evidenciasMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
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
      cb(new BadRequestException("La evidencia debe ser una imagen o PDF"), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
};
