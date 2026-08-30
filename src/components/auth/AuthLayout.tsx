import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";

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
}

export function AuthField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
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
        className="h-12 rounded-[12px] border-field-border bg-surface px-4 text-[15px] font-medium text-ink shadow-none placeholder:text-ink-muted focus-visible:border-[1.5px] focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
      />
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
      disabled
      aria-disabled="true"
      className="flex h-[50px] w-full cursor-default items-center justify-center gap-3 rounded-[10px] border border-[#D8E1DD] bg-white text-[15px] font-semibold text-ink shadow-[0_0.6px_0.3px_#D6DBD5,0_4px_16px_rgba(238,238,238,0.5)]"
    >
      <img src="/google-logo.svg" alt="" className="size-[14px]" />
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
