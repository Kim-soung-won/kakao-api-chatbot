import type { SkillBlock } from "../types.js";
import { simpleText } from "../../builders/outputs.js";
import { CONNECT_QUICK_REPLIES } from "../shared.js";

/** 세션 종료 키워드. */
const EXIT_WORDS = ["종료", "대화 종료", "연결 해제"];

/**
 * 종료 블록 — 세션을 해제(setMode:null)한다.
 * 매칭 순서상 agent보다 앞이라 연결 상태에서도 이 키워드는 에이전트로 넘어가지 않는다.
 */
export const exit: SkillBlock = {
  name: "exit",
  setMode: null,
  match: (ctx) => EXIT_WORDS.includes(ctx.utterance),
  respond: (ctx) => ({
    version: "2.0",
    template: {
      outputs: [
        simpleText(
          ctx.mode === "agent"
            ? "AI 복지 상담을 종료했어요. 이용해 주셔서 감사합니다 🙏\n다시 상담하려면 'AI 복지 연결'을 눌러 주세요."
            : "연결된 AI 상담이 없어요.\n상담을 시작하려면 'AI 복지 연결'을 눌러 주세요.",
        ),
      ],
      quickReplies: CONNECT_QUICK_REPLIES,
    },
  }),
};
