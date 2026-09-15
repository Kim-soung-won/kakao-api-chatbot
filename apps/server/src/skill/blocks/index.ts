import type { SkillBlock } from "../types.js";
import { ragSearch } from "./rag-search.js";
import { a2aConsult } from "./a2a.js";
import { exit } from "./exit.js";
import { onboarding } from "./onboarding.js";
import { help } from "./help.js";
import { welfare } from "./welfare.js";
import { fallback } from "./fallback.js";

/**
 * 매칭 순서대로 평가 — 위에서부터 먼저 맞는 블록이 응답한다.
 * (예: "맞춤복지"는 onboarding이 welfare보다 먼저 잡아야 함)
 *
 * ※ 웰컴 블록은 제거됨: 카카오 오픈빌더 웰컴 블록은 진입 시 발화가 없어
 *   스킬을 호출하지 않으므로(자동발송 미동작), 진입 인사는 챗봇이 아니라
 *   채널 친구추가 메시지(채널 레이어)로 처리한다. (docs/blocks.md 참고)
 */
export const blocks: SkillBlock[] = [ragSearch, a2aConsult, exit, onboarding, help, welfare];

/** 폴백 블록은 항상 마지막 안전망. */
export { fallback };
