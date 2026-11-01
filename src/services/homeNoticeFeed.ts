import type { MatchedProgram } from "@/mocks/programSearchMock";
import { supabase } from "@/integrations/supabase/client";

const RECENT_NOTICES_STORAGE_KEY = "ssiat.recent-notices.v1";
const RECENT_NOTICES_EVENT = "recent-notices-changed";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type HomeNoticeItem = {
  id: string;
  title: string;
  organization: string;
  url?: string;
  categories: string[];
  dDay: string;
  deadline: string;
  reportAvailable: boolean;
  viewedAt?: string;
  changeReason?: string;
  changeDetail?: string;
  inbox_kind?: "new" | "changes";
  inbox_receipt_ids?: string[];
  display?: {
    title_url: string | null;
    deadline_label: string;
    change_badge: string | null;
    review_reason: string | null;
  };
};

function safeNoticeUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function formatDeadline(value: string | null) {
  if (!value) return "일정 확인 필요";
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return "일정 확인 필요";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `~${month}.${day}(${WEEKDAYS[date.getDay()]})`;
}

function readRecentNotices(): HomeNoticeItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_NOTICES_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is HomeNoticeItem => Boolean(item && typeof item === "object" && "id" in item && typeof item.id === "string"))
      : [];
  } catch {
    return [];
  }
}

export function getRecentNotices() {
  return readRecentNotices();
}

export function recordRecentNotice(item: HomeNoticeItem) {
  if (typeof window === "undefined") return;
  const next = [
    { ...item, viewedAt: new Date().toISOString() },
    ...readRecentNotices().filter((recent) => recent.id !== item.id),
  ].slice(0, 10);
  window.localStorage.setItem(RECENT_NOTICES_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(RECENT_NOTICES_EVENT));
}

export function recordRecentMatchedProgram(program: MatchedProgram) {
  recordRecentNotice({
    id: program.id,
    title: program.title,
    organization: program.organization,
    ...(program.url ? { url: program.url } : {}),
    categories: program.categories,
    dDay: program.dDay,
    deadline: program.deadline,
    reportAvailable: Boolean(program.matchLabel),
  });
}

export function subscribeRecentNotices(listener: () => void) {
  window.addEventListener(RECENT_NOTICES_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(RECENT_NOTICES_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export async function getHomeRecommendedNotices({ selectedField = null, offset = 0, limit = 20 }: {
  selectedField?: string | null;
  offset?: number;
  limit?: number;
} = {}) {
  if (selectedField !== null && typeof selectedField !== "string") {
    throw new Error("지원분야를 확인해주세요.");
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("조회 범위를 확인해주세요.");
  }
  const { data, error } = await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient).rpc("get_my_home_new_notices_v1", {
    p_limit: limit,
    p_offset: offset,
    p_field: selectedField,
  });
  if (error) throw error;
  if (!Array.isArray(data?.items) || !Number.isSafeInteger(data.total_count) || data.total_count < 0) {
    throw new Error("신규 공고 응답을 확인해주세요.");
  }

  return {
    items: data.items.map((item: { notice_id: string; title: string; organization: string; url: string | null; field: string | null; region: string | null; deadline_label?: string; deadline: string | null; report_available?: boolean; has_meaningful_changes?: boolean; change_needs_review?: boolean; change_review_reason?: string }) => {
      const url = safeNoticeUrl(item.url);
      return {
        id: item.notice_id,
        title: item.title,
        organization: item.organization,
        ...(url ? { url } : {}),
        categories: [item.field, item.region].filter((value): value is string => Boolean(value?.trim())),
        dDay: item.deadline_label?.trim() || "공고 원문 확인",
        deadline: formatDeadline(item.deadline),
        reportAvailable: item.report_available !== false,
        ...(item.has_meaningful_changes === true ? { changeReason: "수정됨" } : {}),
        ...(item.change_needs_review === true && item.change_review_reason ? { changeDetail: item.change_review_reason } : {}),
        ...(Array.isArray((item as Record<string, unknown>).inbox_receipt_ids) ? { inbox_receipt_ids: (item as Record<string, unknown>).inbox_receipt_ids as string[] } : {}),
        ...(typeof (item as Record<string, unknown>).inbox_kind === "string" ? { inbox_kind: (item as Record<string, unknown>).inbox_kind as "new" | "changes" } : {}),
        display: {
          title_url: url ?? null,
          deadline_label: item.deadline_label?.trim() || "공고 원문 확인",
          change_badge: item.has_meaningful_changes === true ? "수정됨" : null,
          review_reason: item.change_needs_review === true ? item.change_review_reason ?? null : null,
        },
      } satisfies HomeNoticeItem;
    }),
    totalCount: data.total_count,
  };
}
