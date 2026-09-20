import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type DropdownChevronProps = {
  open?: boolean;
  variant?: "default" | "muted";
};

export function DropdownChevron({
  open = false,
  variant = "default",
}: DropdownChevronProps) {
  return (
    <ChevronDown
      aria-hidden
      className={cn(
        "size-4 transition-transform",
        open && "rotate-180",
        variant === "muted" ? "text-icon-muted" : "text-ink",
      )}
    />
  );
}
