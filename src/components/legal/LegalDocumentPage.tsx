type LegalDocumentKind = "terms" | "privacy";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "제1조 (목적)",
    paragraphs: [
      "본 약관은 SSIAT(이하 “회사”)이 제공하는 SSIAT 서비스의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 정하는 것을 목적으로 합니다.",
    ],
  },
  {
    title: "제2조 (서비스 내용)",
    paragraphs: [
      "회사는 창업·지원사업 공고의 조회, 관심 공고 저장, 일정 관리, 알림 및 사용자가 직접 작성한 할 일 관리 기능을 제공합니다.",
    ],
  },
  {
    title: "제3조 (회원가입 및 계정 관리)",
    paragraphs: [
      "이용자는 정확한 정보를 바탕으로 서비스를 이용해야 하며, 본인의 계정 정보를 안전하게 관리해야 합니다. 타인의 정보를 도용하거나 서비스 운영을 방해하는 행위는 금지됩니다.",
    ],
  },
  {
    title: "제4조 (이용자의 의무)",
    paragraphs: [
      "이용자는 법령 또는 본 약관에 위반되는 행위, 타인의 권리 침해, 서비스의 비정상적 이용, 자동화 수단을 통한 과도한 요청을 해서는 안 됩니다.",
    ],
  },
  {
    title: "제5조 (서비스 변경 및 중단)",
    paragraphs: [
      "회사는 기능 개선, 시스템 점검 또는 불가피한 사유로 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다. 중요한 변경 사항은 서비스 내 공지로 안내합니다.",
    ],
  },
  {
    title: "제6조 (면책)",
    paragraphs: [
      "회사는 공고 정보의 정확성·완전성·최신성을 위해 노력하나, 각 지원사업의 최종 내용은 공고를 게시한 기관의 원문을 기준으로 합니다. 이용자는 신청 전 원문 공고와 주관기관 안내를 확인해야 합니다.",
    ],
  },
  {
    title: "제7조 (약관의 변경)",
    paragraphs: [
      "회사는 필요한 경우 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 내용과 시행일을 서비스 내에 공지합니다.",
    ],
  },
  {
    title: "부칙",
    paragraphs: ["본 약관은 2026년 11월 01일부터 시행합니다."],
  },
];

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "1. 수집하는 개인정보 항목",
    paragraphs: ["회사는 서비스 제공을 위해 다음 정보를 처리합니다."],
    bullets: [
      "회원 식별: 이메일, 사용자 식별자",
      "서비스 이용: 관심 공고, 캘린더 일정, 직접 작성한 할 일, 알림 설정 및 읽음 여부",
      "자동 수집 정보: 접속기록, 서비스 이용기록, 쿠키 정보",
      "문의 처리: 문의 내용 및 회신을 위한 연락처",
    ],
  },
  {
    title: "2. 개인정보의 처리 목적",
    paragraphs: ["회사는 다음 목적을 위해 개인정보를 처리합니다."],
    bullets: [
      "회원 식별 및 로그인 기능 제공",
      "관심 공고·캘린더·알림 등 개인화 기능 제공",
      "서비스 개선, 오류 확인 및 부정 이용 방지",
      "문의 응대 및 고지사항 전달",
    ],
  },
  {
    title: "3. 보유 및 이용 기간",
    paragraphs: [
      "개인정보는 회원 탈퇴 또는 처리 목적 달성 시까지 보유합니다. 다만 관계 법령에 따라 보존이 필요한 경우에는 해당 기간 동안 보관합니다.",
    ],
  },
  {
    title: "4. 제3자 제공",
    paragraphs: [
      "회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 이용자의 별도 동의가 있거나 법령에 근거가 있는 경우에는 예외로 합니다.",
    ],
  },
  {
    title: "5. 처리업무의 위탁",
    paragraphs: [
      "회사는 서비스 운영을 위해 다음 사업자에게 개인정보 처리업무를 위탁할 수 있습니다.",
    ],
    bullets: [
      "Supabase: 인증 및 데이터베이스 운영",
      "n8n: 자동화 및 알림 워크플로우 처리",
      "Vercel: 웹 서비스 호스팅",
    ],
  },
  {
    title: "6. 이용자의 권리",
    paragraphs: [
      "이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제 및 처리정지를 요청할 수 있습니다. 요청은 아래 문의처로 접수할 수 있습니다.",
    ],
  },
  {
    title: "7. 개인정보 보호책임자 및 문의처",
    paragraphs: ["운영자: SSIAT"],
  },
  {
    title: "8. 처리방침 변경",
    paragraphs: [
      "본 방침은 2026년 11월 01일부터 시행합니다. 변경 사항은 서비스 내 공지를 통해 안내합니다.",
    ],
  },
];

const DOCUMENTS: Record<LegalDocumentKind, { title: string; sections: LegalSection[] }> = {
  terms: { title: "이용약관", sections: TERMS_SECTIONS },
  privacy: { title: "개인정보 처리방침", sections: PRIVACY_SECTIONS },
};

export function LegalDocumentContent({
  kind,
  compactTitle = false,
}: {
  kind: LegalDocumentKind;
  compactTitle?: boolean;
}) {
  const document = DOCUMENTS[kind];

  return (
    <>
      <div
        className={`relative flex items-center justify-between ${compactTitle ? "" : "border-b border-field-border pb-5"}`}
      >
        <div>
          <h1
            className={`font-bold tracking-tight text-ink ${compactTitle ? "text-[24px] leading-10" : "text-[30px]"}`}
          >
            {document.title}
          </h1>
          <p className="mt-2 text-[14px] text-ink-muted">시행일: 2026년 11월 01일</p>
        </div>
      </div>

      <div className="mt-8 space-y-8 text-[15px] leading-7 text-ink">
        {kind === "privacy" ? (
          <p className="text-[17px] leading-8">
            SSIAT(이하 “회사”)은 이용자의 개인정보를 중요하게 생각하며, 관련 법령에 따라 개인정보를
            보호합니다.
          </p>
        ) : null}

        {document.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-[18px] font-bold leading-7 text-ink">{section.title}</h2>
            <div className="mt-2 space-y-2 text-ink-muted">
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul className="list-disc space-y-1 pl-6">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}

        <p className="border-t border-field-border pt-6 text-[14px] text-ink-muted">
          운영자: SSIAT · 문의:{" "}
          <a className="text-brand underline underline-offset-2" href="mailto:ann690437@gmail.com">
            ann690437@gmail.com
          </a>
        </p>
      </div>
    </>
  );
}

export function LegalDocumentPage({ kind }: { kind: LegalDocumentKind }) {
  return (
    <main className="mx-auto w-full max-w-[900px] px-8 pb-16 pt-10">
      <LegalDocumentContent kind={kind} />
    </main>
  );
}
