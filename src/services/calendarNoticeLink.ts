import type { SavedNotice } from "./savedNoticesApi";

type LinkedEvent = {
  savedNoticeId?: string | null;
  linkedNotice?: Record<string, unknown> | null;
  title: string;
};
const text = (v: unknown): string | null => typeof v === "string" && v.length > 0 ? v : null;

export function savedProgramKey(program: SavedNotice | null | undefined): string | null {
  if (!program) return null;
  return program.source_kind === "manual" || program.manual_notice_id
    ? "manual:" + program.manual_notice_id
    : program.notice_id ? "matched:" + program.notice_id
    : program.saved_notice_id ? "saved:" + program.saved_notice_id : null;
}

export function eventProgramKey(event: LinkedEvent): string | null {
  const link = event.linkedNotice;
  const manualId = text(link?.manual_notice_id);
  const noticeId = text(link?.notice_id);
  if (manualId) return "manual:" + manualId;
  if (noticeId?.startsWith("manual:")) return noticeId;
  if (noticeId) return "matched:" + noticeId;
  const savedId = event.savedNoticeId ?? text(link?.saved_notice_id);
  return savedId ? "saved:" + savedId : null;
}

export function findEventProgram(event: LinkedEvent, programs: SavedNotice[]): SavedNotice | null {
  const key = eventProgramKey(event);
  const savedId = event.savedNoticeId ?? text(event.linkedNotice?.saved_notice_id);
  const found = programs.find(program =>
    (key !== null && savedProgramKey(program) === key) ||
    (savedId != null && program.saved_notice_id === savedId &&
      (event.linkedNotice?.source_kind !== "manual" || program.source_kind === "manual")));
  if (found) return found;
  // Preserve an existing link even while the saved-notice list is loading.
  if (!key) return null;
  const manual = key.startsWith("manual:");
  return {
    source_kind: manual ? "manual" : "matched",
    ...(manual ? { manual_notice_id: key.slice(7) } : {}),
    notice_id: manual ? key : text(event.linkedNotice?.notice_id) ?? "",
    saved_notice_id: savedId ?? undefined,
    title: text(event.linkedNotice?.title) ?? "연결된 지원사업",
    organization: text(event.linkedNotice?.organization) ?? "",
    url: text(event.linkedNotice?.url),
    field: null, region: null, deadline: null, deadline_label: null,
    recruitment_status: null, status_label: null, days_until_deadline: null, is_closed: false,
  };
}

export function programLinkInput(program: SavedNotice | null) {
  if (!program) return { saved_notice_id: null, linked_notice: null };
  if (program.source_kind === "manual" || program.manual_notice_id) {
    if (!program.manual_notice_id) throw new Error("수동 공고의 연결 ID를 확인해주세요.");
    return {
      saved_notice_id: null,
      linked_notice: { source_kind: "manual", manual_notice_id: program.manual_notice_id },
    };
  }
  if (!program.saved_notice_id) throw new Error("저장한 공고의 연결 ID를 확인해주세요.");
  return { saved_notice_id: program.saved_notice_id, linked_notice: null };
}

export function groupEventsByProgram<T extends LinkedEvent>(events: T[], programs: SavedNotice[]) {
  const groups = new Map<string, { key: string; title: string; events: T[] }>();
  for (const event of events) {
    const program = findEventProgram(event, programs);
    const key = program ? savedProgramKey(program) ?? eventProgramKey(event) : eventProgramKey(event);
    const groupKey = key ?? "unlinked";
    let group = groups.get(groupKey);
    if (!group) {
      group = { key: groupKey, title: program?.title ?? text(event.linkedNotice?.title) ?? "지원사업 미연결", events: [] };
      groups.set(groupKey, group);
    }
    group.events.push(event);
  }
  return [...groups.values()].sort((a, b) =>
    a.key === "unlinked" ? 1 : b.key === "unlinked" ? -1 : a.title.localeCompare(b.title, "ko"));
}

