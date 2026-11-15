import { ArrowLeft, ArrowRight, FileText, Plus, Trash2, Eye, Download, Check } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SlideCanvas } from "@/components/ir-deck/SlideCanvas";
import { TextToolbar } from "@/components/ir-deck/TextToolbar";
import {
  buildSlides,
  defaultFormat,
  extractSections,
  mediaUrl,
  newDraft,
  newId,
  newSlide,
  restoreWorkspace,
  reviewFields,
  slideNames,
  storageKey,
  themes,
  type Draft,
  type Slide,
  type SlideElement,
  type TextFormat,
  type Workspace,
} from "@/components/ir-deck/model";
import "@/components/ir-deck/ir-deck.css";

const steps = ["사업 내용 입력", "사업 내용 확인", "디자인 선택", "슬라이드 편집"];
const Steps = ({ current }: { current: number }) => (
  <div className="my-7 flex flex-wrap justify-center gap-3 text-sm text-ink-muted">
    {steps.map((s, i) => (
      <div
        key={s}
        className={cn(
          "flex items-center gap-2 rounded-full border border-field-border px-4 py-2",
          i + 1 === current && "border-brand bg-item-hover-selected font-semibold text-brand",
        )}
        aria-current={i + 1 === current ? "step" : undefined}
      >
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full bg-background text-xs",
            i + 1 === current && "bg-brand text-white",
          )}
        >
          {i + 1 < current ? "✓" : i + 1}
        </span>
        {s}
      </div>
    ))}
  </div>
);
const button =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border border-field-border px-4 py-3 text-sm font-semibold text-ink hover:bg-item-hover disabled:cursor-not-allowed disabled:opacity-40";
const primary = cn(button, "border-brand bg-brand text-brand-foreground hover:bg-brand/90");
const panel = "rounded-2xl border border-field-border bg-surface p-7";
const input =
  "w-full rounded-xl border border-field-border bg-background p-4 text-sm text-ink outline-none focus:border-brand";
const notice = "mt-5 rounded-xl bg-item-hover-selected p-4 text-sm leading-6 text-ink-muted";
type Screen =
  "home" | "input" | "processing" | "review" | "themes" | "editor" | "preview" | "saved";

