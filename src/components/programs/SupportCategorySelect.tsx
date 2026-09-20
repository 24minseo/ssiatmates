import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PillGroup } from "@/components/onboarding/PillGroup";
import { SUPPORT_CATEGORIES, SUPPORT_ALL } from "@/components/onboarding/constants";

type SupportCategorySelectProps = { value: string[]; onChange: (value: string[]) => void; };

export function SupportCategorySelect({ value, onChange }: SupportCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const visible = value.includes(SUPPORT_ALL) ? "모든 지원 분야" : value.length > 0 ? value[0] + (value.length > 1 ? " 외 " + (value.length - 1) + "개" : "") : "모든 지원 분야";
  const toggle = (option: string) => {
    if (option === SUPPORT_ALL) { onChange([SUPPORT_ALL]); return; }
    const next = value.filter((item) => item !== SUPPORT_ALL);
    const updated = next.includes(option) ? next.filter((item) => item !== option) : [...next, option];
    onChange(updated.length ? updated : [SUPPORT_ALL]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button type="button" aria-expanded={open} className="flex h-12 w-full items-center justify-between rounded-xl border border-border bg-white px-6 text-left text-[15px] font-medium text-ink"><span>{visible}</span><ChevronDown className={"size-4 transition-transform " + (open ? "rotate-180" : "")} /></button></PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[420px] rounded-xl border-0 bg-white p-4 shadow-dropdown"><PillGroup options={SUPPORT_CATEGORIES} value={value} onToggle={toggle} /></PopoverContent>
    </Popover>
  );
}