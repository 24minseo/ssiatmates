import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpToLine,
  ChevronDown,
  Download,
  ImagePlus,
  LoaderCircle,
  Redo2,
  RefreshCw,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HtmlSlidePreview } from "./HtmlSlidePreview";
import { htmlCall, imageUrl, mediaBase, uploadImage } from "./html-client";
import { previewHtml } from "./html-preview";
import {
  parseView,
  signedUrl,
  startHtml,
  text,
  validatePlacement,
  type HtmlReference,
  type HtmlView,
  type ImageSlot,
  type Json,
  type Placement,
} from "./html-api";

const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-field-border px-4 py-3 text-sm font-semibold text-ink hover:bg-item-hover disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton =
  "inline-flex h-12 items-center justify-center rounded-[12px] bg-secondary-btn px-5 text-[16px] font-semibold text-secondary-btn-text shadow-none transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft";
const primary = `${button} border-brand bg-brand text-brand-foreground hover:bg-brand/90`;
const toolbarButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-item-hover disabled:cursor-not-allowed disabled:opacity-40";
const historyButton =
  "inline-flex size-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-item-hover disabled:cursor-not-allowed";
const field =
  "w-full rounded-lg border border-field-border bg-background px-3 py-2 text-sm text-ink";

function GrowthJournalImageIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M16.3525 2.00037C19.7294 2.00037 21.9989 4.36223 21.999 7.88806V16.1019C21.999 16.2529 21.9719 16.3885 21.9639 16.5345C21.9589 16.6195 21.9601 16.7045 21.9531 16.7894C21.9491 16.8274 21.9376 16.8628 21.9336 16.9008C21.9006 17.2145 21.8502 17.5143 21.7793 17.8051C21.7613 17.8831 21.7397 17.9585 21.7188 18.0345C21.6388 18.3164 21.5446 18.5852 21.4316 18.8422C21.3987 18.9141 21.3631 18.9832 21.3291 19.0541C21.2071 19.299 21.0749 19.5343 20.9219 19.7523C20.8749 19.8193 20.8234 19.8797 20.7744 19.9447C20.6154 20.1507 20.4487 20.3477 20.2607 20.5267C20.1998 20.5846 20.1313 20.6349 20.0674 20.6898C19.8744 20.8558 19.677 21.0148 19.46 21.1508C19.382 21.1997 19.2957 21.2357 19.2158 21.2797C18.995 21.4016 18.7721 21.5207 18.5293 21.6127C18.4293 21.6505 18.3179 21.6705 18.2139 21.7035C17.975 21.7774 17.7392 21.8548 17.4824 21.8988C17.2884 21.9328 17.077 21.9365 16.873 21.9535C16.699 21.9665 16.5335 22.0004 16.3525 22.0004H7.63672C7.26083 22.0003 6.90159 21.9626 6.55469 21.9056C6.5418 21.9037 6.52949 21.9018 6.51758 21.8998C5.1648 21.6667 4.04181 21.0135 3.25488 20.0287C3.24603 20.0286 3.24622 20.0181 3.2373 20.0092C2.4463 19.0132 1.99902 17.6739 1.99902 16.1019V7.88806C1.99915 4.36234 4.26998 2.00051 7.63672 2.00037H16.3525ZM7.63672 3.3949C5.05999 3.39504 3.39563 5.16234 3.39551 7.88806V16.1019C3.39551 16.8668 3.53733 17.55 3.78027 18.141C3.82106 18.092 5.72893 15.7658 5.75684 15.7347C6.44882 14.9448 7.74817 13.766 9.45312 14.4789C9.86298 14.6488 10.2228 14.8881 10.5527 15.098C11.1257 15.481 11.4635 15.6612 11.8135 15.6312C11.9582 15.6112 12.0939 15.5686 12.2227 15.4886C12.7807 15.1446 14.3581 12.8441 14.4531 12.7191C15.5431 11.2993 17.2231 10.9193 18.623 11.7592C18.811 11.8712 20.1585 12.8128 20.6045 13.1908V7.88806C20.6044 5.16223 18.9384 3.3949 16.3525 3.3949ZM8.47852 6.00037C9.17611 6.00042 9.80827 6.2931 10.2607 6.76111C10.7151 7.21275 11 7.83565 11 8.51501C10.9999 9.86979 9.8661 11.0001 8.50488 11.0004C7.30818 11.0004 6.28728 10.1256 6.05859 8.99353C6.02082 8.82371 6 8.64857 6 8.46814C6.00025 7.10375 7.10852 6.00037 8.47852 6.00037Z"
        fill="currentColor"
      />
      <rect x="2" y="2" width="20" height="20" rx="5.9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function readableThumbnailNumberColor(colors: Record<string, string | null>) {
  const canvas = Object.entries(colors).find(([name]) => name.toLowerCase() === "canvas")?.[1];
  const match = canvas?.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return "#173d31";
  const raw = match[1].length === 3 ? match[1].split("").map((v) => v + v).join("") : match[1];
  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(raw.slice(offset, offset + 2), 16) / 255,
  );
  const luminance = channels
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const inkContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= inkContrast ? "#ffffff" : "#173d31";
}

type ImageHistoryEntry = {
  before: ImageSlot | null;
  after: ImageSlot | null;
};

function cloneImageSlot(slot: ImageSlot | null | undefined): ImageSlot | null {
  return slot
    ? { ...slot, placement: slot.placement ? { ...slot.placement } : slot.placement }
    : null;
}

const states: Record<string, string> = {
  loading: "IR 덱을 불러오는 중이에요",
  queued: "생성 요청을 접수했어요",
  planning: "전체 발표 흐름과 핵심 메시지를 구성하고 있어요",
  generating: "내용에 맞는 슬라이드를 만들고 있어요",
  validating: "슬라이드 배치와 출력 상태를 확인하고 있어요",
  ready: "IR 덱이 완성됐어요",
  failed: "IR 덱 생성을 완료하지 못했어요",
};
type PendingImage = { body: Json; revision: number };

