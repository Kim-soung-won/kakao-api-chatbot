import type { SkillBlock } from "../types.js";
import { simpleText } from "../../builders/outputs.js";

/**
 * 폴백 블록 — 어떤 블록에도 매칭되지 않은 경우의 최종 안전망(빈 발화).
 * 자유 질문은 agent 블록이 처리하므로, 여기 도달하는 건 발화가 비었을 때 정도다.
 */
export const fallback: SkillBlock = {
  name: "fallback",
  match: () => true,
  respond: () => ({
    version: "2.0",
    template: {
      outputs: [simpleText("무엇을 도와드릴까요?\n궁금한 내용을 입력하시면 AI 상담원이 안내해 드려요.")],
    },
  }),
};
