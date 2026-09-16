import type { Output, SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock } from "../types.js";
import { simpleText } from "../../builders/outputs.js";
import { askA2a } from "../../a2a/client.js";
import { renderAgentAnswer } from "../render-agent.js";
import { AGENT_QUICK_REPLIES } from "./connect.js";

/**
 * 에이전트 대화 블록 — 세션이 "agent" 모드일 때 **모든 발화를 A2A 에이전트로 전달**한다.
 *
 * 진입은 connect 블록("AI 안내서비스 연결"), 이탈은 exit 블록("종료" 등)이 담당한다.
 * 이 두 블록이 매칭 순서상 agent-chat보다 앞이므로, 그 외 발화는 전부 여기로 떨어진다.
 *
 * A2A는 5초를 넘길 수 있어 콜백 플로우로 처리한다(rag-search와 동일):
 * callbackUrl 있으면 즉시 대기응답 후 백그라운드에서 A2A 호출→callbackUrl POST,
 * 없으면 예산 내 동기 시도 후 폴백(respond). 대화 턴은 이력에 기록한다(transient 아님).
 *
 * 에이전트 평문 답변은 renderAgentAnswer로 케이스별 카드/텍스트로 렌더하고,
 * 매 응답 끝에 "종료로 대화를 끝낼 수 있음"을 알리는 안내 말풍선을 항상 덧붙인다.
 */

/** 매 응답 끝에 붙는 종료 안내 말풍선(중요 요구사항 — 항상 노출). */
const EXIT_HINT_OUTPUT: Output = simpleText(
  "💬 AI 대화를 마치려면 '종료'라고 입력해 주세요.",
);

/** 렌더된 출력 뒤에 종료 안내를 붙여 SkillResponse로 감싼다. */
function withExitHint(outputs: Output[]): SkillResponse {
  return {
    version: "2.0",
    template: {
      outputs: [...outputs, EXIT_HINT_OUTPUT],
      quickReplies: AGENT_QUICK_REPLIES,
    },
  };
}

export const agentChat: SkillBlock = {
  name: "agent-chat",
  // 세션이 agent 모드이고 발화가 있을 때만. (빈 발화는 폴백으로 흘려보냄)
  match: (ctx) => ctx.mode === "agent" && ctx.utterance.length > 0,

  // 콜백 미설정/예산 초과/A2A 실패 시 폴백.
  respond: (ctx) =>
    withExitHint([
      simpleText(
        `죄송해요, "${ctx.utterance}" 에 대한 AI 응답을 지금 받지 못했어요.\n잠시 후 다시 시도해 주세요.`,
      ),
    ]),

  callback: {
    waitingText: "AI 상담원이 답변을 준비하고 있어요… 잠시만 기다려 주세요 🤖",
    run: async (ctx) => {
      const answer = await askA2a({ question: ctx.utterance });
      return withExitHint(renderAgentAnswer(answer));
    },
  },
};
