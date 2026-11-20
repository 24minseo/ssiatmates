import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AsyncErrorState } from "@/components/AsyncErrorState";
import { ArrowUpRight, Check, Loader2, Upload, X } from "lucide-react";
import { SquareAlertIcon } from "@/components/ui/square-alert-icon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingDots } from "@/components/ui/loading-dots";
import { cn } from "@/lib/utils";
import PlanReviewResultView from "./PlanReviewResultView";

type ReportItem = {
  label?: string | null | undefined;
  detail?: string | null;
  condition_kind?: string | null;
  children?: ReportItem[];
};
type StructuredNode = { label: string | null; value: string | null; children: StructuredNode[] };

type ReportSection = {
  items?: ReportItem[];
  [key: string]: unknown;
};

type ReportChangeField = {
  field?: string | null;
  old_value?: unknown;
  new_value?: unknown;
};

type ReportBodyChange = {
  before_quote?: string | null;
  after_quote?: string | null;
  reason?: string | null;
};

type ReportChangeEvent = {
  recorded_at?: string | null;
  changed_fields?: ReportChangeField[];
  body_changes?: ReportBodyChange[] | ReportBodyChange;
  body_applied?: boolean;
  review_required_at_recording?: boolean;
};

type DisplayChangeEvent = {
  recorded_at?: string | null;
  changes?: Array<{ label?: string | null; before?: unknown; after?: unknown }>;
  time_note?: string | null;
};

type PlanReviewEligibility = {
  business_plan_required: boolean | null;
  analysis_status: string | null;
  is_current: boolean;
  reason: "required" | "not_required" | "unknown" | "pending" | "failed" | "stale" | string;
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
  change_history?: ReportChangeEvent[];
  change_display?: DisplayChangeEvent[];
  additional_links?: Array<{ label?: string | null; url?: string | null }>;
  report_display?: { version?: string; sections?: StructuredNode[] };
  plan_review_eligibility?: PlanReviewEligibility | null;
  view_version?: string;
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
  scrollToChanges?: boolean;
  supportOverride?: string[];
};

const sectionLabels: Record<string, string> = {
  application: "신청방법 및 기간",
  documents: "제출서류",
  obligations: "중요 확인사항",
  benefits: "지원혜택",
  preference: "우대사항",
};

function millisecondsUntilKoreanNoon(now = Date.now()) {
  const kst = new Date(now + 9 * 60 * 60 * 1000);
  let nextNoon = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 3);
  if (nextNoon <= now) nextNoon += 24 * 60 * 60 * 1000;
  return nextNoon - now;
}

function safeNoticeUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function collectItems(section: ReportSection | Record<string, ReportSection> | undefined): ReportItem[] {
  if (!section) return [];
  if (Array.isArray((section as ReportSection).items)) {
    return (section as ReportSection).items ?? [];
  }

  return Object.values(section as Record<string, ReportSection>).flatMap((nested) =>
    collectItems(nested),
  );
}

function reportNodeText(node: StructuredNode | ReportItem | null | undefined): string {
  if (!node) return "";
  const value = "value" in node ? node.value : node.detail;
  const children = Array.isArray(node.children) ? node.children.map(reportNodeText).join(" ") : "";
  return [node.label, value, children].filter(Boolean).join(" ");
}

function getPlanReviewDisabledReason(eligibility?: PlanReviewEligibility | null) {
  if (eligibility?.reason === "stale") {
    return "공고 정보가 변경되어 제출 여부를 다시 확인하고 있습니다.";
  }
  if (
    eligibility?.analysis_status === "completed" &&
    eligibility.is_current === true &&
    eligibility.business_plan_required === false
  ) {
    return "사업계획서 제출이 필요하지 않은 공고입니다.";
  }
  return "사업계획서 제출 여부를 아직 확인하지 못했습니다.";
}

function formatReportDetail(detail: string) {
  return normalizeReportDisplayText(detail).replace(/(^|\n)\s*☞\s?/g, "$1");
}

/**
 * Report content is rendered as text only. Decode escaped entities and markdown
 * backslashes for readability without using dangerouslySetInnerHTML.
 */
