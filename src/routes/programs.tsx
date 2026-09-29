import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, MoreVertical, X } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { Pagination } from "@/components/ui/pagination";
import { ProgramSortDropdown, type ProgramSortOption } from "@/components/my-programs/ProgramSortDropdown";
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

const PAGE_SIZE = 20;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const NATIONWIDE_REGIONS = new Set([
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
]);

type NoticeMatchItem = {
  notice_id: string;
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

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "";
  const date = new Date(`${deadline}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return deadline;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `~${month}.${day}(${WEEKDAYS[date.getDay()]})`;
}

function formatRegion(region: string | null): string | null {
  if (!region?.trim()) return null;
  const regions = region
    .split(",")
    .map((value) => value.trim())
    .flatMap((value) => (value === "전남광주" ? ["전남", "광주"] : [value]));
  const uniqueRegions = new Set(regions);
  return uniqueRegions.size === NATIONWIDE_REGIONS.size &&
    [...NATIONWIDE_REGIONS].every((value) => uniqueRegions.has(value))
    ? "전국"
    : region.trim();
}

function toMatchedProgram(item: NoticeMatchItem): MatchedProgram {
  const categories = [item.field, formatRegion(item.region)]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim())
    .filter((value) => value.length <= 20);
  const rawDDay = item.deadline_label ?? item.status_label ?? "";
  const dDay = rawDDay === "일정 확인 필요" ? "-" : rawDDay;

  return {
    id: item.notice_id,
    ...(item.url ? { url: item.url } : {}),
    organization: item.organization,
    title: item.title,
    categories,
    dDay,
    deadline: formatDeadline(item.deadline) || (rawDDay === "일정 확인 필요" ? "공고 원문 확인" : ""),
    daysUntilDeadline: item.days_until_deadline,
    // 리포트가 아직 준비되지 않은 공고도 버튼에서 준비 상태를 안내한다.
    matchLabel: "리포트 보기 〉",
    // `recommendation_only` only identifies the current-match source. It is
    // not the profile-condition result, so keep the default row variant until
    // the dedicated preference-match result is available.
    type: "default",
  };
}

export const Route = createFileRoute("/programs")({
  head: () => ({ meta: [{ title: "지원사업 탐색" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: ProgramResultsTab } =>
    search["tab"] === "review" ? { tab: "review" } : {},
  component: ProgramsPage,
});

type MatchingView = "active" | "excluded";

async function loadMatchingNotices(
  view: MatchingView,
  selectedField: string | null,
  offset = 0,
): Promise<NoticeMatchesResponse> {
  if (view !== "active" && view !== "excluded") {
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
    : "get_my_notice_matches_v1";

  if (view === "active") {
    params.p_include_closed = false;
  }

  const { data, error } = await supabase.rpc(rpc, params);
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
        <p className="text-[13px] leading-[21px] text-ink-muted">{program.organization}</p>
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
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {program.categories.map((category) => (
            <span
              key={category}
              className="rounded bg-[#f5f5f5] px-[7px] py-1 text-xs font-medium text-ink-muted"
            >
              {category}
            </span>
          ))}
        </div>
      </div>
      <div className="relative h-[86px] w-[110px] shrink-0">
        <p className="absolute left-0 top-[25.5px] text-[20px] font-bold leading-[26px] text-ink">
          {program.dDay}
        </p>
        <p className="absolute left-0 top-[56px] text-[13px] leading-5 text-ink-muted">
          {program.deadline}
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-[10px] px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-item-hover"
      >
        복원
      </button>
    </article>
  );
}

function ProgramsPage() {
  const { session, profile } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProgramSortOption>("deadline");
  const [tab, setTab] = useState<ProgramResultsTab>(search["tab"] ?? "recommended");
  const [page, setPage] = useState(1);
  const [supportCategories, setSupportCategories] = useState<string[]>([SUPPORT_ALL]);
  const [usesProfileDefault, setUsesProfileDefault] = useState(true);
  const profileFilterInitializedFor = useRef<string | null>(null);
  const matchingRequestRef = useRef(0);
  const excludedRequestRef = useRef(0);
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [matchedPrograms, setMatchedPrograms] = useState<MatchedProgram[]>([]);
  const [activeTotalCount, setActiveTotalCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [excludedPrograms, setExcludedPrograms] = useState<MatchedProgram[]>([]);
  const [isLoadingExcluded, setIsLoadingExcluded] = useState(false);
  const [excludedError, setExcludedError] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<MatchedProgram | null>(null);

  useEffect(() => {
    if (!profile || profileFilterInitializedFor.current === profile.id) return;

    const savedCategories = getSupportFilterSession(profile.id);
    const profileCategories = profile.support_categories.filter(Boolean);
    setUsesProfileDefault(savedCategories === null);
    setSupportCategories(
      savedCategories ?? (profileCategories.length ? profileCategories : [SUPPORT_ALL]),
    );
    profileFilterInitializedFor.current = profile.id;
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    async function loadMatches() {
      if (!session?.user.id) {
        setMatchedPrograms([]);
        setActiveTotalCount(0);
        setExcludedCount(0);
        setIsLoadingMatches(false);
        return;
      }
      if (!profileFilterInitializedFor.current) return;

      const requestId = matchingRequestRef.current + 1;
      matchingRequestRef.current = requestId;

      setIsLoadingMatches(true);
      setMatchError(null);

      try {
        const fields = getSelectedFields(supportCategories, usesProfileDefault);
        const offset = (page - 1) * PAGE_SIZE;
        const responses = await Promise.all(
          fields.map((field) => loadMatchingNotices("active", field, offset)),
        );

        if (cancelled || matchingRequestRef.current !== requestId) return;

        const uniqueItems = new Map<string, NoticeMatchItem>();
        responses.forEach((response) => {
          response.items.forEach((item) => uniqueItems.set(item.notice_id, item));
        });

        setMatchedPrograms(Array.from(uniqueItems.values()).map(toMatchedProgram));
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
      } catch (error) {
        if (cancelled || matchingRequestRef.current !== requestId) return;
        console.error("[programs] 맞춤 공고 조회 실패", error);
        setMatchError("맞춤 공고를 불러오지 못했습니다.");
        setMatchedPrograms([]);
        setActiveTotalCount(0);
        setExcludedCount(0);
      } finally {
        if (!cancelled && matchingRequestRef.current === requestId) {
          setIsLoadingMatches(false);
        }
      }
    }

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void loadMatches();
    };

    void loadMatches();
    const interval = window.setInterval(refreshIfVisible, 60_000);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
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
  ]);

  const loadExcludedNotices = async () => {
    if (!session?.user.id) return;

    const requestId = excludedRequestRef.current + 1;
    excludedRequestRef.current = requestId;
    setIsLoadingExcluded(true);
    setExcludedError(null);

    try {
      const fields = getSelectedFields(supportCategories, usesProfileDefault);
      const responses = await Promise.all(
        fields.map((field) => loadMatchingNotices("excluded", field, 0)),
      );

      if (excludedRequestRef.current !== requestId) return;

      const uniqueItems = new Map<string, NoticeMatchItem>();
      responses.forEach((response) => {
        response.items.forEach((item) => uniqueItems.set(item.notice_id, item));
      });

      setExcludedPrograms(Array.from(uniqueItems.values()).map(toMatchedProgram));
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

  const resultsByTab = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filterAndSort = (items: MatchedProgram[]) => {
      const filtered = items.filter((item) => {
        const matchesQuery =
          !normalizedQuery ||
          [item.title, item.organization, ...item.categories]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesCategory =
          supportCategories.includes(SUPPORT_ALL) ||
          item.categories.some((category) => supportCategories.includes(category));
        return matchesQuery && matchesCategory;
      });

      return [...filtered].sort((a, b) => {
        if (sort === "deadline") {
          const aDays = a.daysUntilDeadline ?? Number.POSITIVE_INFINITY;
          const bDays = b.daysUntilDeadline ?? Number.POSITIVE_INFINITY;
          return aDays - bDays;
        }
        return sort === "fit"
          ? Number(b.type === "recommended") - Number(a.type === "recommended")
          : 0;
      });
    };

    return {
      recommended: filterAndSort(matchedPrograms),
      review: [],
    };
  }, [matchedPrograms, query, sort, supportCategories]);

  useEffect(() => {
    setPage(1);
  }, [query, sort, tab, supportCategories]);

  useEffect(() => {
    setTab(search["tab"] ?? "recommended");
  }, [search]);

  const results = resultsByTab[tab];
  const pageCount = Math.max(1, Math.ceil(Math.max(activeTotalCount, results.length) / PAGE_SIZE));
  const handleTabChange = (nextTab: ProgramResultsTab) => {
    setTab(nextTab);
    void navigate({ search: nextTab === "review" ? { tab: "review" } : {} });
  };

  return (
    <section className="space-y-[18px]">
      <h1 className="text-[28px] font-bold leading-normal text-ink">지원사업 탐색</h1>
      <div className="grid grid-cols-[290px_290px_minmax(0,1fr)] gap-4">
        <div className="flex h-12 items-center justify-between rounded-xl bg-[#f6f8f7] pl-6 pr-4 text-[15px] font-medium text-ink">
          기본 프로필 적용 중
          <span aria-hidden className="flex size-6 flex-col items-center justify-center gap-[3px]">
            <span className="size-[2px] rounded-full bg-[#84968E]" />
            <span className="size-[2px] rounded-full bg-[#84968E]" />
            <span className="size-[2px] rounded-full bg-[#84968E]" />
          </span>
        </div>
        <SupportCategorySelect
          value={supportCategories}
          onChange={(next) => {
            setUsesProfileDefault(false);
            setSupportCategories(next);
            if (profile) setSupportFilterSession(profile.id, next);
          }}
        />
        <div className="flex h-12 items-center gap-2 rounded-xl border border-field-border pl-6 pr-1.5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="선호하는 조건을 입력해 보세요"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-guide-text"
          />
          <button
            type="button"
            aria-label="조건 검색"
            disabled={!query.trim()}
            className="ai-search-shimmer flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground transition-[box-shadow,transform,background-color] duration-150 hover:bg-[#3A8F77] active:translate-y-px active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-disabled disabled:text-brand-foreground"
          >
            <img draggable={false} src="/assets/programs/ai-search.svg" alt="" className="pointer-events-none select-none size-6" />
          </button>
        </div>
      </div>

      <div className="pt-[48px]">
        <div className="relative h-[48px] w-full">
          <ProgramResultsTabs
            selected={tab}
            counts={{ recommended: activeTotalCount, review: resultsByTab.review.length }}
            onChange={handleTabChange}
          />
          <div className="absolute right-0 top-[-1px] flex items-center gap-[6px]">
            <ProgramSortDropdown value={sort} onChange={setSort} />
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="지원사업 더보기"
                  className="flex size-[42px] shrink-0 items-center justify-center rounded-[12px] border border-field-border bg-surface p-0 text-ink shadow-none transition-colors hover:bg-item-hover"
                >
                  <MoreVertical className="size-5 stroke-[1.5]" />
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

        <div className="mt-1 overflow-hidden rounded-sm">
          {isLoadingMatches ? (
            <p className="bg-white px-8 py-16 text-center text-ink-muted">맞춤 공고를 불러오는 중입니다.</p>
          ) : matchError ? (
            <p className="bg-white px-8 py-16 text-center text-ink-muted">{matchError}</p>
          ) : results.length ? (
            results.map((program) => (
              <ProgramResultRow key={program.id} program={program} onReportClick={setReportTarget} />
            ))
          ) : (
            <p className="bg-white px-8 py-16 text-center text-ink-muted">
              {tab === "review" ? "추가 검토가 필요한 지원사업이 없습니다." : "조건에 맞는 지원사업이 없습니다."}
            </p>
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
        {activeTotalCount > 0 && (
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        )}
      </div>
    </section>
  );
}
