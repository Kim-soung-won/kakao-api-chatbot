import type { Output, SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock } from "../types.js";
import { simpleText } from "../../builders/outputs.js";
import { askA2a } from "../../a2a/client.js";
import { renderAgentAnswer } from "../render-agent.js";
import { NAV_QUICK_REPLIES } from "../shared.js";

/**
 * 에이전트 블록 — 온보딩을 제외한 **모든 발화를 A2A 에이전트로 전달**하는 캐치올.
 *
 * 이전의 에이전트 대화 "모드"(connect/exit/agent-chat)는 제거됐다. 이제 별도 진입/종료 없이
 * 온보딩 외 모든 질의가 곧바로 에이전트로 흐른다. 대화 이력도 서버가 저장하지 않고
 * 에이전트가 관리하므로, 서버는 이번 발화만 넘긴다.
 *
 * A2A는 5초를 넘길 수 있어 콜백 플로우로 처리한다:
 * callbackUrl 있으면 즉시 대기응답 후 백그라운드에서 A2A 호출→callbackUrl POST,
 * 없으면 예산 내 동기 시도 후 폴백(respond).
 *
 * 에이전트 답변은 renderAgentAnswer로 SkillResponse 출력으로 변환한다. 에이전트가 이미
 * 구조화된 SkillResponse/Output을 반환하면 그대로 통과(passthrough)하고, 평문이면 카드/텍스트로
 * 렌더한다. (에이전트의 정식 SkillResponse 형식은 추후 확정 예정 — 그때 renderAgentAnswer 교체.)
 */

/** 렌더된 출력을 공통 바로가기와 함께 SkillResponse로 감싼다. */
function wrapAgent(outputs: Output[]): SkillResponse {
  return { version: "2.0", template: { outputs, quickReplies: NAV_QUICK_REPLIES } };
}

export const agent: SkillBlock = {
  name: "agent",
  // 발화가 있으면 무엇이든 에이전트로. (빈 발화는 폴백으로 흘려보냄)
  match: (ctx) => ctx.utterance.length > 0,

  // 콜백 미설정/예산 초과/A2A 실패 시 폴백.
  respond: (ctx) =>
    wrapAgent([
      simpleText(
        `죄송해요, "${ctx.utterance}" 에 대한 AI 응답을 지금 받지 못했어요.\n잠시 후 다시 시도해 주세요.`,
      ),
    ]),

  callback: {
    waitingText: "AI 상담원이 답변을 준비하고 있어요… 잠시만 기다려 주세요 🤖",
    run: async (ctx) => {
      const answer = await askA2a({ question: ctx.utterance });
      return wrapAgent(renderAgentAnswer(answer));
    },
  },
};
