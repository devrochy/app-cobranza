import { clienteFotosMulterOptions } from "./cliente-foto-upload";

describe("clienteFotosMulterOptions", () => {
  it("permite archivos de hasta 15MB (crear cliente envía hasta 3 fotos juntas)", () => {
    const limits = clienteFotosMulterOptions.limits as { fileSize: number };
    expect(limits.fileSize).toBe(15 * 1024 * 1024);
  });
});