# Onboarding Journey

첨부한 로그인 화면 이미지는 레이아웃 참고용이다.

- 이미지의 배경과 중앙 흰색 Form Container 구조를 참고한다.

- 이미지 속 로그인 폼의 내부 콘텐츠 구성 자체는 따라하지 않는다.

- 중앙 흰색 Container는 온보딩 콘텐츠 양에 맞게 더 넓고 높게 확장해도 된다.

- 다만 Container와 내부 콘텐츠 사이의 여백감, 정돈된 Form 배치, 전체적인 밀도는 첨부 이미지와 유사하게 유지한다.

- 좌우 내부 Padding은 약 48px 수준으로 유지한다.

- 상하 여백은 콘텐츠에 맞게 자연스럽게 조정한다.

- 페이지 배경은 rgba(158, 169, 174, 0.5)

- Container 배경은 #FFFFFF기존 프로젝트에 2단계 온보딩 화면을 구현해줘.

현재는 프론트엔드 UI와 입력/선택 로직만 구현한다.

기존 다른 페이지와 기능은 수정하지 않는다.

전체적으로 깔끔하고 간결한 Form 형태로 구성한다.

━━━━━━━━━━━━━━━━━━━━

1/2 기본 자격 정보

━━━━━━━━━━━━━━━━━━━━

1. 생년월일

- 필수 Input

- Placeholder: YYYY.MM.DD

- 숫자만 입력 가능

- YYYYMMDD 최대 8자리

- 입력하면서 YYYY.MM.DD 형식으로 자동 포맷

- 8자리 완성 후 실제 존재하는 날짜인지 검증

- 미래 날짜 입력 불가

- 입력 중이거나 미완성 상태에서는 Error를 표시하지 않음

2. 창업단계

- 필수, 단일 선택

- 5개의 선택 카드를 가로로 배치

선택지:

- 예비창업자

- 1년 미만

- 1년 이상 ~ 3년 미만

- 3년 이상 ~ 7년 미만

- 7년 이상

스타일:

- 낮고 간결한 카드 형태

- 미선택: 흰색 배경 + Neutral Border

- 선택: Primary Border/Text + Check 아이콘

- 한 번에 하나만 선택 가능

- 좁은 화면에서는 자연스럽게 줄바꿈

3. 지역

Desktop에서는 거주지역과 사업장 소재지를 같은 행에 2열로 배치한다.

거주지역                         사업장 소재지

[ 지역을 선택해주세요 ▾ ]        [ 지역을 선택해주세요 ▾ ]

두 필드의 너비와 높이를 동일하게 맞춘다.

[거주지역]

- 필수

- Searchable Select / Combobox

- 단일 선택

- Select를 열면 Dropdown 내부에서 지역 검색 가능

- 검색 결과의 지역을 클릭해야 선택 완료

- 선택 후 전체 지역명 표시

  예: 경기도 성남시 분당구

- 읍·면·동 및 상세주소는 받지 않음

[사업장 소재지]

항상 같은 위치에 표시한다.

예비창업자 선택 시:

- Select Disabled

- "거주지역과 동일" Checkbox Disabled

- 필수값에서 제외

- Placeholder: 사업자 등록 후 입력 가능

그 외 창업단계:

- Select 활성화

- 필수값

- 거주지역과 동일한 Searchable Select 사용

사업장 소재지 Label 오른쪽에

"거주지역과 동일" Checkbox를 배치한다.

Checkbox 선택 시:

- 거주지역 값을 사업장 소재지에 자동 적용

- 사업장 소재지 Select Disabled

- 거주지역 변경 시 사업장 소재지도 자동 동기화

Checkbox 해제 시:

- 사업장 소재지 Select 활성화

[지역 데이터]

- 임시 대한민국 행정구역 데이터 사용

- regions 데이터를 별도로 분리

- 거주지역과 사업장 소재지에서 동일한 데이터와 컴포넌트 재사용

- 시·도 / 시·군·구 / 일반구 표현

[다음 버튼]

모든 필수값이 유효하게 완료되기 전까지 Disabled.

활성 조건:

- 유효한 생년월일 입력

- 창업단계 선택

- 거주지역 선택

- 기창업자는 사업장 소재지 선택 완료

조건 충족 시 Primary 버튼으로 활성화.

━━━━━━━━━━━━━━━━━━━━

2/2 사업 및 매칭 정보

━━━━━━━━━━━━━━━━━━━━

1. 사업분야

- 필수

- 다중 선택 Dropdown

선택지:

- AI·데이터

- SW·ICT

- 반도체·전자

- 로봇·스마트제조

- 바이오·헬스케어

- 모빌리티·항공

- 에너지·환경

- 제조·소재

- 식품·농업

- 콘텐츠·문화

- 패션·뷰티

- 관광·서비스

- 기타

- Dropdown 내부에서 복수 선택 가능

- 선택된 항목 오른쪽에 Check 아이콘 표시

- 선택 상태가 명확하게 구분되도록 표현

- 선택된 값은 Dropdown을 닫은 상태에서도 확인 가능

2. 지원카테고리

모든 선택지를 둥근 Pill 형태로 노출한다.

복수 선택 가능.

선택지:

- 전체

- 사업화

- 기술개발(R&D)

- 시설·공간·보육

- 교육·멘토링·컨설팅

- 판로

- 글로벌

- 인력

- 융자·보증·정책자금

- 행사·네트워크

기본값: 전체

선택 로직:

- 개별 항목 선택 시 "전체" 자동 해제

- 개별 항목 복수 선택 가능

- "전체" 선택 시 기존 개별 선택 모두 해제

- 모든 개별 항목을 해제하면 "전체" 자동 선택

Pill 스타일:

- 충분히 둥근 Capsule 형태

- 미선택: 연한 Neutral 배경

- 선택된 Pill에만 배경 #D7F5EA 적용

- 선택된 Pill 텍스트: #1F8064

- #D7F5EA는 다른 선택 컴포넌트에는 적용하지 않음

[하단 버튼]

[이전] [완료]

- 이전 클릭 시 1단계로 이동

- 단계 이동 후에도 입력값 유지

- 사업분야 미선택 시 완료 버튼 Disabled

━━━━━━━━━━━━━━━━━━━━

COLOR

━━━━━━━━━━━━━━━━━━━━

Primary: #1F8064

Main Text: #163B31

Secondary Text: #62756E

On Primary: #FFFFFF

지원카테고리 Selected Pill Background: #D7F5EA

━━━━━━━━━━━━━━━━━━━━

UI

━━━━━━━━━━━━━━━━━━━━

- 깔끔하고 여백감 있는 Form UI

- 별도 섹션 번호 없음

- Input과 Select의 높이 및 Radius 통일

- 창업단계 카드는 한 행에 정돈되게 배치

- 지역 필드는 Desktop에서 2열 배치

- 모바일에서는 지역 필드를 1열로 배치

- 지원카테고리는 둥근 Pill 형태로 자연스럽게 줄바꿈

- 과도한 Card, Illustration, Gradient 사용하지 않음

- 재사용 가능한 컴포넌트로 구현

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://growth-step-register.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6f620838-e4e8-4e4c-9061-66ca255b76e3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
