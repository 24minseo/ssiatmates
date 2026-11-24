export function formatDeadline(deadline: string | null): string {
  if (!deadline) return "";
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? `${deadline}T00:00:00+09:00` : deadline,
  );
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday =
    { Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토" }[
      value("weekday")
    ] ?? "";
  return `~${value("month")}.${value("day")}(${weekday})`;
}

export function getProgramDeadlineDisplay(deadline: string | null, label?: string | null) {
  const rawLabel = label?.trim() ?? "";
  return {
    dDay:
      rawLabel && rawLabel !== "공고 원문 확인" && rawLabel !== "일정 확인 필요" ? rawLabel : "-",
    deadline: formatDeadline(deadline) || "공고 원문 확인",
  };
}
