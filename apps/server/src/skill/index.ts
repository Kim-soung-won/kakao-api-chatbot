import type { SkillPayload, SkillResponse } from "@sprint-kakao/contract";
import type { SkillContext } from "./types.js";
import { blocks, fallback } from "./blocks/index.js";

export type { SkillContext, SkillBlock } from "./types.js";

/**
 * 요청 payload → SkillContext.
 * 요청 계약은 아직 가설이라 옵셔널 체이닝으로 방어적으로 추출한다.
 */
export function parseSkillContext(body: unknown): SkillContext {
  const b = body as Partial<SkillPayload> | undefined;
  return { utterance: (b?.userRequest?.utterance ?? "").trim(), raw: body };
}

/**
 * 발화를 매칭되는 블록으로 디스패치한다. 아무 블록도 안 맞으면 폴백.
 * 어떤 블록이 응답했는지(name)도 함께 반환해 로깅에 쓴다.
 */
export function handleSkill(ctx: SkillContext): {
  block: string;
  response: SkillResponse;
} {
  const block = blocks.find((b) => b.match(ctx)) ?? fallback;
  return { block: block.name, response: block.respond(ctx) };
}
