import { existsSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { eliminarArchivosSubidos } from "./archivos";

describe("eliminarArchivosSubidos", () => {
  it("elimina los archivos indicados", async () => {
    const dir = mkdtempSync(join(tmpdir(), "archivos-"));
    const archivo = join(dir, "evidencia.jpg");
    writeFileSync(archivo, "contenido");

    await eliminarArchivosSubidos([archivo]);

    expect(existsSync(archivo)).toBe(false);
  });

  it("ignora rutas inexistentes y valores vacíos sin lanzar", async () => {
    await expect(
      eliminarArchivosSubidos(["/ruta/que/no/existe.jpg", undefined, null, ""]),
    ).resolves.toBeUndefined();
  });
});
