import type { SkillBlock } from "../types.js";
import { simpleText } from "../../builders/outputs.js";
import { CONNECT_UTTERANCE, EXIT_QUICK_REPLY } from "../shared.js";

/** "AI 복지 연결" (공백 유무·대소문자 허용). */
const CONNECT_RE = new RegExp(`^${CONNECT_UTTERANCE.split(/\s+/).join("\\s*")}$`, "i");

/**
 * 연결 블록 — "AI 복지 연결" 발화로 세션을 **agent 모드**로 전환한다.
 *
 * 이후의 발화는(종료 키워드 제외) agent 블록이 잡아 에이전트로 보낸다.
 * 진입 자체는 동기 안내만 내고 에이전트를 호출하지 않는다. 이미 연결돼 있어도 재진입 안내로 동작.
 */
export const connect: SkillBlock = {
  name: "connect",
  setMode: "agent",
  match: (ctx) => CONNECT_RE.test(ctx.utterance),
  respond: () => ({
    version: "2.0",
    template: {
      outputs: [
        simpleText(
          "🤖 AI 복지 상담에 연결되었습니다.\n" +
            "이제 궁금한 내용을 자유롭게 말씀해 주세요. AI 상담원이 이어서 답변해 드릴게요.\n\n" +
            "대화를 마치려면 언제든 '종료'라고 입력하세요.",
        ),
      ],
      quickReplies: [EXIT_QUICK_REPLY],
    },
  }),
};
