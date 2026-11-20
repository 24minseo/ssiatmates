import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";
const dir = path.resolve("node_modules/.cache/ir-review-autosave");
await fs.mkdir(dir, { recursive: true });
for (const name of ["model", "analysis", "useBusinessAnalysis"]) {
  let source = await fs.readFile(`src/components/ir-deck/${name}.ts`, "utf8");
  source = source
    .replace(
      'import { useEffect, useRef, useState } from "react";',
      "const {useEffect,useRef,useState}=globalThis.__reviewTest.react;",
    )
    .replace(
      'import { useAuth } from "@/hooks/useAuth";',
      "const useAuth=()=>globalThis.__reviewTest.auth;",
    )
    .replace(
      'import { analysisApi } from "./analysis-client";',
      "const analysisApi=globalThis.__reviewTest.api;",
    );
  const js = ts
    .transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replaceAll('"./model"', '"./model.mjs"')
    .replaceAll('"./analysis"', '"./analysis.mjs"');
  await fs.writeFile(path.join(dir, name + ".mjs"), js);
}
const { newDraft } = await import(pathToFileURL(path.join(dir, "model.mjs")));
const { reviewHash } = await import(pathToFileURL(path.join(dir, "analysis.mjs")));
let slots = [],
  cursor = 0,
  effects = [],
  hook,
  options,
  writes = [],
  release;
const user = "11111111-1111-4111-8111-111111111111";
const draft = newDraft();
draft.analysis = {
  userId: user,
  sourceId: user,
  requestId: user,
  inputKind: "text",
  inputHash: "a".repeat(64),
  deckId: user,
  jobId: user,
  businessRevision: 0,
  savedReviewHash: await reviewHash(draft.slides),
};
globalThis.__reviewTest = {
  auth: { user: { id: user }, loading: false },
  api: {
    save: async (_ref, sections, id, revision) => {
      writes.push({ sections, id, revision });
      if (release) {
        const wait = release;
        release = null;
        await wait;
      }
      return revision + 1;
    },
  },
  react: {
    useRef: (initial) => {
      const i = cursor++;
      return (slots[i] ??= { current: initial });
    },
    useState: (initial) => {
      const i = cursor++;
      slots[i] ??= initial;
      return [
        slots[i],
        (v) => {
          slots[i] = typeof v === "function" ? v(slots[i]) : v;
        },
      ];
    },
    useEffect: (fn, deps) => {
      const i = cursor++,
        old = slots[i];
      if (!old || JSON.stringify(deps) !== JSON.stringify(old.deps)) {
        old?.cleanup?.();
        slots[i] = { deps };
        effects.push(() => {
          slots[i].cleanup = fn();
        });
      }
    },
  },
};
const { useBusinessAnalysis } = await import(
  pathToFileURL(path.join(dir, "useBusinessAnalysis.mjs"))
);
options = {
  draft,
  screen: "review",
  patchDraft: (patch) => {
    options.draft = { ...options.draft, ...patch };
  },
  message: () => {},
  networkError: () => {},
  navigate: (screen) => {
    options.screen = screen;
  },
};
function render() {
  cursor = 0;
  hook = useBusinessAnalysis(options);
  for (const f of effects.splice(0)) f();
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
render();
options.draft = {
  ...options.draft,
  slides: options.draft.slides.map((s, i) =>
    i ? s : { ...s, title: "고객의 내일을 준비하는 모닝루프", body: "수정한 사업 내용" },
  ),
};
render();
await pause(1100);
assert.equal(writes.length, 1);
assert.equal(writes[0].sections[0].body, "# 고객의 내일을 준비하는 모닝루프\n\n수정한 사업 내용");
assert.equal(options.draft.analysis.businessRevision, 1);
assert.equal(options.screen, "review");
// Delay the autosave acknowledgement, edit again, then immediately continue.
let done;
release = new Promise((resolve) => {
  done = resolve;
});
options.draft = {
  ...options.draft,
  slides: options.draft.slides.map((s, i) => (i ? s : { ...s, body: "저장 중 첫 변경" })),
};
render();
await pause(1100);
options.draft = {
  ...options.draft,
  slides: options.draft.slides.map((s, i) =>
    i ? s : { ...s, body: "마지막 변경이 PPT로 전달됩니다" },
  ),
};
render();
const continuing = hook.continueToDesign();
assert.equal(options.screen, "review");
done();
await continuing;
assert.equal(options.screen, "themes");
assert.equal(
  writes.at(-1).sections[0].body,
  "# 고객의 내일을 준비하는 모닝루프\n\n마지막 변경이 PPT로 전달됩니다",
);
assert.deepEqual(
  writes.map((w) => w.revision),
  [0, 1, 2],
);
for (const slot of slots) slot?.cleanup?.();
delete globalThis.__reviewTest;
console.log(
  "PASS debounced title/body autosave; no navigation during autosave; serialized revisions; final save captures edits made in flight.",
);
