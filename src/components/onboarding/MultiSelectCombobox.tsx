import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface MultiSelectComboboxProps {
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  id?: string;
}

export function MultiSelectCombobox({
  options,
  value,
  onChange,
  placeholder = "선택해주세요",
  id,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setActiveValue(value[0] ?? options[0] ?? "");
  }, [open, options, value]);

  const toggleValue = (option: string) => {
    onChange(
      value.includes(option)
        ? value.filter((selected) => selected !== option)
        : [...value, option],
    );
  };

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]
        : `${value[0]} 외 ${value.length - 1}개`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-12 w-full items-center justify-between rounded-[12px] border border-field-border bg-surface px-4 text-left text-[15px] text-ink transition-colors",
            "focus:outline-none focus-visible:border-[1.5px] focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft",
          )}
        >
          <span className={cn("truncate", value.length === 0 && "text-guide-text")}>
            {summary}
          </span>
          <ChevronDown
            className={cn(
              "ml-2 size-4 shrink-0 text-ink-muted transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] rounded-[12px] border-0 p-0 shadow-dropdown"
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
      >
        <Command
          value={activeValue}
          onValueChange={setActiveValue}
          className="rounded-[12px] [&_[cmdk-input-wrapper]]:px-4 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input-wrapper]_svg]:-translate-x-0.5"
        >
          <CommandInput
            placeholder="항목 검색"
            className="h-11 text-[15px] placeholder:text-guide-text"
          />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const selected = value.includes(option);
                return (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => toggleValue(option)}
                    className={cn(
                      "min-h-10 rounded-[8px] text-ink data-[selected=true]:bg-dropdown-hover data-[selected=true]:text-ink",
                      selected &&
                        "font-bold text-brand data-[selected=true]:bg-dropdown-selected-hover data-[selected=true]:text-brand",
                    )}
                  >
                    <span className="flex-1 pl-1">{option}</span>
                    {selected ? <Check className="size-[18px] text-brand" /> : null}
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
