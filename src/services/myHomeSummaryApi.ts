import type { SupabaseClient } from "@supabase/supabase-js";

type SummaryCounts = {
  today_new: number;
  matched: number;
  review: number;
  saved: number;
};

export type MyHomeSummaryResponse = {
  counts: SummaryCounts;
  new_matching_count: number;
  saved_change_count: number;
};

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function createMyHomeSummaryApi(supabase: Pick<SupabaseClient, "rpc">) {
  return {
    async loadSummary(selectedField: string | null = null): Promise<MyHomeSummaryResponse> {
      if (selectedField !== null && typeof selectedField !== "string") {
        throw new Error("지원분야를 확인해주세요.");
      }
      const { data, error } = await supabase.rpc("get_my_home_summary_v1", {
        p_field: selectedField,
      });
      if (error) throw error;

      const response = data as Partial<MyHomeSummaryResponse> | null;
      const counts = response?.counts;
      if (
        !counts ||
        !isNonNegativeInteger(counts.today_new) ||
        !isNonNegativeInteger(counts.matched) ||
        !isNonNegativeInteger(counts.review) ||
        !isNonNegativeInteger(counts.saved) ||
        !isNonNegativeInteger(response.new_matching_count) ||
        !isNonNegativeInteger(response.saved_change_count)
      ) {
        throw new Error("MY홈 집계 응답을 확인해주세요.");
      }
      return response as MyHomeSummaryResponse;
    },
  };
}
