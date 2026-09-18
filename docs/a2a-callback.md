# A2A(외부 에이전트) 연동 — SSE 수신 + 카카오 콜백

> **모든 질의를 외부 A2A/RAG 에이전트**로 보내고 그 응답을 카카오 SkillResponse로 되돌리는
> 파이프라인. 5초를 넘는 처리는 카카오 **콜백(useCallback)**으로 배선한다.
> 코드: `apps/server/src/a2a/*`, `skill/blocks/agent.ts`, `skill/blocks/onboarding.ts`, `routes/skill.ts`.
>
> ## ⚠️ 현재 A2A 경로는 임시 테스트/목업이다
> 지금 연결된 A2A 엔드포인트(llamon 콘텐츠 창작 데모 에이전트)와 이 A2A 배선 전체는 **임시**이며,
> **추후 실제 도메인(복지) RAG 백엔드가 추가될 자리를 위한 목업**이다. A2A 응답을 카카오에 표출하는
> 흐름을 눈으로 확인하려고 **기본값으로 고정**해 둔 것뿐. 실제 RAG가 준비되면
> `A2A_ENDPOINT`/`A2A_PROTOCOL`/`A2A_AUTH`(env)만 교체하면 된다(코드 변경 불필요).
>
> ## ⚠️ 대화 이력은 에이전트가 관리한다
> 서버는 이력을 저장하지 않는다. 이번 발화(또는 온보딩 완료 프로필)만 에이전트로 넘기고,
> 멀티턴 맥락은 에이전트가 유지한다 → [rag-history.md](./rag-history.md).

## 매핑

| 발화 | 블록 | 처리 |
| --- | --- | --- |
| 온보딩 외 모든 자유 발화 | `agent` | 발화를 A2A로 전송(SSE) → 콜백으로 최종 답변 |
| 온보딩 **완료**(지역/가구/관심 3조각) | `onboarding` | 수집 프로필을 A2A로 전송 → 콜백으로 맞춤 안내 |
| 온보딩 카드 단계(지역·가구 선택) | `onboarding` | 콜백 없이 즉시 다음 카드(동기 respond) |

`agent`는 항상 콜백으로 A2A를 호출하고, `onboarding`은 `callback.when(완료 단계)`일 때만 호출한다.

## 왜 콜백인가 — 카카오 5초 제한

카카오 스킬 응답 타임아웃은 **5초**인데 A2A/LLM/RAG는 그보다 오래 걸린다(여기 목업은 30초).
카카오 **콜백**으로 우회한다:

```
사용자 자유 발화 (또는 온보딩 완료)
   │
   ▼  POST /skill                     (카카오 → 우리 서버)
[즉시] useCallback 대기응답 반환  { "version":"2.0","useCallback":true,"data":{"text":"…준비 중…"} }
   │
   ├─ (백그라운드) 발화/프로필을 A2A로 POST → SSE 스트림 끝까지 수신 → 최종 답변 조립
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
| `a2a/client.ts` | `askA2a()` — 실제 A2A 서버에 **JSON-RPC `message/stream`**(또는 rest) POST, **SSE 소비**해 artifact/최종 message 텍스트 반환 |
| `skill/blocks/agent.ts` | 캐치올 블록. `callback.run`이 발화를 `askA2a`로 전송, `respond`는 A2A 미가용 폴백 |
| `skill/blocks/onboarding.ts` | 온보딩 카드 흐름. 완료 단계(`callback.when`)에서 수집 프로필을 `askA2a`로 전송 |
| `skill/render-agent.ts` | 에이전트 평문/JSON 답변 → SkillResponse 출력 변환(임시 어댑터, 형식 확정 시 passthrough로 교체) |
| `routes/skill.ts` | 콜백 블록 감지(`callback.when`) → useCallback ack + 백그라운드 run → `callbackUrl` POST. 콜백 없으면 `SYNC_BUDGET_MS`(3.5s) 내 동기 시도 후 폴백 |
| `routes/callback-sink.ts` | **디버그** 로컬 콜백 수신함(실카카오 없이 콜백 테스트용) |

## 로컬 테스트

목업 시간을 짧게 주고, `callbackUrl`을 로컬 수신함으로 지정한다.

```bash
# 서버 (목업 A2A 1.5초로 단축)
A2A_DURATION_MS=1500 pnpm --filter @sprint-kakao/server dev

# 자유 발화 콜백 경로: ack 즉시 → 1.5초 후 sink에 에이전트 답변
curl -s localhost:3000/skill -H 'content-type: application/json' -d '{
  "userRequest":{"utterance":"보육료 알려줘","user":{"id":"u1"},
  "callbackUrl":"http://localhost:3000/callback-sink?id=t1"},"bot":{},"action":{}}'
#  → {"version":"2.0","useCallback":true,"data":{"text":"…준비 중…"}}
sleep 2
curl -s 'localhost:3000/callback-sink?id=t1'   # payload에 최종 에이전트 답변

# 온보딩 완료 콜백 경로(프로필 3조각 누적 발화)
curl -s localhost:3000/skill -H 'content-type: application/json' -d '{
  "userRequest":{"utterance":"화곡동 / 다문화가정 / 교육·진학","user":{"id":"u1"},
  "callbackUrl":"http://localhost:3000/callback-sink?id=t2"},"bot":{},"action":{}}'
sleep 2
curl -s 'localhost:3000/callback-sink?id=t2'   # payload에 프로필 맞춤 안내
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
