---
name: kakao-skill-response_api
description: >-
  apps/server/src/의 Fastify 라우트나 packages/contract/src/request.ts를 작성·수정할 때,
  우리 스킬 서버의 HTTP 엔드포인트(GET /health, POST /skill, POST /echo)와
  인바운드(카카오 → 서버) 요청 계약(SkillPayload)의 경로·필드·구조가 필요하면 호출한다.
  ⚠️ 요청 계약은 아직 가설(HYPOTHESIS)이며 POST /echo 실측으로 확정 대상이다.
  서버가 돌려주는 응답(outbound) 계약은 [[kakao-skill-response_domain]]을 호출한다.
metadata:
  type: domain-skill
  confidence:
    unconfirmed:
      - topic: "SkillPayload 요청 JSON 포맷 전체"
        note: >-
          카카오 공개 GitBook(llms-full.txt 포함)에 요청 JSON 스펙 명시 없음.
          현재 구조는 i-오픈빌더 통념 기반 초안. POST /echo로 실제 요청 1건을 캡처해 확정한다.
          확정 전까지 이 타입에 의존하는 코드는 옵셔널 체이닝 등 방어적 파싱을 유지한다.
      - topic: "userRequest.user.id(botUserKey) 세션 간 고정 여부 (검증 대상 1)"
        note: >-
          봇 스코프에서 사용자 식별/데이터 키로 쓸 수 있는지 여부. /echo 캡처로 확정.
          저장소(무DB vs KV) 결정을 좌우한다.
      - topic: "context.params 요청↔응답 왕복 여부 (검증 대상 2)"
        note: >-
          응답에서 세팅한 context.values[].params가 다음 요청 userRequest.contexts[].params로
          되돌아오는지. [[kakao-skill-response_domain]]의 응답 측 context와 짝을 이룬다. /echo로 확정.
      - topic: "contexts params 수명(lifeSpan 턴 수 / ttl 초) 만료 동작 (검증 대상 3)"
        note: >-
          실제 만료 규칙 미확정. context를 채팅방 세션 저장소로 쓸 수 있는지 판단 근거. /echo로 확정.
      - topic: "action.clientExtra 로 버튼 block action의 extra 전달 여부"
        note: >-
          응답의 block action extra가 다음 요청 action.clientExtra로 오는지 미확인. /echo로 확정.
---

# kakao-skill-response_api

## 한 줄 정의

우리 스킬 서버(`apps/server`, Fastify · ESM · 기본 포트 3000)의 HTTP 엔드포인트와,
카카오 챗봇 오픈빌더가 서버로 보내는 **인바운드 요청 계약(`SkillPayload`)**을 정의한다.
서버가 돌려주는 **아웃바운드 응답 계약(`SkillResponse`)은 이 스킬에서 중복하지 않고**
[[kakao-skill-response_domain]]을 권위 문서로 참조한다.

> ⚠️ **HYPOTHESIS.** 요청 JSON 포맷은 카카오 공개 문서에 명시가 없어 아직 가설이다.
> 실제 값은 `POST /echo`로 진짜 요청을 캡처해 확정한다. 확정 전까지 이 타입에
> 의존하는 코드는 **방어적으로 파싱**(옵셔널 체이닝)한다.

---

## 전송·노출 요건 (스킬 서버 URL)

카카오 챗봇은 **인바운드 웹훅** 구조다 — 사용자가 채널에서 발화하면 오픈빌더가
매칭된 블록의 **스킬 URL로 HTTP POST**를 보내고(요청·응답 모두 JSON body), 우리 서버는
그 요청에 대한 HTTP 응답으로 `SkillResponse`를 돌려준다. 즉 우리 서버는 **카카오가
공개 인터넷에서 도달할 수 있는 주소**여야 한다.

**카카오 공식 제약 (오픈빌더 스킬 가이드):**

