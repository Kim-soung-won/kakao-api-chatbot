# 에이전트 응답 → 카카오톡 채널 응답 변환 원리

RAG 복지 안내 에이전트(A2A)가 돌려준 응답이 어떻게 카카오 챗봇 말풍선·카드·버블(`SkillResponse`)이
되는지를 단계별로 설명한다. 계약 원문은 [rag-agent-직접연동-가이드v4.md](./rag-agent-직접연동-가이드v4.md)
(에이전트 쪽)와 `.claude/skills/kakao-skill-response_domain`(카카오 쪽)이다.

## 한눈에

```
카카오 발화 ──▶ POST /skill ──▶ agent 블록 ──▶ askRagAgent ──▶ RAG 에이전트 (A2A message/send)
                                                                   │
   ┌───────────────────────────────────────────────────────────────┘
   ▼
① 수신·파싱 (a2a/rag-client.ts)          ② 렌더 (skill/render-rag.ts)        ③ 전달 (routes/skill.ts)
   artifact "welfare-guide"                 guideText → 리드 말풍선             useCallback 대기응답
   ├ TextPart  → guideText                  sources   → itemCard (캐러셀)       → callbackUrl로 최종 POST
   └ DataPart  → sources·suggestions        suggestions → quickReplies
     (HTML 조각은 평문으로 정리)              (카카오 제약 상수로 자르기)
                         │                                 │
                         └──── RagResult ─────────────────▶ SkillResponse
```

핵심은 **두 번의 변환을 분리**한 것이다.

1. **에이전트 계약 → 앱 중립 타입(`RagResult`)**: 신뢰 경계 밖의 응답을 방어적으로 읽어 정규화한다.
2. **`RagResult` → 카카오 계약(`SkillResponse`)**: 카카오 출력 컴포넌트와 제약에 맞춰 그린다.

에이전트 계약이 바뀌면 ①만, 카카오 표현을 바꾸려면 ②만 고친다.

---

## ① 수신·파싱 — `apps/server/src/a2a/rag-client.ts`

### 에이전트가 주는 것

에이전트는 `result.artifacts[]` 안에 이름이 `welfare-guide`인 artifact 하나를 돌려준다. 그 `parts`에 두 종류가 섞여 온다.

| Part | 내용 | 우리가 쓰는 이름 |
|---|---|---|
| `kind: "text"` | 안내문(`answer_format: plain`이면 평문) | `guideText` |
| `kind: "data"`, `data.schema: "rag-agent.flow-output.v1"` | `sources`(서비스 목록)·`suggestions`(후속 제안) | `sources`·`suggestions` |

### 오케스트레이터 경유 응답 (`/agent-orchestrator`, 실측)

오케스트레이터는 같은 요청에 artifact 이름과 DataPart 스키마만 달리해 돌려준다. 아래는 범위 밖 발화("반갑다")에 대한
실제 응답이다(2026-10-14 Postman 실측, `result.kind: "task"`).

```json
{
  "id": 1, "jsonrpc": "2.0",
  "result": {
    "artifacts": [{
      "artifactId": "6566a22c-…",
      "name": "structured-response",
      "parts": [
        { "kind": "text", "text": "저는 복지서비스를 찾아 안내해 드리는 복지 안내 챗봇이라, …" },
        { "kind": "data", "data": {
            "schema": "welfare-orchestrator.channel-output.v1",
            "turn_type": "reject",
            "reject_reason": "out_of_scope" } }
      ]
    }],
    "contextId": "<sessionId>",
    "history": [],
    "id": "<taskId>",
    "kind": "task",
    "metadata": { "userId": "kakao-dev", "processingTimeMs": 297 },
    "status": { "state": "completed" }
  }
}
```

| | 직접 연동 | 오케스트레이터 경유 |
|---|---|---|
| artifact `name` | `welfare-guide` | `structured-response` |
| DataPart `schema` | `rag-agent.flow-output.v1` | `welfare-orchestrator.channel-output.v1` |
| DataPart 키 | `sources`·`suggestions` | `turn_type` + 검색 턴(`"answer"`)은 `sources`·`suggestions`, 거절 턴(`"reject"`)은 `reject_reason` |

