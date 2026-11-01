import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/feedback")({
  head: () => ({ meta: [{ title: "피드백 남기기" }] }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (status !== "sent") return;
    const timer = window.setTimeout(() => setStatus("idle"), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !user) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    const { error } = await supabase.from("feedback_submissions").insert({
      user_id: user.id,
      message: trimmedMessage,
    });
    if (error) {
      console.error("[feedback] 전송 실패", error);
      setStatus("error");
      return;
    }
    setMessage("");
    setStatus("sent");
  };

  return (
    <div className="bg-background text-ink">
      <main className="mx-auto w-full max-w-[760px] px-6 pb-16 pt-12">
        <section>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">피드백 남기기</h1>
          <p className="mt-3 text-[15px] leading-6 text-ink-muted">
            서비스 이용 중 느낀 점이나 개선 의견을 자유롭게 남겨주세요.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <textarea
                name="feedback"
                aria-label="피드백 내용"
                rows={8}
                placeholder="의견을 입력해주세요"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  if (status !== "idle") setStatus("idle");
                }}
                className="mt-2 block w-full resize-y rounded-xl border border-field-border bg-white px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-base placeholder:text-guide-text focus:border-brand focus:ring-2 focus:ring-brand/10"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={status === "sending"}
                className="h-11 rounded-[12px] bg-brand px-5 text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
              >
                전송하기
              </button>
            </div>
            {status === "sent" && <p className="text-sm text-brand">피드백이 전송되었습니다.</p>}
            {status === "error" && (
              <p className="text-sm text-destructive">내용을 입력한 후 다시 시도해 주세요.</p>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}
