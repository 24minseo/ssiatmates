import { useState } from "react";
import type { MatchedProgram } from "@/mocks/programSearchMock";

type ProgramResultRowProps = {
  program: MatchedProgram;
  onReportClick?: (program: MatchedProgram) => void;
  onFavoriteToggle?: (program: MatchedProgram) => void;
  favoriteSaving?: boolean;
};

export function ProgramResultRow({
  program,
  onReportClick,
  onFavoriteToggle,
  favoriteSaving = false,
}: ProgramResultRowProps) {
  const isRecommended = program.preference_matched === true;
  const [isFavoritePopping, setIsFavoritePopping] = useState(false);
  const isFavorite = program.is_saved === true;

  const toggleFavorite = () => {
    if (favoriteSaving || !onFavoriteToggle) return;
    setIsFavoritePopping(true);
    window.setTimeout(() => setIsFavoritePopping(false), 220);
    onFavoriteToggle(program);
  };

  return (
    <article className={`flex items-center gap-[38px] border-b border-[#e9e9e9] bg-white px-8 pb-[18px] pt-[14px] h-[118px]`}>
      <div className="flex h-[75px] w-[742px] shrink-0 flex-col justify-center gap-2 pl-[20px]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[13px] leading-[21px] text-ink-muted">{program.organization}</p>
          <h2 className="truncate text-[20px] font-semibold leading-6 tracking-[-0.22px] text-ink">
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
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isRecommended && <span className="rounded bg-[#e2f8f0] px-[7px] py-1 text-xs font-medium text-brand">선호조건 충족</span>}
          {program.categories.map((category) => <span key={category} className="rounded bg-[#f5f5f5] px-[7px] py-1 text-xs font-medium text-ink-muted">{category}</span>)}
        </div>
      </div>
      {program.matchLabel ? (
        onReportClick ? (
          <button
            type="button"
            onClick={() => onReportClick(program)}
            className="inline-flex shrink-0 self-center -translate-y-1 items-center rounded-[8px] px-2 py-1 text-sm font-medium text-ink transition-colors hover:bg-item-hover"
          >
            {program.matchLabel}
          </button>
        ) : (
          <span className="self-center -translate-y-1 text-sm font-medium text-ink">{program.matchLabel}</span>
        )
      ) : null}
      <div className="relative ml-2 h-[86px] w-[110px] shrink-0">
        <p className="absolute left-0 top-[25.5px] text-[20px] font-bold leading-[26px] text-ink">{program.dDay}</p>
        <p className="absolute left-0 top-[56px] text-[13px] leading-5 text-ink-muted">{program.deadline}</p>
      </div>
      <button
        type="button"
        aria-label={isFavorite ? "관심 공고 저장 해제" : "관심 공고 저장"}
        aria-pressed={isFavorite}
        onClick={toggleFavorite}
        disabled={favoriteSaving || !onFavoriteToggle}
        className="shrink-0 disabled:cursor-wait disabled:opacity-60"
      >
        <img
          draggable={false}
          src={isFavorite ? "/assets/programs/favorite-filled.svg" : "/assets/programs/favorite-outline.svg"}
          alt=""
          className={`pointer-events-none select-none h-[17px] w-5 ${isFavoritePopping ? "animate-heart-pop" : ""}`}
        />
      </button>
    </article>
  );
}