검색 턴(`turn_type: "answer"`, 2026-10-14 실측)의 `sources` 항목과 `suggestions`는 직접 연동과 **키·형태가 같다**
(`service_id`·`service_name`·`apply_end`·`contact`·`apply_method`·`content_snippet` …, `{type:"detail",service_id,service_name}`·
`{type:"other_category"}`). 그래서 파싱·렌더 코드는 그대로 공유한다. `turn_type`·`reject_reason`은 아직 쓰지 않는다.

### 읽는 규칙

- **위치가 아니라 이름·종류로 찾는다.** artifact는 `name === "welfare-guide"`, 없으면 `"structured-response"`.
  DataPart는 `kind === "data"`이고 `schema`가 `rag-agent.flow-output` 또는
  `welfare-orchestrator.channel-output`으로 시작하는 것(`findFlowOutput`). 버전이 늘어도 받는다.
- 안내문은 TextPart를 모두 이어 붙인다(`partsText`).
- **모르는 키·모르는 값은 버린다.** `sources`는 `service_id`나 `service_name`이 없는 항목을 버리고
  (`normalizeSources`), `suggestions`는 `type`이 문자열이 아닌 항목을 버린다(`normalizeSuggestions`).
- **HTML 조각을 평문으로 바꾼다.** `sources`의 필드(`content_snippet`·`apply_method` 등)에는 원장 HTML이
  잘린 채로 들어온다(`<br>`, `&nbsp;`, 앞부분이 잘린 `br>` 조각). 카카오 컴포넌트는 HTML을 렌더하지 않으므로
  받는 즉시 `plainTextFields`(`a2a/plain-text.ts`)로 정리한다.
  - `<br>`·`</p>`·`</li>` 등 블록 경계 → 줄바꿈, 나머지 알려진 태그 → 제거
  - 앞뒤에서 잘린 태그 조각 제거, 엔티티(`&nbsp;` `&amp;` `&#8226;` …) 복원
  - 알려진 HTML 태그 이름만 다루므로 공문서의 `<신청 안내>` 같은 꺾쇠 표기는 남는다

### 실패도 결과로 만든다

어떤 경우에도 예외를 던지지 않고 `RagResult`를 돌려준다. 실패면 `ok: false`와 **사용자에게 보여 줄 사유**를
`guideText`에 담는다 — 그래야 카카오에 항상 무언가가 표시된다.

| 상황 | 결과 |
|---|---|
| 질의가 빔 | 에이전트를 부르지 않고 `ok:false`, "무엇을 안내해 드릴까요?…" |
| 401/403 | `ok:false`, "AI 안내 서버 인증에 실패했어요…" |
| 그 외 HTTP 오류 | `ok:false`, "AI 안내 서버 응답을 받지 못했어요…" |
| JSON-RPC `error` | `ok:false`, "AI 안내 중 오류가 발생했어요: …" |
| `status.state`가 `completed`가 아님 | `ok:false`, 안내문이 있으면 그대로 |
| 타임아웃(`RAG_TIMEOUT_MS`, 기본 40초) | `ok:false`, "시간 안에 완료되지 않았어요…" |
| 검색 결과 0건 | **오류 아님.** `ok:true` + 안내문 + 빈 목록 |

### 결과 타입

```ts
interface RagResult {
  ok: boolean;
  guideText: string;            // 안내문(실패면 사용자용 사유)
  sources: RagSource[];         // 서비스 목록(평문 정리됨)
  suggestions: RagSuggestion[]; // { type: "detail" | "other_category" | …, service_id?, service_name? }
}
```

---

## ② 렌더 — `apps/server/src/skill/render-rag.ts`

`renderRag(result)`가 `RagResult`를 `{ outputs, quickReplies }`로 바꾼다. 원칙은 CLAUDE.md와 같다 —
**데이터성 요소(제목·기간·문의·신청방법)는 카카오 네이티브 컴포넌트로**, 서식이 많은 긴 글은 쓰지 않는다.

### guideText → 리드 말풍선(simpleText)

카카오 `simpleText`는 마크다운을 렌더하지 않고, 안내문 본문의 서비스별 내용은 아래 카드와 겹친다.
그래서 **첫 문단만** 리드로 쓴다(`leadText`).

- 첫 빈 줄 앞까지. 그 안에 마크다운 제목(`#`)·인용(`>`)·목록(`-` `*`) 줄이 있으면 그 앞까지.
- `TEXT_LIMITS.simpleText`(1000자)로 자른다.

### sources → itemCard (2건 이상이면 캐러셀)

