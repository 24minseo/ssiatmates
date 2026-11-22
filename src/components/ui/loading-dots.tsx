export function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-px" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`loading-dot-nudge loading-dot-nudge-${index + 1} inline-block leading-none`}
          style={{ animationDelay: `${index * 150}ms` }}
        >
          .
        </span>
      ))}
    </span>
  );
}
