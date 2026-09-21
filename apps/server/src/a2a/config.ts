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

/* ────────────────────────────────────────────────────────────────────────────
 * RAG 복지 안내 에이전트 (실연동) — docs/rag-agent-직접연동-가이드v4.md 계약.
 *
 * 위 A2A_* 는 임시 데모(llamon SSE)이고, 아래 RAG_* 가 **실제 복지 RAG 에이전트**다.
 * 프로토콜은 A2A JSON-RPC `message/send`(단발). 요청은 text part(질의) + DataPart
 * `rag-agent.flow-input.v3`(conditions·options), 응답은 artifact `welfare-guide` 안의
 * TextPart(안내문) + DataPart `rag-agent.flow-output.v1`(sources·suggestions).
 * 인증은 현재 불요(실측). 필요해지면 RAG_AUTH(Bearer)만 .env로 주입한다(커밋 금지).
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * RAG 에이전트 엔드포인트. 기본값 = **공인 게이트웨이**(사내·AWS 모두 도달 가능, 실측).
 * 사내망 전용 주소는 http://10.10.10.24:32402/admin/a2a/ax-sprint-rag-agent (AWS에서 라우팅 불가).
 */
export const RAG_ENDPOINT =
  process.env["RAG_ENDPOINT"] ?? "http://121.166.81.33:28000/welfare-agent";

/** Authorization 헤더 값. 현재는 불요(미설정). 필요 시 .env로만 주입, 커밋 금지. */
export const RAG_AUTH = process.env["RAG_AUTH"];

/** RAG 응답 대기 상한(ms). 콜백 유효(1분)보다 짧게. 실측 ~8초. */
export const RAG_TIMEOUT_MS = Number(process.env["RAG_TIMEOUT_MS"] ?? 40_000);

/** 회수 개수(options.top_k). 생략 시 검색 서버 기본값(3). */
export const RAG_TOP_K = Number(process.env["RAG_TOP_K"] ?? 3);

/**
 * 안내문 형식(options.answer_format). 카카오 simpleText는 마크다운을 렌더하지 않으므로
 * 기본 **plain**(인용블록·제목·굵게 제거). sources는 네이티브 카드로 별도 렌더한다.
 */
export const RAG_ANSWER_FORMAT = (process.env["RAG_ANSWER_FORMAT"] === "markdown"
  ? "markdown"
  : "plain") as "markdown" | "plain";

/** RAG 오프라인 목업 사용 여부(네트워크 없이 canned 구조 응답). 기본 off. */
export const RAG_MOCK_ENABLED = process.env["RAG_MOCK"] === "1" || A2A_MOCK_ENABLED;
