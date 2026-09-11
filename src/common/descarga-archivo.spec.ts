import { existsSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { NotFoundException } from "@nestjs/common";
import { prepararDescargaEvidencia, sanearNombreArchivo } from "./descarga-archivo";

describe("prepararDescargaEvidencia", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "descarga-archivo-"));
  });

  function crearArchivo(nombre: string): string {
    const ruta = join(baseDir, nombre);
    writeFileSync(ruta, "contenido");
    return ruta;
  }

  it("devuelve la ruta absoluta y headers inline con el mimetype y filename saneado", () => {
    const ruta = crearArchivo("factura 01.pdf");

    const resultado = prepararDescargaEvidencia({
      rutaArchivo: ruta,
      mimetype: "application/pdf",
      nombreOriginal: 'factura "01".pdf',
      baseDir,
    });

    expect(resultado.rutaAbsoluta).toBe(ruta);
    expect(resultado.headers["Content-Type"]).toBe("application/pdf");
    expect(resultado.headers["Content-Disposition"]).toContain("inline");
    expect(resultado.headers["Content-Disposition"]).not.toContain('"01"');
    expect(resultado.headers["Content-Disposition"]).toContain(
      `filename*=UTF-8''${encodeURIComponent('factura "01".pdf')}`,
    );
    expect(resultado.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(resultado.headers["Cache-Control"]).toBe("private, no-store");
  });

  it("usa attachment cuando descargar es true", () => {
    const ruta = crearArchivo("foto.jpg");

    const resultado = prepararDescargaEvidencia({
      rutaArchivo: ruta,
      mimetype: "image/jpeg",
      nombreOriginal: "foto.jpg",
      baseDir,
      descargar: true,
    });

    expect(resultado.headers["Content-Disposition"]).toContain("attachment");
  });

  it("lanza NotFoundException si el archivo no existe", () => {
    expect(() =>
      prepararDescargaEvidencia({
        rutaArchivo: join(baseDir, "no-existe.jpg"),
        mimetype: "image/jpeg",
        nombreOriginal: "no-existe.jpg",
        baseDir,
      }),
    ).toThrow(NotFoundException);
  });

  it("rechaza rutas que escapan del directorio base (path traversal)", () => {
    const fuera = join(baseDir, "..", "archivo-peligroso.txt");
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, "..", "archivo-peligroso.txt"), "secreto");

    expect(existsSync(fuera)).toBe(true);
    expect(() =>
      prepararDescargaEvidencia({
        rutaArchivo: fuera,
        mimetype: "text/plain",
        nombreOriginal: "archivo-peligroso.txt",
        baseDir,
      }),
    ).toThrow(NotFoundException);
  });

  it("usa un nombre por defecto si el original queda vacío al sanear", () => {
    const ruta = crearArchivo("evidencia.jpg");

    const resultado = prepararDescargaEvidencia({
      rutaArchivo: ruta,
      mimetype: "image/jpeg",
      nombreOriginal: '  "\\/  ',
      baseDir,
    });

    expect(resultado.headers["Content-Disposition"]).toContain('filename="evidencia"');
  });

  it("sanea CR/LF del nombre para evitar inyección de headers", () => {
    expect(sanearNombreArchivo("factura\r\nX-Evil: 1.pdf")).not.toMatch(/[\r\n]/);
  });

  it("rechaza un symlink dentro del base que apunta fuera", () => {
    const fuera = join(baseDir, "..", `secreto-symlink-${Date.now()}.txt`);
    writeFileSync(fuera, "secreto");
    const enlace = join(baseDir, "enlace.txt");
    symlinkSync(fuera, enlace);

    expect(() =>
      prepararDescargaEvidencia({
        rutaArchivo: enlace,
        mimetype: "text/plain",
        nombreOriginal: "enlace.txt",
        baseDir,
      }),
    ).toThrow(NotFoundException);
  });

  it("rechaza un directorio (no es un archivo)", () => {
    const subdir = join(baseDir, "sub");
    mkdirSync(subdir);

    expect(() =>
      prepararDescargaEvidencia({
        rutaArchivo: subdir,
        mimetype: "application/octet-stream",
        nombreOriginal: "sub",
        baseDir,
      }),
    ).toThrow(NotFoundException);
  });
});
