import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, FileText, Plus, Presentation, Sparkles } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { ProgramSortDropdown, type ProgramSortOption } from "@/components/my-programs/ProgramSortDropdown";
import { IrDeckWireframe } from "./ir-deck-wireframe";

export const Route = createFileRoute("/ir-deck")({
  head: () => ({ meta: [{ title: "IR 덱 · 메이츠" }] }),
  component: IrDeckWireframe,
});

const steps = ["사업 자료 입력", "사업 내용 확인", "디자인 방향 선택", "IR 덱 편집"];
const themes = [
  { name: "Precision Tech", description: "정교함 · 신뢰감 · 데이터 중심", tone: "bg-[#F4F8F5]" },
  { name: "Bold Momentum", description: "대담함 · 성장성 · 강한 대비", tone: "bg-[#153E34] text-white" },
  { name: "Human Impact", description: "따뜻함 · 사람 중심 · 스토리텔링", tone: "bg-[#F7F2E8]" },
];

function StepBar({ current }: { current: number }) {
  return <div className="mb-7 flex flex-wrap items-center justify-center gap-3 text-sm text-ink-muted">{steps.map((step, index) => <div key={step} className={cn("flex items-center gap-2 rounded-full border border-field-border px-4 py-2", index + 1 === current && "border-brand bg-item-hover-selected font-semibold text-brand")}><span className={cn("grid size-6 place-items-center rounded-full bg-surface text-xs", index + 1 === current && "bg-brand text-white")}>{index + 1}</span>{step}</div>)}</div>;
}

