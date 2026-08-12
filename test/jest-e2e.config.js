/** Configuración de Jest para pruebas e2e (test/e2e/**\/*.e2e-spec.ts). */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  testRegex: "test/e2e/.*\\.e2e-spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  testEnvironment: "node",
  testTimeout: 30000,
  maxWorkers: 1,
};
