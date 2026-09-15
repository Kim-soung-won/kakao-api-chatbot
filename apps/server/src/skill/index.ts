import type { SkillPayload, SkillResponse } from "@sprint-kakao/contract";
import type { SkillContext } from "./types.js";
import { blocks, fallback } from "./blocks/index.js";
import { appendTurns, summarizeResponse } from "./history.js";
import { loadHistory, saveHistory } from "./history-store.js";

export type { SkillContext, SkillBlock } from "./types.js";

/** 요청 payload에서 botUserKey를 방어적으로 추출(요청 계약이 가설). 없으면 anonymous. */
function extractUserId(body: unknown): string {
  const b = body as Partial<SkillPayload> | undefined;
  const id = b?.userRequest?.user?.id;
  return typeof id === "string" && id.trim() ? id.trim() : "anonymous";
}

/**
 * 요청 payload → SkillContext.
 * 요청 계약은 아직 가설이라 옵셔널 체이닝으로 방어적으로 추출한다.
 * 대화 이력은 botUserKey별 파일 저장소(captured-requests/history/)에서 로드한다.
 */
export async function parseSkillContext(body: unknown): Promise<SkillContext> {
  const b = body as Partial<SkillPayload> | undefined;
  const userId = extractUserId(body);
  return {
    utterance: (b?.userRequest?.utterance ?? "").trim(),
    userId,
    history: await loadHistory(userId),
    raw: body,
  };
}

/**
 * 발화를 매칭되는 블록으로 디스패치한다. 아무 블록도 안 맞으면 폴백.
 * 어떤 블록이 응답했는지(name)도 함께 반환해 로깅에 쓴다.
 *
 * 디스패치 후, 이번 턴(사용자 발화 + 봇 응답 요약)을 이력에 덧붙여 파일 저장소에 적재한다.
 * transient 블록("RAG 검색" 등 메타 명령)과 빈 발화는 이력에 남기지 않는다.
 */
export async function handleSkill(ctx: SkillContext): Promise<{
  block: string;
  response: SkillResponse;
}> {
  const block = blocks.find((b) => b.match(ctx)) ?? fallback;
  const response = block.respond(ctx);

  if (!block.transient && ctx.utterance) {
    const nextHistory = appendTurns(
      ctx.history,
      { role: "user", text: ctx.utterance },
      { role: "bot", text: summarizeResponse(response) },
    );
    await saveHistory(ctx.userId, nextHistory);
  }

  return { block: block.name, response };
}
