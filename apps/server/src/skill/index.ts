import type { SkillPayload, SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock, SkillContext } from "./types.js";
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
  const callbackUrl = b?.userRequest?.callbackUrl;
  return {
    utterance: (b?.userRequest?.utterance ?? "").trim(),
    userId,
    history: await loadHistory(userId),
    callbackUrl: typeof callbackUrl === "string" && callbackUrl ? callbackUrl : undefined,
    raw: body,
  };
}

/** 발화에 매칭되는 블록을 고른다. 아무 것도 안 맞으면 폴백. */
export function selectBlock(ctx: SkillContext): SkillBlock {
  return blocks.find((b) => b.match(ctx)) ?? fallback;
}

/**
 * 이번 턴(사용자 발화 + 봇 응답 요약)을 이력에 덧붙여 파일 저장소에 적재한다.
 * transient 블록("RAG 검색" 등)과 빈 발화는 남기지 않는다. (콜백 최종 응답도 이걸로 기록.)
 */
export async function recordTurn(
  ctx: SkillContext,
  block: SkillBlock,
  response: SkillResponse,
): Promise<void> {
  if (block.transient || !ctx.utterance) return;
  const nextHistory = appendTurns(
    ctx.history,
    { role: "user", text: ctx.utterance },
    { role: "bot", text: summarizeResponse(response) },
  );
  await saveHistory(ctx.userId, nextHistory);
}

/**
 * 동기(5초 이내) 디스패치. 매칭 블록의 respond 결과를 반환하고 이번 턴을 이력에 적재한다.
 * (콜백 블록의 비동기 경로는 라우트에서 별도 처리 — routes/skill.ts.)
 */
export async function handleSkill(ctx: SkillContext): Promise<{
  block: string;
  response: SkillResponse;
}> {
  const block = selectBlock(ctx);
  const response = block.respond(ctx);
  await recordTurn(ctx, block, response);
  return { block: block.name, response };
}
