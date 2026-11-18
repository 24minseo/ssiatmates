# 수동 공고 URL 재사용

`docs/manual-notice-url-cache.sql`을 운영 Supabase SQL Editor에서 실행해야 캐시가 활성화됩니다. GitHub 병합만으로 SQL은 배포되지 않습니다.

지원사업 탐색의 수동 분석 버튼은 기존 `createManualNoticeAnalysisApi`를 사용합니다. 이 API가 인증된 사용자의 저장 결과를 먼저 조회하고, 일치하면 n8n을 호출하지 않습니다. 조회 실패·미설치·미일치 시 기존 웹훅 분석으로 진행합니다(캐시 조회 대기 최대 2.5초).

- K-Startup 공고 ID, 기업마당 공고 ID로 URL을 정규화합니다.
- 본인의 ready/confirmed, checks_passed, URL 단독 분석만 재사용합니다. 별도 파일을 함께 분석한 결과는 제외합니다.
- 새 공고를 만들거나 다른 계정의 레포트를 복사하지 않습니다. 기존 수동 수정값과 확정 상태를 유지합니다.
- 원격 공고 변경을 자동 감지하지 않습니다. `analyze({url, forceRefresh:true})`로 기존 재분석 경로를 실행할 수 있습니다. 확정 레코드 덮어쓰기 정책은 기존 저장 함수에 따릅니다.
- 시연 대상 175783도 정상 저장된 결과가 있어야 조회됩니다. 특정 공고 정보를 하드코딩하지 않습니다.

검증: `node --experimental-strip-types --test tests/manualNoticeAnalysisApi.test.mjs`
