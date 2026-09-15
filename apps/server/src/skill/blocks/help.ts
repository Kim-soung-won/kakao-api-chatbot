import type { SkillBlock } from "../types.js";
import { basicCard, messageButton, messageQuickReply, operatorButton } from "../../builders/outputs.js";

/**
 * 이용안내 · 도움말 블록 — 봇 기능 소개 + 주요 진입점 안내.
 * "맞춤복지"는 온보딩 시나리오 시작(별도 블록)으로 이어진다.
 */
export const help: SkillBlock = {
  name: "help",
  match: (ctx) => /이용안내|이용 안내|도움말|사용법|사용 방법|메뉴|헬프|help/i.test(ctx.utterance),
  respond: () => ({
    version: "2.0",
    template: {
      outputs: [
        basicCard({
          title: "강서구 AI 복지도우미 · 이용안내",
          description:
            "다문화가정 맞춤 복지 정보를 안내해요.\n\n• 맞춤 복지 추천 (지역·가구·관심 분야)\n• 복지 항목 안내 (보육료·교육·한국어·취업·의료·주거)\n• 신청 절차·문의\n\n아래 버튼을 누르거나 원하는 복지를 입력해 보세요.",
          buttons: [
            messageButton("맞춤 복지 시작", "맞춤복지"),
            messageButton("복지 안내", "복지"),
            operatorButton("상담원 연결"),
          ],
        }),
      ],
      quickReplies: [
        messageQuickReply("맞춤복지", "맞춤복지"),
        messageQuickReply("복지 안내", "복지"),
        messageQuickReply("신청 절차", "신청 절차"),
        messageQuickReply("문의", "문의"),
      ],
    },
  }),
};
