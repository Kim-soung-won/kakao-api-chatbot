import type { FastifyInstance } from "fastify";
import type { SkillCallbackAck, SkillResponse } from "@sprint-kakao/contract";
import { parseSkillContext, selectBlock } from "../skill/index.js";
import type { SkillBlock, SkillContext } from "../skill/index.js";
import { skillPayloadSchema, skillResponseSchema } from "../schemas.js";

/** 콜백 미설정 시 동기 시도 예산(ms). 카카오 5초 제한보다 짧게 잡아 1001 타임아웃을 피한다. */
const SYNC_BUDGET_MS = Number(process.env["SYNC_BUDGET_MS"] ?? 3500);

/**
 * POST /skill
 * 카카오 스킬 서버 본 엔드포인트.
 * - onboarding 카드 단계: 동기로 SkillResponse 반환.
 * - 콜백 블록(agent·onboarding 완료 등 5초 초과): callbackUrl 있으면 즉시 useCallback 대기응답 후
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
          "카카오 오픈빌더가 등록된 스킬 URL로 POST한다. 온보딩 외 모든 발화는 에이전트로 디스패치. 5초 초과 처리(A2A)는 콜백 플로우로 반환. 요청 타입은 가설이라 방어적으로 파싱한다.",
        body: skillPayloadSchema,
        response: { 200: skillResponseSchema },
      },
    },
    async (request): Promise<SkillResponse | SkillCallbackAck> => {
      // 실카톡 요청 원문(헤더·바디)을 WAS 콘솔에 그대로 찍는다(요청 계약 실측용).
      console.log("[/skill] headers:", JSON.stringify(request.headers, null, 2));
      console.log("[/skill] body:", JSON.stringify(request.body, null, 2));

      const ctx = parseSkillContext(request.body);
      const block = selectBlock(ctx);
      // 콜백 수신 여부를 명확히 로깅(콜백 미설정이면 5초 초과 처리는 폴백만 가능).
      console.log(
        `[/skill] utterance="${ctx.utterance}" block=${block.name} callbackUrl=${ctx.callbackUrl ? "있음(콜백 활성)" : "없음(콜백 미설정→폴백)"}`,
      );

      if (block.callback && (block.callback.when?.(ctx) ?? true)) {
        return handleCallbackBlock(app, block, ctx);
      }

      const response = block.respond(ctx);
      request.log.info(
        { utterance: ctx.utterance, userId: ctx.userId, block: block.name },
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

  // callbackUrl 없음(콜백 미설정): 카카오 5초 제한 때문에 오래 붙잡으면 1001 타임아웃이 난다.
  // → SYNC_BUDGET_MS(카카오 5초보다 짧게) 안에서만 동기 시도하고, 초과하면 즉시 정적 폴백.
  //   (A2A_DURATION_MS를 예산보다 낮추면 콜백 없이도 실제 A2A 답변을 5초 안에 받을 수 있다.)
  const timedOut = Symbol("timeout");
  return Promise.race([
    cb.run(ctx).catch((err) => {
      app.log.error({ err, block: block.name }, "sync a2a run failed");
      return null;
    }),
    new Promise<typeof timedOut>((res) => setTimeout(() => res(timedOut), SYNC_BUDGET_MS)),
  ]).then((result) => {
    if (result === timedOut || result === null) {
      app.log.warn(
        { block: block.name, budgetMs: SYNC_BUDGET_MS },
        "a2a exceeded sync budget without callbackUrl; returning fallback (enable callback for slow A2A)",
      );
      return block.respond(ctx);
    }
    return result;
  });
}
