import { useState } from "react";
import { Check } from "lucide-react";
import { DropdownChevron } from "@/components/ui/DropdownChevron";

import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ProgramSortOption = "deadline" | "fit" | "created";

const sortLabelsByVariant = {
  explore: { deadline: "마감 임박순", fit: "추천순", created: "최근 등록순" },
  myPrograms: { deadline: "마감 임박순", fit: "진행 상태순", created: "최근 추가순" },
} satisfies Record<string, Record<ProgramSortOption, string>>;

type ProgramSortDropdownProps = {
  value: ProgramSortOption;
  onChange: (value: ProgramSortOption) => void;
  variant?: "explore" | "myPrograms";
};

export function ProgramSortDropdown({
  value,
  onChange,
  variant = "explore",
}: ProgramSortDropdownProps) {
  const sortLabels = sortLabelsByVariant[variant];
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState(value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setActiveValue(value);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="지원사업 정렬"
          aria-expanded={open}
          className="group flex h-[42px] w-[136px] shrink-0 items-center justify-between rounded-[12px] border border-field-border bg-surface px-[14px] text-[15px] font-medium text-ink shadow-none transition-colors hover:bg-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="whitespace-nowrap">{sortLabels[value]}</span>
          <DropdownChevron open={open} variant="muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
        className="w-[136px] rounded-[12px] border-0 p-0 shadow-[8px_8px_30px_0_rgba(0,13,59,0.1)]"
      >
        <Command
          value={activeValue}
          onValueChange={setActiveValue}
          className="rounded-[12px]"
        >
          <CommandList>
            <CommandGroup>
              {(Object.keys(sortLabels) as ProgramSortOption[]).map((option) => {
                const selected = value === option;
                return (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    className={cn(
                      "min-h-10 scroll-mt-1 rounded-[8px] text-ink data-[selected=true]:bg-dropdown-hover data-[selected=true]:text-ink",
                      selected &&
                        "font-bold text-brand data-[selected=true]:bg-dropdown-selected-hover data-[selected=true]:text-brand",
                    )}
                  >
                    <span className="flex-1">{sortLabels[option]}</span>
                    {selected ? (
                      <Check className="size-[18px] text-brand" />
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