- **"스킬은 공인IP 또는 공중망 도메인만 사용 가능합니다."** → `localhost`·사설망은 등록 불가.
- **"각각의 요청은 HTTP POST를 통해서 전달되고, 요청과 응답 모두 JSON으로 구성된 body를 이용합니다."**
- 스킬 타임아웃은 **고정 5초**. 초과 예상 시(예: RAG·A2A) **콜백(useCallback) 비동기 패턴**으로
  대기응답 후 `callbackUrl`로 최종 응답을 POST한다. (콜백 URL 역시 공개 HTTPS 경로여야 함.)

> **HTTPS 강제 — 실측 확정(2026-09-17).** 카카오 문서 본문은 프로토콜을 "공중망 도메인"으로만
> 표현하지만, 스킬 URL을 `http://`로 등록해도 **카카오가 접속을 TLS로 강제**한다. 평문 http
> 엔드포인트로 실측했더니 오픈빌더가 `not an SSL/TLS record`(카카오가 보낸 TLS ClientHello에
> 우리 서버가 평문 `HTTP/1.1 400`으로 응답 → TLS 클라이언트가 끊음)로 실패했다. 즉 스킬/콜백
> URL은 **유효 SSL 인증서를 갖춘 HTTPS 필수**. 상세: `docs/https-requirement-test.md`.
> 노출 수단도 **https를 종단하는 터널**(cloudflared quick tunnel·localhost.run)만 유효하고,
> `bore` 같은 평문 http 릴레이는 카카오 연동에 못 쓴다(디버깅 전용).

**이 프로젝트의 노출 결정 (C4 모델 `d4` = 근거 출처):**

- 실측 단계에서는 로컬 `:3000`을 **cloudflared** 또는 **ssh(localhost.run)** 터널로
  **공개 HTTPS**에 노출해 스킬 URL로 등록하고, 향후 공개 호스트 배포(EC2 + cloudflared)로 대체한다.
- ✗ 즉시 클라우드 배포 / ✗ ngrok(계정·authtoken 필요) — 설치·계정 부담 때문에 기각.
- **터널이 필요한 경로는 이 인바운드 웹훅 엣지가 유일**하다. 반대로 우리가 카카오 공개 API로
  나가는 **아웃바운드**(비즈메시지, A2A/RAG 호출)는 `localhost`에서도 동작 → 터널 불필요.
- 출처: `sprint-kakao-c4-model.json` → `designIntent.decisions[d4]` + `sys-kakao-platform`↔`sys-kakao-skill`
  엣지 설명 + deployment `ec2` 노드. (엣지 방향 ⬅️ 인바운드 = connection reversed.)

---

## HTTP 엔드포인트 (apps/server)

### `GET /health`

- **Query/Path Parameters**: 없음.
- **Response** (`200`):

```json
{ "status": "ok" }
```

- 헬스체크용.

### `POST /skill`

카카오 스킬 본 엔드포인트.

- **Request Body**: `SkillPayload` (아래 "요청 계약" 참조). ⚠️ unconfirmed — 가설.
- **동작**: `userRequest.utterance`(사용자 발화 원문)를 읽어 `SkillResponse`를 반환한다.
  현재는 **mock 데모 빌더**가 응답을 생성한다(추후 RAG 변환 흐름으로 교체 예정).
  요청 타입이 가설이므로 **옵셔널 체이닝으로 방어적 파싱**한다.
- **Response**: `SkillResponse` → **계약은 [[kakao-skill-response_domain]] 참고**
  (이 스킬에서 응답 구조를 재정의하지 않는다).

### `POST /echo`

요청 계약 실측 확정용 엔드포인트.

- **Request Body**: 카카오가 보낸 원문 그대로(임의 JSON). 스키마 강제 안 함.
- **동작**:
  1. 실제 요청을 원문 그대로 `captured-requests/echo-<ISO>.json`에 저장.
  2. 콘솔에 `user.id`·`contexts` 유무를 로깅.
- **Response**: 최소 유효 `SkillResponse`(`simpleText`) 반환
  → 응답 형태는 [[kakao-skill-response_domain]] 참고.
- **목적**: 아래 "검증 대상 3가지"를 실측해 요청 계약을 HYPOTHESIS → 확정으로 승격.

