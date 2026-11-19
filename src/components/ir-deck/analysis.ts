import { newSlide, slideNames, type Slide } from "./model";

export const sectionIds = [
  "cover",
  "problem",
  "target_customer",
  "solution",
  "product_service",
  "market",
  "business_model",
] as const;
export type AnalysisReference = {
  userId: string;
  sourceId: string;
  requestId: string;
  inputKind: "pdf" | "text";
  inputHash: string;
  fileName?: string;
  fileSize?: number;
  deckId?: string;
  jobId?: string;
  businessRevision?: number;
  savedReviewHash?: string;
  failed?: boolean;
};
type RecordValue = Record<string, unknown>;
export type AnalysisTransport = {
  call: (name: "ir-deck-api-v1" | "ir-deck-studio-v2", body: RecordValue) => Promise<RecordValue>;
  upload: (path: string, token: string, file: File) => Promise<void>;
};
export class AnalysisError extends Error {
  constructor(
    message: string,
    public code = "ANALYSIS_ERROR",
  ) {
    super(message);
  }
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function isAnalysisReference(v: unknown): v is AnalysisReference {
  if (!v || typeof v !== "object") return false;
  const r = v as RecordValue;
  return (
    [r["userId"], r["sourceId"], r["requestId"]].every(
      (id) => typeof id === "string" && uuid.test(id),
    ) &&
    (r["inputKind"] === "pdf" || r["inputKind"] === "text") &&
    typeof r["inputHash"] === "string" &&
    /^[a-f0-9]{64}$/.test(r["inputHash"]) &&
    [r["deckId"], r["jobId"]].every(
      (id) => id === undefined || (typeof id === "string" && uuid.test(id)),
    ) &&
    (r["businessRevision"] === undefined ||
      (Number.isSafeInteger(r["businessRevision"]) && Number(r["businessRevision"]) >= 0))
  );
}
export async function hashText(text: string) {
  return hashBytes(new TextEncoder().encode(text));
}
async function hashBytes(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer)),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function validatePlanFile(file: File) {
  if (
    !/\.pdf$/i.test(file.name.trim()) ||
    file.size < 1 ||
    file.size > 10485760 ||
    file.name.length > 255
  ) {
    throw new AnalysisError("10MB 이하의 PDF 파일을 선택해 주세요.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new AnalysisError("파일 내용이 PDF 형식이 아닙니다. PDF로 다시 저장해 업로드해 주세요.");
  }
  return hashBytes(bytes);
}
export function reviewSections(slides: Slide[]) {
  if (slides.length !== 7 || slides.some((s, i) => s.name !== slideNames[i])) {
    throw new AnalysisError("사업 분석 항목 7개의 순서를 확인해 주세요.");
  }
  return sectionIds.map((section_id, i) => {
    const slide = slides[i]!;
    if ([...slide.title].length > 240 || /[\r\n]/.test(slide.title)) {
      throw new AnalysisError("항목별 제목은 줄바꿈 없이 240자 이하로 입력해 주세요.");
    }
    // 확인 화면의 제목/본문을 기존 본문 저장 API에 손실 없이 함께 보존합니다.
    const body = `# ${slide.title}\n\n${slide.body}`;
    if ([...body].length > 100000)
      throw new AnalysisError("항목별 내용은 제목을 포함해 10만 자 이하로 입력해 주세요.");
    return { section_id, body };
  });
}
export async function reviewHash(slides: Slide[]) {
  return hashText(JSON.stringify(reviewSections(slides)));
}
function record(v: unknown): v is RecordValue {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function checkId(actual: unknown, expected?: string): string {
  if (typeof actual !== "string" || !uuid.test(actual) || (expected && actual !== expected)) {
    throw new AnalysisError(
      "서버의 자료 번호를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.",
      "INVALID_RESPONSE",
    );
  }
  return actual;
}

export function createAnalysisApi(transport: AnalysisTransport) {
  const input = (body: RecordValue) => transport.call("ir-deck-api-v1", body);
  const studio = (body: RecordValue) => transport.call("ir-deck-studio-v2", body);
  return {
    async submit(
      ref: AnalysisReference,
      text: string,
      file: File | null,
      changed: (ref: AnalysisReference) => void,
      phase: (text: string) => void,
    ) {
      if (ref.jobId) return ref;
      phase(
        ref.inputKind === "pdf" ? "PDF 업로드를 준비하고 있어요" : "사업 내용을 저장하고 있어요",
      );
      const prepared = await input({
        action: "prepare_input",
        source_id: ref.sourceId,
        input_kind: ref.inputKind,
        ...(ref.inputKind === "text"
          ? { text: text.trim() }
          : {
              filename: ref.fileName,
              size_bytes: ref.fileSize,
              file_sha256: ref.inputHash,
            }),
      });
      checkId(prepared["source_id"], ref.sourceId);
      ref = { ...ref, deckId: checkId(prepared["deck_id"]) };
      changed(ref);
      if (ref.inputKind === "pdf" && prepared["source_state"] === "reserved") {
        const upload = prepared["upload"];
        const expected = `${ref.userId}/${ref.deckId}/${ref.sourceId}/source.pdf`;
        if (prepared["object_path"] !== expected || prepared["bucket_id"] !== "ir-deck-assets") {
          throw new AnalysisError("PDF 업로드 경로를 확인하지 못했습니다.", "INVALID_RESPONSE");
        }
        let uploadError: unknown;
        if (file) {
          if (
            !record(upload) ||
            upload["object_path"] !== expected ||
            upload["bucket_id"] !== "ir-deck-assets" ||
            typeof upload["token"] !== "string"
          ) {
            throw new AnalysisError("PDF 업로드 주소를 확인하지 못했습니다.", "INVALID_RESPONSE");
          }
          phase("PDF를 업로드하고 있어요");
          try {
            await transport.upload(expected, upload["token"], file);
          } catch (error) {
            uploadError = error;
          }
        }
        phase("업로드한 PDF를 확인하고 있어요");
        try {
          await input({ action: "confirm_pdf", source_id: ref.sourceId });
        } catch (error) {
          if (!file)
            throw new AnalysisError(
              "PDF 업로드를 마치려면 같은 파일을 다시 선택해 주세요.",
              "FILE_REQUIRED",
            );
          throw uploadError ?? error;
        }
      }
      phase("사업 내용 분석을 요청하고 있어요");
      const job = await input({
        action: "request_generation",
        source_id: ref.sourceId,
        client_request_id: ref.requestId,
      });
      checkId(job["deck_id"], ref.deckId);
      if (job["source_id"] !== ref.sourceId)
        throw new AnalysisError("분석할 입력 자료가 일치하지 않습니다.", "INVALID_RESPONSE");
      ref = { ...ref, jobId: checkId(job["job_id"]) };
      changed(ref);
      return ref;
    },
    async status(ref: AnalysisReference) {
      const status = await input({ action: "get_job", job_id: ref.jobId });
      checkId(status["job_id"], ref.jobId);
      checkId(status["deck_id"], ref.deckId);
      if (
        status["source_id"] !== ref.sourceId ||
        !["queued", "extracting", "analyzing", "rendering", "completed", "failed"].includes(
          String(status["status"]),
        )
      ) {
        throw new AnalysisError("분석 작업의 상태를 확인하지 못했습니다.", "INVALID_RESPONSE");
      }
      return status;
    },
    async review(ref: AnalysisReference) {
      const [preview, business] = await Promise.all([
        input({ action: "get_preview", job_id: ref.jobId }),
        studio({ action: "get_business", deck_id: ref.deckId }),
      ]);
      checkId(preview["job_id"], ref.jobId);
      checkId(preview["deck_id"], ref.deckId);
      checkId(business["deck_id"], ref.deckId);
      if (
        preview["ready"] !== true ||
        business["ready"] !== true ||
        !Array.isArray(preview["slides"]) ||
        preview["slides"].length !== 7 ||
        !Array.isArray(business["sections"]) ||
        business["sections"].length !== 7 ||
        !Number.isSafeInteger(business["revision"]) ||
        Number(business["revision"]) < 0
      ) {
        throw new AnalysisError(
          "분석 결과를 아직 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.",
        );
      }
      const previewSlides = preview["slides"],
        sections = business["sections"];
      const slides = sectionIds.map((id, i) => {
        const p: unknown = previewSlides[i],
          b: unknown = sections[i];
        if (
          !record(p) ||
          p["section_id"] !== id ||
          !record(p["content"]) ||
          typeof p["content"]["title"] !== "string" ||
          !record(b) ||
          b["section_id"] !== id ||
          typeof b["body"] !== "string"
        ) {
          throw new AnalysisError(
            "분석 결과의 항목 형식을 확인하지 못했습니다.",
            "INVALID_RESPONSE",
          );
        }
        let title = p["content"]["title"],
          body = b["body"];
        // 기존 확인용 초안은 그대로 읽고, 이 화면에서 저장한 Markdown 제목만 분리합니다.
        if (Number(business["revision"]) > 0) {
          const saved = /^# ([^\r\n]*)\n\n([\s\S]*)$/.exec(body);
          if (saved) {
            title = saved[1]!;
            body = saved[2]!;
          }
        }
        return newSlide(slideNames[i]!, title, body);
      });
      return { slides, revision: Number(business["revision"]), hash: await reviewHash(slides) };
    },
    async save(
      ref: AnalysisReference,
      sections: ReturnType<typeof reviewSections>,
      saveId: string,
      expectedRevision: number,
    ) {
      const result = await studio({
        action: "save_business",
        deck_id: ref.deckId,
        client_save_id: saveId,
        expected_revision: expectedRevision,
        sections,
      });
      if (
        result["saved"] !== true ||
        result["is_current"] === false ||
        result["revision"] !== expectedRevision + 1
      ) {
        throw new AnalysisError(
          "저장 상태를 확인하지 못했습니다. 같은 화면에서 다시 시도해 주세요.",
          "SAVE_UNCONFIRMED",
        );
      }
      return Number(result["revision"]);
    },
  };
}
