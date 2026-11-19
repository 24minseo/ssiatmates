import { supabase } from "@/integrations/supabase/client";
import { AnalysisError, createAnalysisApi } from "./analysis";

export const analysisApi = createAnalysisApi({
  async call(name, body) {
    const { data, error } = await supabase.functions.invoke(name, {
      body,
      signal: AbortSignal.timeout(body["action"] === "confirm_pdf" ? 70000 : 35000),
    });
    if (error) {
      let message =
        "서버에 연결하지 못했습니다. 입력 내용은 유지됩니다. 같은 요청으로 다시 시도해 주세요.";
      let code = "NETWORK_UNCONFIRMED";
      if (error.context instanceof Response) {
        try {
          const value: unknown = await error.context.clone().json();
          if (
            value &&
            typeof value === "object" &&
            "message" in value &&
            typeof value.message === "string"
          ) {
            message = value.message.slice(0, 400);
          }
          if (
            value &&
            typeof value === "object" &&
            "code" in value &&
            typeof value.code === "string"
          )
            code = value.code;
        } catch {
          /* 원문 오류/서버 인증 정보는 화면에 표시하지 않습니다. */
        }
      }
      throw new AnalysisError(message, code);
    }
    if (!data || typeof data !== "object" || Array.isArray(data) || data.success === false) {
      throw new AnalysisError(
        typeof data?.message === "string" ? data.message : "서버 응답을 확인하지 못했습니다.",
      );
    }
    return data as Record<string, unknown>;
  },
  async upload(path, token, file) {
    const { error } = await supabase.storage
      .from("ir-deck-assets")
      .uploadToSignedUrl(path, token, file, { contentType: "application/pdf", upsert: false });
    if (error)
      throw new AnalysisError(
        "PDF 업로드 응답을 확인하지 못했습니다. 같은 파일로 다시 시도해 주세요.",
      );
  },
});
