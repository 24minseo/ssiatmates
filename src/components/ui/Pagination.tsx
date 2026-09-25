import { ChevronDown } from "lucide-react";

type PaginationProps = { page: number; pageCount: number; onChange: (page: number) => void; };

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  const buttonClass = "inline-flex size-8 items-center justify-center rounded-lg text-sm font-medium transition-colors";
  const idleClass = "text-ink-muted hover:bg-item-hover";
  const activeClass = "bg-brand text-white";
  const pageGroupStart = Math.floor((page - 1) / 10) * 10 + 1;
  const pageGroupEnd = Math.min(pageGroupStart + 9, pageCount);
  const hasPreviousGroup = pageGroupStart > 1;
  const hasNextGroup = pageGroupEnd < pageCount;
  return (
    <nav aria-label="페이지 이동" className="mt-4 flex justify-center gap-2 py-6">
      {hasPreviousGroup && <button type="button" aria-label="이전 페이지 묶음" onClick={() => onChange(pageGroupStart - 1)} className={`${buttonClass} ${idleClass}`}><ChevronDown aria-hidden className="rotate-90 size-4" strokeWidth={2} /></button>}
      {Array.from({ length: pageGroupEnd - pageGroupStart + 1 }, (_, index) => pageGroupStart + index).map((pageNumber) => <button key={pageNumber} type="button" aria-current={pageNumber === page ? "page" : undefined} onClick={() => onChange(pageNumber)} className={`${buttonClass} ${pageNumber === page ? activeClass : idleClass}`}>{pageNumber}</button>)}
      {hasNextGroup && <button type="button" aria-label="다음 페이지 묶음" onClick={() => onChange(pageGroupEnd + 1)} className={`${buttonClass} ${idleClass}`}><ChevronDown aria-hidden className="-rotate-90 size-4" strokeWidth={2} /></button>}
    </nav>
  );
}
