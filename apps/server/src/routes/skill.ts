import type { FastifyInstance } from "fastify";
import type { SkillPayload } from "@sprint-kakao/contract";
import { buildDemoResponse } from "../builders/demo.js";
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
    // request.ts는 아직 HYPOTHESIS — 방어적으로 파싱한다.
    const body = request.body as Partial<SkillPayload> | undefined;
    const utterance = body?.userRequest?.utterance ?? "";
    request.log.info({ utterance }, "skill invoked");
    return buildDemoResponse(utterance);
  });
}
