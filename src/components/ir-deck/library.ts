import { hashText, sectionIds } from "./analysis";
import { newDraft, newSlide, slideNames, type Draft, type Project, type Workspace } from "./model";
import type { BrandSettings } from "./html-api";

type Json = Record<string, unknown>;
export type LibraryItem = {
  deck_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  analysis_status: string | null;
  html_state: string | null;
  document_id: string | null;
};
export type LibraryRpc = (name: string, args: Json) => Promise<unknown>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
function record(v: unknown): Json {
  if (!object(v)) throw new Error("덱 응답을 확인하지 못했습니다.");
  return v;
}
function id(v: unknown): string {
  if (typeof v !== "string" || !uuid.test(v)) throw new Error("덱 번호를 확인하지 못했습니다.");
  return v;
}
function str(v: unknown): string {
  if (typeof v !== "string") throw new Error("덱 내용을 확인하지 못했습니다.");
  return v;
}
function revision(v: unknown): number {
  if (!Number.isSafeInteger(v) || Number(v) < 0)
    throw new Error("저장 버전을 확인하지 못했습니다.");
  return Number(v);
}
export function projectDeckId(project: Project) {
  return project.draft.html?.deckId ?? project.draft.analysis?.deckId;
}
export function draftOwner(draft: Draft) {
  return draft.html?.userId ?? draft.analysis?.userId;
}
export const accountWorkspaceKey = (owner: string | null) =>
  `ssiat-ir-deck-workspace-v2:${owner ?? "guest"}`;
