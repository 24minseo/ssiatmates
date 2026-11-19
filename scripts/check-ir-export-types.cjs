const ts = require("typescript"),
  path = require("path");
const options = {
  noEmit: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  exactOptionalPropertyTypes: true,
  noUncheckedIndexedAccess: true,
  noPropertyAccessFromIndexSignature: true,
  types: ["node"],
};
const p = ts.createProgram(
  [
    "src/lib/ir-html-export.server.ts",
    "src/lib/ir-html-images.server.ts",
    "src/lib/ir-html-render.server.ts",
  ],
  options,
);
const errors = ts.getPreEmitDiagnostics(p);
console.log(
  ts.formatDiagnosticsWithColorAndContext(errors, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (x) => x,
    getNewLine: () => "\n",
  }),
);
process.exitCode = errors.length ? 1 : 0;
