import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, FileText, Plus, Presentation, Sparkles } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/ir-deck")({
  head: () => ({ meta: [{ title: "IR 덱 · 메이츠" }] }),
  component: IrDeckPage,
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
  const [screen, setScreen] = useState<"home" | "input" | "processing" | "review" | "themes">("home");
  const [sort, setSort] = useState<"updated" | "created" | "viewed">("updated");
  const [source, setSource] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("Precision Tech");
  const [started, setStarted] = useState(false);

  if (screen === "home") return (
    <main className="min-h-full bg-background px-8 pb-20 pt-8 xl:px-14">
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-10 flex items-start justify-between gap-6">
          <div><h1 className="text-[32px] font-bold tracking-[-0.04em] text-ink">AI IR 덱</h1><p className="mt-2 text-base text-ink-muted">사업의 핵심을 투자자가 이해할 수 있는 이야기로 정리해 보세요.</p></div>
        </header>
        <div className="mb-5 flex justify-end"><DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="IR Deck 정렬" className="h-9 rounded-[10px] border border-field-border bg-surface px-3 text-sm text-ink transition-colors hover:bg-item-hover">{sort === "updated" ? "최근 수정순" : sort === "created" ? "최근 생성순" : "최근 열람순"} <span className="ml-2 text-ink-muted">⌄</span></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-[136px] rounded-[12px] border-0 bg-surface p-1" style={{ boxShadow: "var(--shadow-dropdown)" }}>{([["updated", "최근 수정순"], ["created", "최근 생성순"], ["viewed", "최근 열람순"]] as const).map(([value, label]) => <DropdownMenuItem key={value} onSelect={() => setSort(value)} className="min-h-10 cursor-pointer rounded-[8px] px-[10px] text-ink data-[highlighted]:bg-dropdown-hover">{label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div>
        <section className="grid min-h-[360px] place-items-center rounded-2xl border border-field-border bg-surface p-10"><div className="text-center"><Presentation className="mx-auto size-11 text-ink-muted/40" /><h2 className="mt-4 text-lg font-semibold text-ink">아직 만든 IR Deck이 없어요</h2><p className="mt-2 text-sm text-ink-muted">새 IR Deck을 만들어 첫 번째 덱을 시작해 보세요.</p></div></section>
      </div>
    </main>
  );

  if (screen === "processing") return (
    <main className="min-h-full bg-background px-8 pb-20 pt-8 xl:px-14"><div className="mx-auto max-w-[900px]"><header className="mb-8"><h1 className="text-[32px] font-bold text-ink">사업 내용 분석 중</h1><p className="mt-2 text-ink-muted">입력한 내용을 덱에 필요한 항목으로 정리하고 있어요.</p></header><StepBar current={2} /><section className="mt-7 rounded-2xl border border-field-border bg-surface p-12 text-center"><Sparkles className="mx-auto size-10 text-brand" /><h2 className="mt-5 text-xl font-semibold text-ink">사업 내용을 정리하고 있어요</h2><p className="mt-2 text-sm text-ink-muted">다음 화면에서 파악한 내용을 확인할 수 있습니다.</p><div className="mx-auto mt-7 h-2 max-w-md overflow-hidden rounded-full bg-background"><div className="h-full w-2/3 rounded-full bg-brand" /></div><button type="button" onClick={() => setScreen("review")} className="mt-8 rounded-[10px] bg-brand px-5 py-3 text-sm font-semibold text-white">분석 내용 확인하기</button></section></div></main>
  );

  return (
    <main className="min-h-full bg-background px-8 pb-20 pt-8 xl:px-14">
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-8 flex items-start justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-brand">
              <Presentation className="size-4" /> IR Deck
            </div>
            <h1 className="text-[32px] font-bold tracking-[-0.04em] text-ink">AI IR Deck</h1>
            <p className="mt-2 text-base text-ink-muted">사업 자료를 바탕으로 투자자를 위한 IR 덱을 만들어보세요.</p>
          </div>
          <button type="button" onClick={() => setScreen("home")} className="inline-flex items-center gap-2 rounded-[10px] border border-field-border px-4 py-3 text-sm font-semibold text-ink hover:bg-item-hover">
            <Plus className="size-4" /> 새 IR 덱 만들기
          </button>
        </header>

        <StepBar current={screen === "input" ? 1 : screen === "review" ? 2 : 3} />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
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

          <div className="rounded-2xl border border-field-border bg-surface p-7 shadow-[0_5px_22px_rgba(23,61,49,0.04)]">
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
      </div>
    </main>
  );
}
