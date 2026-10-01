export type MatchedProgram = {
  id: string;
  is_saved?: boolean;
  url?: string;
  organization: string;
  title: string;
  categories: string[];
  dDay: string;
  deadline: string;
  daysUntilDeadline?: number | null;
  matchLabel?: string;
  type: "default" | "recommended";
};

export type MatchedProgramResults = {
  recommended: MatchedProgram[];
  review: MatchedProgram[];
};

export const matchedProgramResults: MatchedProgram[] = [
  { id: "p-1", organization: "서울핀테크랩", title: "[제2서울핀테크랩] 서울 핀테크 위크 2026 데모데이 및 글로벌 기술창업 지원 연계 프로그램 참가기업 모집과 사업화 후속 지원 대상자 선정 공고", categories: ["판로·마케팅", "초기창업", "서울"], dDay: "D-12", deadline: "~09.03(목)", matchLabel: "리포트 보기 〉", type: "recommended" },
  { id: "p-2", organization: "창업진흥원", title: "2026년 초기창업패키지 예비창업자 모집 공고", categories: ["사업화", "예비창업", "전국"], dDay: "D-18", deadline: "~09.09(수)", matchLabel: "리포트 보기 〉", type: "default" },
  { id: "p-3", organization: "중소벤처기업진흥공단", title: "청년창업사관학교 15기 입교생 모집", categories: ["사업화", "초기창업", "경기"], dDay: "D-24", deadline: "~09.15(화)", matchLabel: "리포트 보기 〉", type: "default" },
  { id: "p-4", organization: "서울특별시", title: "소상공인 온라인 판로 지원사업", categories: ["판로·마케팅", "소상공인", "서울"], dDay: "D-31", deadline: "~09.22(화)", matchLabel: "리포트 보기 〉", type: "default" },
  { id: "p-5", organization: "경기창업혁신센터", title: "2026 경기 스타트업 액셀러레이팅 프로그램", categories: ["멘토링·교육", "창업"], dDay: "D-38", deadline: "~09.29(화)", matchLabel: "리포트 보기 〉", type: "recommended" },
  { id: "p-6", organization: "한국콘텐츠진흥원", title: "콘텐츠 초기기업 제작지원 참가기업 모집", categories: ["콘텐츠·문화", "사업화", "전국"], dDay: "D-45", deadline: "~10.06(화)", matchLabel: "리포트 보기 〉", type: "default" },
  { id: "p-7", organization: "서울산업진흥원", title: "서울형 R&D 기술사업화 지원 공고", categories: ["기술개발(R&D)", "서울"], dDay: "D-52", deadline: "~10.13(화)", matchLabel: "리포트 보기 〉", type: "recommended" },
  { id: "p-8", organization: "한국무역협회", title: "창업기업 해외진출·수출바우처 지원사업", categories: ["글로벌·수출", "사업화", "전국"], dDay: "D-60", deadline: "~10.21(수)", matchLabel: "리포트 보기 〉", type: "default" },
  { id: "p-9", organization: "농림축산식품부", title: "청년 농식품 창업기업 사업화 지원", categories: ["식품·농업", "청년창업"], dDay: "D-67", deadline: "~10.28(수)", matchLabel: "리포트 보기 〉", type: "default" },
  { id: "p-10", organization: "인천테크노파크", title: "인천 로봇·스마트제조 실증 지원사업", categories: ["로봇·스마트제조", "인천"], dDay: "D-74", deadline: "~11.04(수)", matchLabel: "리포트 보기 〉", type: "recommended" },
  { id: "p-11", organization: "부산창조경제혁신센터", title: "지역혁신 스타트업 보육·공간 지원", categories: ["시설·공간·보육", "부산"], dDay: "D-81", deadline: "~11.11(수)", matchLabel: "리포트 보기 〉", type: "default" },
  { id: "p-12", organization: "중소벤처기업부", title: "소상공인 디지털 전환 바우처 모집", categories: ["내수", "경영", "전국"], dDay: "D-90", deadline: "~11.20(금)", matchLabel: "리포트 보기 〉", type: "default" },
];

/** Mirrors the backend response shape. Replace each collection with its API result when connected. */
export const matchedProgramResultsByTab: MatchedProgramResults = {
  recommended: matchedProgramResults,
  review: [],
};
