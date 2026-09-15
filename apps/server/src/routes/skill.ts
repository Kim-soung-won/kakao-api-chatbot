import type { FastifyInstance } from "fastify";
import type { SkillCallbackAck, SkillResponse } from "@sprint-kakao/contract";
import { parseSkillContext, recordTurn, selectBlock } from "../skill/index.js";
import type { SkillBlock, SkillContext } from "../skill/index.js";
import { skillPayloadSchema, skillResponseSchema } from "../schemas.js";

/**
 * POST /skill
 * 카카오 스킬 서버 본 엔드포인트.
 * - 일반 블록: 동기로 SkillResponse 반환.
 * - 콜백 블록(A2A·RAG 등 5초 초과): callbackUrl 있으면 즉시 useCallback 대기응답 후
 *   백그라운드에서 최종 응답을 callbackUrl로 POST. 없으면 동기 await(로컬 데모).
 */
export async function skillRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/skill",
    {
      schema: {
        tags: ["skill"],
        summary: "카카오 스킬 웹훅 — 발화 처리 후 SkillResponse 반환",
        description:
          "카카오 오픈빌더가 등록된 스킬 URL로 POST한다. 발화별 블록으로 디스패치. 5초 초과 처리(A2A·RAG)는 콜백 플로우로 반환. 요청 타입은 가설이라 방어적으로 파싱한다.",
        body: skillPayloadSchema,
        response: { 200: skillResponseSchema },
      },
    },
    async (request): Promise<SkillResponse | SkillCallbackAck> => {
      // 실카톡 요청 원문(헤더·바디)을 WAS 콘솔에 그대로 찍는다(요청 계약 실측용).
      console.log("[/skill] headers:", JSON.stringify(request.headers, null, 2));
      console.log("[/skill] body:", JSON.stringify(request.body, null, 2));

      const ctx = await parseSkillContext(request.body);
      const block = selectBlock(ctx);

      if (block.callback) {
        return handleCallbackBlock(app, block, ctx);
      }

      const response = block.respond(ctx);
      await recordTurn(ctx, block, response);
      request.log.info(
        { utterance: ctx.utterance, userId: ctx.userId, historyTurns: ctx.history.length, block: block.name },
        "skill dispatched",
      );
      return response;
    },
  );
}

/**
 * 콜백 블록 처리.
 * - callbackUrl 있음: 즉시 useCallback 대기응답, 백그라운드에서 run() → callbackUrl로 최종 POST.
 * - callbackUrl 없음: run()을 동기 await(로컬/콜백 미설정 데모). 실패 시 respond() 폴백.
 */
function handleCallbackBlock(
  app: FastifyInstance,
  block: SkillBlock,
  ctx: SkillContext,
): SkillResponse | SkillCallbackAck | Promise<SkillResponse> {
  const cb = block.callback!;

  if (ctx.callbackUrl) {
    const callbackUrl = ctx.callbackUrl;
    // fire-and-forget: 5초 응답 제한에 걸리지 않도록 즉시 반환하고 백그라운드에서 처리.
    void (async () => {
      try {
        const response = await cb.run(ctx);
        await recordTurn(ctx, block, response);
        const res = await fetch(callbackUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(response),
        });
        app.log.info({ block: block.name, callbackUrl, status: res.status }, "callback delivered");
      } catch (err) {
        app.log.error({ err, block: block.name }, "callback run/delivery failed");
        // 폴백을 콜백으로 보내 사용자가 무응답을 겪지 않게 한다.
        try {
          await fetch(callbackUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(block.respond(ctx)),
          });
        } catch {
          /* 콜백 전송 자체 실패 — 로그만. */
        }
      }
    })();

    app.log.info({ block: block.name }, "callback ack (useCallback) returned");
    return { version: "2.0", useCallback: true, data: { text: cb.waitingText } };
  }

  // callbackUrl 없음(로컬/콜백 미설정): 동기 await. A2A 실패 시 정적 폴백.
  return cb
    .run(ctx)
    .then(async (response) => {
      await recordTurn(ctx, block, response);
      return response;
    })
    .catch((err) => {
      app.log.error({ err, block: block.name }, "sync callback-run failed; fallback");
      return block.respond(ctx);
    });
}
