/**
 * Mock A2A(Agent-to-Agent) 서비스 설정.
 *
 * 실제 RAG/A2A 백엔드가 붙기 전, 스킬 서버가 "외부 에이전트를 호출→SSE 스트림 수신→
 * 최종 답변을 SkillResponse로 변환"하는 파이프라인을 검증하기 위한 목업.
 * 목업 엔드포인트는 MSW가 가로채고(mock.ts), 클라이언트가 SSE로 소비한다(client.ts).
 */

/** A2A 에이전트 엔드포인트. 실연동 시 env A2A_ENDPOINT로 실제 서버 URL 주입. */
export const A2A_ENDPOINT =
  process.env["A2A_ENDPOINT"] ?? "http://a2a.mock.local/agent/invoke";

/** 목업 SSE가 전체 스트림을 흘리는 데 걸리는 시간(ms). 기본 30초(카카오 5초 초과 → 콜백 필요). */
export const A2A_DURATION_MS = Number(process.env["A2A_DURATION_MS"] ?? 30_000);

/** 목업 활성화 여부. 기본 on. 실제 A2A 서버를 붙이면 A2A_MOCK=0으로 끈다. */
export const A2A_MOCK_ENABLED = process.env["A2A_MOCK"] !== "0";
