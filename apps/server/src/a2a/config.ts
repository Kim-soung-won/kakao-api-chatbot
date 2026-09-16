/**
 * A2A(Agent-to-Agent) 서비스 설정.
 *
 * ⚠️⚠️ 임시 테스트/목업 ⚠️⚠️
 *   이 A2A 경로(엔드포인트·에이전트)는 **지금은 테스트용**이며, **추후 실제 RAG 에이전트가
 *   추가될 자리를 위한 목업**이다. 기본 엔드포인트는 외부 데모 에이전트(llamon 콘텐츠 창작
 *   에이전트)를 가리키도록 **고정**해 두었다 — `RAG 검색`이 이 응답을 카카오에 표출하는 것을
 *   눈으로 확인하기 위함. 실제 도메인(복지) RAG 백엔드가 준비되면 `A2A_ENDPOINT`/`A2A_PROTOCOL`/
 *   `A2A_AUTH` 를 그쪽으로 바꾸기만 하면 된다(코드 변경 불필요).
 *
 * client.ts 가 `message/stream`(jsonrpc) 또는 `{message}`(rest)로 질의하고 SSE를 소비한다.
 * 오프라인/로컬은 A2A_MOCK=1 로 MSW 목업(mock.ts)을 켠다.
 */

/**
 * A2A 엔드포인트. **기본값 = 임시 테스트 에이전트(llamon)**. 실연동 시 env로 교체.
 * (llamon 데모: REST + Bearer. 이전 google-adk(JSON-RPC)는 백엔드 vLLM Forbidden 상태였음.)
 */
export const A2A_ENDPOINT =
  process.env["A2A_ENDPOINT"] ??
  "https://llamon-chat-service-826957515268.asia-northeast3.run.app/api/registry-playground/a2a/c1085b5e-c705-4aaa-b89d-a5da073c5bac/message";

/**
 * 요청 프로토콜. **기본 "rest"**(llamon: body {message:"텍스트"}, 이벤트 {kind} 최상위, [DONE] 종료).
 *  - "jsonrpc": Google ADK toA2a — body는 JSON-RPC message/stream, 이벤트는 {result:{kind}}.
 * SSE 파싱은 두 형식을 모두 처리한다(client.ts에서 result 언랩).
 */
export const A2A_PROTOCOL = (process.env["A2A_PROTOCOL"] === "jsonrpc" ? "jsonrpc" : "rest") as
  | "jsonrpc"
  | "rest";

/** Authorization 헤더 값(예: "Bearer eyJ…"). 비밀이므로 .env로만 주입, 커밋 금지. */
export const A2A_AUTH = process.env["A2A_AUTH"];

/** A2A 스트림 대기 상한(ms). 콜백 유효(1분)보다 짧게. */
export const A2A_TIMEOUT_MS = Number(process.env["A2A_TIMEOUT_MS"] ?? 55_000);

/** 목업 SSE 지속 시간(ms). 목업(A2A_MOCK=1)일 때만 사용. */
export const A2A_DURATION_MS = Number(process.env["A2A_DURATION_MS"] ?? 30_000);

/** 목업 활성화 여부. 기본 **off**(위 테스트 에이전트 사용). 오프라인 개발 시 A2A_MOCK=1. */
export const A2A_MOCK_ENABLED = process.env["A2A_MOCK"] === "1";
