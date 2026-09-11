import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../components/app/AppShell";

export const Route = createFileRoute("/myhome")({
  component: MyHomePage,
});

const summaryCards = [
  { label: "오늘의 새 소식", value: 2, description: "신규 매칭 1건 · 내 지원사업 변동 1건", featured: true },
  { label: "맞춤 공고", value: 8, description: "지원할 공고를 선택해보세요." },
  { label: "추가 검토 필요", value: 1, description: "조건 확인이 필요한 공고가 있어요." },
  { label: "내 지원사업", value: 3, description: "시작 전 0건 · 준비 중 2건 · 제출 완료 1건" },
] as const;

function MyHomePage() {
  return (
    <AppShell active="home">
      <header>
        <h1 className="text-[28px] font-bold leading-tight text-ink">MY홈</h1>
        <p className="mt-2 text-sm font-medium text-ink-muted">한눈에 보는 지원사업 브리핑</p>
      </header>

      <section aria-label="지원사업 요약" className="mt-14 grid gap-4 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className={`min-h-[146px] rounded-[12px] p-5 shadow-surface-card ${
              card.featured
                ? "bg-gradient-to-br from-[#30BF98] to-[#168563] text-white"
                : "bg-white text-ink"
            }`}
          >
            <h2 className={`text-sm font-medium ${card.featured ? "text-white" : "text-[#84968E]"}`}>
              {card.label}
            </h2>
            <p className="mt-5 text-[34px] font-medium leading-none">
              {card.value}<span className="ml-1 text-base">건</span>
            </p>
            <p className={`mt-3 text-xs font-medium ${card.featured ? "text-white/80" : "text-[#84968E]"}`}>
              {card.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-12 grid min-h-[430px] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(220px,1fr)]">
        <div className="rounded-[12px] bg-[#F6F8F7]" />
        <div className="rounded-[12px] bg-[#F6F8F7]" />
      </section>
    </AppShell>
  );
}
