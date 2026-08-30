import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/myhome")({
  component: MyHomePage,
});

function MyHomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8F7] px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-ink">MY홈</h1>
        <p className="mt-2 text-sm text-ink-muted">
          로그인 화면 이동 확인을 위한 임시 화면이에요.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center rounded-[12px] bg-brand px-6 font-semibold text-white"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
