import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pagination } from "@/components/ui/Pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProgramResultRow } from "@/components/programs/ProgramResultRow";
import { ProgramResultsTabs, type ProgramResultsTab } from "@/components/programs/ProgramResultsTabs";
import { SupportCategorySelect } from "@/components/programs/SupportCategorySelect";
import { SUPPORT_ALL } from "@/components/onboarding/constants";
import { programSearchMock } from "@/mocks/programSearchMock";

const PAGE_SIZE = 10;
export const Route = createFileRoute("/programs")({ component: ProgramsPage });

function ProgramsPage() {
  // TODO(n8n): replace this local query state with the n8n workflow request state.
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"deadline" | "match">("deadline");
  const [tab, setTab] = useState<ProgramResultsTab>("recommended");
  const [page, setPage] = useState(1);
  const [supportCategories, setSupportCategories] = useState<string[]>([SUPPORT_ALL]);

  // TODO(n8n): move query/category filtering and sorting to the backend once the n8n endpoint is available.
  // Keep the response contract compatible with ProgramSearchItem[] so the row and pagination UI stay unchanged.
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = programSearchMock.filter((item) => {
      const matchesQuery = !normalizedQuery || [item.title, item.organization, ...item.categories].join(" ").toLowerCase().includes(normalizedQuery);
      const matchesCategory = supportCategories.includes(SUPPORT_ALL) || item.categories.some((category) => supportCategories.includes(category));
      return matchesQuery && matchesCategory;
    });
    return [...filtered].sort((a, b) => sort === "deadline" ? a.dDay.localeCompare(b.dDay, undefined, { numeric: true }) : Number(b.type === "recommended") - Number(a.type === "recommended"));
  }, [query, sort, supportCategories]);

  useEffect(() => { setPage(1); }, [query, sort, tab, supportCategories]);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visibleResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return <section className="space-y-[18px]">
    <h1 className="text-[28px] font-extrabold leading-normal text-ink">지원사업 탐색</h1>
    <div className="grid grid-cols-[290px_290px_minmax(0,1fr)] gap-4">
      <div className="flex h-12 items-center justify-between rounded-xl bg-[#f6f8f7] pl-6 pr-4 text-[15px] font-medium text-ink">기본 프로필 적용 중<img src="https://www.figma.com/api/mcp/asset/48acbe0f-3dba-466a-8ff5-8b35b3bdfb0c/6ace8.svg" alt="" className="size-6" /></div>
      <SupportCategorySelect value={supportCategories} onChange={setSupportCategories} />
      <div className="flex h-12 items-center gap-2 rounded-xl border border-border pl-6 pr-1.5">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="선호하는 조건을 입력해 보세요" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-placeholder" />
        <button type="button" aria-label="조건 검색" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a1ddc8] text-ink"><img src="/assets/programs/ai-search.svg" alt="" className="size-6" /></button>
      </div>
    </div>
    <div className="pt-[48px]">
      <div className="flex items-end justify-between">
        <ProgramResultsTabs selected={tab} counts={{ recommended: results.length, review: 0 }} onChange={setTab} />
        <Select value={sort} onValueChange={(value) => setSort(value as "deadline" | "match")}>
          <SelectTrigger className="h-[42px] w-[136px] rounded-xl border-border bg-white px-3 text-[15px] font-semibold text-ink"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="deadline">마감 임박순</SelectItem><SelectItem value="match">추천순</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="mt-4 overflow-hidden rounded-sm">{visibleResults.length ? visibleResults.map((program) => <ProgramResultRow key={program.id} program={program} />) : <p className="bg-white px-8 py-16 text-center text-ink-muted">조건에 맞는 지원사업이 없습니다.</p>}</div>
      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
    </div>
  </section>;
}