export function IrDeckWireframe() {
  const [screen, setScreen] = useState<Screen>("home");
  const [workspace, setWorkspace] = useState<Workspace>(() => ({
    projects: [],
    draft: newDraft(),
  }));
  const [loaded, setLoaded] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [activeField, setActiveField] = useState("title");
  const [media, setMedia] = useState<"image" | "video" | null>(null);
  const [mediaSource, setMediaSource] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const { draft, projects } = workspace;
  const { source, theme, slides, activeSlide } = draft;
  const currentSlide = slides[activeSlide] || slides[0]!;

  useEffect(() => {
    try {
      const restored = restoreWorkspace(
        localStorage.getItem(storageKey),
        localStorage.getItem("ssiat-ir-deck"),
      );
      if (restored) setWorkspace(restored);
    } catch {
      setStorageBlocked(true);
      setMessage(
        "브라우저 저장 내용을 읽지 못했습니다. 기존 데이터는 보존했습니다. 저장소 접근 권한이나 저장 데이터를 확인한 뒤 새로고침해 주세요.",
      );
    }
    setLoaded(true);
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

  function patchDraft(patch: Partial<Draft>) {
    setWorkspace((w) => ({ ...w, draft: { ...w.draft, ...patch } }));
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
  function startNew() {
    setWorkspace((w) => ({ ...w, draft: newDraft() }));
    setActiveField("title");
    setScreen("input");
  }
  function analyze() {
    if (!source.trim() && !draft.fileName) {
      setMessage("사업계획서 파일을 선택하거나 사업 내용을 입력해 주세요.");
      return;
    }
    setMessage("");
    patchDraft({ review: extractSections(source) });
    setScreen("processing");
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
    const project = {
      id,
      title:
        previous?.title ||
        draft.review["사업/서비스명"]?.trim() ||
        slides[0]?.title ||
        "제목 없는 IR Deck",
      updatedAt: Date.now(),
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
  function page(title: string, subtitle: string, content: ReactNode, actions?: ReactNode) {
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
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-ink">{title}</h1>
            <p className="mt-2 text-ink-muted">{subtitle}</p>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
        {loaded ? content : <p role="status">저장된 덱을 불러오는 중입니다.</p>}
        {loaded &&
          createPortal(
            <div className="ir-deck-print" aria-hidden="true">
              {slides.map((slide) => (
                <section className="ir-deck-print-page" key={slide.id}>
                  <SlideCanvas slide={slide} theme={theme} />
                </section>
              ))}
            </div>,
            document.body,
          )}
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
    <button type="button" className={button} onClick={() => window.print()}>
      <Download className="size-4" />
      PDF 저장
    </button>
  );

  if (screen === "home")
    return page(
      "AI IR 덱",
      "사업의 핵심을 투자자가 이해할 수 있는 이야기로 정리해 보세요.",
      <>
        <div className="mb-5 flex justify-between border-b border-field-border pb-4">
          <span>
            전체{" "}
            <span className="rounded-full bg-item-hover px-3 py-1 text-ink-muted">
              {projects.length}
            </span>
          </span>
          <span className="text-sm text-ink-muted">최근 수정 순</span>
        </div>
        {projects.length ? (
          <div className="grid gap-5 md:grid-cols-3">
            {[...projects]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((project) => (
                <button
                  type="button"
                  key={project.id}
                  className="overflow-hidden rounded-xl border border-field-border text-left hover:border-brand"
                  onClick={() => {
                    setWorkspace((w) => ({
                      ...w,
                      draft: { ...structuredClone(project.draft), projectId: project.id },
                    }));
                    setActiveField("title");
                    setScreen("editor");
                  }}
                >
                  <div
                    className="ir-deck-thumbnail relative aspect-video overflow-hidden bg-item-hover"
                    aria-hidden="true"
                  >
                    <div className="absolute left-0 top-0 w-[900px] origin-top-left scale-[0.4]">
                      <SlideCanvas slide={project.draft.slides[0]!} theme={project.draft.theme} />
                    </div>
                  </div>
                  <div className="border-t border-field-border p-4">
                    <strong className="block text-ink">{project.title}</strong>
                    <small className="text-ink-muted">
                      최근 수정 {new Date(project.updatedAt).toLocaleString("ko-KR")}
                    </small>
                  </div>
                </button>
              ))}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-2 flex h-[180px] w-[180px] items-center justify-center">
              <img src="/assets/sidebar/ir-deck.svg" alt="" className="size-14 opacity-40" />
            </div>
            <p className="text-[18px] font-semibold text-ink">아직 만든 IR 덱이 없어요</p>
            <p className="mt-1 text-[15px] text-ink-muted">첫 번째 IR 덱을 만들어 보세요.</p>
            <button type="button" onClick={startNew} className={cn(primary, "mt-5")}>
              새 IR 덱 만들기
            </button>
          </div>
        )}
        {(draft.source || draft.fileName || draft.slides.some((s) => s.elements.length)) && (
          <button
            type="button"
            className={cn(button, "mt-6")}
            onClick={() => setScreen(draft.projectId ? "editor" : "input")}
          >
            현재 작업 이어하기
          </button>
        )}
      </>,
      <button type="button" onClick={startNew} disabled={!loaded} className={primary}>
        <Plus className="size-4" />새 IR 덱 생성
      </button>,
    );

  if (screen === "processing")
    return page(
      "사업 내용 분석 중",
      "입력한 내용을 덱에 필요한 항목으로 정리하는 흐름입니다.",
      <>
        <Steps current={2} />
        <section className={cn(panel, "p-16 text-center")}>
          <img src="/assets/sidebar/ir-deck-active.svg" alt="" className="mx-auto size-10" />
          <h2 className="mt-5 text-xl font-semibold text-ink">사업 내용을 정리하고 있어요</h2>
          <div className="mx-auto my-7 h-2 max-w-md overflow-hidden rounded-full bg-item-hover">
            <div className="ir-deck-progress h-full w-1/3 rounded-full bg-brand" />
          </div>
          <p className={notice}>
            와이어프레임 시연입니다. 실제 파일 분석과 AI 내용 정리는 연결되지 않았습니다.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <button type="button" className={button} onClick={() => setScreen("input")}>
              입력 화면으로 돌아가기
            </button>
            <button type="button" onClick={() => setScreen("review")} className={primary}>
              분석 내용 확인하기
            </button>
          </div>
        </section>
      </>,
    );

  if (screen === "review")
    return page(
      "사업 분석 내용 확인",
      "파악한 내용을 확인하고 필요한 부분을 직접 수정해 주세요.",
      <>
        <Steps current={2} />
        <section className={panel}>
          <h2 className="text-xl font-semibold text-ink">AI가 이해한 사업</h2>
          <p className="my-4 text-sm leading-6 text-ink-muted">
            {draft.fileName && !source.trim()
              ? "시연에서는 업로드한 파일을 읽지 못합니다. 아래 항목을 직접 작성해 주세요."
              : "직접 입력한 글의 ‘문제 인식: …’ 같은 항목명을 인식합니다. 아래 수정 내용이 덱에 반영됩니다. 실제 AI 분석은 연결되지 않았습니다."}
          </p>
          <div className="grid gap-3">
            {reviewFields.map(([name, destination]) => (
              <label key={name} className="rounded-xl border border-field-border p-5">
                <span className="mb-3 block font-semibold text-ink">{name}</span>
                <textarea
                  className={cn(input, "min-h-24")}
                  aria-label={`${name} 내용 수정`}
                  placeholder="내용을 확인하고 수정해 주세요."
                  value={draft.review[name] || ""}
                  onChange={(e) =>
                    patchDraft({ review: { ...draft.review, [name]: e.target.value } })
                  }
                />
                <small className="text-ink-muted">반영 위치: {destination}</small>
              </label>
            ))}
          </div>
          <div className={notice}>
            <strong>슬라이드 구성 미리보기 · 7장</strong>
            <p>{slideNames.join(" → ")}</p>
            <p>비어 있는 장은 편집기에서 작성하거나 삭제할 수 있습니다.</p>
            <p className="mt-3 font-semibold">
              사업계획서에 없는 내용은 편집기에서 ＋ 슬라이드 추가를 눌러 직접 작성할 수 있어요.
            </p>
          </div>
        </section>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className={button} onClick={() => setScreen("input")}>
            입력 화면으로 돌아가기
          </button>
          <button type="button" onClick={() => setScreen("themes")} className={primary}>
            디자인 방향 선택
            <ArrowRight className="size-4" />
          </button>
        </div>
      </>,
    );

  if (screen === "themes")
    return page(
      "디자인 방향 선택",
      "확인한 사업 내용에 어울리는 디자인을 선택해 주세요.",
      <>
        <Steps current={3} />
        <section className="grid gap-4 md:grid-cols-3">
          {themes.map(([name, desc, tone]) => (
            <button
              type="button"
              key={name}
              onClick={() => patchDraft({ theme: name })}
              aria-pressed={theme === name}
              className={cn(
                "rounded-2xl border bg-surface p-5 text-left",
                theme === name ? "border-brand bg-item-hover-selected" : "border-field-border",
              )}
            >
              <div className={cn("mb-4 flex h-24 items-end rounded-xl p-4", tone)}>
                <b>사업을 설명하는 한 문장</b>
              </div>
              <b>
                {theme === name && "✓ "}
                {name}
              </b>
              <p className="mt-1 text-sm text-ink-muted">{desc}</p>
            </button>
          ))}
        </section>
        <p className="mt-4 text-sm text-ink-muted">
          선택한 디자인은 편집 화면과 미리보기, PDF에 적용됩니다.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className={button} onClick={() => setScreen("review")}>
            이전
          </button>
          <button
            type="button"
            onClick={() => {
              patchDraft({ slides: buildSlides(draft.review, source), activeSlide: 0 });
              setActiveField("title");
              setScreen("editor");
            }}
            className={primary}
          >
            이 디자인으로 IR 덱 만들기
            <ArrowRight className="size-4" />
          </button>
        </div>
      </>,
    );

  if (screen === "saved")
    return page(
      "저장 완료",
      "IR 덱 작업 내용을 이 브라우저에 저장했어요.",
      <section className={cn(panel, "py-20 text-center")}>
        <Check className="mx-auto size-16 text-brand" />
        <h2 className="mt-4 text-xl font-semibold">
          {projects.find((p) => p.id === draft.projectId)?.title} 저장 완료
        </h2>
        <p className="mt-3 text-ink-muted">최근 파일 목록에서 다시 열어 편집할 수 있습니다.</p>
        <div className="mt-7 flex justify-center gap-3">
          <button type="button" className={primary} onClick={() => setScreen("home")}>
            최근 파일에서 보기
          </button>
          <button type="button" className={button} onClick={() => setScreen("editor")}>
            계속 편집
          </button>
          {pdf}
        </div>
      </section>,
    );

  if (screen === "preview")
    return page(
      "IR 덱 미리보기",
      "전체 슬라이드를 확인하고 PDF로 저장할 수 있습니다.",
      <section className={cn(panel, "mx-auto max-w-5xl")}>
        <SlideCanvas slide={currentSlide} theme={theme} />
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {slides.map((slide, i) => (
            <button
              type="button"
              key={slide.id}
              aria-label={`${i + 1}번 슬라이드`}
              aria-current={i === activeSlide ? "page" : undefined}
              onClick={() => selectSlide(i)}
              className={cn(
                button,
                i === activeSlide && "border-brand bg-item-hover-selected text-brand",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            className={button}
            aria-label="이전 슬라이드"
            disabled={activeSlide === 0}
            onClick={() => selectSlide(activeSlide - 1)}
          >
            <ArrowLeft className="size-4" />
          </button>
          <span>
            {activeSlide + 1} / {slides.length}
          </span>
          <button
            type="button"
            className={button}
            aria-label="다음 슬라이드"
            disabled={activeSlide === slides.length - 1}
            onClick={() => selectSlide(activeSlide + 1)}
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </section>,
      <>
        <button type="button" onClick={() => setScreen("editor")} className={button}>
          <ArrowLeft className="size-4" />
          편집으로 돌아가기
        </button>
        {pdf}
      </>,
    );

  if (screen === "editor")
    return page(
      "IR 덱 편집",
      `슬라이드 ${activeSlide + 1} / ${slides.length} · 슬라이드 내용을 클릭해 바로 수정하세요.`,
      <>
        <Steps current={4} />
        <section className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <aside className={cn(panel, "p-4")}>
            <h2 className="mb-4 font-semibold">슬라이드</h2>
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                className={cn(
                  "mb-2 flex items-center gap-2 rounded-lg border p-3 text-sm",
                  i === activeSlide
                    ? "border-brand bg-item-hover-selected text-brand"
                    : "border-field-border",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 break-words text-left"
                  onClick={() => selectSlide(i)}
                  aria-current={i === activeSlide ? "true" : undefined}
                >
                  {i + 1} {slide.name}
                </button>
                <button
                  type="button"
                  aria-label={`${i + 1}번 슬라이드 삭제`}
                  disabled={slides.length === 1}
                  className="disabled:opacity-30"
                  onClick={() => {
                    patchDraft({
                      slides: slides.filter((_, n) => n !== i),
                      activeSlide: Math.max(
                        0,
                        activeSlide > i
                          ? activeSlide - 1
                          : Math.min(activeSlide, slides.length - 2),
                      ),
                    });
                    setActiveField("title");
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={button}
              onClick={() => {
                const next = [...slides];
                next.splice(activeSlide + 1, 0, newSlide());
                patchDraft({ slides: next, activeSlide: activeSlide + 1 });
                setActiveField("title");
              }}
            >
              <Plus className="size-4" />
              슬라이드 추가
            </button>
          </aside>
          <div className="min-w-0">
            <p className="mb-3 text-sm text-ink-muted">
              수정할 글자 블록을 클릭한 뒤 서식을 바꾸세요. 서식은 해당 블록 전체에 적용됩니다.
            </p>
            <TextToolbar
              format={currentSlide.formats[activeField] || defaultFormat(activeField)}
              onChange={changeFormat}
              onBullets={() => {
                const lines = currentSlide.body.split("\n");
                const remove = lines.every((line) => line.startsWith("• "));
                patchSlide((slide) => ({
                  ...slide,
                  body: lines
                    .map((line) =>
                      remove ? line.slice(2) : line.startsWith("• ") ? line : `• ${line}`,
                    )
                    .join("\n"),
                }));
                setActiveField("body");
              }}
            />
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() => addElement({ id: newId(), type: "text", text: "새 텍스트 상자" })}
              >
                ＋ 텍스트 상자
              </button>
              <button type="button" className={button} onClick={() => openMedia("image")}>
                이미지 삽입
              </button>
              <button type="button" className={button} onClick={() => openMedia("video")}>
                동영상 삽입
              </button>
            </div>
            <div className={cn(panel, "p-5")}>
              <SlideCanvas
                slide={currentSlide}
                theme={theme}
                editable
                activeField={activeField}
                onFocus={setActiveField}
                onText={changeText}
                onRemove={(id) => {
                  patchSlide((slide) => {
                    const formats = { ...slide.formats };
                    delete formats[`extra:${id}`];
                    return {
                      ...slide,
                      formats,
                      elements: slide.elements.filter((e) => e.id !== id),
                    };
                  });
                  setActiveField("body");
                }}
              />
            </div>
          </div>
        </section>
      </>,
      <>
        <button type="button" onClick={() => setScreen("home")} className={button}>
          최근 파일
        </button>
        <button type="button" onClick={() => setScreen("preview")} className={button}>
          <Eye className="size-4" />
          미리보기
        </button>
        {pdf}
        <button type="button" onClick={save} className={primary}>
          저장
        </button>
      </>,
    );

  return page(
    "새 IR 덱 만들기",
    "사업계획서를 올리거나 사업 내용을 직접 입력해 주세요.",
    <>
      <Steps current={1} />
      <section className={panel}>
        <div className="grid gap-6 lg:grid-cols-2">
          <label className="relative cursor-pointer rounded-xl border border-dashed border-brand bg-background p-10 text-center focus-within:ring-2 focus-within:ring-brand">
            <FileText className="mx-auto size-8 text-brand" />
            <span className="mt-3 block font-semibold text-ink">사업계획서 업로드</span>
            <span className="mt-1 block text-sm text-ink-muted">PDF, DOCX 파일을 선택하세요.</span>
            <span className="mt-3 block break-all text-sm text-ink">
              {draft.fileName || "클릭해서 파일을 선택하세요"}
            </span>
            <input
              className="sr-only"
              type="file"
              accept=".pdf,.docx"
              aria-label="사업계획서 파일 선택"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!/\.(pdf|docx)$/i.test(file.name)) {
                  setMessage("PDF 또는 DOCX 파일을 선택해 주세요.");
                  e.target.value = "";
                  return;
                }
                patchDraft({ fileName: file.name });
              }}
            />
          </label>
          <label>
            <span className="mb-2 block font-semibold text-ink">
              또는 사업 내용을 직접 입력하세요
            </span>
            <textarea
              value={source}
              onChange={(e) => patchDraft({ source: e.target.value })}
              className={cn(input, "min-h-[220px]")}
              placeholder={"사업명: SSIAT\n문제 인식: …\n해결책: …\n시장규모: …"}
            />
          </label>
        </div>
        {draft.fileName && (
          <button
            type="button"
            className={cn(button, "mt-3")}
            onClick={() => patchDraft({ fileName: "" })}
          >
            선택한 파일 해제
          </button>
        )}
        <p className={notice}>
          프론트엔드 시연입니다. 업로드한 파일 읽기·실제 AI 분석은 연결되지 않았습니다. 직접 입력한
          글의 항목명 또는 다음 화면의 수동 입력으로 덱을 구성합니다.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className={button} onClick={() => setScreen("home")}>
            홈으로
          </button>
          <button type="button" onClick={analyze} className={primary}>
            사업 내용 분석하기
            <ArrowRight className="size-4" />
          </button>
        </div>
      </section>
    </>,
  );
}
