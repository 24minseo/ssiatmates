import { useEffect, useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { Pagination } from "@/components/ui/Pagination";
import { ProgramSortDropdown, type ProgramSortOption } from "@/components/my-programs/ProgramSortDropdown";
import { ProgramResultRow } from "@/components/programs/ProgramResultRow";
import { ProgramResultsTabs, type ProgramResultsTab } from "@/components/programs/ProgramResultsTabs";
import { SupportCategorySelect } from "@/components/programs/SupportCategorySelect";
import { SUPPORT_ALL } from "@/components/onboarding/constants";
import { programSearchMock } from "@/mocks/programSearchMock";

const PAGE_SIZE = 10;
export const Route = createFileRoute("/programs")({ component: ProgramsPage });

function ProgramsPage() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProgramSortOption>("deadline");
  const [tab, setTab] = useState<ProgramResultsTab>("recommended");
  const [page, setPage] = useState(1);
  const [supportCategories, setSupportCategories] = useState<string[]>([SUPPORT_ALL]);
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
  const visibleResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <section className="space-y-[18px]"><h1 className="text-[28px] font-extrabold leading-normal text-ink">지원사업 탐색</h1><div className="grid grid-cols-[290px_290px_minmax(0,1fr)] gap-4"><div className="flex h-12 items-center justify-between rounded-xl bg-[#f6f8f7] pl-6 pr-4 text-[15px] font-medium text-ink">기본 프로필 적용 중<MoreVertical aria-hidden className="size-4 stroke-[1.5]" /></div><SupportCategorySelect value={supportCategories} onChange={setSupportCategories} /><div className="flex h-12 items-center gap-2 rounded-xl border border-border pl-6 pr-1.5"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="선호하는 조건을 입력해 보세요" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-guide-text" /><button type="button" aria-label="조건 검색" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a1ddc8] text-ink"><img draggable={false} src="/assets/programs/ai-search.svg" alt="" className="pointer-events-none select-none size-6" /></button></div></div><div className="pt-[48px]"><div className="relative h-[48px] w-full"><ProgramResultsTabs selected={tab} counts={{ recommended: results.length, review: 0 }} onChange={setTab} /><div className="absolute right-0 top-[-1px] flex items-center gap-[6px]"><ProgramSortDropdown value={sort} onChange={setSort} /><button type="button" aria-label="지원사업 더보기" className="flex size-[42px] shrink-0 items-center justify-center rounded-[12px] border border-field-border bg-surface p-0 text-ink shadow-none transition-colors hover:bg-item-hover"><img src="/assets/programs/more-horizontal.svg" alt="" aria-hidden className="size-6" draggable={false} /></button></div></div><div className="mt-4 overflow-hidden rounded-sm">{visibleResults.length ? visibleResults.map((program) => <ProgramResultRow key={program.id} program={program} />) : <p className="bg-white px-8 py-16 text-center text-ink-muted">조건에 맞는 지원사업이 없습니다.</p>}</div><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div></section>;
}