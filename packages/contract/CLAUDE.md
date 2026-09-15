# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`@sprint-kakao/contract` — 카카오 인터페이스의 **단일 출처(single source of truth)**.
타입과 제약 상수만 있고 런타임 로직은 없다. server(생성 측)와 playground(렌더/검증 측)가
빌드된 `dist`를 import해 같은 타입·상수를 공유한다. 모노레포 전체 맥락은 루트 `../../CLAUDE.md`.

## 이 패키지에 담긴 4개 계약은 서로 다른 제품이다 (혼동 주의)

가장 흔한 실수는 아래를 섞는 것이다. 이름·모양은 비슷해도 별개 인터페이스다.

| 파일 | 타입 | 방향 | 제품 | 필드 네이밍 |
|---|---|---|---|---|
| `response.ts` | `SkillResponse` | 서버→카카오 (챗봇 응답) | 챗봇 스킬 | camelCase, `action` 판별 |
| `request.ts` | `SkillPayload` | 카카오→서버 (챗봇 요청) | 챗봇 스킬 ⚠️가설 | camelCase |
| `message.ts` | `MessageTemplate` | 능동 push (공유/발송) | Kakao Developers 메시지 | snake_case, `object_type` 판별 |
| `friendtalk.ts` | `FriendTalkMessage` | 능동 push (채널 친구) | 카카오 비즈메시지 | snake_case, `type`(WL/AL/BK/MD) |

- 챗봇 응답 카드(`BasicCard`, `Button`)와 메시지 템플릿 카드(`FeedContent`, `MsgButton`)를
  서로 대입하지 말 것. 예: 챗봇 버튼은 `{ action, label }`, 메시지 버튼은 `{ title, link }`.
- `request.ts`는 **HYPOTHESIS**다. 카카오 공개 문서에 요청 JSON 스펙이 없어 초안 상태이며,
  server `/echo` 실측으로 확정 대상(주석의 "확정해야 할 3가지" 참조). 요청 타입을 "사실"로
  단정하지 말고, 파싱은 옵셔널 체이닝으로 방어적으로.

## 타입뿐 아니라 제약 상수도 여기서 export

렌더러/밸리데이터가 재구현하지 않도록 제약을 상수로 내보낸다. 새 제약을 코드에 하드코딩하지 말고
여기에 상수로 추가한 뒤 consumer가 재사용하게 한다.
- `response.ts`: `MAX_OUTPUTS`, `MAX_QUICK_REPLIES`, `MAX_*_ITEMS`, `MAX_BUTTONS_*`,
  `TEXT_LIMITS`, `MAX_ITEMCARD_ROWS*`
- `message.ts`: `MESSAGE_LIMITS` · `friendtalk.ts`: `FRIENDTALK_LIMITS`
- 아직 타입화 안 한 컴포넌트는 `DEFERRED_*` 상수로 명시(`DEFERRED_OUTPUTS`,
  `DEFERRED_MESSAGE_TEMPLATES`, `DEFERRED_FRIENDTALK`).

## 지켜야 할 불변조건 (타입에 주석으로도 있음)

- `Output`은 **정확히 한 개의 키**만 갖는 오브젝트 유니온 (`{ simpleText: ... }`). 여러 키 금지.
- `ItemCard`의 `head`와 `profile`은 **동시 사용 불가**(배타).
- `Carousel.items`는 `type`에 따라 `BasicCard[] | ListCard[] | ItemCard[]` 중 하나로 통일.
- 리스트/캐러셀 개수 상한은 단일형과 캐러셀 내부형이 다르다(상수 접미사 `_IN_CAROUSEL` 확인).

## 명령어

```bash
pnpm build       # tsup → dist/ (index.js + index.d.ts). consumer는 dist를 import
pnpm dev         # tsup --watch (타입 바꾸면 자동 재빌드)
pnpm typecheck   # tsc --noEmit
```

**타입을 바꾸면 server/playground가 반영하려면 `dist`가 최신이어야 한다.** 개발 중엔 `dev`(watch)를,
그 외엔 변경 후 `build`를 돌린다. 모든 export는 `index.ts`의 `export *`를 거쳐야 노출된다.

## 규약

- ESM. 상대 import는 반드시 `.js` 확장자 (`./response.js`) — verbatimModuleSyntax + Bundler 해상도.
- strict + `noUncheckedIndexedAccess`. 타입 전용 import는 `import type`.
- 권위 문서는 `../../.claude/skills/kakao-skill-response_{domain,api}` — 관련 타입 수정 전 읽는다.
