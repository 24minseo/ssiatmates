import { Check, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ProgramSortOption = "deadline" | "fit" | "created";

const sortLabels: Record<ProgramSortOption, string> = {
  deadline: "마감 임박순",
  fit: "적합도순",
  created: "최신 등록순",
};

type ProgramSortDropdownProps = {
  value: ProgramSortOption;
  onChange: (value: ProgramSortOption) => void;
};

export function ProgramSortDropdown({
  value,
  onChange,
}: ProgramSortDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="지원사업 정렬"
          className="group flex h-[42px] w-[136px] items-center justify-between rounded-[12px] border border-field-border bg-surface px-[14px] text-[15px] font-semibold text-ink shadow-none transition-colors hover:bg-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span>{sortLabels[value]}</span>
          <ChevronDown className="size-4 text-icon-muted transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="start"
        className="w-[136px] rounded-[12px] border-0 shadow-[8px_8px_30px_0_rgba(0,13,59,0.1)]"
      >
        <div className="space-y-1">
          {(Object.keys(sortLabels) as ProgramSortOption[]).map((option) => (
            <DropdownMenuItem
              key={option}
              onSelect={() => onChange(option)}
              className={`h-11 rounded-[8px] px-4 py-0 text-[15px] font-normal outline-none transition-colors hover:bg-item-hover focus:bg-item-hover focus:text-ink ${value === option ? "bg-item-hover text-brand" : "text-ink"}`}
            >
              <span>{sortLabels[option]}</span>
              {value === option ? (
                <Check
                  className="ml-auto size-5 text-brand"
                  strokeWidth={2}
                />
              ) : null}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
