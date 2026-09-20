type PaginationProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
};

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="페이지 이동" className="flex justify-center gap-2 py-6 text-sm text-ink-muted">
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
        <button
          key={pageNumber}
          type="button"
          aria-current={pageNumber === page ? "page" : undefined}
          onClick={() => onChange(pageNumber)}
          className={pageNumber === page ? "rounded-lg bg-brand px-3 py-2 text-white" : "rounded-lg px-3 py-2 hover:bg-item-hover"}
        >
          {pageNumber}
        </button>
      ))}
    </nav>
  );
}
