import type { Output, SkillResponse } from "@sprint-kakao/contract";
import { messageQuickReply } from "../builders/outputs.js";

/**
 * 공통 바로가기 — **폴백·온보딩 완료 폴백 등 서버 로컬 응답에서만** 노출.
 * 에이전트 답변에는 붙이지 않는다(에이전트 suggestions에서 나온 버블만 표현 — render-rag.ts).
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

/** outputs를 복지 네비 바로가기와 함께 SkillResponse로 감싼다. */
export function wrap(outputs: Output[]): SkillResponse {
  return { version: "2.0", template: { outputs, quickReplies: NAV_QUICK_REPLIES } };
}
