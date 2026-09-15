# RAG 대화 이력 적재 — `RAG 검색`이 쓰는 이력은 어떻게 쌓이나

> RAG 백엔드 연동 **전에**, "지금까지의 대화 이력 전부를 RAG 서버로 넘길 수 있는가"를
> 검증하기 위한 데모의 동작 문서. `RAG 검색` 발화가 그리는 이력이 **어디에·어떻게** 적재되는지 설명한다.
> 짝 문서: [blocks.md](./blocks.md) · [chatbot.md](./chatbot.md).
> 코드: `apps/server/src/skill/history-store.ts`, `history.ts`, `blocks/rag-search.ts`.

## 한 줄 요약

대화 이력은 **botUserKey(`userRequest.user.id`)별 JSON 파일**로 적재된다 —
`captured-requests/history/<userId>.json`. 매 `/skill` 턴마다 이전 이력을 로드 → 이번 턴을
덧붙여 저장한다. `RAG 검색`은 이 파일에서 이력을 읽어 화면에 그리고, 동시에 RAG 서버로
그대로 POST할 요청 바디(`data.ragRequest`)를 만들어 노출한다.

> ⚠️ **왜 파일인가 (실측 확정):** 처음엔 서버 저장소 없이 카카오 네이티브 `context` 왕복만으로
> 이력을 나르려 했으나, **실카톡 진단으로 왕복 미동작을 확인**했다 — 응답에 심은 output context가
> 다음 요청으로 돌아오지 않고 요청 최상위 `contexts`가 **매번 빈 배열**(`userRequest.contexts`는
> 필드 없음)이었다. 반면 `user.id`(botUserKey)는 64자 해시로 **안정적**이라 이를 키로 한 파일
> 저장소로 전환했다. 파일은 docker 볼륨에 적재돼 호스트에서 확인·수집되고 컨테이너 재생성에도
> 보존된다. → 결정 d1·d10 (C4 designIntent).
>
> 진단 근거는 `RAG 검색`이 이력이 없을 때 출력하는 "🩺 수신 진단"으로 재확인 가능
> (`blocks/rag-search.ts`의 `diagnoseIncoming`).

## 적재 위치와 볼륨

```
컨테이너  /app/captured-requests/history/<botUserKey>.json
              │  docker 볼륨 마운트 (docker-compose.yml)
              ▼
호스트    ./captured-requests/history/<botUserKey>.json
```

- 같은 볼륨을 `/echo` 요청 원문 캡처와 **공유**한다 (`captured-requests/` 하위 `history/` 폴더로 분리).
- `captured-requests/`는 `.gitignore` 대상 — 이력 파일은 커밋되지 않는다.
- 파일명은 botUserKey를 안전화(`[^a-zA-Z0-9_-]`→`_`)한 값. 값이 없으면 `anonymous`.

## 적재 경로 (한 바퀴)

```
[카카오 요청]  userRequest.user.id (botUserKey) + utterance
      │
      ▼  parseSkillContext(body)                 index.ts
[SkillContext]  { userId, utterance, history }   ← loadHistory(userId)로 파일에서 복원
      │
      ▼  블록 디스패치 → respond()               index.ts:handleSkill
[이번 턴 응답 생성]
      │
      ▼  appendTurns(history, {user}, {bot})     history.ts  (transient 블록은 건너뜀)
[갱신된 이력]  최근 40턴만 유지
      │
      ▼  saveHistory(userId, history)            history-store.ts
[파일에 덮어쓰기]  captured-requests/history/<userId>.json
```

`handleSkill`이 디스패치 후 이번 턴을 파일에 적재한다. 개별 블록(help·welfare·fallback…)은
이력을 몰라도 되고, 자기 응답만 만든다.

## 적재되는 파일 포맷

```jsonc
// captured-requests/history/kakao-user-42.json
{
  "userId": "kakao-user-42",
  "updatedAt": "2026-09-15T07:35:16.220Z",
  "turns": [
    { "role": "user", "text": "이용안내" },
    { "role": "bot",  "text": "[카드] 강서구 AI 복지도우미 · 이용안내" },
    { "role": "user", "text": "화곡동" }
    // …
  ]
}
```

