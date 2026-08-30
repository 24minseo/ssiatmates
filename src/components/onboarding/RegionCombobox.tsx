import { useState } from "react";
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
import { regions } from "@/data/regions";
import { cn } from "@/lib/utils";

interface RegionComboboxProps {
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
}

export function RegionCombobox({
  value,
  onChange,
  placeholder = "지역을 선택해주세요",
  disabled = false,
  id,
}: RegionComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-12 w-full items-center justify-between rounded-xl border border-field-border bg-surface px-4 text-left text-sm text-ink transition-colors",
            "focus:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20",
            "disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-ink-muted",
          )}
        >
          <span className={cn("truncate", !value && "text-ink-muted")}>
            {value ?? placeholder}
          </span>
          <ChevronDown className="ml-2 size-4 shrink-0 text-ink-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="지역 검색" />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {regions.map((region) => (
                <CommandItem
                  key={region.label}
                  value={region.label}
                  onSelect={() => {
                    onChange(region.label);
                    setOpen(false);
                  }}
                  className="text-ink"
                >
                  <span className="flex-1">{region.label}</span>
                  {value === region.label ? (
                    <Check className="size-4 text-brand" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
