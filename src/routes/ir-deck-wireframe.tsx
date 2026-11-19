import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Plus, Trash2, Eye, Check, MoreVertical, ChevronRight, Presentation, Upload } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProgramSortDropdown, type ProgramSortOption } from "@/components/my-programs/ProgramSortDropdown";
import { SquareAlertIcon } from "@/components/ui/square-alert-icon";
import { SlideCanvas } from "@/components/ir-deck/SlideCanvas";
import { TextToolbar } from "@/components/ir-deck/TextToolbar";
import { useBusinessAnalysis } from "@/components/ir-deck/useBusinessAnalysis";
import { HtmlDeckWorkspace } from "@/components/ir-deck/HtmlDeckWorkspace";
import type { HtmlReference } from "@/components/ir-deck/html-api";
import {
  defaultFormat,
  mediaUrl,
  newDraft,
  newId,
  newSlide,
  restoreWorkspace,
  slideNames,
  storageKey,
  type Draft,
  type Slide,
  type SlideElement,
  type TextFormat,
  type Workspace,
} from "@/components/ir-deck/model";
import "@/components/ir-deck/ir-deck.css";

const steps = ["사업 내용 입력", "사업 내용 확인", "디자인 선택", "슬라이드 편집"];
const trialStorageKey = "ssiat-ir-deck-trial-v1";
const initialCredits = 100;
const designCost = 30;
type TrialState = { credits: number };
const defaultTrialState: TrialState = { credits: initialCredits };
function Steps({ current }: { current: number }) {
  return (
    <ol aria-label="IR 덱 제작 단계" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {steps.map((label, index) => {
        const step = index + 1;
        const active = step === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="flex items-center gap-3">
            {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 text-ink-muted/50" />}
            <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-ink-muted", step > current && "text-ink-muted/70", active && "font-semibold text-ink")}>
              <span className={cn("grid size-6 place-items-center rounded-full bg-item-hover text-xs font-semibold tabular-nums", step > current && "bg-item-hover/60", active && "text-brand", step < current && "bg-item-hover text-ink")}>
                {step < current ? <Check aria-label="완료" className="size-3.5 text-ink-muted" strokeWidth={2.5} /> : step}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
const button =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border border-field-border px-4 py-3 text-sm font-semibold text-ink hover:bg-item-hover disabled:cursor-not-allowed disabled:opacity-40";
const primary = cn(button, "border-brand bg-brand text-brand-foreground hover:bg-brand/90");
const brandSecondaryButton = "inline-flex h-[42px] items-center justify-center gap-2 rounded-[12px] bg-item-hover px-5 text-[15px] font-semibold text-brand shadow-none transition-colors hover:bg-item-hover-selected active:bg-brand-pressed active:text-brand-foreground focus-visible:ring-1 focus-visible:ring-focus-soft";
const panel = "rounded-2xl border border-field-border bg-surface p-7";
const input =
  "w-full rounded-xl border border-field-border bg-background p-4 text-sm text-ink outline-none focus:border-brand";
const notice = "mt-5 flex items-start gap-3 rounded-xl bg-item-hover p-4 text-sm leading-6 text-ink-muted";
type Screen =
  "home" | "input" | "processing" | "review" | "themes" | "editor" | "preview" | "saved";

export function IrDeckWireframe() {
  const [screen, setScreen] = useState<Screen>("home");
  const [workspace, setWorkspace] = useState<Workspace>(() => ({
    projects: [],
    draft: newDraft(),
  }));
  const [draggingPlan, setDraggingPlan] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [activeField, setActiveField] = useState("title");
  const [media, setMedia] = useState<"image" | "video" | null>(null);
  const [mediaSource, setMediaSource] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [cancelAnalysisOpen, setCancelAnalysisOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [sort, setSort] = useState<ProgramSortOption>("created");
  const [devEmptyPreview, setDevEmptyPreview] = useState(false);
  const [trial, setTrial] = useState<TrialState>(defaultTrialState);
  const [billingOpen, setBillingOpen] = useState(false);
  const { draft, projects } = workspace;
  const displayedProjects = devEmptyPreview ? [] : projects;
  const { theme, primaryColor, primaryColor2, colorMode, slides, activeSlide } = draft;
  const currentSlide = slides[activeSlide] || slides[0]!;
  const analysis = useBusinessAnalysis({ draft, screen, patchDraft, message: setMessage, navigate: setScreen });

  useEffect(() => {
    try {
      const restored = restoreWorkspace(
        localStorage.getItem(storageKey),
        localStorage.getItem("ssiat-ir-deck"),
      );
      if (restored) setWorkspace(restored);
      const savedTrial = localStorage.getItem(trialStorageKey);
      if (savedTrial) {
        const parsed = JSON.parse(savedTrial) as Partial<TrialState>;
        setTrial({
          credits:
            typeof parsed.credits === "number"
              ? Math.max(0, parsed.credits)
              : initialCredits,
        });
      }
    } catch {
      setStorageBlocked(true);
      setMessage(
        "브라우저 저장 내용을 읽지 못했습니다. 기존 데이터는 보존했습니다. 저장소 접근 권한이나 저장 데이터를 확인한 뒤 새로고침해 주세요.",
      );
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("empty") === "1") {
      setDevEmptyPreview(true);
    }
  }, []);
  useEffect(() => {
    if (!loaded || storageBlocked) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(workspace));
    } catch {
      setMessage(
        "브라우저에 임시 저장하지 못했습니다. 저장 공간·접근 권한을 확인해 주세요. 현재 편집 내용은 이 화면에 유지됩니다.",
      );
    }
  }, [workspace, loaded, storageBlocked]);
  useEffect(() => {
    if (!loaded || storageBlocked) return;
    try {
      localStorage.setItem(trialStorageKey, JSON.stringify(trial));
    } catch {
      setMessage("무료 체험 상태를 저장하지 못했습니다. 브라우저 저장소를 확인해 주세요.");
    }
  }, [trial, loaded, storageBlocked]);

  function patchDraft(patch: Partial<Draft>) {
    setWorkspace((w) => ({ ...w, draft: { ...w.draft, ...patch } }));
  }
  function rememberHtml(reference: HtmlReference) {
    setWorkspace(w => {
      if (w.draft.analysis?.deckId !== reference.deckId) return w;
      const id = w.draft.projectId || newId();
      const nextDraft = { ...w.draft, html: reference, projectId: id };
      const existing = w.projects.find(p => p.id === id);
      const project = { id, title: existing?.title || w.draft.slides[0]?.body.split("\n")[0]?.slice(0, 60) || "IR 덱", createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(), draft: structuredClone(nextDraft) };
      const next = { ...w, draft: nextDraft, projects: [project, ...w.projects.filter(p => p.id !== id)] };
      return next;
    });
  }
  function generateHtml() {
    const source = draft.analysis;
    if (!source?.deckId || source.businessRevision === undefined) {
      setMessage("사업내용 확인 화면에서 내용을 저장한 뒤 생성해 주세요.");
      setScreen("review");
      return;
    }
    if (storageBlocked) { setMessage("생성 요청을 이어서 확인하려면 브라우저 저장소 접근을 먼저 확인해 주세요."); return; }
    const reference: HtmlReference = { userId: source.userId, deckId: source.deckId, sourceId: source.sourceId, requestId: newId(), brandSaveId: newId(), businessRevision: source.businessRevision, settings: { brandColors: [draft.primaryColor || "#1F8064", ...(draft.primaryColor2 ? [draft.primaryColor2] : [])].map(c => c.toUpperCase()), theme: draft.colorMode || "light", fontFamily: draft.fontFamily || "Pretendard" } };
    const id = draft.projectId || newId();
    const nextDraft = { ...draft, projectId: id, html: reference };
    const existing = projects.find(project => project.id === id);
    const project = { id, title: existing?.title || draft.slides[0]?.title || "IR 덱", createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(), draft: structuredClone(nextDraft) };
    const next = { ...workspace, draft: nextDraft, projects: [project, ...projects.filter(item => item.id !== id)] };
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setMessage("생성 요청 번호를 저장하지 못했어요. 브라우저 저장소를 확인한 뒤 다시 시도해 주세요."); return; }
    setWorkspace(next);
    setScreen("editor");
  }
  function patchSlide(update: (slide: Slide) => Slide) {
    setWorkspace((w) => ({
      ...w,
      draft: {
        ...w.draft,
        slides: w.draft.slides.map((slide, i) =>
          i === w.draft.activeSlide ? update(slide) : slide,
        ),
      },
    }));
  }
  function selectSlide(index: number) {
    patchDraft({ activeSlide: index });
    setActiveField("title");
  }
  function moveSlide(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= slides.length) return;
    const nextSlides = [...slides];
    [nextSlides[index], nextSlides[nextIndex]] = [nextSlides[nextIndex], nextSlides[index]];
    patchDraft({
      slides: nextSlides,
      activeSlide: activeSlide === index ? nextIndex : activeSlide === nextIndex ? index : activeSlide,
    });
  }
  function startNew() {
    setWorkspace((w) => ({ ...w, draft: newDraft() }));
    setActiveField("title");
    setScreen("input");
  }
  function consumeDesignCredits() {
    if (trial.credits < designCost) {
      setBillingOpen(true);
      return false;
    }
    setTrial((current) => ({ ...current, credits: current.credits - designCost }));
    return true;
  }
  function deleteProject(projectId: string, title: string) {
    setWorkspace((w) => {
      const next = { ...w, projects: w.projects.filter((project) => project.id !== projectId) };
      if (w.draft.projectId === projectId) next.draft = newDraft();
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        setMessage("덱을 삭제하지 못했습니다. 브라우저 저장소를 확인해 주세요.");
      }
      return next;
    });
  }
  function requestDelete(projectId: string, title: string) {
    setDeleteTarget({ id: projectId, title });
  }
  function requestRename(projectId: string, title: string) {
    setRenameTarget({ id: projectId, title });
    setRenameTitle(title);
  }
  function renameProject() {
    if (!renameTarget || !renameTitle.trim()) return;
    const next = {
      ...workspace,
      projects: workspace.projects.map((project) =>
        project.id === renameTarget.id
          ? { ...project, title: renameTitle.trim(), updatedAt: Date.now() }
          : project,
      ),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setWorkspace(next);
      setRenameTarget(null);
    } catch {
      setMessage("제목을 저장하지 못했습니다. 브라우저 저장 공간·접근 권한을 확인해 주세요.");
    }
  }
  function openProject(projectId: string) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    setWorkspace((w) => ({
      ...w,
      projects: w.projects.map((item) =>
        item.id === projectId ? { ...item, lastViewedAt: Date.now() } : item,
      ),
      draft: { ...structuredClone(project.draft), projectId: project.id },
    }));
    setActiveField("title");
    setScreen("editor");
  }
  function changeText(field: string, value: string) {
    patchSlide((slide) =>
      field === "title" || field === "body"
        ? { ...slide, [field]: value }
        : {
            ...slide,
            elements: slide.elements.map((e) =>
              e.type === "text" && `extra:${e.id}` === field ? { ...e, text: value } : e,
            ),
          },
    );
  }
  function changeFormat(patch: Partial<TextFormat>) {
    patchSlide((slide) => ({
      ...slide,
      formats: {
        ...slide.formats,
        [activeField]: { ...(slide.formats[activeField] || defaultFormat(activeField)), ...patch },
      },
    }));
  }
  function save() {
    if (storageBlocked) {
      setMessage(
        "기존 저장 데이터를 보호하기 위해 저장을 중단했습니다. 저장소 문제를 확인한 뒤 새로고침해 주세요.",
      );
      return;
    }
    const id = draft.projectId || newId();
    const savedDraft = { ...draft, projectId: id };
    const previous = projects.find((p) => p.id === id);
    const coverTitle = slides[0]?.title?.trim();
    const shouldSyncCoverTitle =
      !previous || previous.title === previous.draft.slides[0]?.title;
    const project = {
      id,
      title:
        (shouldSyncCoverTitle ? coverTitle : previous?.title) ||
        draft.review["제목"]?.trim() ||
        draft.review["사업/서비스명"]?.trim() ||
        "제목 없는 IR Deck",
      updatedAt: Date.now(),
      createdAt: previous?.createdAt ?? Date.now(),
      lastViewedAt: previous?.lastViewedAt ?? Date.now(),
      draft: structuredClone(savedDraft),
    };
    const next = { draft: savedDraft, projects: [...projects.filter((p) => p.id !== id), project] };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setWorkspace(next);
      setMessage("");
      setScreen("saved");
    } catch {
      setMessage("저장하지 못했습니다. 브라우저 저장 공간·접근 권한을 확인해 주세요.");
    }
  }
  function addElement(element: SlideElement): boolean {
    const next = {
      ...workspace,
      draft: {
        ...draft,
        slides: slides.map((slide, i) =>
          i === activeSlide ? { ...slide, elements: [...slide.elements, element] } : slide,
        ),
      },
    };
    try {
      if (storageBlocked) throw new Error("unavailable storage");
      localStorage.setItem(storageKey, JSON.stringify(next));
      setWorkspace(next);
      if (element.type === "text") setActiveField(`extra:${element.id}`);
      return true;
    } catch {
      setMessage(
        "요소를 저장할 수 없습니다. 브라우저 저장 공간·접근 권한을 확인하거나 작은 이미지를 사용해 주세요.",
      );
      return false;
    }
  }
  function openMedia(kind: "image" | "video") {
    setMedia(kind);
    setMediaSource("");
    setMediaFile(null);
    setMediaError("");
  }
  async function insertMedia() {
    if (!media) return;
    setMediaError("");
    setMediaBusy(true);
    try {
      let src = mediaUrl(mediaSource.trim());
      if (media === "image" && mediaFile) {
        if (!mediaFile.type.startsWith("image/") || mediaFile.size > 1024 * 1024) {
          setMediaError("1MB 이하의 이미지 파일을 선택해 주세요.");
          return;
        }
        src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
          reader.readAsDataURL(mediaFile);
        });
      }
      if (!src) {
        setMediaError("http:// 또는 https://로 시작하는 이미지·MP4·YouTube URL을 입력해 주세요.");
        return;
      }
      if (addElement({ id: newId(), type: media, src })) setMedia(null);
      else setMediaError("저장 공간·접근 권한을 확인하거나 더 작은 이미지를 사용해 주세요.");
    } catch {
      setMediaError("이미지를 읽지 못했습니다. 파일을 다시 선택해 주세요.");
    } finally {
      setMediaBusy(false);
    }
  }
  function page(title: string, subtitle: string, content: ReactNode, actions?: ReactNode, topContent?: ReactNode, titleClass = "text-[28px]") {
    return (
      <main className="ir-deck-workspace min-h-full bg-background pb-20" aria-busy={!loaded}>
        {message && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-field-border bg-item-hover p-4 text-sm text-ink"
          >
            {message}
            <button type="button" className="ml-4 underline" onClick={() => setMessage("")}>
              닫기
            </button>
          </div>
        )}
        {topContent && <div className="mb-5">{topContent}</div>}
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={cn(titleClass, "font-bold leading-tight text-ink")}>{title}</h1>
            {subtitle && title === "AI IR 덱" && (
              <p className="mt-px text-base font-medium text-ink-muted">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </header>
        {loaded ? content : <p role="status">저장된 덱을 불러오는 중입니다.</p>}
        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="w-[calc(100vw-32px)] max-w-[560px] overflow-hidden rounded-[20px] border-0 bg-surface">
            <AlertDialogHeader className="min-w-0 w-full max-w-full">
              <AlertDialogTitle className="mb-4 text-[20px] font-bold leading-7 text-ink">IR 덱을 삭제할까요?</AlertDialogTitle>
              <div className="min-h-10">
                <AlertDialogDescription className="flex h-11 min-w-0 w-full max-w-full items-center gap-1 overflow-hidden rounded-[12px] bg-item-hover px-3 py-2 text-left text-[14px] font-medium leading-5 text-ink-muted">
                  <SquareAlertIcon className="size-4 shrink-0 text-icon-muted" />
                  <span className="min-w-0 truncate">삭제한 IR 덱은 복구할 수 없습니다.</span>
                </AlertDialogDescription>
              </div>
              <div className="mt-2 min-h-12 min-w-0 w-full max-w-full text-left">
                <p className="px-1 text-[14px] font-medium leading-5 text-submenu-text">삭제할 IR 덱</p>
                <p className="mt-2 flex h-11 w-full min-w-0 max-w-full items-center overflow-hidden rounded-[12px] border border-field-border px-3 text-[16px] font-semibold leading-6 text-ink" title={deleteTarget?.title}>
                  <span className="block min-w-0 truncate">{deleteTarget?.title}</span>
                </p>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 flex-row justify-end gap-2 sm:space-x-0">
              <AlertDialogCancel className="mt-0 h-11 rounded-[12px] border-0 bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft">취소</AlertDialogCancel>
              <AlertDialogAction className="h-11 rounded-[12px] border-0 bg-destructive px-5 text-[15px] font-semibold text-white shadow-none hover:bg-destructive/90 focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={(event) => { event.preventDefault(); if (deleteTarget) { deleteProject(deleteTarget.id, deleteTarget.title); setDeleteTarget(null); } }}>삭제하기</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={cancelAnalysisOpen} onOpenChange={setCancelAnalysisOpen}>
          <AlertDialogContent className="w-[calc(100vw-32px)] max-w-[480px] rounded-[20px] border-0 bg-surface p-7">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[20px] font-bold leading-7 text-ink">입력 화면으로 돌아갈까요?</AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-[16px] leading-6 text-ink-muted">
                입력한 내용은 유지됩니다. 접수된 분석은 서버에서 계속 진행되며, 같은 입력으로 분석하기를 누르면 기존 작업을 이어서 확인합니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-5 flex-row justify-end gap-2 sm:space-x-0">
              <AlertDialogCancel className="mt-0 h-11 rounded-[12px] border-0 bg-brand px-5 text-[15px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 active:bg-brand-pressed focus-visible:ring-1 focus-visible:ring-focus-soft">계속 분석하기</AlertDialogCancel>
              <AlertDialogAction className="h-11 rounded-[12px] border-0 bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={() => { setCancelAnalysisOpen(false); setScreen("input"); }}>입력 화면으로 돌아가기</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog
          open={Boolean(renameTarget)}
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
        >
          <DialogContent
            className="rounded-[20px] border-0 bg-surface p-7"
            closeClassName="right-5 top-5 flex size-9 items-center justify-center rounded-lg text-ink-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink focus:outline-none focus:ring-1 focus:ring-focus-soft focus:ring-offset-0"
          >
            <DialogTitle className="text-[20px] font-bold text-ink">IR 덱 제목 수정</DialogTitle>
            <DialogDescription className="text-sm text-ink-muted">
              카드에 표시할 제목을 입력해 주세요.
            </DialogDescription>
            <input
              autoFocus
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") renameProject();
              }}
              className="h-11 rounded-[12px] border border-field-border bg-surface px-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-focus-soft"
              aria-label="IR 덱 제목"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="h-11 rounded-[12px] border-0 bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft"
                onClick={() => setRenameTarget(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="h-11 rounded-[12px] border-0 bg-brand px-5 text-[15px] font-semibold text-brand-foreground shadow-none transition-colors hover:bg-brand/88 active:bg-brand-pressed disabled:cursor-not-allowed disabled:bg-brand-disabled disabled:text-brand-foreground disabled:opacity-100 focus-visible:ring-1 focus-visible:ring-focus-soft"
                disabled={!renameTitle.trim()}
                onClick={renameProject}
              >
                저장
              </button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
          <DialogContent className="rounded-[20px] border-0 bg-surface p-7">
            <DialogTitle className="text-[20px] font-bold text-ink">크레딧이 부족해요</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-ink-muted">
              디자인 생성에는 {designCost}크레딧이 필요합니다. 크레딧을 충전하거나 Pro 플랜을 선택해 주세요.
            </DialogDescription>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="h-11 rounded-[12px] border border-field-border bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-item-hover focus-visible:ring-1 focus-visible:ring-focus-soft"
                onClick={() => {
                  setBillingOpen(false);
                  setMessage("크레딧 충전 기능은 준비 중입니다.");
                }}
              >
                크레딧 충전
              </button>
              <button
                type="button"
                className="h-11 rounded-[12px] border-0 bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:ring-1 focus-visible:ring-focus-soft"
                onClick={() => {
                  setBillingOpen(false);
                  setMessage("Pro 플랜은 준비 중입니다.");
                }}
              >
                Pro 플랜 알아보기
              </button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={media !== null}
          onOpenChange={(open) => {
            if (!open && !mediaBusy) setMedia(null);
          }}
        >
          <DialogContent>
            <DialogTitle>{media === "image" ? "이미지" : "동영상"} 삽입</DialogTitle>
            <DialogDescription>
              {media === "image"
                ? "이미지 URL을 붙여넣거나 1MB 이하 이미지 파일을 선택하세요."
                : "MP4 영상 주소 또는 YouTube 링크를 붙여넣으세요."}
            </DialogDescription>
            <input
              className={input}
              type="url"
              aria-label="미디어 URL"
              placeholder="https://..."
              value={mediaSource}
              onChange={(e) => setMediaSource(e.target.value)}
            />
            {media === "image" && (
              <input
                type="file"
                aria-label="이미지 파일 선택"
                accept="image/*"
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              />
            )}
            {mediaError && (
              <p role="alert" className="text-sm text-destructive">
                {mediaError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={mediaBusy}
                className={button}
                onClick={() => setMedia(null)}
              >
                취소
              </button>
              <button
                type="button"
                disabled={mediaBusy}
                className={primary}
                onClick={() => void insertMedia()}
              >
                {mediaBusy ? "이미지 읽는 중…" : "슬라이드에 삽입"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    );
  }
  const pdf = (
    <button type="button" className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[12px] border border-field-border bg-surface px-5 text-[15px] font-semibold text-ink shadow-none transition-colors hover:bg-item-hover focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={() => window.print()}>
      PDF로 내보내기
    </button>
  );

  if (screen === "home")
    return page(
      "AI IR 덱",
      "사업의 핵심을 투자자가 이해할 수 있는 이야기로 정리해 보세요.",
      <>
        {analysis.canResume && <div className={cn(notice, "mb-5 mt-0 items-center justify-between")}>
          <span>작성 중인 사업 내용이 있어요.</span>
          <button type="button" className="shrink-0 font-semibold text-brand underline" onClick={() => setScreen("input")}>이어서 확인하기</button>
        </div>}
        <div className="relative mb-5 h-[48px] w-full border-b border-field-border">
          <span className="absolute left-0 top-0 inline-flex h-[42px] items-center justify-center gap-[6px] text-[18px] font-medium text-ink">
            전체
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-[13px] bg-item-hover px-[7px] py-1 text-[14px] font-medium text-ink-muted">
            {displayedProjects.length}
            </span>
          </span>
          <div className="absolute right-0 top-[-1px]">
            <ProgramSortDropdown value={sort} onChange={setSort} variant="irDeck" />
          </div>
        </div>
        {!loaded ? <p role="status" className="py-16 text-center text-ink-muted">덱을 불러오는 중이에요.</p> : displayedProjects.length === 0 ? (
        <section className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 grid size-20 place-items-center rounded-full bg-item-hover">
            <Presentation aria-hidden="true" className="size-10 text-ink-muted" strokeWidth={1.5} />
          </div>
          <h2 className="text-[18px] font-semibold text-ink">아직 만든 IR 덱이 없어요</h2>
          <p className="mt-1 text-[15px] text-ink-muted">내 사업의 핵심을 담아 IR 덱의 구성부터 디자인까지 완성해 보세요.</p>
          <button type="button" onClick={startNew} className="mt-5 h-11 rounded-[10px] bg-item-hover px-5 text-[15px] font-semibold text-brand transition-colors hover:bg-item-hover-selected">
            새 IR 덱 만들기
          </button>
        </section>
        ) : (
        <div className="grid gap-5 md:grid-cols-3">
          <button
            type="button"
            onClick={startNew}
            disabled={!loaded}
            className="group flex min-h-[298px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-field-border bg-surface text-ink-muted transition-colors hover:bg-item-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-item-hover text-ink-muted transition-colors group-hover:bg-brand group-hover:text-white">
              <Plus className="size-6" />
            </span>
            <span className="text-[16px] font-semibold text-ink">새 IR 덱 만들기</span>
          </button>
          {[...displayedProjects]
              .sort((a, b) => {
                if (sort === "deadline") {
                  return (b.createdAt ?? b.updatedAt) - (a.createdAt ?? a.updatedAt);
                }
                if (sort === "fit") {
                  return (b.lastViewedAt ?? b.updatedAt) - (a.lastViewedAt ?? a.updatedAt);
                }
                return b.updatedAt - a.updatedAt;
              })
              .map((project) => (
                <div
                  key={project.id}
                  className="overflow-visible rounded-xl border border-field-border text-left hover:border-brand"
                  onClick={() => openProject(project.id)}
                >
                  <div
                    className="ir-deck-thumbnail relative aspect-video overflow-hidden rounded-t-xl bg-transparent"
                    aria-hidden="true"
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-item-hover text-brand">
                      <Presentation className="size-10" />
                      <span className="text-sm font-semibold">{project.draft.html?.documentId ? "HTML 슬라이드 7장" : project.draft.html ? "생성 상태 이어서 확인" : "사업내용 확인 후 생성"}</span>
                    </div>
                  </div>
                  <div className="border-t border-field-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openProject(project.id)}>
                        <strong className="block truncate text-ink">{project.title}</strong>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={`${project.title} 더보기`} className="rounded-md p-1.5 text-ink-muted hover:bg-item-hover" onClick={(event) => event.stopPropagation()}>
                            <MoreVertical className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={6} onClick={(event) => event.stopPropagation()} className="min-w-0 w-fit rounded-[12px] border-0 bg-surface p-1 shadow-none" style={{ boxShadow: "var(--shadow-dropdown)" }}>
                          <DropdownMenuItem onSelect={() => requestRename(project.id, project.title)} className="min-h-10 w-auto cursor-pointer rounded-[8px] px-[14px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-ink">
                            제목 수정
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => requestDelete(project.id, project.title)} className="min-h-10 w-auto cursor-pointer rounded-[8px] px-[14px] text-destructive hover:bg-destructive-surface data-[highlighted]:bg-destructive-surface focus:bg-destructive-surface focus:text-destructive">
                            덱 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <small className="text-ink-muted">
                      최근 수정 {new Date(project.updatedAt).toLocaleString("ko-KR")}
                    </small>
                  </div>
                </div>
              ))}
        </div>
        )}
      </>,
    );

  if (screen === "processing")
    return page(
      "사업 내용 분석 중",
      "입력한 내용을 덱에 필요한 항목으로 정리하는 흐름입니다.",
      <>
        <section className={cn(panel, "p-16 text-center")}>
          <img src="/assets/sidebar/ir-deck-active.svg" alt="" className="mx-auto size-10" />
          <h2 className="mt-5 text-xl font-semibold text-ink" role="status">{analysis.phase}</h2>
          <div className="mx-auto my-7 h-2 max-w-md overflow-hidden rounded-full bg-item-hover">
            <div className="ir-deck-progress h-full w-1/3 rounded-full bg-brand" />
          </div>
          <div className="mt-8 flex justify-center gap-3">
            <button type="button" className="inline-flex h-12 items-center justify-center rounded-[12px] bg-secondary-btn px-5 text-[16px] font-semibold text-secondary-btn-text shadow-none transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={() => setCancelAnalysisOpen(true)}>
              입력 화면으로 돌아가기
            </button>
            {analysis.retryNeeded && <button type="button" className={button} onClick={analysis.retry}>상태 다시 확인</button>}
          </div>
        </section>
      </>,
      undefined,
      <Steps current={2} />,
    );

  if (screen === "review")
    return page(
      "사업 분석 내용 확인",
      "",
      <>
        <section className="space-y-4">
          <div className={cn(notice, "mt-0")}>
            <SquareAlertIcon className="mt-1 size-4 shrink-0 text-icon-muted" aria-hidden="true" />
            <div>
              <strong className="block">슬라이드 구성 7개 미리보기</strong>
              <p className="mt-0 leading-5 font-normal">
                추가하고 싶은 주제는 슬라이드 편집 단계에서 직접 작성할 수 있어요.
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {slideNames.map((slideName, index) => {
              const slide = draft.slides[index] || newSlide(slideName, slideName);
              return (
                <div key={slideName} className="rounded-xl border border-field-border p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">{index + 1}. {slideName}</span>
                    <small className="text-ink-muted">제목과 내용을 확인해 주세요</small>
                  </div>
                  <div className="grid gap-3">
                    <input
                      className={input}
                      aria-label={`${slideName} 제목 수정`}
                      maxLength={240}
                      disabled={analysis.saving}
                      placeholder="슬라이드 제목을 입력해 주세요."
                      value={slide.title}
                      onChange={(e) =>
                        patchDraft({
                          slides: draft.slides.map((item, i) =>
                            i === index ? { ...item, title: e.target.value } : item,
                          ),
                        })
                      }
                    />
                    <textarea
                      className={cn(input, "min-h-24")}
                      aria-label={`${slideName} 내용 수정`}
                      disabled={analysis.saving}
                      placeholder="슬라이드 내용을 입력해 주세요."
                      value={slide.body}
                      onChange={(e) =>
                        patchDraft({
                          slides: draft.slides.map((item, i) =>
                            i === index ? { ...item, body: e.target.value } : item,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="inline-flex h-12 items-center justify-center rounded-[12px] bg-secondary-btn px-5 text-[16px] font-semibold text-secondary-btn-text shadow-none transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={() => setScreen("input")}>
            입력 화면으로 돌아가기
          </button>
          <button type="button" disabled={analysis.saving} onClick={analysis.continueToDesign} className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-brand px-5 text-[16px] font-semibold text-brand-foreground shadow-none transition-colors hover:bg-brand/88 active:bg-brand-pressed focus-visible:ring-1 focus-visible:ring-focus-soft disabled:cursor-not-allowed disabled:opacity-40">
            {analysis.saving ? "수정 내용 저장 중" : "디자인 방향 선택"}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </>,
      undefined,
      <Steps current={2} />,
    );

  if (screen === "themes")
    return page(
      "디자인 방향 선택",
      "브랜드 색상은 최대 2개까지 지정하고, 발표 화면의 명암 모드를 선택해 주세요.",
      <>
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-field-border bg-surface p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-ink">색상 선택</h2>
                <p className="mt-1 text-sm text-ink-muted">브랜드 색상을 최대 2개까지 추가해주세요</p>
              </div>
              <span className="rounded-md bg-item-hover px-2 py-1 text-xs font-medium text-ink-muted">최대 2개</span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="rounded-xl border border-field-border p-4">
                  <span className="block text-sm font-semibold text-ink">주 색상 1</span>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor || "#1F8064"}
                    onChange={(event) => patchDraft({ theme: "Custom", primaryColor: event.target.value })}
                    className="size-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    aria-label="주 색상 선택"
                  />
                  <code className="text-sm font-medium text-ink-muted">{primaryColor || "#1F8064"}</code>
                </div>
              </label>
              <div className="rounded-xl border border-field-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="block text-sm font-semibold text-ink">주 색상 2</span>
                  {primaryColor2 && (
                    <button
                      type="button"
                      onClick={() => patchDraft({ theme: "Custom", primaryColor2: undefined })}
                      className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                    >
                      제거
                    </button>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor2 || primaryColor || "#1F8064"}
                    onChange={(event) => patchDraft({ theme: "Custom", primaryColor2: event.target.value })}
                    className="size-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    aria-label="주 색상 2 선택"
                  />
                  <code className="text-sm font-medium text-ink-muted">{primaryColor2 || "선택하지 않음"}</code>
                </div>
                {!primaryColor2 && <span className="mt-2 block text-xs text-ink-muted">선택 사항</span>}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-field-border bg-surface p-6">
            <h2 className="font-semibold text-ink">화면 모드</h2>
            <p className="mt-1 text-sm text-ink-muted">배경 색을 골라주세요</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(["light", "dark"] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={(colorMode || "light") === mode}
                  onClick={() => patchDraft({ theme: "Custom", colorMode: mode })}
                  className={cn("rounded-xl border p-4 text-left transition-colors", (colorMode || "light") === mode ? "border-brand bg-item-hover-selected" : "border-field-border hover:bg-item-hover")}
                >
                  <span className={cn("mb-3 block h-14 rounded-lg border", mode === "dark" ? "border-[#303936] bg-[#151A18]" : "border-field-border bg-white")} />
                  <b>{mode === "light" ? "라이트" : "다크"}</b>
                </button>
              ))}
            </div>
          </div>
        </section>
        <label className="mt-5 block max-w-sm text-sm font-semibold text-ink">슬라이드 글꼴
          <select className={cn(input, "mt-2")} value={draft.fontFamily || "Pretendard"} onChange={event => patchDraft({ fontFamily: event.target.value as "Paperlogy" | "Pretendard" })}>
            <option value="Pretendard">Pretendard</option><option value="Paperlogy">Paperlogy 제목 + Pretendard 본문</option>
          </select>
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="inline-flex h-12 items-center justify-center rounded-[12px] bg-secondary-btn px-5 text-[16px] font-semibold text-secondary-btn-text shadow-none transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={() => setScreen("review")}>
            이전
          </button>
          <button
            type="button"
            onClick={generateHtml}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-brand px-5 text-[16px] font-semibold text-brand-foreground shadow-none transition-colors hover:bg-brand/88 active:bg-brand-pressed focus-visible:ring-1 focus-visible:ring-focus-soft"
          >
            이 디자인으로 IR 덱 만들기
            <ArrowRight className="size-4" />
          </button>
        </div>
      </>,
      undefined,
      <Steps current={3} />,
    );

  if (screen === "editor" || screen === "preview" || screen === "saved") {
    if (!draft.html) return page("IR 덱 생성", "이전 작업의 사업내용을 확인한 뒤 HTML 슬라이드를 생성해 주세요.", <button className={primary} onClick={() => setScreen(draft.analysis?.deckId ? "review" : "input")}>사업내용 확인하기</button>);
    return page("", "", <HtmlDeckWorkspace key={draft.html.requestId} reference={draft.html} persist={rememberHtml} onHome={() => setScreen("home")} onBack={() => setScreen("themes")} onSave={() => { if (draft.html) rememberHtml(draft.html); }} />);
  }


  return page(
    "사업계획서를 바탕으로 IR 덱을 만들어 보세요",
    "사업계획서를 업로드해 7개 슬라이드 구성으로 정리해 보세요.",
    <>
      <section className={panel}>
        <label
          className={cn("relative mt-0 flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed border-field-border bg-surface px-5 py-6 text-center transition-colors hover:border-brand focus-within:border-brand focus-within:ring-[3.2px] focus-within:ring-focus-soft", draggingPlan && "border-brand bg-item-hover-selected")}
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes("Files")) {
              e.dataTransfer.dropEffect = "copy";
              setDraggingPlan(true);
            }
          }}
          onDragLeave={(e) => {
            if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDraggingPlan(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDraggingPlan(false);
            const file = e.dataTransfer.files[0] ?? Array.from(e.dataTransfer.items).find(item => item.kind === "file")?.getAsFile();
            if (file) analysis.chooseFile(file);
            else setMessage("파일을 받지 못했어요. 파일 선택 버튼으로 PDF를 선택해 주세요.");
          }}
        >
          <span className="block font-semibold text-ink">사업계획서 업로드</span>
          <span className="mt-2 block text-sm text-ink-muted">
            {draggingPlan ? "여기에 PDF 파일을 놓아주세요." : "PDF 파일을 여기에 끌어다 놓거나, 파일 선택 버튼을 눌러주세요."}
          </span>
          <span className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border-0 bg-secondary-btn px-4 text-[14px] font-semibold text-secondary-btn-text shadow-none">
            <Upload className="size-4" aria-hidden="true" />
            파일 선택
          </span>
          {draft.fileName && (
            <span className="mt-3 block break-all text-sm text-ink">{draft.fileName}</span>
          )}
          <input
            className="sr-only"
            type="file"
            accept=".pdf,application/pdf"
            disabled={analysis.submitting}
            aria-label="사업계획서 파일 선택"
            onChange={(e) => {
              analysis.chooseFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {draft.fileName && (
          <button
            type="button"
            className={cn(button, "mt-3")}
            disabled={analysis.submitting}
            onClick={analysis.clearFile}
          >
            선택한 파일 해제
          </button>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="inline-flex h-12 items-center justify-center rounded-[12px] bg-secondary-btn px-5 text-[16px] font-semibold text-secondary-btn-text shadow-none transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={() => setScreen("home")}>
            이전
          </button>
          <button
            type="button"
            onClick={analysis.analyze}
            disabled={analysis.submitting || !draft.fileName}
            className={cn(
              primary,
              "h-12 rounded-[12px] px-5 text-[16px] shadow-none",
              "disabled:border-brand-disabled disabled:bg-brand-disabled disabled:text-brand-foreground disabled:opacity-100",
            )}
          >
            사업 내용 분석하기
            <ArrowRight className="size-4" />
          </button>
        </div>
      </section>
    </>,
    undefined,
    <Steps current={1} />,
    "text-2xl",
  );
}
