import { A2A_ENDPOINT } from "./config.js";

/**
 * 목업/실제 A2A 서비스에 질문을 보내고 **SSE 스트림을 끝까지 소비**해 최종 답변을 반환한다.
 *
 * 카카오 챗봇 말풍선은 토큰 단위 실시간 스트리밍을 지원하지 않으므로, 여기서 스트림을 전부
 * 모아 하나의 완성 텍스트로 만든다(그 결과를 콜백으로 1회 전송). onDelta로 진행 로깅은 가능.
 */
export async function askA2a(
  question: string,
  onDelta?: (delta: string) => void,
): Promise<string> {
  const res = await fetch(A2A_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok || !res.body) throw new Error(`A2A 요청 실패: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 이벤트는 빈 줄(\n\n)로 구분된다.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      try {
        const payload = JSON.parse(dataLine.slice(5).trim()) as {
          delta?: string;
          done?: boolean;
        };
        if (typeof payload.delta === "string") {
          answer += payload.delta;
          onDelta?.(payload.delta);
        }
      } catch {
        // 파싱 불가한 이벤트는 무시(하트비트 등).
      }
    }
  }

  return answer.trim();
}
