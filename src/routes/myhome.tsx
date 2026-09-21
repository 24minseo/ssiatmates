import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/myhome")({
  head: () => ({ meta: [{ title: "MY홈" }] }),
  component: MyHomePage,
});

const summaryCards = [
  {
    label: "오늘의 새 소식",
    value: 122,
    description: "신규 매칭 1건 · 내 지원사업 변동 1건",
    featured: true,
  },
  {
    label: "맞춤 공고",
    value: 12,
    description: "지원할 공고를 선택해보세요.",
    featured: false,
  },
  {
    label: "추가 검토 필요",
    value: 0,
    description: "조건 확인이 필요한 공고가 있어요.",
    featured: false,
  },
  {
    label: "내 지원사업",
    value: 3,
    description: "시작 전 0건 · 준비 중 2건 · 제출 완료 1건",
    featured: false,
  },
] as const;

function RollingNumber({ value }: { value: number }) {
  const [started, setStarted] = useState(false);
  const [compactOnes, setCompactOnes] = useState(false);
  const digits = String(value).split("").map(Number);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStarted(true);
      setCompactOnes(true);
      return;
    }
    const frameId = requestAnimationFrame(() => {
      setStarted(true);
      setCompactOnes(true);
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <span className="inline-flex h-[1.16em] overflow-hidden align-baseline leading-[1.16] tabular-nums" aria-label={String(value)}>
            {digits.map((digit, digitIndex) => (
            <span
              key={`${digitIndex}-${digit}`}
              className={`inline-flex h-[1.16em] justify-center overflow-hidden transition-[width] duration-500 ease-in-out motion-reduce:transition-none ${digit === 1 && compactOnes ? "w-6" : "w-7"}`}
            >
          <span
            aria-hidden="true"
            className="flex flex-col leading-[1.16] transition-transform duration-500 ease-in-out motion-reduce:transition-none"
            style={{
              transform: `translateY(${started ? `-${digit * 1.16}em` : "0em"})`,
              transitionDelay: digits.length > 1 ? `${digitIndex * 20}ms` : "0ms",
            }}
          >
            {Array.from({ length: 10 }, (_, index) => (
              <span key={index} className="flex h-[1.16em] shrink-0 items-center leading-[1.16]">
                {index}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

function MyHomePage() {

  return (
    <>
      <header>
        <h1 className="text-[28px] font-bold leading-tight text-ink">MY홈</h1>
        <p className="mt-px text-base font-medium text-ink-muted">
          한눈에 보는 지원사업 브리핑
        </p>
      </header>

      <section
        aria-label="지원사업 요약"
        className="mt-14 grid grid-cols-4 gap-4"
      >
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className={`relative overflow-hidden rounded-[12px] p-5 shadow-surface-card ${
              card.featured ? "h-[158px] text-white" : "min-h-[146px] bg-white text-ink"
            }`}
          >
            {card.featured ? (
              <>
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-[12px] bg-white shadow-[inset_0px_0px_1px_0px_#d7ffe2,inset_0px_0px_2px_0px_#a2dece]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-[12px] shadow-[inset_0px_0px_33.4px_-7px_#1f8064,inset_0px_0px_1px_0px_#d7ffe2,inset_0px_0px_2px_0px_#a2dece]"
                  style={{
                    backgroundImage:
                      "linear-gradient(270deg, #1f8064 0%, #005d44 5.7692%, #1f8064 94.231%, rgba(0, 255, 174, 0) 100%)",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-[12px] bg-[rgba(100,255,199,0.2)] backdrop-blur-[25px] shadow-[inset_0px_2px_6px_0px_rgba(149,255,236,0.25),inset_0px_0px_1px_0px_#d7ffe2,inset_0px_0px_2px_0px_#a2dece]"
                />
              </>
            ) : null}
            <div className="absolute inset-0 z-10">
              <h2
                className={`${
                  card.featured
                    ? "absolute left-[22px] top-[21px] text-[18px] font-medium leading-[1.16] text-[#d7f5ea]"
                    : "absolute left-[22px] top-[21px] text-[18px] font-normal leading-[1.16] text-[#84968E]"
                }`}
              >
                {card.label}
              </h2>
              <div
                className={`${
                  card.featured
                    ? "absolute left-[22px] top-[66px] flex items-end gap-1 text-[48px] font-medium leading-[1.16] text-[#d7f5ea]"
                    : "absolute left-[22px] top-[66px] flex items-end gap-1 text-[48px] font-medium leading-[1.16] text-[#1f8064]"
                }`}
              >
                <RollingNumber value={card.value} />
                <span
                  className={`${
                    card.featured
                      ? "relative top-[1px] inline-block pb-2 text-[24px] font-medium leading-[1.16]"
                      : "relative top-[1px] inline-block pb-2 text-[24px] font-medium leading-[1.16]"
                  }`}
                >
                  건
                </span>
              </div>
              <p
                className={`${
                  card.featured
                    ? "absolute left-[22px] top-[122px] text-[13px] font-normal leading-[1.16] text-[#d7f5ea]"
                    : "absolute left-[22px] top-[122px] text-[13px] font-normal leading-[1.16] text-[#84968E]"
                }`}
              >
                {card.description}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-12 grid min-h-[430px] grid-cols-[minmax(0,3fr)_minmax(220px,1fr)] gap-4">
        <div className="rounded-[12px] bg-[#F6F8F7]" />
        <div className="rounded-[12px] bg-[#F6F8F7]" />
      </section>
    </>
  );
}
