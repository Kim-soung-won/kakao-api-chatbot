# 대화 이력 — 에이전트가 관리 (서버 무저장)

> **변경(2026-09-18):** 서버는 더 이상 대화 이력을 저장하지 않는다. 모든 질의가 에이전트(A2A)를
> 거치고, **대화 이력의 저장·관리는 에이전트 측 책임**이 되었기 때문이다. 서버는 이번 발화만
> 에이전트로 넘긴다. 짝 문서: [blocks.md](./blocks.md) · [a2a-callback.md](./a2a-callback.md) · [chatbot.md](./chatbot.md).

## 한 줄 요약

- 서버(`apps/server`)는 발화를 받아 **온보딩 카드 흐름**이면 로컬로 응답하고, 그 외에는 **에이전트로
  전달**한다. 이전 대화를 서버가 기억하지 않는다.
- 멀티턴 맥락(이력)은 **에이전트가 자체적으로 유지**한다. 서버는 stateless에 가깝다
  (온보딩 진행 상태만 발화에 실어 나른다 — 아래).

## 제거된 것 (이전 방식)

이전에는 `botUserKey(userRequest.user.id)`별 JSON 파일(`captured-requests/history/<userId>.json`)에
이력을 적재하고, `RAG 검색` 발화가 그 이력 전체를 A2A로 보냈다. 이제 다음이 **모두 제거**됐다:

- `skill/history.ts`, `skill/history-store.ts`, `skill/session-store.ts`
- `RAG 검색` 블록(`rag-search.ts`), 에이전트 대화 모드 진입/종료(`connect.ts`/`exit.ts`/`agent-chat.ts`)
- `SkillContext.history` / `.mode`, `SkillBlock.transient` / `.setMode`, 디스패처의 `recordTurn`/`applyModeEffect`

> `captured-requests/` 볼륨 자체는 남는다 — `POST /echo`의 요청 원문 캡처 용도. 이력·세션 하위
> 폴더만 더 이상 쓰지 않는다.

## 왜 서버가 이력을 안 갖나

- **모든 채팅이 에이전트를 통한다.** 이력의 단일 소유자가 에이전트이므로, 서버가 별도로 이력을
  쌓으면 이중 관리·불일치가 생긴다. 소유권을 에이전트로 일원화했다.
- 과거 실측(카카오 output `context` 왕복 미동작)은 여전히 유효하지만, 그 우회로 택했던 서버 파일
  저장소가 더는 필요 없어졌다. 카카오 대화 이력 직접 조회 API도 없다 → [kakao-history-api.md](./kakao-history-api.md).

## 온보딩 진행 상태는 어떻게 나르나 (서버 무저장 유지)

온보딩(지역→가구→관심)은 앞 단계 선택을 기억해야 완료 시 프로필을 한 번에 에이전트로 넘길 수
있다. 서버가 상태를 저장하지 않고 카카오 context도 왕복되지 않으므로, **진행 상태를 다음 발화
(quickReply의 `messageText`)에 누적해 실어 나른다.**

```
지역 선택      utterance="화곡동"
가구 단계 버튼  messageText="화곡동 / 다문화가정"
관심 단계 버튼  messageText="화곡동 / 다문화가정 / 교육·진학"   ← 완료: 3조각 파싱 → 에이전트로 프로필 전달
```

- 구분자 `" / "` — INTERESTS는 `"·"`만 쓰므로 충돌하지 않는다(`onboarding.ts`).
- 완료 단계에서만 콜백(에이전트)으로 처리하고, 카드 단계는 동기 응답이다.

## 에이전트로 넘어가는 것

- **자유 발화**: `agent` 블록이 발화 그대로 A2A로 전달(`askA2a({ question })`).
- **온보딩 완료**: 수집 프로필(지역·가구·관심)을 질의 텍스트로 만들어 A2A로 전달.
- 에이전트 답변은 `render-agent.ts`(임시 어댑터)가 SkillResponse로 변환한다. 에이전트의 정식
  SkillResponse 응답 형식은 **추후 확정 예정**이며, 확정되면 통과(passthrough)로 교체한다.
- 5초 초과라 카카오 콜백으로 최종 응답을 보낸다 → [a2a-callback.md](./a2a-callback.md).
