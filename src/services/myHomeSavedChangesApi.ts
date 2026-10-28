import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchedProgram } from "@/mocks/programSearchMock";

const labels: Record<string, string> = {
  title: "제목", organization: "주최기관", target: "지원 대상", excluded_target: "제외 대상",
  region: "지역", region_requirements: "지역 조건", field: "지원분야", start_date: "접수 시작일",
  start_at: "접수 시작 시각", deadline: "마감일", deadline_at: "마감 시각",
  application_method: "신청 방법", application_url: "신청 링크", published_at: "게시일",
};
type Change = { field: string; old_value: unknown; new_value: unknown };
type BodyChange = { topic?: string; reason?: string; before_quote?: string; after_quote?: string };
type SavedChangeNotice = {
  notice_id: string; title: string; organization: string; url?: string;
  field?: string; region?: string; deadline_label?: string; deadline?: string;
  changes?: Change[]; body_changes?: BodyChange[]; change_events?: { body_summary?: string }[];
};
function printable(value: unknown): string {
  if (value == null || value === "") return "미정";
  if (Array.isArray(value)) return value.map(printable).join(", ");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
function dated(value: unknown, includeTime = false): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value) || !Number.isFinite(Date.parse(value))) return printable(value);
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  const day = `${get("month")}.${get("day")}(${get("weekday")})`;
  return includeTime ? `${day} ${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)}` : day;
}
export function formatMyHomeChanges(item: SavedChangeNotice) {
  const badges = (Array.isArray(item.changes) ? item.changes : []).map(change => {
    const field = change.field;
    const isDate = ["start_date", "start_at", "deadline", "deadline_at", "published_at"].includes(field);
    let badge = `${labels[field] || field || "공고 정보"} 변경`;
    if (["deadline", "deadline_at"].includes(field) && typeof change.old_value === "string" && typeof change.new_value === "string") {
      const oldDate = Date.parse(change.old_value), newDate = Date.parse(change.new_value);
      if (newDate > oldDate) badge = "마감일 연장";
      else if (newDate < oldDate) badge = "마감일 단축";
    }
    const format = (value: unknown) => isDate ? dated(value, field.endsWith("_at")) : printable(value);
    return { field, badge, text: `${format(change.old_value)} → ${format(change.new_value)}로 변경됐어요.` };
  });
  for (const change of Array.isArray(item.body_changes) ? item.body_changes : []) {
    badges.push({ field: "raw_content", badge: change.topic || "공고 내용 변경", text: change.reason || `${printable(change.before_quote)} → ${printable(change.after_quote)}` });
  }
  if (!badges.length) badges.push({ field: "raw_content", badge: "공고 내용 변경", text: item.change_events?.[0]?.body_summary || "변경된 내용을 리포트 또는 공고 원문에서 확인해주세요." });
  return badges;
}
export function createMyHomeSavedChangesApi(supabase: Pick<SupabaseClient, "rpc">) {
  return {
    async loadSavedChanges({ offset = 0, limit = 20 } = {}) {
      if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("조회 범위를 확인해주세요.");
      const { data, error } = await supabase.rpc("get_my_home_saved_changes_v1", { p_offset: offset, p_limit: limit });
      if (error) throw error;
      if (!Array.isArray(data?.items) || !Number.isSafeInteger(data.total_count) || data.total_count < 0) throw new Error("지원사업 변동 응답을 확인해주세요.");
      const items: MatchedProgram[] = data.items.map((item: SavedChangeNotice) => {
        let url: string | undefined;
        try { const parsed = new URL(item.url ?? ""); if (["http:", "https:"].includes(parsed.protocol)) url = parsed.href; } catch { /* No unsafe link. */ }
        return {
          id: item.notice_id, title: item.title, organization: item.organization,
          ...(url ? { url } : {}), categories: [item.field, item.region].filter((v): v is string => Boolean(v)),
          dDay: item.deadline_label || "공고 원문 확인", deadline: item.deadline ? dated(item.deadline) : "공고 원문 확인",
          is_saved: true, type: "default", matchLabel: "리포트 보기 〉",
          changes: formatMyHomeChanges(item),
        };
      });
      return { items, totalCount: data.total_count as number, rawItems: data.items as SavedChangeNotice[] };
    },
  };
}
