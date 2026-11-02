type AsyncErrorStateProps = {
  message: string;
  onRetry?: () => void;
  title?: string;
  retryLabel?: string;
};

export function AsyncErrorState({
  message,
  onRetry,
  title = "일시적으로 불러오지 못했어요.",
  retryLabel = "다시 시도",
}: AsyncErrorStateProps) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="relative mx-auto mb-2 flex h-[180px] w-[180px] items-center justify-center">
        <img
          src="/assets/empty/error.svg"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="block w-[132px] saturate-[0.1]"
        />
      </div>
      <p className="text-[18px] font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[15px] text-ink-muted">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#F2F7F4] px-4 text-[14px] font-semibold text-brand transition-colors hover:bg-[#EAF1EC]"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
