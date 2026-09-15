import type { Output, SkillResponse } from "@sprint-kakao/contract";
import { messageQuickReply } from "../builders/outputs.js";

/** 복지 안내 공통 바로가기(폴백 등에서 노출). */
export const NAV_QUICK_REPLIES = [
  messageQuickReply("이용안내", "이용안내"),
  messageQuickReply("맞춤복지", "맞춤복지"),
  messageQuickReply("복지 안내", "복지"),
  messageQuickReply("보육료", "보육료"),
  messageQuickReply("교육활동비", "교육활동비"),
  messageQuickReply("한국어교육", "한국어교육"),
  messageQuickReply("취업지원", "취업"),
  messageQuickReply("신청 절차", "신청 절차"),
  messageQuickReply("RAG 검색", "RAG 검색"),
];

/** outputs를 복지 네비 바로가기와 함께 SkillResponse로 감싼다. */
export function wrap(outputs: Output[]): SkillResponse {
  return { version: "2.0", template: { outputs, quickReplies: NAV_QUICK_REPLIES } };
}
