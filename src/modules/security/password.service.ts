import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";

/**
 * Abstracción del hasheo/verificación de contraseñas (bcrypt), compartida por
 * seed, auth y socios — evita duplicar la lógica de bcrypt por módulo.
 */
@Injectable()
export class PasswordService {
  async hash(plain: string, rounds = 10): Promise<string> {
    return bcrypt.hash(plain, rounds);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
