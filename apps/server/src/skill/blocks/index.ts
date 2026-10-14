import type { SkillBlock } from "../types.js";
import { fixed } from "./fixed.js";
import { agent } from "./agent.js";
import { fallback } from "./fallback.js";

/**
 * 매칭 순서대로 평가 — 위에서부터 먼저 맞는 블록이 응답한다.
 *
 *   1) fixed — 고정 답변("AI 복지 채널 소개"·"상담사 연결 방법 안내"). 에이전트를 부르지 않는다.
 *   2) agent — 그 외 모든 발화의 캐치올. 발화를 A2A 에이전트로 전달한다.
 *   → 빈 발화만 fallback으로 떨어진다.
 *
 * ※ 비활성(미등록): connect·exit(세션 연결/종료), onboarding(맞춤복지 카드 흐름).
 *   서버는 상태를 저장하지 않는다 — 저장소를 추가로 구축·운영하는 부담 때문에 세션 상태 관리를
 *   껐고, 대화 이력·맥락은 에이전트가 관리한다. 코드는 재활성화를 위해 남겨 둔다.
 * ※ 웰컴 블록도 없음: 진입 인사는 채널 친구추가 메시지(채널 레이어)로 처리한다.
 */
export const blocks: SkillBlock[] = [fixed, agent];

/** 폴백 블록은 항상 마지막 안전망(빈 발화). */
export { fallback };
