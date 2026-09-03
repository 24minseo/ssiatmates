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

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next || !disabled) setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-12 w-full items-center justify-between rounded-[12px] border border-field-border bg-surface px-4 text-left text-[15px] text-ink transition-colors",
            "focus:outline-none focus-visible:border-[1.5px] focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft",
            "disabled:cursor-not-allowed disabled:bg-field-border/25",
          )}
        >
          <span className={cn("truncate", !value && "text-placeholder", disabled && "text-[#A8B4B0]")}>
            {value ?? placeholder}
          </span>
          <ChevronDown
            className={cn(
              "ml-2 size-4 shrink-0 text-ink-muted transition-transform duration-200",
              open && "rotate-180",
              disabled && "text-[#A8B4B0]",
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
        <Command className="rounded-[12px] [&_[cmdk-input-wrapper]]:px-4 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input-wrapper]_svg]:-translate-x-0.5">
          <CommandInput placeholder="지역 검색" className="h-11 text-[15px]" />
          <CommandList className="max-h-[220px]">
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
                  className={cn(
                    "min-h-10 text-ink data-[selected=true]:bg-item-hover data-[selected=true]:text-ink",
                    value === region.label &&
                      "font-bold text-brand data-[selected=true]:bg-item-hover-selected data-[selected=true]:text-brand",
                  )}
                >
                  <span className="flex-1 pl-1">{region.label}</span>
                  {value === region.label ? (
                    <Check className="size-[18px] text-brand" />
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