서비스 하나가 itemCard 하나가 된다(`sourceCard`). 최대 `MAX_CAROUSEL_ITEMS`(10)건, 1건이면 단일 카드,
2건 이상이면 `carousel(type: "itemCard")`.

| 카드 위치 | 원천 필드 | 규칙 |
|---|---|---|
| 제목(`head.title`) | `service_name` | 없으면 "복지서비스", 50자 |
| 행 "신청" / "신청기간" | `apply_start`·`apply_end` | `apply_end === "9999-12-31"`이면 "상시 접수", 아니면 "시작 ~ 끝"(40자) |
| 행 "문의" | `contact` | 40자 |
| 행 "신청방법" | `apply_method` | 40자 |
| 행 "안내"(행이 하나도 없을 때만) | `selection_criteria` 첫 줄 → `category_large` → "자세한 내용은 문의" | itemCard는 최소 1행이 필요하다 |
| 설명(`description`) | `content_snippet` → `selection_criteria` | **6자 이상인 첫 줄**(표 머리글 같은 짧은 조각을 건너뜀), 230자 |

- 행은 캐러셀 안에서 최대 `MAX_ITEMCARD_ROWS_IN_CAROUSEL`(5)개.
- 잘리는 곳은 끝에 `…`를 붙인다(`clamp`).

### suggestions → quickReplies(버블)

에이전트 제안에는 **버블 문구가 없다** — 라벨은 채널이 조립한다(가이드 §3.3).

| `type` | 버블 | 누르면 |
|---|---|---|
| `detail` | `{service_name} 자세히 보기`(14자로 자름) | `service_name`을 발화로 보낸다(이름 재질의) |
| `other_category` | **그리지 않는다** | — 누를 때 동작이 미정이고 분야 선택 화면(온보딩)이 비활성이라 |
| 그 외 | 무시 | — `type`은 앞으로 늘 수 있다 |

최대 `MAX_QUICK_REPLIES`(10)개.

### 출력이 비지 않게

안내문·카드가 모두 비면 `guideText`(또는 "안내를 준비하지 못했어요.")를 말풍선 하나로 낸다.
최종 `outputs`는 `MAX_OUTPUTS`(3)개로 자른다. 실패(`ok:false`)면 카드 없이 사유 말풍선만 나간다.

### 제약은 contract 상수에서 온다

글자 수·개수 제한은 모두 `packages/contract`의 상수(`TEXT_LIMITS`, `MAX_OUTPUTS`, `MAX_QUICK_REPLIES`,
`MAX_CAROUSEL_ITEMS`, `MAX_ITEMCARD_ROWS_IN_CAROUSEL`)를 그대로 쓴다. playground의 `validate.ts`도
같은 상수로 검사하므로, 렌더 결과가 제약을 넘으면 playground에서 바로 경고가 뜬다.

---

## ③ 전달 — `apps/server/src/skill/blocks/agent.ts`, `apps/server/src/routes/skill.ts`

### SkillResponse로 감싸기

agent 블록이 `renderRag` 결과를 `{ version: "2.0", template: { outputs, quickReplies? } }`로 감싼다
(`wrapAgent`). **버블은 에이전트 제안에서 나온 것만** 붙이고 서버 고정 버블은 섞지 않는다. 버블이 없으면
`quickReplies` 키 자체를 뺀다.

### 5초 제한과 콜백

카카오 스킬은 5초 안에 응답해야 하는데 에이전트는 그보다 오래 걸린다(실측 약 8초). 그래서 agent 블록은
**콜백 블록**이다.

1. 카카오 요청에 `callbackUrl`이 있으면 즉시 `{ useCallback: true, data: { text: "AI 상담원이 답변을 준비하고 있어요…" } }`를 돌려준다.
2. 백그라운드에서 에이전트 호출 → ①②를 거친 `SkillResponse`를 `callbackUrl`로 POST한다.
3. 그 과정이 실패하면 블록의 `respond`(사과 문구)를 같은 `callbackUrl`로 보낸다.
4. `callbackUrl`이 없으면(콜백 미설정·로컬) `SYNC_BUDGET_MS`(기본 3.5초) 안에서만 동기로 기다리고,
   넘기면 `respond` 폴백을 돌려준다.

자세한 흐름은 [a2a-callback.md](./a2a-callback.md).

---

## 변환 예

**에이전트 응답(요약)**

