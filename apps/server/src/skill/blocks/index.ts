import type { SkillBlock } from "../types.js";
import { connect } from "./connect.js";
import { agentChat } from "./agent-chat.js";
import { ragSearch } from "./rag-search.js";
import { exit } from "./exit.js";
import { onboarding } from "./onboarding.js";
import { help } from "./help.js";
import { welfare } from "./welfare.js";
import { fallback } from "./fallback.js";

/**
 * 매칭 순서대로 평가 — 위에서부터 먼저 맞는 블록이 응답한다.
 * (예: "맞춤복지"는 onboarding이 welfare보다 먼저 잡아야 함)
 *
 * 에이전트 대화 모드 관련 순서가 중요하다:
 *   1) connect  — "AI 안내서비스 연결" 트리거(모드 진입). 항상 최우선.
 *   2) exit     — "대화 종료" 등 탈출(모드 해제). agent-chat보다 앞이라야 이탈 키워드가
 *                 에이전트로 넘어가지 않는다.
 *   3) agentChat— agent 모드일 때의 캐치올. 이후 발화를 전부 A2A로 흘려보낸다.
 *   → agent 모드에선 rag-search/onboarding/help/welfare가 자연히 우회된다.
 *
 * ※ 웰컴 블록은 제거됨: 카카오 오픈빌더 웰컴 블록은 진입 시 발화가 없어
 *   스킬을 호출하지 않으므로(자동발송 미동작), 진입 인사는 챗봇이 아니라
 *   채널 친구추가 메시지(채널 레이어)로 처리한다. (docs/blocks.md 참고)
 */
export const blocks: SkillBlock[] = [
  connect,
  exit,
  agentChat,
  ragSearch,
  onboarding,
  help,
  welfare,
];

/** 폴백 블록은 항상 마지막 안전망. */
export { fallback };
