// Vercel Preview deployment trigger; mock-only screen remains backend-independent.
import { useMemo, useState } from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { ProgramResultRow } from "@/components/programs/ProgramResultRow";
import { ProgramResultsTabs, type ProgramResultsTab } from "@/components/programs/ProgramResultsTabs";
import { programSearchMock } from "@/mocks/programSearchMock";

export const Route = createFileRoute("/programs")({ component: ProgramsPage });

function ProgramsPage() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"deadline" | "match">("deadline");
  const [tab, setTab] = useState<ProgramResultsTab>("recommended");
  const results = useMemo(() => {
    const filtered = programSearchMock.filter((item) =>
      [item.title, item.organization, ...item.categories].join(" ").toLowerCase().includes(query.toLowerCase()),
    );
    return [...filtered].sort((a, b) => sort === "deadline" ? a.dDay.localeCompare(b.dDay, undefined, { numeric: true }) : Number(b.recommended) - Number(a.recommended));
  }, [query, sort]);

  return (
    <section className="space-y-[18px]">
      <h1 className="text-[28px] font-extrabold leading-normal text-ink">지원사업 탐색</h1>
      <div className="grid grid-cols-[290px_290px_minmax(0,1fr)] gap-4">
        <div className="flex h-12 items-center justify-between rounded-xl bg-[#f6f8f7] px-6 text-[15px] font-medium text-ink">기본 프로필 적용 중<MoreHorizontal className="size-6" /></div>
        <button type="button" className="flex h-12 items-center justify-between rounded-xl border border-border px-6 text-left text-[15px] font-medium text-ink">모든 지원 분야<ChevronDown className="size-4" /></button>
        <div className="flex h-12 items-center gap-2 rounded-xl border border-border px-6">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="선호하는 조건을 입력해 보세요" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-muted" />
          <button type="button" aria-label="조건 검색" className="flex size-9 items-center justify-center rounded-lg bg-[#a1ddc8] text-ink"><img src="/assets/programs/ai-search.svg" alt="" className="size-6" /></button>
        </div>
      </div>
      <div className="pt-[48px]">
        <div className="flex items-end justify-between">
          <ProgramResultsTabs selected={tab} counts={{ recommended: 10, review: 0 }} onChange={setTab} />
          <select value={sort} onChange={(event) => setSort(event.target.value as "deadline" | "match")} className="h-[42px] w-[136px] rounded-xl border border-border bg-white px-3 text-[15px] font-semibold text-ink"><option value="deadline">마감 임박순</option><option value="match">추천순</option></select>
        </div>
        <div className="mt-4 overflow-hidden rounded-sm">{results.length ? results.map((program) => <ProgramResultRow key={program.id} program={program} />) : <p className="bg-white px-8 py-16 text-center text-ink-muted">조건에 맞는 지원사업이 없습니다.</p>}</div>
        <div className="flex justify-center gap-2 py-6 text-sm text-ink-muted"><button type="button" className="rounded-lg bg-brand px-3 py-2 text-white">1</button><button type="button" className="rounded-lg px-3 py-2 hover:bg-item-hover">2</button></div>
      </div>
    </section>
  );
}
