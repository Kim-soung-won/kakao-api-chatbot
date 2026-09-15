import type { Output, SkillResponse } from "@sprint-kakao/contract";
import { messageQuickReply } from "../builders/outputs.js";

/** 데모 탐색용 공통 바로가기(footer). */
export const DEMO_QUICK_REPLIES = [
  messageQuickReply("🏛️복지도우미", "복지도우미"),
  messageQuickReply("맞춤안내 시작", "맞춤복지"),
  messageQuickReply("복지카드", "복지"),
  messageQuickReply("카드", "카드"),
  messageQuickReply("리스트", "리스트"),
  messageQuickReply("이미지", "이미지"),
  messageQuickReply("캐러셀", "캐러셀"),
  messageQuickReply("⚠️위반", "위반"),
];

/** outputs를 공통 바로가기와 함께 SkillResponse로 감싼다. */
export function wrap(outputs: Output[]): SkillResponse {
  return { version: "2.0", template: { outputs, quickReplies: DEMO_QUICK_REPLIES } };
}

export const IMG_2_1 = "https://placehold.co/800x400/png";
export const IMG_1_1 = "https://placehold.co/400x400/png";
