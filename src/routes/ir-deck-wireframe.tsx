import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, LoaderCircle, Plus, Trash2, Eye, Check, MoreVertical, ChevronRight, Presentation, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { accountWorkspaceKey, ownedWorkspace, completedLibraryProjects, projectDeckId, resumeLibraryProject, mutateLibrary } from "@/components/ir-deck/library";
import { libraryRpc } from "@/components/ir-deck/library-client";
import { useDeckLibrary } from "@/components/ir-deck/useDeckLibrary";
import { reviewHash } from "@/components/ir-deck/analysis";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DropdownChevron } from "@/components/ui/DropdownChevron";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProgramSortDropdown, type ProgramSortOption } from "@/components/my-programs/ProgramSortDropdown";
import { SquareAlertIcon } from "@/components/ui/square-alert-icon";
import { SlideCanvas } from "@/components/ir-deck/SlideCanvas";
import { TextToolbar } from "@/components/ir-deck/TextToolbar";
import { useBusinessAnalysis } from "@/components/ir-deck/useBusinessAnalysis";
import { HtmlDeckWorkspace } from "@/components/ir-deck/HtmlDeckWorkspace";
import { HtmlSlidePreview } from "@/components/ir-deck/HtmlSlidePreview";
import { htmlCall, imageUrl, mediaBase } from "@/components/ir-deck/html-client";
import { parseView, type HtmlReference, type HtmlSlide, type HtmlView } from "@/components/ir-deck/html-api";
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
const processingPhaseTargets: Array<[string, number]> = [
  ["PDF 업로드를 준비하고 있어요", 25],
  ["분석 시작을 기다리고 있어요", 50],
  ["PDF에서 사업 내용을 읽고 있어요", 75],
  ["사업 내용을 7개 항목으로 정리하고 있어요", 100],
  ["사업 내용을 정리하고 있어요", 100],
];

const editorPreviewReference: HtmlReference = {
  userId: "00000000-0000-4000-8000-000000000001",
  deckId: "00000000-0000-4000-8000-000000000002",
  sourceId: "00000000-0000-4000-8000-000000000003",
  requestId: "00000000-0000-4000-8000-000000000004",
  brandSaveId: "00000000-0000-4000-8000-000000000005",
  businessRevision: 1,
  brandRevision: 1,
  documentId: "00000000-0000-4000-8000-000000000006",
  settings: { brandColors: ["#1F8064"], theme: "dark", fontFamily: "Paperlogy" },
};

function editorPreviewSlide(
  slideId: string,
  sectionLabel: string,
  headline: string,
  body: string,
  cover = false,
): HtmlSlide {
  return {
    slideId,
    sectionLabel,
    headline,
    html: `<section class="ir-slide" data-slide-id="${slideId}"><div class="preview-kicker">${sectionLabel}</div><h1>${headline}</h1><p>${body}</p>${cover ? '<div class="preview-meta"><span>씨앗(SSIAT)</span><span>메이츠(Mates)</span></div>' : ""}</section>`,
    css: `.ir-slide{background:${cover ? "#121715" : "#FFFFFF"};color:${cover ? "#FFFFFF" : "#173D31"};padding:132px 144px;display:flex;flex-direction:column;justify-content:center}.preview-kicker{color:#58C6A5;font:700 24px/1.3 Paperlogy,sans-serif;letter-spacing:.02em}.ir-slide h1{margin:28px 0 0;font:700 ${cover ? "86px" : "68px"}/1.12 Paperlogy,sans-serif;letter-spacing:-.04em;max-width:1450px}.ir-slide p{margin:30px 0 0;color:${cover ? "#DCE8E2" : "#587067"};font:400 30px/1.55 Pretendard,sans-serif;max-width:1250px}.preview-meta{display:flex;gap:32px;margin-top:120px;color:#9CE8CF;font:600 22px/1.4 Pretendard,sans-serif}`,
  };
}

function editorPreviewView(): HtmlView {
  const labels = [
    ["Business", "씨앗(SSIAT)", "청년의 다음 행동을 연결하는 AI 창업 파트너"],
    ["Problem", "막막한 지원사업 탐색", "정보는 많지만 내 사업에 맞는 다음 행동은 선명하지 않습니다."],
    ["Target Customer", "창업을 시작하는 청년", "사업 초기 단계에서 지원사업과 실행 순서를 찾는 팀"],
    ["Solution", "매칭부터 실행까지", "사업 내용을 이해하고 필요한 지원과 다음 단계를 제안합니다."],
    ["Product & Service", "AI 사업 파트너", "지원사업 매칭과 IR 덱 제작을 한 흐름으로 연결합니다."],
    ["Market Analysis", "창업 지원 시장", "공공 지원 정보와 초기 창업 수요를 함께 살펴봅니다."],
    ["Revenue Model", "지속 가능한 성장", "팀의 실행을 돕는 구독형 도구로 확장합니다."],
  ] as const;
  return {
    document_id: editorPreviewReference.documentId!,
    deck_id: editorPreviewReference.deckId,
    image_revision: 0,
    document: {
      schemaVersion: "ir_html_v1",
      canvas: { width: 1920, height: 1080 },
      designTokens: { colors: { CANVAS: "#121715", BRAND: "#58C6A5", INK: "#173D31" } },
      slides: labels.map(([section, headline, body], index) =>
        editorPreviewSlide(`preview-${index + 1}`, section, headline, body, index === 0),
      ),
    },
    imageSlots: [],
    validation: { security_checked: true, original_html_render_checked: true },
  };
}

