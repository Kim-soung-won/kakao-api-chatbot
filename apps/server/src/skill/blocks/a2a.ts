import type { SkillBlock } from "../types.js";
import { basicCard, messageQuickReply, operatorButton, simpleText } from "../../builders/outputs.js";
import { askA2a } from "../../a2a/client.js";

/**
 * A2A 연동 데모 블록 — **"의료" welfare 키**를 목업 A2A 서비스에 매핑한다.
 *
 * "의료/건강" 발화 시, 외부 A2A 에이전트(목업, SSE 30초)에 질문을 넘겨 최종 답변을 받아 온다.
 * 30초 > 카카오 5초 제한이므로 `callback`으로 처리한다(라우트가 useCallback 플로우로 배선).
 * callbackUrl이 없으면(로컬/콜백 미설정) 동기로 await하고, A2A 실패 시 `respond` 정적 카드로 폴백.
 *
 * welfare 블록보다 먼저 매칭되도록 blocks 배열 앞에 둔다.
 */
export const a2aConsult: SkillBlock = {
  name: "a2a-consult",
  match: (ctx) => /^(의료|건강|의료·건강)$/.test(ctx.utterance),

  // A2A 미가용 시 폴백(정적 안내). 콜백 경로가 정상이면 쓰이지 않는다.
  respond: () => ({
    version: "2.0",
    template: {
      outputs: [
        basicCard({
          title: "의료·건강 지원",
          description:
            "다문화가정 의료비 지원 · 무료 건강검진 · 심리상담.\n(AI 상담 에이전트 연결이 일시적으로 어려워 기본 안내를 보여드려요.)",
          buttons: [operatorButton("상담원 연결")],
        }),
      ],
      quickReplies: [messageQuickReply("신청 절차", "신청 절차"), messageQuickReply("문의", "문의")],
    },
  }),

  callback: {
    waitingText: "AI 상담 에이전트가 의료·건강 지원을 정리하고 있어요… 잠시만 기다려 주세요 🤖",
    run: async (ctx) => {
      const answer = await askA2a(`다문화가정 의료·건강 지원 안내 요청: "${ctx.utterance}"`);
      return {
        version: "2.0",
        template: {
          outputs: [simpleText(answer)],
          quickReplies: [
            messageQuickReply("신청 절차", "신청 절차"),
            messageQuickReply("문의", "문의"),
            messageQuickReply("복지 안내", "복지"),
          ],
        },
      };
    },
  },
};