function normalizeReportDisplayText(value: string) {
  if (!value) return value;

  const decoded =
    typeof document === "undefined"
      ? value
      : (() => {
          const textarea = document.createElement("textarea");
          textarea.innerHTML = value;
          return textarea.value || value;
        })();
  return decoded
    .replace(/<\/?(?:p|div|br|h[1-6])(?:\s+[^<>]*?)?\s*\/?>/gi, "\n")
    .replace(/<\/?(?:b|strong|em|i|u|span)(?:\s+[^<>]*?)?\s*\/?>/gi, "")
    .replace(/\\([\\`*_[\]{}()#!>.-])/g, "$1")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const changeFieldLabels: Record<string, string> = {
  title: "제목",
  organization: "주최기관",
  target: "지원 대상",
  excluded_target: "제외 대상",
  region: "지역",
  region_requirements: "지역 조건",
  field: "지원분야",
  published_at: "게시일",
  start_date: "접수 시작일",
  start_at: "접수 시작 시각",
  deadline: "마감일",
  deadline_at: "마감 시각",
  application_method: "신청 방법",
  application_url: "신청 링크",
};

function formatChangeValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string") return normalizeReportDisplayText(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatChangeDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

function ChangeHistoryView({ history }: { history: ReportChangeEvent[] }) {
  if (!history.length) return null;

  return (
    <section className="py-5">
      <h3 className="mb-3 text-[18px] font-bold leading-7 text-ink">변경내역 검토</h3>
      <div className="overflow-hidden border-b border-field-border text-[15px] leading-6 text-ink">
        <div className="grid grid-cols-2">
          <div className="border-b border-field-border bg-item-hover px-3 py-1 text-[13px] font-bold text-ink">
            변경 일자
          </div>
          <div className="border-b border-field-border bg-item-hover px-3 py-1 text-[13px] font-bold text-ink">
            변경 내용
          </div>
        </div>
        {history.map((event, eventIndex) => {
          const bodyChanges = Array.isArray(event.body_changes)
            ? event.body_changes
            : event.body_changes
              ? [event.body_changes]
              : [];
          return (
            <div
              key={`${event.recorded_at ?? "change"}-${eventIndex}`}
              className="grid grid-cols-2 border-b border-field-border last:border-b-0"
            >
              <div className="px-3 py-2 text-[15px] text-ink-muted">
                {formatChangeDate(event.recorded_at)}
              </div>
              <div className="space-y-1 px-3 py-2 text-[15px] text-ink-muted">
                {event.review_required_at_recording ? (
                  <p className="text-ink-muted">당시 검토 필요 기록</p>
                ) : null}
                {event.changed_fields?.map((change, changeIndex) => (
                  <p key={`${change.field ?? "field"}-${changeIndex}`} className="break-keep">
                    <span className="text-ink-muted">
                      {changeFieldLabels[change.field ?? ""] ?? change.field ?? "변경 항목"}
                    </span>{" "}
                    {formatChangeValue(change.old_value)} → {formatChangeValue(change.new_value)}
                  </p>
                ))}
                {bodyChanges.map((change, changeIndex) => (
                  <div key={`body-${changeIndex}`} className="space-y-1">
                    <p className="text-ink-muted">
                      {event.body_applied ? "본문에 반영된 변경" : "본문 반영이 확인되지 않은 판단 기록"}
                    </p>
                    {change.before_quote ? <p className="break-keep">이전: {normalizeReportDisplayText(change.before_quote)}</p> : null}
                    {change.after_quote ? <p className="break-keep">변경: {normalizeReportDisplayText(change.after_quote)}</p> : null}
                    {change.reason ? <p className="break-keep">사유: {normalizeReportDisplayText(change.reason)}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatMatchingConditionDetail(detail: string) {
  return formatReportDetail(detail).replace(/(^|\n)\s*-\s+/g, "$1");
}

function ImportantDetail({
  detail,
  label,
  marker = "bullet",
  structured = false,
}: {
  detail: string;
  label?: string | null | undefined;
  marker?: "bullet" | "hyphen";
  structured?: boolean;
}) {
  const normalizedLabel = normalizeReportLabel(label);
  const lines = formatReportDetail(detail)
    .split(/\r?\n/)
    .map((line) => ({ raw: line, text: line.trim() }))
    .filter((line) => line.text.length > 0)
    .map((line) => {
      const match = line.text.match(/^\\?([*●•-])\s*(.*)$/);
      const isIndentedNumber = /^\s+\d+\.\s/.test(line.raw);
      return {
        kind: match?.[1] === "-" || isIndentedNumber ? "detail" : match ? "label" : "plain",
        text: match?.[2] || line.text,
      } as const;
    })
    .filter((line) => !normalizedLabel || normalizeReportLabel(line.text) !== normalizedLabel);

  if (structured) {
    return (
      <div className="space-y-2 text-[15px] leading-6 text-ink">
        {lines.map((line, index) => (
          line.kind !== "detail" ? (
            <ul key={`${line.text}-${index}`} className="list-disc pl-5 marker:text-ink">
              <li className="whitespace-pre-wrap break-keep">{line.text}</li>
            </ul>
          ) : line.kind === "detail" ? (
            <p key={`${line.text}-${index}`} className="whitespace-pre-wrap break-keep pl-5">
              - {line.text}
            </p>
          ) : (
            <p key={`${line.text}-${index}`} className="whitespace-pre-wrap break-keep pl-5">
              {line.text}
            </p>
          )
        ))}
      </div>
    );
  }

  return (
    <ul className={marker === "hyphen" ? "space-y-2 pl-5 text-[15px] leading-6 text-ink" : "list-disc space-y-2 pl-5 text-[15px] leading-6 text-ink marker:text-ink"}>
      {lines.map((line, index) => (
        <li
          key={`${line.text}-${index}`}
          className={`${marker === "hyphen" || line.text.startsWith("※") ? "list-none" : ""} whitespace-pre-wrap break-keep`}
        >
          {marker === "hyphen" && !line.text.startsWith("※") ? "- " : null}
          {line.text}
        </li>
      ))}
    </ul>
  );
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

function formatApplicationPeriodValue(detail: string, isDeadline: boolean) {
  const formatted = formatApplicationDetail(detail);
  return isDeadline ? formatted.replace(/\s*까지\s*$/, "") : formatted;
}

function normalizeReportLabel(label?: string | null) {
  return label?.replace(/\s+/g, "").trim() ?? "";
}

function hasReportDetail(item: ReportItem) {
  const detail = formatReportDetail(item.detail ?? "").trim();
  // 구조화 응답은 부모 라벨의 value가 null이고 children에 실제 값이
  // 들어올 수 있으므로, 자식이 있는 부모 항목을 먼저 보존합니다.
  return (detail.length > 0 && detail !== "-") || Boolean(item.children?.length);
}

function ReportItemChildren({ items }: { items: ReportItem[] }) {
  return items.length ? (
    <div className="mt-2 space-y-2 pl-4">
      {items.map((child, index) => (
        <div key={`${child.label ?? "child"}-${index}`}>
          {child.label ? <p className="font-semibold text-ink">{child.label}</p> : null}
          {child.detail ? <p className="whitespace-pre-wrap break-keep text-ink">{formatReportDetail(child.detail)}</p> : null}
          <ReportItemChildren items={child.children ?? []} />
        </div>
      ))}
    </div>
  ) : null;
}

function structuredNodeToReportItem(node: StructuredNode): ReportItem {
  return { label: node.label, detail: node.value, children: node.children.map(structuredNodeToReportItem) };
}

function flattenReportItems(items: ReportItem[]): ReportItem[] {
  return items.flatMap((item) => [item, ...flattenReportItems(item.children ?? [])]);
}

function groupItemsByLabel(items: ReportItem[], fallbackLabel: string) {
  const groups = new Map<string, { label: string; items: ReportItem[] }>();
  const duplicateLabels: Record<string, string> = {
    대상연령: "나이",
    "대상 연령": "나이",
    연령: "나이",
    창업업력: "창업대상",
    "창업 업력": "창업대상",
  };

  items.forEach((item, index) => {
    const rawLabel = item.label?.trim() || fallbackLabel;
    const label = duplicateLabels[rawLabel] ?? rawLabel;
    const detail = item.detail ?? "";
    const duplicateHeading = Object.keys(duplicateLabels).find((candidate) =>
      detail.trim().startsWith(candidate),
    );
    const cleanedItem = duplicateHeading
      ? { ...item, detail: detail.trim().slice(duplicateHeading.length).trim() }
      : item;
    const key = label.replace(/\s+/g, " ");
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(cleanedItem);
      return;
    }

    groups.set(key || `item-${index}`, { label, items: [cleanedItem] });
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
  const isMatchingConditions = group.key === "matching_conditions";
  const items = collectItems(group.section).filter(hasReportDetail);
  if (!items.length) return null;
  const isFlatList = group.key === "benefits" || group.key === "documents";
  const isPreferenceGroup = group.key === "preference";
  const isApplicationGroup = group.key === "application";
  const applicationLayoutItems = isApplicationGroup
    ? flattenReportItems(items).filter(hasReportDetail)
    : items;
  const isApplicationMethodOnly =
    isApplicationGroup &&
    new Set(applicationLayoutItems.map((item) => normalizeReportLabel(item.label)).filter(Boolean)).size === 1 &&
    applicationLayoutItems.every((item) => normalizeReportLabel(item.label).startsWith("신청방법"));
  const applicationMethodItems = applicationLayoutItems.filter((item) => normalizeReportLabel(item.label).startsWith("신청방법"));
  const applicationPeriodItems = applicationLayoutItems.filter((item) => {
    const label = normalizeReportLabel(item.label);
    return label.startsWith("신청기간") || label.startsWith("신청시작") || label.startsWith("신청마감");
  });
  const applicationOtherItems = applicationLayoutItems.filter((item) =>
    !["신청방법", "신청기간", "신청시작", "신청마감"].some((label) => normalizeReportLabel(item.label).startsWith(label)),
  );
  const hasApplicationDetails = applicationMethodItems.length > 0 || applicationOtherItems.length > 0;
  const hasApplicationPeriodPair =
    applicationPeriodItems.some((item) => normalizeReportLabel(item.label).startsWith("신청시작")) &&
    applicationPeriodItems.some((item) => normalizeReportLabel(item.label).startsWith("신청마감"));
  const singleApplicationPeriod = applicationPeriodItems.find(
    (item) => normalizeReportLabel(item.label).startsWith("신청기간") && !normalizeReportLabel(item.label).startsWith("신청시작"),
  );
  const singleApplicationPeriodParts = singleApplicationPeriod?.detail?.split(/\s*[~∼]\s*/).map((part) => part.trim()).filter(Boolean) ?? [];
  const flatListDetails = isFlatList
    ? items.flatMap((item) =>
        formatMatchingConditionDetail(item.detail ?? "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.replace(/^[-*●•·]\s*/, "").replace(/^◎\s*/, "● ")),
      )
    : [];
  const normalizedFlatListDetails =
    group.key === "documents" &&
    flatListDetails.filter((detail) => detail !== "없음").length === 1 &&
    flatListDetails.includes("없음")
      ? [`${flatListDetails.find((detail) => detail !== "없음")} 없음`]
      : group.key === "documents" &&
          items.some((item) => Boolean(item.label?.trim())) &&
          flatListDetails.length === 1 &&
          flatListDetails[0] === "없음"
        ? [`${items.find((item) => item.label?.trim())?.label?.trim()} 없음`]
        : flatListDetails;

  return (
    <>
      <section className="py-5">
        {!isApplicationGroup ? <h3 className="mb-3 text-[18px] font-bold leading-7 text-ink">{group.title}</h3> : null}
        {isApplicationGroup ? (
          isApplicationMethodOnly ? (
            <div className="space-y-3 text-[15px] leading-6 text-ink">
              {items.map((item, index) => (
                <div key={`application-method-${index}`} className="grid grid-cols-[150px_minmax(0,1fr)] gap-4">
                    <span className="font-bold text-ink">{item.label ?? "신청방법"}</span>
                  <p className="whitespace-pre-wrap break-keep">{formatApplicationDetail(item.detail ?? "")}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 text-[15px] leading-6 text-ink">
              {applicationPeriodItems.length ? (
                <h3 className="mb-3 text-[18px] font-bold leading-7 text-ink">신청기간</h3>
              ) : null}
              {hasApplicationPeriodPair || singleApplicationPeriodParts.length >= 2 ? (
                <div className="grid grid-cols-2 overflow-hidden border-b border-field-border">
                  {(hasApplicationPeriodPair ? applicationPeriodItems : [{ label: "신청시작" }, { label: "신청마감" }]).map((item, index) => (
                    <div key={`application-period-label-${index}`} className="border-b border-field-border bg-item-hover px-3 py-1 text-[13px] font-bold text-ink">
                      <span className="text-ink">{hasApplicationPeriodPair ? item.label : item.label}</span>
                    </div>
                  ))}
                  {(hasApplicationPeriodPair ? applicationPeriodItems : singleApplicationPeriodParts.slice(0, 2).map((detail) => ({ detail }))).map((item, index) => (
                    <div key={`application-period-value-${index}`} className="px-3 py-2 text-[15px] text-ink-muted">
                      <p className="whitespace-pre-wrap break-keep">{formatApplicationPeriodValue(item.detail ?? "", hasApplicationPeriodPair ? normalizeReportLabel(item.label).startsWith("신청마감") : index === 1)}</p>
                    </div>
                  ))}
                </div>
              ) : applicationPeriodItems.length ? (
                applicationPeriodItems.map((item, index) => (
                  <div key={`application-period-${index}`} className="grid grid-cols-[150px_minmax(0,1fr)] gap-4">
                    <span className="font-bold text-ink">{item.label ?? group.title}</span>
                    <p className="whitespace-pre-wrap break-keep">{formatApplicationDetail(item.detail ?? "")}</p>
                  </div>
                ))
              ) : null}
              {hasApplicationDetails ? (
                <h3 className={applicationPeriodItems.length ? "mb-3 pt-5 text-[18px] font-bold leading-7 text-ink" : "mb-3 text-[18px] font-bold leading-7 text-ink"}>{group.title}</h3>
              ) : null}
              {hasApplicationDetails ? <div className="space-y-3 border-y border-field-border py-4">
              {applicationMethodItems.length ? (
                <div className="space-y-3">
                  {applicationMethodItems.map((item, index) => (
                    <div key={`application-method-${index}`} className="grid grid-cols-[150px_minmax(0,1fr)] gap-4">
                      <span className="font-bold text-ink">{item.label ?? "신청방법"}</span>
                      <p className="whitespace-pre-wrap break-keep">{formatApplicationDetail(item.detail ?? "")}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {applicationOtherItems.map((item, index) => (
                  <div
                    key={`${item.label ?? group.title}-${index}`}
                    className="grid grid-cols-[150px_minmax(0,1fr)] gap-4"
                  >
                    <span className="font-bold text-ink">{item.label ?? group.title}</span>
                    <p className="whitespace-pre-wrap break-keep">{formatApplicationDetail(item.detail ?? "")}</p>
                  </div>
              ))}
              </div> : null}
            </div>
          )
        ) : isFlatList ? (
          group.key === "benefits" ? (
            <div className="space-y-2 text-[15px] leading-6 text-ink">
              {items.flatMap((item) => formatReportDetail(item.detail ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)).map((detail, index) =>
                detail.startsWith("◎") ? (
                  <ul key={`${group.title}-${index}`} className="list-disc pl-5 marker:text-ink"><li className="whitespace-pre-wrap break-keep">{detail.replace(/^◎\s*/, "")}</li></ul>
                ) : (
                  <p key={`${group.title}-${index}`} className="whitespace-pre-wrap break-keep">{detail}</p>
                ),
              )}
            </div>
          ) : (
            <ul className="list-disc space-y-2 pl-5 text-[15px] leading-6 text-ink marker:text-ink">
              {normalizedFlatListDetails.map((detail, index) => (
                <li key={`${group.title}-${index}`} className={`${detail.startsWith("※") ? "list-none -ml-5" : ""} whitespace-pre-wrap break-keep`}>{detail}</li>
              ))}
            </ul>
          )
        ) : isPreferenceGroup ? (
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-6 text-ink marker:text-ink">
            {items.map((item, index) => (
              <li key={`${group.title}-${index}`} className="whitespace-pre-wrap break-keep">
                {formatReportDetail(item.detail ?? "")}
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
                        <div key={`${itemGroup.label}-${itemIndex}`}>
                          <p className="whitespace-pre-wrap break-keep text-ink">
                            {formatMatchingConditionDetail(item.detail ?? "")}
                          </p>
                          <ReportItemChildren items={item.children ?? []} />
                        </div>
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
                    <ReportItemChildren items={item.children ?? []} />
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
            <ImportantDetail
              key={`important-${index}`}
              detail={item.detail ?? ""}
              label={item.label}
              structured
            />
          ))}
        </div>
      ) : null}
      {exclusionItems.length ? (
        <div className={participationItems.length ? "mt-5" : undefined}>
          <ul className="mb-2 list-disc pl-5 text-[15px] leading-6 text-ink marker:text-ink">
            <li>제외 조건</li>
          </ul>
          <div className="space-y-3 text-[15px] leading-6">
            {exclusionItems.map((item, index) => (
              <ImportantDetail key={`exclusion-${index}`} detail={item.detail ?? ""} marker="hyphen" />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ProgramReportDialog({ open, onOpenChange, noticeId, noticeTitle, scrollToChanges = false, supportOverride }: ProgramReportDialogProps) {
  const { session } = useAuth();
  const [report, setReport] = useState<NoticeReport | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [draggingAnalysisFile, setDraggingAnalysisFile] = useState(false);
  const [analysisFilePhase, setAnalysisFilePhase] = useState<"uploading" | "success" | "ready">("ready");
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<unknown>(null);
  const analysisGeneration = useRef(0);
  useEffect(() => {
    analysisGeneration.current += 1;
    setAnalysisResult(null);
    setAnalysisStatus("idle");
    setAnalysisMessage(null);
    setAnalysisFile(null);
    setAnalysisOpen(false);
    return () => { analysisGeneration.current += 1; };
  }, [noticeId, session?.user.id]);
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
    if (!noticeId || !session?.user.id) {
      setReport(null);
      setReportNoticeId(null);
      setLoading(false);
      setError(null);
      return;
    }
    const currentNoticeId = noticeId;
    const currentUserId = session.user.id;
    let cancelled = false;
    let requestInFlight = false;
    let noonTimer: number | null = null;

    async function loadReport(clearContent = false) {
      if (requestInFlight) return;
      requestInFlight = true;
      setLoading(true);
      setError(null);
      if (clearContent) {
        setReport(null);
        setReportNoticeId(null);
      }
      try {
        const isManual = currentNoticeId.startsWith("manual:");
        const reportId = isManual ? currentNoticeId.slice("manual:".length) : currentNoticeId;
        const { data, error: rpcError } = await supabase.functions.invoke("notice-report-display", {
          body: isManual ? { kind: "manual", manual_notice_id: reportId } : { kind: "notice", notice_id: reportId, ...(supportOverride ? {support_override: supportOverride} : {}) },
        });
        if (!cancelled && session?.user.id === currentUserId && noticeId === currentNoticeId) {
          if (rpcError) {
            console.error("[programs] 맞춤 리포트 조회 실패", rpcError);
            setError(`리포트를 불러오지 못했습니다: ${rpcError.message || "Edge Function 호출 실패"}`);
          } else {
            const nextReport = (data as NoticeReport | null) ?? null;
            if (nextReport && nextReport.view_version && nextReport.view_version !== "notice-view-2") {
              setError("최종 레포트 표시 함수를 배포해주세요.");
            } else {
              setReport(nextReport);
            }
            setReportNoticeId(currentNoticeId);
          }
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled && session?.user.id === currentUserId && noticeId === currentNoticeId) {
          console.error("[programs] 맞춤 리포트 조회 실패", loadError);
          setError("리포트를 불러오는 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
          setLoading(false);
        }
      } finally {
        requestInFlight = false;
      }
    }

    const scheduleNoonRefresh = () => {
      if (noonTimer !== null) window.clearTimeout(noonTimer);
      noonTimer = window.setTimeout(() => {
        if (!cancelled && document.visibilityState === "visible") void loadReport();
        scheduleNoonRefresh();
      }, millisecondsUntilKoreanNoon());
    };
    const refreshOnResume = () => {
      if (document.visibilityState === "visible") {
        void loadReport();
        scheduleNoonRefresh();
      }
    };

    void loadReport(true);
    scheduleNoonRefresh();
    window.addEventListener("focus", refreshOnResume);
    window.addEventListener("pageshow", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);

    return () => {
      cancelled = true;
      if (noonTimer !== null) window.clearTimeout(noonTimer);
      window.removeEventListener("focus", refreshOnResume);
      window.removeEventListener("pageshow", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [noticeId, open, session?.user.id, JSON.stringify(supportOverride ?? null)]);

  const currentReport = reportNoticeId === noticeId ? report : null;
  const displayNoticeTitle = noticeTitle?.trim() || currentReport?.notice?.title?.trim() || null;
  const noticeUrl = safeNoticeUrl(
    currentReport?.notice?.url ?? currentReport?.notice?.application_url,
  );
  const eligibility = currentReport?.plan_review_eligibility;
  const canAnalyzePlan =
    currentReport?.status === "ready" &&
    eligibility?.analysis_status === "completed" &&
    eligibility.is_current === true &&
    eligibility.business_plan_required === true;
  const planReviewDisabledReason = getPlanReviewDisabledReason(eligibility);

  const submitPlanReview = async () => {
    if (!analysisFile || !noticeUrl || analysisStatus === "loading") return;
    if (!/\.pdf$/i.test(analysisFile.name) || analysisFile.size < 1 || analysisFile.size > 30 * 1024 * 1024) {
      setAnalysisStatus("error");
      setAnalysisMessage("30MB 이하의 PDF 파일을 선택해주세요.");
      return;
    }
    setAnalysisStatus("loading");
    setAnalysisMessage(null);
    setAnalysisResult(null);
    const generation = analysisGeneration.current;
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (sessionError || !session) throw new Error("로그인 후 이용해주세요.");
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const invoke = async (body: Record<string, unknown>) => {
        const response = await supabase.functions.invoke("plan-review-api", { body, headers });
        if (generation !== analysisGeneration.current) throw new Error("평가 화면이 변경됐습니다.");
        return response;
      };
      const prepared = await invoke({ action: "prepare_upload", filename: analysisFile.name, size_bytes: analysisFile.size });
      if (prepared.error || !prepared.data?.document_id || prepared.data.bucket !== "business-plan-review-v1") {
        throw new Error(prepared.data?.message ?? "업로드 준비에 실패했어요.");
      }
      const upload = await supabase.storage.from(prepared.data.bucket).upload(prepared.data.object_path, analysisFile, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upload.error) throw new Error("사업계획서 업로드에 실패했어요.");
      const confirmed = await invoke({ action: "confirm_upload", document_id: prepared.data.document_id });
      if (confirmed.error || confirmed.data?.status !== "uploaded") throw new Error("파일 업로드 확인에 실패했어요.");
      const requested = await invoke({
        action: "request_review",
        document_id: prepared.data.document_id,
        notice_url: noticeUrl,
        client_request_id: crypto.randomUUID(),
      });
      if (requested.error || !requested.data?.job_id) throw new Error(requested.data?.message ?? "평가 요청에 실패했어요.");
      setAnalysisMessage("평가 요청이 접수됐어요. 결과를 준비하고 있습니다.");
      const terminalStatuses = new Set(["completed", "failed", "submission_blocked", "needs_input", "cancelled"]);
      for (let attempt = 0; attempt < 150; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 4000));
        const review = await invoke({ action: "get_review", job_id: requested.data.job_id });
        if (review.error || !review.data?.status) throw new Error(review.data?.message ?? "평가 상태를 확인하지 못했어요.");
        if (terminalStatuses.has(review.data.status)) {
          setAnalysisResult(review.data);
          setAnalysisOpen(true);
          setAnalysisStatus(review.data.status === "completed" ? "done" : "error");
          setAnalysisMessage(
            review.data.status === "completed"
              ? "평가가 완료됐어요. 점수와 보완할 사항을 확인해보세요."
              : review.data?.error?.message ?? "평가를 완료하지 못했어요.",
          );
          return;
        }
      }
      setAnalysisStatus("error");
      setAnalysisMessage("평가가 오래 걸리고 있어요. 나중에 다시 상태를 확인해주세요.");
    } catch (error) {
      if (generation !== analysisGeneration.current) return;
      setAnalysisStatus("error");
      setAnalysisMessage(error instanceof Error ? error.message : "평가 요청에 실패했어요.");
    }
  };

  const groups = useMemo<ReportGroup[]>(() => {
    if (currentReport?.report_display?.sections?.length) {
      const displaySections = currentReport.report_display.sections;
      const hasDisplayedDocuments = displaySections.some((section) =>
        normalizeReportLabel(section.label).replace(/\s+/g, "") === "제출서류",
      );
      const legacyDocuments = currentReport.report?.sections?.documents;
      const fallbackDocuments = !hasDisplayedDocuments && legacyDocuments
        ? [{ label: "제출서류", children: [] as StructuredNode[] }, ...displaySections]
        : displaySections;
      return fallbackDocuments.map((section, index) => ({
        title: section.label ?? `리포트 ${index + 1}`,
        key: section.label === "맞춤 조건"
          ? "matching_conditions"
          : ["신청방법", "신청방법및기간", "신청방법및일정", "신청기간"].includes((section.label ?? "").replace(/\s+/g, ""))
            ? "application"
          : ["의무및확인사항", "중요확인사항", "의무사항"].includes((section.label ?? "").replace(/\s+/g, ""))
            ? "obligations"
          : Object.entries(sectionLabels).find(([, label]) => label.replace(/\s+/g, "") === (section.label ?? "").replace(/\s+/g, ""))?.[0] ?? `structured-${index}`,
        section: {
          items: section.children.map((child) => ({
            label: child.label,
            detail: child.value,
            children: child.children.map(structuredNodeToReportItem),
          })),
        },
      })).map((group) => group.title === "제출서류" && !hasDisplayedDocuments && legacyDocuments
        ? { ...group, section: legacyDocuments }
        : group);
    }
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

  const reportContentKey = loading
    ? "loading"
    : error
      ? "error"
      : currentReport?.status === "ready"
        ? "ready"
        : `unavailable-${currentReport?.status ?? "unknown"}`;

  useLayoutEffect(() => {
    if (!open || analysisOpen) return;

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
  }, [analysisOpen, open, reportContentKey]);

  useEffect(() => {
    if (!open || !scrollToChanges || loading || !currentReport) return;
    const frame = window.requestAnimationFrame(() => {
      dialogBodyRef.current?.scrollTo({ top: dialogBodyRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentReport, loading, open, scrollToChanges]);

  return (
    <>
    <Dialog open={open && !analysisOpen} onOpenChange={onOpenChange}>
      <DialogContent
        closeClassName="right-8 top-8 flex size-9 items-center justify-center rounded-lg opacity-100 text-ink-muted hover:bg-item-hover hover:text-ink focus:outline-none focus:ring-0 focus:ring-offset-0 [&>svg]:size-6"
        className="flex min-h-[420px] max-h-[calc(100vh-48px)] w-[800px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[20px] border-0 bg-surface p-0 transition-[height] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={dialogHeight ? { height: `${dialogHeight}px` } : undefined}
      >
        <div ref={dialogHeaderRef} className="shrink-0">
          <DialogHeader className="px-8 pb-3 pt-8 pr-16 text-left">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-[24px] font-bold leading-10 text-ink">리포트</DialogTitle>
              <span
                title={canAnalyzePlan ? undefined : planReviewDisabledReason}
                className="group relative inline-flex"
              >
                <button
                  type="button"
                  disabled={!canAnalyzePlan}
                  aria-label={canAnalyzePlan ? "사업 계획서 적합도 분석" : planReviewDisabledReason}
                  onClick={() => {
                    if (!canAnalyzePlan) return;
                    setAnalysisFile(null);
                    setAnalysisFilePhase("ready");
                    setAnalysisOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-[8px] border-[1.5px] border-transparent pl-[9px] pr-[12px] py-[7px] text-xs font-semibold transition-colors hover:[--report-button-surface-start:#faf7ff] hover:[--report-button-surface-end:#faf7ff] disabled:cursor-not-allowed disabled:border-field-border disabled:bg-transparent disabled:text-content-disabled disabled:[background-image:none]"
                  style={{
                    backgroundImage: canAnalyzePlan
                      ? "linear-gradient(var(--report-button-surface-start, #fff), var(--report-button-surface-end, #fff)), linear-gradient(139.3deg, #638aff 2.65%, #9e53ff 101.62%)"
                      : undefined,
                    backgroundOrigin: "border-box",
                    backgroundClip: "padding-box, border-box",
                  }}
                >
                {canAnalyzePlan ? (
                  <img src="/assets/ai.svg?v=2" alt="" className="size-4" aria-hidden="true" />
                ) : (
                  <span
                    className="size-4 bg-content-disabled"
                    style={{
                      maskImage: "url('/assets/ai.svg?v=2')",
                      WebkitMaskImage: "url('/assets/ai.svg?v=2')",
                      maskRepeat: "no-repeat",
                      WebkitMaskRepeat: "no-repeat",
                      maskPosition: "center",
                      WebkitMaskPosition: "center",
                      maskSize: "contain",
                      WebkitMaskSize: "contain",
                    }}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={canAnalyzePlan ? "text-transparent" : "text-content-disabled"}
                  style={{
                    backgroundImage: canAnalyzePlan ? "linear-gradient(139.3deg, #638aff 2.65%, #9e53ff 101.62%)" : undefined,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                  }}
                >
                  사업 계획서 적합도 분석
                </span>
                </button>
              </span>
            </div>
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
              <div className="flex min-h-[180px] items-center justify-center py-16 text-[16px] text-ink-muted" role="status">
                <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
                <>리포트를 불러오는 중이에요<LoadingDots /></>
              </div>
            ) : error ? (
              <AsyncErrorState message={error} onRetry={() => window.location.reload()} />
            ) : currentReport?.status !== "ready" ? (
              <div className="px-6 py-16 text-center">
                <p className="text-[18px] font-semibold text-ink">아직 리포트가 없어요</p>
                <p className="mt-[2px] text-[15px] text-ink-muted">리포트가 준비되는 대로 이곳에 표시돼요.</p>
              </div>
            ) : (
              <>
                {groups.map((group) =>
                  group.key === "obligations" ? <ObligationsGroupView key={group.title} section={group.section} /> : <ReportGroupView key={group.title} group={group} />,
                )}
                <ChangeHistoryView
                  history={
                    currentReport?.change_history ??
                    (currentReport?.change_display ?? []).map((event) => ({
                      recorded_at: event.recorded_at,
                      changed_fields: (event.changes ?? []).map((change) => ({
                        field: change.label,
                        old_value: change.before,
                        new_value: change.after,
                      })),
                    }))
                  }
                />
              </>
            )}
          </div>
        </div>
      </DialogContent>
      </Dialog>

    <Dialog
      open={analysisOpen}
      onOpenChange={(nextOpen) => {
        setAnalysisOpen(nextOpen);
        if (!nextOpen) setDialogHeight(null);
      }}
    >
      <DialogContent
        closeClassName="right-5 top-5 flex size-9 items-center justify-center rounded-lg text-ink-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink hover:opacity-100 focus:outline-none focus:ring-0 focus:ring-offset-0 [&_svg]:size-6"
        className="w-[760px] max-w-[calc(100vw-40px)] max-h-[calc(100dvh-48px)] overflow-y-auto gap-0 rounded-[20px] border-0 bg-surface p-6 sm:p-8"
      >
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-[20px] font-bold leading-7 text-ink">{analysisResult ? "사업계획서 분석 결과" : "사업 계획서 적합도 분석"}</DialogTitle>
          {analysisResult ? <p className="pr-8 text-sm text-ink-muted">{displayNoticeTitle}</p> : null}
          {!analysisResult && (
          <div className="flex h-11 min-w-0 w-full max-w-full items-center gap-1 overflow-hidden rounded-[12px] bg-item-hover px-3 py-2 text-left text-[14px] font-medium leading-5 text-ink-muted">
            <SquareAlertIcon className="size-4 shrink-0 text-icon-muted" aria-hidden="true" />
            <span>사업계획서 제출이 필요한 공고만 분석할 수 있어요.</span>
          </div>
          )}
        </DialogHeader>
        {analysisResult ? <>
          <PlanReviewResultView review={analysisResult} />
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="rounded-xl border border-field-border px-4 py-3 text-sm font-semibold" onClick={() => {
              setAnalysisResult(null); setAnalysisMessage(null); setAnalysisStatus("idle"); setAnalysisFile(null);
            }}>다른 PDF로 분석</button>
            <button type="button" className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground" onClick={() => setAnalysisOpen(false)}>닫기</button>
          </div>
        </> : (
        <section className="mt-6" aria-labelledby="plan-review-upload-title">
          <div>
            <h3 id="plan-review-upload-title" className="text-[16px] font-semibold text-ink">파일 업로드</h3>
            <ul className="mt-2 space-y-1 text-[14px] leading-5 text-ink-muted">
              <li>• 공고의 요구 항목을 작성한 사업계획서를 올려주세요. 자율 양식 공고는 자유롭게 작성한 PDF도 가능합니다.</li>
              <li>• PDF 형식의 사업계획서만 등록할 수 있으며, 파일 1개당 크기는 30MB를 초과할 수 없습니다.</li>
            </ul>
          </div>
          <label
            className={cn("relative mt-4 flex min-h-[142px] cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed border-field-border bg-surface px-5 py-6 text-center transition-colors hover:border-brand focus-within:border-brand focus-within:ring-[3.2px] focus-within:ring-focus-soft", draggingAnalysisFile && "border-brand bg-item-hover-selected")}
            onDragOver={(event) => { event.preventDefault(); if (analysisStatus !== "loading") setDraggingAnalysisFile(true); }}
            onDragLeave={() => setDraggingAnalysisFile(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDraggingAnalysisFile(false);
              if (analysisStatus === "loading") return;
              const dropped = event.dataTransfer.files?.[0] ?? null;
              if (dropped && (!/\.pdf$/i.test(dropped.name) || dropped.size > 30 * 1024 * 1024)) {
                setAnalysisFile(null);
                setAnalysisStatus("error");
                setAnalysisMessage("30MB 이하의 PDF 파일을 선택해주세요.");
                return;
              }
              setAnalysisFile(dropped);
              setAnalysisFilePhase(dropped ? "uploading" : "ready");
              setAnalysisStatus("idle");
              setAnalysisMessage(null);
              if (dropped) {
                window.setTimeout(() => setAnalysisFilePhase("success"), 350);
                window.setTimeout(() => setAnalysisFilePhase("ready"), 850);
              }
            }}
          >
            <p className="text-[14px] text-ink-muted">{draggingAnalysisFile ? "여기에 PDF 파일을 놓아주세요." : "파일을 여기에 끌어다 놓거나, 파일 선택 버튼을 눌러주세요."}</p>
            <span className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-secondary-btn px-4 text-[14px] font-semibold text-secondary-btn-text">
              <Upload className="size-4" aria-hidden="true" />
              파일 선택
            </span>
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            disabled={analysisStatus === "loading"}
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              if (selected && (!/\.pdf$/i.test(selected.name) || selected.size > 30 * 1024 * 1024)) {
                setAnalysisFile(null);
                setAnalysisStatus("error");
                setAnalysisMessage("30MB 이하의 PDF 파일을 선택해주세요.");
                return;
              }
              setAnalysisFile(selected);
              setAnalysisFilePhase(selected ? "uploading" : "ready");
              setAnalysisStatus("idle");
              setAnalysisMessage(null);
              event.currentTarget.value = "";
              if (selected) {
                window.setTimeout(() => setAnalysisFilePhase("success"), 350);
                window.setTimeout(() => setAnalysisFilePhase("ready"), 850);
              }
            }}
          />
          </label>
        <div className="mt-3 flex items-center justify-between text-[14px] font-semibold text-ink-muted">
          <span>
            <strong className="font-semibold text-brand">{analysisFile ? 1 : 0}개</strong> / 1개
          </span>
        </div>
        {analysisFile ? (
          <div className="mt-2 flex w-full items-center gap-3 rounded-[10px] border border-field-border bg-surface px-3 py-2.5">
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-medium text-ink">{analysisFile.name}</p>
                <p className="mt-0.5 text-[12px] text-ink-muted">PDF · {(analysisFile.size / (1024 * 1024)).toFixed(1)}MB</p>
              </div>
              {analysisFilePhase === "uploading" ? (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#F1F3F2]" aria-label="파일 확인 중">
                  <Loader2 className="size-3.5 animate-spin text-[#2F80ED]" aria-hidden="true" />
                </span>
              ) : analysisFilePhase === "success" ? (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#F2F7F4] text-brand" aria-label="파일 추가 완료">
                  <Check className="size-3.5 animate-upload-status-pop-in stroke-[3]" aria-hidden="true" />
                </span>
              ) : (
                <button
                  type="button"
                  aria-label="선택한 파일 삭제"
                  disabled={analysisStatus === "loading"}
                  onClick={() => { setAnalysisFile(null); setAnalysisFilePhase("ready"); }}
                  className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E5E8E7] text-[#25332E] opacity-70 transition-[background-color,opacity] hover:bg-[#D9DEDC] hover:opacity-100"
                >
                  <span className="absolute inset-0 flex items-center justify-center animate-upload-status-pop-out"><Check className="size-3.5 stroke-[3]" aria-hidden="true" /></span>
                  <span className="absolute inset-0 flex items-center justify-center animate-upload-status-x-in"><X className="size-3.5 stroke-[2.5]" aria-hidden="true" /></span>
                </button>
              )}
          </div>
        ) : null}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={!analysisFile || analysisStatus === "loading"}
            onClick={() => void submitPlanReview()}
            className="h-11 rounded-[10px] bg-brand px-5 text-[15px] font-semibold text-brand-foreground transition-colors disabled:cursor-not-allowed disabled:bg-brand-disabled"
          >
            {analysisStatus === "loading" ? (
              <span className="inline-flex items-center">
                분석 요청 중
                <LoadingDots />
              </span>
            ) : "분석하기"}
          </button>
        </div>
        {analysisMessage ? (
          <p className={`mt-3 text-[13px] ${analysisStatus === "error" ? "text-destructive" : "text-brand"}`} role="status">
            {analysisMessage}
          </p>
        ) : null}
        </section>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

