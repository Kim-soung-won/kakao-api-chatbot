/**
 * A2A(Agent-to-Agent) 서비스 설정.
 *
 * 기본값은 **실제 A2A 서버**(Google ADK `toA2a`, JSON-RPC + SSE)의 RAG 에이전트를 가리킨다.
 * client.ts 가 `message/stream` 으로 질의하고 SSE를 소비한다. 오프라인/로컬 개발 시 A2A_MOCK=1 로
 * MSW 목업(mock.ts)을 켠다(같은 엔드포인트 URL을 가로챈다).
 */

/** A2A 엔드포인트. 기본: 실제 서버의 RAG(google-adk) 에이전트. */
export const A2A_ENDPOINT =
  process.env["A2A_ENDPOINT"] ??
  "http://16.16.208.36:8000/a2a/google-adk-agent/jsonrpc";

/**
 * 요청 프로토콜.
 *  - "jsonrpc": Google ADK toA2a — body는 JSON-RPC message/stream, 이벤트는 {result:{kind}}.
 *  - "rest":    REST 스타일(예: llamon) — body는 {message:"텍스트"}, 이벤트는 {kind} 최상위.
 * SSE 파싱은 두 형식을 모두 처리한다(client.ts에서 result 언랩).
 */
export const A2A_PROTOCOL = (process.env["A2A_PROTOCOL"] === "rest" ? "rest" : "jsonrpc") as
  | "jsonrpc"
  | "rest";

/** Authorization 헤더 값(예: "Bearer eyJ…"). 비밀이므로 .env로만 주입, 커밋 금지. */
export const A2A_AUTH = process.env["A2A_AUTH"];

/** A2A 스트림 대기 상한(ms). 콜백 유효(1분)보다 짧게. */
export const A2A_TIMEOUT_MS = Number(process.env["A2A_TIMEOUT_MS"] ?? 55_000);

/** 목업 SSE 지속 시간(ms). 목업(A2A_MOCK=1)일 때만 사용. */
export const A2A_DURATION_MS = Number(process.env["A2A_DURATION_MS"] ?? 30_000);

/** 목업 활성화 여부. 기본 **off**(실제 서버 사용). 오프라인 개발 시 A2A_MOCK=1. */
export const A2A_MOCK_ENABLED = process.env["A2A_MOCK"] === "1";
