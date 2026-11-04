import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AsyncErrorState } from "@/components/AsyncErrorState";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
      <h3 className="mb-3 text-[18px] font-bold leading-7 text-ink">변경 내역</h3>
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
                <div className="grid grid-cols-2 overflow-hidden border-y border-field-border">
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
              {applicationPeriodItems.length ? (
                <h3 className="mb-3 pt-5 text-[18px] font-bold leading-7 text-ink">{group.title}</h3>
              ) : <h3 className="mb-3 text-[18px] font-bold leading-7 text-ink">{group.title}</h3>}
              <div className="space-y-3 border-y border-field-border py-4">
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
              </div>
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

export function ProgramReportDialog({ open, onOpenChange, noticeId, noticeTitle, scrollToChanges = false }: ProgramReportDialogProps) {
  const { session } = useAuth();
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
          body: isManual ? { kind: "manual", manual_notice_id: reportId } : { kind: "notice", notice_id: reportId },
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
  }, [noticeId, open, session?.user.id]);

  const currentReport = reportNoticeId === noticeId ? report : null;
  const displayNoticeTitle = noticeTitle?.trim() || currentReport?.notice?.title?.trim() || null;
  const noticeUrl = safeNoticeUrl(
    currentReport?.notice?.url ?? currentReport?.notice?.application_url,
  );

  const groups = useMemo<ReportGroup[]>(() => {
    if (currentReport?.report_display?.sections?.length) {
      return currentReport.report_display.sections.map((section, index) => ({
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
      }));
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

  useEffect(() => {
    if (!open || !scrollToChanges || loading || !currentReport) return;
    const frame = window.requestAnimationFrame(() => {
      dialogBodyRef.current?.scrollTo({ top: dialogBodyRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentReport, loading, open, scrollToChanges]);

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
              <div className="flex min-h-[180px] items-center justify-center py-16 text-[15px] text-ink-muted" role="status">
                <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
                리포트를 불러오는 중이에요…
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
  );
}
