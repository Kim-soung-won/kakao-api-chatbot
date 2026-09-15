import type { SkillBlock } from "../types.js";
import { onboarding } from "./onboarding.js";

/** 탈출(초기화) 명령어. */
const EXIT_WORDS = ["처음", "처음으로", "취소", "그만", "리셋"];

/**
 * 탈출 블록 — 되묻기(다단계) 흐름에서 사용자가 초기화·이탈하려 할 때.
 * (오픈빌더 탈출 블록에 대응) 온보딩 시작으로 리셋한다.
 */
export const exit: SkillBlock = {
  name: "exit",
  match: (ctx) => EXIT_WORDS.includes(ctx.utterance),
  respond: (ctx) => onboarding.respond({ ...ctx, utterance: "맞춤복지" }),
};
