const ts = require("typescript");
const cp = require("node:child_process");
const path = require("node:path");
const config = ts.parseJsonConfigFileContent(
  ts.readConfigFile("tsconfig.json", ts.sys.readFile).config,
  ts.sys,
  ".",
);
const program = ts.createProgram(config.fileNames, config.options);
const all = ts.getPreEmitDiagnostics(program);
const filtered = all.filter(
  (d) =>
    d.file &&
    (/[\\/]ir-deck[\\/](library|library-client|useDeckLibrary)\.ts$/.test(d.file.fileName) ||
      /[\\/]routes[\\/]ir-deck-wireframe\.tsx$/.test(d.file.fileName)),
);
const route = path.resolve("src/routes/ir-deck-wireframe.tsx");
const baseText = cp.execFileSync("git", ["show", "origin/main:src/routes/ir-deck-wireframe.tsx"], {
  encoding: "utf8",
});
const host = ts.createCompilerHost(config.options);
const read = host.readFile.bind(host);
host.readFile = (file) => (path.resolve(file) === route ? baseText : read(file));
const baseline = ts.getPreEmitDiagnostics(ts.createProgram(config.fileNames, config.options, host));
const signature = (d) => d.code + ":" + ts.flattenDiagnosticMessageText(d.messageText, "\n");
const counts = new Map();
for (const d of baseline.filter((d) => d.file && path.resolve(d.file.fileName) === route))
  counts.set(signature(d), (counts.get(signature(d)) ?? 0) + 1);
const introduced = filtered.filter((d) => {
  const key = signature(d);
  if (d.file && path.resolve(d.file.fileName) === route && counts.get(key)) {
    counts.set(key, counts.get(key) - 1);
    return false;
  }
  return true;
});
console.log(
  ts.formatDiagnosticsWithColorAndContext(introduced, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (x) => x,
    getNewLine: () => "\n",
  }),
);
console.log(
  "New library/route diagnostics: " +
    introduced.length +
    "; existing route diagnostics: " +
    (filtered.length - introduced.length) +
    "; repository diagnostics: " +
    all.length,
);
process.exitCode = introduced.length ? 1 : 0;
