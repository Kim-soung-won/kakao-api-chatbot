import type { SkillResponse } from "@sprint-kakao/contract";

/**
 * 대화 이력 도메인 헬퍼(순수 로직). 실제 적재/조회는 file store(history-store.ts)가 담당한다.
 *
 * 저장 방식 결정 배경:
 *   당초 카카오 네이티브 `context` 왕복만으로 이력을 실어 나르려 했으나, 실서비스에서
 *   왕복이 확인되지 않아(항상 빈 이력) botUserKey(userRequest.user.id) 기반 **파일 저장소**로
 *   전환했다. 파일은 docker 볼륨(captured-requests/)에 적재돼 호스트에서 그대로 확인·수집된다.
 */

/** 대화 한 턴. */
export interface HistoryTurn {
  role: "user" | "bot";
  text: string;
}

/** 왕복/적재 페이로드 크기 가드: 최근 N턴만 유지. */
export const MAX_TURNS = 40;

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

/** 이력에 이번 턴을 덧붙이고 최근 MAX_TURNS만 남긴다(원본 불변). */
export function appendTurns(
  history: HistoryTurn[],
  ...turns: HistoryTurn[]
): HistoryTurn[] {
  const next = [...history, ...turns];
  return next.length > MAX_TURNS ? next.slice(next.length - MAX_TURNS) : next;
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
