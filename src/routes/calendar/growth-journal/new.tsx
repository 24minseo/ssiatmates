import {
  ArrowUp,
  Bold,
  ChevronLeft,
  ChevronRight,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RotateCcw,
  Strikethrough,
  Undo2,
  X,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/calendar/growth-journal/new")({
  head: () => ({ meta: [{ title: "성장일지 작성" }] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    date?: string;
    from?: "calendar" | "journal" | "detail";
    id?: string;
    returnId?: string;
  } => ({
    ...(typeof search["id"] === "string" ? { id: search["id"] } : {}),
    ...(typeof search["returnId"] === "string" ? { returnId: search["returnId"] } : {}),
    ...(typeof search["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search["date"])
      ? { date: search["date"] }
      : {}),
    from:
      search["from"] === "calendar" || search["from"] === "journal" || search["from"] === "detail"
        ? search["from"]
        : "journal",
  }),
  component: GrowthJournalNewPage,
});

const MAX_TAGS = 5;
const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const JOURNAL_IMAGE_BUCKET = "growth-journal-images";
type DateEditPart = "year" | "month" | "day";

type JournalDraftSnapshot = {
  title: string;
  content: string;
  recordDate: string;
  tags: string[];
  imagePaths: string[];
};

function normalizeDraftContent(content: string) {
  return content
    .replace(/<p>(?:\s|<br\s*\/?>)*<\/p>/gi, "")
    .replace(/\s+/g, "")
    .trim();
}

function getTodayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRecordDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}년 ${month.padStart(2, "0")}월 ${day.padStart(2, "0")}일`;
}

function splitRecordDate(value: string) {
  const [year = "", month = "", day = ""] = value.split("-");
  return { year, month, day };
}

function hasInvalidDatePart(date: { year: string; month: string; day: string }) {
  if (date.year.length === 4) {
    const year = Number(date.year);
    if (year < 1900 || year > 2100) return true;
  }
  if (date.month && (Number(date.month) < 1 || Number(date.month) > 12)) return true;
  if (date.day && (Number(date.day) < 1 || Number(date.day) > 31)) return true;
  return false;
}

function buildJournalCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil((firstDay.getDay() + daysInMonth) / 7);
  const firstVisibleDate = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: weekCount * 7 }, (_, index) => {
    const date = new Date(
      firstVisibleDate.getFullYear(),
      firstVisibleDate.getMonth(),
      firstVisibleDate.getDate() + index,
    );
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date, key, isCurrentMonth: date.getMonth() === month && date.getFullYear() === year };
  });
}

type JournalDatePickerProps = {
  value: string;
  resetValue: string;
  onChange: (value: string) => void;
};

function JournalDatePicker({ value, resetValue, onChange }: JournalDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = new Date(`${value}T00:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [transition, setTransition] = useState<{
    from: Date;
    to: Date;
    direction: "next" | "previous";
    phase: "start" | "end";
  } | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const transitionTimeout = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
      if (transitionTimeout.current !== null) window.clearTimeout(transitionTimeout.current);
    },
    [],
  );

  const moveMonth = (offset: number) => {
    const direction = offset > 0 ? "next" : "previous";
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setTransition({ from: visibleMonth, to: next, direction, phase: "start" });
    setVisibleMonth(next);
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    if (transitionTimeout.current !== null) window.clearTimeout(transitionTimeout.current);
    transitionFrame.current = window.requestAnimationFrame(() => {
      setTransition((current) =>
        current?.to.getTime() === next.getTime() ? { ...current, phase: "end" } : current,
      );
      transitionFrame.current = null;
    });
    transitionTimeout.current = window.setTimeout(() => setTransition(null), 220);
  };

  const selectDate = (date: Date) => {
    onChange(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    );
    setOpen(false);
  };

  const resetDate = () => {
    const reset = new Date(`${resetValue}T00:00:00`);
    setVisibleMonth(new Date(reset.getFullYear(), reset.getMonth(), 1));
    onChange(resetValue);
    setOpen(false);
  };

  const goToday = () => {
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onChange(getTodayDateValue());
    setOpen(false);
  };

  const renderMonth = (monthDate: Date) => {
    const days = buildJournalCalendarDays(monthDate.getFullYear(), monthDate.getMonth());
    return (
      <div
        key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
        className={cn("shrink-0", transition ? "w-1/2" : "w-full")}
      >
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const selected = day.key === value;
            return (
              <div key={day.key} className="relative flex h-10 items-center justify-center">
                <button
                  type="button"
                  onClick={() => selectDate(day.date)}
                  className={cn(
                    "group relative z-10 flex size-10 items-center justify-center rounded-[10px] text-[14px] font-normal",
                    !day.isCurrentMonth && !selected && "text-content-disabled",
                    day.isCurrentMonth && !selected && "text-ink-muted",
                    selected && "text-white",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center transition-colors",
                      day.isCurrentMonth && !selected && "size-8 rounded-[8px] group-hover:bg-pill",
                      selected && "size-8 rounded-[8px] bg-brand text-white",
                    )}
                  >
                    {day.date.getDate()}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          const date = new Date(`${value}T00:00:00`);
          setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
          setTransition(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${formatRecordDate(value)} 기록일 선택`}
          className="group flex h-10 w-auto items-center gap-3 rounded-[8px] px-3 text-left text-[15px] font-semibold text-ink transition-colors hover:bg-item-hover data-[state=open]:bg-item-hover focus-visible:bg-item-hover focus-visible:outline-none focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
        >
          <img
            src="/assets/calendar/21.svg"
            alt=""
            aria-hidden="true"
            className="size-5 object-contain opacity-100 brightness-[0.72] transition-[filter] group-hover:brightness-[0.52] group-data-[state=open]:brightness-[0.52]"
          />
          <span>{value.replaceAll("-", ".")}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[304px] max-w-[calc(100vw-24px)] rounded-[16px] border-0 bg-surface p-3 shadow-dropdown"
      >
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-left text-[15px] font-semibold text-ink">
            {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="이전 달"
              onClick={() => moveMonth(-1)}
              className="size-8 rounded-[8px] text-ink-muted hover:bg-item-hover hover:text-ink"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="다음 달"
              onClick={() => moveMonth(1)}
              className="size-8 rounded-[8px] text-ink-muted hover:bg-item-hover hover:text-ink"
            >
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-7 text-center text-[13px] font-medium text-ink">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <span key={day} className="flex h-8 items-center justify-center">
              {day}
            </span>
          ))}
        </div>
        <div className="overflow-hidden">
          <div
            className={cn(
              "flex",
              transition &&
                "transition-transform duration-200 ease-in-out motion-reduce:transition-none",
              transition ? "w-[200%]" : "w-full",
            )}
            style={
              transition
                ? {
                    transform:
                      transition.phase === "start"
                        ? transition.direction === "next"
                          ? "translateX(0)"
                          : "translateX(-50%)"
                        : transition.direction === "next"
                          ? "translateX(-50%)"
                          : "translateX(0)",
                  }
                : undefined
            }
          >
            {(transition
              ? transition.direction === "next"
                ? [transition.from, transition.to]
                : [transition.to, transition.from]
              : [visibleMonth]
            ).map((month) => renderMonth(month))}
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-field-border px-1 pt-2.5">
          <button
            type="button"
            onClick={resetDate}
            className="inline-flex h-8 items-center gap-1 px-1 text-[13px] text-ink-muted hover:text-ink hover:underline hover:underline-offset-2"
          >
            <RotateCcw aria-hidden className="size-3.5" strokeWidth={2} />
            초기화
          </button>
          <button
            type="button"
            onClick={goToday}
            className="h-8 px-1 text-[13px] font-semibold text-brand hover:underline hover:underline-offset-2"
          >
            오늘
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GrowthJournalNewPage() {
  const { date: initialDate, from, id: editId, returnId } = Route.useSearch();
  const navigate = useNavigate();
  const initialRecordDate = initialDate ?? getTodayDateValue();
  const [title, setTitle] = useState("");
  const [recordDate, setRecordDate] = useState(initialRecordDate);
  const [isDateEditing, setIsDateEditing] = useState(false);
  const [dateEditPart, setDateEditPart] = useState<DateEditPart>("year");
  const [draftDate, setDraftDate] = useState(() => splitRecordDate(initialRecordDate));
  const [dateInputError, setDateInputError] = useState(false);
  const [dateBoxWidths, setDateBoxWidths] = useState({ display: 0, editing: 0 });
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [stickySaveStyle, setStickySaveStyle] = useState<CSSProperties>();
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const imageUrlPathsRef = useRef(new Map<string, string>());
  const imageDataPathsRef = useRef(new Map<string, string>());
  const initialDraftRef = useRef<JournalDraftSnapshot>({
    title: "",
    content: "",
    recordDate: initialRecordDate,
    tags: [],
    imagePaths: [],
  });
  const allowSavedNavigationRef = useRef(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const saveAnchorRef = useRef<HTMLDivElement>(null);
  const saveStickyRef = useRef(false);
  const dateEditorRef = useRef<HTMLDivElement>(null);
  const dateButtonRef = useRef<HTMLDivElement>(null);
  const dateYearRef = useRef<HTMLInputElement>(null);
  const dateMonthRef = useRef<HTMLInputElement>(null);
  const dateDayRef = useRef<HTMLInputElement>(null);
  const markDirty = () => {
    setSaved(false);
    setIsDirty(true);
  };

  useEffect(() => {
    const scrollContainer = document.querySelector("main");
    if (!scrollContainer) return;
    const handleScroll = () => setShowBackToTop(scrollContainer.scrollTop > 120);
    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const scrollContainer = document.querySelector("main");
    const toolbar = toolbarRef.current;
    if (!scrollContainer || !toolbar) return;
    const containerRect = scrollContainer.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const stickyStart = toolbarRect.top - containerRect.top + scrollContainer.scrollTop;
    let frameId = 0;
    const updatePosition = () => {
      const isSticky = scrollContainer.scrollTop >= stickyStart;
      if (isSticky === saveStickyRef.current) return;
      saveStickyRef.current = isSticky;
      if (!isSticky) {
        setStickySaveStyle(undefined);
        return;
      }
      const targetRect = toolbar.getBoundingClientRect();
      setStickySaveStyle({
        top: `${targetRect.top + (targetRect.height - 42) / 2 + 8}px`,
        right: `${window.innerWidth - targetRect.right}px`,
        opacity: 0,
        transform: "scale(0.8)",
      });
      window.requestAnimationFrame(() => {
        setStickySaveStyle({
          top: `${targetRect.top + (targetRect.height - 42) / 2}px`,
          right: `${window.innerWidth - targetRect.right}px`,
          opacity: 1,
          transform: "scale(1)",
        });
      });
    };
    const handleScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updatePosition);
    };
    saveStickyRef.current = scrollContainer.scrollTop >= stickyStart;
    if (saveStickyRef.current) {
      const rect = toolbar.getBoundingClientRect();
      setStickySaveStyle({
        top: `${rect.top + (rect.height - 42) / 2}px`,
        right: `${window.innerWidth - rect.right}px`,
      });
    }
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      cancelAnimationFrame(frameId);
      scrollContainer.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: "오늘의 성장과 생각을 기록해보세요." }),
    ],
    content: "",
    onUpdate: () => {
      setEditorVersion((version) => version + 1);
      markDirty();
    },
    onSelectionUpdate: () => setEditorVersion((version) => version + 1),
  });

  useEffect(() => {
    if (!editor) return;
    const initial = initialDraftRef.current;
    const isSameTags = tags.length === initial.tags.length && tags.every((tag, index) => tag === initial.tags[index]);
    const isSameImages = imagePaths.length === initial.imagePaths.length && imagePaths.every((path, index) => path === initial.imagePaths[index]);
    const nextIsDirty =
      title.trim() !== initial.title.trim() ||
      normalizeDraftContent(editor.getHTML()) !== initial.content ||
      recordDate !== initial.recordDate ||
      !isSameTags ||
      !isSameImages;
    setIsDirty(nextIsDirty);
    if (nextIsDirty) setSaved(false);
  }, [editor, editorVersion, imagePaths, recordDate, tags, title]);

  useEffect(() => {
    if (!editor || !editId) return;
    let cancelled = false;

    const loadEntry = async () => {
      const { data, error } = await supabase
        .from("startup_diaries")
        .select("diary_date, title, content, tags, image_paths")
        .eq("id", editId)
        .maybeSingle();
      if (cancelled || error || !data) return;

      setTitle(data.title);
      setRecordDate(data.diary_date);
      setTags(data.tags);
      setImagePaths(data.image_paths);

      let hydratedContent = data.content ?? "";
      for (const path of data.image_paths) {
        const { data: signedUrlData } = await supabase.storage
          .from(JOURNAL_IMAGE_BUCKET)
          .createSignedUrl(path, 60 * 60);
        if (!signedUrlData?.signedUrl) continue;
        const storageUrl = `storage://${path}`;
        imageUrlPathsRef.current.set(signedUrlData.signedUrl, storageUrl);
        hydratedContent = hydratedContent.split(storageUrl).join(signedUrlData.signedUrl);
      }
      editor.commands.setContent(hydratedContent, { emitUpdate: false });
      initialDraftRef.current = {
        title: data.title,
        content: normalizeDraftContent(hydratedContent),
        recordDate: data.diary_date,
        tags: [...data.tags],
        imagePaths: [...data.image_paths],
      };
      setIsDirty(false);
    };

    void loadEntry();
    return () => {
      cancelled = true;
    };
  }, [editId, editor]);

  useEffect(() => {
    const element = isDateEditing ? dateEditorRef.current : dateButtonRef.current;
    if (!element) return;

    const updateWidth = () => {
      const width = Math.ceil(element.scrollWidth);
      setDateBoxWidths((current) =>
        isDateEditing ? { ...current, editing: width } : { ...current, display: width },
      );
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isDateEditing, recordDate]);
  const hasUnsavedContent = !saved && isDirty;
  const blocker = useBlocker({
    shouldBlockFn: () => !allowSavedNavigationRef.current && hasUnsavedContent,
    enableBeforeUnload: hasUnsavedContent,
    withResolver: true,
  });

  const addTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) {
      setTagInput("");
      return;
    }
    markDirty();
    setTags((current) => {
      if (current.includes(nextTag) || current.length >= MAX_TAGS) return current;
      return [...current, nextTag];
    });
    setTagInput("");
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
    if (event.key === "Backspace" && !tagInput && tags.length > 0) {
      markDirty();
      setTags((current) => current.slice(0, -1));
    }
  };

  const beginDateEditing = () => {
    setDraftDate(splitRecordDate(recordDate));
    setDateInputError(false);
    setDateEditPart("year");
    setIsDateEditing(true);
    window.requestAnimationFrame(() => dateYearRef.current?.select());
  };

  const focusDatePart = (part: DateEditPart) => {
    setDateInputError(false);
    setDateEditPart(part);
    setIsDateEditing(true);
    window.requestAnimationFrame(() => {
      const input =
        part === "year"
          ? dateYearRef.current
          : part === "month"
            ? dateMonthRef.current
            : dateDayRef.current;
      input?.focus();
      input?.select();
    });
  };

  const cancelDateEditing = () => {
    setDateInputError(false);
    setDateEditPart("year");
    setIsDateEditing(false);
  };

  const adjustDatePart = (part: DateEditPart, amount: number) => {
    setDraftDate((current) => {
      const year = Number(current.year) || new Date().getFullYear();
      const month = Number(current.month) || 1;
      const day = Number(current.day) || 1;
      if (part === "year") {
        return { ...current, year: String(Math.min(2100, Math.max(1900, year + amount))) };
      }
      if (part === "month") {
        return {
          ...current,
          month: String(Math.min(12, Math.max(1, month + amount))).padStart(2, "0"),
        };
      }
      const daysInMonth = new Date(year, month, 0).getDate();
      return {
        ...current,
        day: String(Math.min(daysInMonth, Math.max(1, day + amount))).padStart(2, "0"),
      };
    });
    setDateInputError(false);
  };

  const commitDateEditing = () => {
    const year = Number(draftDate.year);
    const month = Number(draftDate.month);
    const day = Number(draftDate.day);
    const nextDate = new Date(year, month - 1, day);
    const isValid =
      /^\d{4}$/.test(draftDate.year) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      nextDate.getFullYear() === year &&
      nextDate.getMonth() === month - 1 &&
      nextDate.getDate() === day;

    if (!isValid) {
      setDateInputError(true);
      return;
    }

    setRecordDate(
      `${draftDate.year}-${draftDate.month.padStart(2, "0")}-${draftDate.day.padStart(2, "0")}`,
    );
    markDirty();
    setDateInputError(false);
    setIsDateEditing(false);
  };

  const handleImagePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !editor) return;

    const invalidFile = files.find(
      (file) => !file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE_BYTES,
    );
    if (invalidFile) {
      setSaveError("이미지는 파일당 10MB 이하만 첨부할 수 있어요.");
      event.target.value = "";
      return;
    }
    if (imagePaths.length + files.length > MAX_IMAGES) {
      setSaveError(`이미지는 최대 ${MAX_IMAGES}개까지 첨부할 수 있어요.`);
      event.target.value = "";
      return;
    }

    const sources = await Promise.all(
      files.map(
        (file) =>
          new Promise<{ alt: string; src: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string")
                resolve({ alt: file.name, src: reader.result });
              else reject(new Error("이미지를 읽을 수 없습니다."));
            };
            reader.onerror = () => reject(reader.error ?? new Error("이미지를 읽을 수 없습니다."));
            reader.readAsDataURL(file);
          }),
      ),
    );

    editor
      .chain()
      .focus()
      .insertContent(
        sources.map(({ alt, src }) => ({
          type: "image",
          attrs: { alt, src },
        })),
      )
      .run();
    event.target.value = "";
  };

  const toggleLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link")["href"];
    const url = window.prompt("링크 주소를 입력해주세요.", previousUrl ?? "https://");

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  const saveJournal = async (navigateAfterSave = true) => {
    if (!editor || !title.trim() || !editor.getText().trim() || isSaving) return false;

    setIsSaving(true);
    setSaveError(null);
    const uploadedImagePaths: string[] = [];
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setSaveError("로그인한 사용자만 성장일지를 저장할 수 있어요.");
        return false;
      }

      let content = editor.getHTML();
      for (const [signedUrl, storageUrl] of imageUrlPathsRef.current) {
        content = content.split(signedUrl).join(storageUrl);
      }

      const imageSources = [...content.matchAll(/src="(data:image\/[^"]+)"/g)]
        .map((match) => match[1])
        .filter((source): source is string => Boolean(source));
      if (imagePaths.length + imageSources.length > MAX_IMAGES) {
        setSaveError(`이미지는 최대 ${MAX_IMAGES}개까지 첨부할 수 있어요.`);
        return false;
      }
      for (const source of imageSources) {
        const existingPath = imageDataPathsRef.current.get(source);
        if (existingPath) {
          content = content.split(source).join(`storage://${existingPath}`);
          continue;
        }
        const blob = await fetch(source).then((response) => {
          if (!response.ok) throw new Error("이미지를 읽을 수 없습니다.");
          return response.blob();
        });
        if (!blob.type.startsWith("image/") || blob.size > MAX_IMAGE_SIZE_BYTES) {
          throw new Error("이미지는 파일당 10MB 이하만 첨부할 수 있어요.");
        }
        const extension = blob.type.split("/")[1] || "png";
        const path = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(JOURNAL_IMAGE_BUCKET)
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (uploadError) {
          throw uploadError;
        }
        uploadedImagePaths.push(path);
        imageDataPathsRef.current.set(source, path);
        content = content.split(source).join(`storage://${path}`);
      }

      const nextImagePaths = [
        ...new Set(
          [...imagePaths, ...uploadedImagePaths].filter((path) =>
            content.includes(`storage://${path}`),
          ),
        ),
      ];
      const removedImagePaths = editId
        ? imagePaths.filter((path) => !nextImagePaths.includes(path))
        : [];
      const payload = {
        user_id: userData.user.id,
        diary_date: recordDate,
        title: title.trim(),
        content,
        tags,
        image_paths: nextImagePaths,
        updated_at: new Date().toISOString(),
      };
      const result = editId
        ? await supabase
            .from("startup_diaries")
            .update(payload)
            .eq("id", editId)
            .select("id")
            .single()
        : await supabase.from("startup_diaries").insert(payload).select("id").single();
      const { data: savedEntry, error } = result;

      if (error) throw error;

      if (removedImagePaths.length > 0) {
        await supabase.storage.from(JOURNAL_IMAGE_BUCKET).remove(removedImagePaths);
      }
      setImagePaths(nextImagePaths);
      initialDraftRef.current = {
        title: title.trim(),
        content: normalizeDraftContent(content),
        recordDate,
        tags: [...tags],
        imagePaths: [...nextImagePaths],
      };
      setSaved(true);
      setIsDirty(false);
      if (navigateAfterSave && savedEntry?.id) {
        allowSavedNavigationRef.current = true;
        void navigate({ to: "/calendar/growth-journal/$id", params: { id: savedEntry.id } });
      }
      return true;
    } catch (error) {
      if (uploadedImagePaths.length > 0) {
        await supabase.storage.from(JOURNAL_IMAGE_BUCKET).remove(uploadedImagePaths);
      }
      setSaveError(
        error instanceof Error && error.message.includes("10MB")
          ? error.message
          : "성장일지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const activeDateWidth =
    dateBoxWidths[isDateEditing ? "editing" : "display"] ||
    dateBoxWidths[isDateEditing ? "display" : "editing"];

  return (
    <section className="mx-auto w-full max-w-[960px] pb-16">
      <div className="mt-8 bg-transparent px-0 py-0">
        <div className="mb-5 flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            className="size-10 shrink-0 rounded-[8px] px-0 text-ink-muted hover:bg-item-hover hover:text-ink"
          >
            <Link
              draggable={false}
              to={
                from === "calendar"
                  ? "/calendar"
                  : from === "detail" && returnId
                    ? "/calendar/growth-journal/$id"
                    : "/calendar/growth-journal"
              }
              params={from === "detail" && returnId ? { id: returnId } : {}}
              aria-label={
                from === "calendar"
                  ? "캘린더로 돌아가기"
                  : from === "detail"
                    ? "상세 화면으로 돌아가기"
                    : "성장일지 목록으로 돌아가기"
              }
            >
              <svg
                aria-hidden="true"
                className="-translate-x-px size-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 12H23 M12 5L5 12L12 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </Button>
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-field-border" />
          <JournalDatePicker
            value={recordDate}
            resetValue={initialRecordDate}
            onChange={(value) => {
              setRecordDate(value);
              markDirty();
            }}
          />
          <div className="hidden">
            <div
              style={{
                width: activeDateWidth ? `${activeDateWidth}px` : undefined,
              }}
              className={cn(
                "relative h-[42px] shrink-0 transition-[width] duration-100 ease-out will-change-[width] motion-reduce:transition-none",
              )}
            >
              <div
                ref={dateEditorRef}
                aria-hidden={!isDateEditing}
                onBlur={(event) => {
                  const nextTarget = event.relatedTarget as Node | null;
                  if (!nextTarget || !dateEditorRef.current?.contains(nextTarget)) {
                    window.requestAnimationFrame(commitDateEditing);
                  }
                }}
                className={cn(
                  "absolute left-0 top-0 flex h-full w-max items-center whitespace-nowrap rounded-[12px] border bg-surface px-4 text-[15px] font-semibold ring-[3.2px]",
                  dateInputError
                    ? "border-destructive text-destructive ring-destructive/20"
                    : "border-brand text-ink ring-focus-soft",
                  isDateEditing ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <div className="flex min-w-0 items-center">
                  {dateEditPart === "year" ? (
                    <input
                      ref={dateYearRef}
                      value={draftDate.year}
                      onChange={(event) => {
                        const year = event.target.value.replace(/\D/g, "").slice(0, 4);
                        const nextDate = { ...draftDate, year };
                        setDraftDate(nextDate);
                        setDateInputError(hasInvalidDatePart(nextDate));
                        if (year.length === 4 && !hasInvalidDatePart(nextDate)) {
                          setDateEditPart("month");
                          window.requestAnimationFrame(() => {
                            dateMonthRef.current?.focus();
                            dateMonthRef.current?.select();
                          });
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                          event.preventDefault();
                          adjustDatePart("year", event.key === "ArrowUp" ? 1 : -1);
                        }
                        if (event.key === "Enter") commitDateEditing();
                        if (event.key === "Escape") cancelDateEditing();
                      }}
                      aria-label="연도"
                      inputMode="numeric"
                      onFocus={(event) => event.currentTarget.select()}
                      className="h-7 w-[42px] rounded-[4px] border-0 bg-transparent p-0 text-center text-[15px] font-semibold outline-none ring-0 selection:bg-transparent selection:text-inherit focus:bg-focus-soft"
                    />
                  ) : (
                    <span className="inline-flex h-7 items-center justify-center">
                      {draftDate.year}
                    </span>
                  )}
                  <span>년</span>
                  {dateEditPart === "month" ? (
                    <input
                      ref={dateMonthRef}
                      value={draftDate.month}
                      onChange={(event) => {
                        const month = event.target.value.replace(/\D/g, "").slice(0, 2);
                        const nextDate = { ...draftDate, month };
                        setDraftDate(nextDate);
                        setDateInputError(hasInvalidDatePart(nextDate));
                        if (month.length === 2 && !hasInvalidDatePart(nextDate)) {
                          setDateEditPart("day");
                          window.requestAnimationFrame(() => {
                            dateDayRef.current?.focus();
                            dateDayRef.current?.select();
                          });
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                          event.preventDefault();
                          adjustDatePart("month", event.key === "ArrowUp" ? 1 : -1);
                        }
                        if (event.key === "Enter") commitDateEditing();
                        if (event.key === "Escape") cancelDateEditing();
                      }}
                      aria-label="월"
                      inputMode="numeric"
                      onFocus={(event) => event.currentTarget.select()}
                      className="h-7 w-7 rounded-[4px] border-0 bg-transparent p-0 text-center text-[15px] font-semibold outline-none ring-0 selection:bg-transparent selection:text-inherit focus:bg-focus-soft"
                    />
                  ) : (
                    <span className="inline-flex h-7 items-center justify-center">
                      {draftDate.month.padStart(2, "0")}
                    </span>
                  )}
                  <span>월</span>
                  {dateEditPart === "day" ? (
                    <input
                      ref={dateDayRef}
                      value={draftDate.day}
                      onChange={(event) => {
                        const day = event.target.value.replace(/\D/g, "").slice(0, 2);
                        const nextDate = { ...draftDate, day };
                        setDraftDate(nextDate);
                        setDateInputError(hasInvalidDatePart(nextDate));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                          event.preventDefault();
                          adjustDatePart("day", event.key === "ArrowUp" ? 1 : -1);
                        }
                        if (event.key === "Enter") commitDateEditing();
                        if (event.key === "Escape") cancelDateEditing();
                      }}
                      aria-label="일"
                      inputMode="numeric"
                      onFocus={(event) => event.currentTarget.select()}
                      className="h-7 w-7 rounded-[4px] border-0 bg-transparent p-0 text-center text-[15px] font-semibold outline-none ring-0 selection:bg-transparent selection:text-inherit focus:bg-focus-soft"
                    />
                  ) : (
                    <span className="inline-flex h-7 items-center justify-center">
                      {draftDate.day.padStart(2, "0")}
                    </span>
                  )}
                  <span>일</span>
                </div>
              </div>
              <div
                ref={dateButtonRef}
                aria-label={`${formatRecordDate(recordDate)} 기록일 수정`}
                role="group"
                onClick={() => focusDatePart("year")}
                className={cn(
                  "absolute left-0 top-0 flex h-full w-max items-center whitespace-nowrap rounded-[12px] border border-field-border bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-item-hover focus-within:border-brand focus-within:outline-none focus-within:ring-[3.2px] focus-within:ring-focus-soft",
                  isDateEditing ? "pointer-events-none opacity-0" : "opacity-100",
                )}
              >
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      focusDatePart("year");
                    }}
                    aria-label="연도 수정"
                    className="inline-flex h-7 items-center justify-center rounded-[4px] outline-none hover:bg-item-hover focus:bg-focus-soft"
                  >
                    {splitRecordDate(recordDate).year}
                  </button>
                  <span>년</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      focusDatePart("month");
                    }}
                    aria-label="월 수정"
                    className="ml-1 inline-flex h-7 items-center justify-center rounded-[4px] outline-none hover:bg-item-hover focus:bg-focus-soft"
                  >
                    {splitRecordDate(recordDate).month}
                  </button>
                  <span>월</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      focusDatePart("day");
                    }}
                    aria-label="일 수정"
                    className="ml-1 inline-flex h-7 items-center justify-center rounded-[4px] outline-none hover:bg-item-hover focus:bg-focus-soft"
                  >
                    {splitRecordDate(recordDate).day}
                  </button>
                  <span>일</span>
                </div>
              </div>
            </div>
          </div>
          <div ref={saveAnchorRef} className="ml-auto h-[42px] min-w-28 shrink-0">
            <Button
              type="button"
              disabled={isSaving || saved || !title.trim() || !editor?.getText().trim()}
              onClick={() => void saveJournal()}
              style={stickySaveStyle}
              className={cn(
                "h-[42px] min-w-28 whitespace-nowrap rounded-[12px] bg-brand px-5 text-[16px] font-semibold text-brand-foreground shadow-none transition-[top,right,opacity,transform] duration-[120ms] ease-out hover:bg-brand/88 active:bg-brand-pressed disabled:cursor-not-allowed disabled:bg-brand-disabled disabled:text-brand-foreground disabled:opacity-100 motion-reduce:transition-none",
                stickySaveStyle ? "fixed z-50" : "relative",
              )}
            >
              {isSaving
                ? "저장 중…"
                : saved
                  ? editId
                    ? "변경사항 저장됨"
                    : "저장됨"
                  : editId
                    ? "변경사항 저장"
                    : "저장하기"}
            </Button>
          </div>
        </div>
        <div className="flex items-center">
          <Input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              markDirty();
            }}
            placeholder="제목을 입력해주세요"
            className="h-auto min-w-0 flex-1 border-0 px-0 !text-[28px] !font-bold !leading-[36px] text-ink shadow-none placeholder:!text-[28px] placeholder:!font-semibold placeholder:!leading-[36px] placeholder:text-guide-text focus-visible:ring-0 md:!text-[28px]"
          />
        </div>

        <div className="mt-4 border-t border-field-border pt-3">
          <div
            data-growth-journal-sticky
            data-growth-journal-toolbar
            ref={toolbarRef}
            className="growth-journal-toolbar-sticky w-full bg-transparent px-0 py-2"
          >
            <div className="relative z-[1] flex items-center gap-1" aria-label="본문 서식 도구">
              <ToolbarButton
                label="실행 취소"
                onClick={() => {
                  editor?.chain().focus().undo().run();
                }}
              >
                <Undo2 className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton
                label="다시 실행"
                onClick={() => {
                  editor?.chain().focus().redo().run();
                }}
              >
                <Redo2 className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarSeparator />
              <ToolbarButton
                label="제목 2"
                active={editor?.isActive("heading", { level: 2 })}
                onClick={() => {
                  editor?.chain().focus().toggleHeading({ level: 2 }).run();
                }}
              >
                <Heading2 className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton
                label="제목 3"
                active={editor?.isActive("heading", { level: 3 })}
                onClick={() => {
                  editor?.chain().focus().toggleHeading({ level: 3 }).run();
                }}
              >
                <Heading3 className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarSeparator />
              <ToolbarButton
                label="굵게"
                active={editor?.isActive("bold")}
                onClick={() => {
                  editor?.chain().focus().toggleBold().run();
                }}
              >
                <Bold className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton
                label="기울임"
                active={editor?.isActive("italic")}
                onClick={() => {
                  editor?.chain().focus().toggleItalic().run();
                }}
              >
                <Italic className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton
                label="취소선"
                active={editor?.isActive("strike")}
                onClick={() => {
                  editor?.chain().focus().toggleStrike().run();
                }}
              >
                <Strikethrough className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarSeparator />
              <ToolbarButton
                label="글머리 목록"
                active={editor?.isActive("bulletList")}
                onClick={() => {
                  editor?.chain().focus().toggleBulletList().run();
                }}
              >
                <List className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton
                label="번호 목록"
                active={editor?.isActive("orderedList")}
                onClick={() => {
                  editor?.chain().focus().toggleOrderedList().run();
                }}
              >
                <ListOrdered className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton
                label="인용문"
                active={editor?.isActive("blockquote")}
                onClick={() => {
                  editor?.chain().focus().toggleBlockquote().run();
                }}
              >
                <Quote className="size-[18px]" fill="currentColor" stroke="none" />
              </ToolbarButton>
              <ToolbarButton
                label="구분선"
                onClick={() => {
                  editor?.chain().focus().setHorizontalRule().run();
                }}
              >
                <Minus className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarSeparator />
              <ToolbarButton label="링크" onClick={toggleLink}>
                <LinkIcon className="size-[18px]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton label="이미지" onClick={() => imageInputRef.current?.click()}>
                <svg aria-hidden="true" className="size-[18px]" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M16.3525 2.00037C19.7294 2.00037 21.9989 4.36223 21.999 7.88806V16.1019C21.999 16.2529 21.9719 16.3885 21.9639 16.5345C21.9589 16.6195 21.9601 16.7045 21.9531 16.7894C21.9491 16.8274 21.9376 16.8628 21.9336 16.9008C21.9006 17.2145 21.8502 17.5143 21.7793 17.8051C21.7613 17.8831 21.7397 17.9585 21.7188 18.0345C21.6388 18.3164 21.5446 18.5852 21.4316 18.8422C21.3987 18.9141 21.3631 18.9832 21.3291 19.0541C21.2071 19.2991 21.0749 19.5343 20.9219 19.7523C20.8749 19.8193 20.8234 19.8797 20.7744 19.9447C20.6154 20.1507 20.4487 20.3477 20.2607 20.5267C20.1998 20.5846 20.1313 20.6349 20.0674 20.6898C19.8744 20.8558 19.677 21.0148 19.46 21.1508C19.382 21.1997 19.2957 21.2357 19.2158 21.2797C18.995 21.4016 18.7721 21.5207 18.5293 21.6127C18.4293 21.6507 18.3179 21.6705 18.2139 21.7035C17.975 21.7774 17.7392 21.8548 17.4824 21.8988C17.2884 21.9328 17.077 21.9365 16.873 21.9535C16.699 21.9665 16.5335 22.0004 16.3525 22.0004H7.63672C7.26083 22.0003 6.90159 21.9626 6.55469 21.9056C6.5418 21.9037 6.52949 21.9018 6.51758 21.8998C5.1648 21.6667 4.04181 21.0135 3.25488 20.0287C3.24603 20.0286 3.24622 20.0181 3.2373 20.0092C2.4463 19.0132 1.99902 17.6739 1.99902 16.1019V7.88806C1.99915 4.36234 4.26998 2.00051 7.63672 2.00037H16.3525ZM7.63672 3.3949C5.05999 3.39504 3.39563 5.16234 3.39551 7.88806V16.1019C3.39551 16.8668 3.53733 17.55 3.78027 18.141C3.82106 18.092 5.72893 15.7658 5.75684 15.7347C6.44882 14.9448 7.74817 13.766 9.45312 14.4789C9.86298 14.6488 10.2228 14.8881 10.5527 15.098C11.1257 15.481 11.4635 15.6612 11.8135 15.6312C11.9582 15.6112 12.0939 15.5684 12.2227 15.4886C12.7807 15.1446 14.3581 12.8441 14.4531 12.7191C15.5431 11.2993 17.2231 10.9193 18.623 11.7592C18.811 11.8712 20.1585 12.8128 20.6045 13.1908V7.88806C20.6044 5.16223 18.9384 3.3949 16.3525 3.3949ZM8.47852 6.00037C9.17611 6.00042 9.80827 6.2931 10.2607 6.76111C10.7151 7.21275 11 7.83565 11 8.51501C10.9999 9.86979 9.8661 11.0001 8.50488 11.0004C7.30818 11.0004 6.28728 10.1256 6.05859 8.99353C6.02082 8.82371 6 8.64857 6 8.46814C6.00025 7.10375 7.10852 6.00037 8.47852 6.00037Z"
                    fill="currentColor"
                  />
                  <rect
                    x="2"
                    y="2"
                    width="20"
                    height="20"
                    rx="5.9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </ToolbarButton>
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagePick}
              className="hidden"
            />
          </div>

          <div className="growth-journal-editor">
            <EditorContent
              editor={editor}
              className="mt-4 min-h-[360px] text-[16px] leading-7 text-ink [&_.ProseMirror]:min-h-[360px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-guide-text [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_a]:text-brand [&_.ProseMirror_a]:underline [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-brand/30 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h2]:text-[24px] [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:leading-8 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:text-[20px] [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:leading-7 [&_.ProseMirror_hr]:my-6 [&_.ProseMirror_hr]:cursor-pointer [&_.ProseMirror_hr]:border-field-border/60 [&_.ProseMirror_hr.ProseMirror-selectednode]:border-brand [&_.ProseMirror_hr.ProseMirror-selectednode]:opacity-100 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_img]:my-4 [&_.ProseMirror_img]:max-h-[420px] [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-[12px] [&_.ProseMirror_img.ProseMirror-selectednode]:outline-2 [&_.ProseMirror_img.ProseMirror-selectednode]:outline-brand"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-field-border pt-4">
            <label className="mr-1 text-[16px] font-medium text-ink-muted" htmlFor="journal-tag">
              태그{" "}
              <span className="text-[14px] font-medium text-ink-muted">
                ({tags.length}/{MAX_TAGS})
              </span>
            </label>
            {tags.map((currentTag) => (
              <span
                key={currentTag}
                className="inline-flex h-8 items-center gap-1 rounded-[4px] bg-[#f5f5f5] px-2 text-[16px] font-medium text-ink-muted"
              >
                {currentTag}
                <button
                  type="button"
                  aria-label={`${currentTag} 태그 삭제`}
                  onClick={() => {
                    markDirty();
                    setTags((current) => current.filter((tag) => tag !== currentTag));
                  }}
                  className="flex size-4 items-center justify-center rounded-[4px] text-icon-muted hover:bg-item-hover hover:text-ink"
                >
                  <X aria-hidden="true" className="size-3" strokeWidth={2.5} />
                </button>
              </span>
            ))}
            {tags.length < MAX_TAGS && (
              <Input
                id="journal-tag"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="태그 입력 후 Enter"
                className="h-8 min-w-[180px] flex-1 border-0 bg-transparent px-0 !text-[16px] shadow-none placeholder:text-guide-text focus-visible:ring-0 md:!text-[16px]"
              />
            )}
          </div>
          {saveError ? (
            <p className="mt-2 text-right text-[13px] text-destructive">{saveError}</p>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-32px)] max-w-[560px] rounded-[20px] border-0 bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[20px] font-bold leading-7 text-ink">
              작성 중인 내용이 있어요
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] font-medium leading-5 text-ink-muted">
              저장하지 않고 나가면 지금 작성한 내용이 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogAction
              onClick={() => blocker.proceed?.()}
              className="h-11 rounded-[12px] border-0 bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft"
            >
              나가기
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async (event) => {
                event.preventDefault();
                if (await saveJournal(false)) blocker.proceed?.();
              }}
              className="h-11 rounded-[12px] border-0 bg-brand px-5 text-[15px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 focus-visible:ring-1 focus-visible:ring-focus-soft"
            >
              {editId ? "변경사항 저장" : "저장하기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <button
        type="button"
        aria-label="맨 위로 이동"
        onClick={() => document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn(
          "fixed bottom-[80px] right-[52px] z-40 flex size-[52px] items-center justify-center rounded-full bg-surface text-icon-muted shadow-dropdown transition-[opacity,transform,visibility] duration-200 hover:bg-item-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none",
          showBackToTop ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0",
        )}
      >
        <ArrowUp aria-hidden="true" className="size-6" strokeWidth={2} />
      </button>
    </section>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean | undefined;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-[8px] text-icon-muted transition-colors hover:bg-item-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        active && "bg-pill text-pill-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-field-border" />;
}
