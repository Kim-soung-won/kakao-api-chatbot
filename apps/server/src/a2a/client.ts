import { randomUUID } from "node:crypto";
import { A2A_ENDPOINT, A2A_TIMEOUT_MS } from "./config.js";

/** A2A/RAG 요청 페이로드 — 단발 질문 또는 대화 이력(RAG 검색). */
export interface A2aRequest {
  question?: string;
  /** RAG 검색: 지금까지의 대화 이력 전체. 트랜스크립트로 합쳐 질의 텍스트로 만든다. */
  messages?: { role: string; content: string }[];
}

/** 요청 입력을 A2A 메시지 텍스트 한 덩어리로 만든다. */
function buildQueryText(input: A2aRequest | string): string {
  if (typeof input === "string") return input;
  if (input.messages?.length) {
    const transcript = input.messages
      .map((m) => `${m.role === "user" ? "사용자" : "도우미"}: ${m.content}`)
      .join("\n");
    return `${transcript}\n\n위 대화 맥락을 바탕으로 사용자의 마지막 질문에 답해줘.`;
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
  const rpc = {
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

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), A2A_TIMEOUT_MS);
  try {
    const res = await fetch(A2A_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(rpc),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new Error(`A2A 요청 실패: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let artifactText = "";
    let finalMessageText = "";

    const handle = (evt: Record<string, unknown> | undefined): void => {
      if (!evt) return;
      const kind = evt["kind"];
      if (kind === "artifact-update") {
        const t = partsText((evt["artifact"] as { parts?: unknown } | undefined)?.parts);
        if (t) {
          artifactText += t;
          onDelta?.(t);
        }
      } else if (kind === "status-update" || kind === "task") {
        const status = evt["status"] as { message?: { parts?: unknown } } | undefined;
        const t = partsText(status?.message?.parts);
        if (t) finalMessageText = t;
      } else if (kind === "message") {
        const t = partsText(evt["parts"]);
        if (t) finalMessageText = t;
      }
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
        try {
          const msg = JSON.parse(dataLine.slice(5).trim()) as {
            result?: Record<string, unknown>;
            error?: { message?: string };
          };
          if (msg.error) {
            finalMessageText = `A2A 오류: ${msg.error.message ?? "unknown"}`;
            continue;
          }
          handle(msg.result);
        } catch {
          // 파싱 불가한 이벤트(하트비트 등)는 무시.
        }
      }
    }

    // 스트리밍된 artifact가 있으면 그것을, 없으면 최종 메시지(에러 사유 포함)를 답변으로.
    const answer = (artifactText || finalMessageText).trim();
    if (!answer) throw new Error("A2A 응답이 비어 있음");
    return answer;
  } finally {
    clearTimeout(timer);
  }
}
