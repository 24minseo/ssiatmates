export const STARTUP_STAGES = [
  "예비창업자",
  "1년 미만",
  "1년 이상 ~ 3년 미만",
  "3년 이상 ~ 7년 미만",
  "7년 이상",
] as const;

export const PRE_FOUNDER = STARTUP_STAGES[0];

export const BUSINESS_FIELDS = [
  "AI·데이터",
  "SW·ICT",
  "반도체·전자",
  "로봇·스마트제조",
  "바이오·헬스케어",
  "모빌리티·항공",
  "에너지·환경",
  "제조·소재",
  "식품·농업",
  "콘텐츠·문화",
  "패션·뷰티",
  "관광·서비스",
  "기타",
] as const;

export const SUPPORT_ALL = "전체";

export const SUPPORT_CATEGORIES = [
  SUPPORT_ALL,
  "사업화",
  "기술개발(R&D)",
  "시설·공간·보육",
  "교육·멘토링·컨설팅",
  "판로",
  "글로벌",
  "인력",
  "융자·보증·정책자금",
  "행사·네트워크",
] as const;

export interface OnboardingState {
  birthDate: string;
  startupStage: string | null;
  residence: string | null;
  businessLocation: string | null;
  sameAsResidence: boolean;
  businessFields: string[];
  supportCategories: string[];
}

export const initialOnboardingState: OnboardingState = {
  birthDate: "",
  startupStage: null,
  residence: null,
  businessLocation: null,
  sameAsResidence: false,
  businessFields: [],
  supportCategories: [SUPPORT_ALL],
};

/** 숫자만 남기고 YYYY.MM.DD 형식으로 포맷 */
export function formatBirthDate(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(
    (part) => part.length > 0,
  );
  return parts.join(".");
}

/** 8자리 완성 시에만 실제 존재하는 과거 날짜인지 검증 */
export function validateBirthDate(formatted: string): {
  complete: boolean;
  valid: boolean;
  error: string | null;
} {
  const digits = formatted.replace(/\D/g, "");
  if (digits.length < 8) return { complete: false, valid: false, error: null };

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(year, month - 1, day);
  const realDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!realDate) {
    return { complete: true, valid: false, error: "존재하지 않는 날짜입니다." };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) {
    return { complete: true, valid: false, error: "미래 날짜는 입력할 수 없습니다." };
  }

  const earliestBirthDate = new Date(today);
  earliestBirthDate.setFullYear(today.getFullYear() - 120);
  if (date.getTime() < earliestBirthDate.getTime()) {
    return {
      complete: true,
      valid: false,
      error: "생년월일은 만 120세 이내로 입력해주세요.",
    };
  }

  return { complete: true, valid: true, error: null };
}
