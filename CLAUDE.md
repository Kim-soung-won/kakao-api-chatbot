# sprint-kakao

카카오톡 채널에 붙는 **챗봇(스킬 서버)** 을 만드는 프로젝트. 최종적으로 RAG 백엔드를
카카오 챗봇 스킬 서버로 연결하는 것이 목표이며, 현재 1차 목표는 **카카오 요청/응답
인터페이스를 앱 레벨 타입으로 정확히 정의**하고 **어떤 렌더링 기능까지 쓸 수 있는지
테스트**하는 것이다. (RAG 연동은 다음 단계.)

## 모노레포 구조 (pnpm workspace)

```
packages/
  contract/          인터페이스 단일 출처 (server·playground가 공유)
    src/response.ts    SkillResponse: outputs 컴포넌트·Button·context + 제약 상수
    src/request.ts     SkillPayload (⚠️ HYPOTHESIS — /echo 실측으로 확정 대상)
apps/
  server/            스킬 서버 (Fastify, ESM)
    src/routes/skill.ts   POST /skill — 발화 → 블록 디스패치(onboarding·agent) → SkillResponse
    src/routes/echo.ts    POST /echo  — 실제 카카오 요청 원문 캡처 (captured-requests/)
    src/skill/            디스패처 + 블록(onboarding·agent·fallback) + render-agent(임시 어댑터)
    src/a2a/              A2A 에이전트 클라이언트·설정·목업 (모든 질의를 에이전트로)
    src/builders/         contract 타입 기반 응답 컴포넌트 빌더
    .env                  개인 카카오 key 자리 (gitignore, .env.example 참고)
  playground/        카카오톡 채팅창 렌더러 흉내 + 요청 시뮬레이터 (React + Vite)
    src/renderer/KakaoRenderer.tsx   SkillResponse → 카드/버튼/캐러셀 렌더
    src/renderer/validate.ts         렌더링 제약을 런타임 경고로 검증 (contract 상수 재사용)
```

## 핵심 원칙

1. **`packages/contract`가 인터페이스의 유일한 정의처.** server(응답 생성)와
   playground(응답 렌더/검증)가 같은 타입·상수를 import한다. 컴포넌트 하나를 바꾸면
   양쪽이 컴파일 타임에 함께 강제된다. 제약(`MAX_OUTPUTS`, `TEXT_LIMITS`,
   `MAX_ITEMCARD_ROWS` 등)도 여기서 export → validate.ts가 그대로 재사용.
2. **요청 계약은 아직 가설이다.** 카카오 공개 문서에 요청 JSON 스펙이 없어
   `request.ts`는 HYPOTHESIS로 둔다. `/skill`은 요청을 방어적으로(옵셔널 체이닝) 파싱.
   `/echo`로 실제 요청을 캡처해 user.id(botUserKey) 안정성 등을 실측한다. (context.params는
   실측 결과 **미왕복** — 서버 상태 저장을 포기한 근거.)
3. **서버는 상태를 저장하지 않는다.** 모든 질의가 에이전트(A2A)를 거치고, **대화 이력은
   에이전트가 관리**한다. 온보딩(카드 흐름)만 로컬이고 그 외 모든 발화는 agent 블록이 에이전트로
   넘긴다. 온보딩 완료 시 수집 프로필을 에이전트로 전달. 에이전트 대화 "모드"(진입/종료)는 없다.
   에이전트의 정식 SkillResponse 응답 형식은 추후 확정 예정(그전까지 render-agent가 임시 변환).

## 구현 상태

- 구현된 출력 컴포넌트: `simpleText` · `simpleImage` · `basicCard` · `listCard` ·
  `itemCard` · `carousel`(basicCard|listCard|itemCard).
- 미구현(스펙엔 존재): `textCard` · `commerceCard` → `response.ts`의 `DEFERRED_OUTPUTS`.
- 브랜딩 장식(컬러 뱃지칩·그라데이션 헤더·커스텀 아이콘)은 카카오 네이티브 프리미티브가
  아니라 **이미지로 구워 썸네일에 넣는다.** 데이터성 요소(제목·설명·금액 행·버튼)만 네이티브.

## 명령어

```bash
pnpm install
pnpm -r build           # 전체 빌드 (contract는 tsup로 dist 생성)
pnpm -r typecheck       # 전체 타입체크

# 개발 (두 개를 각각 실행)
pnpm --filter @sprint-kakao/server dev       # :3000  (tsx watch, .env 필요)
pnpm --filter @sprint-kakao/playground dev   # :5173  (/skill·/echo → :3000 프록시)
```

playground는 발화를 서버 `/skill`로 보내 응답을 렌더하고, 응답마다 제약 위반 경고와 원문
JSON(토글)을 확인한다. `맞춤복지` → 온보딩 카드 흐름, 그 외 발화 → 에이전트(A2A) 응답.
(A2A는 로컬에서 `A2A_MOCK=1` 목업으로 검증.)

## 도메인 지식 (스킬 참조)

카카오 계약의 권위 문서는 `.claude/skills/`에 있다. 관련 코드를 만지기 전에 읽는다.

- `kakao-skill-response_domain` — **응답** 계약(SkillResponse)·출력 컴포넌트·렌더링 불변조건.
- `kakao-skill-response_api` — 우리 서버 **요청** 계약(SkillPayload, 가설) + HTTP 엔드포인트.

## 규약

- 전부 TypeScript ESM. import는 `.js` 확장자로 (verbatimModuleSyntax + Bundler 해상도).
- tsconfig는 strict + `noUncheckedIndexedAccess`.
- 개인 키/시크릿은 `.env`에만. 절대 커밋하지 않는다.
