# RAG 대화 이력 적재 — `RAG 검색`이 쓰는 이력은 어떻게 쌓이나

> RAG 백엔드 연동 **전에**, "지금까지의 대화 이력 전부를 RAG 서버로 넘길 수 있는가"를
> 검증하기 위한 데모의 동작 문서. `RAG 검색` 발화가 그리는 이력이 **어디에·어떻게** 적재되는지 설명한다.
> 짝 문서: [blocks.md](./blocks.md) · [chatbot.md](./chatbot.md).
> 코드: `apps/server/src/skill/history.ts`, `blocks/rag-search.ts`.

## 한 줄 요약

**서버는 이력을 저장하지 않는다(WAS 없음).** 대화 이력은 카카오 **네이티브 `context`(채팅방 세션)
왕복**에만 실려 누적된다 — 매 응답이 지금까지의 이력을 `context.values`로 되돌려주고, 다음
요청이 그걸 **페이로드 최상위 `contexts`**로 다시 싣고 온다. `RAG 검색`은 이번 요청에 실려온 그
이력을 복원해 화면에 그리고, 동시에 RAG 서버로 그대로 POST할 요청 바디(`data.ragRequest`)를 만든다.

> 카카오 스킬 서버는 stateless다. 카카오가 대신 들고 있어주는 세션 상태 채널은 **output context
> 왕복 이것 하나뿐**이며, 채팅방의 과거 메시지를 조회하는 API는 없다(매 요청엔 현재 발화 +
> 내가 심어둔 contexts만 온다). → C4 designIntent 결정 d1·d10.

## ⚠️ 실측 정정 두 가지 (이 데모의 핵심)

1. **읽기 위치 = 페이로드 최상위.** 카카오는 `contexts`를 요청 **최상위**로 왕복시킨다. 초기
   가설처럼 `userRequest.contexts`로 읽으면 실서비스에서 항상 비어 "대화 이력이 없어요"가 뜬다.
   `readHistory`는 최상위(`body.contexts`)를 우선 읽고 구 위치를 폴백한다.
2. **context는 작은 상태용 → 이력을 캡한다.** `params` 값은 문자열이고 용량 한도가 있어(정확한
   한도는 `/echo` 실측 대상), 전체 전사를 통째로 담으면 잘릴 위험이 있다. 그래서 context에 실을
   땐 **최근 N턴 + 턴당 텍스트 절단 + 총 문자열 예산**으로 압축한다(아래 상수).

## 적재 경로 (한 바퀴)

```
[카카오 요청]  contexts[name=chatHistory].params.turns   (페이로드 최상위, JSON 문자열)
      │
      ▼  readHistory(body)                       history.ts  (최상위 우선, 깨지면 빈 배열)
[SkillContext.history]  HistoryTurn[]
      │
      ▼  블록 디스패치 → respond()               index.ts:handleSkill
[이번 턴 응답 생성]
      │
      ▼  appendTurns(history, {user}, {bot})     history.ts  (transient 블록은 건너뜀)
[갱신된 이력]  최근 MAX_TURNS만 유지
      │
      ▼  attachHistoryContext(response, history)  history.ts  (compactForContext로 압축)
[카카오 응답]  context.values[chatHistory].params.turns   (JSON 문자열)
      │
      └──────────────► 다음 요청의 최상위 contexts로 되돌아옴 (왕복)
```

핵심은 **`handleSkill`이 중앙에서** 모든 응답에 이력 context를 주입한다는 것. 개별 블록
(help·welfare·fallback…)은 이력을 전혀 몰라도 되고, 자기 응답만 만든다.

## 적재되는 데이터 구조

이력을 담는 그릇은 `chatHistory`라는 이름의 카카오 **출력 컨텍스트** 하나다.

```jsonc
// 응답 context (그리고 다음 요청 최상위 contexts) 안의 값
{
  "name": "chatHistory",
  "lifeSpan": 100,          // 유지 턴 수 — 매 응답마다 재설정해 만료 연장
  "ttl": 86400,             // 유효 시간(초) = 24h
  "params": {
    // ⚠️ params 값은 문자열만 허용 → 압축한 이력 배열째 JSON.stringify 해서 싣는다
    "turns": "[{\"role\":\"user\",\"text\":\"이용안내\"},{\"role\":\"bot\",\"text\":\"[카드] …\"}]"
  }
}
```

