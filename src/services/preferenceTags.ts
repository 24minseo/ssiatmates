import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultSupabase } from "@/integrations/supabase/client";

type PreferenceMatch = {
  notice_id: string;
  preference_matched?: boolean;
};

type PreferenceStatus =
  | "success"
  | "insufficient_data"
  | "no_results"
  | "needs_clarification"
  | "matching_not_ready"
  | "clarification";

export type PreferenceSearchResult = {
  status?: PreferenceStatus | "cleared" | "stale" | "error";
  items: PreferenceMatch[];
  clarification_message?: string | null;
  message?: string | null;
  display_message?: string;
  [key: string]: unknown;
};

const ALLOWED_STATUSES = new Set<PreferenceStatus>([
  "success",
  "insufficient_data",
  "no_results",
  "needs_clarification",
  "matching_not_ready",
  "clarification",
]);

const GENERIC_ERROR_MESSAGE = "선호조건 검색을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
const NETWORK_ERROR_MESSAGE = "인터넷 연결을 확인한 뒤 다시 시도해 주세요.";

export function preferenceResultMessage(result: PreferenceSearchResult) {
  switch (result.status) {
    case "success":
      return `선호조건을 충족하는 공고 ${result.items.length}건을 확인했어요.`;
    case "insufficient_data":
      return "선호조건을 확인할 분석 정보가 부족해요. 기존 공고는 그대로 확인할 수 있어요.";
    case "no_results":
      return "선호조건을 충족하는 것으로 확인된 공고가 없어요.";
    case "needs_clarification":
    case "clarification":
      return "선호조건을 조금 더 구체적으로 알려주세요.";
    case "matching_not_ready":
      return "기본매칭이 아직 준비되지 않았어요. 잠시 후 다시 확인해주세요.";
    default:
      return "";
  }
}

function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|networkerror|network request failed|err_network|fetch failed/i.test(
    message,
  );
}

type PreferenceTagsOptions<T extends { id: string }> = {
  supabase?: Pick<SupabaseClient, "functions">;
  storageKey?: string | undefined;
  getItems: () => T[];
  setItems: (items: T[]) => void;
  onResult?: (result: PreferenceSearchResult) => void;
  onError?: (error: Error) => void;
};

function readStoredIds(storageKey?: string) {
  if (!storageKey || typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(
      Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [],
    );
  } catch {
    return new Set<string>();
  }
}

export function createPreferenceTags<T extends { id: string }>({
  supabase = defaultSupabase,
  storageKey,
  getItems,
  setItems,
  onResult = () => undefined,
  onError = () => undefined,
}: PreferenceTagsOptions<T>) {
  let matchedIds = readStoredIds(storageKey);
  let generation = 0;
  let pending: { key: string; promise: Promise<PreferenceSearchResult> } | null = null;
  let disposed = false;

  function apply(items: T[]) {
    return items.map((item) => ({
      ...item,
      preference_matched: matchedIds.has(item.id),
    }));
  }

  function refresh() {
    if (!disposed) setItems(apply(getItems()));
  }

  function persist() {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify([...matchedIds]));
    } catch {
      // Keep in-memory tags available when session storage is blocked.
    }
  }

  function clear() {
    if (disposed) return;
    generation += 1;
    pending = null;
    matchedIds = new Set();
    persist();
    refresh();
  }

  function cancel() {
    generation += 1;
    pending = null;
  }

  function dispose() {
    disposed = true;
    generation += 1;
    pending = null;
    matchedIds = new Set();
  }

  async function search(
    preferenceText: string,
    selectedField: string | null = null,
  ): Promise<PreferenceSearchResult> {
    if (disposed) return Promise.resolve({ status: "stale" as const, items: [] });
    const text = typeof preferenceText === "string" ? preferenceText.trim() : "";
    if (!text) {
      clear();
      const result: PreferenceSearchResult = { status: "cleared", items: [] };
      onResult(result);
      return result;
    }

    const key = JSON.stringify([text, selectedField]);
    if (pending?.key === key) return pending.promise;

    const current = ++generation;

    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("notice-preference-tags", {
          body: { preference_text: text, p_field: selectedField },
        });

        if (current !== generation || disposed) return { status: "stale" as const, items: [] };

        if (error) {
          let message = isNetworkError(error) ? NETWORK_ERROR_MESSAGE : GENERIC_ERROR_MESSAGE;
          const context = (error as { context?: Response }).context;
          if (context) {
            try {
              const body = (await context.clone().json()) as { message?: string };
              message = body.message || message;
            } catch {
              // Keep the generic message when the function error has no JSON body.
            }
          }
          throw new Error(message);
        }

        if (!data || typeof data !== "object") {
          throw new Error("검색 응답 형식이 잘못됐습니다.");
        }

        const payload = data as Record<string, unknown>;
        const status = payload["status"];
        if (typeof status !== "string" || !ALLOWED_STATUSES.has(status as PreferenceStatus)) {
          throw new Error("검색 응답 형식이 잘못됐습니다.");
        }

        const items = payload["items"];
        const normalizedItems =
          items === undefined &&
          status !== "success"
            ? []
            : items;
        if (
          !Array.isArray(normalizedItems) ||
          normalizedItems.some(
            (item) =>
              !item ||
              typeof item !== "object" ||
              typeof (item as { notice_id?: unknown }).notice_id !== "string" ||
              !(item as { notice_id: string }).notice_id,
          )
        ) {
          throw new Error("검색 응답 형식이 잘못됐습니다.");
        }

        const matchedItems = (normalizedItems as PreferenceMatch[]).filter(
          (item) => item.preference_matched === true,
        );
        const result: PreferenceSearchResult = {
          ...payload,
          status: status === "success" && matchedItems.length === 0
            ? "no_results"
            : status as PreferenceStatus,
          items: matchedItems,
        };
        result.display_message = preferenceResultMessage(result);
        matchedIds = new Set(matchedItems.map((item) => item.notice_id));
        persist();
        refresh();
        onResult(result);
        return result;
      } catch (error) {
        if (current !== generation) return { status: "stale" as const, items: [] };
        matchedIds = new Set();
        persist();
        refresh();
        const normalizedError = isNetworkError(error)
            ? new Error(NETWORK_ERROR_MESSAGE)
            : error instanceof Error
              ? error
              : new Error(GENERIC_ERROR_MESSAGE);
        onError(normalizedError);
        return {
          status: "error" as const,
          items: [],
          message: normalizedError.message,
        };
      } finally {
        if (current === generation) pending = null;
      }
    })();

    pending = { key, promise };
    return promise;
  }

  return { search, clear, cancel, dispose, apply };
}
