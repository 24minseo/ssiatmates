import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Meridiem = "오전" | "오후";

type TimeParts = {
  meridiem: Meridiem;
  hour: string;
  minute: string;
};

type TimeWheelPickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

type TimeWheelProps = {
  label: string;
  options: readonly string[];
  value: string;
  open: boolean;
  onChange: (value: string) => void;
};

const WHEEL_ITEM_HEIGHT = 36;
const HOURS = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const MERIDIEMS = ["오전", "오후"] as const;

function getTimeParts(value: string): TimeParts {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const now = new Date();
  const hour24 = match ? Number(match[1]) : now.getHours();
  const minute = match ? Number(match[2]) : now.getMinutes();

  return {
    meridiem: hour24 >= 12 ? "오후" : "오전",
    hour: String(hour24 % 12 || 12).padStart(2, "0"),
    minute: String(Math.min(59, Math.max(0, minute))).padStart(2, "0"),
  };
}

function toTimeValue(parts: TimeParts) {
  const hour12 = Number(parts.hour);
  const hour24 =
    parts.meridiem === "오후"
      ? hour12 === 12
        ? 12
        : hour12 + 12
      : hour12 === 12
        ? 0
        : hour12;

  return `${String(hour24).padStart(2, "0")}:${parts.minute}`;
}

function formatTimeLabel(value: string) {
  if (!value) return "";
  const parts = getTimeParts(value);
  return `${parts.meridiem} ${parts.hour}:${parts.minute}`;
}

function TimeWheel({
  label,
  options,
  value,
  open,
  onChange,
}: TimeWheelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  const scrollToValue = (nextValue: string, behavior: ScrollBehavior = "smooth") => {
    const index = options.indexOf(nextValue);
    if (index < 0) return;
    listRef.current?.scrollTo({
      top: index * WHEEL_ITEM_HEIGHT,
      behavior,
    });
  };

  useEffect(() => {
    if (!open) return;
    const index = options.indexOf(value);
    if (index < 0) return;
    const frame = window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: index * WHEEL_ITEM_HEIGHT,
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, options, value]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const selectIndex = (index: number) => {
    const boundedIndex = Math.min(options.length - 1, Math.max(0, index));
    const nextValue = options[boundedIndex];
    if (!nextValue) return;
    if (nextValue !== value) onChange(nextValue);
    scrollToValue(nextValue);
  };

  const handleScroll = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = window.requestAnimationFrame(() => {
      const nextIndex = Math.min(
        options.length - 1,
        Math.max(0, Math.round((listRef.current?.scrollTop ?? 0) / WHEEL_ITEM_HEIGHT)),
      );
      const nextValue = options[nextIndex];
      if (nextValue && nextValue !== value) onChange(nextValue);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = Math.max(0, options.indexOf(value));
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectIndex(currentIndex - 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      selectIndex(currentIndex + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectIndex(options.length - 1);
    }
  };

  return (
    <div className="relative">
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className="h-[180px] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[8px] py-[72px] outline-none [scrollbar-width:none] focus-visible:ring-[3.2px] focus-visible:ring-focus-soft [&::-webkit-scrollbar]:hidden"
      >
        {options.map((option) => {
          const selected = option === value;

          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={-1}
              onClick={() => {
                onChange(option);
                scrollToValue(option);
              }}
              className={cn(
                "flex h-9 w-full snap-center items-center justify-center rounded-[8px] text-[14px] transition-colors",
                selected
                  ? "bg-item-hover-selected font-semibold text-brand"
                  : "font-normal text-ink-muted hover:bg-item-hover",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-[8px] bg-gradient-to-b from-surface to-transparent"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-[8px] bg-gradient-to-t from-surface to-transparent"
      />
    </div>
  );
}

export function TimeWheelPicker({
  id,
  value,
  onChange,
  placeholder = "시작 시간 선택",
}: TimeWheelPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TimeParts>(() => getTimeParts(value));

  const updateDraft = (nextDraft: TimeParts) => {
    setDraft(nextDraft);
    onChange(toTimeValue(nextDraft));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraft(getTimeParts(value));
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={value ? `시작 시간 ${formatTimeLabel(value)}` : placeholder}
          className="flex h-12 w-full items-center justify-between rounded-[12px] border border-field-border bg-surface px-3.5 text-left text-[15px] text-ink shadow-none outline-none transition-colors hover:bg-item-hover focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
        >
          <span className={value ? "text-ink" : "text-guide-text"}>
            {value ? formatTimeLabel(value) : placeholder}
          </span>
          <img
            src="/assets/clock/21.svg"
            alt=""
            aria-hidden="true"
            className="size-5 object-contain"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[252px] rounded-[12px] border-0 bg-surface p-2 shadow-dropdown"
      >
        <div className="grid grid-cols-[72px_72px_72px] justify-center gap-1">
          <TimeWheel
            label="오전 또는 오후"
            options={MERIDIEMS}
            value={draft.meridiem}
            open={open}
            onChange={(meridiem) =>
              updateDraft({ ...draft, meridiem: meridiem as Meridiem })
            }
          />
          <TimeWheel
            label="시"
            options={HOURS}
            value={draft.hour}
            open={open}
            onChange={(hour) => updateDraft({ ...draft, hour })}
          />
          <TimeWheel
            label="분"
            options={MINUTES}
            value={draft.minute}
            open={open}
            onChange={(minute) => updateDraft({ ...draft, minute })}
          />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-field-border pt-2">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="h-8 rounded-[8px] px-2 text-[13px] font-normal text-ink-muted hover:bg-item-hover"
          >
            시간 없음
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-9 rounded-[10px] bg-brand px-4 text-[13px] font-semibold text-brand-foreground hover:bg-brand/88"
          >
            완료
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
