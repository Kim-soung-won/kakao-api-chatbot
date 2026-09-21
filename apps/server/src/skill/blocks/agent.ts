import type { Output, QuickReply, SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock } from "../types.js";
import { simpleText } from "../../builders/outputs.js";
import { askRagAgent } from "../../a2a/rag-client.js";
import { renderRag } from "../render-rag.js";

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
 * RAG 에이전트(docs/rag-agent-직접연동-가이드v4.md) 응답은 renderRag로 SkillResponse 출력으로
 * 변환한다 — 안내문은 리드 텍스트, sources는 네이티브 카드(itemCard), suggestions는 후속 제안 칩.
 * 서버는 상태가 없으므로 조건(거주지 코드 등) 없이 발화만 질의로 보낸다(가이드 §2.4). 후속 발화의
 * 맥락 조립·거주지 코드 매핑은 향후 과제.
 */

/**
 * 렌더된 출력을 SkillResponse로 감싼다. 버블(quickReplies)은 **에이전트 응답의 suggestions에서
 * 나온 것만** 노출한다 — 서버 고정 NAV 목록을 덧붙이지 않는다. 에이전트가 제안을 안 주면 버블 없음.
 */
function wrapAgent(outputs: Output[], suggestionQr: QuickReply[] = []): SkillResponse {
  return {
    version: "2.0",
    template: {
      outputs,
      ...(suggestionQr.length ? { quickReplies: suggestionQr } : {}),
    },
  };
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
      // sessionId = botUserKey — 같은 채팅방의 턴을 에이전트가 세션으로 묶는다.
      const result = await askRagAgent({ query: ctx.utterance, sessionId: ctx.userId });
      const { outputs, quickReplies } = renderRag(result);
      return wrapAgent(outputs, quickReplies);
    },
  },
};
