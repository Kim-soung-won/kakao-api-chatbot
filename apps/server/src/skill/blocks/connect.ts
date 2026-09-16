import type { SkillBlock } from "../types.js";
import { messageQuickReply, simpleText } from "../../builders/outputs.js";

/**
 * 연결 블록 — "AI 안내서비스 연결" 발화로 **에이전트 대화 모드**에 진입한다.
 *
 * 이 블록이 처리되면 세션 모드를 "agent"로 저장(setMode)하고, 이후의 모든 발화는
 * (탈출 명령 제외) agent-chat 블록이 잡아 A2A 에이전트로 흘려보낸다.
 * 진입 자체는 동기 안내(respond)만 내고 A2A를 호출하지 않는다.
 */

/** 모드 진입/이용 중 노출할 바로가기(대화 종료로 빠져나갈 수 있게 항상 제공). */
export const AGENT_QUICK_REPLIES = [messageQuickReply("대화 종료", "대화 종료")];

export const connect: SkillBlock = {
  name: "connect",
  setMode: "agent",
  // "AI 안내서비스 연결" (공백 유무 허용). 이미 agent 모드여도 재진입 인사로 동작.
  match: (ctx) => /^ai\s*안내\s*서비스\s*연결$/i.test(ctx.utterance),
  respond: () => ({
    version: "2.0",
    template: {
      outputs: [
        simpleText(
          "🤖 AI 안내 서비스에 연결되었습니다.\n" +
            "이제 궁금한 내용을 자유롭게 말씀해 주세요. AI 상담원이 이어서 답변해 드릴게요.\n\n" +
            "대화를 마치려면 언제든 '종료'라고 입력하세요.",
        ),
      ],
      quickReplies: AGENT_QUICK_REPLIES,
    },
  }),
};