- 한 턴(`HistoryTurn`) = `{ role: "user" | "bot", text: string }`.
- 사용자 턴 `text` = 발화 원문. 봇 턴 `text` = 응답 첫 말풍선 요약(`summarizeResponse`,
  카드류는 `[카드] 제목`·`[리스트카드] 헤더` 식으로 압축).

## 어떤 턴이 적재되는가 (규칙)

`handleSkill`이 디스패치 후 이번 턴을 이력에 덧붙일 때의 판정:

| 조건 | 적재 |
| --- | --- |
| 일반 블록 응답 + 발화 있음 | ✅ user 턴 + bot 턴 2개 추가 |
| `transient` 블록 (`RAG 검색`) | ❌ 이력에 안 남김 (메타 명령이라 이력 오염 방지). 단 **기존 이력은 그대로 재왕복** |
| 빈 발화 | ❌ 건너뜀 |

> `SkillBlock.transient` 플래그는 `types.ts`에 있고, 현재 `rag-search` 블록만 `true`다.
> 그래서 `RAG 검색`을 여러 번 눌러도 이력이 `RAG 검색`으로 오염되지 않는다.

## 적재 상한 (용량·수명 가드)

context는 **만료되는 작은** 그릇이므로 이력을 캡한다 (`history.ts` 상수).

| 상수 | 값 | 의미 |
| --- | --- | --- |
| `MAX_TURNS` | 12 | 최근 12턴만 유지(그 앞은 버림) |
| `MAX_TURN_TEXT` | 200 | context 적재 시 턴당 텍스트 절단 |
| `MAX_CONTEXT_CHARS` | 3500 | 직렬화 `turns` 문자열 예산. 초과 시 오래된 턴부터 제거 |
| `HISTORY_LIFESPAN` | 100 | 유지 턴 수. 매 응답 재설정으로 연장 |
| `HISTORY_TTL` | 86400s | 24시간 유휴 시 카카오가 context 폐기 → 이력 초기화 |

`RAG 검색` 렌더 시엔 추가로, 대화록 말풍선이 `simpleText` 1000자 한도를 넘으면 앞부분을 자른다.

## `RAG 검색`이 만들어내는 것

복원한 이력으로 두 가지를 낸다 (`blocks/rag-search.ts`):

1. **말풍선 2개** — ①전송 요약(누적 N턴, 사용자 N턴) ②대화록 전문(사람이 읽는 형태).
2. **`response.data.ragRequest`** — 실제 RAG 서버로 그대로 POST할 요청 바디. 원문 JSON 토글에서 확인.

```jsonc
// data.ragRequest — 실연동 시 이게 RAG 백엔드로 넘어간다
{ "turnCount": 6, "userTurns": 3,
  "messages": [ { "role": "user", "content": "이용안내" }, /* … */ ] }
```

이력이 아직 없으면(`history.length === 0`) "먼저 몇 마디 주고받은 뒤 다시 눌러라"는 안내를 낸다.

## 로컬(플레이그라운드) 테스트

플레이그라운드는 실제 카카오처럼 **직전 응답의 `context.values`를 다음 요청 최상위 `contexts`로
왕복**시킨다(`App.tsx`의 `contextsRef`). 이 왕복이 있어야 로컬에서도 이력이 누적되고 `RAG 검색`이 동작한다.

> 서버·플레이그라운드를 각각 띄우고 `이용안내` → `화곡동` → `다문화가정`을 주고받은 뒤
> `RAG 검색` 입력 → 대화록과 `data.ragRequest` 확인.

## 한계와 확장

- **전체 이력 무제한 아님**: context 용량 때문에 최근 12턴·절단본만 나른다. 전체 전사를 그대로
  RAG로 넘겨야 한다면 KV/파일 저장소(WAS)가 필요해진다 → 그때 `history.ts`의 read/append/attach를
  KV 구현으로 교체(블록·디스패처는 불변).
- **만료**: `ttl`/`lifeSpan`로 오래 쉬면 이력이 리셋된다(장기 보존 불가).
- **`/echo` 실측 권장**: ①최상위 contexts 왕복이 실제로 되는가 ②`params` 용량 한도가 얼마인가
  ③만료 거동. 이 세 가지로 캡 상수를 실제 스펙에 맞춰 조정한다.

## 실연동으로 넘어갈 때

`RAG 검색` 블록의 `ragRequest` 생성 자리(또는 [폴백 블록](./blocks.md) — RAG 표준 연결 지점)에서
이 페이로드를 실제 RAG 서버로 `POST`하고, 응답을 `SkillResponse`로 변환하면 된다.
