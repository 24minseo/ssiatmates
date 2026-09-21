import { useEffect, useMemo, useState } from "react";
import { Check, MoreVertical } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { Pagination } from "@/components/ui/Pagination";
import { ProgramSortDropdown, type ProgramSortOption } from "@/components/my-programs/ProgramSortDropdown";
import { ProgramResultRow } from "@/components/programs/ProgramResultRow";
import { ProgramResultsTabs, type ProgramResultsTab } from "@/components/programs/ProgramResultsTabs";
import { SupportCategorySelect } from "@/components/programs/SupportCategorySelect";
import { SUPPORT_ALL } from "@/components/onboarding/constants";
import { programSearchMock } from "@/mocks/programSearchMock";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 10;
export const Route = createFileRoute("/programs")({
  head: () => ({ meta: [{ title: "지원사업 탐색" }] }),
  component: ProgramsPage,
});

function ProgramsPage() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProgramSortOption>("deadline");
  const [tab, setTab] = useState<ProgramResultsTab>("recommended");
  const [page, setPage] = useState(1);
  const [supportCategories, setSupportCategories] = useState<string[]>([SUPPORT_ALL]);
  const [excludeClosed, setExcludeClosed] = useState(false);
  const [excludedOpen, setExcludedOpen] = useState(false);
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = programSearchMock.filter((item) => {
      const matchesQuery = !normalizedQuery || [item.title, item.organization, ...item.categories].join(" ").toLowerCase().includes(normalizedQuery);
      const matchesCategory = supportCategories.includes(SUPPORT_ALL) || item.categories.some((category) => supportCategories.includes(category));
      return matchesQuery && matchesCategory;
    });
    return [...filtered].sort((a, b) => sort === "deadline" ? a.dDay.localeCompare(b.dDay, undefined, { numeric: true }) : sort === "fit" ? Number(b.type === "recommended") - Number(a.type === "recommended") : 0);
  }, [query, sort, supportCategories]);
  useEffect(() => { setPage(1); }, [query, sort, tab, supportCategories]);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const sourceResults = excludeClosed
    ? results.filter((program) => ["p-2", "p-4"].includes(program.id))
    : results;
  const visibleResults = sourceResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <section className="space-y-[18px]"><h1 className="text-[28px] font-bold leading-normal text-ink">지원사업 탐색</h1><div className="grid grid-cols-[290px_290px_minmax(0,1fr)] gap-4"><div className="flex h-12 items-center justify-between rounded-xl bg-[#f6f8f7] pl-6 pr-4 text-[15px] font-medium text-ink">기본 프로필 적용 중<span aria-hidden className="flex size-6 flex-col items-center justify-center gap-[3px]"><span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" /><span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" /><span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" /></span></div><SupportCategorySelect value={supportCategories} onChange={setSupportCategories} /><div className="flex h-12 items-center gap-2 rounded-xl border border-border pl-6 pr-1.5"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="선호하는 조건을 입력해 보세요" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-guide-text" /><button type="button" aria-label="조건 검색" disabled={!query.trim()} className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground transition-colors hover:bg-brand/88 disabled:cursor-not-allowed disabled:bg-brand-disabled disabled:text-brand-foreground"><img draggable={false} src="/assets/programs/ai-search.svg" alt="" className="pointer-events-none select-none size-6" /></button></div></div><div className="pt-[48px]"><div className="relative h-[48px] w-full"><ProgramResultsTabs selected={tab} counts={{ recommended: results.length, review: 0 }} onChange={setTab} /><div className="absolute right-0 top-[-1px] flex items-center gap-[6px]"><ProgramSortDropdown value={sort} onChange={setSort} /><DropdownMenu modal={false}><DropdownMenuTrigger asChild><button type="button" aria-label="지원사업 더보기" className="flex size-[42px] shrink-0 items-center justify-center rounded-[12px] border border-field-border bg-surface p-0 text-ink shadow-none transition-colors hover:bg-item-hover"><MoreVertical className="size-5 stroke-[1.5]" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={6} className="w-[136px] rounded-[12px] border-0 bg-surface p-1 shadow-none" style={{ boxShadow: "var(--shadow-dropdown)" }}><DropdownMenuItem onSelect={() => setExcludedOpen(true)} className={`min-h-10 cursor-pointer rounded-[8px] px-[10px] hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-ink ${excludeClosed ? "bg-dropdown-selected-hover font-bold text-brand" : "text-ink"}`}><span className="flex-1 whitespace-nowrap">제외한 공고 보기</span>{excludeClosed ? <Check className="size-[18px] text-brand" /> : null}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div><div className="mt-1 overflow-hidden rounded-sm">{visibleResults.length ? visibleResults.map((program) => <ProgramResultRow key={program.id} program={program} />) : <p className="bg-white px-8 py-16 text-center text-ink-muted">조건에 맞는 지원사업이 없습니다.</p>}</div>{excludedOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={() => setExcludedOpen(false)}><div className="w-[520px] max-w-[calc(100vw-32px)] rounded-[16px] bg-surface p-6 shadow-dropdown" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="text-[16px] font-semibold text-ink">제외한 공고</h2><button type="button" onClick={() => setExcludedOpen(false)} className="text-ink-muted">닫기</button></div><p className="mb-3 text-[14px] text-ink-muted">임시 제외 공고 2건이 있어요.</p><div className="rounded-xl border border-black/5 bg-item-hover px-4 py-3"><p className="text-[12px] text-ink-muted">창업진흥원</p><div className="mt-1 flex items-center justify-between gap-3"><p className="truncate text-[15px] font-semibold text-ink">2026년 초기창업패키지 예비창업자 모집 공고</p><button type="button" className="shrink-0 rounded-lg bg-surface px-3 py-1.5 text-[13px] font-medium text-brand hover:bg-brand/10">복원</button></div><div className="mt-2 flex items-center gap-2 text-[12px] text-ink-muted"><span>사업화</span><span>·</span><span>예비창업</span><span className="ml-auto font-medium text-ink">D-18</span></div></div><button type="button" onClick={() => setExcludedOpen(false)} className="mt-4 h-9 w-full rounded-lg bg-brand text-sm font-medium text-white">확인</button></div></div>}<Pagination page={page} pageCount={pageCount} onChange={setPage} /></div></section>;
}
