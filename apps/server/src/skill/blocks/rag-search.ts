import type { SkillBlock } from "../types.js";
import type { HistoryTurn } from "../history.js";
import { TEXT_LIMITS } from "@sprint-kakao/contract";
import { messageQuickReply, simpleText } from "../../builders/outputs.js";
import { askA2a } from "../../a2a/client.js";

/**
 * RAG 검색 블록 — 지금까지의 **대화 이력 전체를 RAG(A2A) 서비스로 전송**해 답변을 받아 온다.
 *
 * 이력이 있으면 콜백 플로우로 처리: 즉시 대기응답 후 백그라운드에서 RAG 호출(목업 SSE 30초) →
 * 최종 답변을 callbackUrl로 POST. 콜백 미설정이면 예산 내 동기 시도 후 폴백(로컬 이력 표시).
 * 이력이 없으면 콜백 없이 즉시 안내(+수신 진단)를 respond로 낸다.
 *
 * transient=true — 이 메타 명령 자체는 대화 이력에 남기지 않는다.
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

/** 이력을 RAG 요청 페이로드로. 실제 RAG 서버로 그대로 POST할 형태. */
function buildRagRequest(history: HistoryTurn[]) {
  return {
    turnCount: history.length,
    userTurns: history.filter((t) => t.role === "user").length,
    messages: history.map((t) => ({ role: t.role, content: t.text })),
  };
}

/** 이력을 사람이 읽을 대화록으로. simpleText 한도(1000자)를 넘으면 앞부분을 자른다. */
function transcript(history: HistoryTurn[]): string {
  const body = history
    .map((t) => `${ROLE_LABEL[t.role]}: ${t.text.replace(/\s*\n+\s*/g, " ").trim()}`)
    .join("\n");
  const limit = TEXT_LIMITS.simpleText;
  if (body.length <= limit) return body;
  return "…(이전 생략)\n" + body.slice(body.length - (limit - 20));
}

/**
 * 진단 — 서버가 이번 요청에서 실제로 받은 contexts와 botUserKey를 요약(이력 없을 때만).
 * 카카오 output context 왕복 미동작 + 파일 저장소 채택 근거를 언제든 재확인하기 위한 계측.
 */
function diagnoseIncoming(raw: unknown): string {
  const b = raw as
    | { contexts?: unknown; userRequest?: { contexts?: unknown; user?: { id?: unknown } } }
    | undefined;
  const top = Array.isArray(b?.contexts) ? (b!.contexts as unknown[]) : null;
  const nested = Array.isArray(b?.userRequest?.contexts)
    ? (b!.userRequest!.contexts as unknown[])
    : null;
  const uid = b?.userRequest?.user?.id;
  return (
    `🩺 수신 진단\n` +
    `· 최상위 contexts: ${top ? `${top.length}개` : "필드 없음"}\n` +
    `· userRequest.contexts: ${nested ? `${nested.length}개` : "필드 없음"}\n` +
    `· user.id: ${typeof uid === "string" && uid ? uid : "(없음)"}`
  );
}

export const ragSearch: SkillBlock = {
  name: "rag-search",
  transient: true,
  match: (ctx) => /^rag\s*(검색|search)$/i.test(ctx.utterance),

  // 콜백 폴백 / 이력 없음 경로.
  respond: (ctx) => {
    if (ctx.history.length === 0) {
      return {
        version: "2.0",
        template: {
          outputs: [
            simpleText(
              "아직 RAG 서버로 보낼 대화 이력이 없어요.\n" +
                "먼저 몇 마디 주고받은 뒤 다시 'RAG 검색'을 입력해 주세요.",
            ),
            simpleText(diagnoseIncoming(ctx.raw)),
          ],
          quickReplies: RAG_QUICK_REPLIES,
        },
      };
    }
    // 콜백 미설정 + 예산 초과 / RAG 실패 시 폴백: 로컬 이력이라도 그려준다.
    const ragRequest = buildRagRequest(ctx.history);
    return {
      version: "2.0",
      template: {
        outputs: [
          simpleText(
            `🔎 (RAG 서버 응답 지연/미설정) 지금까지의 대화 ${ragRequest.turnCount}턴을 로컬에 표시합니다.\n` +
              `실제 답변을 받으려면 콜백을 활성화하거나 A2A_DURATION_MS를 낮추세요.`,
          ),
          simpleText(transcript(ctx.history)),
        ],
        quickReplies: RAG_QUICK_REPLIES,
      },
      data: { ragRequest },
    };
  },

  // 이력이 있을 때만 콜백으로 RAG 호출.
  callback: {
    when: (ctx) => ctx.history.length > 0,
    waitingText: "지금까지의 대화를 RAG로 검색하고 있어요… 잠시만 기다려 주세요 🔎",
    run: async (ctx) => {
      const ragRequest = buildRagRequest(ctx.history);
      const answer = await askA2a({
        question: [...ctx.history].reverse().find((t) => t.role === "user")?.text,
        messages: ragRequest.messages,
      });
      return {
        version: "2.0",
        template: {
          outputs: [simpleText(answer)],
          quickReplies: RAG_QUICK_REPLIES,
        },
        // 원문 JSON 토글에서 확인 — RAG 서버로 넘긴 요청 바디.
        data: { ragRequest },
      };
    },
  },
};