export function ownedWorkspace(
  value: Workspace | null,
  owner: string | null,
  trustedAccountCache: boolean,
): Workspace {
  if (!value) return { projects: [], draft: newDraft() };
  const allowed = (draft: Draft) =>
    draftOwner(draft) ? draftOwner(draft) === owner : trustedAccountCache;
  return {
    projects: value.projects.filter((p) => allowed(p.draft)),
    draft: allowed(value.draft) ? value.draft : newDraft(),
  };
}
export async function listLibrary(rpc: LibraryRpc, owner: string): Promise<LibraryItem[]> {
  const items = new Map<string, LibraryItem>();
  let cursor: Json | null = null;
  const seen = new Set<string>();
  do {
    const data = record(
      await rpc("list_my_ir_decks_v1", {
        p_limit: 50,
        p_before_created: cursor?.["created_at"] ?? null,
        p_before_id: cursor?.["deck_id"] ?? null,
      }),
    );
    if (data["owner_id"] !== owner || !Array.isArray(data["items"]))
      throw new Error("로그인 계정의 덱 목록을 확인하지 못했습니다.");
    for (const raw of data["items"]) {
      const row = record(raw),
        deck = id(row["deck_id"]);
      const created = str(row["created_at"]),
        updated = str(row["updated_at"]);
      if (!Number.isFinite(Date.parse(created)) || !Number.isFinite(Date.parse(updated)))
        throw new Error("덱 날짜를 확인하지 못했습니다.");
      items.set(deck, {
        deck_id: deck,
        title: str(row["title"]),
        created_at: created,
        updated_at: updated,
        analysis_status: typeof row["analysis_status"] === "string" ? row["analysis_status"] : null,
        html_state: typeof row["html_state"] === "string" ? row["html_state"] : null,
        document_id: row["document_id"] == null ? null : id(row["document_id"]),
      });
    }
    cursor = data["next_cursor"] == null ? null : record(data["next_cursor"]);
    if (cursor) {
      const key = JSON.stringify(cursor);
      if (seen.has(key)) throw new Error("덱 목록을 이어서 읽지 못했습니다.");
      seen.add(key);
    }
  } while (cursor);
  return [...items.values()];
}
export function mergeLibraryProjects(
  local: Project[],
  rows: LibraryItem[],
  owner: string,
  ready: boolean,
): Project[] {
  const mine = local.filter((p) => !draftOwner(p.draft) || draftOwner(p.draft) === owner);
  if (!ready) return mine;
  const localByDeck = new Map(
    mine.filter((p) => projectDeckId(p)).map((p) => [projectDeckId(p)!, p]),
  );
  return [
    ...mine.filter((p) => !projectDeckId(p)),
    ...rows.map((row) => {
      const existing = localByDeck.get(row.deck_id);
      return {
        ...existing,
        id: existing?.id ?? row.deck_id,
        title: row.title,
        createdAt: Date.parse(row.created_at),
        updatedAt: Date.parse(row.updated_at),
        draft: existing?.draft ?? { ...newDraft(), projectId: row.deck_id },
      };
    }),
  ];
}
function brand(v: unknown): BrandSettings {
  const b = object(v) ? v : {};
  const colors = Array.isArray(b["brandColors"])
    ? b["brandColors"]
        .filter((c): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))
        .slice(0, 2)
    : [];
  return {
    brandColors: colors.length ? colors : ["#1F8064"],
    theme: b["theme"] === "dark" ? "dark" : "light",
    fontFamily: b["fontFamily"] === "Paperlogy" ? "Paperlogy" : "Pretendard",
  };
}
export async function resumeLibraryProject(
  rpc: LibraryRpc,
  owner: string,
  deck: string,
  projectId: string,
) {
  const data = record(await rpc("get_my_ir_deck_resume_v1", { p_deck_id: deck }));
  if (data["owner_id"] !== owner || data["deck_id"] !== deck)
    throw new Error("로그인 계정의 덱이 아닙니다.");
  const source = record(data["source"]),
    sourceId = id(source["source_id"]);
  const inputKind = source["input_kind"];
  if (inputKind !== "pdf" && inputKind !== "text")
    throw new Error("저장된 입력 형식을 확인하지 못했습니다.");
  const sourceText = inputKind === "text" ? str(source["source_text"]) : "";
  const inputHash =
    inputKind === "text" ? await hashText(sourceText.trim()) : str(source["file_sha256"]);
  if (!/^[a-f0-9]{64}$/.test(inputHash)) throw new Error("원본 파일 정보를 확인하지 못했습니다.");
  const draft = {
    ...newDraft(),
    projectId,
    source: sourceText,
    fileName: typeof source["filename"] === "string" ? source["filename"] : "",
  };
  const a = object(data["analysis"]) ? data["analysis"] : null;
  draft.analysis = {
    userId: owner,
    deckId: deck,
    sourceId,
    inputKind,
    inputHash,
    requestId: a ? id(a["client_request_id"]) : sourceId,
    ...(a ? { jobId: id(a["job_id"]), failed: a["status"] === "failed" } : {}),
    ...(inputKind === "pdf"
      ? { fileName: draft.fileName, fileSize: Number(source["size_bytes"]) }
      : {}),
  };
  const business = object(data["business"]) ? data["business"] : null;
  if (business?.["ready"] === true) {
    const sections = business["sections"];
    if (!Array.isArray(sections) || sections.length !== 7)
      throw new Error("저장된 사업 항목을 확인하지 못했습니다.");
    draft.slides = sections.map((raw, i) => {
      const s = record(raw);
      if (s["section_id"] !== sectionIds[i]) throw new Error("사업 항목 순서가 다릅니다.");
      const body = str(s["body"]),
        heading = /^# ([^\r\n]*)\r?\n\r?\n([\s\S]*)$/.exec(body);
      const titles = data["preview_titles"];
      return newSlide(
        slideNames[i]!,
        heading
          ? heading[1]!
          : Array.isArray(titles) && typeof titles[i] === "string"
            ? titles[i]
            : slideNames[i]!,
        heading ? heading[2]! : body,
      );
    });
    draft.analysis.businessRevision = revision(business["revision"]);
    draft.analysis.savedReviewHash = await hashText(
      JSON.stringify(
        sections.map((raw) => {
          const s = record(raw);
          return { section_id: s["section_id"], body: s["body"] };
        }),
      ),
    );
  }
  const settings = brand(data["brand"]);
  draft.primaryColor = settings.brandColors[0] ?? "#1F8064";
  const accent = settings.brandColors[1];
  if (accent) draft.primaryColor2 = accent;
  else delete draft.primaryColor2;
  draft.colorMode = settings.theme;
  draft.fontFamily = settings.fontFamily;
  const h = object(data["html"]) ? data["html"] : null;
  if (h)
    draft.html = {
      userId: owner,
      deckId: deck,
      sourceId: id(h["source_id"]),
      requestId: id(h["client_request_id"]),
      brandSaveId: id(h["client_request_id"]),
      jobId: id(h["job_id"]),
      businessRevision: revision(h["business_revision"]),
      brandRevision: revision(h["brand_revision"]),
      settings: brand(h["brand"]),
      ...(h["document_id"] ? { documentId: id(h["document_id"]) } : {}),
    };
  const screen = h
    ? "editor"
    : business?.["ready"] === true
      ? "review"
      : a && a["status"] !== "failed"
        ? "processing"
        : "input";
  return { draft, screen, title: str(data["title"]) } as const;
}

export async function mutateLibrary(rpc: LibraryRpc, owner: string, deck: string, title?: string) {
  const renamed = title !== undefined;
  const data = record(
    await rpc(renamed ? "rename_my_ir_deck_v1" : "hide_my_ir_deck_v1", {
      p_deck_id: deck,
      ...(renamed ? { p_title: title } : {}),
    }),
  );
  if (
    data["owner_id"] !== owner ||
    data["deck_id"] !== deck ||
    data[renamed ? "saved" : "hidden"] !== true
  )
    throw new Error("변경 내용을 서버에서 확인하지 못했습니다.");
}
