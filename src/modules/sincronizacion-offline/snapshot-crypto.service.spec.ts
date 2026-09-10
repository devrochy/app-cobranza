import {
  createDecipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  type KeyObject,
} from "crypto";
import { AUTH_TAG_LENGTH, SnapshotCryptoService } from "./snapshot-crypto.service";

const X25519_SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");
const HKDF_INFO = Buffer.from("cobraia-snapshot-v1");

function rawPublicKeyBase64(key: KeyObject): string {
  const jwk = key.export({ format: "jwk" });
  return Buffer.from(jwk.x as string, "base64url").toString("base64");
}

function rawToPublicKey(raw: Buffer): KeyObject {
  return createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

describe("SnapshotCryptoService", () => {
  let service: SnapshotCryptoService;

  beforeEach(() => {
    service = new SnapshotCryptoService();
  });

  it("cifra y se puede descifrar con la clave privada del dispositivo", () => {
    const { publicKey, privateKey } = generateKeyPairSync("x25519");
    const payload = Buffer.from('{"ruta":{"id":5,"nombre":"Centro"}}', "utf8");

    const cifrado = service.cifrar(rawPublicKeyBase64(publicKey), payload);

    expect(cifrado.cifrado).toBe(true);
    expect(cifrado.algoritmo).toBe("x25519-hkdf-sha256-aes256gcm");

    const ephemeralPublicKey = rawToPublicKey(
      Buffer.from(cifrado.clavePublicaEfimera, "base64"),
    );
    const shared = diffieHellman({ privateKey, publicKey: ephemeralPublicKey });
    const aesKey = Buffer.from(
      hkdfSync("sha256", shared, Buffer.alloc(0), HKDF_INFO, 32),
    );
    const nonce = Buffer.from(cifrado.nonce, "base64");
    const datos = Buffer.from(cifrado.datos, "base64");
    const tag = datos.subarray(datos.length - AUTH_TAG_LENGTH);
    const ciphertext = datos.subarray(0, datos.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv("aes-256-gcm", aesKey, nonce);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    expect(plaintext.toString("utf8")).toBe('{"ruta":{"id":5,"nombre":"Centro"}}');
  });

  it("genera un nonce y una clave efímera distintos en cada cifrado", () => {
    const { publicKey } = generateKeyPairSync("x25519");
    const publicKeyBase64 = rawPublicKeyBase64(publicKey);

    const a = service.cifrar(publicKeyBase64, Buffer.from("a"));
    const b = service.cifrar(publicKeyBase64, Buffer.from("a"));

    expect(a.nonce).not.toBe(b.nonce);
    expect(a.clavePublicaEfimera).not.toBe(b.clavePublicaEfimera);
    expect(a.datos).not.toBe(b.datos);
  });

  it("rechaza una clave pública que no es de 32 bytes", () => {
    expect(() =>
      service.cifrar(Buffer.from("corta").toString("base64"), Buffer.from("x")),
    ).toThrow();
  });
});