---

## 요청 계약 (`SkillPayload`) — ⚠️ HYPOTHESIS, /echo로 확정 대상

정의 위치: `packages/contract/src/request.ts` (초안). 아래는 현재 추정 구조다.
각 `⚠️` 필드는 실측 미확정 항목이며 frontmatter `confidence.unconfirmed`에 등록되어 있다.

```ts
interface SkillPayload {
  intent?: { id?: string; name?: string };
  userRequest: UserRequest;
  bot: BotRef;
  action: SkillAction;
}

interface UserRequest {
  utterance: string;                 // 사용자 발화 원문
  user: SkillUser;
  contexts?: RequestContext[];       // ⚠️ 응답 context.params의 왕복 결과로 추정 (검증 대상 2)
  block?: { id?: string; name?: string };
  lang?: string;
  params?: Record<string, unknown>;
}

interface SkillUser {
  id: string;                        // ⚠️ botUserKey 추정, 세션 간 고정 여부 미확정 (검증 대상 1)
  type?: string;                     // ⚠️ "botUserKey" 추정
  properties?: Record<string, unknown>; // ⚠️ plusfriendUserKey, appUserId 등 추정
}

interface RequestContext {           // ⚠️ 응답 context.values[]의 왕복으로 추정 (검증 대상 2·3)
  name: string;
  lifeSpan: number;                  // ⚠️ 유효 턴 수 만료 동작 미확정 (검증 대상 3)
  ttl?: number;                      // ⚠️ 유효 초 만료 동작 미확정 (검증 대상 3)
  params?: Record<string, unknown>;
}

interface BotRef {
  id: string;
  name?: string;
}

interface SkillAction {
  id?: string;
  name?: string;
  params?: Record<string, string>;       // 엔티티 추출 파라미터(단순 값)
  detailParams?: Record<string, unknown>;// 상세 파라미터(원문/정규화 값)
  clientExtra?: Record<string, unknown>; // ⚠️ 버튼 block action의 extra가 여기로 오는지 미확정
}
```

> 타입 권위: `SkillPayload`(및 하위 `UserRequest`/`SkillUser`/`RequestContext`/`BotRef`/`SkillAction`)는
> **이 `_api` 스킬이 인바운드 계약의 권위 문서**다. 응답(아웃바운드) 타입은 정의하지 않고
> [[kakao-skill-response_domain]]에 위임한다.

---

## 검증 대상 3가지 (저장소 설계의 근거) — /echo 캡처로 확정

1. **`userRequest.user.id`(botUserKey)가 세션 간 고정인가?**
   고정이면 사용자 식별/데이터 키로 사용 가능. 저장소 키 설계의 전제.
2. **응답에서 세팅한 `context.values[].params`가 다음 요청의
   `userRequest.contexts[].params`로 왕복되는가?**
   왕복되면 카카오 context를 상태 채널로 사용 가능.
   ([[kakao-skill-response_domain]]의 응답 측 `context`와 짝.)
3. **`contexts` params의 수명(`lifeSpan` 턴 수 / `ttl` 초)이 실제로 어떻게 만료되는가?**
   만료 규칙이 무DB 세션 저장의 한계를 규정한다.

---

## 핵심 제약사항

- **요청 계약은 미확정(HYPOTHESIS)이다.** `/skill`에서 `SkillPayload`를 소비하는 코드는
  필드 존재를 가정하지 말고 **옵셔널 체이닝으로 방어적 파싱**해야 한다.
- **응답 구조를 이 스킬에서 재정의하지 않는다.** `SkillResponse`·`context.values`·`block.extra`
  등 아웃바운드 계약은 전부 [[kakao-skill-response_domain]]이 권위다.
- `POST /echo`는 요청을 **원문 그대로** 파일(`captured-requests/echo-<ISO>.json`)로 남긴다 —
  스키마 검증/변형을 하지 않는 것이 목적(실측 확정용).
- `version`·응답 렌더링 제약 등은 이 스킬 범위 밖 → [[kakao-skill-response_domain]] 참고.

---

