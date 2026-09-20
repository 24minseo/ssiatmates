import type { ProgramSearchItem } from "@/mocks/programSearchMock";

type ProgramResultRowProps = {
  program: ProgramSearchItem;
};

export function ProgramResultRow({ program }: ProgramResultRowProps) {
  const isRecommended = program.type === "recommended";

  return (
    <article className={`flex items-center gap-[30px] border-b border-[#e9e9e9] bg-white px-8 pb-[18px] pt-[14px] ${isRecommended ? "h-[112px]" : "h-[108px]"}`}>
      <div className={`flex h-[75px] flex-col justify-center gap-2 ${isRecommended ? "w-[722px]" : "min-w-0 flex-1"}`}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[13px] leading-[21px] text-ink-muted">{program.organization}</p>
          <h2 className="truncate text-[20px] font-bold leading-6 tracking-[-0.22px] text-ink">{program.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {isRecommended && <span className="rounded bg-[#e2f8f0] px-[7px] py-1 text-xs font-semibold text-brand">선호조건 충족</span>}
          {program.categories.map((category) => <span key={category} className="rounded bg-[#f5f5f5] px-[7px] py-1 text-xs font-semibold text-ink-muted">{category}</span>)}
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium text-ink">{program.matchLabel}</span>
      <div className="w-[90px] shrink-0">
        <p className="text-xl font-bold leading-[26px] text-ink">{program.dDay}</p>
        <p className="text-[13px] leading-5 text-ink-muted">{program.deadline}</p>
      </div>
      <button type="button" aria-label="관심 공고 저장" className="shrink-0"><img src="/assets/programs/favorite-outline.svg" alt="" className="h-[17px] w-5" /></button>
    </article>
  );
}