const editorPreviewDocument = editorPreviewView();

function ProjectThumbnail(props: { project: { draft: Draft }; cloudDocument?: { documentId: string; deckId: string } | undefined }) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!element.current || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(element.current); return () => observer.disconnect();
  }, []);
  return <div ref={element} className="h-full w-full">{visible ? <ProjectThumbnailContent {...props} /> : <div className="h-full w-full bg-item-hover" />}</div>;
}
function ProjectThumbnailContent({ project, cloudDocument }: { project: { draft: Draft }; cloudDocument?: { documentId: string; deckId: string } | undefined }) {
  const reference = cloudDocument ? { documentId: cloudDocument.documentId, deckId: cloudDocument.deckId } : project.draft.html;
  const [view, setView] = useState<HtmlView | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(reference?.documentId));

  useEffect(() => {
    let cancelled = false;
    setView(null);
    setUrls({});
    setLoading(Boolean(reference?.documentId));
    if (!reference?.documentId) return () => { cancelled = true; };

    void htmlCall("ir-deck-html-api-v1", {
      action: "get_document",
      document_id: reference.documentId,
    })
      .then((data) => {
        if (cancelled) return;
        const next = parseView(data, reference.deckId);
        setView(next);
        const firstSlideId = next.document.slides[0]?.slideId;
        if (!firstSlideId) {
          setLoading(false);
          return;
        }
        return Promise.all(
          next.imageSlots
            .filter((slot) => slot.slideId === firstSlideId && slot.assetId)
            .map(async (slot) => [slot.assetId!, await imageUrl(slot.assetId!)] as const),
        ).then((entries) => {
          if (!cancelled) {
            setUrls(Object.fromEntries(entries));
            setLoading(false);
          }
        });
      })
      .catch(() => {
        // 완료 문서를 불러오지 못하면 브라우저에 저장된 초안 프리뷰를 유지한다.
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [reference?.deckId, reference?.documentId]);

  if (loading) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-item-hover"
        aria-label="썸네일 불러오는 중"
      >
        <LoaderCircle className="size-7 animate-spin text-ink-muted" />
      </div>
    );
  }

  if (view?.document.slides[0]) {
    return (
      <HtmlSlidePreview
        slide={view.document.slides[0]}
        view={view}
        urls={urls}
        mediaOrigin={mediaBase()}
        className="rounded-none border-0"
      />
    );
  }

  return (
    <SlideCanvas
      slide={project.draft.slides[0] || newSlide("Business", "사업 소개")}
      theme={project.draft.theme}
      primaryColor={project.draft.primaryColor}
      primaryColor2={project.draft.primaryColor2}
      colorMode={project.draft.colorMode}
      className="h-full w-full rounded-none border-0 p-[7%] shadow-none"
    />
  );
}

function readableTextColor(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#FFFFFF";
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.58 ? "#173D31" : "#FFFFFF";
}
function relativeLuminance(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return 0.4;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}
function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}
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

function IrDeckEmptyStateArtwork() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto mb-4 h-[144px] w-[163px] saturate-[0.1]"
    >
      <img
        src="/assets/empty/ir-deck/bubble-1.svg"
        alt=""
        draggable={false}
        className="animate-empty-speech-bubble absolute left-0 top-0 block h-auto w-[52.55px] max-w-none"
      />
      <img
        src="/assets/empty/ir-deck/chart-v2.svg"
        alt=""
        draggable={false}
        className="absolute left-[29.5px] top-[73.41px] block h-auto w-[104.03px] max-w-none"
      />
      <img
        src="/assets/empty/ir-deck/bubble-2.svg"
        alt=""
        draggable={false}
        className="animate-empty-speech-bubble animate-empty-review-bubble-delay absolute left-[104.43px] top-[32.44px] block h-auto w-[52.55px] max-w-none"
      />
    </div>
  );
}

