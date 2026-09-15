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

/** 발화 주제에 따라 만들어낼 목업 답변 문단(실제 RAG 답변 자리). */
function mockAnswer(question: string): string {
  return (
    `【AI 상담 결과】\n"${question}"에 대한 안내입니다.\n\n` +
    `• 대상: 강서구 거주 다문화가정 (국적 무관)\n` +
    `• 의료비: 본인부담금 일부 지원, 건강보험 미가입자 진료 연계\n` +
    `• 건강검진: 연 1회 무료 (다국어 문진표 제공)\n` +
    `• 심리상담: 통역 동반 상담 예약 가능\n\n` +
    `신청은 다문화가족지원센터(☎ 02-000-0000)로 문의하세요.`
  );
}

/** 답변을 자연스러운 토큰 단위로 쪼갠다(공백 유지). */
function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [text];
}

const handlers = [
  http.post(A2A_ENDPOINT, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { question?: string };
    const tokens = tokenize(mockAnswer(body.question ?? "(빈 질문)"));
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
