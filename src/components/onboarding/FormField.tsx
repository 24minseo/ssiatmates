import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FieldLabelVariant = "default" | "muted" | "muted2";

export function FieldLabel({
  children,
  required,
  className,
  htmlFor,
  variant = "default",
}: {
  children: ReactNode;
  required?: boolean | undefined;
  className?: string | undefined;
  htmlFor?: string | undefined;
  variant?: FieldLabelVariant | undefined;
}) {

  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-sm font-semibold",
        variant === "default"
          ? "text-ink"
          : variant === "muted2"
            ? "text-ink-muted"
            : "text-submenu-text",
        className,
      )}
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
  labelVariant = "default",
  error,
  children,
}: {
  label: string;
  required?: boolean | undefined;
  htmlFor?: string | undefined;
  labelRight?: ReactNode | undefined;
  labelVariant?: FieldLabelVariant | undefined;

  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <FieldLabel htmlFor={htmlFor} required={required} variant={labelVariant}>
          {label}
        </FieldLabel>
        {labelRight}
      </div>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
