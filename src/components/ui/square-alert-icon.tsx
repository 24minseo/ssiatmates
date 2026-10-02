type SquareAlertIconProps = { className?: string };

export function SquareAlertIcon({ className }: SquareAlertIconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
      <path
        d="M12 7.5V12.75"
        stroke="var(--surface)"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(180 12 12)"
      />
      <circle cx="12" cy="16.75" r="1.4" fill="var(--surface)" transform="rotate(180 12 12)" />
    </svg>
  );
}

export function SquareCheckIcon({ className }: SquareAlertIconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
      <path
        d="m7.5 12.25 3 3 6-6"
        stroke="var(--surface)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
