# 분석 확인 화면의 AI 제목과 자동저장

## 서버 설치

1. Supabase SQL Editor에서 `ir-deck-review-titles-install.sql` 전체를 실행한다. `ir_review_ai_titles_v1 / ready`를 확인한다. 기존 자료를 삭제하지 않고 내용 저장 함수가 AI 제목을 보존하게 바꾼다.
2. n8n **IR 덱 생성 v1**에서 `IR 분석 결과 통합` 성공 경로와 기존 내용 저장 노드 사이에 아래 4개 노드를 추가한다. 기존 통합 성공 IF가 있으면 그 true 출력 다음에 추가한다.

`통합 성공 → IR 확인 제목 요청 준비 → IR 확인 제목 DeepSeek → IR 확인 제목 응답 확인 → IR 확인 제목 정상? → 기존 내용 저장`

3. Code `IR 확인 제목 요청 준비`: Run Once for All Items. `ir-deck-workflow/prepare-review-titles.js` 전체를 붙인다.
4. HTTP Request `IR 확인 제목 DeepSeek`: 기존 분석 DeepSeek HTTP 노드를 복제하고 이름을 변경한다. 같은 URL, 인증을 사용한다. JSON Body 전체를 Expression `{{ $json.request }}`로 설정한다. Timeout 60000ms, Response Format JSON, Retry On Fail OFF. On Error Continue(regular output)로 연결해 다음 응답 확인 노드가 실패를 판정하게 한다. 별도 무한 재시도를 추가하지 않는다.
5. Code `IR 확인 제목 응답 확인`: Run Once for All Items. `ir-deck-workflow/check-review-titles.js` 전체를 붙인다.
6. IF `IR 확인 제목 정상?`: Boolean `{{ $json.run }}` is true. true는 기존 내용 저장 HTTP로, false는 기존 분석 실패 저장 HTTP로 연결한다.
7. 기존 내용 저장 HTTP Body가 특정 통합 노드를 직접 참조한다면 현재 항목을 사용하도록 변경한다: `{{ {p_job_id:$json.job_id,p_claim_token:$json.claim_token,p_analysis:$json.p_analysis} }}`. 노드명보다 실제 RPC `save_ir_deck_content_v1`인지를 확인한다.
8. n8n **IR HTML 생성**의 `HTML 구성 요청 준비`는 `ir-deck-html-v1/42-n8n-plan-request-paragraph-ids.js` 전체로 교체한다.
9. 같은 워크플로의 `HTML 구성안 응답 검증`은 `ir-deck-html-v1/43-n8n-check-plan-paragraph-ids.js` 전체로 교체한다. 저장된 확인 제목을 코드가 최종 headline으로 보존한다.
10. 두 워크플로를 Save / Publish한다.

## 동작

- 원문 전체와 통합 분류를 읽는 제목 전용 AI 호출 1회가 분석 완료 전에 추가된다. 출력은 7개 제목뿐이며 기존 사실·본문·근거는 변경하지 않는다.
- 제목 칸은 기존 입력 컴포넌트를 사용한다. AI 제목을 기본값으로 표시하고 직접 수정할 수 있다.
- 프론트는 입력을 멈춘 뒤 1초 후 서버에 제목/본문을 함께 저장한다. 타이핑마다 AI를 호출하지 않는다. 브라우저 초안 보관도 유지한다.
- 디자인 선택으로 넘어갈 때 진행 중인 자동저장을 기다리고 최신 변경을 다시 저장한다. 저장 확인 전에는 넘어가지 않는다.
- 최종 생성은 저장된 사업 확인본과 revision을 사용한다. 제목은 그대로 보존하며 본문은 발표용으로 요약·구성한다.
- 이미 분석한 자료에는 과거에 생성하지 않았던 제목이 저절로 생기지 않는다. 설치 후 새 분석으로 확인한다.

## 확인

새 분석에서 항목명이 아닌 제목이 표시되는지 확인 → 제목/본문 수정 → 1초 이상 대기 → 새로고침 → 수정값 유지 → 디자인 선택 → 최종 HTML/PDF/PPTX의 제목 및 변경 내용 반영 확인.
