import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const dir = path.resolve("node_modules/.cache/ir-library-tests");
await fs.mkdir(dir, { recursive: true });
for (const name of ["model", "analysis", "library"]) {
  let out = ts.transpileModule(await fs.readFile(`src/components/ir-deck/${name}.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const dep of ["model", "analysis", "library"])
    out = out.replaceAll(`"./${dep}"`, `"./${dep}.mjs"`);
  await fs.writeFile(path.join(dir, name + ".mjs"), out);
}
const api = await import(pathToFileURL(path.join(dir, "library.mjs")).href);
const { newDraft } = await import(pathToFileURL(path.join(dir, "model.mjs")).href);
const { reviewHash } = await import(pathToFileURL(path.join(dir, "analysis.mjs")).href);
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  deck = "33333333-3333-4333-8333-333333333333",
  source = "44444444-4444-4444-8444-444444444444",
  job = "55555555-5555-4555-8555-555555555555";
const row = {
  deck_id: deck,
  title: "서버 제목",
  created_at: "2026-11-21T00:00:00Z",
  updated_at: "2026-11-21T01:00:00Z",
  analysis_status: "completed",
  html_state: null,
  document_id: null,
};
const local = {
  id: "local-project",
  title: "브라우저 제목",
  updatedAt: 1,
  draft: { ...newDraft(), analysis: { userId: owner, deckId: deck } },
};
const foreign = {
  ...local,
  id: "foreign",
  draft: { ...newDraft(), analysis: { userId: other, deckId: deck } },
};
const unknown = { id: "unclaimed", title: "옛 초안", updatedAt: 1, draft: newDraft() };
assert.notEqual(api.accountWorkspaceKey(owner), api.accountWorkspaceKey(other));
assert.deepEqual(
  api
    .ownedWorkspace({ projects: [local, foreign, unknown], draft: foreign.draft }, owner, false)
    .projects.map((p) => p.id),
  [local.id],
);
assert.equal(
  api.ownedWorkspace({ projects: [local, unknown], draft: unknown.draft }, owner, true).projects
    .length,
  2,
);
let merged = api.mergeLibraryProjects([local, foreign, unknown], [row], owner, true);
assert.deepEqual(
  merged.map((p) => p.id),
  [unknown.id, local.id],
);
assert.equal(merged[1].title, row.title);
assert.deepEqual(
  api.mergeLibraryProjects([local, unknown], [], owner, true).map((p) => p.id),
  [unknown.id],
);
assert.equal(api.mergeLibraryProjects([], [row], owner, true)[0].id, deck);
let calls = 0;
const rows = await api.listLibrary(async (_name, args) => {
  calls++;
  return {
    owner_id: owner,
    items: [row],
    next_cursor: args.p_before_id ? null : { created_at: row.created_at, deck_id: deck },
  };
}, owner);
assert.equal(rows.length, 1);
assert.equal(calls, 2);
await assert.rejects(api.listLibrary(async () => ({ owner_id: other, items: [row] }), owner));
await assert.rejects(
  api.listLibrary(
    async () => ({ owner_id: owner, items: [row], next_cursor: { deck_id: deck } }),
    owner,
  ),
);
const ids = [
  "cover",
  "problem",
  "target_customer",
  "solution",
  "product_service",
  "market",
  "business_model",
];
const resume = {
  owner_id: owner,
  deck_id: deck,
  title: row.title,
  source: {
    source_id: source,
    input_kind: "pdf",
    filename: "사업계획서.pdf",
    file_sha256: "a".repeat(64),
    size_bytes: 1000,
  },
  analysis: { job_id: job, client_request_id: job, status: "completed", source_id: source },
  business: {
    ready: true,
    revision: 3,
    sections: ids.map((section_id) => ({
      section_id,
      body: "# 사용자가 수정한 제목\n\n수정한 본문",
    })),
  },
  preview_titles: ids.map(() => "기본 제목"),
  brand: { brandColors: ["#246253", "#FFE100"], theme: "dark", fontFamily: "Paperlogy" },
  html: null,
};
const restored = await api.resumeLibraryProject(async () => resume, owner, deck, deck);
assert.equal(restored.screen, "review");
assert.equal(restored.draft.slides[0].title, "사용자가 수정한 제목");
assert.equal(restored.draft.slides[0].body, "수정한 본문");
assert.equal(restored.draft.analysis.businessRevision, 3);
assert.equal(restored.draft.analysis.savedReviewHash, await reviewHash(restored.draft.slides));
assert.equal(restored.draft.colorMode, "dark");
const html = {
  ...resume,
  html: {
    job_id: job,
    client_request_id: job,
    source_id: source,
    business_revision: 3,
    brand_revision: 1,
    brand: resume.brand,
    document_id: job,
  },
};
assert.equal(
  (await api.resumeLibraryProject(async () => html, owner, deck, deck)).screen,
  "editor",
);
assert.equal(
  (await api.resumeLibraryProject(async () => html, owner, deck, deck)).draft.html.documentId,
  job,
);
const pending = {
  ...resume,
  business: null,
  analysis: { ...resume.analysis, status: "analyzing" },
};
assert.equal(
  (await api.resumeLibraryProject(async () => pending, owner, deck, deck)).screen,
  "processing",
);
await assert.rejects(
  api.resumeLibraryProject(async () => ({ ...resume, owner_id: other }), owner, deck, deck),
);
await api.mutateLibrary(
  async () => ({ owner_id: owner, deck_id: deck, saved: true }),
  owner,
  deck,
  "새 제목",
);
await api.mutateLibrary(
  async () => ({ owner_id: owner, deck_id: deck, hidden: true }),
  owner,
  deck,
);
await assert.rejects(
  api.mutateLibrary(async () => ({ owner_id: other, deck_id: deck, hidden: true }), owner, deck),
);
console.log(
  "PASS account-scoped legacy migration; owner isolation; paginated server list; local/cloud dedup; deleted decks stay absent; cross-browser analysis/HTML resume; user titles/body/brand restored; mutation acknowledgements checked.",
);
