import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FieldLabel({
  children,
  required,
  className,
  htmlFor,
}: {
  children: ReactNode;
  required?: boolean | undefined;
  className?: string | undefined;
  htmlFor?: string | undefined;
}) {

  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-sm font-semibold text-ink", className)}
    >
      {children}
      {required ? <span className="relative -top-px ml-0.5 text-brand">*</span> : null}
    </label>
  );
}

export function FormField({
  label,
  required,
  htmlFor,
  labelRight,
  error,
  children,
}: {
  label: string;
  required?: boolean | undefined;
  htmlFor?: string | undefined;
  labelRight?: ReactNode | undefined;

  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <FieldLabel htmlFor={htmlFor} required={required}>
          {label}
        </FieldLabel>
        {labelRight}
      </div>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