```json
{ "result": { "status": { "state": "completed" }, "artifacts": [{
  "name": "welfare-guide",
  "parts": [
    { "kind": "text", "text": "에너지효율개선사업은 저소득 가구의 냉난방비 부담을 줄이기 위해 …\n\n## 신청 안내\n…" },
    { "kind": "data", "data": {
      "schema": "rag-agent.flow-output.v1",
      "sources": [{
        "service_id": "X", "service_name": "2025년 에너지효율개선사업 신청 안내",
        "apply_start": "2025-03-05", "apply_end": "2025-04-17", "contact": "1670-7653",
        "apply_method": "○ 신청기간: 2025. 3. 5.(수) ~ 4.17.(목)까지 방문&nbsp;신청<br>",
        "content_snippet": "br><br> 1. 시공 및 물품 지원 완료 후 … 원상복구 의무가 있습니다.<br><br> 2. …"
      }],
      "suggestions": [
        { "type": "detail", "service_id": "X", "service_name": "2025년 에너지효율개선사업 신청 안내" },
        { "type": "other_category" }
      ]
    }}
  ]
}]}}
```

**카카오 SkillResponse**

```json
{ "version": "2.0", "template": {
  "outputs": [
    { "simpleText": { "text": "에너지효율개선사업은 저소득 가구의 냉난방비 부담을 줄이기 위해 …" } },
    { "itemCard": {
      "head": { "title": "2025년 에너지효율개선사업 신청 안내" },
      "itemList": [
        { "title": "신청기간", "description": "2025-03-05 ~ 2025-04-17" },
        { "title": "문의", "description": "1670-7653" },
        { "title": "신청방법", "description": "○ 신청기간: 2025. 3. 5.(수) ~ 4.17.(목)까지 방문 …" }
      ],
      "description": "1. 시공 및 물품 지원 완료 후 … 원상복구 의무가 있습니다."
    }}
  ],
  "quickReplies": [
    { "label": "2025년 에너지효율개선…", "action": "message", "messageText": "2025년 에너지효율개선사업 신청 안내" }
  ]
}}
```

- 안내문은 `## 신청 안내` 앞의 첫 문단만 리드가 됐다.
- `<br>`·`&nbsp;`·앞의 `br>` 조각이 사라졌다.
- `other_category` 제안은 버블이 되지 않았다.

---

## 한계와 다음 과제

- **`detail` 버블은 이름 재질의다.** 가이드는 `rag-agent.detail-input.v1`으로 `service_ids`를 보내는 구조화
  상세 조회를 권하지만 아직 연결하지 않았다. 지금은 서비스 이름을 새 질의로 보낸다.
- **안내문은 첫 문단만 쓴다.** 본문의 나머지는 카드와 겹친다는 전제다. 카드에 없는 내용이 본문에만 있으면 보이지 않는다.
- **`guideText`에는 HTML 정리를 적용하지 않는다.** 지금까지 관측한 안내문은 평문이었다.
- **멀티턴 맥락은 에이전트 몫이다.** 서버는 상태를 저장하지 않고 이번 발화만 sessionId(botUserKey)와 함께 보낸다.
- `skill/render-agent.ts`(예전 임시 어댑터)는 더 이상 호출되지 않는다. 현재 변환은 `render-rag.ts`가 맡는다.
- 오케스트레이터 경유의 `turn_type`(`answer`·`reject` …)은 읽지 않는다. 거절 턴도 안내문 한 줄로만 보인다.

## 관련 파일

| 파일 | 역할 |
|---|---|
| `apps/server/src/a2a/rag-client.ts` | 요청 생성·전송, 응답 파싱·정규화, 실패 폴백 |
| `apps/server/src/a2a/plain-text.ts` | HTML 조각 → 평문 |
| `apps/server/src/a2a/rag-types.ts` | `RagResult`·`RagSource`·`RagSuggestion` 타입 |
| `apps/server/src/skill/render-rag.ts` | `RagResult` → outputs·quickReplies |
| `apps/server/src/skill/blocks/agent.ts` | `SkillResponse`로 감싸기, 콜백 블록 정의 |
| `apps/server/src/routes/skill.ts` | useCallback 대기응답·callbackUrl 전송·동기 예산 폴백 |
| `apps/server/src/builders/outputs.ts` | contract 타입 기반 컴포넌트 빌더 |
| `packages/contract/src/response.ts` | 카카오 응답 타입·제약 상수 |
