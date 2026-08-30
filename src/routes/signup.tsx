import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthDivider, AuthField, AuthLayout, GoogleButton } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  const allAgreed = terms && privacy;
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 8 &&
    name.trim().length > 0 &&
    allAgreed;

  const setAll = (checked: boolean) => {
    setTerms(checked);
    setPrivacy(checked);
  };

  return (
    <AuthLayout>
      <div className="flex min-h-[55px] items-center">
        <h1 className="text-2xl font-bold leading-[29px] text-ink">회원가입</h1>
      </div>

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) void navigate({ to: "/onboarding" });
        }}
      >
        <GoogleButton label="Google로 회원가입" />

        <div className="mt-3">
          <AuthDivider />
        </div>

        <div className="mt-3 flex flex-col gap-[15px]">
          <AuthField
            id="signup-email"
            type="email"
            label="이메일"
            placeholder="이메일을 입력하세요"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <AuthField
            id="signup-password"
            type="password"
            label="비밀번호"
            placeholder="비밀번호를 입력하세요 (8자 이상)"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <AuthField
            id="signup-name"
            label="이름"
            placeholder="이름을 입력하세요"
            value={name}
            onChange={setName}
            autoComplete="name"
          />
        </div>

        <div className="mt-3 text-[12px] text-ink-muted">
          <label className="flex h-6 cursor-pointer items-center gap-2 text-brand">
            <Checkbox
              checked={allAgreed}
              onCheckedChange={(checked) => setAll(checked === true)}
              className="size-[18px] rounded-[5px] border-[#D8E1DD] [&_svg]:size-3 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white"
            />
            <span className="font-semibold">전체 동의</span>
          </label>
          <div className="my-1 h-px bg-[#D8E1DD]" />
          <label className="flex h-6 cursor-pointer items-center gap-2">
            <Checkbox
              checked={terms}
              onCheckedChange={(checked) => setTerms(checked === true)}
              className="size-[18px] rounded-[5px] border-[#D8E1DD] [&_svg]:size-3 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white"
            />
            이용약관 동의 (필수)
          </label>
          <label className="flex h-6 cursor-pointer items-center gap-2">
            <Checkbox
              checked={privacy}
              onCheckedChange={(checked) => setPrivacy(checked === true)}
              className="size-[18px] rounded-[5px] border-[#D8E1DD] [&_svg]:size-3 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white"
            />
            개인정보 처리방침 동의 (필수)
          </label>
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="mt-3 h-[50px] w-full rounded-[12px] bg-brand text-[15px] font-semibold text-white shadow-primary-button hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:text-white disabled:opacity-100"
        >
          회원가입
        </Button>

        <p className="mt-3 text-center text-[13px] font-medium text-ink-muted">
          이미 계정이 있으신가요?{" "}
          <Link to="/" className="font-semibold text-brand hover:underline">
            로그인
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
