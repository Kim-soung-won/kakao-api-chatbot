import type { Output, QuickReply, SkillResponse } from "@sprint-kakao/contract";
import { MAX_QUICK_REPLIES } from "@sprint-kakao/contract";
import { messageQuickReply } from "../builders/outputs.js";

/**
 * 공통 바로가기(에이전트 답변·폴백에서 노출).
 * 온보딩 시작("맞춤복지") 외의 항목은 그대로 발화로 되쏘아져 에이전트가 처리한다.
 */
export const NAV_QUICK_REPLIES = [
  messageQuickReply("맞춤복지", "맞춤복지"),
  messageQuickReply("보육료", "보육료"),
  messageQuickReply("교육활동비", "교육활동비"),
  messageQuickReply("한국어교육", "한국어교육"),
  messageQuickReply("취업지원", "취업지원"),
  messageQuickReply("신청 절차", "신청 절차"),
];

/**
 * 후속 제안 칩(suggestions) + 공통 NAV 바로가기를 병합한다. 앞선 항목 우선, messageText(없으면
 * label) 기준 중복 제거, 카카오 상한(10개)으로 절단. RAG 응답의 suggestion 칩을 NAV보다 앞에 둔다.
 */
export function mergeQuickReplies(suggestionQr: QuickReply[] = []): QuickReply[] {
  const seen = new Set<string>();
  const merged: QuickReply[] = [];
  for (const qr of [...suggestionQr, ...NAV_QUICK_REPLIES]) {
    const key = qr.messageText ?? qr.label;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(qr);
    if (merged.length >= MAX_QUICK_REPLIES) break;
  }
  return merged;
}

/** outputs를 복지 네비 바로가기와 함께 SkillResponse로 감싼다. */
export function wrap(outputs: Output[]): SkillResponse {
  return { version: "2.0", template: { outputs, quickReplies: NAV_QUICK_REPLIES } };
}
