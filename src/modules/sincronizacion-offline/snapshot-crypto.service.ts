import { BadRequestException, Injectable } from "@nestjs/common";
import {
  createCipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from "crypto";

/**
 * Envoltorio del snapshot del día cifrado (HU-40). La APK desencripta con su
 * clave privada X25519 usando el mismo KDF y nonce.
 */
export interface SnapshotCifrado {
  cifrado: true;
  algoritmo: "x25519-hkdf-sha256-aes256gcm";
  /** Clave pública efímera X25519 (32 bytes, base64). */
  clavePublicaEfimera: string;
  /** Nonce de 12 bytes (base64). */
  nonce: string;
  /** Ciphertext AES-256-GCM + tag de autenticación de 16 bytes (base64). */
  datos: string;
}

/** Prefijo SPKI DER para una clave X25519 (OID 1.3.101.110). */
const X25519_SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");
const HKDF_INFO = Buffer.from("cobraia-snapshot-v1");
const AES_KEY_LENGTH = 32;
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Cifra el snapshot del día para un dispositivo (HU-40): ECDH efímero-estático
 * X25519 + HKDF-SHA256 + AES-256-GCM. El backend no conoce la clave privada del
 * dispositivo; solo su clave pública (registrada en HU-39).
 */
@Injectable()
export class SnapshotCryptoService {
  cifrar(devicePublicKeyBase64: string, payload: Buffer): SnapshotCifrado {
    const devicePublicKey = rawPublicKeyToKeyObject(devicePublicKeyBase64);

    const { publicKey, privateKey } = generateKeyPairSync("x25519");
    const sharedSecret = diffieHellman({
      privateKey,
      publicKey: devicePublicKey,
    });

    const aesKey = Buffer.from(
      hkdfSync("sha256", sharedSecret, Buffer.alloc(0), HKDF_INFO, AES_KEY_LENGTH),
    );

    const nonce = randomBytes(NONCE_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", aesKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      cifrado: true,
      algoritmo: "x25519-hkdf-sha256-aes256gcm",
      clavePublicaEfimera: keyObjectToRawBase64(publicKey),
      nonce: nonce.toString("base64"),
      datos: Buffer.concat([ciphertext, tag]).toString("base64"),
    };
  }
}

function rawPublicKeyToKeyObject(base64: string): KeyObject {
  const raw = Buffer.from(base64, "base64");
  if (raw.length !== 32) {
    throw new BadRequestException(
      "La clave pública del dispositivo debe ser de 32 bytes (X25519)",
    );
  }
  return createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

function keyObjectToRawBase64(key: KeyObject): string {
  const jwk = key.export({ format: "jwk" });
  return Buffer.from(jwk.x as string, "base64url").toString("base64");
}

export { AUTH_TAG_LENGTH };
