// Vercel Preview deployment trigger; mock-only screen remains backend-independent.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pagination } from "@/components/ui/Pagination";
import { ProgramResultRow } from "@/components/programs/ProgramResultRow";
import { ProgramResultsTabs, type ProgramResultsTab } from "@/components/programs/ProgramResultsTabs";
import { SupportCategorySelect } from "@/components/programs/SupportCategorySelect";
import { programSearchMock } from "@/mocks/programSearchMock";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/programs")({ component: ProgramsPage });

function ProgramsPage() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"deadline" | "match">("deadline");
  const [tab, setTab] = useState<ProgramResultsTab>("recommended");
  const [page, setPage] = useState(1);

  const results = useMemo(() => {
    const filtered = programSearchMock.filter((item) =>
      [item.title, item.organization, ...item.categories].join(" ").toLowerCase().includes(query.toLowerCase()),
    );
    return [...filtered].sort((a, b) => sort === "deadline" ? a.dDay.localeCompare(b.dDay, undefined, { numeric: true }) : Number(b.type === "recommended") - Number(a.type === "recommended"));
  }, [query, sort]);

  useEffect(() => { setPage(1); }, [query, sort, tab]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visibleResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className="space-y-[18px]">
      <h1 className="text-[28px] font-extrabold leading-normal text-ink">지원사업 탐색</h1>
      <div className="grid grid-cols-[290px_290px_minmax(0,1fr)] gap-4">
        <div className="flex h-12 items-center justify-between rounded-xl bg-[#f6f8f7] px-6 text-[15px] font-medium text-ink">기본 프로필 적용 중<img src="https://www.figma.com/api/mcp/asset/48acbe0f-3dba-466a-8ff5-8b35b3bdfb0c/6ace8.svg" alt="" className="size-6" /></div>
        <SupportCategorySelect />
        <div className="flex h-12 items-center gap-2 rounded-xl border border-border px-6">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="선호하는 조건을 입력해 보세요" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-placeholder" />
          <button type="button" aria-label="조건 검색" className="flex size-9 items-center justify-center rounded-lg bg-[#a1ddc8] text-ink"><img src="/assets/programs/ai-search.svg" alt="" className="size-6" /></button>
        </div>
      </div>
      <div className="pt-[48px]">
        <div className="flex items-end justify-between">
          <ProgramResultsTabs selected={tab} counts={{ recommended: results.length, review: 0 }} onChange={setTab} />
          <select value={sort} onChange={(event) => setSort(event.target.value as "deadline" | "match")} className="h-[42px] w-[136px] rounded-xl border border-border bg-white px-3 text-[15px] font-semibold text-ink"><option value="deadline">마감 임박순</option><option value="match">추천순</option></select>
        </div>
        <div className="mt-4 overflow-hidden rounded-sm">{visibleResults.length ? visibleResults.map((program) => <ProgramResultRow key={program.id} program={program} />) : <p className="bg-white px-8 py-16 text-center text-ink-muted">조건에 맞는 지원사업이 없습니다.</p>}</div>
        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </section>
  );
}
