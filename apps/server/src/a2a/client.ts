import { randomUUID } from "node:crypto";
import { A2A_AUTH, A2A_ENDPOINT, A2A_PROTOCOL, A2A_TIMEOUT_MS } from "./config.js";

/** A2A/RAG 요청 페이로드 — 단발 질문 또는 대화 이력(RAG 검색). */
export interface A2aRequest {
  question?: string;
  /** RAG 검색: 지금까지의 대화 이력 전체. 트랜스크립트로 합쳐 질의 텍스트로 만든다. */
  messages?: { role: string; content: string }[];
}

/**
 * 요청 입력을 A2A 메시지 텍스트 한 덩어리로 만든다.
 * 에이전트가 잘 응답하도록 **사용자 발화만 한 줄로 모아 작업 지시형**으로 만든다
 * (봇 카드 텍스트·여러 줄 트랜스크립트는 일부 에이전트가 막힘 — 실측).
 */
function buildQueryText(input: A2aRequest | string): string {
  if (typeof input === "string") return input;
  if (input.messages?.length) {
    const userTurns = input.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (userTurns.length) {
      // ⚠️ 현재 연결된 에이전트(llamon)가 '창작/작성' 태스크에 안정적으로 응답해, 그에 맞춰 생성형으로
      //    프레이밍한다. 실제 복지 RAG로 교체 시엔 사실 질의형으로 바꾸는 게 낫다.
      return `복지 상담 챗봇으로서, 사용자가 문의한 다음 항목들을 소개하는 친절한 안내 글을 한 단락으로 작성해줘: ${userTurns.join(", ")}.`;
    }
  }
  return input.question ?? "";
}

/** A2A Part[]에서 text 파트만 이어붙인다. */
function partsText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) =>
      p && typeof p === "object" && (p as { kind?: string }).kind === "text"
        ? String((p as { text?: unknown }).text ?? "")
        : "",
    )
    .join("");
}

/**
 * 실제 A2A(Agent-to-Agent) 서버에 **JSON-RPC `message/stream`** 으로 질의하고, **SSE 스트림을
 * 끝까지 소비**해 최종 답변 텍스트를 반환한다. (Google ADK `toA2a` 서버 규격.)
 *
 * 이벤트: `{jsonrpc,id,result:<event>}` — event.kind 는 task / status-update / artifact-update /
 * message. 답변 텍스트는 artifact-update의 artifact.parts 또는 최종 status-update의 status.message.parts.
 * 카톡은 토큰 실시간 스트리밍을 지원하지 않으므로, 여기서 전부 모아 완성 텍스트 1개로 반환한다.
 */
export async function askA2a(
  input: A2aRequest | string,
  onDelta?: (delta: string) => void,
): Promise<string> {
  const text = buildQueryText(input);
  // 프로토콜별 요청 바디. jsonrpc=Google ADK message/stream, rest={message} (예: llamon).
  const body =
    A2A_PROTOCOL === "rest"
      ? { message: text }
      : {
          jsonrpc: "2.0",
          id: randomUUID(),
          method: "message/stream",
          params: {
            message: {
              role: "user",
              parts: [{ kind: "text", text }],
              messageId: randomUUID(),
              kind: "message",
            },
          },
        };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
  };
  if (A2A_AUTH) headers["authorization"] = A2A_AUTH;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), A2A_TIMEOUT_MS);
  try {
    const res = await fetch(A2A_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new Error(`A2A 요청 실패: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let artifactText = "";
    let finalMessageText = "";

    const TERMINAL = new Set(["completed", "failed", "canceled", "rejected"]);
    let finished = false;

    /** 이벤트 처리 + 종료 여부 반환(최종 상태이면 true). */
    const handle = (evt: Record<string, unknown> | undefined): boolean => {
      if (!evt) return false;
      const kind = evt["kind"];
      if (kind === "artifact-update") {
        const t = partsText((evt["artifact"] as { parts?: unknown } | undefined)?.parts);
        if (t) {
          artifactText += t;
          onDelta?.(t);
        }
      } else if (kind === "status-update" || kind === "task") {
        const status = evt["status"] as
          | { state?: string; message?: { parts?: unknown } }
          | undefined;
        const t = partsText(status?.message?.parts);
        if (t) finalMessageText = t;
        if (evt["final"] === true || (status?.state && TERMINAL.has(status.state))) return true;
      } else if (kind === "message") {
        const t = partsText(evt["parts"]);
        if (t) finalMessageText = t;
      }
      return false;
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (payload === "[DONE]") {
          finished = true;
          break;
        }
        try {
          const msg = JSON.parse(payload) as {
            result?: Record<string, unknown>;
            error?: { message?: string };
          } & Record<string, unknown>;
          if (msg.error) {
            finalMessageText = `A2A 오류: ${msg.error.message ?? "unknown"}`;
            continue;
          }
          // JSON-RPC는 result에, REST(llamon)는 최상위에 이벤트가 온다.
          if (handle(msg.result ?? msg)) finished = true;
        } catch {
          // 파싱 불가한 이벤트(하트비트 등)는 무시.
        }
      }
      if (finished) break;
    }
    // 스트림이 종료 신호 후에도 열려 있을 수 있으므로 reader를 명시적으로 닫는다.
    await reader.cancel().catch(() => {});

    // 스트리밍된 artifact가 있으면 그것을, 없으면 최종 메시지(에러 사유 포함)를 답변으로.
    // 임시 테스트 에이전트라 간헐적으로 빈 응답이 올 수 있어, 던지지 않고 안내 문구로 대체한다
    // (카카오에는 항상 A2A 경로 결과가 표출되도록).
    const answer = (artifactText || finalMessageText).trim();
    return answer || "(A2A 에이전트가 응답을 반환하지 않았어요. 잠시 후 다시 시도해 주세요.)";
  } finally {
    clearTimeout(timer);
  }
}