## 에러 응답

> ⚠️ unconfirmed: 서버(`/skill`, `/echo`, `/health`)의 HTTP 4xx/5xx 에러 응답 포맷은
> 아직 정의되지 않았다. 요청 계약 확정(/echo) 이후 검증 실패·파싱 실패 시의 응답 포맷을 확정한다.

---

## 구현 위치

> 아래는 이 스킬이 기술하는 엔드포인트·요청 계약이 **저장소에 어떻게 구현돼 있는지**를
> 가리키는 포인터다. (경로는 모두 저장소 루트 `sprint-kakao/` 기준.)

### 서버 (`apps/server`, Fastify · ESM)

- **`apps/server/src/index.ts`** — Fastify 인스턴스 부트스트랩. `GET /health`(`{ status: "ok" }`)를 직접 정의하고, `skillRoutes`·`echoRoutes`를 register한다. 포트는 `process.env.PORT ?? 3000`.
- **`apps/server/src/routes/skill.ts`** — `POST /skill`. `request.body`를 `Partial<SkillPayload>`로 받아 **옵셔널 체이닝으로 방어적 파싱**(`body?.userRequest?.utterance ?? ""`)한 뒤 `buildDemoResponse(utterance)` 결과를 반환한다(mock 데모). 요청 타입이 HYPOTHESIS이므로 필드 존재를 가정하지 않는다.
- **`apps/server/src/routes/echo.ts`** — `POST /echo`. 요청을 **원문 그대로**(`headers` + `body`) `captured-requests/echo-<ISO>.json`(`process.cwd()` 기준)에 저장하고, `userRequest.user.id`·`contexts` 유무를 로깅한다. 응답은 최소 유효 `SkillResponse`(`simpleText`). 요청 계약 실측 확정용.

### 응답 빌더 (mock)

- **`apps/server/src/builders/outputs.ts`** — `Output`/`Button`/`QuickReply` 조립 헬퍼(`simpleText`·`simpleImage`·`basicCard`·`listCard`·`itemCard`·`carousel`, 버튼/바로가기 헬퍼). contract 타입을 그대로 써 잘못된 조합을 컴파일 타임에 차단.
- **`apps/server/src/builders/demo.ts`** — 발화에 따라 데모 `SkillResponse`를 만드는 `buildDemoResponse`. `/skill`이 이걸 호출한다. (RAG 연동 시 이 자리가 검색 → 변환으로 교체 예정.)

> 위 빌더가 생성하는 응답의 구조·컴포넌트·상수는 이 스킬에서 재정의하지 않는다 → [[kakao-skill-response_domain]]의 "구현 위치"(`packages/contract/src/response.ts`) 참고.

### 요청 계약 타입

- **`packages/contract/src/request.ts`** — `SkillPayload`(및 `UserRequest`·`SkillUser`·`RequestContext`·`BotRef`·`SkillAction`) 정의. 파일 상단 주석에 **⚠️ HYPOTHESIS**와 위 "검증 대상 3가지"가 그대로 명시돼 있다. `POST /echo` 실측으로 확정 대상.

---

## 핵심 의사 결정 (RAG 프로젝트 관점)

- 이 프로젝트는 **DB를 되도록 쓰지 않으려** 하며, 사용자 데이터를 카카오
  **context(채팅방 세션)**에 둘 수 있는지 검토 중이다. context는 만료되므로 영구저장의
  대체가 아니며, 위 **검증 대상 3가지**의 실측 결과가 저장소 결정(무DB vs KV)을 좌우한다.
- 이 맥락은 [[kakao-skill-response_domain]]의 응답 측 `context` / `block.extra`(컨텍스트 전달
  채널)와 짝을 이룬다. 즉 응답에서 내보낸 상태가 요청으로 왕복되는지가 핵심 미확정 축이다.
- `/echo`를 먼저 붙여 실제 요청을 캡처 → `SkillPayload`를 HYPOTHESIS에서 확정으로 승격 →
  그 결과로 `/skill`의 방어적 파싱을 실제 스펙 기반으로 정리한다.
