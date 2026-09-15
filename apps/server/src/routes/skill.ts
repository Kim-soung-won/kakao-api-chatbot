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
      const ctx = parseSkillContext(request.body);
      const { block, response } = handleSkill(ctx);
      request.log.info({ utterance: ctx.utterance, block }, "skill dispatched");
      return response;
    },
  );
}
