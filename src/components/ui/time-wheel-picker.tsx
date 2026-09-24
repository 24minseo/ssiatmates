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
  loop?: boolean;
  inputKind?: "hour" | "minute";
};

const WHEEL_ITEM_HEIGHT = 36;
const TIME_WHEEL_LOOP_COPIES = 5;
const TIME_WHEEL_CENTER_COPY = Math.floor(TIME_WHEEL_LOOP_COPIES / 2);
const HOURS = [
  "12",
  ...Array.from({ length: 11 }, (_, index) => String(index + 1).padStart(2, "0")),
];
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

  if (parts.minute === "00" && parts.meridiem === "오전" && parts.hour === "12") {
    return "자정 00:00";
  }
  if (parts.minute === "00" && parts.meridiem === "오후" && parts.hour === "12") {
    return "정오 12:00";
  }

  return `${parts.meridiem} ${parts.hour}:${parts.minute}`;
}

function TimeWheel({
  label,
  options,
  value,
  open,
  onChange,
  loop = true,
  inputKind,
}: TimeWheelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const latestOptionsRef = useRef(options);
  const latestValueRef = useRef(value);
  const previousFiniteValueRef = useRef(value);
  const cancelInputRef = useRef(false);
  const suppressScrollRef = useRef(false);
  const suppressScrollTimeoutRef = useRef<number | null>(null);
  latestOptionsRef.current = options;
  latestValueRef.current = value;
  const loopCopies = loop ? TIME_WHEEL_LOOP_COPIES : 1;
  const loopCenterCopy = loop ? TIME_WHEEL_CENTER_COPY : 0;
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const scrollToPosition = (top: number, behavior: ScrollBehavior) => {
    if (behavior === "smooth") {
      suppressScrollRef.current = true;
      if (suppressScrollTimeoutRef.current !== null) {
        window.clearTimeout(suppressScrollTimeoutRef.current);
      }
      suppressScrollTimeoutRef.current = window.setTimeout(() => {
        suppressScrollRef.current = false;
        suppressScrollTimeoutRef.current = null;
      }, 300);
    }

    listRef.current?.scrollTo({ top, behavior });
  };

  const scrollToValue = (nextValue: string, behavior: ScrollBehavior = "smooth") => {
    const index = options.indexOf(nextValue);
    if (index < 0) return;
    scrollToPosition(
      (loopCenterCopy * options.length + index) * WHEEL_ITEM_HEIGHT,
      behavior,
    );
  };

  useEffect(() => {
    if (!open) return;
    const index = latestOptionsRef.current.indexOf(latestValueRef.current);
    if (index < 0) return;
    const frame = window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: (loopCenterCopy * latestOptionsRef.current.length + index) * WHEEL_ITEM_HEIGHT,
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (suppressScrollTimeoutRef.current !== null) {
        window.clearTimeout(suppressScrollTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || loop) return;
    const index = options.indexOf(value);
    if (index < 0) return;
    const shouldAnimate = previousFiniteValueRef.current !== value;
    previousFiniteValueRef.current = value;

    const frame = window.requestAnimationFrame(() => {
      scrollToPosition(
        index * WHEEL_ITEM_HEIGHT,
        shouldAnimate ? "smooth" : "auto",
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, loop, options, value]);

  const beginNumericInput = () => {
    if (!inputKind) return;
    cancelInputRef.current = false;
    setInputValue(value);
    setIsEditing(true);
  };

  const cancelNumericInput = () => {
    if (!isEditing) return;
    cancelInputRef.current = true;
    setInputValue(value);
    setIsEditing(false);
  };

  const commitNumericInput = () => {
    if (!inputKind) return;
    if (cancelInputRef.current) {
      cancelInputRef.current = false;
      setInputValue(value);
      setIsEditing(false);
      return;
    }
    const digits = inputValue.replace(/\D/g, "").slice(0, 2);
    if (!digits) {
      setInputValue(value);
      setIsEditing(false);
      return;
    }

    const parsed = Number(digits);
    const min = inputKind === "hour" ? 1 : 0;
    const max = inputKind === "hour" ? 12 : 59;
    const bounded = Math.min(max, Math.max(min, parsed));
    const nextValue = String(bounded).padStart(2, "0");
    setInputValue(nextValue);
    setIsEditing(false);
    if (nextValue !== value) onChange(nextValue);
    requestAnimationFrame(() => scrollToValue(nextValue, "auto"));
  };

  const selectIndex = (index: number) => {
    const nextIndex = loop
      ? ((index % options.length) + options.length) % options.length
      : Math.min(options.length - 1, Math.max(0, index));
    const nextValue = options[nextIndex];
    if (!nextValue) return;
    if (nextValue !== value) onChange(nextValue);
    scrollToValue(nextValue);
  };

  const handleScroll = () => {
    if (isEditing) cancelNumericInput();
    if (suppressScrollRef.current) return;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = window.requestAnimationFrame(() => {
      const rawIndex = Math.round(
        (listRef.current?.scrollTop ?? 0) / WHEEL_ITEM_HEIGHT,
      );
      const normalizedIndex =
        ((rawIndex % options.length) + options.length) % options.length;
      const firstEdge = loopCenterCopy * options.length;
      const lastEdge = (loopCenterCopy + 1) * options.length;

      if (
        loop &&
        (rawIndex < firstEdge || rawIndex >= lastEdge)
      ) {
        listRef.current?.scrollTo({
          top: (loopCenterCopy * options.length + normalizedIndex) * WHEEL_ITEM_HEIGHT,
          behavior: "auto",
        });
      }

      const nextValue = options[normalizedIndex];
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
    <div className="relative before:pointer-events-none before:absolute before:inset-x-0 before:top-[73px] before:z-0 before:h-[34px] before:rounded-[8px] before:bg-[#F4F6F5] before:content-['']">
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={handleScroll}
        onPointerDown={(event) => {
          if (isEditing && !(event.target instanceof HTMLInputElement)) {
            cancelNumericInput();
          }
        }}
        onKeyDown={handleKeyDown}
        className="relative z-10 h-[180px] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[8px] py-[72px] outline-none [scrollbar-width:none] focus-visible:ring-[3.2px] focus-visible:ring-focus-soft [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: loopCopies }, (_, copyIndex) =>
          options.map((option) => ({ option, copyIndex })),
        )
          .flat()
          .map(({ option, copyIndex }) => {
            const selected = option === value && copyIndex === loopCenterCopy;

            return (
              <div key={`${copyIndex}-${option}`} className="flex h-9 snap-center items-center">
              {selected && inputKind && isEditing ? (
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  role="option"
                  aria-label={`${label} 숫자 입력`}
                  aria-selected="true"
                  value={inputValue}
                  maxLength={2}
                  onChange={(event) => setInputValue(event.target.value.replace(/\D/g, "").slice(0, 2))}
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitNumericInput();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setInputValue(value);
                      setIsEditing(false);
                    }
                  }}
                  onBlur={commitNumericInput}
                  className="flex h-[34px] w-full items-center justify-center rounded-[8px] border border-brand bg-transparent text-center text-[14px] font-semibold text-brand outline-none ring-0 focus-visible:border-brand focus-visible:ring-0"
                />
              ) : (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onClick={() => {
                    if (selected && inputKind) {
                      beginNumericInput();
                      return;
                    }
                    onChange(option);
                    scrollToValue(option);
                  }}
                  className={cn(
                    "flex h-[34px] w-full items-center justify-center rounded-[8px] text-[14px] transition-colors",
                    selected
                      ? "font-semibold text-brand"
                      : "font-normal text-ink-muted hover:text-brand",
                  )}
                >
                  {option}
                </button>
              )}
            </div>
            );
          })}
      </div>
      {isEditing && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[73px] z-20 h-[34px] rounded-[8px] ring-[3.2px] ring-focus-soft"
        />
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-8 rounded-t-[8px] bg-gradient-to-b from-canvas to-transparent"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-8 rounded-b-[8px] bg-gradient-to-t from-canvas to-transparent"
      />
    </div>
  );
}

type TimeWheelPickerPanelProps = {
  draft: TimeParts;
  open: boolean;
  onChange: (draft: TimeParts) => void;
  onClear: () => void;
  onComplete: () => void;
};

function TimeWheelPickerPanel({
  draft,
  open,
  onChange,
  onClear,
  onComplete,
}: TimeWheelPickerPanelProps) {
  return (
    <div className="bg-canvas">
      <div className="grid grid-cols-[64px_64px_64px] justify-center gap-4">
        <TimeWheel
          label="오전 또는 오후"
          options={MERIDIEMS}
          value={draft.meridiem}
          loop={false}
          open={open}
          onChange={(meridiem) =>
            onChange({ ...draft, meridiem: meridiem as Meridiem })
          }
        />
        <TimeWheel
          label="시"
          options={HOURS}
          value={draft.hour}
          inputKind="hour"
          open={open}
          onChange={(hour) => {
            const crossedBoundary =
              (draft.hour === "11" && hour === "12") ||
              (draft.hour === "12" && hour === "11");
            onChange({
              ...draft,
              hour,
              meridiem: crossedBoundary
                ? draft.meridiem === "오전"
                  ? "오후"
                  : "오전"
                : draft.meridiem,
            });
          }}
        />
        <TimeWheel
          label="분"
          options={MINUTES}
          value={draft.minute}
          inputKind="minute"
          open={open}
          onChange={(minute) => onChange({ ...draft, minute })}
        />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-field-border px-2 pt-2">
        <button
          type="button"
          onClick={onClear}
          className="h-8 rounded-[8px] px-2 text-[13px] font-normal text-ink-muted hover:bg-item-hover"
        >
          시간 없음
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="px-2 text-[13px] font-semibold text-brand hover:underline"
        >
          완료
        </button>
      </div>
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
      modal
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
        className="w-[252px] rounded-[12px] border-0 bg-canvas p-2 shadow-dropdown"
      >
        <TimeWheelPickerPanel
          draft={draft}
          open={open}
          onChange={updateDraft}
          onClear={() => {
            onChange("");
            setOpen(false);
          }}
          onComplete={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
