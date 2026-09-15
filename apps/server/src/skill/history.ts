import type { ContextValue, SkillPayload, SkillResponse } from "@sprint-kakao/contract";

/**
 * 대화 이력을 **카카오 네이티브 `context` 왕복**만으로 실어 나른다 — 서버 저장소(WAS) 없음.
 *
 * 흐름:
 *   요청 최상위 `contexts[name=chatHistory].params.turns` (직렬화된 JSON)
 *     → readHistory() 로 복원
 *     → 이번 턴을 appendTurns() 로 덧붙임
 *     → toHistoryContext() 로 응답 `context.values` 에 다시 실어 왕복
 *
 * ⚠️ 전제 (`/echo` 실측 대상):
 *   - context.params가 다음 요청 **최상위 `contexts`**로 왕복되는가 (검증 2).
 *     → 실서비스에서 비어 보였던 원인은 읽기 위치였다: 카카오는 최상위로 주는데
 *       `userRequest.contexts`로 읽었음. 아래는 최상위 우선 + 구 위치 폴백.
 *   - params 값 **용량 한도** (검증 3). context는 작은 상태용이라 이력을 **작게 캡**한다
 *     (턴당 텍스트 절단 + 총 문자열 예산). 전체 전사가 필요하면 KV/파일이 필요.
 */

/** 대화 한 턴. params 값은 문자열만 허용되므로 배열째 JSON 직렬화해 싣는다. */
export interface HistoryTurn {
  role: "user" | "bot";
  text: string;
}

/** 이력을 담는 카카오 출력 컨텍스트 이름. */
export const HISTORY_CONTEXT = "chatHistory";
/** context 유지 턴 수. 매 응답마다 재설정해 만료를 연장한다. */
const HISTORY_LIFESPAN = 100;
/** context ttl(초) = 24h. */
const HISTORY_TTL = 86_400;
/** 최근 N턴만 유지. */
export const MAX_TURNS = 12;
/** context에 실을 때 턴당 텍스트 상한(작은 상태 채널이므로 절단). */
const MAX_TURN_TEXT = 200;
/** 직렬화된 turns 문자열 상한(카카오 params 용량 대비 보수적). 초과 시 오래된 턴부터 버림. */
const MAX_CONTEXT_CHARS = 3_500;

/** unknown 값을 HistoryTurn[]로 안전 변환(깨진 항목은 버림). */
export function coerceTurns(value: unknown): HistoryTurn[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is HistoryTurn =>
      !!t &&
      typeof (t as HistoryTurn).text === "string" &&
      ((t as HistoryTurn).role === "user" || (t as HistoryTurn).role === "bot"),
  );
}

/**
 * 요청 payload의 contexts에서 이전 이력을 복원한다. 없거나 깨지면 빈 배열.
 * 카카오는 contexts를 페이로드 **최상위**로 왕복한다. userRequest.contexts는 구 가설 폴백.
 */
export function readHistory(body: unknown): HistoryTurn[] {
  const b = body as Partial<SkillPayload> | undefined;
  const contexts = b?.contexts ?? b?.userRequest?.contexts;
  const ctx = Array.isArray(contexts)
    ? contexts.find((c) => c?.name === HISTORY_CONTEXT)
    : undefined;
  const raw = ctx?.params?.["turns"];
  if (typeof raw !== "string") return [];
  try {
    return coerceTurns(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** 이력에 이번 턴을 덧붙이고 최근 MAX_TURNS만 남긴다(원본 불변). */
export function appendTurns(
  history: HistoryTurn[],
  ...turns: HistoryTurn[]
): HistoryTurn[] {
  const next = [...history, ...turns];
  return next.length > MAX_TURNS ? next.slice(next.length - MAX_TURNS) : next;
}

/** context 적재용 압축: 턴당 텍스트 절단 + 총 문자열 예산 초과 시 오래된 턴부터 제거. */
function compactForContext(history: HistoryTurn[]): HistoryTurn[] {
  let out: HistoryTurn[] = history.map((t) => ({
    role: t.role,
    text: t.text.length > MAX_TURN_TEXT ? t.text.slice(0, MAX_TURN_TEXT) + "…" : t.text,
  }));
  while (out.length > 1 && JSON.stringify(out).length > MAX_CONTEXT_CHARS) {
    out = out.slice(1);
  }
  return out;
}

/** 이력을 카카오 출력 context 값으로 직렬화한다(응답 context.values에 넣음). */
export function toHistoryContext(history: HistoryTurn[]): ContextValue {
  return {
    name: HISTORY_CONTEXT,
    lifeSpan: HISTORY_LIFESPAN,
    ttl: HISTORY_TTL,
    params: { turns: JSON.stringify(compactForContext(history)) },
  };
}

/**
 * 응답에 이력 context를 실어(왕복 유지) 반환한다. 기존 chatHistory 값은 교체.
 * 블록들은 이력을 몰라도 되고, 이 함수가 중앙에서 모든 응답에 context를 주입한다.
 */
export function attachHistoryContext(
  response: SkillResponse,
  history: HistoryTurn[],
): void {
  const values = (response.context?.values ?? []).filter((v) => v.name !== HISTORY_CONTEXT);
  values.push(toHistoryContext(history));
  response.context = { values };
}

/** 응답 outputs의 첫 말풍선을 이력용 짧은 텍스트로 요약한다. */
export function summarizeResponse(res: SkillResponse): string {
  const first = res.template.outputs[0];
  if (!first) return "(빈 응답)";
  if ("simpleText" in first) return first.simpleText.text;
  if ("simpleImage" in first) return `[이미지] ${first.simpleImage.altText ?? ""}`.trim();
  if ("textCard" in first)
    return `[텍스트카드] ${first.textCard.title ?? first.textCard.description ?? ""}`.trim();
  if ("basicCard" in first)
    return `[카드] ${first.basicCard.title ?? first.basicCard.description ?? ""}`.trim();
  if ("commerceCard" in first) return `[커머스카드] ${first.commerceCard.title ?? ""}`.trim();
  if ("listCard" in first) return `[리스트카드] ${first.listCard.header.title}`;
  if ("itemCard" in first)
    return `[아이템카드] ${first.itemCard.head?.title ?? first.itemCard.title ?? ""}`.trim();
  return `[캐러셀] ${first.carousel.items.length}개 카드`;
}
