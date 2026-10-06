import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, MoreVertical, X } from "lucide-react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { Pagination } from "@/components/ui/pagination";
import { ProgramSortDropdown, type ProgramSortOption } from "@/components/my-programs/ProgramSortDropdown";
import { ProgramFormDialog } from "@/components/my-programs/ProgramFormDialog";
import { ProgramResultRow } from "@/components/programs/ProgramResultRow";
import { ProgramResultsTabs, type ProgramResultsTab } from "@/components/programs/ProgramResultsTabs";
import { SupportCategorySelect } from "@/components/programs/SupportCategorySelect";
import { SUPPORT_ALL } from "@/components/onboarding/constants";
import type { MatchedProgram } from "@/mocks/programSearchMock";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProgramReportDialog } from "@/components/programs/ProgramReportDialog";
import { getSupportFilterSession, setSupportFilterSession } from "@/lib/supportFilterSession";
import { applySavedStates, savedNoticesApi } from "@/services/savedNoticesApi";
import { createPreferenceTags } from "@/services/preferenceTags";
import { programService, type Program, type ProgramInput } from "@/services/programRepository";
import { formatProgramRegion } from "@/lib/programRegion";
import { SquareAlertIcon } from "@/components/ui/square-alert-icon";

const PAGE_SIZE = 20;
const PREFERENCE_QUERY_STORAGE_PREFIX = "programs-preference-query:";
const PREFERENCE_COMMITTED_QUERY_STORAGE_PREFIX = "programs-preference-committed-query:";
const PREFERENCE_MATCH_STORAGE_PREFIX = "programs-preference-matches:";
const PREFERENCE_SUGGESTIONS = [
  "온라인으로 신청하고 싶어요",
  "사업계획서 없이 신청하고 싶어요",
  "필수 서류가 3개 이하면 좋겠어요",
  "면접이 없으면 좋겠어요",
  "발표 심사가 없으면 좋겠어요",
  "혼자 참여할 수 있으면 좋겠어요",
] as const;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function millisecondsUntilKoreanNoon(now = Date.now()) {
  const kst = new Date(now + 9 * 60 * 60 * 1000);
  let nextNoon = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 3);
  if (nextNoon <= now) nextNoon += 24 * 60 * 60 * 1000;
  return nextNoon - now;
}

type NoticeMatchItem = {
  notice_id: string;
  preference_matched?: boolean;
  is_saved?: boolean;
  title: string;
  organization: string;
  url: string | null;
  field: string | null;
  region: string | null;
  deadline: string | null;
  deadline_label: string | null;
  recruitment_status: string | null;
  status_label: string | null;
  days_until_deadline: number | null;
  is_closed: boolean;
  recommendation_only: boolean;
  report_available: boolean;
};

type NoticeMatchesResponse = {
  items: NoticeMatchItem[];
  total_count?: number | null;
  excluded_count?: number | null;
  closed_count?: number | null;
  has_more?: boolean;
};

function safeNoticeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "";
  const date = new Date(`${deadline}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `~${month}.${day}(${WEEKDAYS[date.getDay()]})`;
}

function toMatchedProgram(item: NoticeMatchItem): MatchedProgram {
  const categories = [item.field, formatProgramRegion(item.region)]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim())
    .filter((value) => value.length <= 20);
  const rawDeadlineLabel = item.deadline_label?.trim() ?? "";
  const dDay =
    rawDeadlineLabel &&
    rawDeadlineLabel !== "공고 원문 확인" &&
    rawDeadlineLabel !== "일정 확인 필요"
      ? rawDeadlineLabel
      : "-";
  const deadlineLabel = formatDeadline(item.deadline) || "공고 원문 확인";

  return {
    id: item.notice_id,
    preference_matched: item.preference_matched === true,
    is_saved: item.is_saved === true,
    ...(safeNoticeUrl(item.url) ? { url: safeNoticeUrl(item.url)! } : {}),
    organization: item.organization,
    title: item.title,
    categories,
    dDay,
    deadline: deadlineLabel,
    daysUntilDeadline: item.days_until_deadline,
    // 리포트가 아직 준비되지 않은 공고도 버튼에서 준비 상태를 안내한다.
    matchLabel: "리포트 보기 〉",
    // `recommendation_only` only identifies the current-match source. It is
    // not the profile-condition result, so keep the default row variant until
    // the dedicated preference-match result is available.
    type: "default",
  };
}

function toManualMatchedProgram(program: Program): MatchedProgram {
  const categories = [program.category, program.region]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value.length <= 20);

  return {
    id: program.id,
    preference_matched: false,
    is_saved: false,
    ...(program.url ? { url: program.url } : {}),
    organization: program.organization,
    title: program.title,
    categories,
    dDay: program.deadlineLabel ?? "-",
    deadline: program.deadlineLabel ?? "일정 확인 필요",
    daysUntilDeadline: null,
    matchLabel: "",
    type: "default",
  };
}

export const Route = createFileRoute("/programs")({
  head: () => ({ meta: [{ title: "지원사업 탐색" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: ProgramResultsTab } =>
    search["tab"] === "review" || search["tab"] === "manual"
      ? { tab: search["tab"] as "review" | "manual" }
      : {},
  component: ProgramsPage,
});

type MatchingView = "active" | "review" | "excluded";
type PreferenceFeedback = {
  tone: "success" | "error";
  message: string;
  icon?: "alert";
};
const PREFERENCE_FEEDBACK_BASE_CLASS =
  "relative flex min-h-6 items-start gap-1 border border-transparent px-[10px] py-1 text-[14px] font-semibold leading-5";

async function loadMatchingNotices(
  view: MatchingView,
  selectedField: string | null,
  offset = 0,
): Promise<NoticeMatchesResponse> {
  if (view !== "active" && view !== "review" && view !== "excluded") {
    throw new Error("목록 구분이 잘못됐습니다.");
  }

  const params: {
    p_limit: number;
    p_offset: number;
    p_field: string | null;
    p_include_closed?: boolean;
  } = {
    p_limit: PAGE_SIZE,
    p_offset: offset,
    p_field: selectedField,
  };
  const rpc = view === "excluded"
    ? "get_my_excluded_notice_matches_v1"
    : view === "review"
      ? "get_my_notice_review_matches_v1"
      : "get_my_notice_matches_v1";

  if (view !== "excluded") {
    params.p_include_closed = false;
  }

  const invokeRpc = (
    name: string,
    args: typeof params,
  ) => supabase.rpc(name as never, args as never);
  const { data, error } = await invokeRpc(rpc, params);
  if (error) throw error;

  const response = (data ?? {}) as Partial<NoticeMatchesResponse>;
  return {
    items: Array.isArray(response.items) ? response.items : [],
    total_count: typeof response.total_count === "number" ? response.total_count : null,
    excluded_count: typeof response.excluded_count === "number" ? response.excluded_count : null,
    closed_count: typeof response.closed_count === "number" ? response.closed_count : null,
    has_more: response.has_more === true,
  };
}

function getSelectedFields(
  categories: string[],
  usesProfileDefault: boolean,
): Array<string | null> {
  if (usesProfileDefault) return [null];
  if (categories.includes(SUPPORT_ALL)) return [SUPPORT_ALL];

  const selectedFields = categories.filter((category) => category !== SUPPORT_ALL);
  return selectedFields.length ? selectedFields : [SUPPORT_ALL];
}

function ExcludedProgramRow({ program }: { program: MatchedProgram }) {
  return (
    <article className="flex min-h-[118px] items-center gap-6 border-b border-[#e9e9e9] bg-white px-8 py-[14px] last:border-b-0">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[20px] font-semibold leading-6 tracking-[-0.22px] text-ink">
          {program.url ? (
            <a
              href={program.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate hover:underline hover:decoration-[1px] hover:underline-offset-[4px]"
            >
              {program.title}
            </a>
          ) : (
            program.title
          )}
        </h3>
        <div className="mt-2 flex min-w-0 items-center text-[14px] font-normal text-ink-muted">
          {[program.organization, ...program.categories].map((item, index) => (
            <Fragment key={`${item}-${index}`}>
              {index > 0 ? (
                <span
                  aria-hidden
                  className="mx-[6px] h-[10px] w-[1.5px] shrink-0 bg-field-border"
                />
              ) : null}
              <span className="truncate">{item}</span>
            </Fragment>
          ))}
        </div>
      </div>
      <div className="flex w-[110px] shrink-0 flex-col items-start">
        <span className="rounded-[6px] bg-item-hover px-1.5 py-0.5 text-[13px] font-semibold text-content-disabled">
          {program.dDay}
        </span>
        <p className="mt-3 text-[14px] leading-5 text-ink-muted">
          {program.deadline}
        </p>
      </div>
    </article>
  );
}

function ProgramsPage() {
  const { session, profile } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState("");
  const [preferenceFeedback, setPreferenceFeedback] = useState<PreferenceFeedback | null>(null);
  const [preferenceFeedbackExiting, setPreferenceFeedbackExiting] = useState(false);
  const [preferenceFeedbackVersion, setPreferenceFeedbackVersion] = useState(0);
  const [isPreferenceSearching, setIsPreferenceSearching] = useState(false);
  const [isSearchLoadingVisible, setIsSearchLoadingVisible] = useState(false);
  const [showWaitMessage, setShowWaitMessage] = useState(false);
  const searchLoaderVisible = isSearchLoadingVisible;
  const feedbackForDisplay = preferenceFeedback;
  const preferenceFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preferenceStorageKey = session?.user.id ?? null;
  const previousPreferenceStorageKey = useRef<string | null>(null);
  const [isQueryFocused, setIsQueryFocused] = useState(false);
  const preferenceInputRef = useRef<HTMLInputElement>(null);
  const preferenceSuggestionsRef = useRef<HTMLDivElement>(null);
  const [canScrollPreferenceSuggestions, setCanScrollPreferenceSuggestions] = useState(false);
  const submittedPreferenceQueryRef = useRef("");
  const submittedPreferenceFieldRef = useRef<string | null>(null);
  const matchDataVersionRef = useRef(0);
  const lastPreferenceSearchRef = useRef<{
    query: string;
    field: string | null;
    version: number;
  } | null>(null);
  const preferenceReapplyReasonRef = useRef<"silent" | "profile-save">("silent");
  const silentPreferenceReapplyRef = useRef(false);

  useEffect(() => {
    if (!isQueryFocused) {
      setCanScrollPreferenceSuggestions(false);
      return;
    }

    const suggestions = preferenceSuggestionsRef.current;
    if (!suggestions) return;

    const updateScrollState = () => {
      setCanScrollPreferenceSuggestions(
        suggestions.scrollWidth > suggestions.clientWidth + 1 &&
          suggestions.scrollLeft < suggestions.scrollWidth - suggestions.clientWidth - 1,
      );
    };

    updateScrollState();
    suggestions.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(suggestions);

    return () => {
      suggestions.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [isQueryFocused]);

  useEffect(() => {
    if (!searchLoaderVisible) {
      setShowWaitMessage(false);
      return;
    }

    const interval = window.setInterval(() => {
      setShowWaitMessage((visible) => !visible);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [searchLoaderVisible]);
  const [sort, setSort] = useState<ProgramSortOption>("deadline");
  const [tab, setTab] = useState<ProgramResultsTab>(search["tab"] ?? "recommended");
  const [page, setPage] = useState(1);
  const [supportCategories, setSupportCategories] = useState<string[]>([SUPPORT_ALL]);
  const [usesProfileDefault, setUsesProfileDefault] = useState(true);
  const profileFilterInitializedFor = useRef<string | null>(null);
  const matchingRequestRef = useRef(0);
  const reviewRequestRef = useRef(0);
  const excludedRequestRef = useRef(0);
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [matchedPrograms, setMatchedPrograms] = useState<MatchedProgram[]>([]);
  const [reviewPrograms, setReviewPrograms] = useState<MatchedProgram[]>([]);
  const [activeTotalCount, setActiveTotalCount] = useState(0);
  const [reviewTotalCount, setReviewTotalCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [excludedPrograms, setExcludedPrograms] = useState<MatchedProgram[]>([]);
  const [manualPrograms, setManualPrograms] = useState<MatchedProgram[]>([]);
  const [isLoadingExcluded, setIsLoadingExcluded] = useState(false);
  const [excludedError, setExcludedError] = useState<string | null>(null);
  const [savingNoticeIds, setSavingNoticeIds] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<MatchedProgram | null>(null);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const matchedProgramsRef = useRef<MatchedProgram[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user.id) {
      setManualPrograms([]);
      return () => {
        cancelled = true;
      };
    }
    void programService.list().then((programs) => {
      if (!cancelled) {
        setManualPrograms(
          programs
            .filter((program) => program.source === "manual")
            .map(toManualMatchedProgram),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);
  const preferenceTags = useMemo(
    () =>
      createPreferenceTags<MatchedProgram>({
        storageKey: preferenceStorageKey
          ? `${PREFERENCE_MATCH_STORAGE_PREFIX}${preferenceStorageKey}`
          : undefined,
        getItems: () => matchedProgramsRef.current,
        setItems: (items) => {
          matchedProgramsRef.current = items;
          setMatchedPrograms(items);
        },
        onResult: (result) => {
          setIsPreferenceSearching(false);
          setIsSearchLoadingVisible(false);
          if (searchLoadingTimerRef.current) {
            clearTimeout(searchLoadingTimerRef.current);
            searchLoadingTimerRef.current = null;
          }
          if (preferenceFeedbackTimerRef.current) {
            clearTimeout(preferenceFeedbackTimerRef.current);
            preferenceFeedbackTimerRef.current = null;
          }
          if (result.status === "cleared" || result.status === "stale") {
            if (result.status === "cleared") {
              setPreferenceFeedbackExiting(false);
              setPreferenceFeedback(null);
            }
            return;
          }
          const isSilentReapply = silentPreferenceReapplyRef.current;
          silentPreferenceReapplyRef.current = false;
          const submittedQuery = submittedPreferenceQueryRef.current.trim();
          if (submittedQuery) {
            lastPreferenceSearchRef.current = {
              query: submittedQuery,
              field: submittedPreferenceFieldRef.current,
              version: matchDataVersionRef.current,
            };
          }
          if (submittedQuery && preferenceStorageKey) {
            window.sessionStorage.setItem(
              `${PREFERENCE_COMMITTED_QUERY_STORAGE_PREFIX}${preferenceStorageKey}`,
              submittedQuery,
            );
          }
          const needsClarification =
            result.status === "clarification" ||
            result.status === "needs_clarification" ||
            Boolean(result.clarification_message);
          const message =
            result.display_message ||
            (needsClarification
              ? "선호조건을 조금 더 구체적으로 알려주세요."
              : result.message?.trim() ||
                (result.items.length === 0
                  ? "선호조건을 충족하는 것으로 확인된 공고가 없어요"
                  : "선호조건을 반영했어요."));
          setSort(
            result.items.some((item) => item.preference_matched === true) ? "fit" : "deadline",
          );
          if (isSilentReapply) return;
          setPreferenceFeedbackExiting(false);
          setPreferenceFeedbackVersion((version) => version + 1);
          const showInfoIcon =
            result.status === "insufficient_data" ||
            result.status === "needs_clarification" ||
            result.status === "clarification" ||
            result.status === "matching_not_ready";
          setPreferenceFeedback({
            tone: "success",
            message,
            ...(showInfoIcon ? { icon: "alert" as const } : {}),
          });
          if (!needsClarification && result.items.length > 0) {
            preferenceFeedbackTimerRef.current = setTimeout(() => {
              setPreferenceFeedbackExiting(true);
              preferenceFeedbackTimerRef.current = setTimeout(() => {
                setPreferenceFeedback(null);
                setPreferenceFeedbackExiting(false);
                preferenceFeedbackTimerRef.current = null;
              }, 180);
            }, 4000);
          }
        },
        onError: (error) => {
          const isSilentReapply = silentPreferenceReapplyRef.current;
          silentPreferenceReapplyRef.current = false;
          setIsPreferenceSearching(false);
          setIsSearchLoadingVisible(false);
          if (searchLoadingTimerRef.current) {
            clearTimeout(searchLoadingTimerRef.current);
            searchLoadingTimerRef.current = null;
          }
          if (preferenceFeedbackTimerRef.current) {
            clearTimeout(preferenceFeedbackTimerRef.current);
            preferenceFeedbackTimerRef.current = null;
          }
          if (!isSilentReapply) {
            setPreferenceFeedbackExiting(false);
            const submittedQuery = submittedPreferenceQueryRef.current.trim();
            if (submittedQuery && preferenceStorageKey) {
              window.sessionStorage.setItem(
                `${PREFERENCE_COMMITTED_QUERY_STORAGE_PREFIX}${preferenceStorageKey}`,
                submittedQuery,
              );
            }
            setSort("deadline");
            setPreferenceFeedbackVersion((version) => version + 1);
            setPreferenceFeedback({ tone: "error", message: error.message });
          }
        },
      }),
    [preferenceStorageKey],
  );

  useEffect(() => {
    matchedProgramsRef.current = matchedPrograms;
  }, [matchedPrograms]);

  useEffect(
    () => () => {
      preferenceTags.dispose();
      if (preferenceFeedbackTimerRef.current) clearTimeout(preferenceFeedbackTimerRef.current);
      if (searchLoadingTimerRef.current) clearTimeout(searchLoadingTimerRef.current);
    },
    [preferenceTags],
  );

  useEffect(() => {
    const previousKey = previousPreferenceStorageKey.current;
    if (previousKey && previousKey !== preferenceStorageKey) {
      window.sessionStorage.removeItem(`${PREFERENCE_QUERY_STORAGE_PREFIX}${previousKey}`);
      window.sessionStorage.removeItem(`${PREFERENCE_COMMITTED_QUERY_STORAGE_PREFIX}${previousKey}`);
      window.sessionStorage.removeItem(`${PREFERENCE_MATCH_STORAGE_PREFIX}${previousKey}`);
    }
    previousPreferenceStorageKey.current = preferenceStorageKey;

    if (!preferenceStorageKey) {
      setQuery("");
      return;
    }
    const storedCommittedQuery =
      window.sessionStorage.getItem(
        `${PREFERENCE_COMMITTED_QUERY_STORAGE_PREFIX}${preferenceStorageKey}`,
      ) ??
      window.sessionStorage.getItem(
        `${PREFERENCE_QUERY_STORAGE_PREFIX}${preferenceStorageKey}`,
      ) ??
      "";
    setQuery(storedCommittedQuery);
  }, [preferenceStorageKey]);

  useEffect(() => {
    if (!profile) return;

    const savedCategories = getSupportFilterSession(profile.id);
    const profileCategories = profile.support_categories.filter(Boolean);
    if (savedCategories === null) {
      setUsesProfileDefault(true);
      setSupportCategories(profileCategories.length ? profileCategories : [SUPPORT_ALL]);
    } else if (profileFilterInitializedFor.current !== profile.id) {
      setUsesProfileDefault(false);
      setSupportCategories(savedCategories);
    }
    profileFilterInitializedFor.current = profile.id;
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    let requestInFlight = false;

    async function loadMatches(showLoading = true) {
      if (!session?.user.id) {
        preferenceTags.clear();
        if (preferenceStorageKey) {
          window.sessionStorage.removeItem(
            `${PREFERENCE_QUERY_STORAGE_PREFIX}${preferenceStorageKey}`,
          );
        }
        setMatchedPrograms([]);
        setActiveTotalCount(0);
        setExcludedCount(0);
        setIsLoadingMatches(false);
        return;
      }
      if (!profileFilterInitializedFor.current) return;
      if (requestInFlight) return;
      requestInFlight = true;

      const requestId = matchingRequestRef.current + 1;
      matchingRequestRef.current = requestId;

      if (showLoading) {
        setIsLoadingMatches(true);
        setMatchError(null);
      }

      try {
        const fields = getSelectedFields(supportCategories, usesProfileDefault);
        const offset = (page - 1) * PAGE_SIZE;
        const [responses, savedState] = await Promise.all([
          Promise.all(fields.map((field) => loadMatchingNotices("active", field, offset))),
          savedNoticesApi.getSavedStates().catch((error) => {
            console.error("[programs] 저장 상태 조회 실패", error);
            return { items: [] };
          }),
        ]);

        if (cancelled || matchingRequestRef.current !== requestId) return;

        const uniqueItems = new Map<string, NoticeMatchItem>();
        responses.forEach((response) => {
          response.items.forEach((item) => uniqueItems.set(item.notice_id, item));
        });

        const itemsWithSavedState = applySavedStates(
          Array.from(uniqueItems.values()),
          savedState.items,
        );
        const nextPrograms = itemsWithSavedState.map(toMatchedProgram);
        const nextProgramsWithPreferences = preferenceTags.apply(nextPrograms);
        setMatchedPrograms(nextProgramsWithPreferences);
        const committedQuery = preferenceStorageKey
          ? window.sessionStorage.getItem(
              `${PREFERENCE_COMMITTED_QUERY_STORAGE_PREFIX}${preferenceStorageKey}`,
            )?.trim() ?? ""
          : "";
        if (committedQuery && !isPreferenceSearching) {
          const selectedField =
            fields.length === 1 && !fields.includes(SUPPORT_ALL) ? fields[0] ?? null : null;
          submittedPreferenceQueryRef.current = committedQuery;
          submittedPreferenceFieldRef.current = selectedField;
          silentPreferenceReapplyRef.current =
            preferenceReapplyReasonRef.current !== "profile-save";
          preferenceReapplyReasonRef.current = "silent";
          void preferenceTags.search(committedQuery, selectedField);
        }
        setSort(
          nextProgramsWithPreferences.some((item) => item.preference_matched === true)
            ? "fit"
            : "deadline",
        );
        setActiveTotalCount(
          responses.reduce(
            (total, response) => total + (response.total_count ?? response.items.length),
            0,
          ),
        );
        setExcludedCount(
          responses.reduce(
            (total, response) => total + (response.excluded_count ?? response.closed_count ?? 0),
            0,
          ),
        );
        matchDataVersionRef.current += 1;
      } catch (error) {
        if (cancelled || matchingRequestRef.current !== requestId) return;
        console.error("[programs] 맞춤 공고 조회 실패", error);
        if (showLoading) {
          setMatchError("맞춤 공고를 불러오지 못했습니다.");
          setMatchedPrograms([]);
          setActiveTotalCount(0);
          setExcludedCount(0);
        }
      } finally {
        requestInFlight = false;
        if (showLoading && !cancelled && matchingRequestRef.current === requestId) {
          setIsLoadingMatches(false);
        }
      }
    }

    let noonTimer: number | null = null;
    const scheduleNoonRefresh = () => {
      if (noonTimer !== null) window.clearTimeout(noonTimer);
      noonTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (document.visibilityState === "visible") void loadMatches(false);
        scheduleNoonRefresh();
      }, millisecondsUntilKoreanNoon());
    };
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void loadMatches(false);
        scheduleNoonRefresh();
      }
    };
    const refreshAfterProfileSave = () => {
      preferenceReapplyReasonRef.current = "profile-save";
      void loadMatches(true);
    };

    void loadMatches();
    scheduleNoonRefresh();
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("pageshow", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("matching-profile-saved", refreshAfterProfileSave);

    return () => {
      cancelled = true;
      if (noonTimer !== null) window.clearTimeout(noonTimer);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("pageshow", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("matching-profile-saved", refreshAfterProfileSave);
    };
  }, [
    session?.user.id,
    profile?.id,
    profile?.birth_date,
    profile?.startup_stage,
    profile?.residence,
    profile?.business_location,
    profile?.business_fields.join("|"),
    profile?.personal_statuses.join("|"),
    profile?.support_categories.join("|"),
    supportCategories.join("|"),
    usesProfileDefault,
    page,
    preferenceStorageKey,
    preferenceTags,
  ]);

  useEffect(() => {
    if (tab !== "review") return;
    let cancelled = false;
    const requestId = reviewRequestRef.current + 1;
    reviewRequestRef.current = requestId;

    if (!session?.user.id || !profileFilterInitializedFor.current) {
      setReviewPrograms([]);
      setReviewTotalCount(0);
      setIsLoadingReview(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingReview(true);
    setReviewError(null);

    const loadReviewMatches = async () => {
      try {
        const fields = getSelectedFields(supportCategories, usesProfileDefault);
        const offset = (page - 1) * PAGE_SIZE;
        const [responses, savedState] = await Promise.all([
          Promise.all(fields.map((field) => loadMatchingNotices("review", field, offset))),
          savedNoticesApi.getSavedStates().catch((error) => {
            console.error("[programs] 저장 상태 조회 실패", error);
            return { items: [] };
          }),
        ]);

        if (cancelled || reviewRequestRef.current !== requestId) return;

        const uniqueItems = new Map<string, NoticeMatchItem>();
        responses.forEach((response) => {
          response.items.forEach((item) => uniqueItems.set(item.notice_id, item));
        });
        const itemsWithSavedState = applySavedStates(
          Array.from(uniqueItems.values()),
          savedState.items,
        );
        setReviewPrograms(
          preferenceTags.apply(itemsWithSavedState.map(toMatchedProgram)),
        );
        setReviewTotalCount(
          responses.reduce(
            (total, response) => total + (response.total_count ?? response.items.length),
            0,
          ),
        );
      } catch (error) {
        if (cancelled || reviewRequestRef.current !== requestId) return;
        console.error("[programs] 추가 검토 공고 조회 실패", error);
        setReviewError("추가 검토 공고를 불러오지 못했습니다.");
        setReviewPrograms([]);
        setReviewTotalCount(0);
      } finally {
        if (!cancelled && reviewRequestRef.current === requestId) {
          setIsLoadingReview(false);
        }
      }
    };

    void loadReviewMatches();
    return () => {
      cancelled = true;
    };
  }, [
    tab,
    page,
    session?.user.id,
    profile?.id,
    supportCategories.join("|"),
    usesProfileDefault,
    preferenceTags,
  ]);

  const loadExcludedNotices = async () => {
    if (!session?.user.id) return;

    const requestId = excludedRequestRef.current + 1;
    excludedRequestRef.current = requestId;
    setIsLoadingExcluded(true);
    setExcludedError(null);

    try {
      const fields = getSelectedFields(supportCategories, usesProfileDefault);
      const [responses, savedState] = await Promise.all([
        Promise.all(fields.map((field) => loadMatchingNotices("excluded", field, 0))),
        savedNoticesApi.getSavedStates().catch((error) => {
          console.error("[programs] 저장 상태 조회 실패", error);
          return { items: [] };
        }),
      ]);

      if (excludedRequestRef.current !== requestId) return;

      const uniqueItems = new Map<string, NoticeMatchItem>();
      responses.forEach((response) => {
        response.items.forEach((item) => uniqueItems.set(item.notice_id, item));
      });

      const itemsWithSavedState = applySavedStates(
        Array.from(uniqueItems.values()),
        savedState.items,
      );
      setExcludedPrograms(itemsWithSavedState.map(toMatchedProgram));
      setExcludedCount(
        responses.reduce(
          (total, response) => total + (response.total_count ?? response.items.length),
          0,
        ),
      );
    } catch (error) {
      if (excludedRequestRef.current !== requestId) return;
      console.error("[programs] 제외된 공고 조회 실패", error);
      setExcludedError("제외된 공고를 불러오지 못했습니다.");
      setExcludedPrograms([]);
    } finally {
      if (excludedRequestRef.current === requestId) {
        setIsLoadingExcluded(false);
      }
    }
  };

  const handleExcludedOpen = () => {
    setExcludedOpen(true);
    void loadExcludedNotices();
  };

  const handleFavoriteToggle = async (program: MatchedProgram) => {
    if (savingNoticeIds.has(program.id)) return;

    setSavingNoticeIds((current) => new Set(current).add(program.id));
    try {
      const result = await savedNoticesApi.setSaved(program.id, program.is_saved !== true);
      setMatchedPrograms((current) =>
        current.map((item) =>
          item.id === program.id ? { ...item, is_saved: result.is_saved } : item,
        ),
      );
      setExcludedPrograms((current) =>
        current.map((item) =>
          item.id === program.id ? { ...item, is_saved: result.is_saved } : item,
        ),
      );
      toast.success(
        result.is_saved
          ? "내 지원사업에 저장되었습니다."
          : "내 지원사업에서 삭제되었습니다.",
      );
    } catch (error) {
      console.error("[programs] 저장 상태 변경 실패", error);
      toast.error("관심 공고 저장 상태를 변경하지 못했습니다.");
    } finally {
      setSavingNoticeIds((current) => {
        const next = new Set(current);
        next.delete(program.id);
        return next;
      });
    }
  };

  const resultsByTab = useMemo(() => {
    const filterAndSort = (items: MatchedProgram[]) => {
      const filtered = items.filter((item) => {
        const matchesCategory =
          supportCategories.includes(SUPPORT_ALL) ||
          item.categories.some((category) => supportCategories.includes(category));
        return matchesCategory;
      });

      return [...filtered].sort((a, b) => {
        if (sort === "deadline") {
          const aDays = a.daysUntilDeadline ?? Number.POSITIVE_INFINITY;
          const bDays = b.daysUntilDeadline ?? Number.POSITIVE_INFINITY;
          return aDays - bDays;
        }
        return sort === "fit"
          ? Number(b.preference_matched === true) - Number(a.preference_matched === true)
          : 0;
      });
    };

    const manualResults = filterAndSort(manualPrograms);

    return {
      recommended: filterAndSort(matchedPrograms),
      review: filterAndSort(reviewPrograms),
      manual: manualResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    };
  }, [manualPrograms, matchedPrograms, page, reviewPrograms, sort, supportCategories]);

  useEffect(() => {
    setPage(1);
  }, [sort, tab, supportCategories]);

  useEffect(() => {
    setTab(search["tab"] ?? "recommended");
  }, [search]);

  const results = resultsByTab[tab];
  const currentLoading = tab === "review" ? isLoadingReview : isLoadingMatches;
  const currentError = tab === "review" ? reviewError : matchError;
  const tabTotalCount =
    tab === "recommended"
      ? activeTotalCount
      : tab === "manual"
        ? manualPrograms.length
        : reviewTotalCount;
  const pageCount = Math.max(1, Math.ceil(tabTotalCount / PAGE_SIZE));
  const handleTabChange = (nextTab: ProgramResultsTab) => {
    setTab(nextTab);
    void navigate({
      search: nextTab === "review" || nextTab === "manual" ? { tab: nextTab } : {},
    });
  };

  async function handleManualSubmit(input: ProgramInput) {
    setManualSaving(true);
    try {
      const created = await programService.create(input);
      setManualPrograms((current) => [toManualMatchedProgram(created), ...current]);
      setManualFormOpen(false);
      toast.success("수동 공고를 추가했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "수동 공고를 추가하지 못했습니다.");
    } finally {
      setManualSaving(false);
    }
  }

  function handleClearPreferenceSearch() {
    setQuery("");
    submittedPreferenceQueryRef.current = "";
    submittedPreferenceFieldRef.current = null;
    lastPreferenceSearchRef.current = null;
    if (preferenceStorageKey) {
      window.sessionStorage.removeItem(
        `${PREFERENCE_COMMITTED_QUERY_STORAGE_PREFIX}${preferenceStorageKey}`,
      );
      window.sessionStorage.removeItem(`${PREFERENCE_QUERY_STORAGE_PREFIX}${preferenceStorageKey}`);
    }
    preferenceTags.clear();
    setPreferenceFeedback(null);
    setIsPreferenceSearching(false);
    setIsSearchLoadingVisible(false);
    if (searchLoadingTimerRef.current) {
      clearTimeout(searchLoadingTimerRef.current);
      searchLoadingTimerRef.current = null;
    }
    if (preferenceFeedbackTimerRef.current) {
      clearTimeout(preferenceFeedbackTimerRef.current);
      preferenceFeedbackTimerRef.current = null;
    }
    setSort("deadline");
  }

  return (
    <section className="space-y-[18px]">
      <h1 className="text-[28px] font-bold leading-tight text-ink">지원사업 탐색</h1>
      <div className="grid grid-cols-[290px_290px_minmax(0,1fr)] gap-4">
        <DropdownMenu modal={false}>
          <div className="flex h-12 items-center justify-between rounded-xl bg-[#f6f8f7] pl-6 pr-1 text-[15px] font-medium text-ink">
            <span>매칭 프로필 적용 중</span>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="매칭 프로필 메뉴 열기"
                className="group/dots flex size-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-dropdown-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span aria-hidden className="flex size-6 flex-col items-center justify-center gap-[3px]">
                  <span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/dots:bg-ink" />
                  <span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/dots:bg-ink" />
                  <span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/dots:bg-ink" />
                </span>
              </button>
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent
            align="end"
            sideOffset={2}
            className="min-w-0 w-fit rounded-[12px] border-0 bg-surface p-1 shadow-none"
            style={{ boxShadow: "var(--shadow-dropdown)" }}
          >
            <DropdownMenuItem
              onSelect={() =>
                window.dispatchEvent(
                  new CustomEvent("open-matching-profile", {
                    detail: { variant: "programs-explore" },
                  }),
                )
              }
              className="min-h-10 w-auto cursor-pointer px-[14px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-ink"
            >
              매칭 프로필 설정
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SupportCategorySelect
          value={supportCategories}
          onChange={(next) => {
            preferenceTags.clear();
            setPreferenceFeedback(null);
            setSort("deadline");
            setUsesProfileDefault(false);
            setSupportCategories(next);
            if (profile) setSupportFilterSession(profile.id, next);
          }}
        />
        <div
          className="relative z-10 flex h-12 items-center gap-2 overflow-visible rounded-xl border border-field-border bg-white pl-6 pr-1.5"
          onFocus={() => setIsQueryFocused(true)}
          onBlur={(event) => {
            const nextFocused = event.relatedTarget as Node | null;
            if (!nextFocused || !event.currentTarget.contains(nextFocused)) {
              setIsQueryFocused(false);
            }
          }}
        >
          {feedbackForDisplay ? (
            <div
              key={preferenceFeedbackVersion}
              className={`preference-feedback-bubble absolute bottom-[calc(100%-6px)] left-[11px] z-40 w-max max-w-[calc(100%_-_11px)] overflow-visible ${
                feedbackForDisplay.message.length > 60 ? "-translate-y-1" : ""
              } ${
                preferenceFeedbackVersion > 1 ? "preference-feedback-bubble-refresh" : ""
              } ${preferenceFeedbackExiting ? "preference-feedback-bubble-exit" : ""}
              }`}
              data-layer-name="preference-feedback-bubble"
            >
              <div
                role={feedbackForDisplay.tone === "error" ? "alert" : "status"}
                className={`${PREFERENCE_FEEDBACK_BASE_CLASS} ${
                feedbackForDisplay.message.length > 60 ? "rounded-[20px]" : "rounded-full"
              } ${
                feedbackForDisplay.tone === "error"
                  ? "border border-transparent bg-[#FFF3F3] text-[#D84A4A] after:bg-[#FFF3F3]"
                  : "border border-transparent bg-[#E2F8F0] pl-[12px] pr-[12px] text-[#1F8064] after:bg-[#E2F8F0]"
                }`}
              >
                <span className="pointer-events-none absolute -bottom-[8.64px] left-3 z-10 block h-[8.64px] w-[15.84px]">
                  <img
                    aria-hidden
                    src={
                      feedbackForDisplay.tone === "error"
                        ? "/assets/programs/preference-tail-group-8684.svg?v=2"
                        : "/assets/programs/preference-tail-success-8684.svg?v=1"
                    }
                    alt=""
                    className="absolute inset-0 z-10 h-[8.64px] w-[15.84px]"
                  />
                </span>
                {feedbackForDisplay.tone === "error" || feedbackForDisplay.icon === "alert" ? (
                  <span
                    aria-hidden
                    className="relative z-20 mt-0.5 flex size-4 shrink-0 items-center justify-center"
                  >
                    <SquareAlertIcon
                      className={`size-4 ${
                        feedbackForDisplay.tone === "error" ? "text-[#D84A4A]" : "text-[#1F8064]"
                      }`}
                    />
                  </span>
                ) : null}
                <span className="relative z-20 min-w-0 whitespace-normal">{feedbackForDisplay.message}</span>
              </div>
            </div>
          ) : null}
          <input
            ref={preferenceInputRef}
            disabled={isPreferenceSearching}
            value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setPreferenceFeedback(null);
              if (!next.trim()) {
                if (preferenceStorageKey) {
                  window.sessionStorage.removeItem(
                    `${PREFERENCE_COMMITTED_QUERY_STORAGE_PREFIX}${preferenceStorageKey}`,
                  );
                  window.sessionStorage.removeItem(
                    `${PREFERENCE_QUERY_STORAGE_PREFIX}${preferenceStorageKey}`,
                  );
                }
                preferenceTags.clear();
                setIsPreferenceSearching(false);
                setIsSearchLoadingVisible(false);
                if (searchLoadingTimerRef.current) {
                  clearTimeout(searchLoadingTimerRef.current);
                  searchLoadingTimerRef.current = null;
                }
                setSort("deadline");
              }
          }}
            placeholder="선호하는 조건을 입력해 보세요"
            aria-busy={searchLoaderVisible}
            className={`min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-guide-text ${
              searchLoaderVisible ? "text-transparent caret-transparent" : ""
            }`}
          />
          {searchLoaderVisible ? (
            <div
              className="pointer-events-none absolute inset-y-0 left-6 flex items-center"
              aria-live="polite"
              aria-label="검색 중"
            >
              <span className="preference-search-message mr-2 text-[15px] font-medium">
                {showWaitMessage ? "조금만 더 기다려주세요" : "선호조건 반영 중"}
              </span>
              <span className="preference-search-loader" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          ) : null}
          {query.trim() ? (
            <button
              type="button"
              aria-label="전체 삭제"
              title="전체 삭제"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleClearPreferenceSearch}
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-item-hover text-icon-muted transition-colors hover:bg-secondary-btn-hover"
            >
              <X aria-hidden className="size-3" strokeWidth={2.5} />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="조건 검색"
            disabled={!query.trim() || isPreferenceSearching}
            onMouseDown={(event) => {
              event.preventDefault();
              setIsQueryFocused(false);
            }}
            onClick={() => {
              setIsQueryFocused(false);
              setIsPreferenceSearching(true);
              setIsSearchLoadingVisible(false);
              if (searchLoadingTimerRef.current) clearTimeout(searchLoadingTimerRef.current);
              searchLoadingTimerRef.current = setTimeout(() => {
                setIsSearchLoadingVisible(true);
                searchLoadingTimerRef.current = null;
              }, 200);
              const selectedField =
                supportCategories.length === 1 && !supportCategories.includes(SUPPORT_ALL)
                  ? supportCategories[0] ?? null
                  : null;
              const normalizedQuery = query.trim();
              const previousSearch = lastPreferenceSearchRef.current;
              if (
                previousSearch?.query === normalizedQuery &&
                previousSearch.field === selectedField &&
                previousSearch.version === matchDataVersionRef.current
              ) {
                if (searchLoadingTimerRef.current) {
                  clearTimeout(searchLoadingTimerRef.current);
                  searchLoadingTimerRef.current = null;
                }
                setIsSearchLoadingVisible(false);
                setPreferenceFeedbackExiting(false);
                setPreferenceFeedbackVersion((version) => version + 1);
                setPreferenceFeedback({
                  tone: "success",
                  message: "이미 적용된 선호조건이에요.",
                });
                setIsPreferenceSearching(false);
                return;
              }
              submittedPreferenceQueryRef.current = normalizedQuery;
              submittedPreferenceFieldRef.current = selectedField;
              void preferenceTags.search(normalizedQuery, selectedField);
            }}
            className={`ai-search-shimmer flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground transition-[box-shadow,transform,background-color] duration-150 hover:bg-[#3A8F77] active:translate-y-px active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-disabled disabled:text-brand-foreground ${query.trim() ? "ml-1" : ""}`}
          >
            <img draggable={false} src="/assets/programs/ai-search.svg" alt="" className="pointer-events-none select-none size-6" />
          </button>
          {isQueryFocused ? (
            <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border-0 bg-white p-6 shadow-dropdown">
              <p className="mb-3 text-[16px] font-semibold leading-5 text-ink">
                이런 조건은 어때요?
              </p>
              <div className="relative">
                <div
                  ref={preferenceSuggestionsRef}
                  className="flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                {PREFERENCE_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      const currentQuery = query.trim().replace(/,+\s*$/, "");
                      const selectedSuggestions = currentQuery
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean);
                      const nextQuery = selectedSuggestions.includes(suggestion)
                        ? currentQuery
                        : currentQuery
                          ? `${currentQuery}, ${suggestion}`
                          : suggestion;
                      setQuery(nextQuery);
                      preferenceInputRef.current?.focus();
                    }}
                    className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full bg-item-hover px-3 text-sm font-normal text-ink-muted transition-colors hover:bg-secondary-btn-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {suggestion}
                  </button>
                ))}
                </div>
                {canScrollPreferenceSuggestions ? (
                  <button
                    type="button"
                    aria-label="추천 조건 더 보기"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => preferenceSuggestionsRef.current?.scrollBy({ left: 180, behavior: "smooth" })}
                    className="absolute -right-[14px] top-4 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-field-border/20 bg-surface text-icon-muted shadow-chip-arrow transition-colors hover:text-ink"
                  >
                    <ArrowRight aria-hidden className="size-4" strokeWidth={2.25} />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pt-[48px]">
        <div className="relative h-[48px] w-full">
          <ProgramResultsTabs
            selected={tab}
            counts={{
              recommended: activeTotalCount,
              review: reviewTotalCount,
              manual: manualPrograms.length,
            }}
            onChange={handleTabChange}
          />
          <div className="absolute right-0 top-[-1px] flex items-center gap-[6px]">
            <ProgramSortDropdown
              value={sort}
              onChange={setSort}
              preferenceActive={matchedPrograms.some(
                (item) => item.preference_matched === true,
              )}
            />
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="지원사업 더보기"
                  className="flex size-[42px] shrink-0 items-center justify-center rounded-[12px] border border-field-border bg-surface p-0 text-ink shadow-none transition-colors hover:bg-item-hover"
                >
                  <MoreVertical fill="currentColor" className="size-5 stroke-[1.5]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={6}
                className="min-w-0 w-fit rounded-[12px] border-0 bg-surface p-1 shadow-none"
                style={{ boxShadow: "var(--shadow-dropdown)" }}
              >
                <DropdownMenuItem
                  onSelect={handleExcludedOpen}
                  className="min-h-10 w-auto cursor-pointer rounded-[8px] px-[14px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover"
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    제외된 공고 보기
                    <span className="rounded-full bg-item-hover px-2 py-1 text-[12px] font-semibold leading-none text-ink-muted">
                      {excludedCount}
                    </span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div
          className={`${tab === "manual" || tab === "review" || (!currentLoading && !currentError && results.length === 0) ? "mt-[18px]" : "mt-1"} overflow-hidden rounded-sm`}
        >
          {currentLoading ? (
            <p className="bg-white px-8 py-16 text-center text-ink-muted">
              {tab === "review" ? "추가 검토 공고를 불러오는 중입니다." : "맞춤 공고를 불러오는 중입니다."}
            </p>
          ) : currentError ? (
            <p className="bg-white px-8 py-16 text-center text-ink-muted">{currentError}</p>
          ) : results.length ? (
            results.map((program) => (
              <ProgramResultRow
                key={program.id}
                program={program}
                onReportClick={setReportTarget}
                onFavoriteToggle={handleFavoriteToggle}
                favoriteSaving={savingNoticeIds.has(program.id)}
              />
            ))
          ) : (
            tab === "manual" ? (
              <div className="rounded-[12px] bg-transparent px-6 py-16 text-center">
                <p className="text-[18px] font-semibold text-ink">수동 공고가 없어요</p>
                <p className="mt-[2px] text-[15px] text-ink-muted">
                  직접 확인하고 싶은 지원사업 공고를 추가해 관리해 보세요.
                </p>
                <button
                  type="button"
                  onClick={() => setManualFormOpen(true)}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#F2F7F4] px-4 text-[14px] font-semibold text-brand shadow-none transition-colors hover:bg-[#EAF1EC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  수동 공고 추가
                </button>
              </div>
            ) : (
              tab === "review" ? (
                <div className="rounded-[12px] bg-transparent px-6 py-16 text-center">
                  <p className="text-[18px] font-semibold text-ink">추가 검토가 필요한 공고가 없어요</p>
                  <p className="mt-[2px] text-[15px] text-ink-muted">
                    기존 공고에 변경 사항이 생기면 이곳에서 확인할 수 있어요.
                  </p>
                </div>
              ) : (
                <div className="rounded-[12px] bg-transparent px-6 py-16 text-center">
                  <p className="text-[18px] font-semibold text-ink">조건에 맞는 공고가 없어요</p>
                  <p className="mt-[2px] text-[15px] text-ink-muted">
                    매칭 프로필을 수정하거나 다른 지원 분야를 선택해보세요.
                  </p>
                </div>
              )
            )
          )}
        </div>

        {excludedOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay backdrop-blur-[2px] p-4"
              onClick={() => setExcludedOpen(false)}
            >
              <div
                className="flex max-h-[calc(100vh-32px)] w-[900px] max-w-full flex-col overflow-hidden rounded-[16px] bg-surface shadow-dropdown"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-8">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[18px] font-semibold text-ink">제외된 공고</h2>
                    <span className="flex size-6 items-center justify-center rounded-full bg-item-hover text-[14px] font-semibold leading-none text-ink-muted">
                      {excludedCount}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="제외된 공고 닫기"
                    onClick={() => setExcludedOpen(false)}
                    className="flex size-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-item-hover hover:text-ink"
                  >
                    <X className="size-6" />
                  </button>
                </div>
                <div className="min-h-0 overflow-y-auto pb-[10px]">
                  {isLoadingExcluded ? (
                    <p className="px-8 py-16 text-center text-ink-muted">제외된 공고를 불러오는 중입니다.</p>
                  ) : excludedError ? (
                    <p className="px-8 py-16 text-center text-ink-muted">{excludedError}</p>
                  ) : excludedPrograms.length ? (
                    excludedPrograms.map((program) => <ExcludedProgramRow key={program.id} program={program} />)
                  ) : (
                    <p className="px-8 py-16 text-center text-ink-muted">제외된 공고가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}

        <ProgramReportDialog
          open={Boolean(reportTarget)}
          onOpenChange={(open) => {
            if (!open) setReportTarget(null);
          }}
          noticeId={reportTarget?.id ?? null}
          noticeTitle={reportTarget?.title ?? null}
        />
        <ProgramFormDialog
          open={manualFormOpen}
          onOpenChange={setManualFormOpen}
          program={null}
          saving={manualSaving}
          onSubmit={handleManualSubmit}
        />
        {tabTotalCount > 0 && (
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        )}
      </div>
    </section>
  );
}
