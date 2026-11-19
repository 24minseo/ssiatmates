import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { analysisApi } from "./analysis-client";
import {
  AnalysisError,
  hashText,
  isAnalysisReference,
  reviewHash,
  reviewSections,
  validatePlanFile,
  type AnalysisReference,
} from "./analysis";
import type { Draft } from "./model";

type Options = {
  draft: Draft;
  screen: string;
  patchDraft: (patch: Partial<Draft>) => void;
  message: (text: string) => void;
  navigate: (screen: "input" | "processing" | "review" | "themes") => void;
};
export function useBusinessAnalysis(options: Options) {
  const { user, loading } = useAuth();
  const ownerRef = useRef(user?.id);
  ownerRef.current = user?.id;
  const latest = useRef(options);
  latest.current = options;
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retryNeeded, setRetryNeeded] = useState(false);
  const [phase, setPhase] = useState("사업 내용을 정리하고 있어요");
  const [watchEpoch, setWatchEpoch] = useState(0);
  const busy = useRef(false),
    savingBusy = useRef(false);
  const pendingSave = useRef<{
    ref: AnalysisReference;
    sections: ReturnType<typeof reviewSections>;
    id: string;
    hash: string;
    revision: number;
  } | null>(null);
  const ref = isAnalysisReference(options.draft.analysis) ? options.draft.analysis : undefined;

  function updateReference(next: AnalysisReference) {
    if (next.userId !== ownerRef.current) return;
    if (latest.current.draft.analysis?.sourceId !== next.sourceId) return;
    latest.current = { ...latest.current, draft: { ...latest.current.draft, analysis: next } };
    latest.current.patchDraft({ analysis: next });
  }
  function chooseFile(next: File | undefined) {
    if (busy.current || options.draft.fileName) return;
    if (!next) return;
    if (
      !/\.pdf$/i.test(next.name) ||
      next.size < 1 ||
      next.size > 10485760 ||
      next.name.length > 255
    ) {
      options.message("10MB 이하의 PDF 파일을 선택해 주세요.");
      return;
    }
    setFile(next);
    options.message("");
    options.patchDraft({
      fileName: next.name,
      source: "",
      analysis:
        isAnalysisReference(options.draft.analysis) && options.draft.analysis.inputKind === "pdf"
          ? options.draft.analysis
          : undefined,
    });
  }
  function clearFile() {
    if (busy.current) return;
    setFile(null);
    options.message("");
    options.patchDraft({ fileName: "", analysis: undefined });
  }
  function changeSource(source: string) {
    if (busy.current) return;
    options.message("");
    options.patchDraft({ source, analysis: undefined });
  }
  async function analyze() {
    if (busy.current || loading) return;
    if (!user) {
      options.message("로그인 후 사업 내용을 분석할 수 있어요.");
      window.dispatchEvent(new Event("auth-required"));
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setRetryNeeded(false);
    options.message("");
    try {
      const d = latest.current.draft,
        text = d.source.trim();
      if (d.fileName && text)
        throw new AnalysisError(
          "PDF 업로드와 텍스트 입력 중 하나만 선택해 주세요. 파일을 해제하거나 입력 내용을 비워 주세요.",
        );
      const kind = d.fileName ? "pdf" : "text";
      let hash: string;
      const old =
        isAnalysisReference(d.analysis) && d.analysis.userId === user.id ? d.analysis : undefined;
      if (kind === "text") {
        if ([...text].length < 100 || [...text].length > 100000)
          throw new AnalysisError("사업 내용은 100자 이상 100,000자 이하로 입력해 주세요.");
        hash = await hashText(text);
      } else if (file && file.name === d.fileName) hash = await validatePlanFile(file);
      else if (old?.inputKind === "pdf" && old.fileName === d.fileName && !old.failed)
        hash = old.inputHash;
      else
        throw new AnalysisError(
          "업로드할 PDF 파일을 다시 선택해 주세요. 파일 자체는 브라우저에 저장하지 않습니다.",
        );
      if (ownerRef.current !== user.id)
        throw new AnalysisError("로그인 상태가 변경됐습니다. 다시 요청해 주세요.");
      const reference: AnalysisReference =
        old && !old.failed && old.inputKind === kind && old.inputHash === hash
          ? old
          : {
              userId: user.id,
              sourceId: crypto.randomUUID(),
              requestId: crypto.randomUUID(),
              inputKind: kind,
              inputHash: hash,
              ...(kind === "pdf" ? { fileName: file!.name, fileSize: file!.size } : {}),
            };
      pendingSave.current = null;
      latest.current = { ...latest.current, draft: { ...d, analysis: reference } };
      options.patchDraft({ analysis: reference });
      options.navigate("processing");
      await analysisApi.submit(
        reference,
        text,
        kind === "pdf" ? file : null,
        updateReference,
        setPhase,
      );
      setWatchEpoch((n) => n + 1);
    } catch (error) {
      options.message(
        error instanceof Error
          ? error.message
          : "분석 요청을 확인하지 못했습니다. 다시 시도해 주세요.",
      );
      options.navigate("input");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  const jobId = ref?.jobId,
    sourceId = ref?.sourceId,
    ownerId = ref?.userId;
  const watching = options.screen === "processing" && ownerId === user?.id;
  useEffect(() => {
    if (!watching || !jobId || !sourceId) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const started = Date.now();
    const current = () =>
      !stopped &&
      ownerRef.current === ownerId &&
      latest.current.draft.analysis?.sourceId === sourceId;
    const poll = async () => {
      if (!current()) return;
      if (Date.now() - started > 600000) {
        setRetryNeeded(true);
        setPhase("분석 상태를 다시 확인해 주세요");
        latest.current.message(
          "분석이 오래 걸리고 있어요. 상태 다시 확인을 눌러 이어서 확인할 수 있습니다. 중복 분석을 요청하지 않습니다.",
        );
        return;
      }
      if (document.visibilityState === "hidden") {
        timer = setTimeout(poll, 3000);
        return;
      }
      try {
        const active = latest.current.draft.analysis!;
        const status = await analysisApi.status(active);
        if (!current()) return;
        if (status["status"] === "failed") {
          updateReference({ ...active, failed: true });
          setRetryNeeded(true);
          setPhase("사업 내용 분석에 실패했어요");
          const detail = status["error"];
          latest.current.message(
            detail &&
              typeof detail === "object" &&
              "message" in detail &&
              typeof detail.message === "string"
              ? detail.message.slice(0, 400)
              : "분석에 실패했습니다. 입력 화면에서 다시 요청해 주세요.",
          );
          return;
        }
        if (status["status"] === "completed") {
          const result = await analysisApi.review(active);
          if (!current()) return;
          const draft = latest.current.draft;
          const dirty =
            active.businessRevision !== undefined &&
            active.savedReviewHash !== (await reviewHash(draft.slides));
          if (!current()) return;
          const conflict =
            dirty &&
            active.businessRevision !== result.revision &&
            result.hash !== (await reviewHash(draft.slides));
          const next = {
            ...active,
            businessRevision: conflict ? active.businessRevision! : result.revision,
            savedReviewHash: result.hash,
          };
          updateReference(next);
          if (!dirty) latest.current.patchDraft({ slides: result.slides, activeSlide: 0 });
          setRetryNeeded(false);
          setPhase("사업 내용 분석이 완료됐어요");
          if (conflict)
            latest.current.message(
              "다른 화면에서 확인 내용이 변경됐습니다. 현재 수정 내용은 유지했어요. 저장할 때 버전 충돌 여부를 확인합니다.",
            );
          latest.current.navigate("review");
          return;
        }
        failures = 0;
        setPhase(
          status["status"] === "queued"
            ? "분석 시작을 기다리고 있어요"
            : status["status"] === "extracting"
              ? "PDF에서 사업 내용을 읽고 있어요"
              : "사업 내용을 7개 항목으로 정리하고 있어요",
        );
        timer = setTimeout(poll, 3000);
      } catch (error) {
        if (!current()) return;
        failures++;
        if (failures >= 3) {
          setRetryNeeded(true);
          setPhase("분석 상태를 다시 확인해 주세요");
          latest.current.message(
            error instanceof Error
              ? error.message
              : "분석 상태를 확인하지 못했습니다. 다시 확인해 주세요.",
          );
        } else timer = setTimeout(poll, 5000);
      }
    };
    timer = setTimeout(poll, 300);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
    // 읽기 중 요청/화면/로그인 사용자가 바뀌면 이전 응답은 적용하지 않습니다.
  }, [watching, jobId, sourceId, ownerId, watchEpoch]);

  async function continueToDesign() {
    if (savingBusy.current) return;
    const current = latest.current.draft;
    const active = current.analysis;
    if (
      !isAnalysisReference(active) ||
      active.userId !== user?.id ||
      active.businessRevision === undefined
    ) {
      options.message("사업 내용을 먼저 분석한 뒤 확인해 주세요.");
      return;
    }
    savingBusy.current = true;
    setSaving(true);
    options.message("");
    try {
      // 응답 유실이 있었다면 동일 저장 요청을 먼저 재확인합니다.
      const pending = pendingSave.current;
      let revision = active.businessRevision;
      if (pending && pending.ref.sourceId === active.sourceId) {
        revision = await analysisApi.save(
          pending.ref,
          pending.sections,
          pending.id,
          pending.revision,
        );
        updateReference({ ...active, businessRevision: revision, savedReviewHash: pending.hash });
        pendingSave.current = null;
      }
      const hash = await reviewHash(current.slides);
      if (hash !== latest.current.draft.analysis?.savedReviewHash) {
        const save = {
          ref: active,
          sections: reviewSections(current.slides),
          id: crypto.randomUUID(),
          hash,
          revision,
        };
        pendingSave.current = save;
        revision = await analysisApi.save(active, save.sections, save.id, save.revision);
        pendingSave.current = null;
        updateReference({ ...active, businessRevision: revision, savedReviewHash: hash });
      }
      if (
        latest.current.draft.analysis?.sourceId === active.sourceId &&
        latest.current.screen === "review" &&
        active.userId === ownerRef.current
      )
        options.navigate("themes");
    } catch (error) {
      options.message(
        error instanceof Error
          ? error.message
          : "수정 내용을 저장하지 못했습니다. 내용은 유지되니 다시 시도해 주세요.",
      );
    } finally {
      savingBusy.current = false;
      setSaving(false);
    }
  }
  return {
    analyze,
    chooseFile,
    clearFile,
    changeSource,
    continueToDesign,
    submitting,
    saving,
    retryNeeded,
    phase,
    canResume: !!ref && ref.userId === user?.id,
    retry: () => {
      options.message("");
      setRetryNeeded(false);
      setWatchEpoch((n) => n + 1);
    },
  };
}
