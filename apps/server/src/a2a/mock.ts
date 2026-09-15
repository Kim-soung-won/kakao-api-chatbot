import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { A2A_DURATION_MS, A2A_ENDPOINT } from "./config.js";

/**
 * MSW 기반 **목업 A2A 서비스**. `A2A_ENDPOINT`로 오는 POST를 가로채,
 * A2A/LLM 스트리밍처럼 **SSE로 토큰을 조금씩 흘리다** 총 `A2A_DURATION_MS`(기본 30초)에 완료한다.
 *
 * SSE 프레이밍(A2A task update 흉내):
 *   event: message  data: {"delta":"…"}     ← 부분 토큰 여러 번
 *   event: done     data: {"done":true}      ← 종료
 *
 * 서버(index.ts)가 A2A_MOCK 켜졌을 때 listen()한다. 전역 fetch를 가로채되
 * 매칭 안 되는 요청(카카오 callbackUrl POST 등)은 bypass로 실제 네트워크로 흘린다.
 */

interface A2aBody {
  question?: string;
  messages?: { role?: string; content?: string }[];
}

/** RAG 검색 목업 답변 — 넘겨받은 대화 이력을 참고했다는 티를 내며 답변 문단을 만든다. */
function mockAnswer(body: A2aBody): string {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content;
  const topic = lastUser ?? body.question ?? "(대화 없음)";
  return (
    `【RAG 답변】\n대화 ${messages.length}턴을 참고해 답변드립니다.\n` +
    `최근 관심: "${topic}"\n\n` +
    `• 대상: 강서구 거주 다문화가정 (국적 무관)\n` +
    `• 관련 지원: 보육료·교육활동비·한국어교육·취업·의료·주거\n` +
    `• 신청: 서류 준비 → 방문/온라인 접수 → 자격 심사 → 지급/이용\n\n` +
    `자세한 안내는 다문화가족지원센터(☎ 02-000-0000)로 문의하세요.`
  );
}

/** 답변을 자연스러운 토큰 단위로 쪼갠다(공백 유지). */
function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [text];
}

const handlers = [
  http.post(A2A_ENDPOINT, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as A2aBody;
    const tokens = tokenize(mockAnswer(body));
    const perToken = Math.max(1, Math.floor(A2A_DURATION_MS / (tokens.length + 1)));
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const tok of tokens) {
          await delay(perToken);
          controller.enqueue(
            encoder.encode(`event: message\ndata: ${JSON.stringify({ delta: tok })}\n\n`),
          );
        }
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  }),
];

const server = setupServer(...handlers);

/** 목업 A2A 서비스 가동. 이미 켜져 있으면 무시. */
export function startA2aMock(): void {
  server.listen({ onUnhandledRequest: "bypass" });
}

/** 테스트 정리용. */
export function stopA2aMock(): void {
  server.close();
}
