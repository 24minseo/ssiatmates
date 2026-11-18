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
    "title": "1. 개인정보의 처리 목적 및 항목",
    "paragraphs": [
      "회사는 다음 목적을 위해 개인정보를 처리합니다.",
      "사업계획서 분석 및 IR Deck 생성 기능을 이용하지 않는 경우 해당 기능을 위한 파일은 수집하지 않습니다."
    ],
    "bullets": [
      "회원 관리 — 목적: 회원 식별, 로그인 및 계정 관리 / 항목: 이메일, 사용자 식별자",
      "맞춤형 서비스 제공 — 목적: 지원사업 매칭, 공고·일정·할 일 관리 및 알림 제공 / 항목: 사업 정보, 창업 여부 및 업력, 지역, 사업 분야, 관심 지원 분야, 관심 공고, 수동 등록 공고, 캘린더 일정, 할 일, 알림 설정 및 읽음 여부",
      "사업계획서 분석 및 IR Deck 생성 — 목적: 사업계획서의 양식·작성 여부 확인, 완성도·공고 적합도 분석, IR Deck 생성 및 결과 제공 / 항목: 업로드 파일과 파일명, 입력·추출 본문, 분석·생성 결과, 사용자 식별정보 및 처리 기록",
      "서비스 운영 및 문의 처리 — 목적: 오류 확인, 부정 이용 방지, 서비스 개선 및 문의 응대 / 항목: 접속기록, 서비스 이용기록, 쿠키 정보, 문의 내용 및 회신 연락처"
    ]
  },
  {
    "title": "2. 개인정보의 보유 및 이용 기간",
    "paragraphs": [
      "회사는 개인정보를 회원 탈퇴 또는 처리 목적 달성 시까지 보유·이용합니다. 사업계획서 파일, 추출 본문, 분석 결과 및 생성된 IR Deck에도 동일한 기준을 적용합니다.",
      "이용자가 삭제를 요청한 경우에는 관련 법령에 따라 처리합니다. 다만 법령에 따른 보존 의무가 있는 정보는 해당 기간 동안 보관합니다.",
      "외부 서비스의 실행 기록, 백업 및 전송 데이터에는 해당 서비스의 보유·삭제 기준이 별도로 적용됩니다."
    ]
  },
  {
    "title": "3. 사업계획서의 이용 및 보호",
    "paragraphs": [
      "회사는 사업계획서를 분석·생성 서비스 제공, 결과 보관 및 오류 처리 목적으로 이용하며, 자체 AI 학습, 광고 또는 판매 목적으로 이용하지 않습니다.",
      "사업계획서 파일은 비공개 저장소에 보관하며 다른 일반 이용자에게 공개하지 않습니다. 서비스 제공에 필요한 시스템 및 담당자의 접근권한을 제한합니다.",
      "사업계획서 분석 과정에서 연락처 등 일부 개인정보를 마스킹합니다. 다만 기술 내용, 사업 전략 및 문서에 포함된 모든 개인정보가 제거되는 것은 아닙니다."
    ]
  },
  {
    "title": "4. 개인정보의 제3자 제공",
    "paragraphs": [
      "회사는 관련 법령에 근거가 있거나 이용자의 별도 동의를 받은 경우 개인정보를 제3자에게 제공합니다.",
      "회사는 이용자의 사업계획서를 다른 일반 이용자에게 공개하거나 판매하지 않습니다. 서비스 제공을 위한 외부 처리에 관한 사항은 제5항 및 제6항에 따릅니다."
    ]
  },
  {
    "title": "5. 외부 서비스 및 AI 처리",
    "paragraphs": [
      "회사는 서비스 제공을 위해 다음 외부 서비스를 이용합니다.",
      "사업계획서 분석 및 IR Deck 생성 시 문서 본문과 관련 자료가 DeepSeek API에 전송됩니다. 전송 자료에는 사업 내용, 기술 구성, 시장 전략 및 문서에 남아 있는 개인정보가 포함될 수 있습니다.",
      "DeepSeek 공개 플랫폼 정책은 별도 서면 약정이 없는 경우 입력·출력을 모델 학습 및 개선 등에 이용할 수 있도록 정하고 있습니다. 회사의 자체 학습 미사용 방침은 외부 AI 제공자의 학습 미사용을 보장하지 않습니다.",
      "이용자는 처리에 불필요한 개인정보 또는 외부 제공 권한이 없는 자료를 제출하지 않아야 합니다."
    ],
    "bullets": [
      "Supabase: 회원 인증, 데이터베이스 운영, 파일 및 분석·생성 결과 저장",
      "n8n: 자동화, 알림 및 문서 처리",
      "Vercel: 웹서비스 호스팅",
      "DeepSeek API: 사업계획서 분석 및 IR Deck 콘텐츠 생성"
    ]
  },
  {
    "title": "6. 개인정보의 국외 처리",
    "paragraphs": [
      "회사는 외부 서비스 이용 과정에서 개인정보를 국외로 전송하거나 보관합니다.",
      "가. Supabase",
      "이전받는 자: Supabase Pte. Ltd.",
      "연락처: privacy@supabase.com",
      "기본 저장 국가: 싱가포르",
      "이전 항목: 회원정보, 매칭 프로필, 서비스 이용 데이터, 업로드 파일, 추출 본문 및 분석·생성 결과",
      "이전 시기·방법: 회원가입 및 서비스 이용 시 네트워크 전송",
      "이전 목적: 인증, 데이터베이스 운영 및 파일·결과 보관",
      "나. n8n Cloud",
      "이전받는 자: n8n GmbH",
      "연락처: Novalisstr. 10, 10115 Berlin, Germany",
      "저장 국가: 독일",
      "이전 항목: 작업 처리에 필요한 사용자 식별정보, 문서 데이터, 분석·생성 결과 및 실행 기록",
      "이전 시기·방법: 자동화 작업 실행 시 네트워크 전송",
      "이전 목적: 문서 처리, AI 요청 전달 및 작업 자동화",
      "다. DeepSeek API",
      "연락처: privacy@deepseek.com",
      "처리·보관 국가: 중국",
      "이전 항목: 사업계획서 본문, 관련 자료 및 분석·생성 요청 내용",
      "이전 시기·방법: 분석·생성 요청 시 네트워크 전송",
      "이전 목적: 사업계획서 분석 및 IR Deck 콘텐츠 생성",
      "라. Vercel",
      "이전받는 자: Vercel Inc.",
      "연락처: privacy@vercel.com",
      "이전 항목: 접속정보 및 웹 요청 처리에 필요한 데이터",
      "이전 시기·방법: 웹서비스 이용 시 네트워크 전송",
      "이전 목적: 웹서비스 호스팅 및 운영",
      "이용자는 개인정보 문의처를 통해 국외 이전의 거부 또는 중지를 요청할 수 있습니다. 해당 이전이 필요한 서비스의 이용은 제한될 수 있습니다."
    ]
  },
  {
    "title": "7. 개인정보의 파기",
    "paragraphs": [
      "회사는 보유 기간이 경과하거나 처리 목적이 달성된 개인정보를 지체 없이 파기합니다.",
      "법령에 따라 보존해야 하는 정보는 다른 개인정보와 분리하여 보관하고, 보존 기간 종료 후 파기합니다.",
      "전자파일은 복구 또는 재생이 어렵도록 삭제합니다. 외부 서비스에 전송된 데이터는 관련 법령과 계약에 따라 삭제 요청 등 필요한 조치를 진행합니다."
    ]
  },
  {
    "title": "8. 개인정보의 안전성 확보 조치",
    "paragraphs": [
      "회사는 개인정보 보호를 위해 비공개 파일 저장, 접근권한 제한 및 일부 개인정보 마스킹을 적용합니다.",
      "파일의 비공개 저장 여부와 관계없이 분석·생성에 필요한 정보는 제5항 및 제6항에 따라 외부 서비스에서 처리될 수 있습니다."
    ]
  },
  {
    "title": "9. 쿠키의 사용 및 거부",
    "paragraphs": [
      "회사는 로그인 상태 유지와 서비스 제공을 위해 쿠키 등 브라우저 저장 기능을 사용할 수 있습니다.",
      "이용자는 브라우저 설정에서 쿠키를 차단하거나 저장된 사이트 데이터를 삭제할 수 있습니다. 이 경우 로그인 등 일부 기능의 이용이 제한될 수 있습니다."
    ]
  },
  {
    "title": "10. 이용자 및 법정대리인의 권리",
    "paragraphs": [
      "이용자 또는 적법한 대리인은 개인정보의 열람, 정정, 삭제, 처리정지 및 동의 철회를 요청할 수 있습니다.",
      "회사는 본인 또는 대리인 여부를 확인한 후 관련 법령에 따라 처리합니다. 요청이 제한되는 경우에는 그 사유를 안내합니다.",
      "개인정보 침해에 관한 상담 및 분쟁조정은 개인정보침해 신고센터 또는 개인정보분쟁조정위원회에 신청할 수 있습니다."
    ]
  },
  {
    "title": "11. 개인정보 보호 및 고충 처리",
    "bullets": [
      "운영자: SSIAT",
      "담당: SSIAT 운영 담당자",
      "문의 및 권리 행사 접수: ann690437@gmail.com"
    ]
  },
  {
    "title": "12. 개인정보 처리방침의 변경",
    "paragraphs": [
      "회사는 개인정보 처리방침을 변경하는 경우 변경 내용과 시행일을 서비스 내 공지를 통해 안내합니다."
    ]
  }
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
