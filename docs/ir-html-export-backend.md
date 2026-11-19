# HTML IR 덱 출력 서버

## 범위

`POST /api/internal/ir-html-export-v1`은 SQL에서 예약한 출력 작업을 처리합니다.
사용자에게 노출하는 API가 아니며 `X-IR-Render-Secret` 서버 인증이 필요합니다.
기존 화면이나 AI 생성 워크플로의 호출 경로는 변경하지 않습니다.

```json
{
  "export_id": "SQL 출력 작업 UUID",
  "claim_token": "서버 예약 API가 발급한 UUID",
  "snapshot_md5": "서버 예약 API가 반환한 해시"
}
```

1. `get_ir_html_export_render_input_v1`으로 고정된 HTML·이미지 배치·파일 메타데이터를 조회합니다.
2. 기존 출력 파일이 있으면 다시 렌더링하지 않고 완료 기록을 재시도합니다.
3. 이미지가 필요하면 비공개 `ir-deck-editor-assets-v2` 버킷에서 조회합니다.
   파일 크기·SHA256·PNG/JPEG 시그니처·이미지 크기를 확인하며 동일 파일은 한 번만 조회합니다.
4. 스크립트와 외부 요청이 차단된 Chromium에서 슬롯과 자유 배치 이미지를 합성합니다.
5. 글꼴·7장 구성·텍스트 넘침을 검사한 뒤 PDF 또는 PPTX를 생성합니다.
6. `ir-deck-html-exports-v1` 비공개 버킷에 덮어쓰기 없이 저장합니다.
7. `finish_ir_html_export_v1`이 저장 파일 메타데이터를 확인하고 작업을 완료합니다.

응답에는 파일 바이너리, HTML, 저장 경로, 서비스 키, 업로드 이미지 URL이 포함되지 않습니다.
다운로드용 서명 URL은 별도의 로그인 사용자 API에서 발급해야 합니다.

## 출력 방식

- PDF: 1920×1080 비율, 7쪽. 브라우저에서 텍스트·SVG·사용자 이미지를 함께 출력합니다.
- PPTX: 16:9, 7장. 장표별 JPEG를 삽입한 **이미지 기반 PPTX**입니다.
  개별 텍스트·도형은 편집할 수 없습니다.
- 빈 이미지 슬롯: 배치를 유지하고 업로드 안내 문구와 플레이스홀더 배경·테두리를 제거합니다.
  프레임/목업 구조 자체는 유지합니다.
- 이미지 편집 이후에도 기존 출력 작업은 요청 시점의 버전으로 생성됩니다.
- 이미지 추가·출력은 DeepSeek를 호출하지 않습니다.

## 환경변수

기존 서버 설정을 재사용합니다. 모두 서버 전용이며 `VITE_` 접두사를 붙이지 않습니다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `IR_HTML_RENDER_SECRET` (기존 HTML 검사 서버와 동일)

Vercel 함수 설정은 120초/2048MB를 유지합니다.
출력 처리 중 브라우저는 약 90초에 종료되며 네트워크 처리에는 전체 약 100초 예산을 둡니다.
이는 실행 상한이며 실제 서비스 지연의 측정값이나 보장은 아닙니다.
폰트/Chromium은 기존 검사 서버의 프로세스 캐시를 재사용합니다.
Chromium 최초 실행 시 다운로드가 필요하므로 실제 운영 환경에서 콜드 스타트를 측정해야 합니다.

## 설치와 연결 순서

Supabase SQL 30~32단계가 선행되어야 합니다.

- `30-export-storage.sql`: 출력 작업 테이블과 비공개 버킷
- `31-export-request-api.sql`: 소유자 출력 요청/조회
- `32-export-worker-api.sql`: 서버 예약/입력 조회/완료/실패

이 서버 코드 배포만으로 사용자 다운로드 버튼이 연결되지는 않습니다.
후속 단계에서 출력용 n8n 호출, 사용자 상태 조회의 시간초과 복구,
소유자 확인 후 서명 URL 발급, 프론트 버튼 연결이 필요합니다.
스케줄 트리거나 AI 재호출을 추가할 필요는 없습니다.

## 검증

```sh
node scripts/check-ir-export-types.cjs
node scripts/check-ir-export.mjs
NITRO_PRESET=vercel npm run build
node scripts/check-ir-render-route.mjs
```

`check-ir-export.mjs`의 기본 검증은 모의 서버만 사용합니다.
`IR_EXPORT_BROWSER_TEST=1`을 설정하면 로컬 Chrome과 Windows 테스트 글꼴로
실제 이미지 슬롯·빈 슬롯·자유 배치 이미지를 포함한 PDF/PPTX 7장을 생성합니다.
실제 Supabase 사용자 자료나 DeepSeek를 호출하지 않습니다.
출력 검사는 내용의 사실 정확성이나 모든 시각 디자인의 품질을 보증하지 않습니다.
