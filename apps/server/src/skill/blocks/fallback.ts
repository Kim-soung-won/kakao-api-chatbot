import type { SkillBlock } from "../types.js";
import { simpleText } from "../../builders/outputs.js";
import { wrap } from "../shared.js";

/**
 * 폴백 블록 — 어떤 블록에도 매칭되지 않은 경우의 최종 안전망(주로 빈 발화).
 * 자유 질문은 agent 블록이 처리하므로, 여기 도달하는 건 발화가 비었을 때 정도다.
 */
export const fallback: SkillBlock = {
  name: "fallback",
  match: () => true,
  respond: () =>
    wrap([
      simpleText(
        "무엇을 도와드릴까요?\n궁금한 내용을 입력하시면 AI 상담원이 안내해 드려요.\n'맞춤복지'를 누르면 나에게 맞는 복지를 찾아드릴게요.",
      ),
    ]),
};
