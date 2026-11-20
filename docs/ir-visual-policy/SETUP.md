# 한 번 보정 후 남은 화면 품질 문제는 결과 표시 허용

## 적용

1. Supabase SQL Editor에서 `ir-deck-html-v1/60-finish-visual-after-repair.sql` 전체 실행 → `ir_html_visual_after_repair_v1 / ready` 확인.
2. n8n **IR HTML 생성**의 Code **HTML 부분 보정 화면 검사 결과**를 `ir-deck-html-v1/59-n8n-check-repaired-browser-visual.js` 전체로 교체. Run Once for All Items. 기존 연결 및 Settings 유지.
3. **HTML 부분 보정 화면 정상?** true는 기존 HTML 생성 완료 저장 경로 유지. false는 기존 실패 저장 유지. IF 조건은 `{{ $json.render_verified }}` is true. 첫 번째 화면 검사 및 부분 보정 필요 여부 판정 노드는 그대로 유지한다.
4. Save / Publish. 이후 새 생성으로 확인한다. 이미 failed 상태인 작업을 직접 ready로 바꾸지 않는다.

## 동작

- 첫 화면 검사 → 문제가 있는 장만 한 번 부분 보정 → 두 번째 화면 검사.
- 두 번째 검사에서 넘침·잘림·대비·보이지 않는 텍스트·캔버스 크기 등 알려진 화면 품질 문제만 남으면 완료 저장하고 결과를 표시한다.
- 실제 검사에서 나온 문제와 원래 통과 여부는 내부 보고서에 보존한다. 사용자 경고를 추가하지 않는다.
- 서버는 보정된 문서가 실제 저장된 기록과 문서 버전을 확인한 뒤 이 정책을 허용한다. 첫 검사를 건너뛰거나 보정 전에 강제로 완료시키지 않는다.
- 안전성 검사, 문서 ID/버전 불일치, 슬라이드 누락, 브라우저 검사 실패 및 폰트 로딩 실패 등은 기존 실패 경로를 유지한다.
- 이미 ready로 확정된 문서의 PDF/PPTX 출력도 잔여 화면 품질 문제 때문에 다시 차단하지 않는다. HTML/CSS 내용을 몰래 축소하거나 제거하는 변경은 하지 않는다.
- AI 호출 횟수는 그대로이며, 보정은 최대 한 번이다. 결과를 허용하는 판정만 변경한다.

## 확인

잔여 품질 문제 보고서가 있는 보정 완료 작업에서 render_verified=true → 최종 ready → 7장 미리보기 → PDF 및 PPTX 7장 출력 확인. 실제 요청 실패·다른 문서·누락 장표는 계속 실패하는지 별도로 확인한다.
