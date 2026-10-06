import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/calendar/growth-journal")({
  head: () => ({ meta: [{ title: "성장일지" }] }),
  component: GrowthJournalPage,
});

const journalMockEntries = [
  {
    month: "2026년 10월",
    date: "5일",
    title: "멘토링 이후 서비스 방향 정리",
    body: "멘토링에서 받은 피드백을 바탕으로 서비스의 핵심 가치와 사용자가 가장 먼저 마주하는 경험을 다시 정리했다. 첫 화면에서 전달해야 할 메시지와 기능의 우선순위를 구체화하고, 다음 회의에서 확인할 사용자 반응과 수정 방향까지 함께 기록해두었다.",
    tag: "멘토링",
    imageCount: 3,
  },
  {
    month: "2026년 10월",
    date: "2일",
    title: "지원사업 공고 비교 및 신청 조건 확인",
    body: "여러 공고의 지원 대상과 제출 서류를 비교하고, 우리 팀에 맞는 신청 조건을 정리했다. 마감일과 준비해야 할 자료를 다시 확인해 다음 주 안에 신청할 공고를 골랐고, 담당 기관에 문의할 내용도 별도로 정리해두었다.",
    tag: "지원사업",
  },
  {
    month: "2026년 9월",
    date: "28일",
    title: "초기 사용자 인터뷰 질문 개선",
    body: "첫 인터뷰에서 놓쳤던 질문을 보완하고 다음 대화에서 확인할 가설을 구체화했다. 사용자가 실제로 불편을 느끼는 순간을 더 정확히 이해할 수 있도록 질문 순서를 다시 구성하고, 답변을 비교할 수 있는 기준도 함께 만들었다.",
    tag: "고객 검증",
  },
  {
    month: "2026년 8월",
    date: "19일",
    title: "멘토링 이후 서비스 방향 정리",
    body: "멘토링에서 받은 피드백을 바탕으로 서비스의 핵심 가치와 사용자가 가장 먼저 마주하는 경험을 다시 정리했다. 첫 화면에서 전달해야 할 메시지와 기능의 우선순위를 구체화하고, 다음 회의에서 확인할 사용자 반응과 수정 방향까지 함께 기록해두었다.",
    tag: "멘토링",
    imageCount: 3,
  },
  {
    month: "2026년 7월",
    date: "11일",
    title: "지원사업 공고 비교 및 신청 조건 확인",
    body: "여러 공고의 지원 대상과 제출 서류를 비교하고, 우리 팀에 맞는 신청 조건을 정리했다. 마감일과 준비해야 할 자료를 다시 확인해 다음 주 안에 신청할 공고를 골랐고, 담당 기관에 문의할 내용도 별도로 정리해두었다.",
    tag: "지원사업",
  },
  {
    month: "2026년 6월",
    date: "24일",
    title: "초기 사용자 인터뷰 질문 개선",
    body: "첫 인터뷰에서 놓쳤던 질문을 보완하고 다음 대화에서 확인할 가설을 구체화했다. 사용자가 실제로 불편을 느끼는 순간을 더 정확히 이해할 수 있도록 질문 순서를 다시 구성하고, 답변을 비교할 수 있는 기준도 함께 만들었다.",
    tag: "고객 검증",
  },
  {
    month: "2026년 5월",
    date: "8일",
    title: "멘토링 이후 서비스 방향 정리",
    body: "멘토링에서 받은 피드백을 바탕으로 서비스의 핵심 가치와 사용자가 가장 먼저 마주하는 경험을 다시 정리했다. 첫 화면에서 전달해야 할 메시지와 기능의 우선순위를 구체화하고, 다음 회의에서 확인할 사용자 반응과 수정 방향까지 함께 기록해두었다.",
    tag: "멘토링",
    imageCount: 3,
  },
];

type JournalEntry = (typeof journalMockEntries)[number] & {
  id?: string;
  diaryDate?: string;
  image_paths?: string[];
  tags?: string[];
};

