import type { SkillBlock } from "../types.js";
import type { HistoryTurn } from "../history.js";
import { TEXT_LIMITS } from "@sprint-kakao/contract";
import { messageQuickReply, simpleText } from "../../builders/outputs.js";

/**
 * RAG 검색 블록 — RAG 백엔드 연동 전, **대화 이력 전송 파이프라인을 검증**하는 데모.
 *
 * botUserKey별 파일 저장소(captured-requests/history/)에 누적된 지금까지의 대화(ctx.history)를
 * 그대로 답변 말풍선에 그려, "RAG 서비스가 붙었을 때 전 대화 이력을 그 서버로 넘길 수 있는가"를
 * 눈으로 확인한다. 실제 연동 시엔 이 자리에서 아래 `ragRequest`를 RAG 서버로 POST하면 된다.
 *
 * transient=true — 이 메타 명령 자체는 이력에 남기지 않는다(이력 오염 방지).
 */

const ROLE_LABEL: Record<HistoryTurn["role"], string> = {
  user: "🙋 사용자",
  bot: "🤖 도우미",
};

const RAG_QUICK_REPLIES = [
  messageQuickReply("이용안내", "이용안내"),
  messageQuickReply("맞춤복지", "맞춤복지"),
  messageQuickReply("RAG 검색", "RAG 검색"),
];

/** 이력을 사람이 읽을 대화록으로. simpleText 한도(1000자)를 넘으면 앞부분을 자른다. */
function transcript(history: HistoryTurn[]): string {
  const body = history
    .map((t) => `${ROLE_LABEL[t.role]}: ${t.text.replace(/\s*\n+\s*/g, " ").trim()}`)
    .join("\n");
  const limit = TEXT_LIMITS.simpleText;
  if (body.length <= limit) return body;
  return "…(이전 생략)\n" + body.slice(body.length - (limit - 20));
}

export const ragSearch: SkillBlock = {
  name: "rag-search",
  transient: true,
  match: (ctx) => /^rag\s*(검색|search)$/i.test(ctx.utterance),
  respond: (ctx) => {
    const history = ctx.history;

    if (history.length === 0) {
      return {
        version: "2.0",
        template: {
          outputs: [
            simpleText(
              "아직 RAG 서버로 보낼 대화 이력이 없어요.\n" +
                "먼저 몇 마디 주고받은 뒤 다시 'RAG 검색'을 입력하면, 지금까지의 대화를 그대로 보여드려요.",
            ),
          ],
          quickReplies: RAG_QUICK_REPLIES,
        },
      };
    }

    // 실제 RAG 서비스로 그대로 POST할 요청 페이로드(파일 저장소에서 로드한 전체 이력).
    const ragRequest = {
      turnCount: history.length,
      userTurns: history.filter((t) => t.role === "user").length,
      messages: history.map((t) => ({ role: t.role, content: t.text })),
    };

    return {
      version: "2.0",
      template: {
        outputs: [
          simpleText(
            `🔎 RAG 서버 전송 시뮬레이션\n` +
              `누적된 대화 ${history.length}턴(사용자 ${ragRequest.userTurns}턴)을 RAG 서비스로 전송합니다.\n` +
              `RAG 백엔드가 붙으면 아래 대화 이력이 그대로 그 서버로 POST됩니다.`,
          ),
          simpleText(transcript(history)),
        ],
        quickReplies: RAG_QUICK_REPLIES,
      },
      // 원문 JSON 토글에서 확인 가능 — 이 객체가 곧 RAG 서버로 넘길 요청 바디다.
      data: { ragRequest },
    };
  },
};
