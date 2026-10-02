import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultSupabase } from "@/integrations/supabase/client";

type PreferenceMatch = {
  notice_id: string;
  preference_matched?: boolean;
};

export type PreferenceSearchResult = {
  status?: string;
  items: PreferenceMatch[];
  clarification_message?: string | null;
  message?: string | null;
  [key: string]: unknown;
};

const GENERIC_ERROR_MESSAGE = "선호조건 검색을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
const NETWORK_ERROR_MESSAGE = "인터넷 연결을 확인한 뒤 다시 시도해 주세요.";

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

  function apply(items: T[]) {
    return items.map((item) => ({
      ...item,
      preference_matched: matchedIds.has(item.id),
    }));
  }

  function refresh() {
    setItems(apply(getItems()));
  }

  function persist() {
    if (!storageKey || typeof window === "undefined") return;
    window.sessionStorage.setItem(storageKey, JSON.stringify([...matchedIds]));
  }

  function clear() {
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

  async function search(
    preferenceText: string,
    selectedField: string | null = null,
  ): Promise<PreferenceSearchResult> {
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

        if (current !== generation) return { status: "stale", items: [] };

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

        if (!data || !Array.isArray(data.items)) {
          throw new Error("검색 응답 형식이 잘못됐습니다.");
        }

        const result = data as PreferenceSearchResult;
        matchedIds = new Set(
          result.items
            .filter((item) => item.preference_matched === true)
            .map((item) => item.notice_id),
        );
        persist();
        refresh();
        onResult(result);
        return result;
      } catch (error) {
        if (current !== generation) return { status: "stale", items: [] };
        matchedIds = new Set();
        persist();
        refresh();
        const normalizedError = isNetworkError(error)
            ? new Error(NETWORK_ERROR_MESSAGE)
            : error instanceof Error
              ? error
              : new Error(GENERIC_ERROR_MESSAGE);
        onError(normalizedError);
        return { status: "error", items: [], message: normalizedError.message };
      } finally {
        if (current === generation) pending = null;
      }
    })();

    pending = { key, promise };
    return promise;
  }

  return { search, clear, cancel, apply };
}
