# A2A(외부 에이전트) 연동 — SSE 수신 + 카카오 콜백

> 특정 welfare 키를 **외부 A2A/RAG 서비스**에 매핑해, 그 서버의 응답을 받아 카카오 SkillResponse로
> 되돌리는 파이프라인. 5초를 넘는 처리는 카카오 **콜백(useCallback)**으로 배선한다.
> 실제 백엔드가 없으므로 **MSW로 30초 SSE 목업 A2A**를 세워 흐름만 검증한다.
> 코드: `apps/server/src/a2a/*`, `skill/blocks/a2a.ts`, `routes/skill.ts`.

## 매핑

| welfare 키(발화) | 블록 | 처리 |
| --- | --- | --- |
| `의료` · `건강` · `의료·건강` | `a2a-consult` | 외부 A2A 호출(SSE) → 콜백으로 최종 답변 |

`a2aConsult` 블록은 `welfare`보다 **앞에** 등록돼 "의료/건강"을 가로챈다. 그 외 welfare 키
(보육료·교육활동비 등)는 기존대로 즉시 동기 응답.

## 왜 콜백인가 — 카카오 5초 제한

카카오 스킬 응답 타임아웃은 **5초**인데 A2A/LLM/RAG는 그보다 오래 걸린다(여기 목업은 30초).
카카오 **콜백**으로 우회한다:

```
사용자 "의료"
   │
   ▼  POST /skill                     (카카오 → 우리 서버)
[즉시] useCallback 대기응답 반환  { "version":"2.0","useCallback":true,"data":{"text":"…준비 중…"} }
   │
   ├─ (백그라운드) A2A 서비스 호출 → SSE 스트림 끝까지 수신 → 최종 답변 조립
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
| `a2a/config.ts` | 엔드포인트(`A2A_ENDPOINT`)·목업 시간(`A2A_DURATION_MS`, 기본 30s)·`A2A_MOCK` 토글 |
| `a2a/mock.ts` | **MSW** 목업 — `A2A_ENDPOINT` POST를 가로채 SSE로 토큰을 흘리다 30초에 완료 |
| `a2a/client.ts` | `askA2a()` — A2A에 질문 POST, **SSE 스트림 소비**해 최종 답변 반환 |
| `skill/blocks/a2a.ts` | `의료` 키 매핑 블록. `callback.run`이 `askA2a` 호출, `respond`는 폴백 |
| `routes/skill.ts` | 콜백 블록 감지 → useCallback ack + 백그라운드 run → `callbackUrl` POST |
| `routes/callback-sink.ts` | **디버그** 로컬 콜백 수신함(실카카오 없이 콜백 테스트용) |

## 로컬 테스트

목업 시간을 짧게 주고, `callbackUrl`을 로컬 수신함으로 지정한다.

```bash
# 서버 (목업 A2A 1.5초로 단축)
A2A_DURATION_MS=1500 pnpm --filter @sprint-kakao/server dev

# 콜백 경로: ack 즉시 → 1.5초 후 sink에 최종 응답 도착
curl -s localhost:3000/skill -H 'content-type: application/json' -d '{
  "userRequest":{"utterance":"의료","user":{"id":"u1"},
  "callbackUrl":"http://localhost:3000/callback-sink?id=t1"},"bot":{},"action":{}}'
#  → {"version":"2.0","useCallback":true,"data":{"text":"…준비 중…"}}
sleep 2
curl -s 'localhost:3000/callback-sink?id=t1'   # payload에 최종 A2A 답변

# 동기 폴백(콜백 미지정): 1.5초 블로킹 후 최종 답변 직접 반환
curl -s localhost:3000/skill -H 'content-type: application/json' -d '{
  "userRequest":{"utterance":"의료","user":{"id":"u2"}},"bot":{},"action":{}}'
```

## 실연동으로 넘어갈 때

- `A2A_MOCK=0` + `A2A_ENDPOINT=<실제 A2A URL>` 로 목업을 끄고 실제 서버에 붙인다. `client.ts`의
  SSE 파싱은 그대로 재사용(프레이밍이 다르면 파서만 조정).
- 실서비스는 카카오 콜백 활성화가 필수(그래야 `callbackUrl` 수신). `callback-sink`는 디버그 전용.
- 다른 welfare 키도 같은 패턴으로 A2A에 매핑 가능(블록에 `callback` 추가).
