import type { SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock } from "../types.js";
import { messageQuickReply, simpleText, textCard } from "../../builders/outputs.js";

/**
 * 고정 답변 블록 — 정해진 발화에는 에이전트를 부르지 않고 **고정 응답**을 돌려준다.
 * (채널 메뉴 버튼 등에서 들어오는 안내성 질의. 동기 응답, 상태 없음.)
 *
 * 매칭은 공백을 무시한 완전 일치. 새 고정 답변은 FIXED_ANSWERS에 항목만 추가하면 된다.
 */

const INTRO = "AI 복지 채널 소개";
const COUNSEL = "상담사 연결 방법 안내";

/** 고정 답변 사이를 오갈 수 있게 붙이는 바로가기. */
const FIXED_QUICK_REPLIES = [
  messageQuickReply("채널 소개", INTRO),
  messageQuickReply("상담사 연결 방법", COUNSEL),
];

const FIXED_ANSWERS: Record<string, SkillResponse> = {
  [INTRO]: {
    version: "2.0",
    template: {
      outputs: [
        textCard({
          title: "AI 복지 채널 소개",
          description:
            "AI 상담원이 받을 수 있는 복지 제도를 찾아 안내해 드리는 채널이에요.\n\n" +
            "• 궁금한 복지 내용을 채팅창에 자유롭게 입력해 주세요.\n" +
            "• 지원 내용·신청 기간·문의처를 카드로 정리해 보여 드려요.\n" +
            "• 사람 상담사와 이야기하고 싶다면 '상담사 연결 방법 안내'를 확인해 주세요.",
        }),
      ],
      quickReplies: FIXED_QUICK_REPLIES,
    },
  },
  [COUNSEL]: {
    version: "2.0",
    template: {
      outputs: [
        simpleText(
          "👩‍💼 상담사 연결 방법 안내\n\n" +
            "카카오톡 채팅방에서 '상담 연결' 버튼을 누른 뒤 대화를 남겨 주세요.\n" +
            "남겨 주신 대화는 상담사가 확인한 후 답변해 드려요.",
        ),
      ],
      quickReplies: FIXED_QUICK_REPLIES,
    },
  },
};

/** 공백 제거 키 → 응답. */
const BY_KEY = new Map(
  Object.entries(FIXED_ANSWERS).map(([utterance, res]) => [utterance.replace(/\s+/g, ""), res]),
);
const keyOf = (u: string) => u.replace(/\s+/g, "");

export const fixed: SkillBlock = {
  name: "fixed",
  match: (ctx) => BY_KEY.has(keyOf(ctx.utterance)),
  respond: (ctx) => BY_KEY.get(keyOf(ctx.utterance))!,
};
