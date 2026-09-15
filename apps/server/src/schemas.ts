/**
 * Swagger(OpenAPI) 문서화용 JSON 스키마.
 * ⚠️ 모든 오브젝트에 additionalProperties:true — 응답 직렬화 시 카드 등 중첩 필드가
 * 잘려나가지 않도록(문서화 목적이지 필터 목적이 아님).
 */

export const skillPayloadSchema = {
  type: "object",
  additionalProperties: true,
  description: "카카오 → 서버 요청 (SkillPayload). ⚠️ HYPOTHESIS — /echo 실측으로 확정 대상.",
  properties: {
    userRequest: {
      type: "object",
      additionalProperties: true,
      properties: {
        utterance: { type: "string", description: "사용자 발화 원문" },
        user: {
          type: "object",
          additionalProperties: true,
          properties: { id: { type: "string", description: "botUserKey(추정)" } },
        },
      },
    },
    bot: { type: "object", additionalProperties: true },
    action: { type: "object", additionalProperties: true },
  },
} as const;

export const skillResponseSchema = {
  type: "object",
  additionalProperties: true,
  description: "서버 → 카카오 응답 (SkillResponse).",
  properties: {
    version: { type: "string", examples: ["2.0"] },
    template: {
      type: "object",
      additionalProperties: true,
      properties: {
        outputs: {
          type: "array",
          items: { type: "object", additionalProperties: true },
          description: "말풍선 1~3개 (simpleText·basicCard·listCard·itemCard·carousel 등)",
        },
        quickReplies: { type: "array", items: { type: "object", additionalProperties: true } },
      },
    },
    context: { type: "object", additionalProperties: true },
    data: { type: "object", additionalProperties: true },
  },
} as const;
