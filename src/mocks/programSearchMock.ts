export type ProgramSearchItem = {
  id: string;
  organization: string;
  title: string;
  categories: string[];
  dDay: string;
  deadline: string;
  matchLabel?: string;
  recommended?: boolean;
};

export const programSearchMock: ProgramSearchItem[] = [
  { id: "p-1", organization: "서울핀테크랩", title: "[제2서울핀테크랩] 서울 핀테크 위크 2026 데모데이 with 네이버클라우드", categories: ["판로·마케팅", "초기창업", "서울"], dDay: "D-12", deadline: "~09.03(목)", matchLabel: "리포트 보기 〉", recommended: true },
  { id: "p-2", organization: "창업진흥원", title: "2026년 초기창업패키지 예비창업자 모집 공고", categories: ["사업화", "예비창업", "전국"], dDay: "D-18", deadline: "~09.09(수)", matchLabel: "리포트 보기 〉" },
  { id: "p-3", organization: "중소벤처기업진흥공단", title: "청년창업사관학교 15기 입교생 모집", categories: ["사업화", "초기창업", "경기"], dDay: "D-24", deadline: "~09.15(화)", matchLabel: "리포트 보기 〉" },
  { id: "p-4", organization: "서울특별시", title: "소상공인 온라인 판로 지원사업", categories: ["판로·마케팅", "소상공인", "서울"], dDay: "D-31", deadline: "~09.22(화)", matchLabel: "리포트 보기 〉" },
];
