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

export async function getHomeRecommendedNotices(limit = 10) {
  const { data, error } = await supabase.rpc("get_my_notice_matches_v1", {
    p_limit: limit,
    p_offset: 0,
    p_field: null,
    p_include_closed: false,
  });
  if (error) throw error;

  return {
    items: data.items.map((item) => {
      const url = safeNoticeUrl(item.url);
      return {
        id: item.notice_id,
        title: item.title,
        organization: item.organization,
        ...(url ? { url } : {}),
        categories: [item.field, item.region].filter((value): value is string => Boolean(value?.trim())),
        dDay: item.deadline_label?.trim() || "-",
        deadline: formatDeadline(item.deadline),
        reportAvailable: item.report_available,
      } satisfies HomeNoticeItem;
    }),
    totalCount: data.total_count,
  };
}