async function imageUrlAsDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("이미지를 불러오지 못했습니다.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function standaloneHtml(slides: string[]) {
  const serializedSlides = JSON.stringify(slides).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IR 덱</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #f1f4f2; color: #173d31; font-family: Arial, sans-serif; }
    header { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; background: rgba(255,255,255,.94); border-bottom: 1px solid #d8e1dd; backdrop-filter: blur(8px); }
    header strong { font-size: 16px; }
    header span { color: #587067; font-size: 14px; }
    nav { display: flex; gap: 8px; }
    button { border: 1px solid #d8e1dd; border-radius: 8px; padding: 8px 12px; background: #fff; color: #173d31; font: inherit; cursor: pointer; }
    button:hover:not(:disabled) { background: #eaf1ec; }
    button:disabled { cursor: default; opacity: .4; }
    main { display: flex; justify-content: center; padding: 28px 20px 48px; }
    iframe { width: min(92vw, 1280px); aspect-ratio: 16 / 9; border: 0; background: #fff; box-shadow: 0 2px 12px rgba(0,13,59,.08); }
  </style>
</head>
<body>
  <header>
    <div><strong>IR 덱</strong> <span id="counter"></span></div>
    <nav>
      <button id="previous" type="button">이전</button>
      <button id="next" type="button">다음</button>
    </nav>
  </header>
  <main id="stage"></main>
  <script>
    const slides = ${serializedSlides};
    let current = 0;
    const stage = document.getElementById('stage');
    const counter = document.getElementById('counter');
    const previous = document.getElementById('previous');
    const next = document.getElementById('next');
    function render() {
      const frame = document.createElement('iframe');
      frame.title = 'IR 덱 슬라이드 ' + (current + 1);
      frame.srcdoc = slides[current];
      stage.replaceChildren(frame);
      counter.textContent = (current + 1) + ' / ' + slides.length;
      previous.disabled = current === 0;
      next.disabled = current === slides.length - 1;
    }
    previous.addEventListener('click', () => { if (current > 0) { current -= 1; render(); } });
    next.addEventListener('click', () => { if (current < slides.length - 1) { current += 1; render(); } });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' && current > 0) { current -= 1; render(); }
      if (event.key === 'ArrowRight' && current < slides.length - 1) { current += 1; render(); }
    });
    render();
  </script>
</body>
</html>`;
}

export function HtmlDeckWorkspace({
  reference,
  persist,
  onHome,
  onSave,
  devPreview = false,
  previewView,
  pendingTitle,
  pendingSteps,
}: {
  reference: HtmlReference;
  persist: (ref: HtmlReference) => void;
  onBack: () => void;
  onHome: () => void;
  onSave: () => void;
  devPreview?: boolean;
  previewView?: HtmlView;
  pendingTitle?: string;
  pendingSteps?: ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const ref = useRef(reference),
    persistRef = useRef(persist);
  persistRef.current = persist;
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const alive = useRef(true),
    loading = useRef(false),
    busyLock = useRef(false);
  const [view, setView] = useState<HtmlView | null>(devPreview ? previewView || null : null);
  const [state, setState] = useState(reference.documentId ? "loading" : "queued"),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0),
    [selected, setSelected] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [slotId, setSlotId] = useState<string | null>(null),
    [adding, setAdding] = useState(false);
  const [point, setPoint] = useState({ x: 640, y: 360 });
  const [placement, setPlacement] = useState<Placement>({
    x: 640,
    y: 360,
    width: 640,
    height: 360,
    zIndex: 100,
  });
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ past: ImageHistoryEntry[]; future: ImageHistoryEntry[] }>({
    past: [],
    future: [],
  });
  const [preview, setPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [exportBusy, setExportBusy] = useState(false),
    [exportError, setExportError] = useState("");
  const [htmlBusy, setHtmlBusy] = useState(false);
  const [exportAttempt, setExportAttempt] = useState(0);
  const [exportState, setExportState] = useState<{
    format: "pdf" | "pptx";
    revision: number;
    requestId: string;
    exportId?: string;
  } | null>(null);
  const [download, setDownload] = useState<{
    url: string;
    filename: string;
    expiresAt: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const slideStageRef = useRef<HTMLDivElement>(null);
  const wheelGesture = useRef({ direction: 0, distance: 0, blockedUntil: 0 });
  const [slideStageSize, setSlideStageSize] = useState({ width: 0, height: 0 });
  const [fullscreenViewport, setFullscreenViewport] = useState({ width: 0, height: 0 });
  const thumbnailStrip = useRef<HTMLDivElement>(null);
  const [thumbnailEdges, setThumbnailEdges] = useState({ left: false, right: false });
  const uploaded = useRef<{ file: File; assetId: string } | null>(null);
  const draggingImage = useRef<{
    slotId: string;
    mode: "move" | "resize";
    start: { x: number; y: number };
    placement: Placement;
    before: ImageSlot;
  } | null>(null);
  const authorized = devPreview || user?.id === reference.userId;
  const current = view?.document.slides[selected];
  const selectedSlot = view?.imageSlots.find((s) => s.id === slotId) || null;
  const canMutate = !devPreview && authorized && !busy && !pendingImage;
  const canNavigate = !preview || isFullscreen;

  useEffect(() => {
    if (preview) return;
    const strip = thumbnailStrip.current;
    if (!strip) return;

    const updateThumbnailEdges = () => {
      setThumbnailEdges({
        left: strip.scrollLeft > 1,
        right: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
      });
    };

    updateThumbnailEdges();
    strip.addEventListener("scroll", updateThumbnailEdges, { passive: true });
    window.addEventListener("resize", updateThumbnailEdges);
    return () => {
      strip.removeEventListener("scroll", updateThumbnailEdges);
      window.removeEventListener("resize", updateThumbnailEdges);
    };
  }, [preview, view?.document.slides.length]);

  useEffect(() => {
    setHistory({ past: [], future: [] });
  }, [view?.document_id]);

  function remember(next: HtmlReference) {
    if (!alive.current || owner.current !== next.userId) return;
    ref.current = next;
    persistRef.current(next);
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function switchSlideShortcut(key: "ArrowLeft" | "ArrowRight") {
    if (busy || pendingImage) return;
    if (key === "ArrowLeft" && selected > 0) {
      setSelected((index) => index - 1);
      setSlotId(null);
    } else if (key === "ArrowRight" && selected < 6) {
      setSelected((index) => index + 1);
      setSlotId(null);
    }
  }

  function handleSlideWheel(deltaY: number, deltaX: number) {
    if (busy || pendingImage || Math.abs(deltaY) <= Math.abs(deltaX)) return;
    const direction = deltaY > 0 ? 1 : -1;
    const gesture = wheelGesture.current;
    const now = performance.now();
    if (now < gesture.blockedUntil) return;
    if (gesture.direction !== direction) {
      gesture.direction = direction;
      gesture.distance = 0;
    }
    gesture.distance += Math.abs(deltaY);
    if (gesture.distance < 32) return;
    const lastSlide = (view?.document.slides.length || 7) - 1;
    if ((direction < 0 && selected === 0) || (direction > 0 && selected >= lastSlide)) {
      gesture.distance = 0;
      return;
    }
    gesture.distance = 0;
    gesture.blockedUntil = now + 650;
    switchSlideShortcut(direction > 0 ? "ArrowRight" : "ArrowLeft");
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    if (typeof editor.requestFullscreen === "function") {
      try {
        await editor.requestFullscreen();
        return;
      } catch {
        // Fall back to the in-app presentation view when Fullscreen API is blocked.
      }
    }

    setIsFullscreen(true);
    setPreview(true);
  }

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || (preview && !isFullscreen)) return;
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      handleSlideWheel(event.deltaY, event.deltaX);
    };
    editor.addEventListener("wheel", handleWheel, { passive: false });
    return () => editor.removeEventListener("wheel", handleWheel);
  }, [busy, isFullscreen, pendingImage, preview, selected]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === editorRef.current;
      setIsFullscreen(active);
      setPreview(active);
      if (active) {
        setFullscreenViewport({ width: window.innerWidth, height: window.innerHeight });
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const updateViewport = () =>
      setFullscreenViewport({ width: window.innerWidth, height: window.innerHeight });
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handlePresentationEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.fullscreenElement) return;
      setIsFullscreen(false);
      setPreview(false);
    };
    window.addEventListener("keydown", handlePresentationEscape);
    return () => window.removeEventListener("keydown", handlePresentationEscape);
  }, [isFullscreen]);

  useEffect(() => {
    const stage = slideStageRef.current;
    if (!stage) return;
    const updateSize = () => {
      const { width, height } = stage.getBoundingClientRect();
      setSlideStageSize({ width, height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleSlideShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        event.defaultPrevented ||
        busy ||
        pendingImage ||
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target?.tagName || "")
      )
        return;
      if (event.key === "ArrowLeft" && selected > 0) {
        event.preventDefault();
        switchSlideShortcut("ArrowLeft");
      } else if (event.key === "ArrowRight" && selected < 6) {
        event.preventDefault();
        switchSlideShortcut("ArrowRight");
      }
    }
    window.addEventListener("keydown", handleSlideShortcut);
    return () => window.removeEventListener("keydown", handleSlideShortcut);
  }, [busy, pendingImage, selected]);

  // 한 번에 하나의 상태 조회만 실행한다. 새로고침/응답 유실 시 저장된 요청 번호로 재개한다.
  useEffect(() => {
    if (devPreview) {
      setView(previewView || null);
      setState("ready");
      return;
    }
    if (authLoading || !authorized) return;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const valid = () => !cancelled && alive.current && owner.current === reference.userId;
    async function run() {
      if (loading.current || !valid()) {
        if (valid()) timer = setTimeout(() => void run(), 300);
        return;
      }
      if (document.hidden) {
        timer = setTimeout(() => void run(), 3000);
        return;
      }
      loading.current = true;
      try {
        setError("");
        if (ref.current.documentId) {
          const data = await htmlCall("ir-deck-html-api-v1", {
            action: "get_document",
            document_id: ref.current.documentId,
          });
          if (valid()) {
            setView(parseView(data, reference.deckId));
            setState("ready");
          }
          return;
        }
        const status = ref.current.jobId
          ? await htmlCall("ir-deck-html-api-v1", { action: "get_job", job_id: ref.current.jobId })
          : await startHtml(htmlCall, ref.current, remember);
        if (!valid()) return;
        const jobId = text(status["job_id"]),
          nextState = text(status["state"]);
        remember({ ...ref.current, jobId });
        setState(nextState);
        if (nextState === "failed") {
          setError(
            typeof status["message"] === "string"
              ? status["message"]
              : "생성 중 오류가 발생했습니다. 입력 내용은 유지됩니다.",
          );
          return;
        }
        if (
          nextState === "ready" &&
          status["ready"] === true &&
          typeof status["document_id"] === "string"
        ) {
          remember({ ...ref.current, documentId: status["document_id"] });
          const data = await htmlCall("ir-deck-html-api-v1", {
            action: "get_document",
            document_id: status["document_id"],
          });
          if (valid()) setView(parseView(data, reference.deckId));
        } else timer = setTimeout(() => void run(), 3000);
      } catch (e) {
        if (valid()) setError(e instanceof Error ? e.message : "생성 상태를 확인하지 못했습니다.");
      } finally {
        loading.current = false;
      }
    }
    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attempt, authorized, authLoading, devPreview, previewView, reference.deckId, reference.userId]);

  const assetKey = view
    ? [...new Set(view.imageSlots.flatMap((s) => (s.assetId ? [s.assetId] : [])))].sort().join(",")
    : "";
  useEffect(() => {
    if (!authorized) return;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    async function renew() {
      if (document.hidden) {
        timer = setTimeout(() => void renew(), 15000);
        return;
      }
      try {
        const entries = await Promise.all(
          assetKey
            .split(",")
            .filter(Boolean)
            .map(async (id) => [id, await imageUrl(id)] as const),
        );
        if (!cancelled && owner.current === reference.userId) setUrls(Object.fromEntries(entries));
      } catch {
        if (!cancelled)
          toast.error("일부 이미지를 불러오지 못했습니다. 이미지 새로고침으로 다시 확인해 주세요.");
      }
      if (!cancelled) timer = setTimeout(() => void renew(), 240000);
    }
    void renew();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [assetKey, authorized, reference.userId, attempt]);

  async function refreshView(): Promise<HtmlView> {
    if (!view) throw new Error("완료된 문서를 먼저 확인해 주세요.");
    const data = await htmlCall("ir-deck-html-api-v1", {
      action: "get_document",
      document_id: view.document_id,
    });
    const fresh = parseView(data, reference.deckId);
    if (alive.current && owner.current === reference.userId) setView(fresh);
    return fresh;
  }
  async function saveBinding(pending: PendingImage) {
    const result = await htmlCall("ir-deck-html-api-v1", pending.body);
    if (result["saved"] !== true) throw new Error("이미지 저장 완료를 확인하지 못했습니다.");
    await refreshView();
    if (alive.current && owner.current === reference.userId) {
      setPendingImage(null);
      toast.success("이미지 변경사항을 저장했어요.");
      setDownload(null);
    }
  }
  function rememberImageChange(before: ImageSlot | null, after: ImageSlot | null) {
    setHistory((currentHistory) => ({
      past: [
        ...currentHistory.past,
        { before: cloneImageSlot(before), after: cloneImageSlot(after) },
      ].slice(-30),
      future: [],
    }));
  }
  async function mutate(
    body: Json,
    historyEntry?: ImageHistoryEntry,
    historyDirection?: "undo" | "redo",
  ) {
    if (!view || !canMutate || busyLock.current) return;
    const pending = {
      body: {
        ...body,
        document_id: view.document_id,
        expected_revision: view.image_revision,
        request_id: crypto.randomUUID(),
      },
      revision: view.image_revision,
    };
    busyLock.current = true;
    setBusy(true);
    setPendingImage(pending);
    try {
      await saveBinding(pending);
      if (historyEntry && historyDirection) {
        setHistory((currentHistory) => {
          if (historyDirection === "undo") {
            return {
              past: currentHistory.past.slice(0, -1),
              future: [...currentHistory.future, historyEntry],
            };
          }
          return {
            past: [...currentHistory.past, historyEntry],
            future: currentHistory.future.slice(0, -1),
          };
        });
      } else if (historyEntry) {
        rememberImageChange(historyEntry.before, historyEntry.after);
      }
    } catch (e) {
      if (alive.current)
        toast.error(
          e instanceof Error
            ? e.message
            : "이미지를 저장하지 못했습니다. 같은 변경으로 다시 확인해 주세요.",
        );
    } finally {
      busyLock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function historyBody(slot: ImageSlot, next: ImageSlot | null): Json {
    if (slot.origin === "generated") {
      return {
        action: "save_slot_image",
        slot_id: slot.id,
        asset_id: next?.assetId || null,
        fit: next?.fit || slot.fit,
      };
    }
    return {
      action: "save_user_image",
      slot_id: slot.id,
      slide_id: next?.slideId || slot.slideId,
      asset_id: next?.assetId || null,
      placement: next?.placement || slot.placement,
      fit: "contain",
      delete: next === null,
    };
  }
  async function applyHistory(direction: "undo" | "redo") {
    if (!view || busy || pendingImage || !canMutate) return;
    const entry = direction === "undo" ? history.past.at(-1) : history.future.at(-1);
    if (!entry) return;
    const next = direction === "undo" ? entry.before : entry.after;
    const template = next || (direction === "undo" ? entry.after : entry.before);
    if (!template) return;
    await mutate(historyBody(template, next), entry, direction);
  }
  function binding(
    slot: ImageSlot,
    assetId: string | null,
    remove = false,
    nextPlacement = placement,
  ): Json {
    if (slot.origin === "generated")
      return { action: "save_slot_image", slot_id: slot.id, asset_id: assetId, fit: slot.fit };
    validatePlacement(nextPlacement);
    return {
      action: "save_user_image",
      slot_id: slot.id,
      slide_id: slot.slideId,
      asset_id: assetId,
      placement: nextPlacement,
      fit: "contain",
      delete: remove,
    };
  }
  async function upload(file: File) {
    if (!view || !current || !canMutate || busyLock.current) return;
    const target = selectedSlot;
    const before = cloneImageSlot(target);
    const destinationSlide = current.slideId;
    busyLock.current = true;
    setBusy(true);
    try {
      const p = {
        ...placement,
        x: Math.min(point.x, 1920 - placement.width),
        y: Math.min(point.y, 1080 - placement.height),
      };
      if (!target) validatePlacement(p);
      if (uploaded.current?.file !== file)
        uploaded.current = { file, assetId: crypto.randomUUID() };
      const assetId = await uploadImage(reference.deckId, file, uploaded.current.assetId);
      if (!alive.current || owner.current !== reference.userId) return;
      const slot = target || {
        id: `user-image-${crypto.randomUUID()}`,
        slideId: destinationSlide,
        origin: "user" as const,
        description: file.name,
        assetId,
        placement: p,
        fit: "contain",
      };
      const body: Json = target
        ? binding(slot, assetId)
        : {
            action: "save_user_image",
            slot_id: slot.id,
            slide_id: destinationSlide,
            asset_id: assetId,
            placement: p,
            fit: "contain",
          };
      const pending = {
        body: {
          ...body,
          document_id: view.document_id,
          expected_revision: view.image_revision,
          request_id: crypto.randomUUID(),
        },
        revision: view.image_revision,
      };
      setPendingImage(pending);
      setSlotId(slot.id);
      setAdding(false);
      setPlacement(slot.placement || placement);
      await saveBinding(pending);
      rememberImageChange(before, slot);
    } catch (e) {
      if (alive.current)
        toast.error(
          e instanceof Error
            ? e.message
            : "이미지 업로드를 완료하지 못했습니다. 같은 파일로 다시 시도해 주세요.",
        );
    } finally {
      busyLock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function selectSlot(slot: ImageSlot | null, position: { x: number; y: number }) {
    if (busy || pendingImage) return;
    if (adding) {
      if (devPreview) return;
      setSlotId(null);
      setPoint(position);
      fileInput.current?.click();
      return;
    }
    setSlotId(slot?.id || null);
    if (slot) {
      if (slot.placement) setPlacement(slot.placement);
    }
  }
  function dragImage(
    phase: "start" | "move" | "end",
    mode: "move" | "resize",
    slot: ImageSlot | null,
    point: { x: number; y: number },
  ) {
    if (busy || pendingImage) return;
    setPoint(point);
    if (phase === "start") {
      selectSlot(slot, point);
      if (!slot || slot.origin !== "user" || !slot.placement || adding || !canMutate) return;
      draggingImage.current = {
        slotId: slot.id,
        mode,
        start: point,
        placement: slot.placement,
        before: cloneImageSlot(slot)!,
      };
      return;
    }
    const drag = draggingImage.current;
    if (!drag || !slot || drag.slotId !== slot.id || slot.origin !== "user") return;
    const deltaX = point.x - drag.start.x;
    const deltaY = point.y - drag.start.y;
    const width =
      drag.mode === "resize"
        ? (() => {
            const ratio = drag.placement.width / drag.placement.height;
            const maxWidth = Math.min(
              1920 - drag.placement.x,
              Math.floor((1080 - drag.placement.y) * ratio),
            );
            const minWidth = Math.min(80, maxWidth);
            return Math.max(minWidth, Math.min(maxWidth, Math.round(drag.placement.width + deltaX)));
          })()
        : drag.placement.width;
    const height =
      drag.mode === "resize"
        ? Math.max(1, Math.round(width / (drag.placement.width / drag.placement.height)))
        : drag.placement.height;
    const nextPlacement: Placement = {
      ...drag.placement,
      x:
        drag.mode === "resize"
          ? drag.placement.x
          : Math.max(0, Math.min(1920 - drag.placement.width, drag.placement.x + deltaX)),
      y:
        drag.mode === "resize"
          ? drag.placement.y
          : Math.max(0, Math.min(1080 - drag.placement.height, drag.placement.y + deltaY)),
      width,
      height,
    };
    setPlacement(nextPlacement);
    if (phase === "end") {
      draggingImage.current = null;
      const changed =
        nextPlacement.x !== drag.placement.x ||
        nextPlacement.y !== drag.placement.y ||
        nextPlacement.width !== drag.placement.width ||
        nextPlacement.height !== drag.placement.height;
      if (changed) {
        void mutate(
          binding(slot, slot.assetId, false, nextPlacement),
          {
            before: drag.before,
            after: { ...drag.before, placement: { ...nextPlacement } },
          },
        );
      }
    }
  }
  function saveSelectedPlacement(nextPlacement: Placement) {
    if (!selectedSlot || selectedSlot.origin !== "user" || !selectedSlot.assetId) return;
    try {
      validatePlacement(nextPlacement);
      setPlacement(nextPlacement);
      void mutate(
        binding(selectedSlot, selectedSlot.assetId, false, nextPlacement),
        {
          before: cloneImageSlot(selectedSlot),
          after: { ...selectedSlot, placement: { ...nextPlacement }, fit: "contain" },
        },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "이미지 설정을 확인해 주세요.");
    }
  }
  function changeLayer(direction: "front" | "back") {
    if (!selectedSlot?.placement || selectedSlot.origin !== "user") return;
    const zIndex = direction === "front" ? 10000 : 0;
    if (selectedSlot.placement.zIndex === zIndex) return;
    saveSelectedPlacement({ ...selectedSlot.placement, zIndex });
  }
  const documentId = view?.document_id;
  useEffect(() => {
    if (!exportState || !documentId || !authorized) return;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const valid = () => !cancelled && alive.current && owner.current === reference.userId;
    async function run() {
      if (document.hidden) {
        timer = setTimeout(() => void run(), 3000);
        return;
      }
      setExportBusy(true);
      setExportError("");
      try {
        const status = exportState!.exportId
          ? await htmlCall("ir-deck-html-api-v1", {
              action: "get_export",
              export_id: exportState!.exportId,
            })
          : await htmlCall("ir-deck-html-api-v1", {
              action: "request_export",
              document_id: documentId,
              format: exportState!.format,
              expected_image_revision: exportState!.revision,
              client_request_id: exportState!.requestId,
            });
        if (!valid()) return;
        const exportId = text(status["export_id"]);
        if (!exportState!.exportId) {
          setExportState({ ...exportState!, exportId });
          return;
        }
        if (status["state"] === "failed") {
          setExportError(
            typeof status["message"] === "string"
              ? status["message"]
              : "출력 파일을 만들지 못했습니다. 출력만 다시 요청해 주세요.",
          );
          setExportBusy(false);
          return;
        }
        if (status["ready"] === true && status["state"] === "ready") {
          const data = await htmlCall("ir-deck-html-api-v1", {
            action: "get_export_download",
            export_id: exportId,
          });
          const url = signedUrl(data["download_url"], mediaBase(), "ir-deck-html-exports-v1");
          const path = new URL(url).pathname;
          if (!path.endsWith(`/result.${exportState!.format}`))
            throw new Error("출력 형식과 파일 주소가 일치하지 않습니다.");
          if (valid()) {
            setDownload({ url, filename: text(data["filename"]), expiresAt: Date.now() + 240000 });
            setExportBusy(false);
          }
        } else timer = setTimeout(() => void run(), 2500);
      } catch (e) {
        if (valid()) {
          setExportError(e instanceof Error ? e.message : "출력 상태를 확인하지 못했습니다.");
          setExportBusy(false);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [exportState, exportAttempt, authorized, reference.userId, documentId]);

  function requestExport(format: "pdf" | "pptx") {
    if (!view || busy || pendingImage || exportBusy) return;
    setDownload(null);
    setExportError("");
    setExportState({ format, revision: view.image_revision, requestId: crypto.randomUUID() });
  }

  async function downloadHtml() {
    if (!view || busy || pendingImage || exportBusy || htmlBusy) return;
    setHtmlBusy(true);
    const htmlToastId = "ir-deck-html-download";
    toast.loading("HTML 파일을 준비하고 있어요.", { id: htmlToastId });
    try {
      const assetIds = [
        ...new Set(view.imageSlots.flatMap((slot) => (slot.assetId ? [slot.assetId] : []))),
      ];
      const entries = await Promise.all(
        assetIds.map(async (assetId) => {
          const source = urls[assetId] || (await imageUrl(assetId));
          try {
            return [assetId, await imageUrlAsDataUrl(source)] as const;
          } catch {
            return [assetId, source] as const;
          }
        }),
      );
      const embeddedUrls = Object.fromEntries(entries);
      const documents = view.document.slides.map((slide) =>
        previewHtml(
          slide,
          view,
          embeddedUrls,
          crypto.randomUUID().replaceAll("-", ""),
          crypto.randomUUID(),
          mediaBase(),
          false,
        ),
      );
      const blob = new Blob([standaloneHtml(documents)], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "IR-deck.html";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("HTML 파일을 다운로드했어요.", { id: htmlToastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "HTML 파일을 만들지 못했습니다.", {
        id: htmlToastId,
      });
    } finally {
      setHtmlBusy(false);
    }
  }
  if (!authorized)
    return (
      <section className="rounded-2xl border border-field-border bg-surface p-8">
        <h1 className="text-xl font-semibold text-ink">로그인한 계정을 확인해 주세요</h1>
        <p className="mt-3 text-ink-muted">
          IR 덱을 생성한 계정으로 로그인하면 이어서 확인할 수 있어요.
        </p>
        <button className={`${secondaryButton} mt-6`} onClick={onHome}>
          목록으로
        </button>
      </section>
    );
  if (!view || !current)
    return (
      <div className="w-full">
        {state !== "loading" && (pendingSteps || pendingTitle) && (
          <>
            {pendingSteps && <div className="mb-5">{pendingSteps}</div>}
            {pendingTitle && <h1 className="mb-7 text-2xl font-bold leading-tight text-ink">{pendingTitle}</h1>}
          </>
        )}
        <section
          className="rounded-2xl border border-field-border bg-surface px-8 py-20 text-center"
          aria-live="polite"
        >
        {!error && <LoaderCircle className="mx-auto size-9 animate-spin text-brand" />}
        <h1 className="mt-5 text-xl font-bold text-ink">
          {states[state] || "생성 상태를 확인하고 있어요"}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-muted">
          {state === "loading" ? "저장된 IR 덱과 슬라이드 정보를 불러오고 있어요." : (
            <>
              선택한 디자인에 맞춰 7장 슬라이드를 만들고 있어요.
              완료되면 편집 화면에서 확인할 수 있어요.
            </>
          )}
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-ink">
            {error}
          </p>
        )}
        <div className="mt-7 flex justify-center gap-3">
          <button className={secondaryButton} onClick={onHome}>
            목록으로
          </button>
          {error && (
            <button
              className={primary}
              onClick={() => {
                setError("");
                setAttempt((a) => a + 1);
              }}
            >
              같은 요청 상태 확인
            </button>
          )}
        </div>
        {state === "failed" && (
          <p className="mt-4 text-xs text-ink-muted">
            다시 생성하려면 디자인 선택 화면에서 생성 버튼을 눌러 주세요.
          </p>
        )}
        </section>
      </div>
    );
  const stale = view.input_status && Object.values(view.input_status).some((v) => !v);
  const thumbnailNumberColor = readableThumbnailNumberColor(view.document.designTokens.colors);
  const thumbnailMask = thumbnailEdges.left && thumbnailEdges.right
    ? "linear-gradient(90deg, transparent 0%, black 7%, black 93%, transparent 100%)"
    : thumbnailEdges.left
      ? "linear-gradient(90deg, transparent 0%, black 7%, black 100%)"
      : thumbnailEdges.right
        ? "linear-gradient(90deg, black 0%, black 93%, transparent 100%)"
        : undefined;
  const selectedAnchor = selectedSlot?.origin === "user" && selectedSlot.placement
    ? placement
    : selectedSlot?.placement || {
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
    zIndex: 0,
  };
  const selectionToolbarStyle = {
    left: `${((selectedAnchor.x + selectedAnchor.width / 2) / 1920) * 100}%`,
    top: `${(selectedAnchor.y / 1080) * 100}%`,
    transform:
      selectedAnchor.y >= 220 ? "translate(-50%, calc(-100% - 8px))" : "translate(-50%, 8px)",
  };
  const fullscreenSlideWidth =
    isFullscreen && fullscreenViewport.width > 0 && fullscreenViewport.height > 0
      ? Math.min(fullscreenViewport.width, fullscreenViewport.height * (16 / 9))
      : 0;
  const currentSlideStyle =
    fullscreenSlideWidth > 0
      ? { width: fullscreenSlideWidth, height: fullscreenSlideWidth * (9 / 16) }
      : slideStageSize.width > 0 && slideStageSize.height > 0
        ? { width: Math.min(slideStageSize.width, slideStageSize.height * (16 / 9)) }
        : undefined;
  return (
    <div
      ref={editorRef}
      className={cn(
        "ir-deck-editor mx-auto flex h-full min-h-0 w-full max-w-[1200px] flex-col gap-3",
        isFullscreen && "ir-deck-presentation",
      )}
    >
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-4">
        {!preview && (
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="inline-flex w-fit items-center gap-0.5 rounded-xl border border-[rgba(64,72,66,0.08)] bg-surface p-1"
              style={{ boxShadow: "0 4px 12px 0 rgba(64, 72, 66, 0.1)" }}
            >
              <div className="flex items-center gap-0">
                <button
                  className={historyButton}
                  aria-label="되돌리기"
                  title="되돌리기"
                  disabled={!canMutate || history.past.length === 0}
                  onClick={() => void applyHistory("undo")}
                >
                  <Undo2 className="size-4" strokeWidth={2} />
                </button>
                <button
                  className={historyButton}
                  aria-label="다시 실행"
                  title="다시 실행"
                  disabled={!canMutate || history.future.length === 0}
                  onClick={() => void applyHistory("redo")}
                >
                  <Redo2 className="size-4" strokeWidth={2} />
                </button>
              </div>
              <span className="h-5 w-px shrink-0 bg-field-border/70" aria-hidden="true" />
              <button
                className={toolbarButton}
                disabled={!canMutate && !devPreview}
                onClick={() => {
                  setAdding(false);
                  setSlotId(null);
                  window.requestAnimationFrame(() => fileInput.current?.click());
                }}
              >
                <GrowthJournalImageIcon className="size-3.5" />
                {adding ? "추가 위치 선택 취소" : "이미지 추가"}
              </button>
              <button
                className={toolbarButton}
                disabled={busy}
                onClick={() => setAttempt((a) => a + 1)}
              >
                <RefreshCw className="size-3.5" />
                이미지 새로고침
              </button>
            </div>
          </div>
        )}
        <div className={cn("flex flex-wrap gap-2", preview && "ml-auto")}>
          <button className={button} onClick={onHome}>
            최근 파일
          </button>
          <button className={button} onClick={toggleFullscreen}>
            전체화면
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={button} disabled={busy || !!pendingImage || exportBusy || htmlBusy}>
                <Download className="size-4" />
                다운로드
                <ChevronDown className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[168px] rounded-[12px] border-0 bg-surface p-1 shadow-none"
              style={{ boxShadow: "var(--shadow-dropdown)" }}
            >
              <DropdownMenuItem
                onSelect={() => void downloadHtml()}
                className="min-h-10 cursor-pointer rounded-[8px] px-[14px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover"
              >
                HTML로 다운로드
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => requestExport("pdf")}
                className="min-h-10 cursor-pointer rounded-[8px] px-[14px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover"
              >
                PDF로 다운로드
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => requestExport("pptx")}
                className="min-h-10 cursor-pointer rounded-[8px] px-[14px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover"
              >
                PPTX로 다운로드
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className={cn(primary, "px-5 text-white")}
            disabled={busy || !!pendingImage}
            onClick={() => {
              onSave();
              toast.success("완성된 IR 덱을 최근 파일에 저장했어요.");
            }}
          >
            저장
          </button>
        </div>
      </header>
      {stale && (
        <p className="rounded-xl bg-item-hover p-4 text-sm text-ink">
          원문 또는 디자인이 이후 변경됐어요. 현재 화면은 생성 당시의 완성본이에요.
        </p>
      )}
      {pendingImage && !busy && (
        <div className="flex flex-wrap gap-2">
          <button
            className={primary}
            onClick={async () => {
              if (busyLock.current) return;
              busyLock.current = true;
              setBusy(true);
              try {
                await saveBinding(pendingImage);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "저장을 확인하지 못했습니다.");
              } finally {
                busyLock.current = false;
                if (alive.current) setBusy(false);
              }
            }}
          >
            같은 이미지 변경 저장 확인
          </button>
          <button
            className={button}
            onClick={async () => {
              try {
                await refreshView();
                setPendingImage(null);
                toast.success(
                  "서버의 최신 이미지 상태를 불러왔어요. 필요한 변경을 다시 선택해 주세요.",
                );
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "조회하지 못했습니다.");
              }
            }}
          >
            서버 저장값 다시 불러오기
          </button>
        </div>
      )}
      {(exportBusy || exportError || download) && (
        <div className="rounded-xl bg-item-hover p-4 text-sm text-ink" aria-live="polite">
          {exportBusy && (
            <span className="inline-flex gap-2">
              <LoaderCircle className="size-4 animate-spin" />
              {exportState?.format.toUpperCase()} 출력 파일을 만들고 있어요. AI를 다시 호출하지
              않아요.
            </span>
          )}
          {exportError && (
            <>
              <p role="alert">{exportError}</p>
              <button className={`${button} mt-2`} onClick={() => setExportAttempt((a) => a + 1)}>
                같은 출력 상태 확인
              </button>
            </>
          )}
          {download && (
            <>
              <span>
                {exportState?.revision !== view.image_revision
                  ? "이미지 변경 전 파일이에요. 최신 버전으로 다시 출력해 주세요."
                  : "출력 파일이 준비됐어요. "}
              </span>
              {exportState?.revision === view.image_revision && (
                <a
                  className="font-semibold underline"
                  href={download.url}
                  download={download.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (Date.now() > download.expiresAt) {
                      e.preventDefault();
                      setDownload(null);
                      setExportAttempt((a) => a + 1);
                    }
                  }}
                >
                  다운로드
                </a>
              )}
            </>
          )}
        </div>
      )}
      <div className="ir-deck-main-wrap flex min-h-0 flex-1 flex-col">
        <main className="mx-auto flex h-full min-h-0 w-full min-w-0 max-w-[1120px] flex-1 flex-col gap-4">
          {!preview && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                aria-label="IR 덱 이미지 파일"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
            </>
          )}
          <div ref={slideStageRef} className="ir-deck-slide-stage flex min-h-0 flex-1 items-start justify-center">
            <div
              className="ir-deck-fullscreen-slide-frame relative max-w-full"
              style={currentSlideStyle}
            >
              <HtmlSlidePreview
                key={current.slideId}
                slide={current}
                view={view}
                urls={urls}
                mediaOrigin={new URL(mediaBase()).origin}
                onSelect={preview ? undefined : (slot, position) => {
                  setPoint(position);
                  selectSlot(slot, position);
                }}
                onDrag={preview ? undefined : dragImage}
                onSlideShortcut={canNavigate ? switchSlideShortcut : undefined}
                onSlideWheel={canNavigate ? handleSlideWheel : undefined}
                className={cn(
                  "ir-deck-current-slide rounded-none shadow-[0_2px_12px_rgba(0,13,59,0.08)]",
                  !preview && "border-0",
                )}
              />
              {!preview && selectedSlot && (
                <div
                  className="absolute z-20 inline-flex max-w-[calc(100%-16px)] flex-wrap items-center gap-1 rounded-xl border border-[rgba(64,72,66,0.08)] bg-surface p-1"
                  style={{ ...selectionToolbarStyle, boxShadow: "0 4px 12px 0 rgba(64, 72, 66, 0.1)" }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <span
                    className="max-w-40 truncate px-2 text-xs font-semibold text-ink"
                    title={selectedSlot.description || "선택한 이미지"}
                  >
                    {selectedSlot.description || "선택한 이미지"}
                  </span>
                  <button
                    className={toolbarButton}
                    disabled={!canMutate}
                    onClick={() => fileInput.current?.click()}
                  >
                    <ImagePlus className="size-3.5" />
                    {selectedSlot.assetId ? "교체" : "업로드"}
                  </button>
                  {selectedSlot.origin === "user" && (
                    <>
                      <button
                        className={toolbarButton}
                        disabled={!canMutate}
                        onClick={() => changeLayer("front")}
                      >
                        <ArrowUpToLine className="size-3.5" />
                        맨 앞으로
                      </button>
                      <button
                        className={toolbarButton}
                        disabled={!canMutate}
                        onClick={() => changeLayer("back")}
                      >
                        <ArrowDownToLine className="size-3.5" />
                        맨 뒤로
                      </button>
                    </>
                  )}
                  {selectedSlot.assetId && (
                    <button
                      className={`${toolbarButton} px-2 text-icon-muted hover:bg-destructive-surface hover:text-destructive`}
                      aria-label="이미지 제거"
                      title="이미지 제거"
                      disabled={!canMutate}
                      onClick={() =>
                        void mutate(
                          binding(selectedSlot, null, selectedSlot.origin === "user"),
                          { before: cloneImageSlot(selectedSlot), after: null },
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      {!preview && (
        <section
          className="w-full shrink-0 rounded-xl p-2"
          aria-label="슬라이드 목록"
        >
          <div className="relative">
            <div
              ref={thumbnailStrip}
              className="flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={thumbnailMask ? { maskImage: thumbnailMask, WebkitMaskImage: thumbnailMask } : undefined}
            >
              {view.document.slides.map((slide, i) => (
                <button
                  key={slide.slideId}
                  className={cn(
                    "relative w-[176px] shrink-0 rounded-[4px] p-1 text-left",
                    selected === i
                      ? "ring-2 ring-inset ring-brand"
                      : "ring-1 ring-inset ring-field-border",
                  )}
                  onClick={() => {
                    setSelected(i);
                    setSlotId(null);
                    setAdding(false);
                  }}
                >
                  <HtmlSlidePreview
                    slide={slide}
                    view={view}
                    urls={urls}
                    mediaOrigin={new URL(mediaBase()).origin}
                    className="rounded-[4px] border-0"
                  />
                  <span
                    className="pointer-events-none absolute bottom-2 left-3 text-lg font-bold leading-none"
                    style={{ color: thumbnailNumberColor }}
                  >
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
            {thumbnailEdges.left && (
              <button
                type="button"
                aria-label="이전 슬라이드 더 보기"
                onClick={() => thumbnailStrip.current?.scrollBy({ left: -180, behavior: "smooth" })}
                className="absolute -left-4 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-field-border/20 bg-surface text-icon-muted shadow-chip-arrow transition-colors hover:text-ink"
              >
                <ArrowLeft aria-hidden className="size-5" strokeWidth={2.25} />
              </button>
            )}
            {thumbnailEdges.right && (
              <button
                type="button"
                aria-label="다음 슬라이드 더 보기"
                onClick={() => thumbnailStrip.current?.scrollBy({ left: 180, behavior: "smooth" })}
                className="absolute -right-4 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-field-border/20 bg-surface text-icon-muted shadow-chip-arrow transition-colors hover:text-ink"
              >
                <ArrowRight aria-hidden className="size-5" strokeWidth={2.25} />
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
