import { randomUUID } from "node:crypto";
import { A2A_AUTH, A2A_ENDPOINT, A2A_PROTOCOL, A2A_TIMEOUT_MS } from "./config.js";

/**
 * A2A/RAG 요청 페이로드 — 이번 발화(또는 온보딩 완료 프로필) 한 건의 질문.
 * 대화 이력은 서버가 아니라 에이전트가 관리하므로, 서버는 단발 질문만 넘긴다.
 */
export interface A2aRequest {
  question?: string;
}

/** 요청 입력을 A2A 메시지 텍스트 한 덩어리로 만든다. */
function buildQueryText(input: A2aRequest | string): string {
  if (typeof input === "string") return input;
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

  // 요청 원문을 컨테이너 로그(stdout)에 남긴다 — A2A 무응답 디버깅용. 토큰은 마스킹.
  console.log(
    "[a2a] →request",
    JSON.stringify({
      endpoint: A2A_ENDPOINT,
      protocol: A2A_PROTOCOL,
      auth: A2A_AUTH ? "Bearer ***" : "(없음)",
      queryText: text,
      body,
    }),
  );

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), A2A_TIMEOUT_MS);
  try {
    const res = await fetch(A2A_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    console.log(`[a2a] ←status ${res.status} ${res.statusText} (content-type: ${res.headers.get("content-type") ?? "?"})`);
    if (res.status === 401 || res.status === 403) {
      console.error(`[a2a] 인증 실패 ${res.status} — A2A_AUTH(Bearer) 주입 확인 필요`);
      throw new Error(
        `A2A 인증 실패(${res.status}) — A2A_AUTH(Bearer 토큰)가 컨테이너에 주입됐는지 확인(.env/env_file).`,
      );
    }
    if (!res.ok || !res.body) {
      const errBody = await res.text().catch(() => "");
      console.error(`[a2a] 요청 실패 ${res.status} body:`, errBody.slice(0, 500));
      throw new Error(`A2A 요청 실패: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let artifactText = "";
    let finalMessageText = "";

    const TERMINAL = new Set(["completed", "failed", "canceled", "rejected"]);
    const FAILED = new Set(["failed", "canceled", "rejected"]);
    let finished = false;
    let eventCount = 0;
    // 실패 진단: 마지막으로 관측한 실패 상태와 노드 에러 사유(status.metadata.error).
    let failedState: string | undefined;
    let failureReason = "";

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
          | {
              state?: string;
              message?: { parts?: unknown };
              metadata?: { error?: unknown; nodeName?: unknown };
            }
          | undefined;
        const t = partsText(status?.message?.parts);
        if (t) finalMessageText = t;
        // 노드 실행 에러(예: "MCP tool execution failed")를 사유로 축적 — 최종 실패 시 표출용.
        const nodeError = status?.metadata?.error;
        if (typeof nodeError === "string" && nodeError) {
          const nodeName =
            typeof status?.metadata?.nodeName === "string" ? status.metadata.nodeName : "";
          failureReason = nodeName ? `${nodeName}: ${nodeError}` : nodeError;
        }
        if (status?.state && FAILED.has(status.state)) failedState = status.state;
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
        if (!dataLine) {
          // data: 없는 이벤트(주석·이벤트명 등)도 원문을 남긴다.
          if (rawEvent.trim()) console.log("[a2a] ←raw", rawEvent.trim());
          continue;
        }
        const payload = dataLine.slice(5).trim();
        eventCount++;
        console.log(`[a2a] ←event#${eventCount}`, payload);
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
            console.error("[a2a] ←error", JSON.stringify(msg.error));
            continue;
          }
          // JSON-RPC는 result에, REST(llamon)는 최상위에 이벤트가 온다.
          if (handle(msg.result ?? msg)) finished = true;
        } catch {
          // 파싱 불가한 이벤트(하트비트 등)는 무시하되 원문은 남긴다.
          console.log("[a2a] ←unparsed", payload);
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
    console.log(
      "[a2a] ←final",
      JSON.stringify({
        events: eventCount,
        finished,
        artifactLen: artifactText.length,
        finalMessageLen: finalMessageText.length,
        failedState: failedState ?? null,
        failureReason: failureReason || null,
        answerPreview: answer.slice(0, 200),
      }),
    );
    if (answer) return answer;

    // 답변이 비었을 때: 태스크가 실패했다면 사유를 표출해 카톡·로그에서 원인을 바로 보이게 한다.
    if (failedState) {
      console.error(
        `[a2a] ←failed state=${failedState} reason=${failureReason || "(사유 미상)"}`,
      );
      return failureReason
        ? `⚠️ AI 에이전트가 답변 생성에 실패했어요.\n사유: ${failureReason}`
        : `⚠️ AI 에이전트가 답변 생성에 실패했어요(${failedState}). 잠시 후 다시 시도해 주세요.`;
    }
    console.warn(
      "[a2a] 빈 응답 — 이벤트를 받았지만 artifact/message 텍스트가 비어있음. 위 ←event 로그로 에이전트 응답 형식을 확인하세요.",
    );
    return "(A2A 에이전트가 응답을 반환하지 않았어요. 잠시 후 다시 시도해 주세요.)";
  } finally {
    clearTimeout(timer);
  }
}
