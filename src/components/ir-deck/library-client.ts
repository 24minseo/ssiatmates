import { supabase } from "@/integrations/supabase/client";
import type { LibraryRpc } from "./library";

type RpcResult = { data: unknown; error: { message: string; code?: string } | null };
type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => { abortSignal: (signal: AbortSignal) => PromiseLike<RpcResult> };
export const libraryRpc: LibraryRpc = async (name, args) => {
  const { data, error } = await (supabase.rpc as unknown as Rpc)(name, args).abortSignal(
    AbortSignal.timeout(20000),
  );
  if (error)
    throw new Error(
      error.code === "PGRST202"
        ? "계정별 덱 목록 연결이 아직 적용되지 않았습니다."
        : "덱 정보를 서버에서 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  return data;
};
