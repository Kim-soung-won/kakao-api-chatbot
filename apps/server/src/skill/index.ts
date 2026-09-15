import type { SkillPayload, SkillResponse } from "@sprint-kakao/contract";
import type { SkillContext } from "./types.js";
import { blocks, fallback } from "./blocks/index.js";
import { appendTurns, attachHistoryContext, readHistory, summarizeResponse } from "./history.js";

export type { SkillContext, SkillBlock } from "./types.js";

/**
 * 요청 payload → SkillContext.
 * 요청 계약은 아직 가설이라 옵셔널 체이닝으로 방어적으로 추출한다.
 * 대화 이력은 서버 저장소 없이 카카오 최상위 `contexts` 왕복에서 복원한다.
 */
export function parseSkillContext(body: unknown): SkillContext {
  const b = body as Partial<SkillPayload> | undefined;
  return {
    utterance: (b?.userRequest?.utterance ?? "").trim(),
    history: readHistory(body),
    raw: body,
  };
}

/**
 * 발화를 매칭되는 블록으로 디스패치한다. 아무 블록도 안 맞으면 폴백.
 * 어떤 블록이 응답했는지(name)도 함께 반환해 로깅에 쓴다.
 *
 * 디스패치 후, 이번 턴(사용자 발화 + 봇 응답 요약)을 이력에 덧붙여 응답 context로 다시 실어
 * 왕복시킨다. transient 블록("RAG 검색" 등 메타 명령)과 빈 발화는 이력에 남기지 않되, 기존
 * 이력은 계속 왕복되도록 그대로 재설정한다.
 */
export function handleSkill(ctx: SkillContext): {
  block: string;
  response: SkillResponse;
} {
  const block = blocks.find((b) => b.match(ctx)) ?? fallback;
  const response = block.respond(ctx);

  const nextHistory =
    block.transient || !ctx.utterance
      ? ctx.history
      : appendTurns(
          ctx.history,
          { role: "user", text: ctx.utterance },
          { role: "bot", text: summarizeResponse(response) },
        );
  attachHistoryContext(response, nextHistory);

  return { block: block.name, response };
}
