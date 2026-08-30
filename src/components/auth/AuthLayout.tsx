import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F6F8F7] px-4 py-12">
      <div aria-hidden className="absolute inset-0 blur-[4px]">
        <aside className="absolute inset-y-0 left-0 w-60 bg-white/80 px-4 py-7">
          <div className="ml-4 h-5 w-24 rounded bg-brand/25" />
          <div className="mt-8 h-20 rounded-[10px] bg-white shadow-sm" />
          <div className="mt-7 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 rounded-[8px] bg-white/55" />
            ))}
          </div>
        </aside>
        <div className="absolute left-72 right-10 top-12 h-9 rounded bg-white/50" />
      </div>
      <div aria-hidden className="absolute inset-0 bg-[rgba(158,169,174,0.5)] backdrop-blur-[4px]" />
      <section className="relative z-10 w-full max-w-[542px] rounded-[20px] bg-surface px-6 py-[38px] shadow-[0_0_15px_rgba(64,72,66,0.10)] sm:px-12">
        {children}
      </section>
    </main>
  );
}

interface AuthFieldProps {
  id: string;
  label: string;
  type?: "email" | "password" | "text";
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  error?: string;
  onBlur?: () => void;
}

export function AuthField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  error,
  onBlur,
}: AuthFieldProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2">
      <span className="text-sm font-semibold leading-5 text-ink">{label}</span>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "h-12 rounded-[12px] bg-surface px-4 text-[15px] font-medium text-ink shadow-none placeholder:text-ink-muted focus-visible:border-[1.5px] focus-visible:ring-[3.2px]",
          error
            ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
            : "border-field-border focus-visible:border-brand focus-visible:ring-focus-soft",
        )}
      />
      {error ? (
        <span id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  );
}

interface GoogleButtonProps {
  label: string;
}

export function GoogleButton({ label }: GoogleButtonProps) {
  return (
    <button
      type="button"
      aria-disabled="true"
      onClick={(event) => event.preventDefault()}
      className="flex h-[50px] w-full cursor-pointer items-center justify-center gap-3 rounded-[10px] border border-[#D8E1DD] bg-white text-[15px] font-semibold text-ink shadow-[0_0.6px_0.3px_#D6DBD5,0_4px_16px_rgba(238,238,238,0.5)] transition-[box-shadow,transform,background-color] duration-150 hover:shadow-[0_0.6px_0.3px_#D6DBD5,0_4px_16px_rgba(238,238,238,0.5),0_4px_10px_rgba(202,202,202,0.22)] active:translate-y-px active:scale-[0.99] active:shadow-[0_0.6px_0.3px_#D6DBD5]"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-[15px] shrink-0"
      >
        <path
          fill="#4285F4"
          d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.32 2.98-7.39Z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 4.97-.9 6.62-2.38l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.61A10 10 0 0 0 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.12-1.32.31-1.92V7.47H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.53l3.34-2.61Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.47l3.34 2.61C7.18 7.71 9.39 5.95 12 5.95Z"
        />
      </svg>
      {label}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="flex h-5 items-center gap-3">
      <span className="h-px flex-1 bg-[#D8E1DD]" />
      <span className="text-[13px] font-medium text-ink-muted">또는</span>
      <span className="h-px flex-1 bg-[#D8E1DD]" />
    </div>
  );
}