function IrDeckPage() {
  const [screen, setScreen] = useState<"home" | "input" | "processing" | "review" | "themes" | "editor">("home");
  const [sort, setSort] = useState<ProgramSortOption>("created");
  const [source, setSource] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("Precision Tech");
  const [started, setStarted] = useState(false);

  if (screen === "home") return (
    <main className="min-h-full bg-background pb-20">
      <section className="space-y-[32px]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="h-[33px] text-[28px] font-bold leading-[33px] text-ink">AI IR 덱</h1>
            <span className="inline-flex h-8 min-w-8 items-center justify-center overflow-hidden rounded-full bg-item-hover px-2 text-[18px] font-semibold leading-none text-ink-muted">0</span>
          </div>
          <div className="mt-[18px] flex items-center justify-end gap-3">
            <ProgramSortDropdown value={sort} onChange={setSort} variant="irDeck" />
            <button type="button" onClick={() => setScreen("input")} className="inline-flex h-[42px] items-center rounded-[12px] bg-brand px-[26px] py-[10px] text-[15px] font-semibold text-white hover:bg-brand/90">새 IR 덱 생성</button>
          </div>
        </div>
        <section className="mt-[18px] rounded-[12px] bg-transparent px-6 py-16 text-center"><div className="mx-auto mb-2 flex h-[180px] w-[180px] items-center justify-center"><Presentation className="size-11 text-ink-muted/40" /></div><p className="text-[18px] font-semibold text-ink">아직 만든 IR 덱이 없어요</p><p className="mt-[2px] text-[15px] text-ink-muted">사업의 핵심을 투자자가 이해할 수 있는 이야기로 정리해 보세요.</p></section>
      </section>
    </main>
  );

  if (screen === "processing") return (
    <main className="min-h-full bg-background pb-20"><div><header className="mb-8"><h1 className="text-[32px] font-bold text-ink">사업 내용 분석 중</h1><p className="mt-2 text-ink-muted">입력한 내용을 덱에 필요한 항목으로 정리하고 있어요.</p></header><StepBar current={2} /><section className="mt-7 rounded-2xl border border-field-border bg-surface p-12 text-center"><Sparkles className="mx-auto size-10 text-brand" /><h2 className="mt-5 text-xl font-semibold text-ink">사업 내용을 정리하고 있어요</h2><p className="mt-2 text-sm text-ink-muted">다음 화면에서 파악한 내용을 확인할 수 있습니다.</p><div className="mx-auto mt-7 h-2 max-w-md overflow-hidden rounded-full bg-background"><div className="h-full w-2/3 rounded-full bg-brand" /></div><button type="button" onClick={() => setScreen("review")} className="mt-8 rounded-[10px] bg-brand px-5 py-3 text-sm font-semibold text-white">분석 내용 확인하기</button></section></div></main>
  );

  if (screen === "review") return (
    <main className="min-h-full bg-background pb-20"><div><header className="mb-8"><h1 className="text-[32px] font-bold text-ink">사업 분석 내용 확인</h1><p className="mt-2 text-base text-ink-muted">파악한 내용을 확인하고 필요한 부분을 직접 수정해 주세요.</p></header><StepBar current={2} /><section className="rounded-2xl border border-field-border bg-surface p-7"><h2 className="text-xl font-semibold text-ink">AI가 이해한 사업 내용</h2><p className="mt-2 text-sm leading-6 text-ink-muted">입력한 사업 자료를 바탕으로 정리한 내용입니다. 다음 단계에서 디자인을 선택할 수 있어요.</p><div className="mt-6 rounded-xl bg-background p-5 text-sm leading-7 text-ink-muted">{source.trim() || "입력한 사업 내용이 없습니다. 다음 단계에서 덱을 구성할 수 있습니다."}</div></section><div className="mt-6 flex justify-end"><button type="button" onClick={() => setScreen("themes")} className="inline-flex items-center rounded-[10px] bg-brand px-5 py-3 text-sm font-semibold text-white">디자인 방향 선택 <ArrowRight className="ml-2 size-4" /></button></div></div></main>
  );

  if (screen === "themes") return (
    <main className="min-h-full bg-background pb-20"><div><header className="mb-8"><h1 className="text-[32px] font-bold text-ink">디자인 방향 선택</h1><p className="mt-2 text-base text-ink-muted">확인한 사업 내용에 어울리는 디자인을 선택해 주세요.</p></header><StepBar current={3} /><section className="grid gap-4 md:grid-cols-3">{themes.map((theme) => <button key={theme.name} type="button" onClick={() => setSelectedTheme(theme.name)} className={cn("rounded-2xl border bg-surface p-5 text-left", selectedTheme === theme.name ? "border-brand bg-item-hover-selected" : "border-field-border")}><div className={cn("mb-4 flex h-24 items-end rounded-xl p-4", theme.tone)}><span className="font-bold">사업을 설명하는 한 문장</span></div><p className="font-semibold text-ink">{theme.name}</p><p className="mt-1 text-sm text-ink-muted">{theme.description}</p></button>)}</section><div className="mt-6 flex justify-end"><button type="button" onClick={() => setScreen("editor")} className="inline-flex items-center rounded-[10px] bg-brand px-5 py-3 text-sm font-semibold text-white">IR 덱 편집 시작 <ArrowRight className="ml-2 size-4" /></button></div></div></main>
  );

  if (screen === "editor") return (
    <main className="min-h-full bg-background pb-20"><div><header className="mb-8 flex items-start justify-between"><div><h1 className="text-[32px] font-bold text-ink">IR 덱 편집</h1><p className="mt-2 text-base text-ink-muted">슬라이드의 내용을 클릭해 바로 수정하세요.</p></div><div className="flex gap-2"><button type="button" onClick={() => setScreen("themes")} className="rounded-[10px] border border-field-border px-4 py-3 text-sm font-semibold text-ink">디자인 변경</button><button type="button" onClick={() => { localStorage.setItem("ssiat-ir-deck", JSON.stringify({ source, selectedTheme, savedAt: new Date().toISOString() })); setScreen("home"); }} className="rounded-[10px] bg-brand px-4 py-3 text-sm font-semibold text-white">저장</button></div></header><StepBar current={4} /><section className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="rounded-2xl border border-field-border bg-surface p-4"><h2 className="mb-4 font-semibold text-ink">슬라이드</h2>{["Cover","Problem","Why Now","Solution","Product","Market","Business Model"].map((name, index) => <button key={name} type="button" className={cn("mb-2 flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm", index === 0 ? "border-brand bg-item-hover-selected text-brand" : "border-field-border text-ink-muted")}><span>{index + 1}</span><span>{name}</span></button>)}</aside><div className="rounded-2xl border border-field-border bg-surface p-8"><div className="mx-auto flex aspect-video max-w-[760px] flex-col justify-center bg-white p-16 shadow-[0_10px_30px_rgba(23,61,49,0.08)]"><div className="h-1 w-10 bg-brand" /><h2 className="mt-6 text-4xl font-bold text-ink">사업 소개</h2><p className="mt-4 text-lg leading-8 text-ink-muted">사업의 핵심 내용을 입력하고 투자자에게 전달할 이야기를 완성해 보세요.</p></div><p className="mt-4 text-center text-sm text-ink-muted">슬라이드 내용을 클릭해 편집할 수 있습니다.</p></div></section></div></main>
  );

  return (
    <main className="min-h-full bg-background pb-20">
      <div>
        <header className="mb-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[32px] font-bold tracking-[-0.04em] text-ink">새 IR 덱 만들기</h1>
            <p className="mt-2 text-base text-ink-muted">사업계획서를 올리거나 사업 내용을 직접 입력해 주세요.</p>
          </div>
          <button type="button" onClick={() => setScreen("home")} className="inline-flex items-center gap-2 rounded-[10px] border border-field-border px-4 py-3 text-sm font-semibold text-ink hover:bg-item-hover">
            <Plus className="size-4" /> 새 IR 덱 만들기
          </button>
        </header>

        <StepBar current={screen === "input" ? 1 : screen === "review" ? 2 : 3} />

        <section className="grid grid-cols-1 gap-6">
          <div className="rounded-2xl border border-field-border bg-surface p-7 shadow-[0_5px_22px_rgba(23,61,49,0.04)]">
            <div className="mb-6 flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-item-hover-selected text-brand"><Sparkles className="size-5" /></span>
              <div><h2 className="text-xl font-semibold text-ink">사업 자료로 시작하기</h2><p className="mt-1 text-sm leading-6 text-ink-muted">사업계획서나 사업 내용을 입력하면 덱의 기본 구성을 잡아드려요.</p></div>
            </div>
            <label className="mb-2 block text-sm font-semibold text-ink" htmlFor="ir-source">사업 내용</label>
            <textarea id="ir-source" value={source} onChange={(event) => setSource(event.target.value)} placeholder="사업/서비스명, 문제 인식, 핵심 고객, 시장 규모 등을 자유롭게 입력해 주세요." className="min-h-[250px] w-full resize-y rounded-xl border border-field-border bg-background p-4 text-sm leading-6 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button type="button" className="inline-flex items-center gap-2 rounded-[10px] border border-field-border px-4 py-3 text-sm font-semibold text-ink hover:bg-item-hover"><FileText className="size-4" /> 사업계획서 업로드</button>
              <button type="button" onClick={() => { setStarted(true); setScreen("processing"); }} className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand/90">분석 시작 <ArrowRight className="size-4" /></button>
            </div>
            {started && <p className="mt-4 rounded-lg bg-item-hover-selected px-4 py-3 text-sm text-brand">입력 내용을 확인했어요. 다음 단계에서 슬라이드 구성을 검토할 수 있습니다.</p>}
          </div>

          <div className="hidden rounded-2xl border border-field-border bg-surface p-7 shadow-[0_5px_22px_rgba(23,61,49,0.04)]">
            <h2 className="text-xl font-semibold text-ink">디자인 방향</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">나중에 편집기에서 언제든 바꿀 수 있어요.</p>
            <div className="mt-5 grid gap-3">
              {themes.map((theme) => (
                <button key={theme.name} type="button" onClick={() => setSelectedTheme(theme.name)} className={cn("rounded-xl border p-4 text-left transition-colors", selectedTheme === theme.name ? "border-brand bg-item-hover-selected" : "border-field-border hover:bg-item-hover")}>
                  <div className={cn("mb-3 flex h-16 items-end rounded-lg p-3", theme.tone)}><span className="text-sm font-bold">사업을 설명하는 한 문장</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-ink">{theme.name}</span>{selectedTheme === theme.name && <span className="text-xs font-semibold text-brand">선택됨</span>}</div>
                  <p className="mt-1 text-xs text-ink-muted">{theme.description}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-field-border bg-surface p-7">
          <div className="mb-5 flex items-center justify-between border-b border-field-border pb-4"><h2 className="text-lg font-semibold text-ink">최근 IR 덱</h2><span className="rounded-full bg-background px-3 py-1 text-xs text-ink-muted">0개</span></div>
          <div className="grid min-h-[180px] place-items-center text-center"><div><Presentation className="mx-auto size-9 text-ink-muted/50" /><p className="mt-3 text-sm text-ink-muted">아직 저장된 IR 덱이 없어요.</p><p className="mt-1 text-xs text-ink-muted">사업 자료를 입력해 첫 번째 덱을 만들어보세요.</p></div></div>
        </section>

        {screen === "review" ? (
          <div className="flex justify-end">
            <button type="button" onClick={() => setScreen("themes")} className="inline-flex items-center rounded-[10px] bg-brand px-5 py-3 text-sm font-semibold text-white">디자인 방향 선택 <ArrowRight className="ml-2 size-4" /></button>
          </div>
        ) : screen === "themes" ? (
          <div className="flex justify-end">
            <button type="button" onClick={() => setScreen("home")} className="inline-flex items-center rounded-[10px] bg-brand px-5 py-3 text-sm font-semibold text-white">IR 덱 편집 시작 <ArrowRight className="ml-2 size-4" /></button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