function projectTitle(project: { title: string; draft: Draft }) {
  return project.title;
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
  const { user, loading: authLoading } = useAuth();
  const accountKey = accountWorkspaceKey(user?.id ?? null);
  const libraryOwner = useRef(user?.id);
  libraryOwner.current = user?.id;
  const [cacheOwner, setCacheOwner] = useState("");
  const libraryLock = useRef(false);
  const [libraryPending, setLibraryPending] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [workspace, setWorkspace] = useState<Workspace>(() => ({
    projects: [],
    draft: newDraft(),
  }));
  const [draggingPlan, setDraggingPlan] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [analysisErrorOpen, setAnalysisErrorOpen] = useState(false);
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
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const { draft, projects } = workspace;
  const library = useDeckLibrary(user?.id, loaded && cacheOwner === accountKey && screen === "home");
  const displayedProjects = devEmptyPreview || cacheOwner !== accountKey ? [] : user
    ? completedLibraryProjects(projects, library.items, user.id, library.ready) : projects.filter(project => Boolean(project.draft.html?.documentId));
  const cloudItem = (project: (typeof projects)[number]) => library.items.find(item => item.deck_id === projectDeckId(project) || item.deck_id === project.id);
  const displayProjectTitle = (project: (typeof projects)[number]) => cloudItem(project)?.title ?? projectTitle(project);
  const { theme, primaryColor, primaryColor2, colorMode, slides, activeSlide } = draft;
  const recommendedColorMode = primaryColor && Math.round(contrastRatio(primaryColor, "#FFFFFF") * 10) / 10 < 3 ? "dark" : "light";
  const currentSlide = slides[activeSlide] || slides[0]!;
  const analysis = useBusinessAnalysis({
    draft,
    screen,
    patchDraft,
    message: setMessage,
    networkError: () => {
      setMessage("");
      setAnalysisErrorOpen(true);
    },
    navigate: setScreen,
  });
  const [processingProgress, setProcessingProgress] = useState(0);
  const previousProcessingPhase = useRef<string | undefined>(undefined);
  const catchingUpToPhase = useRef(false);
  const processingTarget = processingPhaseTargets.find(([phase]) => phase === analysis.phase)?.[1] ?? 0;

  useEffect(() => {
    if (authLoading) return;
    setLoaded(false);
    setScreen("home");
    setMessage("");
    setStorageBlocked(false);
    setDeleteTarget(null);
    setRenameTarget(null);
    setRenameTitle("");
    setMedia(null);
    setMediaSource("");
    setMediaFile(null);
    try {
      const scoped = localStorage.getItem(accountKey);
      const restored = scoped ? restoreWorkspace(scoped, null) : restoreWorkspace(
        localStorage.getItem(storageKey), localStorage.getItem("ssiat-ir-deck"));
      setWorkspace(ownedWorkspace(restored, user?.id ?? null, scoped !== null));
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
      setWorkspace({ projects: [], draft: newDraft() });
      setStorageBlocked(true);
      setMessage(
        "브라우저 저장 내용을 읽지 못했습니다. 기존 데이터는 보존했습니다. 저장소 접근 권한이나 저장 데이터를 확인한 뒤 새로고침해 주세요.",
      );
    }
    setCacheOwner(accountKey);
    setLoaded(true);
  }, [authLoading, accountKey, user?.id]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (import.meta.env.DEV && params.get("empty") === "1") {
      setDevEmptyPreview(true);
    }
  }, []);
  useEffect(() => {
    if (!loaded || !import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("preview") !== "themes") return;
    setScreen("themes");
    setWorkspace((current) => ({
      ...current,
      draft: { ...current.draft, primaryColor: undefined, primaryColor2: undefined, fontFamily: "Paperlogy" },
    }));
  }, [loaded]);
  useEffect(() => {
    if (screen !== "processing" || analysisErrorOpen || draft.analysis?.failed) return;
    setProcessingProgress(0);
    previousProcessingPhase.current = undefined;
    catchingUpToPhase.current = false;
  }, [screen]);
  useEffect(() => {
    if (screen !== "processing") {
      previousProcessingPhase.current = undefined;
      catchingUpToPhase.current = false;
      return;
    }
    if (previousProcessingPhase.current !== undefined && previousProcessingPhase.current !== analysis.phase) {
      catchingUpToPhase.current = true;
    }
    previousProcessingPhase.current = analysis.phase;
  }, [analysis.phase, screen]);
  useEffect(() => {
    if (screen !== "processing") return;
    const timer = window.setInterval(() => {
      setProcessingProgress((current) => {
        const distance = processingTarget - current;
        if (Math.abs(distance) <= 0.35) {
          catchingUpToPhase.current = false;
          return processingTarget;
        }
        const step = catchingUpToPhase.current ? 2.4 : 0.45;
        if (Math.abs(distance) <= step) {
          catchingUpToPhase.current = false;
          return processingTarget;
        }
        return current + Math.sign(distance) * Math.min(Math.abs(distance), step);
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [analysisErrorOpen, draft.analysis?.failed, processingTarget, screen]);
  useEffect(() => {
    if (!loaded || !import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("preview") !== "editor") return;
    setWorkspace((current) => ({
      ...current,
      draft: { ...newDraft(), html: editorPreviewReference, projectId: "editor-preview" },
    }));
    setScreen("editor");
  }, [loaded]);
  useEffect(() => {
    if (!loaded || storageBlocked || authLoading || cacheOwner !== accountKey) return;
    try {
      localStorage.setItem(accountKey, JSON.stringify(workspace));
    } catch {
      setMessage(
        "브라우저에 임시 저장하지 못했습니다. 저장 공간·접근 권한을 확인해 주세요. 현재 편집 내용은 이 화면에 유지됩니다.",
      );
    }
  }, [workspace, loaded, storageBlocked, authLoading, cacheOwner, accountKey]);
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
    if (!draft.primaryColor) {
      setMessage("주 색상을 선택해 주세요.");
      return;
    }
    const reference: HtmlReference = { userId: source.userId, deckId: source.deckId, sourceId: source.sourceId, requestId: newId(), brandSaveId: newId(), businessRevision: source.businessRevision, settings: { brandColors: [draft.primaryColor || "#1F8064", ...(draft.primaryColor2 ? [draft.primaryColor2] : [])].map(c => c.toUpperCase()), theme: draft.colorMode || "light", fontFamily: draft.fontFamily || "Paperlogy" } };
    const id = draft.projectId || newId();
    const nextDraft = { ...draft, projectId: id, html: reference };
    const existing = projects.find(project => project.id === id);
    const project = { id, title: existing?.title || draft.slides[0]?.title || "IR 덱", createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(), draft: structuredClone(nextDraft) };
    const next = { ...workspace, draft: nextDraft, projects: [project, ...projects.filter(item => item.id !== id)] };
    try { localStorage.setItem(accountKey, JSON.stringify(next)); }
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
  async function deleteProject(projectId: string, _title: string) {
    if (libraryLock.current) return;
    const project = displayedProjects.find(p => p.id === projectId);
    if (!project) return;
    const deck = cloudItem(project)?.deck_id ?? projectDeckId(project), owner = user?.id;
    libraryLock.current = true; setLibraryPending(true);
    try {
      if (deck) {
        if (!owner) throw new Error("로그인 후 이용해주세요.");
        await mutateLibrary(libraryRpc, owner, deck);
        if (libraryOwner.current !== owner) return;
        library.remove(deck);
      }
      setWorkspace(w => ({ ...w, projects: w.projects.filter(p => p.id !== projectId && (!deck || projectDeckId(p) !== deck)), draft: w.draft.projectId === projectId ? newDraft() : w.draft }));
      setDeleteTarget(null);
    } catch (error) { if (libraryOwner.current === owner) setMessage(error instanceof Error ? error.message : "덱을 삭제하지 못했습니다."); }
    finally { libraryLock.current = false; setLibraryPending(false); }
  }
  function requestDelete(projectId: string, title: string) { setDeleteTarget({ id: projectId, title }); }
  function requestRename(projectId: string, title: string) { setRenameTarget({ id: projectId, title }); setRenameTitle(title); }
  async function renameProject() {
    if (!renameTarget || !renameTitle.trim() || libraryLock.current) return;
    const project = displayedProjects.find(p => p.id === renameTarget.id);
    if (!project) return;
    const owner = user?.id, deck = cloudItem(project)?.deck_id ?? projectDeckId(project), title = renameTitle.trim();
    libraryLock.current = true; setLibraryPending(true);
    try {
      if (deck) {
        if (!owner) throw new Error("로그인 후 이용해주세요.");
        await mutateLibrary(libraryRpc, owner, deck, title);
        if (libraryOwner.current !== owner) return;
        library.rename(deck, title);
      }
      setWorkspace(w => ({ ...w, projects: w.projects.map(p => p.id === project.id ? { ...p, title, updatedAt: Date.now() } : p) }));
      setRenameTarget(null);
    } catch (error) { if (libraryOwner.current === owner) setMessage(error instanceof Error ? error.message : "제목을 저장하지 못했습니다."); }
    finally { libraryLock.current = false; setLibraryPending(false); }
  }
  async function openProject(projectId: string) {
    if (libraryLock.current) return;
    const project = displayedProjects.find(p => p.id === projectId);
    if (!project) return;
    const owner = user?.id, deck = cloudItem(project)?.deck_id ?? projectDeckId(project);
    libraryLock.current = true; setLibraryPending(true); setMessage("");
    try {
      let nextDraft = structuredClone(project.draft);
      let nextScreen: Screen = "editor";
      if (deck) {
        if (!owner) throw new Error("로그인 후 이용해주세요.");
        const restored = await resumeLibraryProject(libraryRpc, owner, deck, project.id);
        if (libraryOwner.current !== owner) return;
        const local = project.draft.analysis;
        const dirty = local?.businessRevision !== undefined && local.savedReviewHash !== await reviewHash(project.draft.slides);
        nextDraft = restored.draft; nextScreen = restored.screen;
        if (dirty && nextDraft.analysis && local?.businessRevision !== undefined) {
          nextDraft.slides = structuredClone(project.draft.slides);
          nextDraft.analysis = { ...nextDraft.analysis, businessRevision: local.businessRevision };
          if (local.savedReviewHash !== undefined) nextDraft.analysis.savedReviewHash = local.savedReviewHash;
          else delete nextDraft.analysis.savedReviewHash;
          nextDraft.html = undefined; nextScreen = "review";
        }
      }
      if (libraryOwner.current !== owner) return;
      nextDraft.projectId = project.id;
      setWorkspace(w => ({ ...w, draft: nextDraft, projects: [{ ...project, draft: structuredClone(nextDraft), lastViewedAt: Date.now() }, ...w.projects.filter(p => p.id !== project.id && (!deck || projectDeckId(p) !== deck))] }));
      setActiveField("title"); setScreen(nextScreen);
    } catch (error) { if (libraryOwner.current === owner) setMessage(error instanceof Error ? error.message : "덱을 불러오지 못했습니다."); }
    finally { libraryLock.current = false; setLibraryPending(false); }
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
    const pdfTitle = draft.fileName.replace(/\.pdf$/i, "").trim();
    const project = {
      id,
      title:
        previous?.title ||
        pdfTitle ||
        coverTitle ||
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
      localStorage.setItem(accountKey, JSON.stringify(next));
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
      localStorage.setItem(accountKey, JSON.stringify(next));
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
              <AlertDialogAction className="h-11 rounded-[12px] border-0 bg-destructive px-5 text-[15px] font-semibold text-white shadow-none hover:bg-destructive/90 focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={(event) => { event.preventDefault(); if (deleteTarget) { void deleteProject(deleteTarget.id, deleteTarget.title); } }}>삭제하기</AlertDialogAction>
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
              <AlertDialogCancel className="mt-0 h-11 rounded-[12px] border-0 bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft">계속 분석하기</AlertDialogCancel>
              <AlertDialogAction className="h-11 rounded-[12px] border-0 bg-brand px-5 text-[15px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 active:bg-brand-pressed focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={() => { setCancelAnalysisOpen(false); setScreen("input"); }}>입력 화면으로 돌아가기</AlertDialogAction>
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
            closeClassName="right-5 top-5 flex size-9 items-center justify-center rounded-lg text-icon-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-soft focus-visible:ring-offset-0 [&_svg]:size-6"
          >
            <DialogTitle className="text-[20px] font-bold text-ink">IR 덱 제목 수정</DialogTitle>
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
                disabled={!renameTitle.trim() || libraryPending}
                onClick={renameProject}
              >
                저장
              </button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={analysisErrorOpen} onOpenChange={setAnalysisErrorOpen}>
          <DialogContent
            className="w-[calc(100vw-32px)] max-w-[560px] rounded-[20px] border-0 bg-surface p-7"
            closeClassName="right-5 top-5 flex size-9 items-center justify-center rounded-lg text-icon-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-soft focus-visible:ring-offset-0 [&_svg]:size-6"
          >
            <DialogTitle className="text-[20px] font-bold text-ink">앗, 분석 결과를 받아오지 못했어요</DialogTitle>
            <DialogDescription className="-mt-2 text-[16px] leading-6 text-ink-muted">
              분석 결과를 받아오지 못했어요. 입력 내용은 유지되니 다시 시도해주세요.
            </DialogDescription>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-[12px] border-0 bg-secondary-btn px-5 text-[16px] font-semibold text-secondary-btn-text shadow-none transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft"
                onClick={() => setAnalysisErrorOpen(false)}
              >
                닫기
              </button>
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-[12px] border-0 bg-brand px-5 text-[16px] font-semibold text-brand-foreground shadow-none transition-colors hover:bg-brand/88 active:bg-brand-pressed focus-visible:ring-1 focus-visible:ring-focus-soft"
                onClick={() => {
                  setAnalysisErrorOpen(false);
                  window.setTimeout(() => {
                    if (analysis.retryNeeded) analysis.retry();
                    else void analysis.analyze();
                  }, 220);
                }}
              >
                다시 시도
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

  if (authLoading || cacheOwner !== accountKey) return page("", "", <p role="status" className="py-16 text-center text-ink-muted">덱을 불러오는 중이에요.</p>);
  if (screen === "home")
    return page(
      "AI IR 덱",
      "",
      <>
        <div className="relative -mt-2.5 mb-5 h-[48px] w-full">
          <div className="absolute left-[-12px] top-0 flex items-start">
            <div className="flex h-[48px] w-max shrink-0 cursor-default flex-col items-start gap-[5px]">
              <span className="inline-flex items-center justify-center gap-[6px] overflow-hidden rounded-[10px] pl-3 pr-1.5 py-2 text-[18px] font-medium whitespace-nowrap text-ink">
                전체
                <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-item-hover px-[7px] py-1 text-[14px] font-medium text-ink-muted">
                  {displayedProjects.length}
                </span>
              </span>
              <span aria-hidden="true" className="flex h-[3px] w-full items-start overflow-hidden px-3" />
            </div>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute left-0 top-[47px] h-px w-full bg-field-border" />
          <div className="absolute right-0 top-[-1px]">
            <ProgramSortDropdown value={sort} onChange={setSort} variant="irDeck" />
          </div>
        </div>
        {library.error && <p role="alert" className="mb-4 text-sm text-ink-muted">{library.error} <button type="button" onClick={library.refresh} className="underline">다시 불러오기</button></p>}
        {libraryPending && <p role="status" className="mb-4 text-sm text-ink-muted">덱 정보를 확인하고 있어요.</p>}
        {!loaded || (user && !library.ready && !library.error) ? <p role="status" className="py-16 text-center text-ink-muted">덱을 불러오는 중이에요.</p> : displayedProjects.length === 0 ? (
        <section className="flex flex-col items-center px-6 py-16 text-center">
          <IrDeckEmptyStateArtwork />
          {analysis.canResume ? (
            <>
              <h2 className="text-[18px] font-semibold text-ink">작성 중인 사업 내용이 있어요</h2>
              <p className="mt-1 text-[15px] text-ink-muted">분석이 완료되면 이곳에서 결과를 확인할 수 있어요.</p>
            </>
          ) : (
            <>
              <h2 className="text-[18px] font-semibold text-ink">아직 만든 IR 덱이 없어요</h2>
              <p className="mt-1 text-[15px] text-ink-muted">내 사업의 핵심을 담아 IR 덱의 구성부터 디자인까지 완성해 보세요.</p>
              <button type="button" onClick={startNew} className="mt-5 h-11 rounded-[10px] bg-item-hover px-5 text-[15px] font-semibold text-brand transition-colors hover:bg-item-hover-selected">
                새 IR 덱 만들기
              </button>
            </>
          )}
        </section>
        ) : (
        <div className="grid gap-5 md:grid-cols-3">
          <button
            type="button"
            onClick={startNew}
            disabled={!loaded}
            className="group flex min-h-[298px] flex-col items-center justify-center gap-3 rounded-xl border border-field-border bg-surface text-ink-muted transition-[border-color] duration-150 ease-out hover:border-brand motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"
          >
              <span className="flex size-12 items-center justify-center rounded-full bg-item-hover text-ink-muted">
              <Plus className="size-6 transition-transform duration-200 ease-out group-hover:rotate-90 motion-reduce:transition-none" />
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
                  className="overflow-visible rounded-xl border border-field-border text-left transition-[box-shadow] duration-150 ease-out hover:shadow-[0_8px_30px_0_rgba(0,13,59,0.1)] motion-reduce:transition-none"
                  onClick={() => openProject(project.id)}
                >
                  <div
                    className="ir-deck-thumbnail relative aspect-video overflow-hidden rounded-t-xl bg-transparent"
                    aria-hidden="true"
                  >
                    <ProjectThumbnail project={project} cloudDocument={cloudItem(project)?.document_id ? { documentId: cloudItem(project)!.document_id!, deckId: cloudItem(project)!.deck_id } : undefined} />
                  </div>
                  <div className="border-t border-field-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openProject(project.id)}>
                        <strong className="block truncate text-ink">{displayProjectTitle(project)}</strong>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={`${displayProjectTitle(project)} 더보기`} className="rounded-md p-1.5 text-ink-muted hover:bg-item-hover" onClick={(event) => event.stopPropagation()}>
                            <span aria-hidden className="flex size-6 flex-col items-center justify-center gap-[3px]">
                              <span className="size-[2.5px] rounded-full bg-[#84968E]" />
                              <span className="size-[2.5px] rounded-full bg-[#84968E]" />
                              <span className="size-[2.5px] rounded-full bg-[#84968E]" />
                            </span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={6} onClick={(event) => event.stopPropagation()} className="min-w-0 w-fit rounded-[12px] border-0 bg-surface p-1 shadow-none" style={{ boxShadow: "var(--shadow-dropdown)" }}>
                          <DropdownMenuItem onSelect={() => requestRename(project.id, displayProjectTitle(project))} className="min-h-10 w-auto cursor-pointer rounded-[8px] px-[14px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-ink">
                            제목 수정
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => requestDelete(project.id, displayProjectTitle(project))} className="min-h-10 w-auto cursor-pointer rounded-[8px] px-[14px] text-destructive hover:bg-destructive-surface data-[highlighted]:bg-destructive-surface focus:bg-destructive-surface focus:text-destructive">
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

  if (screen === "processing") {
    return page(
      "사업 내용 분석 중",
      "입력한 내용을 덱에 필요한 항목으로 정리하는 흐름입니다.",
      <>
        <section className={cn(panel, "p-16 text-center")}>
          <img src="/assets/sidebar/ir-deck-active.svg" alt="" className="mx-auto size-10" />
          <h2 className="mt-5 text-xl font-semibold text-ink" role="status">{analysis.phase}</h2>
          {analysis.retryNeeded && !draft.analysis?.failed && (
            <p className="mt-2 text-sm text-ink-muted">
              분석이 오래 걸리고 있어요. 1분 후 상태 다시 확인 버튼을 눌러주세요.
            </p>
          )}
          <div className="mx-auto my-7 h-2 max-w-md overflow-hidden rounded-full bg-item-hover">
            <div className="ir-deck-progress h-full rounded-full bg-brand" style={{ width: `${processingProgress}%` }} />
          </div>
          <div className="mt-8 flex justify-center gap-3">
            <button type="button" className="inline-flex h-12 items-center justify-center rounded-[12px] bg-secondary-btn px-5 text-[16px] font-semibold text-secondary-btn-text shadow-none transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={() => setCancelAnalysisOpen(true)}>
              입력 화면으로 돌아가기
            </button>
            {analysis.retryNeeded && !draft.analysis?.failed && <button type="button" className={button} onClick={analysis.retry}>상태 다시 확인</button>}
          </div>
        </section>
      </>,
      undefined,
      <Steps current={2} />,
      "text-2xl",
    );
  }

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
                제목과 내용을 확인하고 수정해주세요. 추가하고 싶은 주제는 슬라이드 편집 단계에서 직접 작성할 수 있어요.
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
          <div className="rounded-2xl border-0 bg-surface p-6">
            <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-ink">
                    색상 선택<span aria-hidden="true" className="relative -top-px ml-0.5 text-brand">*</span>
                  </h2>
                  <span className="rounded bg-item-hover px-2 py-1 text-xs font-medium text-ink-muted">최대 2개</span>
                </div>
                <p className="mt-1 text-[15px] text-ink-muted">브랜드의 메인컬러를 추가해주세요.</p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {primaryColor ? (
                <label
                  className="relative flex min-h-[144px] cursor-pointer items-end overflow-hidden rounded-xl border-[1.5px] border-transparent p-4 transition-[border-color,box-shadow] hover:shadow-[0_8px_30px_0_rgba(0,13,59,0.1)] focus-within:border-brand focus-within:ring-[3.2px] focus-within:ring-focus-soft"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="relative z-10 text-[15px] font-semibold" style={{ color: readableTextColor(primaryColor) }}>
                    주 색상 1: {primaryColor}
                  </span>
                  <div className="absolute inset-0 z-0">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(event) => patchDraft({ theme: "Custom", primaryColor: event.target.value })}
                      className="h-full w-full cursor-pointer opacity-0"
                      aria-label="주 색상 1 선택"
                    />
                  </div>
                </label>
              ) : (
                <label className="flex min-h-[144px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-field-border p-4 text-center transition-[box-shadow] hover:shadow-[0_8px_30px_0_rgba(0,13,59,0.1)] focus-within:border-brand focus-within:ring-[3.2px] focus-within:ring-focus-soft">
                  <input
                    type="color"
                    value="#1F8064"
                    onChange={(event) => patchDraft({ theme: "Custom", primaryColor: event.target.value })}
                    className="sr-only"
                    aria-label="주 색상 1 선택"
                  />
                  <span className="grid size-8 place-items-center rounded-full bg-item-hover text-brand">
                    <Plus aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-ink-muted">주 색상 1 추가</span>
                </label>
              )}
              {primaryColor2 ? (
                <div
                  className="relative flex min-h-[144px] items-end overflow-hidden rounded-xl border-[1.5px] border-transparent p-4 transition-[border-color,box-shadow] hover:shadow-[0_8px_30px_0_rgba(0,13,59,0.1)] focus-within:border-brand focus-within:ring-[3.2px] focus-within:ring-focus-soft"
                  style={{ backgroundColor: primaryColor2 }}
                >
                  <input
                    type="color"
                    value={primaryColor2}
                    onChange={(event) => patchDraft({ theme: "Custom", primaryColor2: event.target.value })}
                    className="absolute inset-0 z-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="주 색상 2 선택"
                  />
                  <div className="relative z-10 flex w-full items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold" style={{ color: readableTextColor(primaryColor2) }}>
                      주 색상 2: {primaryColor2}
                    </span>
                    <button
                      type="button"
                      onClick={() => patchDraft({ theme: "Custom", primaryColor2: undefined })}
                      className="relative z-20 text-xs font-medium underline-offset-2 hover:underline"
                      style={{ color: readableTextColor(primaryColor2) }}
                    >
                      제거
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  aria-disabled={!primaryColor}
                  className={cn(
                    "flex min-h-[144px] flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-field-border p-4 text-center transition-[box-shadow]",
                    primaryColor ? "cursor-pointer hover:shadow-[0_8px_30px_0_rgba(0,13,59,0.1)] focus-within:border-brand focus-within:ring-[3.2px] focus-within:ring-focus-soft" : "cursor-not-allowed bg-field-border/25 text-content-disabled",
                  )}
                >
                  <input
                    type="color"
                    value={primaryColor || "#1F8064"}
                    onChange={(event) => patchDraft({ theme: "Custom", primaryColor2: event.target.value })}
                    disabled={!primaryColor}
                    className="sr-only"
                    aria-label="주 색상 2 선택"
                  />
                  <span className={cn("grid size-8 place-items-center rounded-full bg-item-hover", primaryColor ? "text-brand" : "text-content-disabled")}>
                    <Plus aria-hidden="true" className="size-4" />
                  </span>
                  <span className={cn("text-sm font-semibold", primaryColor ? "text-ink-muted" : "text-content-disabled")}>주 색상 2 추가</span>
                </label>
              )}
            </div>
          </div>
          <div className="rounded-2xl border-0 bg-surface p-6">
            <h2 className="text-lg font-semibold text-ink">화면 모드</h2>
            <p className="mt-1 text-[15px] text-ink-muted">배경 색을 골라주세요.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(["light", "dark"] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={(colorMode || "light") === mode}
                  onClick={() => patchDraft({ theme: "Custom", colorMode: mode })}
                  className={cn("flex h-[144px] flex-col justify-end overflow-hidden rounded-xl border-[1.5px] bg-surface p-4 text-left transition-[border-color,box-shadow] hover:shadow-[0_8px_30px_0_rgba(0,13,59,0.1)] focus-visible:outline-none focus-visible:ring-[3.2px] focus-visible:ring-focus-soft", (colorMode || "light") === mode ? "border-2 border-brand" : "border-field-border")}
                  style={{ backgroundColor: mode === "dark" ? "#151A18" : "#FFFFFF" }}
                >
                  <span className={cn("-mx-4 -mb-4 flex w-[calc(100%+2rem)] items-center gap-2 border-t border-field-border bg-white px-4 py-3 text-[15px] font-semibold", (colorMode || "light") === mode ? "font-bold text-brand" : "text-ink")}>
                    <span>{mode === "light" ? "라이트" : "다크"}</span>
                    {recommendedColorMode === mode && <span className="rounded-full bg-[#E2F8F0] px-2 py-1 text-xs font-medium text-brand">추천</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
        <div className="mt-5 block w-full max-w-sm rounded-2xl bg-surface p-6 text-lg font-semibold text-ink">
          <span className="block">슬라이드 글꼴</span>
          <Popover open={fontMenuOpen} onOpenChange={setFontMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                aria-label="슬라이드 글꼴 선택"
                aria-expanded={fontMenuOpen}
                className="mt-3 flex h-12 w-full items-center justify-between rounded-[12px] border border-field-border bg-surface px-4 text-left text-[15px] font-medium text-ink transition-colors focus:outline-none focus-visible:border-[1.5px] focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
              >
                <span className="truncate">{draft.fontFamily === "Paperlogy" ? "Paperlogy 제목 + Pretendard 본문" : "Pretendard"}</span>
                <DropdownChevron open={fontMenuOpen} variant="muted" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={4}
              avoidCollisions={false}
              className="w-[var(--radix-popover-trigger-width)] rounded-[12px] border-0 p-0 shadow-dropdown"
            >
              <div className="p-1">
                {([
                  ["Pretendard", "Pretendard"],
                  ["Paperlogy", "Paperlogy 제목 + Pretendard 본문"],
                ] as const).map(([value, label]) => {
                  const selected = (draft.fontFamily || "Paperlogy") === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "flex min-h-10 w-full items-center justify-between rounded-[8px] px-[14px] text-left text-[15px] text-ink transition-colors hover:bg-dropdown-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-soft",
                        selected && "bg-dropdown-selected-hover font-semibold text-brand",
                      )}
                      onClick={() => {
                        patchDraft({ fontFamily: value });
                        setFontMenuOpen(false);
                      }}
                    >
                      <span>{label}</span>
                      {selected && <Check aria-hidden="true" className="size-4 text-brand" />}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="inline-flex h-12 items-center justify-center rounded-[12px] bg-secondary-btn px-5 text-[16px] font-semibold text-secondary-btn-text shadow-none transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft" onClick={() => setScreen("review")}>
            이전
          </button>
          <button
            type="button"
            onClick={generateHtml}
            disabled={!primaryColor}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-brand px-5 text-[16px] font-semibold text-brand-foreground shadow-none transition-colors hover:bg-brand/88 active:bg-brand-pressed focus-visible:ring-1 focus-visible:ring-focus-soft disabled:cursor-not-allowed disabled:bg-brand-disabled disabled:text-brand-foreground disabled:opacity-100"
          >
            이 디자인으로 IR 덱 만들기
          </button>
        </div>
      </>,
      undefined,
      <Steps current={3} />,
    );

  if (screen === "editor" || screen === "preview" || screen === "saved") {
    if (!draft.html) return page("IR 덱 생성", "이전 작업의 사업내용을 확인한 뒤 HTML 슬라이드를 생성해 주세요.", <button className={primary} onClick={() => setScreen(draft.analysis?.deckId ? "review" : "input")}>사업내용 확인하기</button>);
    const editorPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "editor";
    return page("", "", <HtmlDeckWorkspace key={draft.html.requestId} reference={draft.html} persist={rememberHtml} onHome={() => setScreen("home")} onBack={() => setScreen("themes")} onSave={() => { if (draft.html) rememberHtml(draft.html); }} pendingTitle="IR 덱 디자인 생성 중" pendingSteps={<Steps current={3} />} devPreview={editorPreview} previewView={editorPreviewDocument} />);
  }


  return page(
    "사업계획서를 바탕으로 IR 덱을 만들어 보세요",
    "사업계획서를 업로드해 7개 슬라이드 구성으로 정리해 보세요.",
    <>
      <section className="rounded-2xl border-0 bg-surface p-7">
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-[rgba(64,72,66,0.08)] bg-surface p-6 shadow-[0_8px_30px_0_rgba(0,13,59,0.1)]">
            <h2 className="font-semibold text-ink">이런 내용이 있으면 좋아요</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-item-hover px-3 text-sm font-normal text-ink-muted">
                사업·서비스 소개
              </span>
              <span className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-item-hover px-3 text-sm font-normal text-ink-muted">
                문제와 핵심 고객
              </span>
              <span className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-item-hover px-3 text-sm font-normal text-ink-muted">
                해결책과 차별점
              </span>
              <span className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-item-hover px-3 text-sm font-normal text-ink-muted">
                시장·수익 모델
              </span>
            </div>
          <label
            className={cn(
              "relative mt-6 flex min-h-[220px] w-full flex-col items-center justify-center rounded-[8px] border border-dashed border-field-border bg-surface px-5 py-6 text-center transition-colors focus-within:border-brand focus-within:ring-[3.2px] focus-within:ring-focus-soft",
              !draft.fileName && "cursor-pointer hover:border-brand",
              draggingPlan && "border-brand bg-item-hover-selected",
              draft.fileName && "cursor-not-allowed bg-item-hover/40",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              if (draft.fileName) return;
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
              if (draft.fileName) return;
              setDraggingPlan(false);
              const file = e.dataTransfer.files[0] ?? Array.from(e.dataTransfer.items).find(item => item.kind === "file")?.getAsFile();
              if (file) analysis.chooseFile(file);
              else setMessage("파일을 받지 못했어요. 파일 선택 버튼으로 PDF를 선택해 주세요.");
            }}
          >
            <span className="block font-semibold text-ink">사업계획서 업로드</span>
            <span className="mt-2 block text-sm text-ink-muted">
              {draft.fileName
                ? "파일을 해제하면 다른 PDF를 업로드할 수 있어요."
                : draggingPlan
                  ? "여기에 PDF 파일을 놓아주세요."
                  : "PDF 파일 1개를 여기에 끌어다 놓거나, 파일 선택 버튼을 눌러주세요."}
            </span>
            <span
              className={cn(
                "mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border-0 bg-secondary-btn px-4 text-[14px] font-semibold text-secondary-btn-text shadow-none",
                draft.fileName && "cursor-not-allowed opacity-40",
              )}
              aria-disabled={draft.fileName ? true : undefined}
            >
              <Upload className="size-4" aria-hidden="true" />
              {draft.fileName ? "파일 1개 선택됨" : "파일 선택"}
            </span>
            <input
              className="sr-only"
              type="file"
              accept=".pdf,application/pdf"
              disabled={analysis.submitting || Boolean(draft.fileName)}
              aria-label="사업계획서 파일 선택"
              onChange={(e) => {
                analysis.chooseFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {draft.fileName && (
            <div className="mt-2 flex w-full items-center gap-3 rounded-[10px] border border-field-border bg-surface px-3 py-2.5">
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-medium text-ink">{draft.fileName}</p>
                <p className="mt-0.5 text-[12px] text-ink-muted">PDF</p>
              </div>
              <button
                type="button"
                aria-label="선택한 파일 삭제"
                title="파일 삭제"
                className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E5E8E7] text-[#25332E] opacity-70 transition-[background-color,opacity] hover:bg-[#D9DEDC] hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-soft disabled:cursor-not-allowed disabled:opacity-40"
                disabled={analysis.submitting}
                onClick={analysis.clearFile}
              >
                <span className="absolute inset-0 flex items-center justify-center animate-upload-status-pop-out">
                  <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
                </span>
                <span className="absolute inset-0 flex items-center justify-center animate-upload-status-x-in">
                  <X className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                </span>
              </button>
            </div>
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
          </button>
          </div>
        </div>
      </section>
    </>,
    undefined,
    <Steps current={1} />,
    "text-2xl",
  );
}
