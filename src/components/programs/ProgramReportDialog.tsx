import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ReportItem = {
  label?: string | null;
  detail?: string | null;
  condition_kind?: string | null;
};

type ReportSection = {
  items?: ReportItem[];
  [key: string]: unknown;
};

type NoticeReport = {
  status?: "ready" | "report_unavailable" | "not_found" | string;
  notice?: {
    title?: string | null;
    organization?: string | null;
    url?: string | null;
    application_url?: string | null;
  };
  report?: {
    matching_conditions?: Record<string, ReportSection>;
    sections?: Record<string, ReportSection>;
  } | null;
};

type ReportGroup = {
  title: string;
  key?: string;
  section: ReportSection | Record<string, ReportSection> | undefined;
};

type ProgramReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noticeId: string | null;
  noticeTitle?: string | null;
};

const sectionLabels: Record<string, string> = {
  application: "신청방법 및 기간",
  documents: "제출서류",
  obligations: "중요 확인사항",
  benefits: "지원혜택",
  preference: "우대사항",
};

function collectItems(section: ReportSection | Record<string, ReportSection> | undefined): ReportItem[] {
  if (!section) return [];
  if (Array.isArray((section as ReportSection).items)) {
    return (section as ReportSection).items ?? [];
  }

  return Object.values(section as Record<string, ReportSection>).flatMap((nested) =>
    collectItems(nested),
  );
}

function formatReportDetail(detail: string) {
  return detail.replace(/(^|\n)\s*☞\s?/g, "$1");
}

function formatMatchingConditionDetail(detail: string) {
  return formatReportDetail(detail).replace(/(^|\n)\s*-\s+/g, "$1");
}

function formatApplicationDetail(detail: string) {
  const normalized = formatReportDetail(detail).replace(
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})\b/g,
    (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
      const year = kst.getUTCFullYear();
      const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
      const day = String(kst.getUTCDate()).padStart(2, "0");
      const hours = String(kst.getUTCHours()).padStart(2, "0");
      const minutes = String(kst.getUTCMinutes()).padStart(2, "0");
      return `${year}. ${month}. ${day}. ${hours}:${minutes}`;
    },
  );

  return normalized.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, "$1. $2. $3.");
}

function normalizeReportLabel(label?: string | null) {
  return label?.replace(/\s+/g, "").trim() ?? "";
}

function hasReportDetail(item: ReportItem) {
  const detail = formatReportDetail(item.detail ?? "").trim();
  return detail.length > 0 && detail !== "-";
}

function groupItemsByLabel(items: ReportItem[], fallbackLabel: string) {
  const groups = new Map<string, { label: string; items: ReportItem[] }>();

  items.forEach((item, index) => {
    const label = item.label?.trim() || fallbackLabel;
    const key = label.replace(/\s+/g, " ");
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
      return;
    }

    groups.set(key || `item-${index}`, { label, items: [item] });
  });

  return Array.from(groups.values());
}

