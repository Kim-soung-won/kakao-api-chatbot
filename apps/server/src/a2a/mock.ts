import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { A2A_DURATION_MS, A2A_ENDPOINT } from "./config.js";

/**
 * MSW 기반 **목업 A2A 서버**(A2A_MOCK=1일 때). 실제 서버와 **같은 A2A 프레이밍**으로 응답해
 * client.ts가 목업/실서버를 구분 없이 소비하게 한다.
 *
 * SSE 이벤트(JSON-RPC): task(submitted) → status-update(working) → artifact-update×N(토큰) →
 * status-update(final, completed). 총 A2A_DURATION_MS(기본 30초)에 완료.
 */

interface A2aBody {
  id?: string | number;
  /** rest 프로토콜: {message:"텍스트"} */
  message?: string;
  /** jsonrpc 프로토콜: {params:{message:{parts:[...]}}} */
  params?: { message?: { parts?: { kind?: string; text?: string }[] } };
}

function mockAnswer(userText: string): string {
  return (
    `【RAG 답변(목업)】\n"${userText.slice(0, 40)}…" 관련 안내입니다.\n` +
    `• 대상: 강서구 거주 다문화가정 (국적 무관)\n` +
    `• 지원: 보육료·교육활동비·한국어교육·취업·의료·주거\n` +
    `• 신청: 서류 준비 → 접수 → 심사 → 지급/이용\n` +
    `문의: 다문화가족지원센터 ☎ 02-000-0000`
  );
}

function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [text];
}

const handlers = [
  http.post(A2A_ENDPOINT, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as A2aBody;
    const id = body.id ?? "1";
    const userText =
      body.message ?? body.params?.message?.parts?.find((p) => p.kind === "text")?.text ?? "";
    const taskId = "mock-task-1";
    const tokens = tokenize(mockAnswer(userText));
    const perToken = Math.max(1, Math.floor(A2A_DURATION_MS / (tokens.length + 2)));
    const enc = new TextEncoder();
    const sse = (result: unknown) =>
      enc.encode(`data: ${JSON.stringify({ jsonrpc: "2.0", id, result })}\n\n`);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(sse({ kind: "task", id: taskId, status: { state: "submitted" } }));
        await delay(perToken);
        controller.enqueue(
          sse({ kind: "status-update", taskId, final: false, status: { state: "working" } }),
        );
        for (const tok of tokens) {
          await delay(perToken);
          controller.enqueue(
            sse({ kind: "artifact-update", taskId, artifact: { parts: [{ kind: "text", text: tok }] } }),
          );
        }
        controller.enqueue(
          sse({ kind: "status-update", taskId, final: true, status: { state: "completed" } }),
        );
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
    });
  }),
];

const server = setupServer(...handlers);

/** 목업 A2A 서비스 가동. */
export function startA2aMock(): void {
  server.listen({ onUnhandledRequest: "bypass" });
}

/** 테스트 정리용. */
export function stopA2aMock(): void {
  server.close();
}
