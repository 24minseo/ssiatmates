import { useState } from "react";
import { MoreVertical } from "lucide-react";
import type { MatchedProgram } from "@/mocks/programSearchMock";
import { recordRecentMatchedProgram } from "@/services/homeNoticeFeed";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProgramResultRowProps = {
  program: MatchedProgram;
  variant?: "default" | "manual";
  onReportClick?: (program: MatchedProgram) => void;
  onFavoriteToggle?: (program: MatchedProgram) => void;
  favoriteSaving?: boolean;
  onManualEdit?: (program: MatchedProgram) => void;
  onManualDelete?: (program: MatchedProgram) => void;
};

export function ProgramResultRow({
  program,
  variant = "default",
  onReportClick,
  onFavoriteToggle,
  favoriteSaving = false,
  onManualEdit,
  onManualDelete,
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

  const reportAction = program.matchLabel ? (
    onReportClick ? (
      <button
        type="button"
        onClick={() => onReportClick(program)}
        className="inline-flex shrink-0 self-center -translate-y-1 items-center rounded-[8px] px-2 py-1 text-sm font-medium text-ink transition-colors hover:bg-item-hover"
      >
        {program.matchLabel}
      </button>
    ) : (
      <span className="self-center -translate-y-1 text-sm font-medium text-ink">
        {program.matchLabel}
      </span>
    )
  ) : null;

  return (
    <article
      data-variant={variant}
      className={`flex items-center gap-[38px] border-b border-[#e9e9e9] bg-white px-8 pb-[18px] pt-[14px] ${program.changes?.length ? "min-h-[128px]" : "h-[128px]"}`}
    >
      <div
        className={`flex w-[742px] shrink-0 flex-col justify-center gap-2 pl-[20px] ${program.changeReason || program.changes?.length ? "min-h-[92px]" : "h-[75px]"}`}
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-[14px] leading-[21px] text-ink-muted">{program.organization}</p>
          <h2
            className={`${program.changeReason ? "line-clamp-2 text-[20px] leading-6" : "truncate text-[20px] leading-6"} font-semibold tracking-[-0.22px] text-ink`}
          >
            {program.url ? (
              <a
                href={program.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => recordRecentMatchedProgram(program)}
                className="block truncate hover:underline hover:decoration-[1px] hover:underline-offset-[4px]"
              >
                {program.title}
              </a>
            ) : (
              program.title
            )}
          </h2>
        </div>
        {program.changes?.length ? (
          <div className="space-y-2">
            {program.changes.map((change, index) => (
              <div key={`${change.field}-${index}`} className="flex items-start gap-2 text-[14px] leading-5 text-ink-muted">
                <span className="shrink-0 rounded bg-item-hover px-[7px] py-1 text-xs font-medium">{change.badge}</span>
                <span className="min-w-0 whitespace-pre-wrap break-words">{change.text}</span>
              </div>
            ))}
          </div>
        ) : program.changeReason ? (
          <>
            <p
              className={`flex min-w-0 items-center gap-2 text-[13px] font-medium leading-5 ${program.changeTone === "danger" ? "text-deadline" : program.changeTone === "neutral" ? "text-ink-muted" : "text-brand"}`}
            >
              <span
                className={`shrink-0 rounded px-[7px] py-1 text-xs font-medium ${program.changeTone === "danger" ? "bg-deadline-surface text-deadline" : program.changeTone === "neutral" ? "bg-item-hover text-ink-muted" : "bg-[#e2f8f0] text-brand"}`}
              >
                {program.changeReason}
              </span>
              <span className="truncate text-[14px] text-ink-muted">{program.changeDetail}</span>
            </p>
          </>
        ) : (
          <div className="flex items-center gap-2">
            {isRecommended && (
              <span className="rounded bg-[#e2f8f0] px-[7px] py-1 text-xs font-medium text-brand">
                선호조건 충족
              </span>
            )}
            {program.categories.map((category) => (
              <span
                key={category}
                className="rounded bg-[#f5f5f5] px-[7px] py-1 text-xs font-medium text-ink-muted"
              >
                {category}
              </span>
            ))}
          </div>
        )}
      </div>
      {reportAction}
      <div className="relative ml-2 h-[86px] w-[110px] shrink-0">
        <p className="absolute left-0 top-[25.5px] text-[20px] font-bold leading-[26px] text-ink">
          {program.dDay}
        </p>
        <p className="absolute left-0 top-[56px] text-[13px] leading-5 text-ink-muted">
          {program.deadline}
        </p>
      </div>
      <div className={variant === "manual" ? "relative ml-auto h-9 w-[76px] shrink-0" : "ml-auto flex shrink-0 items-center"}>
        <button
          type="button"
          aria-label={isFavorite ? "관심 공고 저장 해제" : "관심 공고 저장"}
          aria-pressed={isFavorite}
          onClick={toggleFavorite}
          disabled={favoriteSaving || !onFavoriteToggle}
          className={`inline-flex shrink-0 self-center disabled:cursor-wait disabled:opacity-60 ${variant === "manual" ? "absolute right-12 top-1/2 -translate-y-1/2" : ""}`}
        >
          <img
            draggable={false}
            src={
              isFavorite
                ? "/assets/programs/favorite-filled.svg"
                : "/assets/programs/favorite-outline.svg"
            }
            alt=""
            className={`pointer-events-none select-none h-[17px] w-5 translate-y-[-4px] ${isFavoritePopping ? "animate-heart-pop" : ""}`}
          />
        </button>
        {variant === "manual" ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="수동 공고 메뉴 열기"
              className="group/dots absolute right-[-20px] top-[calc(50%-4px)] inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-dropdown-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span aria-hidden className="flex size-6 flex-col items-center justify-center gap-[3px]">
                <span className="size-[3px] rounded-full bg-[#84968E] transition-colors group-hover/dots:bg-ink" />
                <span className="size-[3px] rounded-full bg-[#84968E] transition-colors group-hover/dots:bg-ink" />
                <span className="size-[3px] rounded-full bg-[#84968E] transition-colors group-hover/dots:bg-ink" />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="min-w-0 w-fit rounded-[12px] border-0 bg-surface p-1 shadow-none" style={{ boxShadow: "var(--shadow-dropdown)" }}>
            <DropdownMenuItem
              disabled={!onManualEdit}
              onSelect={() => onManualEdit?.(program)}
              className="min-h-10 cursor-pointer rounded-[8px] px-[14px] text-ink data-[highlighted]:bg-dropdown-hover"
            >
              공고 수정
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 bg-border" />
            <DropdownMenuItem
              disabled={!onManualDelete}
              onSelect={() => onManualDelete?.(program)}
              className="min-h-10 cursor-pointer rounded-[8px] px-[14px] text-deadline data-[highlighted]:bg-deadline-surface"
            >
              공고 삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        ) : null}
      </div>
    </article>
  );
}
