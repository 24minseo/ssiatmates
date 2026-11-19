import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, ImagePlus, LoaderCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { HtmlSlidePreview } from "./HtmlSlidePreview";
import { htmlCall, imageUrl, mediaBase, uploadImage } from "./html-client";
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
const primary = `${button} border-brand bg-brand text-brand-foreground hover:bg-brand/90`;
const field =
  "w-full rounded-lg border border-field-border bg-background px-3 py-2 text-sm text-ink";
const states: Record<string, string> = {
  queued: "생성 요청을 접수했어요",
  planning: "전체 발표 흐름과 핵심 메시지를 구성하고 있어요",
  generating: "내용에 맞는 슬라이드를 만들고 있어요",
  validating: "슬라이드 배치와 출력 상태를 확인하고 있어요",
  ready: "IR 덱이 완성됐어요",
  failed: "IR 덱 생성을 완료하지 못했어요",
};
type PendingImage = { body: Json; revision: number };

export function HtmlDeckWorkspace({
  reference,
  persist,
  onBack,
  onHome,
  onSave,
}: {
  reference: HtmlReference;
  persist: (ref: HtmlReference) => void;
  onBack: () => void;
  onHome: () => void;
  onSave: () => void;
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
  const [view, setView] = useState<HtmlView | null>(null);
  const [state, setState] = useState("queued"),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0),
    [selected, setSelected] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [slotId, setSlotId] = useState<string | null>(null),
    [adding, setAdding] = useState(false);
  const [point, setPoint] = useState({ x: 96, y: 200 });
  const [placement, setPlacement] = useState<Placement>({
    x: 96,
    y: 200,
    width: 640,
    height: 360,
    zIndex: 100,
  });
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [exportBusy, setExportBusy] = useState(false),
    [exportError, setExportError] = useState("");
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
  const uploaded = useRef<{ file: File; assetId: string } | null>(null);
  const authorized = user?.id === reference.userId;
  const current = view?.document.slides[selected];
  const selectedSlot = view?.imageSlots.find((s) => s.id === slotId) || null;
  const canMutate = authorized && !busy && !pendingImage;

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

  // 한 번에 하나의 상태 조회만 실행한다. 새로고침/응답 유실 시 저장된 요청 번호로 재개한다.
  useEffect(() => {
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
  }, [attempt, authorized, authLoading, reference.deckId, reference.userId]);

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
          setNotice("일부 이미지를 불러오지 못했습니다. 이미지 새로고침으로 다시 확인해 주세요.");
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
      setNotice("이미지 변경사항을 저장했어요.");
      setDownload(null);
    }
  }
  async function mutate(body: Json) {
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
    setNotice("");
    try {
      await saveBinding(pending);
    } catch (e) {
      if (alive.current)
        setNotice(
          e instanceof Error
            ? e.message
            : "이미지를 저장하지 못했습니다. 같은 변경으로 다시 확인해 주세요.",
        );
    } finally {
      busyLock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function binding(slot: ImageSlot, assetId: string | null, remove = false): Json {
    if (slot.origin === "generated")
      return { action: "save_slot_image", slot_id: slot.id, asset_id: assetId, fit };
    validatePlacement(placement);
    return {
      action: "save_user_image",
      slot_id: slot.id,
      slide_id: slot.slideId,
      asset_id: assetId,
      placement,
      fit,
      delete: remove,
    };
  }
  async function upload(file: File) {
    if (!view || !current || !canMutate || busyLock.current) return;
    const target = selectedSlot;
    const destinationSlide = current.slideId;
    busyLock.current = true;
    setBusy(true);
    setNotice("");
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
        fit,
      };
      const body: Json = target
        ? binding(slot, assetId)
        : {
            action: "save_user_image",
            slot_id: slot.id,
            slide_id: destinationSlide,
            asset_id: assetId,
            placement: p,
            fit,
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
    } catch (e) {
      if (alive.current)
        setNotice(
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
      setSlotId(null);
      setPoint(position);
      fileInput.current?.click();
      return;
    }
    setSlotId(slot?.id || null);
    if (slot) {
      setFit(slot.fit);
      if (slot.placement) setPlacement(slot.placement);
    }
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
  if (!authorized)
    return (
      <section className="rounded-2xl border border-field-border bg-surface p-8">
        <h1 className="text-xl font-semibold text-ink">로그인한 계정을 확인해 주세요</h1>
        <p className="mt-3 text-ink-muted">
          IR 덱을 생성한 계정으로 로그인하면 이어서 확인할 수 있어요.
        </p>
        <button className={`${button} mt-6`} onClick={onHome}>
          목록으로
        </button>
      </section>
    );
  if (!view || !current)
    return (
      <section
        className="rounded-2xl border border-field-border bg-surface px-8 py-20 text-center"
        aria-live="polite"
      >
        {!error && <LoaderCircle className="mx-auto size-9 animate-spin text-brand" />}
        <h1 className="mt-5 text-2xl font-bold text-ink">
          {states[state] || "생성 상태를 확인하고 있어요"}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-muted">
          사업계획서의 전체 맥락과 확인한 내용을 바탕으로 제목·핵심 문장·레이아웃을 구성해요.
          검사까지 완료되면 7장 전체를 보여드려요.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-ink">
            {error}
          </p>
        )}
        <div className="mt-7 flex justify-center gap-3">
          <button className={button} onClick={onHome}>
            목록으로
          </button>
          <button className={button} onClick={onBack}>
            디자인 선택으로
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
    );
  const stale = view.input_status && Object.values(view.input_status).some((v) => !v);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">IR 덱 {preview ? "미리보기" : "편집"}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            슬라이드 {selected + 1} / 7 · 이미지 변경사항은 서버에 저장돼요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={onHome}>
            최근 파일
          </button>
          <button className={button} onClick={() => setPreview((v) => !v)}>
            {preview ? "이미지 편집" : "미리보기"}
          </button>
          <button
            className={button}
            disabled={busy || !!pendingImage || exportBusy}
            onClick={() => requestExport("pdf")}
          >
            <Download className="size-4" />
            PDF로 내보내기
          </button>
          <button
            className={button}
            disabled={busy || !!pendingImage || exportBusy}
            onClick={() => requestExport("pptx")}
          >
            PPTX 저장
          </button>
          <button
            className={primary}
            disabled={busy || !!pendingImage}
            onClick={() => {
              onSave();
              setNotice("완성된 IR 덱을 최근 파일에 저장했어요.");
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
      {notice && (
        <p role="status" className="rounded-xl bg-item-hover p-4 text-sm text-ink">
          {notice}
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
                setNotice(e instanceof Error ? e.message : "저장을 확인하지 못했습니다.");
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
                setNotice(
                  "서버의 최신 이미지 상태를 불러왔어요. 필요한 변경을 다시 선택해 주세요.",
                );
              } catch (e) {
                setNotice(e instanceof Error ? e.message : "조회하지 못했습니다.");
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
      <div className={preview ? "" : "grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]"}>
        {!preview && (
          <aside className="space-y-3 rounded-2xl border border-field-border bg-surface p-4">
            <h2 className="font-semibold text-ink">슬라이드</h2>
            {view.document.slides.map((slide, i) => (
              <button
                key={slide.slideId}
                className={`w-full rounded-xl border p-2 text-left ${selected === i ? "border-brand bg-item-hover-selected" : "border-field-border hover:bg-item-hover"}`}
                onClick={() => {
                  setSelected(i);
                  setSlotId(null);
                  setAdding(false);
                }}
              >
                <span className="mb-2 block text-xs font-semibold text-ink">
                  {i + 1} {slide.sectionLabel}
                </span>
                <HtmlSlidePreview
                  slide={slide}
                  view={view}
                  urls={urls}
                  mediaOrigin={new URL(mediaBase()).origin}
                />
              </button>
            ))}
          </aside>
        )}
        <main className="min-w-0 space-y-4">
          {!preview && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className={button}
                  disabled={!canMutate}
                  onClick={() => {
                    setAdding(!adding);
                    setSlotId(null);
                  }}
                >
                  <ImagePlus className="size-4" />
                  {adding ? "추가 위치 선택 취소" : "이미지 추가"}
                </button>
                <button className={button} disabled={busy} onClick={() => setAttempt((a) => a + 1)}>
                  <RefreshCw className="size-4" />
                  이미지 새로고침
                </button>
                <span className="text-sm text-ink-muted">
                  {adding
                    ? "슬라이드에서 이미지를 넣을 위치를 클릭해 주세요."
                    : "이미지 영역을 클릭하면 업로드·교체할 수 있어요."}
                </span>
              </div>
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
              {selectedSlot && (
                <section className="space-y-3 rounded-xl border border-field-border p-4">
                  <h2 className="font-semibold text-ink">
                    {selectedSlot.description || "선택한 이미지"}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className={button}
                      disabled={!canMutate}
                      onClick={() => fileInput.current?.click()}
                    >
                      {selectedSlot.assetId ? "이미지 교체" : "이미지 업로드"}
                    </button>
                    <label className="text-sm text-ink">
                      표시 방식
                      <select
                        aria-label="이미지 표시 방식"
                        className={`${field} mt-1`}
                        value={fit}
                        disabled={!canMutate}
                        onChange={(e) => setFit(e.target.value as "cover" | "contain")}
                      >
                        <option value="contain">전체 보이기</option>
                        <option value="cover">영역 채우기</option>
                      </select>
                    </label>
                    {selectedSlot.assetId && (
                      <button
                        className={button}
                        disabled={!canMutate}
                        onClick={() =>
                          void mutate(binding(selectedSlot, null, selectedSlot.origin === "user"))
                        }
                      >
                        이미지 제거
                      </button>
                    )}
                  </div>
                  {selectedSlot.origin === "user" && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {(["x", "y", "width", "height", "zIndex"] as const).map((key, i) => (
                        <label key={key} className="text-sm text-ink">
                          {["가로 위치", "세로 위치", "너비", "높이", "앞뒤 순서"][i]}
                          <input
                            aria-label={["가로 위치", "세로 위치", "너비", "높이", "앞뒤 순서"][i]}
                            className={`${field} mt-1`}
                            type="number"
                            step="1"
                            min={key === "width" || key === "height" ? 1 : 0}
                            value={placement[key]}
                            disabled={!canMutate}
                            onChange={(e) =>
                              setPlacement((p) => ({ ...p, [key]: Number(e.target.value) }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedSlot.assetId && (
                    <button
                      className={primary}
                      disabled={!canMutate}
                      onClick={() => {
                        try {
                          void mutate(binding(selectedSlot, selectedSlot.assetId));
                        } catch (e) {
                          setNotice(e instanceof Error ? e.message : "위치를 확인해 주세요.");
                        }
                      }}
                    >
                      이미지 설정 저장
                    </button>
                  )}
                </section>
              )}
            </>
          )}
          <HtmlSlidePreview
            key={current.slideId}
            slide={current}
            view={view}
            urls={urls}
            mediaOrigin={new URL(mediaBase()).origin}
            onSelect={preview ? undefined : selectSlot}
          />
          <div className="flex justify-between">
            <button
              className={button}
              disabled={selected === 0 || busy}
              onClick={() => {
                setSelected((i) => i - 1);
                setSlotId(null);
              }}
            >
              <ArrowLeft className="size-4" />
              이전 슬라이드
            </button>
            <button
              className={button}
              disabled={selected === 6 || busy}
              onClick={() => {
                setSelected((i) => i + 1);
                setSlotId(null);
              }}
            >
              다음 슬라이드
            </button>
          </div>
          <p className="text-xs leading-5 text-ink-muted">
            PPTX는 슬라이드 이미지를 담은 발표 파일이에요. 텍스트·도형을 개별 편집하는 형식은
            아니에요. 이미지가 없는 영역은 출력 시 업로드 안내 없이 비워져요.
          </p>
        </main>
      </div>
    </div>
  );
}
