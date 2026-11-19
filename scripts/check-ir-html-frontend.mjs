import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const dir = path.resolve("node_modules/.cache/ir-html-frontend-tests");
await fs.mkdir(dir, { recursive: true });
for (const name of ["html-api", "html-api.test"]) {
  const source = await fs.readFile(`src/components/ir-deck/${name}.ts`, "utf8");
  const out = ts
    .transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replaceAll('"./html-api"', '"./html-api.mjs"');
  await fs.writeFile(path.join(dir, `${name}.mjs`), out);
}
await import(pathToFileURL(path.join(dir, "html-api.test.mjs")).href);
