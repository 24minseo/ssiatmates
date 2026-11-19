import { supabase } from "@/integrations/supabase/client";
import { object, signedUrl, text, type ApiCall } from "./html-api";

export const htmlCall: ApiCall = async (name, body) => {
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    signal: AbortSignal.timeout(45000),
  });
  let value: unknown = data;
  if (error?.context instanceof Response) {
    try {
      value = await error.context.clone().json();
    } catch {
      /* 연결 오류는 아래 공통 안내로 처리 */
    }
  }
  // 실패한 작업도 job_id/export_id와 상태를 전달해 재조회/명시적 재시도를 구분한다.
  if (object(value) && value["state"] === "failed" && (value["job_id"] || value["export_id"]))
    return value;
  if (error || !object(value) || value["success"] === false || value["error"]) {
    const nested = object(value) && object(value["error"]) ? value["error"] : value;
    throw new Error(
      object(nested) && typeof nested["message"] === "string"
        ? nested["message"].slice(0, 400)
        : "서버 응답을 확인하지 못했습니다. 같은 요청으로 다시 확인해 주세요.",
    );
  }
  return value;
};
export const mediaBase = () => text(import.meta.env["VITE_SUPABASE_URL"]);
export async function imageUrl(assetId: string): Promise<string> {
  const data = await htmlCall("ir-deck-media-v2", { action: "get_media_url", asset_id: assetId });
  return signedUrl(data["url"], mediaBase(), "ir-deck-editor-assets-v2");
}
export async function uploadImage(deckId: string, file: File, assetId: string): Promise<string> {
  if (!["image/png", "image/jpeg"].includes(file.type) || !file.size || file.size > 3145728)
    throw new Error("3MB 이하 PNG·JPG 이미지를 선택해 주세요.");
  const bytes = await file.arrayBuffer();
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const prepared = await htmlCall("ir-deck-media-v2", {
    action: "prepare_upload",
    deck_id: deckId,
    asset_id: assetId,
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    sha256,
  });
  if (object(prepared["upload"])) {
    const upload = prepared["upload"];
    if (upload["bucket_id"] !== "ir-deck-editor-assets-v2")
      throw new Error("이미지 저장 위치를 확인하지 못했습니다.");
    const path = text(upload["object_path"]);
    if (!path.includes(`/${deckId}/${assetId}/source.`))
      throw new Error("이미지 저장 위치가 덱과 일치하지 않습니다.");
    const { error } = await supabase.storage
      .from("ir-deck-editor-assets-v2")
      .uploadToSignedUrl(path, text(upload["token"]), file, {
        contentType: file.type,
        upsert: false,
      });
    if (error) {
      // 업로드 완료 응답만 유실된 경우 서버 확인으로 복구한다.
      await htmlCall("ir-deck-media-v2", { action: "confirm_upload", asset_id: assetId });
      return assetId;
    }
  }
  await htmlCall("ir-deck-media-v2", { action: "confirm_upload", asset_id: assetId });
  return assetId;
}
