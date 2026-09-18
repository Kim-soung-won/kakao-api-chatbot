import type { SkillBlock } from "../types.js";
import { onboarding } from "./onboarding.js";
import { agent } from "./agent.js";
import { fallback } from "./fallback.js";

/**
 * 매칭 순서대로 평가 — 위에서부터 먼저 맞는 블록이 응답한다.
 *
 *   1) onboarding — "맞춤복지" 시작 및 지역/가구/관심 선택 카드 흐름(로컬).
 *                   완료 단계에서 수집 프로필을 에이전트로 전달한다.
 *   2) agent      — 그 외 모든 발화의 캐치올. 발화를 A2A 에이전트로 전달한다.
 *
 * ※ 에이전트 대화 "모드"(connect/exit/agent-chat)와 rag-search·welfare·help 정적 블록은
 *   제거됐다. 온보딩을 제외한 모든 질의는 에이전트가 처리하며, 대화 이력도 에이전트가 관리한다.
 * ※ 웰컴 블록도 없음: 진입 인사는 채널 친구추가 메시지(채널 레이어)로 처리한다.
 */
export const blocks: SkillBlock[] = [onboarding, agent];

/** 폴백 블록은 항상 마지막 안전망(빈 발화 등). */
export { fallback };
