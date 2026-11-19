import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const dir = path.resolve("node_modules/.cache/ir-analysis-tests");
await fs.mkdir(dir, { recursive: true });
for (const name of ["model", "analysis", "analysis.test"]) {
  const src = await fs.readFile("src/components/ir-deck/" + name + ".ts", "utf8");
  const out = ts
    .transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replaceAll('"./model"', '"./model.mjs"')
    .replaceAll('"./analysis"', '"./analysis.mjs"')
    .replaceAll("'./model'", "'./model.mjs'")
    .replaceAll("'./analysis'", "'./analysis.mjs'");
  await fs.writeFile(path.join(dir, name + ".mjs"), out);
}
await import(pathToFileURL(path.join(dir, "analysis.test.mjs")).href);
