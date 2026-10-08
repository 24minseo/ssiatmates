import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { MatchedProgram } from "@/mocks/programSearchMock";
import { ProgramReportDialog } from "@/components/programs/ProgramReportDialog";
import { ProgramResultRow } from "@/components/programs/ProgramResultRow";
import { getHomeRecommendedNotices, type HomeNoticeItem } from "@/services/homeNoticeFeed";
import { savedNoticesApi } from "@/services/savedNoticesApi";

export const Route = createFileRoute("/myhome")({
  head: () => ({ meta: [{ title: "MY홈" }] }),
  component: MyHomePage,
});

export type MyHomeSummary = {
  todayNews: {
    total: number;
    newMatches: number;
    myProgramChanges: number;
  };
  recommendedPrograms: {
    total: number;
  };
  reviewPrograms: {
    total: number;
  };
  myPrograms: {
    total: number;
    beforeStart: number;
    preparing: number;
    submitted: number;
  };
};

/** Replace this mock with the summary response returned by the home API. */
const myHomeSummary: MyHomeSummary = {
  todayNews: { total: 122, newMatches: 1, myProgramChanges: 6 },
  recommendedPrograms: { total: 12 },
  reviewPrograms: { total: 0 },
  myPrograms: { total: 3, beforeStart: 0, preparing: 2, submitted: 1 },
};

const summaryCards = (summary: MyHomeSummary) =>
  [
    {
      label: "오늘의 새 소식",
      value: summary.todayNews.total,
      description: `신규 매칭 ${summary.todayNews.newMatches}건 · 내 지원사업 변동 ${summary.todayNews.myProgramChanges}건`,
      featured: true,
      href: "/programs" as const,
    },
    {
      label: "맞춤 공고",
      value: summary.recommendedPrograms.total,
      description: "지원할 공고를 선택해보세요.",
      featured: false,
      href: "/programs" as const,
    },
    {
      label: "추가 검토 필요",
      value: summary.reviewPrograms.total,
      description:
        summary.reviewPrograms.total === 0
          ? "조건 확인이 필요한 공고가 없어요."
          : "조건 확인이 필요한 공고가 있어요.",
      featured: false,
      href: "/programs" as const,
    },
    {
      label: "내 지원사업",
      value: summary.myPrograms.total,
      description: `시작 전 ${summary.myPrograms.beforeStart}건 · 준비 중 ${summary.myPrograms.preparing}건 · 제출 완료 ${summary.myPrograms.submitted}건`,
      featured: false,
      href: "/my-programs" as const,
    },
  ] as const;

