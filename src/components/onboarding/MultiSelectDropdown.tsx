import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface MultiSelectDropdownProps {
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string | undefined;
  id?: string | undefined;
}

export function MultiSelectDropdown({
  options,
  value,
  onChange,
  placeholder = "선택해주세요",
  id,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);

  const toggle = (option: string) => {
    onChange(
      value.includes(option)
        ? value.filter((item) => item !== option)
        : [...value, option],
    );
  };

  const remove = (option: string) => {
    onChange(value.filter((item) => item !== option));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex min-h-12 w-full items-center justify-between gap-2 rounded-[12px] border border-field-border bg-surface px-4 py-2 text-left text-sm text-ink transition-colors",
            "focus:outline-none focus-visible:border-[1.5px] focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft",
          )}
        >
          {value.length === 0 ? (
            <span className="text-placeholder">{placeholder}</span>
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {value.map((item) => (
                <span
                  key={item}
                  className="inline-flex h-7 items-center gap-1 rounded-full border-0 bg-[#F5F5F5] pl-2.5 pr-[7px] text-xs text-ink"
                >
                  <span>{item}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`${item} 선택 해제`}
                    className="inline-flex rounded-sm text-ink hover:bg-[#ECEFED]"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      remove(item);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        remove(item);
                      }
                    }}
                  >
                    <X aria-hidden className="size-3" strokeWidth={2.5} />
                  </span>
                </span>
              ))}
            </span>
          )}
          <ChevronDown
            className={cn(
              "ml-1 size-4 shrink-0 text-ink-muted transition-transform duration-200",
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
        <Command className="rounded-[12px]">
          <CommandList className="max-h-[220px]">
            <CommandEmpty>항목이 없습니다.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const selected = value.includes(option);
                return (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => toggle(option)}
                    className={cn(
                      "min-h-10 text-ink data-[selected=true]:bg-item-hover data-[selected=true]:text-ink",
                      selected &&
                        "font-bold text-brand data-[selected=true]:bg-item-hover-selected data-[selected=true]:text-brand",
                    )}
                  >
                    <span className="flex-1">{option}</span>
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
