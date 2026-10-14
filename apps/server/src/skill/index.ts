import type { SkillPayload, SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock, SkillContext } from "./types.js";
import { blocks, fallback } from "./blocks/index.js";
import { saveMode } from "./session-store.js";

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
 * 서버는 상태를 저장하지 않는다(저장소 구축 부담) — 세션 모드는 로드하지 않아 항상 undefined.
 * 대화 이력은 에이전트가 관리한다. (세션 연결/종료 재활성화 시 session-store.loadMode로 채운다.)
 */
export async function parseSkillContext(body: unknown): Promise<SkillContext> {
  const b = body as (Partial<SkillPayload> & { callbackUrl?: unknown }) | undefined;
  const userId = extractUserId(body);
  // 콜백 활성화 시 실려오는 callbackUrl. 위치가 가설이라 userRequest 하위·최상위 모두 방어적으로 확인.
  const callbackUrl = b?.userRequest?.callbackUrl ?? (b?.callbackUrl as string | undefined);
  return {
    utterance: (b?.userRequest?.utterance ?? "").trim(),
    userId,
    callbackUrl: typeof callbackUrl === "string" && callbackUrl ? callbackUrl : undefined,
    raw: body,
  };
}

/**
 * 블록이 선언한 세션 모드 전환(setMode)을 저장소에 반영한다.
 * setMode 미지정이면 아무 것도 하지 않는다.
 */
export async function applyModeEffect(ctx: SkillContext, block: SkillBlock): Promise<void> {
  if (block.setMode === undefined) return;
  await saveMode(ctx.userId, block.setMode);
}

/** 발화에 매칭되는 블록을 고른다. 아무 것도 안 맞으면 폴백. */
export function selectBlock(ctx: SkillContext): SkillBlock {
  return blocks.find((b) => b.match(ctx)) ?? fallback;
}

/**
 * 동기(5초 이내) 디스패치. 매칭 블록의 respond 결과를 반환한다.
 * (콜백 블록의 비동기 경로는 라우트에서 별도 처리 — routes/skill.ts.)
 */
export async function handleSkill(ctx: SkillContext): Promise<{
  block: string;
  response: SkillResponse;
}> {
  const block = selectBlock(ctx);
  await applyModeEffect(ctx, block);
  return { block: block.name, response: block.respond(ctx) };
}
