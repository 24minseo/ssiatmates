<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# SSIAT project context

이 문서는 새 Codex 작업이 긴 대화 기록 없이도 프로젝트의 확정된 기준을 이해하도록 돕는다. 세부 화면은 코드보다 Figma의 해당 노드를 우선 확인하고, 구현 상태는 현재 브랜치의 코드를 기준으로 판단한다.

## Product and design source

- SSIAT는 창업 지원사업 탐색, 지원 준비, 일정 관리를 돕는 한국어 데스크톱 웹 서비스다.
- Figma 원본: https://www.figma.com/design/PYeMOjH0zLxvFSTB414ecj/mates
- 사용자가 node-id가 포함된 Figma 링크를 제공하면 파일 전체를 추측하지 말고 해당 노드를 우선 확인한다.
- 커뮤니티는 개발 범위가 확정되지 않았으므로 현재 내비게이션과 구현 범위에서 제외한다.

## Information architecture

- MY홈: `/myhome`
- 지원사업 탐색: `/programs`
- 내 지원사업: `/my-programs`
- 전체 캘린더: `/calendar`
  - 성장일지: `/calendar/growth-journal`
- 성장일지는 현재 사이드바에서 전체 캘린더 아래의 하위 메뉴로 표현한다. IA가 변경되면 Figma와 코드를 함께 갱신한다.

## Korean terminology

- `사업 분야`처럼 띄어 쓴다.
- `관심 있는`처럼 띄어 쓴다.
- 온보딩 2/2 제목: `사업 및 관심 정보`
- 안내 문구: `관심 있는 사업 분야와 지원 분야를 선택해주세요.`
- 섹션명: `관심 지원 분야`
- 기존 `지원 카테고리`, `관심 카테고리` 표현을 새 UI에 다시 사용하지 않는다.

## UI conventions

- 기본 글꼴은 저장소의 `AstaSans-Variable.woff2`이며 CSS 이름은 `Asta Sans`다.
- 새 색상은 컴포넌트에 hex로 직접 추가하지 말고 `src/styles.css`의 의미 기반 토큰을 사용하거나 토큰을 먼저 추가한다.
- 주요 토큰: `brand`, `ink`, `ink-muted`, `placeholder`, `surface`, `field-border`, `item-hover`, `item-hover-selected`.
- 사용자 입력값은 진한 본문색을 쓰고, placeholder와 보조 문구에는 보조색을 쓴다.
- 사이드바는 데스크톱 전용이며 접힘 80px, 펼침 240px이다.
- 사이드바 메뉴 아이콘 슬롯은 24×24px이다. 수정 아이콘은 바깥 프레임 18×18px, 내부 glyph 12×12px이다.
- 일반 hover 색 전환은 150ms ease-out, 사이드바 너비·위치 전환은 200ms ease-out을 기본으로 하고 `prefers-reduced-motion`을 지원한다.

## Interaction rules

- 예비창업자를 선택하면 사업장 소재지 입력과 `거주지역과 동일` 체크박스를 비활성화하고, 열려 있던 사업장 소재지 드롭다운도 즉시 닫는다.
- 검색형 드롭다운의 아이콘과 검색어, 결과 목록은 동일한 좌측 기준선과 시각적 여백을 사용한다.
- 선택·hover·disabled 상태는 색상뿐 아니라 테두리, 배경 또는 아이콘 중 필요한 단서를 함께 사용한다.
- 사이드바 펼침 상태는 메뉴 이동 후에도 유지한다.

## Code and verification

- React 19, TanStack Start/Router, Tailwind CSS v4를 사용한다.
- 공통 앱 구조는 `src/components/app/AppShell.tsx`, `AppHeader.tsx`, `AppSidebar.tsx`에 있다.
- `src/routeTree.gen.ts`는 TanStack Router 생성 파일이다. 라우트 파일을 수정한 뒤 생성 결과가 동기화되는지 확인한다.
- 기존 사용자 변경과 Lovable 동기화 이력을 보존한다. force push, rebase, amend, squash를 하지 않는다.
- UI 변경 뒤 최소한 `npm run build`과 `npm run lint`를 확인한다. CI가 없으면 실행하지 못한 검증을 PR에 명시한다.
