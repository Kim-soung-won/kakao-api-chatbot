import type { SkillBlock } from "../types.js";
import { exit } from "./exit.js";
import { onboarding } from "./onboarding.js";
import { welcome } from "./welcome.js";
import { welfare } from "./welfare.js";
import { demos } from "./demos.js";
import { fallback } from "./fallback.js";

/**
 * 매칭 순서대로 평가 — 위에서부터 먼저 맞는 블록이 응답한다.
 * (예: "맞춤복지"는 onboarding이 welfare보다 먼저 잡아야 함)
 */
export const blocks: SkillBlock[] = [exit, onboarding, welcome, welfare, demos];

/** 폴백 블록은 항상 마지막 안전망. */
export { fallback };
