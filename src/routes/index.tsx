import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthDivider, AuthField, AuthLayout, GoogleButton } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "로그인 · 메이츠" },
      {
        name: "description",
        content: "메이츠에 로그인해 맞춤 지원사업을 확인하세요.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailError =
    emailTouched && email.length > 0 && !emailValid
      ? "올바른 이메일 형식으로 입력해주세요."
      : undefined;
  const canSubmit = emailValid && password.length > 0;

  return (
    <AuthLayout>
      <div className="flex min-h-[55px] items-center">
        <h1 className="text-2xl font-bold leading-[29px] text-ink">로그인</h1>
      </div>

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) void navigate({ to: "/myhome" });
        }}
      >
        <GoogleButton label="Google 계정으로 로그인" />

        <div className="mt-3">
          <AuthDivider />
        </div>

        <div className="mt-3 flex flex-col gap-[15px]">
          <AuthField
            id="login-email"
            type="email"
            label="이메일"
            placeholder="이메일을 입력하세요"
            value={email}
            onChange={(value) => {
              setEmail(value);
              setEmailTouched(false);
            }}
            onBlur={() => setEmailTouched(true)}
            error={emailError}
            autoComplete="email"
          />
          <AuthField
            id="login-password"
            type="password"
            label="비밀번호"
            placeholder="영문·숫자 포함 8~16자"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </div>

        <div className="mt-3 flex h-5 items-center justify-end">
          <button
            type="button"
            className="text-[13px] font-normal text-brand"
          >
            비밀번호를 잊으셨나요?
          </button>
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="mt-3 h-12 w-full rounded-[12px] bg-brand text-base font-semibold text-white shadow-primary-button hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:text-white disabled:opacity-100"
        >
          로그인
        </Button>

        <p className="mt-3 text-center text-[13px] font-normal text-ink-muted">
          계정이 없으신가요?{" "}
          <Link to="/signup" viewTransition className="font-semibold text-brand underline decoration-1 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            회원가입
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
