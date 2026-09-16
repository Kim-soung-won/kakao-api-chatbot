# A2A(외부 에이전트) 연동 — SSE 수신 + 카카오 콜백

> 특정 welfare 키를 **외부 A2A/RAG 서비스**에 매핑해, 그 서버의 응답을 받아 카카오 SkillResponse로
> 되돌리는 파이프라인. 5초를 넘는 처리는 카카오 **콜백(useCallback)**으로 배선한다.
> 실제 백엔드가 없으므로 **MSW로 30초 SSE 목업 A2A**를 세워 흐름만 검증한다.
> 코드: `apps/server/src/a2a/*`, `skill/blocks/a2a.ts`, `routes/skill.ts`.

## 매핑

| 발화 | 블록 | 처리 |
| --- | --- | --- |
| `RAG 검색` (이력 있음) | `rag-search` | **대화 이력 전체를 RAG(A2A)로 전송**(SSE) → 콜백으로 최종 답변 |
| `RAG 검색` (이력 없음) | `rag-search` | 콜백 없이 즉시 안내(+수신 진단) |

A2A/콜백은 **`RAG 검색`에만** 연결돼 있다(특정 welfare 키워드에는 매핑하지 않음). `의료` 등
welfare 키는 기존대로 정적 카드로 즉시 응답한다. `rag-search`는 `callback.when(이력>0)`으로
이력이 있을 때만 RAG를 호출한다.

## 왜 콜백인가 — 카카오 5초 제한

카카오 스킬 응답 타임아웃은 **5초**인데 A2A/LLM/RAG는 그보다 오래 걸린다(여기 목업은 30초).
카카오 **콜백**으로 우회한다:

```
사용자 "RAG 검색"
   │
   ▼  POST /skill                     (카카오 → 우리 서버)
[즉시] useCallback 대기응답 반환  { "version":"2.0","useCallback":true,"data":{"text":"…검색 중…"} }
   │
   ├─ (백그라운드) 대화 이력 전체를 RAG(A2A)로 POST → SSE 스트림 끝까지 수신 → 최종 답변 조립
   │
   ▼  POST userRequest.callbackUrl     (우리 서버 → 카카오, 유효 1분·1회)
[최종] 완성된 SkillResponse            → 카카오가 채팅방에 렌더
```

- 콜백을 쓰려면 챗봇관리자센터에서 **AI 챗봇 전환 + 해당 스킬 콜백 활성화** 필요. 그래야 요청에
  `userRequest.callbackUrl`이 실려온다.
- `callbackUrl` 없으면(로컬/미설정) 라우트가 **동기 await**로 폴백(데모용). A2A 실패 시 정적 카드 폴백.

## ⚠️ SSE는 서버에서만 소비 — 카톡 말풍선 실시간 스트리밍 아님

A2A는 SSE로 토큰을 흘리지만, **카카오 챗봇 말풍선은 토큰 실시간 스트리밍을 지원하지 않는다.**
그래서 `client.ts`가 SSE 스트림을 **끝까지 모아 하나의 완성 텍스트**로 만든 뒤, 콜백으로 **1회** 보낸다.
(콜백 유효 1분 → A2A 태스크가 1분 내 끝나야 한다. 초과 시 친구톡 등 별도 능동 푸시 필요.)

## 구성요소

| 파일 | 역할 |
| --- | --- |
| `a2a/config.ts` | `A2A_ENDPOINT`(기본: 실제 google-adk RAG 에이전트)·`A2A_TIMEOUT_MS`·`A2A_MOCK`(기본 off)·`A2A_DURATION_MS`(목업 전용) |
| `a2a/mock.ts` | **MSW** 목업(A2A_MOCK=1) — 실서버와 **같은 A2A 프레이밍**(task→working→artifact×N→completed)으로 SSE 응답 |
| `a2a/client.ts` | `askA2a()` — 실제 A2A 서버에 **JSON-RPC `message/stream`** POST(대화 이력을 텍스트로), **SSE 소비**해 artifact/최종 message 텍스트 반환 |
| `skill/blocks/rag-search.ts` | `RAG 검색` 블록. `callback.run`이 대화 이력을 `askA2a`로 전송, `respond`는 이력없음/폴백 |
| `routes/skill.ts` | 콜백 블록 감지(`callback.when`) → useCallback ack + 백그라운드 run → `callbackUrl` POST. 콜백 없으면 `SYNC_BUDGET_MS`(3.5s) 내 동기 시도 후 폴백 |
| `routes/callback-sink.ts` | **디버그** 로컬 콜백 수신함(실카카오 없이 콜백 테스트용) |

## 로컬 테스트

목업 시간을 짧게 주고, `callbackUrl`을 로컬 수신함으로 지정한다.

```bash
# 서버 (목업 A2A 1.5초로 단축)
A2A_DURATION_MS=1500 pnpm --filter @sprint-kakao/server dev

# 대화 몇 턴 쌓기(이력 생성)
curl -s localhost:3000/skill -H 'content-type: application/json' -d '{"userRequest":{"utterance":"이용안내","user":{"id":"u1"}},"bot":{},"action":{}}' >/dev/null
curl -s localhost:3000/skill -H 'content-type: application/json' -d '{"userRequest":{"utterance":"보육료","user":{"id":"u1"}},"bot":{},"action":{}}' >/dev/null

# RAG 검색 콜백 경로: ack 즉시 → 1.5초 후 sink에 RAG 답변
curl -s localhost:3000/skill -H 'content-type: application/json' -d '{
  "userRequest":{"utterance":"RAG 검색","user":{"id":"u1"},
  "callbackUrl":"http://localhost:3000/callback-sink?id=t1"},"bot":{},"action":{}}'
#  → {"version":"2.0","useCallback":true,"data":{"text":"…검색 중…"}}
sleep 2
curl -s 'localhost:3000/callback-sink?id=t1'   # payload에 최종 RAG 답변(대화 N턴 참고)
```

## 실제 A2A 서버 (연결됨)

- **엔드포인트**: `http://16.16.208.36:8000/a2a/google-adk-agent/jsonrpc` (Google ADK `toA2a`, RAG 에이전트).
  AgentCard: `…/a2a/google-adk-agent/.well-known/agent-card.json`. `A2A_ENDPOINT` env로 교체 가능.
  ⚠️ 카드의 `url`은 `localhost`로 찍혀 있으니 무시하고 공개 IP로 접근한다.
- **프로토콜**: JSON-RPC `message/stream` → SSE. 이벤트 `kind`: `task`→`status-update`(working)→
  `artifact-update`(토큰)→`status-update`(final). 답변은 artifact 또는 최종 status.message의 text 파트.
- `A2A_MOCK=0`(기본)이면 실서버, `A2A_MOCK=1`이면 MSW 목업(같은 URL 가로챔).
- 실서비스는 카카오 콜백 활성화가 필수(그래야 `callbackUrl` 수신). 콜백 없으면 5초 초과 시 폴백만 뜬다.

> 현재 백엔드 vLLM이 `Forbidden`을 반환하면 답변 자리에 `VllmLlm request failed: Forbidden`이 그대로
> 온다(우리 배선은 정상, A2A 서버 쪽 모델 권한 이슈). 모델 인증이 풀리면 실제 RAG 답변이 온다.
