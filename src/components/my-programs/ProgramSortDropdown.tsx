import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
          className="group flex h-[42px] w-[136px] items-center justify-between rounded-[12px] border border-field-border bg-surface px-[14px] text-[15px] font-medium text-ink shadow-none transition-colors hover:bg-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span>{sortLabels[value]}</span>
          <ChevronDown
            className={cn(
              "size-4 text-icon-muted transition-transform",
              open && "rotate-180",
            )}
          />
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