function RollingNumber({ value }: { value: number }) {
  const [started, setStarted] = useState(false);
  const [compactOnes, setCompactOnes] = useState(false);
  const digits = String(value).split("").map(Number);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStarted(true);
      setCompactOnes(true);
      return;
    }
    const frameId = requestAnimationFrame(() => {
      setStarted(true);
      setCompactOnes(true);
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <span
      className="inline-flex h-[1.16em] overflow-hidden align-baseline leading-[1.16] tabular-nums"
      aria-label={String(value)}
    >
      {digits.map((digit, digitIndex) => (
        <span
          key={`${digitIndex}-${digit}`}
          className={`inline-flex h-[1.16em] justify-center overflow-hidden transition-[width] duration-500 ease-in-out motion-reduce:transition-none ${digit === 1 && compactOnes ? "w-6" : "w-7"}`}
        >
          <span
            aria-hidden="true"
            className="flex flex-col leading-[1.16] transition-transform duration-500 ease-in-out motion-reduce:transition-none"
            style={{
              transform: `translateY(${started ? `-${digit * 1.16}em` : "0em"})`,
              transitionDelay: digits.length > 1 ? `${digitIndex * 20}ms` : "0ms",
            }}
          >
            {Array.from({ length: 10 }, (_, index) => (
              <span key={index} className="flex h-[1.16em] shrink-0 items-center leading-[1.16]">
                {index}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

type HomeProgramTab = "newMatches" | "myProgramChanges";

// Temporary preview flag for the new-matches empty state illustration.
const previewNewMatchesEmptyState = true;

const myProgramChangeItems: MatchedProgram[] = [
  {
    id: "my-program-change-1",
    organization: "(사)한국중소기업발전협회",
    title: "2026년 특허출원·등록 비용 바우처 지원사업 14차(하반기 7차)",
    categories: ["사업화", "전국"],
    dDay: "D-9",
    deadline: "~10.16(금)",
    matchLabel: "리포트 보기 〉",
    changeReason: "마감일 연장",
    changeDetail: "10.9(금) → 10.16(금)로 변경됐어요",
    changeTone: "neutral",
    type: "default",
  },
  {
    id: "my-program-change-2",
    organization: "창업진흥원",
    title: "2026년 초기창업패키지 예비창업자 모집 공고",
    categories: ["사업화", "전국"],
    dDay: "D-3",
    deadline: "~10.10(토)",
    matchLabel: "리포트 보기 〉",
    changeReason: "일정 변경",
    changeDetail: "접수 마감이 10.14(수)로 단축됐어요",
    changeTone: "danger",
    type: "default",
  },
  {
    id: "my-program-change-3",
    organization: "중소벤처기업부",
    title: "2026년 소상공인 온라인 판로 지원사업",
    categories: ["판로·마케팅", "전국"],
    dDay: "D-18",
    deadline: "~10.25(일)",
    matchLabel: "리포트 보기 〉",
    changeReason: "공고 수정",
    changeDetail: "지원 자격이 업력 3년 이하로 변경됐어요",
    changeTone: "neutral",
    type: "default",
  },
  {
    id: "my-program-change-4",
    organization: "서울창업허브",
    title: "2026 서울 스타트업 액셀러레이팅 프로그램",
    categories: ["멘토링·컨설팅·교육", "서울"],
    dDay: "D-21",
    deadline: "~10.28(수)",
    matchLabel: "리포트 보기 〉",
    changeReason: "모집 취소",
    changeDetail: "이번 모집이 취소됐어요",
    changeTone: "danger",
    type: "default",
  },
  {
    id: "my-program-change-5",
    organization: "경기창조경제혁신센터",
    title: "2026 경기 스타트업 성장지원 프로그램",
    categories: ["사업화", "경기"],
    dDay: "D-27",
    deadline: "~11.03(화)",
    matchLabel: "리포트 보기 〉",
    changeReason: "추가 모집·일정",
    changeDetail: "추가 모집과 사업 설명회 일정이 등록됐어요",
    changeTone: "neutral",
    type: "default",
  },
  {
    id: "my-program-change-6",
    organization: "서울창업허브",
    title: "2026 서울 창업기업 판로개척 지원사업",
    categories: ["판로·마케팅", "서울"],
    dDay: "D-2",
    deadline: "~10.10(토)",
    matchLabel: "리포트 보기 〉",
    changeReason: "모집 조기 종료",
    changeDetail: "접수가 예정일보다 일찍 종료됐어요",
    changeTone: "danger",
    type: "default",
  },
];

function MyHomeProgramTabs({
  selected,
  counts,
  onChange,
}: {
  selected: HomeProgramTab;
  counts: Record<HomeProgramTab, number>;
  onChange: (value: HomeProgramTab) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<HomeProgramTab, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const tabs: Array<{ value: HomeProgramTab; label: string }> = [
    { value: "newMatches", label: "신규 매칭" },
    { value: "myProgramChanges", label: "내 지원사업 변동" },
  ];

  useLayoutEffect(() => {
    const root = rootRef.current;
    const updateIndicator = () => {
      const tab = tabRefs.current[selected];
      if (!root || !tab) return;
      const rootRect = root.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      setIndicator({
        left: tabRect.left - rootRect.left + 12,
        width: Math.max(0, tabRect.width - 24),
      });
    };
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [selected, counts.newMatches, counts.myProgramChanges]);

  return (
    <div
      ref={rootRef}
      className="relative h-[48px] w-[1200px] shrink-0"
      role="tablist"
      aria-label="지원사업 목록"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-[47px] h-px w-[1208px] bg-field-border"
      />
      <div className="absolute left-[-12px] top-0 flex items-start gap-[10px]">
        {tabs.map((tab) => {
          const isSelected = selected === tab.value;
          return (
            <button
              key={tab.value}
              ref={(node) => {
                tabRefs.current[tab.value] = node;
              }}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onChange(tab.value)}
              className="flex h-[48px] w-max shrink-0 flex-col items-start gap-[5px] rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center gap-[6px] overflow-hidden rounded-[10px] py-2 pl-3 pr-1.5 text-[18px] whitespace-nowrap",
                  isSelected
                    ? "font-semibold text-brand hover:bg-[rgba(234,241,236,0.5)]"
                    : "font-normal text-ink-muted hover:bg-item-hover",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-[13px] px-[7px] py-1 text-[14px] font-medium",
                    isSelected ? "bg-[#f4f8f5] text-brand" : "bg-item-hover text-ink-muted",
                  )}
                >
                  {counts[tab.value]}
                </span>
              </span>
              <span aria-hidden className="h-[3px] w-full px-3 opacity-0" />
            </button>
          );
        })}
      </div>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-[45px] h-[3px] bg-brand transition-[left,width] duration-200 ease-out",
          indicator ? "opacity-100" : "opacity-0",
        )}
        style={indicator ?? undefined}
      />
    </div>
  );
}

function MyHomePage() {
  const [recommendedNotices, setRecommendedNotices] = useState<HomeNoticeItem[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState(false);
  const [homeProgramTab, setHomeProgramTab] = useState<HomeProgramTab>("newMatches");
  const [savedNoticeIds, setSavedNoticeIds] = useState<Set<string>>(() => new Set());
  const [savingNoticeIds, setSavingNoticeIds] = useState<Set<string>>(() => new Set());
  const [reportTarget, setReportTarget] = useState<MatchedProgram | null>(null);

  useEffect(() => {
    let active = true;
    void getHomeRecommendedNotices()
      .then(({ items }) => {
        if (!active) return;
        setRecommendedNotices(items);
        setRecommendationsError(false);
      })
      .catch(() => {
        if (!active) return;
        setRecommendedNotices([]);
        setRecommendationsError(true);
      })
      .finally(() => {
        if (active) setRecommendationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void savedNoticesApi
      .getSavedStates()
      .then(({ items }) => {
        if (active) setSavedNoticeIds(new Set(items.map((item) => item.notice_id)));
      })
      .catch(() => {
        if (active) setSavedNoticeIds(new Set());
      });
    return () => {
      active = false;
    };
  }, []);

  const handleFavoriteToggle = async (program: MatchedProgram) => {
    if (savingNoticeIds.has(program.id)) return;
    const nextSaved = !savedNoticeIds.has(program.id);
    setSavingNoticeIds((current) => new Set(current).add(program.id));
    setSavedNoticeIds((current) => {
      const next = new Set(current);
      if (nextSaved) next.add(program.id);
      else next.delete(program.id);
      return next;
    });
    try {
      await savedNoticesApi.setSaved(program.id, nextSaved);
    } catch {
      setSavedNoticeIds((current) => {
        const next = new Set(current);
        if (nextSaved) next.delete(program.id);
        else next.add(program.id);
        return next;
      });
    } finally {
      setSavingNoticeIds((current) => {
        const next = new Set(current);
        next.delete(program.id);
        return next;
      });
    }
  };

  const newMatchItems: MatchedProgram[] = recommendedNotices
    .slice(0, myHomeSummary.todayNews.newMatches)
    .map((notice) => ({
      id: notice.id,
      ...(notice.url ? { url: notice.url } : {}),
      organization: notice.organization,
      title: notice.title,
      categories: notice.categories,
      dDay: notice.dDay,
      deadline: notice.deadline,
      is_saved: savedNoticeIds.has(notice.id),
      ...(notice.reportAvailable ? { matchLabel: "리포트 보기 〉" } : {}),
      type: "recommended",
    }));
  const tabPrograms =
    homeProgramTab === "newMatches"
      ? previewNewMatchesEmptyState
        ? []
        : newMatchItems
      : myProgramChangeItems;
  const visiblePrograms = tabPrograms;
  return (
    <>
      <header>
        <h1 className="text-[28px] font-bold leading-tight text-ink">MY홈</h1>
        <p className="mt-px text-base font-medium text-ink-muted">한눈에 보는 지원사업 브리핑</p>
      </header>

      <section aria-label="지원사업 요약" className="mt-[41px] grid grid-cols-4 gap-4">
        {summaryCards(myHomeSummary).map((card) => {
          const cardClassName = `relative overflow-hidden rounded-[12px] p-5 ${
            card.featured
              ? "today-news-card h-[158px] cursor-default text-white"
              : "min-h-[146px] cursor-pointer bg-item-hover text-ink shadow-none transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:bg-surface hover:ring-1 hover:ring-item-hover hover:shadow-[0_8px_30px_0_rgba(0,13,59,0.1)] motion-reduce:transition-none"
          }`;
          const cardContent = (
            <>
              {card.featured ? (
                <>
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-[12px] bg-white shadow-[inset_0px_0px_1px_0px_#d7ffe2,inset_0px_0px_2px_0px_#a2dece]"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-[12px] shadow-[inset_0px_0px_33.4px_-7px_#1f8064,inset_0px_0px_1px_0px_#d7ffe2,inset_0px_0px_2px_0px_#a2dece]"
                    style={{
                      backgroundImage:
                        "linear-gradient(270deg, #1f8064 0%, #005d44 5.7692%, #1f8064 94.231%, rgba(0, 255, 174, 0) 100%)",
                    }}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-[12px] bg-[rgba(100,255,199,0.2)] backdrop-blur-[25px] shadow-[inset_0px_2px_6px_0px_rgba(149,255,236,0.25),inset_0px_0px_1px_0px_#d7ffe2,inset_0px_0px_2px_0px_#a2dece]"
                  />
                  <div aria-hidden className="today-news-background-glow" />
                </>
              ) : null}
              <div className="absolute inset-0 z-10">
                <h2
                  className={`${
                    card.featured
                      ? "absolute left-[22px] top-[21px] text-[18px] font-medium leading-[1.16] text-[#d7f5ea]"
                      : "absolute left-[22px] top-[21px] text-[18px] font-normal leading-[1.16] text-[#6f8179]"
                  }`}
                >
                  {card.label}
                </h2>
                <div
                  className={`${
                    card.featured
                      ? "absolute left-[22px] top-[66px] flex items-end gap-1 text-[48px] font-medium leading-[1.16] text-[#d7f5ea]"
                      : "absolute left-[22px] top-[66px] flex items-end gap-1 text-[48px] font-medium leading-[1.16] text-brand"
                  }`}
                >
                  <RollingNumber value={card.value} />
                  <span
                    className={`${
                      card.featured
                        ? "relative top-[1px] inline-block pb-2 text-[24px] font-medium leading-[1.16]"
                        : "relative top-[1px] inline-block pb-2 text-[24px] font-medium leading-[1.16]"
                    }`}
                  >
                    건
                  </span>
                </div>
                <p
                  className={`${
                    card.featured
                      ? "absolute left-[22px] top-[122px] text-[13px] font-normal leading-[1.16] text-[#d7f5ea]"
                      : "absolute left-[22px] top-[122px] text-[13px] font-normal leading-[1.16] text-icon-muted"
                  }`}
                >
                  {card.description}
                </p>
              </div>
            </>
          );

          return card.featured ? (
            <article key={card.label} className={cardClassName}>
              {cardContent}
            </article>
          ) : (
            <Link
              key={card.label}
              to={card.href}
              search={card.label === "추가 검토 필요" ? { tab: "review" } : {}}
              aria-label={`${card.label} 페이지로 이동`}
              className={cardClassName}
            >
              {cardContent}
            </Link>
          );
        })}
      </section>

      <section className="mt-14">
        <MyHomeProgramTabs
          selected={homeProgramTab}
          counts={{
            newMatches: previewNewMatchesEmptyState ? 0 : myHomeSummary.todayNews.newMatches,
            myProgramChanges: myHomeSummary.todayNews.myProgramChanges,
          }}
          onChange={(tab) => {
            setHomeProgramTab(tab);
          }}
        />
        {homeProgramTab === "newMatches" && recommendationsLoading ? (
          <div
            className="flex min-h-[260px] items-center justify-center border-b border-field-border text-[14px] text-ink-muted"
            role="status"
          >
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            불러오는 중…
          </div>
        ) : visiblePrograms.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            {homeProgramTab === "newMatches" && !recommendationsError ? (
              <img
                src="/assets/empty/home-new-match.svg"
                alt=""
                aria-hidden
                className="mb-2 h-auto w-[150px] saturate-[0.1]"
              />
            ) : null}
            <p className="text-[18px] font-semibold text-ink">
              {homeProgramTab === "newMatches"
                ? recommendationsError
                  ? "신규 매칭을 불러오지 못했어요"
                  : "새로 매칭된 공고가 없어요"
                : myHomeSummary.myPrograms.total === 0
                  ? "아직 담은 지원사업이 없어요"
                  : "변동된 지원사업이 없어요"}
            </p>
            <p className="mt-[2px] text-[15px] text-ink-muted">
              {homeProgramTab === "newMatches"
                ? "내 조건에 맞는 새 공고가 등록되면 여기에서 알려드릴게요."
                : myHomeSummary.myPrograms.total === 0
                  ? "관심 있는 공고를 담으면 변동 사항을 알려드릴게요."
                  : "내 지원사업에 변동이 생기면 여기에서 알려드릴게요."}
            </p>
            {homeProgramTab === "newMatches" || myHomeSummary.myPrograms.total === 0 ? (
              <Link
                to="/programs"
                className="mt-5 inline-flex h-11 items-center rounded-[10px] bg-[#F2F7F4] px-5 text-[15px] font-semibold text-brand shadow-none transition-colors hover:bg-[#EAF1EC]"
              >
                지원사업 탐색하기
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="mt-1 overflow-hidden [&>article:last-child]:border-b-0">
            {visiblePrograms.map((program) => (
              <ProgramResultRow
                key={program.id}
                program={program}
                onReportClick={setReportTarget}
                onFavoriteToggle={handleFavoriteToggle}
                favoriteSaving={savingNoticeIds.has(program.id)}
              />
            ))}
          </div>
        )}
      </section>
      <ProgramReportDialog
        open={Boolean(reportTarget)}
        onOpenChange={(open) => {
          if (!open) setReportTarget(null);
        }}
        noticeId={reportTarget?.id ?? null}
        noticeTitle={reportTarget?.title ?? null}
      />
    </>
  );
}
