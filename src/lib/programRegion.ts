const NATIONWIDE_REGIONS = new Set([
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
]);

export function formatProgramRegion(region: string | null | undefined) {
  if (!region?.trim()) return null;

  const regions = region
    .split(",")
    .map((value) => value.trim())
    .flatMap((value) => (value === "전남광주" ? ["전남", "광주"] : [value]));
  const uniqueRegions = new Set(regions);

  return uniqueRegions.size === NATIONWIDE_REGIONS.size &&
    [...NATIONWIDE_REGIONS].every((value) => uniqueRegions.has(value))
    ? "전국"
    : region.trim();
}
