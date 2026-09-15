import type { FastifyInstance } from "fastify";
import { handleSkill, parseSkillContext } from "../skill/index.js";
import { skillPayloadSchema, skillResponseSchema } from "../schemas.js";

/**
 * POST /skill
 * 카카오 스킬 서버 본 엔드포인트. 지금은 mock 데모 응답을 반환한다.
 * (RAG 연동 시 여기서 검색 → SkillResponse 변환으로 교체.)
 */
export async function skillRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/skill",
    {
      schema: {
        tags: ["skill"],
        summary: "카카오 스킬 웹훅 — 발화 처리 후 SkillResponse 반환",
        description:
          "카카오 오픈빌더가 등록된 스킬 URL로 POST한다. 현재는 발화별 mock 데모를 반환(추후 RAG 변환). 요청 타입은 가설이라 방어적으로 파싱한다.",
        body: skillPayloadSchema,
        response: { 200: skillResponseSchema },
      },
    },
    async (request) => {
      // 실카톡이 실제로 보내는 요청 원문(헤더·바디)을 WAS 콘솔에 그대로 찍는다.
      // 요청 계약(SkillPayload)이 아직 가설이라, 실측으로 필드를 눈으로 확인하기 위함.
      console.log("[/skill] headers:", JSON.stringify(request.headers, null, 2));
      console.log("[/skill] body:", JSON.stringify(request.body, null, 2));

      const ctx = await parseSkillContext(request.body);
      const { block, response } = await handleSkill(ctx);
      request.log.info(
        { utterance: ctx.utterance, userId: ctx.userId, historyTurns: ctx.history.length, block },
        "skill dispatched",
      );
      return response;
    },
  );
}
