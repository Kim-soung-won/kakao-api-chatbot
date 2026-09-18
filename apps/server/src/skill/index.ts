import type { SkillPayload, SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock, SkillContext } from "./types.js";
import { blocks, fallback } from "./blocks/index.js";

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
 * 대화 이력·세션 모드는 더 이상 서버가 저장하지 않는다(에이전트가 관리).
 */
export function parseSkillContext(body: unknown): SkillContext {
  const b = body as (Partial<SkillPayload> & { callbackUrl?: unknown }) | undefined;
  // 콜백 활성화 시 실려오는 callbackUrl. 위치가 가설이라 userRequest 하위·최상위 모두 방어적으로 확인.
  const callbackUrl = b?.userRequest?.callbackUrl ?? (b?.callbackUrl as string | undefined);
  return {
    utterance: (b?.userRequest?.utterance ?? "").trim(),
    userId: extractUserId(body),
    callbackUrl: typeof callbackUrl === "string" && callbackUrl ? callbackUrl : undefined,
    raw: body,
  };
}

/** 발화에 매칭되는 블록을 고른다. 아무 것도 안 맞으면 폴백. */
export function selectBlock(ctx: SkillContext): SkillBlock {
  return blocks.find((b) => b.match(ctx)) ?? fallback;
}

/**
 * 동기(5초 이내) 디스패치. 매칭 블록의 respond 결과를 반환한다.
 * (콜백 블록의 비동기 경로는 라우트에서 별도 처리 — routes/skill.ts.)
 */
export function handleSkill(ctx: SkillContext): {
  block: string;
  response: SkillResponse;
} {
  const block = selectBlock(ctx);
  return { block: block.name, response: block.respond(ctx) };
}