- 한 턴(`HistoryTurn`) = `{ role: "user" | "bot", text: string }`.
- 사용자 턴 `text` = 발화 원문. 봇 턴 `text` = 응답 첫 말풍선 요약(`summarizeResponse`,
  카드류는 `[카드] 제목`·`[리스트카드] 헤더` 식으로 압축).

## 어떤 턴이 적재되는가 (규칙)

| 조건 | 적재 |
| --- | --- |
| 일반 블록 응답 + 발화 있음 | ✅ user 턴 + bot 턴 2개 추가 후 파일 저장 |
| `transient` 블록 (`RAG 검색`) | ❌ 이력에 안 남김 (메타 명령이라 이력 오염 방지) |
| 빈 발화 | ❌ 건너뜀 |

> `SkillBlock.transient` 플래그는 `types.ts`에 있고, 현재 `rag-search` 블록만 `true`다.
> 그래서 `RAG 검색`을 여러 번 눌러도 이력이 `RAG 검색`으로 오염되지 않는다.

## 적재 상한 (크기 가드)

| 상수 | 값 | 의미 |
| --- | --- | --- |
| `MAX_TURNS` (`history.ts`) | 40 | 파일·전송 페이로드 비대화 방지. 최근 40턴만 남기고 앞은 버림 |

`RAG 검색` 렌더 시엔 추가로, 대화록 말풍선이 `simpleText` 1000자 한도를 넘으면 앞부분을 자른다.

## `RAG 검색`이 하는 일

파일에서 로드한 이력(`ctx.history`)을 **RAG(A2A) 서비스로 전송**해 답변을 받아 온다
(`blocks/rag-search.ts`). RAG 호출은 30초라 카카오 콜백으로 처리 → 상세 흐름은
[a2a-callback.md](./a2a-callback.md).

- **이력 있음**: 콜백으로 대화 이력 전체(`ragRequest.messages`)를 RAG에 POST → 최종 답변을
  `callbackUrl`로 전달. `response.data.ragRequest`에 전송 바디도 실어 확인 가능.
- **이력 없음**: 콜백 없이 즉시 "먼저 몇 마디 주고받으라"는 안내(+수신 진단)를 낸다.
- **콜백 미설정/지연**: 예산(3.5s) 초과 시 폴백으로 로컬 이력(대화록)을 표시.

```jsonc
// data.ragRequest — RAG 백엔드로 넘어가는 요청 바디(대화 이력 전체)
{
  "turnCount": 6,
  "userTurns": 3,
  "messages": [
    { "role": "user", "content": "이용안내" },
    { "role": "bot",  "content": "[카드] 강서구 AI 복지도우미 · 이용안내" }
    // …
  ]
}
```

## 로컬(플레이그라운드) 테스트

플레이그라운드는 고정 `user.id`로 매 요청을 보내고, 서버가 그 키로 파일에 이력을 누적한다.
`/skill`은 dev 프록시로 :3000 서버에 닿으므로 플레이그라운드에서도 파일 저장소가 동작한다.

> 서버·플레이그라운드를 각각 띄우고 `이용안내` → `화곡동` → `다문화가정`을 주고받은 뒤
> `RAG 검색` 입력 → 대화록과 `data.ragRequest` 확인. 적재된 파일은
> `apps/server/captured-requests/history/`(로컬 dev) 또는 볼륨 마운트 경로에서 열람.

## 한계와 확장

- **데모용 단순 저장소**: 파일 단위 last-write-wins(동시 요청 경합 미보호), 프로세스 로컬 파일시스템.
- **botUserKey 고정성 전제**: 이력 키가 `userRequest.user.id`이므로, 이 값의 세션 간 고정성
  (검증 대상 1)이 전제다. `/echo`로 실측 확정하면 좋다.
- **확장 경로**: 다중 인스턴스·영속성이 필요해지면 `history-store.ts`의 `load`/`save` 인터페이스는
  그대로 두고 구현만 KV·DB로 갈아끼운다. 블록·디스패처는 바뀌지 않는다.

## 실연동으로 넘어갈 때

`RAG 검색` 블록의 `ragRequest` 생성 자리(또는 [폴백 블록](./blocks.md) — RAG 표준 연결 지점)에서
이 페이로드를 실제 RAG 서버로 `POST`하고, 응답을 `SkillResponse`로 변환하면 된다. 이력 적재 경로
자체는 바뀌지 않는다.
