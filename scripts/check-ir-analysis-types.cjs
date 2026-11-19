const ts = require("typescript"),
  fs = require("fs");
const c = ts.parseJsonConfigFileContent(
  ts.readConfigFile("tsconfig.json", ts.sys.readFile).config,
  ts.sys,
  ".",
);
const p = ts.createProgram(c.fileNames, c.options);
const all = ts.getPreEmitDiagnostics(p),
  changed = all.filter(
    (d) =>
      d.file &&
      /[\\/]ir-deck[\\/](analysis|analysis-client|useBusinessAnalysis|model)\.ts$/.test(
        d.file.fileName,
      ),
  );
console.log(
  ts.formatDiagnosticsWithColorAndContext(changed, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (x) => x,
    getNewLine: () => "\n",
  }),
);
console.log(
  "Changed-file diagnostics: " + changed.length + "; repository diagnostics: " + all.length,
);
process.exitCode = changed.length ? 1 : 0;
