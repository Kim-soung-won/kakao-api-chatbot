import type { FastifyInstance } from "fastify";

/**
 * 로컬 콜백 수신함(디버그 전용) — 실제 카카오 없이 콜백 플로우를 테스트하기 위한 목업 수신처.
 *
 * 사용: /skill 요청의 `userRequest.callbackUrl`을 이 서버의 `/callback-sink?id=<key>`로 지정하면,
 * 서버가 최종 SkillResponse를 여기로 POST한다. `GET /callback-sink?id=<key>`로 마지막 수신본 조회.
 * (실서비스에서는 카카오가 준 callbackUrl로 나가므로 이 라우트는 쓰이지 않는다.)
 */
const received = new Map<string, unknown>();

export async function callbackSinkRoutes(app: FastifyInstance): Promise<void> {
  app.post("/callback-sink", async (request) => {
    const id = (request.query as { id?: string }).id ?? "last";
    received.set(id, request.body);
    app.log.info({ id }, "callback-sink received");
    return { ok: true };
  });

  app.get("/callback-sink", async (request) => {
    const id = (request.query as { id?: string }).id ?? "last";
    return { id, payload: received.get(id) ?? null };
  });
}
