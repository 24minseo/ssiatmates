type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const list = (value: unknown): Json[] => Array.isArray(value) ? value.map(object) : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && !!v.trim()) : [];
const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const labels: Record<string, string> = {
  problem_customer: "문제와 고객", solution_value: "해결방안과 차별성",
  market_business_model: "시장과 사업모델", execution_resources: "실행계획과 자원",
  team_consistency: "수행역량과 계획의 일관성",
};
function Lines({ values }: { values: string[] }) {
  return values.length ? <ul className="list-disc space-y-1 pl-5">{values.map((v, i) => <li key={i} className="whitespace-pre-wrap break-words">{v}</li>)}</ul> : null;
}
function Evidence({ title, value }: { title: string; value: unknown }) {
  const entries = list(value).filter(e => text(e.quote).trim());
  if (!entries.length) return null;
  return <details className="mt-3 rounded-lg bg-item-hover p-3">
    <summary className="cursor-pointer font-medium">{title} ({entries.length})</summary>
    {entries.map((e, i) => <blockquote key={i} className="mt-3 border-l-2 border-brand pl-3">
      <p className="whitespace-pre-wrap break-words">{text(e.quote)}</p>
      <p className="mt-1 text-xs text-ink-muted">근거 위치: {text(e.evidence_id, "위치 정보 없음")}</p>
    </blockquote>)}
  </details>;
}
function Score({ title, value, fit }: { title: string; value: unknown; fit?: boolean }) {
  const score = object(value), report = object(score.report);
  const points = number(score.score);
  const ready = score.status === "completed" && points !== null;
  const items = list(report.items);
  const own = report.uses_service_weights === true || report.score_basis === "service_weights";
  return <section className="rounded-xl border border-field-border p-4">
    <h4 className="text-lg font-bold">{title}</h4>
    <p className="my-2 text-3xl font-bold text-brand">{ready ? <>{points}<span className="text-sm font-normal text-ink-muted"> / 100점</span></> : <span className="text-base">{score.status === "unavailable" ? "평가 불가" : "점수 미제공"}</span>}</p>
    <p className="text-sm text-ink-muted">{fit ? own ? "공식 배점이 없어 자체 배점으로 평가한 AI 참고 점수입니다." : report.score_basis === "official_weights" ? "공고의 공식 배점을 적용한 AI 참고 점수입니다." : "공고 기준에 대한 AI 참고 평가입니다." : "서비스의 사업계획서 완성도 기준을 적용한 AI 참고 점수입니다."}</p>
    {text(report.display_notice) && <p className="mt-2 text-sm">{text(report.display_notice)}</p>}
    {!ready && <p className="mt-2 text-sm">{text(report.reason, "제공된 평가 결과에서 점수를 확인할 수 없습니다.")}</p>}
    {items.map((item, i) => <article key={i} className="mt-4 border-t border-field-border pt-4 text-sm leading-6">
      <h5 className="font-bold">{text(item.name) || (!fit && labels[text(item.criterion_id)]) || `평가 항목 ${i + 1}`}</h5>
      <p className="text-brand">{item.status === "not_applicable" ? "해당 없음" : `${number(item.score) ?? "—"} / ${number(item.max_points) ?? "—"}점`}</p>
      <p className="mt-2 font-semibold">평가 이유</p>
      <p className="whitespace-pre-wrap break-words">{text(item.reason, "평가 이유가 제공되지 않았습니다.")}</p>
      <p className="mt-3 font-semibold">보완할 사항</p>
      {strings(item.improvements).length ? <Lines values={strings(item.improvements)} /> : <p>별도로 제시된 보완 사항이 없습니다.</p>}
      <Evidence title="내 사업계획서 근거" value={item.user_evidence} />
      <Evidence title="공고 평가기준 근거" value={item.official_evidence} />
    </article>)}
    {ready && !items.length && <p className="mt-3 text-sm">세부 평가 이유와 보완 사항이 응답에 없습니다.</p>}
    {strings(report.limitations).length > 0 && <div className="mt-4 text-sm text-ink-muted"><p className="font-semibold">평가의 한계</p><Lines values={strings(report.limitations)} /></div>}
  </section>;
}
export default function PlanReviewResultView({ review }: { review: unknown }) {
  const data = object(review), submission = object(data.submission);
  const checks = object(submission.checks), report = object(checks.report);
  const guidance = object(checks.user_guidance);
  const error = object(data.error);
  const scores = [
    {title: "사업계획서 완성도", value: object(data.completeness)},
    {title: "공고 적합도", value: object(data.notice_fit)},
  ];
  return <section className="mt-5 space-y-4 text-ink" aria-label="사업계획서 평가 결과">
    {data.status === "completed" && <div className="rounded-2xl bg-item-hover p-5">
      <p className="text-sm font-semibold text-brand">분석 완료</p>
      <h3 className="mt-1 text-xl font-bold">사업계획서의 강점과 보완점을 확인하세요</h3>
      <p className="mt-2 text-sm text-ink-muted">완성도와 공고 적합도를 각각 100점 기준으로 확인할 수 있어요.</p>
      <div className="mt-5 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        {scores.map(({title, value}) => <div key={title} className="rounded-xl border border-field-border bg-surface p-4">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-3 text-4xl font-bold tracking-tight text-brand">{value.status === "completed" && number(value.score) !== null ? <>{number(value.score)}<span className="ml-1 text-sm font-normal text-ink-muted">/ 100</span></> : <span className="text-lg">{value.status === "unavailable" ? "평가 불가" : "점수 미제공"}</span>}</p>
        </div>)}
      </div>
    </div>}
    {text(error.message) && <p role="alert" className="rounded-xl bg-item-hover p-4 text-sm text-destructive">{text(error.message)}</p>}
    {submission.status !== "passed" && text(guidance.message) && <p className="text-sm">{text(guidance.message)}</p>}
    {(data.status === "completed" || submission.status === "passed") && <div className="space-y-4">
      <Score title="사업계획서 완성도" value={data.completeness} />
      <Score title="공고 적합도" value={data.notice_fit} fit />
    </div>}
    {list(report.document_checks).length > 0 && <details className="rounded-xl border border-field-border p-4" open={submission.status !== "passed"}>
      <summary className="cursor-pointer font-semibold">사업계획 항목·작성 여부 확인</summary>
      {list(report.document_checks).map((c, i) => <div key={i} className="mt-3 text-sm">
        <p className="font-semibold">{text(c.description)}</p><p>{text(c.reason)}</p>
      </div>)}
      <Lines values={strings(report.improvements)} />
    </details>}
    <p className="text-xs text-ink-muted">문서에 기재된 내용을 바탕으로 한 AI 참고 평가이며, 실제 심사 결과나 합격 가능성을 보장하지 않습니다.</p>
  </section>;
}