function mapDiaryRow(row: {
  id: string;
  diary_date: string;
  title: string;
  content: string | null;
  tags: string[];
  image_paths: string[];
}): JournalEntry {
  const date = new Date(`${row.diary_date}T00:00:00`);
  const body = (row.content ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: row.id,
    diaryDate: row.diary_date,
    month: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
    date: `${date.getDate()}일`,
    title: row.title,
    body,
    tag: row.tags.join(" · "),
    tags: row.tags,
    imageCount: row.image_paths.length,
    image_paths: row.image_paths,
  };
}

function getEntryTags(entry: JournalEntry) {
  return entry.tags?.length ? entry.tags : entry.tag ? [entry.tag] : [];
}

const koreanInitials = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

function getKoreanInitial(character: string) {
  const code = character.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return koreanInitials[Math.floor((code - 0xac00) / 588)];
}

function matchesJournalQuery(text: string, query: string) {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery || normalizedText.includes(normalizedQuery)) return true;

  let queryIndex = 0;
  for (const character of normalizedText) {
    const queryCharacter = normalizedQuery[queryIndex];
    if (
      queryCharacter &&
      (character === queryCharacter || getKoreanInitial(character) === queryCharacter)
    ) {
      queryIndex += 1;
    }
    if (queryIndex === normalizedQuery.length) return true;
  }
  return false;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const normalizedQuery = query.trim().toLowerCase();
  const exactStart = text.toLowerCase().indexOf(normalizedQuery);

  if (!normalizedQuery || exactStart < 0) return text;

  const exactEnd = exactStart + normalizedQuery.length;
  return (
    <>
      {text.slice(0, exactStart)}
      <mark className="rounded-[3px] bg-search-highlight px-px text-inherit">
        {text.slice(exactStart, exactEnd)}
      </mark>
      {text.slice(exactEnd)}
    </>
  );
}

function GrowthJournalPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  useEffect(() => {
    if (pathname !== "/calendar/growth-journal") return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setEntries([]);
    setThumbnailUrls({});

    const loadEntries = async () => {
      const { data, error } = await supabase
        .from("startup_diaries")
        .select("id, diary_date, title, content, tags, image_paths")
        .order("diary_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        setLoadError("성장일지를 불러오지 못했어요.");
        setEntries([]);
      } else {
        setEntries((data ?? []).map(mapDiaryRow));
      }
      setIsLoading(false);
    };

    void loadEntries();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const loadThumbnails = async () => {
      const entriesWithImages = entries.filter(
        (entry): entry is JournalEntry & { id: string; image_paths: string[] } =>
          Boolean(entry.id && entry.image_paths?.length),
      );
      const results = await Promise.all(
        entriesWithImages.map(async (entry) => {
          const firstPath = entry.image_paths[0];
          if (!firstPath) return null;
          const { data } = await supabase.storage
            .from("growth-journal-images")
            .createSignedUrl(firstPath, 60 * 60);
          return data?.signedUrl ? ([entry.id, data.signedUrl] as const) : null;
        }),
      );
      if (cancelled) return;
      setThumbnailUrls(
        Object.fromEntries(
          results.filter((result): result is readonly [string, string] => Boolean(result)),
        ),
      );
    };

    if (entries.length > 0) void loadThumbnails();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const getGroupKey = (entry: JournalEntry) =>
    viewMode === "month" ? entry.month : entry.month.slice(0, 5);
  const getEntryDateLabel = (entry: JournalEntry) => {
    const month = entry.month.match(/(\d+)월/)?.[1]?.padStart(2, "0") ?? "";
    const day = entry.date.match(/(\d+)일/)?.[1]?.padStart(2, "0") ?? "";
    return viewMode === "month" ? `${day}일` : `${month}월 ${day}일`;
  };
  const getEntryFullDateLabel = (entry: JournalEntry) => {
    const year = Number(entry.month.match(/^\d{4}/)?.[0]);
    const month = Number(entry.month.match(/(\d+)월/)?.[1]);
    const day = Number(entry.date.match(/(\d+)일/)?.[1]);
    const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(
      new Date(Date.UTC(year, month - 1, day)),
    );

    return `${entry.month} ${entry.date} (${weekday})`;
  };
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = normalizedQuery
    ? entries.filter((entry) =>
        [entry.title, entry.body, entry.tag].some((value) =>
          matchesJournalQuery(value, normalizedQuery),
        ),
      )
    : entries;
  const groups = Array.from(new Set(filteredEntries.map(getGroupKey)));

  if (pathname !== "/calendar/growth-journal" && pathname.startsWith("/calendar/growth-journal/")) {
    return <Outlet />;
  }

  return (
    <section className="space-y-[32px]">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="h-[33px] text-[28px] font-bold leading-[33px] text-ink">성장일지</h1>
          <span className="inline-flex h-8 min-w-8 items-center justify-center overflow-hidden rounded-full bg-item-hover px-2 text-[18px] font-semibold leading-none text-ink-muted">
            {entries.length}
          </span>
        </div>

        <div className="mt-[18px] flex items-center justify-end gap-3">
          <div
            role="group"
            aria-label="성장일지 보기 방식"
            className="order-2 relative h-[42px] w-28 rounded-[12px] bg-item-hover"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1/2 h-8 -translate-y-1/2 rounded-[8px] bg-surface shadow-[0_2px_6px_0_rgba(85,113,78,0.12)] transition-[left,width] duration-150 ease-out motion-reduce:transition-none",
                viewMode === "month" ? "left-[5px] w-11" : "left-[51px] w-14",
              )}
            />
            <div className="absolute left-[5px] top-1/2 flex h-8 w-[102px] -translate-y-1/2 items-center justify-between">
              {(["month", "year"] as const).map((option) => {
                const selected = viewMode === option;
                const monthOption = option === "month";

                return (
                  <Button
                    key={option}
                    type="button"
                    variant="ghost"
                    onClick={() => setViewMode(option)}
                    aria-pressed={selected}
                    className={cn(
                      "relative flex shrink-0 items-center justify-center px-[10px] py-[6px] text-[14px] font-normal leading-none transition-colors duration-150 motion-reduce:transition-none hover:bg-transparent",
                      selected
                        ? monthOption
                          ? "h-8 w-11 rounded-[12px] font-semibold text-ink hover:text-ink"
                          : "h-8 w-14 rounded-[6px] font-semibold text-ink hover:text-ink"
                        : monthOption
                          ? "h-7 w-11 rounded-[6px] text-control-inactive hover:text-control-inactive"
                          : "h-7 w-14 rounded-[6px] text-control-inactive hover:text-control-inactive",
                    )}
                  >
                    {monthOption ? "월별" : "연도별"}
                  </Button>
                );
              })}
            </div>
          </div>
          <label className="order-1 relative flex h-[42px] w-[373px] items-center rounded-[12px] border border-field-border bg-surface px-5">
            <Search aria-hidden className="mr-2 size-5 text-icon-muted" strokeWidth={1.8} />
            <span className="sr-only">성장일지 검색</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목, 내용 또는 태그 검색"
              className="min-w-0 flex-1 appearance-none bg-transparent pr-8 text-[15px] text-ink outline-none placeholder:text-guide-text [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query ? (
              <button
                type="button"
                aria-label="전체 삭제"
                title="전체 삭제"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setQuery("")}
                className="absolute right-3 flex size-5 shrink-0 items-center justify-center rounded-full bg-item-hover text-icon-muted transition-colors hover:bg-secondary-btn-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <X aria-hidden className="size-3" strokeWidth={2.5} />
              </button>
            ) : null}
          </label>
          <Link
            to="/calendar/growth-journal/new"
            search={{ from: "journal" }}
            className="order-3 flex h-[42px] w-28 items-center justify-center rounded-[12px] bg-brand px-0 text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
          >
            일지 쓰기
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-[18px] rounded-[12px] bg-transparent px-6 py-16 text-center">
            <p className="text-[16px] text-ink-muted">성장일지를 불러오는 중이에요…</p>
          </div>
        ) : loadError ? (
          <div className="mt-[18px] rounded-[12px] bg-item-hover px-6 py-16 text-center">
            <p className="text-[16px] text-destructive">{loadError}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-[18px] rounded-[12px] border border-field-border bg-surface px-6 py-16 text-center">
            <p className="text-[18px] font-semibold text-ink">아직 작성한 성장일지가 없어요</p>
            <p className="mt-[2px] text-[15px] text-ink-muted">
              오늘의 생각과 경험을 첫 일지로 남겨보세요.
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="mt-[18px] rounded-[12px] border border-field-border bg-surface px-6 py-16 text-center">
            <p className="text-[18px] font-semibold text-ink">검색 결과가 없어요</p>
            <p className="mt-[2px] text-[15px] text-ink-muted">다른 검색어로 다시 시도해보세요.</p>
          </div>
        ) : (
          <div className="mt-[18px] flex flex-col gap-0">
            {groups.map((group, groupIndex) => (
              <div key={group} className={groupIndex < groups.length - 1 ? "mb-10" : ""}>
                <section className="flex flex-col gap-3">
                  <h2
                    data-growth-journal-sticky
                    data-growth-journal-month
                    className="sticky top-0 z-30 px-1 py-2 text-[24px] font-bold leading-7 text-ink"
                  >
                    {group}
                  </h2>
                  <div className="flex flex-col gap-4 bg-surface">
                    {filteredEntries
                      .filter((entry) => getGroupKey(entry) === group)
                      .map((entry) => (
                        <article
                          key={entry.id ?? `${entry.month}-${entry.date}-${entry.title}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (entry.id) {
                              void navigate({
                                to: "/calendar/growth-journal/$id",
                                params: { id: entry.id },
                              });
                            } else {
                              setSelectedEntry(entry);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              if (entry.id) {
                                void navigate({
                                  to: "/calendar/growth-journal/$id",
                                  params: { id: entry.id },
                                });
                              } else {
                                setSelectedEntry(entry);
                              }
                            }
                          }}
                          className="flex cursor-pointer items-start rounded-[12px] px-8 py-6 transition-colors hover:bg-item-hover/45 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                        >
                          <div className="flex min-w-0 flex-1 items-start">
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-[20px] font-semibold leading-6 text-ink">
                                <HighlightedText text={entry.title} query={query} />
                              </h3>
                              <p className="mt-1 line-clamp-2 text-[16px] font-normal leading-6 text-ink-muted">
                                <HighlightedText text={entry.body} query={query} />
                              </p>
                              <div className="mt-4 flex items-center gap-2 text-[14px] leading-5 text-ink-muted">
                                <time className="font-medium">{getEntryDateLabel(entry)}</time>
                                {getEntryTags(entry).length > 0 ? (
                                  <>
                                    <span aria-hidden="true" className="text-ink-muted/60">
                                      ·
                                    </span>
                                    <span className="flex flex-wrap items-center gap-1.5">
                                      {getEntryTags(entry).map((tag) => (
                                        <span
                                          key={tag}
                                          className="inline-flex rounded bg-[#f5f5f5] px-[7px] py-1 text-xs font-medium text-ink-muted"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          {entry.imageCount ? (
                            <div
                              className="relative ml-4 size-[112px] shrink-0 overflow-hidden rounded-[12px] bg-item-hover"
                              role="img"
                              aria-label="일지 첨부 이미지 썸네일"
                            >
                              {entry.id && thumbnailUrls[entry.id] ? (
                                <img
                                  src={thumbnailUrls[entry.id]}
                                  alt="일지 첨부 이미지 썸네일"
                                  className="size-full object-cover"
                                />
                              ) : null}
                              {entry.imageCount > 1 ? (
                                <span
                                  className="absolute bottom-0 right-0 rounded-full px-2 py-1 text-[12px] font-bold leading-4 text-white"
                                  style={{ backgroundColor: "rgba(89,105,99,0.5)" }}
                                >
                                  +{entry.imageCount - 1}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`${entry.title} 더보기`}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                className="group/more ml-4 flex size-8 shrink-0 self-start cursor-pointer items-center justify-center rounded-[8px] text-icon-muted transition-colors hover:bg-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                              >
                                <span
                                  aria-hidden
                                  className="flex size-6 flex-col items-center justify-center gap-[3px]"
                                >
                                  <span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" />
                                  <span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" />
                                  <span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" />
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                              className="status-actions-menu w-36 rounded-xl border-0 bg-surface p-1 shadow-none"
                              style={{ boxShadow: "var(--shadow-dropdown)" }}
                            >
                              <DropdownMenuItem
                                asChild
                                className="cursor-pointer px-[10px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-ink"
                              >
                                <Link
                                  to="/calendar/growth-journal/new"
                                  search={{
                                    ...(entry.id ? { id: entry.id } : {}),
                                    ...(entry.diaryDate ? { date: entry.diaryDate } : {}),
                                    from: "journal",
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  수정하기
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setSelectedEntry(null);
                                  setDeleteTarget(entry);
                                }}
                                className="cursor-pointer px-[10px] text-destructive hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-destructive"
                              >
                                삭제하기
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </article>
                      ))}
                  </div>
                </section>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={selectedEntry !== null}
        onOpenChange={(open) => !open && setSelectedEntry(null)}
      >
        <DialogContent className="max-w-[640px] rounded-[20px] border-field-border bg-surface p-8">
          {selectedEntry ? (
            <>
              <DialogHeader className="space-y-3 text-left">
                <div className="flex items-center gap-2 text-[14px] text-ink-muted">
                  <time>{getEntryFullDateLabel(selectedEntry)}</time>
                  {getEntryTags(selectedEntry).length > 0 ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {getEntryTags(selectedEntry).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex rounded bg-[#f5f5f5] px-[7px] py-1 text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    </>
                  ) : null}
                </div>
                <DialogTitle className="text-[24px] font-bold leading-8 text-ink">
                  {selectedEntry.title}
                </DialogTitle>
                <DialogDescription className="whitespace-pre-wrap pt-1 text-[16px] leading-7 text-ink-muted">
                  {selectedEntry.body}
                </DialogDescription>
              </DialogHeader>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="w-[calc(100vw-32px)] max-w-[560px] overflow-hidden rounded-[20px] border-0 bg-surface">
          <AlertDialogHeader className="min-w-0 w-full max-w-full">
            <AlertDialogTitle className="mb-4 text-[20px] font-bold leading-7 text-ink">
              이 일지를 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-[14px] font-medium leading-5 text-ink-muted">
              삭제한 일지는 다시 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="h-11 rounded-[12px] border-0 bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async (event) => {
                event.preventDefault();
                if (!deleteTarget?.id) {
                  setDeleteTarget(null);
                  return;
                }

                if (deleteTarget.image_paths && deleteTarget.image_paths.length > 0) {
                  await supabase.storage
                    .from("growth-journal-images")
                    .remove(deleteTarget.image_paths);
                }
                const { error } = await supabase
                  .from("startup_diaries")
                  .delete()
                  .eq("id", deleteTarget.id);
                if (!error) {
                  setEntries((current) => current.filter((entry) => entry.id !== deleteTarget.id));
                }
                setDeleteTarget(null);
              }}
              className="h-11 rounded-[12px] border-0 bg-[#E95152] px-5 text-[15px] font-semibold text-white shadow-none hover:bg-[#E95152]/90 focus-visible:ring-1 focus-visible:ring-focus-soft"
            >
              삭제하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
