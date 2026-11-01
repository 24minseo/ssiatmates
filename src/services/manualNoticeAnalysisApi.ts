import type { SupabaseClient } from "@supabase/supabase-js";

const MANUAL_NOTICE_ANALYSIS_ENDPOINT =
  "https://annie37.app.n8n.cloud/webhook/manual-program-analyze";

export type ManualNoticeAnalysisNotice = {
  title?: string | null;
  organization?: string | null;
  field?: string | null;
  region?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  [key: string]: unknown;
};

export type ManualNoticeAnalysisResult = {
  status: "ready" | "confirmed";
  manual_notice_id: string;
  notice: ManualNoticeAnalysisNotice;
  report: unknown;
  request_id?: string;
};

export type ManualNoticeAnalysisOutcome = ManualNoticeAnalysisResult | { status: "stale" };

type ManualNoticeAnalysisResponse = Partial<ManualNoticeAnalysisResult> & {
  message?: unknown;
  success?: unknown;
};

export class ManualNoticeAnalysisError extends Error {
  requestId?: string;
  httpStatus?: number;
}

function validateNoticeUrl(inputUrl: string): URL {
  if (typeof inputUrl !== "string" || !inputUrl.trim()) {
    throw new Error("공고 URL을 입력해주세요.");
  }

  try {
    const url = new URL(inputUrl.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      throw new Error();
    }
    return url;
  } catch {
    throw new Error("http 또는 https 공고 상세페이지 주소를 입력해주세요.");
  }
}

export function createManualNoticeAnalysisApi(supabase: SupabaseClient) {
  const pending = new Map<string, Promise<ManualNoticeAnalysisOutcome>>();
  let generation = 0;

  async function analyze(input: { url: string }): Promise<ManualNoticeAnalysisOutcome> {
    const url = validateNoticeUrl(input.url);
    const started = generation;
    const { data, error } = await supabase.auth.getSession();
    if (started !== generation) return { status: "stale" as const };

    const session = data.session;
    if (error || !session?.access_token || !session.user?.id) {
      throw new Error("로그인 후 다시 시도해주세요.");
    }

    const sourceKey = url.href;
    const key = JSON.stringify([session.user.id, sourceKey]);
    const existing = pending.get(key);
    if (existing) return existing;

    const requestId = crypto.randomUUID();
    const promise = Promise.resolve().then(async () => {
      try {
        const response = await fetch(MANUAL_NOTICE_ANALYSIS_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ url: url.href, request_id: requestId }),
        });
        const result = (await response
          .json()
          .catch(() => null)) as ManualNoticeAnalysisResponse | null;

        if (started !== generation) return { status: "stale" as const };
        const current = await supabase.auth.getSession();
        if (
          started !== generation ||
          current.error ||
          current.data.session?.user?.id !== session.user.id
        ) {
          return { status: "stale" as const };
        }

        const notice = result?.notice;
        if (
          !response.ok ||
          result?.success !== true ||
          !["ready", "confirmed"].includes(result.status ?? "") ||
          typeof result.manual_notice_id !== "string" ||
          !result.manual_notice_id ||
          typeof notice !== "object" ||
          notice === null ||
          !result.report
        ) {
          const failure = new ManualNoticeAnalysisError(
            typeof result?.message === "string"
              ? result.message
              : "공고 분석 결과를 확인하지 못했습니다.",
          );
          failure.requestId = requestId;
          failure.httpStatus = response.status;
          throw failure;
        }

        return {
          status: result.status as "ready" | "confirmed",
          manual_notice_id: result.manual_notice_id,
          notice,
          report: result.report,
          ...(typeof result.request_id === "string" ? { request_id: result.request_id } : {}),
        } satisfies ManualNoticeAnalysisResult;
      } catch (error) {
        if (started !== generation) return { status: "stale" as const };
        if (error instanceof ManualNoticeAnalysisError && error.requestId) {
          throw error;
        }
        const failure = new ManualNoticeAnalysisError(
          "분석 응답을 확인하지 못했습니다. 서버에서는 처리가 계속될 수 있으니 실행 결과를 먼저 확인해주세요.",
        );
        failure.requestId = requestId;
        throw failure;
      } finally {
        if (pending.get(key) === promise) pending.delete(key);
      }
    });

    pending.set(key, promise);
    return promise;
  }

  return {
    analyze,
    clear() {
      generation += 1;
      pending.clear();
    },
  };
}
