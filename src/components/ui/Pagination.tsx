import { ChevronDown } from "lucide-react";

type PaginationProps = { page: number; pageCount: number; onChange: (page: number) => void; };

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  const buttonClass = "inline-flex size-8 items-center justify-center rounded-lg text-sm font-medium transition-colors";
  const disabledClass = "text-content-disabled cursor-not-allowed";
  const idleClass = "text-ink-muted hover:bg-item-hover";
  const activeClass = "bg-brand text-white";
  return (
    <nav aria-label="페이지 이동" className="flex justify-center gap-2 py-6">
      <button type="button" aria-label="이전 페이지" disabled={page === 1} onClick={() => onChange(page - 1)} className={`${buttonClass} ${page === 1 ? disabledClass : idleClass}`}><ChevronDown aria-hidden className="rotate-90 size-4" strokeWidth={2} /></button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" aria-current={pageNumber === page ? "page" : undefined} onClick={() => onChange(pageNumber)} className={`${buttonClass} ${pageNumber === page ? activeClass : idleClass}`}>{pageNumber}</button>)}
      <button type="button" aria-label="다음 페이지" disabled={page === pageCount} onClick={() => onChange(page + 1)} className={`${buttonClass} ${page === pageCount ? disabledClass : idleClass}`}><ChevronDown aria-hidden className="-rotate-90 size-4" strokeWidth={2} /></button>
    </nav>
  );
}