function ReportGroupView({
  group,
  itemLabel,
  showItemLabel = true,
}: {
  group: ReportGroup;
  itemLabel?: string;
  showItemLabel?: boolean;
}) {
  const items = collectItems(group.section).filter(hasReportDetail);
  if (!items.length) return null;
  const isMatchingConditions = group.key === "matching_conditions";
  const isFlatList = group.key === "benefits" || group.key === "documents";
  const isApplicationGroup = group.key === "application";
  const isApplicationMethodOnly =
    isApplicationGroup &&
    new Set(items.map((item) => normalizeReportLabel(item.label)).filter(Boolean)).size === 1 &&
    items.every((item) => normalizeReportLabel(item.label) === "신청방법");
  const applicationMethodItems = items.filter((item) => normalizeReportLabel(item.label) === "신청방법");
  const applicationPeriodItems = items.filter((item) =>
    ["신청시작", "신청마감"].includes(normalizeReportLabel(item.label)),
  );
  const applicationOtherItems = items.filter((item) =>
    !["신청방법", "신청시작", "신청마감"].includes(normalizeReportLabel(item.label)),
  );
  const hasApplicationPeriodPair =
    applicationPeriodItems.some((item) => normalizeReportLabel(item.label) === "신청시작") &&
    applicationPeriodItems.some((item) => normalizeReportLabel(item.label) === "신청마감");

  return (
    <>
      <section className="py-5">
        <h3 className="mb-3 text-[18px] font-bold leading-7 text-ink">{group.title}</h3>
        {isApplicationGroup ? (
          isApplicationMethodOnly ? (
            <div>
              <ul className="list-disc space-y-2 pl-5 text-[15px] leading-6 text-ink marker:text-ink">
                {items.map((item, index) => (
                  <li key={`application-method-${index}`} className="whitespace-pre-wrap break-keep">
                    {formatApplicationDetail(item.detail ?? "")}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-3 text-[15px] leading-6 text-ink">
              {applicationMethodItems.length ? (
                <ul className="list-disc space-y-2 pl-5 marker:text-ink">
                  {applicationMethodItems.map((item, index) => (
                    <li key={`application-method-${index}`} className="whitespace-pre-wrap break-keep">
                      {formatApplicationDetail(item.detail ?? "")}
                    </li>
                  ))}
                </ul>
              ) : null}
              {applicationOtherItems.map((item, index) => (
                  <div
                    key={`${item.label ?? group.title}-${index}`}
                    className="grid grid-cols-[150px_minmax(0,1fr)] gap-4"
                  >
                    <span className="text-ink-muted">{item.label ?? group.title}</span>
                    <p className="whitespace-pre-wrap break-keep">{formatApplicationDetail(item.detail ?? "")}</p>
                  </div>
              ))}
              {hasApplicationPeriodPair ? (
                <div className="grid grid-cols-2 overflow-hidden border-b border-field-border">
                  {applicationPeriodItems.map((item, index) => (
                    <div
                      key={`application-period-label-${index}`}
                      className="border-b border-field-border bg-item-hover px-3 py-1 text-[13px] font-bold text-ink"
                    >
                      <span className="text-ink">{item.label}</span>
                    </div>
                  ))}
                  {applicationPeriodItems.map((item, index) => (
                    <div key={`application-period-value-${index}`} className="px-3 py-2 text-[15px] text-ink-muted">
                      <p className="whitespace-pre-wrap break-keep">{formatApplicationDetail(item.detail ?? "")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                applicationPeriodItems.map((item, index) => (
                  <div
                    key={`application-period-${index}`}
                    className="grid grid-cols-[150px_minmax(0,1fr)] gap-4"
                  >
                    <span className="text-ink-muted">{item.label ?? group.title}</span>
                    <p className="whitespace-pre-wrap break-keep">{formatApplicationDetail(item.detail ?? "")}</p>
                  </div>
                ))
              )}
            </div>
          )
        ) : isFlatList ? (
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-6 text-ink marker:text-ink">
            {items.map((item, index) => (
              <li key={`${item.label ?? group.title}-${index}`} className="whitespace-pre-wrap break-keep">
                {formatMatchingConditionDetail(item.detail ?? "")}
              </li>
            ))}
          </ul>
        ) : (
          <div className={isMatchingConditions ? "border-y border-field-border py-4" : undefined}>
            <div className={isMatchingConditions ? "space-y-4" : "space-y-3"}>
              {isMatchingConditions && showItemLabel
                ? groupItemsByLabel(items, group.title).map((itemGroup, index) => (
                  <div
                    key={`${itemGroup.label}-${index}`}
                    className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 text-[15px] leading-6"
                  >
                    <span className="font-bold text-ink">{itemGroup.label}</span>
                    <div className="space-y-0">
                      {itemGroup.items.map((item, itemIndex) => (
                        <p key={`${itemGroup.label}-${itemIndex}`} className="whitespace-pre-wrap break-keep text-ink">
                          {formatMatchingConditionDetail(item.detail ?? "")}
                        </p>
                      ))}
                    </div>
                  </div>
                  ))
                : items.map((item, index) => (
                  <div
                    key={`${item.label ?? group.title}-${index}`}
                    className={showItemLabel ? "grid grid-cols-[150px_minmax(0,1fr)] gap-4 text-[15px] leading-6" : "text-[15px] leading-6"}
                  >
                    {showItemLabel ? (
                      <span className="text-ink-muted">{itemLabel ?? item.label ?? group.title}</span>
                    ) : null}
                    <p className="whitespace-pre-wrap break-keep text-ink">{formatReportDetail(item.detail ?? "")}</p>
                  </div>
                  ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function ObligationsGroupView({ section }: { section: ReportGroup["section"] }) {
  const items = collectItems(section).filter(hasReportDetail);
  const participationItems = items.filter((item) => item.condition_kind !== "exclusion");
  const exclusionItems = items.filter((item) => item.condition_kind === "exclusion");
  if (!items.length) return null;

  return (
    <section className="py-5">
      <h3 className="mb-3 text-[18px] font-bold leading-7 text-ink">중요 확인사항</h3>
      {participationItems.length ? (
        <div className="space-y-3 text-[15px] leading-6">
          {participationItems.map((item, index) => (
            <p key={`important-${index}`} className="whitespace-pre-wrap break-keep text-ink">
              {formatReportDetail(item.detail ?? "")}
            </p>
          ))}
        </div>
      ) : null}
      {exclusionItems.length ? (
        <div className={participationItems.length ? "mt-5" : undefined}>
          <h4 className="mb-2 text-[15px] font-semibold text-ink">제외 조건</h4>
          <div className="space-y-3 text-[15px] leading-6">
            {exclusionItems.map((item, index) => (
              <p key={`exclusion-${index}`} className="whitespace-pre-wrap break-keep text-ink">
                {formatReportDetail(item.detail ?? "")}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ProgramReportDialog({ open, onOpenChange, noticeId, noticeTitle }: ProgramReportDialogProps) {
  const [report, setReport] = useState<NoticeReport | null>(null);
  const [reportNoticeId, setReportNoticeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogHeight, setDialogHeight] = useState<number | null>(null);
  const dialogHeaderRef = useRef<HTMLDivElement>(null);
  const dialogBodyRef = useRef<HTMLDivElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setReport(null);
      setReportNoticeId(null);
      setLoading(false);
      setError(null);
      setDialogHeight(null);
      return;
    }
    if (!noticeId) return;
    const currentNoticeId = noticeId;
    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setError(null);
      setReport(null);
      setReportNoticeId(null);
      const { data, error: rpcError } = await supabase.rpc("get_my_notice_report_v1", {
        p_notice_id: currentNoticeId,
      });

      if (cancelled) return;
      if (rpcError) {
        console.error("[programs] 맞춤 리포트 조회 실패", rpcError);
        setError("리포트를 불러오지 못했습니다.");
      } else {
        setReport((data as NoticeReport | null) ?? null);
        setReportNoticeId(currentNoticeId);
      }
      setLoading(false);
    }

    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [noticeId, open]);

  const currentReport = reportNoticeId === noticeId ? report : null;
  const displayNoticeTitle = noticeTitle?.trim() || currentReport?.notice?.title?.trim() || null;
  const noticeUrl = currentReport?.notice?.url ?? currentReport?.notice?.application_url;

  const groups = useMemo<ReportGroup[]>(() => {
    const sections = currentReport?.report?.sections;
    const matchingConditions = currentReport?.report?.matching_conditions;
    const applicationItems = collectItems(sections?.["application"]).filter(hasReportDetail);
    const applicationLabels = new Set(applicationItems.map((item) => normalizeReportLabel(item.label)));
    const hasApplicationMethod = applicationLabels.has("신청방법");
    const hasApplicationPeriod = applicationLabels.has("신청시작") || applicationLabels.has("신청마감");
    const applicationTitle = hasApplicationMethod && hasApplicationPeriod
      ? "신청 방법 및 기간"
      : hasApplicationMethod
        ? "신청 방법"
      : hasApplicationPeriod
        ? "신청 기간"
        : sectionLabels["application"] ?? "신청방법 및 기간";

    return [
      { title: "맞춤 조건", section: matchingConditions, key: "matching_conditions" },
      ...Object.entries(sectionLabels).map(([key, title]) => ({
        title: key === "application" && applicationItems.length ? applicationTitle : title,
        section: sections?.[key],
        key,
      })),
    ];
  }, [currentReport]);

  const statusMessage = currentReport?.status === "not_found"
    ? "이 공고의 맞춤 리포트를 찾을 수 없습니다."
    : "아직 맞춤 리포트가 준비되지 않았습니다.";
  const reportContentKey = loading
    ? "loading"
    : error
      ? "error"
      : currentReport?.status === "ready"
        ? "ready"
        : `unavailable-${currentReport?.status ?? "unknown"}`;

  useLayoutEffect(() => {
    if (!open) return;

    const updateDialogHeight = () => {
      const headerHeight = dialogHeaderRef.current?.offsetHeight ?? 0;
      const contentHeight = dialogContentRef.current?.scrollHeight ?? 0;
      const minHeight = 420;
      const maxHeight = Math.max(240, window.innerHeight - 48);
      const nextHeight = Math.min(
        maxHeight,
        Math.max(minHeight, headerHeight + contentHeight + 40),
      );
      setDialogHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    };

    updateDialogHeight();
    const observer = new ResizeObserver(updateDialogHeight);
    if (dialogHeaderRef.current) observer.observe(dialogHeaderRef.current);
    if (dialogContentRef.current) observer.observe(dialogContentRef.current);
    window.addEventListener("resize", updateDialogHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDialogHeight);
    };
  }, [open, reportContentKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeClassName="right-8 top-8 flex size-9 items-center justify-center rounded-lg opacity-100 text-ink-muted hover:bg-item-hover hover:text-ink focus:outline-none focus:ring-0 focus:ring-offset-0 [&>svg]:size-6"
        className="flex min-h-[420px] max-h-[calc(100vh-48px)] w-[800px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[20px] border-0 bg-surface p-0 transition-[height] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={dialogHeight ? { height: `${dialogHeight}px` } : undefined}
      >
        <div ref={dialogHeaderRef} className="shrink-0">
          <DialogHeader className="px-8 pb-3 pt-8 pr-16 text-left">
            <DialogTitle className="text-[24px] font-bold leading-10 text-ink">리포트</DialogTitle>
          </DialogHeader>
        </div>

        <div ref={dialogBodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 pb-8">
          <div ref={dialogContentRef}>
            <div className="pb-7 pt-4">
              {displayNoticeTitle ? (
                <div className="min-w-0">
                  <p className="line-clamp-2 break-keep text-[20px] font-bold leading-[28px] text-ink">{displayNoticeTitle}</p>
                </div>
              ) : null}
              <div className="mt-4 rounded-[12px] bg-item-hover px-4 py-3 text-[15px] leading-5 text-ink-muted">
                <p>
                  신청 전 자격요건과 제출서류 등 상세 내용은 반드시{" "}
                  {noticeUrl ? (
                    <a
                      href={noticeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 font-medium text-brand underline underline-offset-2 transition-colors hover:text-[#176B57]"
                    >
                      공고 원문
                      <ArrowUpRight aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                    </a>
                  ) : (
                    "공고 원문"
                  )}
                  에서 확인해 주세요.
                </p>
              </div>
            </div>
            {loading ? (
              <p className="py-16 text-center text-[15px] text-ink-muted">리포트를 불러오는 중입니다.</p>
            ) : error ? (
              <p className="py-16 text-center text-[15px] text-ink-muted">{error}</p>
            ) : currentReport?.status !== "ready" ? (
              <p className="py-16 text-center text-[15px] text-ink-muted">{statusMessage}</p>
            ) : (
              groups.map((group) =>
                group.key === "obligations" ? (
                  <ObligationsGroupView key={group.title} section={group.section} />
                ) : (
                  <ReportGroupView key={group.title} group={group} />
                ),
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
