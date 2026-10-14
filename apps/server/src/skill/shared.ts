import type { Output, QuickReply, SkillResponse } from "@sprint-kakao/contract";
import { MAX_OUTPUTS, MAX_QUICK_REPLIES } from "@sprint-kakao/contract";
import { messageQuickReply, simpleText } from "../builders/outputs.js";

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

/** 세션 연결 발화. connect 블록 매칭·안내 버튼이 공유한다. */
export const CONNECT_UTTERANCE = "AI 복지 연결";

/** 미연결 상태 응답에 노출하는 바로가기(연결 진입 + 온보딩). */
export const CONNECT_QUICK_REPLIES = [
  messageQuickReply(CONNECT_UTTERANCE, CONNECT_UTTERANCE),
  messageQuickReply("맞춤복지", "맞춤복지"),
];

/** 연결 상태 응답에 항상 붙는 종료 바로가기. */
export const EXIT_QUICK_REPLY = messageQuickReply("대화 종료", "대화 종료");

/** 연결 상태 응답 끝에 붙는 종료 안내 말풍선. */
const EXIT_HINT_OUTPUT: Output = simpleText("💬 AI 대화를 마치려면 '종료'라고 입력해 주세요.");

/**
 * 연결(agent 모드) 상태의 응답을 감싼다 — 종료 안내 말풍선과 "대화 종료" 버블을 항상 덧붙인다.
 * 말풍선은 MAX_OUTPUTS 여유가 있을 때만 붙이고, 버블은 에이전트 suggestions 뒤에 둔다(MAX_QUICK_REPLIES 이내).
 */
export function wrapSession(outputs: Output[], quickReplies: QuickReply[] = []): SkillResponse {
  const outs = outputs.length < MAX_OUTPUTS ? [...outputs, EXIT_HINT_OUTPUT] : outputs;
  const qrs = [...quickReplies.slice(0, MAX_QUICK_REPLIES - 1), EXIT_QUICK_REPLY];
  return { version: "2.0", template: { outputs: outs, quickReplies: qrs } };
}
