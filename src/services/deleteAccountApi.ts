import { createServerFn } from "@tanstack/react-start";

type DeleteAccountInput = { accessToken: string };

function validateInput(input: unknown): DeleteAccountInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("회원 탈퇴 정보를 확인해주세요.");
  }

  const value = input as Record<string, unknown>;
  if (typeof value.accessToken !== "string" || !value.accessToken.trim()) {
    throw new Error("로그인이 필요합니다.");
  }

  return { accessToken: value.accessToken };
}

export const deleteAccount = createServerFn({ method: "POST" })
  .validator(validateInput)
  .handler(async ({ data }) => {
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const publishableKey =
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!supabaseUrl || !publishableKey) {
      throw new Error("서버 Supabase 환경변수가 설정되지 않았습니다.");
    }
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!serviceRoleKey) {
      throw new Error("회원 탈퇴 서버 설정이 아직 완료되지 않았어요.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(data.accessToken);
    if (userError || !userData.user) throw new Error("로그인이 필요합니다.");

    // The service-role key is loaded only on the server and is never sent to
    // the browser. The access token above is checked before this admin action.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userData.user.id, false);
    if (deleteError) {
      console.error("[auth] 회원 탈퇴 실패", deleteError);
      throw new Error("회원 탈퇴를 완료하지 못했어요.");
    }

    return { success: true };
  });
