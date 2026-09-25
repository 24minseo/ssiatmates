import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function ReportGroupView({
  group,
  itemLabel,
  showItemLabel = true,
}: {
  group: ReportGroup;
  itemLabel?: string;
  showItemLabel?: boolean;
}) {
  const items = collectItems(group.section).filter((item) => item.detail?.trim());
  if (!items.length) return null;

  return (
    <section className="border-b border-field-border py-5 last:border-b-0">
      <h3 className="mb-3 text-[15px] font-semibold text-ink">{group.title}</h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.label ?? group.title}-${index}`}
            className={showItemLabel ? "grid grid-cols-[150px_minmax(0,1fr)] gap-4 text-[14px] leading-6" : "text-[14px] leading-6"}
          >
            {showItemLabel ? (
              <span className="text-ink-muted">{itemLabel ?? item.label ?? group.title}</span>
            ) : null}
            <p className="whitespace-pre-wrap break-keep text-ink">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ObligationsGroupView({ section }: { section: ReportGroup["section"] }) {
  const items = collectItems(section).filter((item) => item.detail?.trim());
  const participationItems = items.filter((item) => item.condition_kind !== "exclusion");
  const exclusionItems = items.filter((item) => item.condition_kind === "exclusion");
  if (!items.length) return null;

  return (
    <section className="border-b border-field-border py-5 last:border-b-0">
      <h3 className="mb-3 text-[15px] font-semibold text-ink">중요 확인사항</h3>
      {participationItems.length ? (
        <div className="space-y-3 text-[14px] leading-6">
          {participationItems.map((item, index) => (
            <p key={`important-${index}`} className="whitespace-pre-wrap break-keep text-ink">
              {item.detail}
            </p>
          ))}
        </div>
      ) : null}
      {exclusionItems.length ? (
        <div className={participationItems.length ? "mt-5" : undefined}>
          <h4 className="mb-2 text-[14px] font-semibold text-ink">제외 조건</h4>
          <div className="space-y-3 text-[14px] leading-6">
            {exclusionItems.map((item, index) => (
              <p key={`exclusion-${index}`} className="whitespace-pre-wrap break-keep text-ink">
                {item.detail}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ProgramReportDialog({ open, onOpenChange, noticeId }: ProgramReportDialogProps) {
  const [report, setReport] = useState<NoticeReport | null>(null);
  const [reportNoticeId, setReportNoticeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogHeight, setDialogHeight] = useState<number | null>(null);
  const dialogHeaderRef = useRef<HTMLDivElement>(null);
  const dialogBodyRef = useRef<HTMLDivElement>(null);

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
    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setError(null);
      setReport(null);
      setReportNoticeId(null);
      const { data, error: rpcError } = await supabase.rpc("get_my_notice_report_v1", {
        p_notice_id: noticeId,
      });

      if (cancelled) return;
      if (rpcError) {
        console.error("[programs] 맞춤 리포트 조회 실패", rpcError);
        setError("리포트를 불러오지 못했습니다.");
      } else {
        setReport((data as NoticeReport | null) ?? null);
        setReportNoticeId(noticeId);
      }
      setLoading(false);
    }

    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [noticeId, open]);

  const currentReport = reportNoticeId === noticeId ? report : null;

  const groups = useMemo<ReportGroup[]>(() => {
    const sections = currentReport?.report?.sections;
    const matchingConditions = currentReport?.report?.matching_conditions;
    return [
      { title: "맞춤 조건", section: matchingConditions, key: "matching_conditions" },
      ...Object.entries(sectionLabels).map(([key, title]) => ({
        title,
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
      const bodyHeight = dialogBodyRef.current?.scrollHeight ?? 0;
      const maxHeight = Math.max(240, window.innerHeight - 48);
      setDialogHeight(Math.min(maxHeight, headerHeight + bodyHeight + 16));
    };

    updateDialogHeight();
    const observer = new ResizeObserver(updateDialogHeight);
    if (dialogHeaderRef.current) observer.observe(dialogHeaderRef.current);
    if (dialogBodyRef.current) observer.observe(dialogBodyRef.current);
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
        className="flex min-h-[240px] max-h-[calc(100vh-48px)] w-[760px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[20px] border-0 bg-surface p-0 transition-[height] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={dialogHeight ? { height: `${dialogHeight}px` } : undefined}
      >
        <div ref={dialogHeaderRef} className="shrink-0">
          <DialogHeader className="border-b border-field-border px-8 pb-5 pt-8 pr-16 text-left">
            <DialogTitle className="text-[24px] font-bold leading-10 text-ink">리포트</DialogTitle>
          {currentReport?.notice ? (
            <div className="mt-4 min-w-0">
              <p className="truncate text-[13px] text-ink-muted">{currentReport.notice.organization}</p>
              <p className="truncate text-[17px] font-semibold leading-6 text-ink">{currentReport.notice.title}</p>
              </div>
            ) : null}
          </DialogHeader>
        </div>

        <div ref={dialogBodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 pb-6">
          <div>
            {loading ? (
              <p className="py-16 text-center text-[14px] text-ink-muted">리포트를 불러오는 중입니다.</p>
            ) : error ? (
              <p className="py-16 text-center text-[14px] text-ink-muted">{error}</p>
            ) : currentReport?.status !== "ready" ? (
              <p className="py-16 text-center text-[14px] text-ink-muted">{statusMessage}</p>
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
