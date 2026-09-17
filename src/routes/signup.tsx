import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { AuthDivider, AuthField, AuthLayout, GoogleButton } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

interface AgreementRowProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  title: string;
}

function AgreementRow({
  checked,
  onCheckedChange,
  label,
  title,
}: AgreementRowProps) {
  return (
    <div className="flex h-6 items-center justify-between gap-3">
      <label className="flex min-w-0 cursor-pointer items-center gap-2">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="size-[18px] rounded-[5px] border-[#D8E1DD] [&_svg]:size-3 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white"
        />
        <span className="truncate">{label}</span>
      </label>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="shrink-0 font-normal text-[#9A9D9B] underline-offset-2 hover:text-brand hover:underline"
          >
            보기
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-[480px] rounded-[20px] border-field-border bg-white p-7">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-ink">{title}</DialogTitle>
            <DialogDescription className="pt-3 text-left leading-6 text-ink-muted">
              약관 내용이 들어갈 자리예요. 실제 서비스 약관이 준비되면 이 영역의
              내용을 교체할 수 있어요.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PasswordRequirement({
  met,
  children,
}: {
  met: boolean;
  children: string;
}) {
  return (
    <li
      className={`flex items-center gap-1 text-[12px] font-normal ${
        met ? "text-brand" : "text-[#84968E]"
      }`}
    >
      <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </li>
  );
}

function SignupPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [name, setName] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailError =
    emailTouched && email.length > 0 && !emailValid
      ? "올바른 이메일 형식으로 입력해주세요."
      : undefined;

  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasValidLength = password.length >= 8 && password.length <= 16;
  const passwordValid = hasLetter && hasNumber && hasValidLength;
  const allAgreed = terms && privacy;
  const canSubmit =
    emailValid && passwordValid && name.trim().length > 0 && allAgreed && !submitting;

  const setAll = (checked: boolean) => {
    setTerms(checked);
    setPrivacy(checked);
  };

  const handleSignup = async () => {
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name.trim() },
      },
    });
    if (error) {
      setSubmitting(false);
      toast.error(
        error.message.includes("already")
          ? "이미 가입된 이메일이에요."
          : "회원가입에 실패했어요. 다시 시도해주세요.",
      );
      return;
    }
    // 세션이 유지된 채로 AuthGate가 온보딩으로 이동시킴
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result?.error) {
      setSubmitting(false);
      toast.error("Google 회원가입에 실패했어요. 다시 시도해주세요.");
    }
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
          if (canSubmit) void handleSignup();
        }}
      >
        <GoogleButton
          label="Google 계정으로 회원가입"
          onClick={() => void handleGoogle()}
        />

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
            onChange={(value) => {
              setEmail(value);
              setEmailTouched(false);
            }}
            onBlur={() => setEmailTouched(true)}
            error={emailError}
            autoComplete="email"
            required
            placeholderClassName="placeholder:text-guide-text"
          />
          <div>
            <AuthField
              id="signup-password"
              type="password"
              label="비밀번호"
              placeholder="영문·숫자 포함 8~16자"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              required
              placeholderClassName="placeholder:text-guide-text"
            />
            <ul
              id="signup-password-requirements"
              aria-label="비밀번호 조건"
              className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1"
            >
              <PasswordRequirement met={hasLetter}>영문 알파벳</PasswordRequirement>
              <PasswordRequirement met={hasNumber}>숫자</PasswordRequirement>
              <PasswordRequirement met={hasValidLength}>8~16자리</PasswordRequirement>
            </ul>
          </div>
          <AuthField
            id="signup-name"
            label="이름"
            placeholder="이름을 입력하세요"
            value={name}
            onChange={setName}
            autoComplete="name"
            required
            placeholderClassName="placeholder:text-guide-text"
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
          <AgreementRow
            checked={terms}
            onCheckedChange={setTerms}
            label="이용약관 동의 (필수)"
            title="이용약관"
          />
          <AgreementRow
            checked={privacy}
            onCheckedChange={setPrivacy}
            label="개인정보 수집·이용 동의 (필수)"
            title="개인정보 수집·이용 동의"
          />
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="mt-3 h-12 w-full rounded-[12px] bg-brand text-base font-semibold text-white shadow-primary-button hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:text-white disabled:opacity-100"
        >
          회원가입
        </Button>

        <p className="mt-3 text-center text-[13px] font-normal text-ink-muted">
          이미 계정이 있으신가요?{" "}
          <Link to="/" viewTransition className="font-semibold text-brand underline decoration-1 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            로그인
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
