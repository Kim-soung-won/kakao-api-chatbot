import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { skillRoutes } from "./routes/skill.js";
import { echoRoutes } from "./routes/echo.js";

// 개발에서만 pino-pretty(devDependency) 사용. 프로덕션(컨테이너)에서는 기본 JSON 로깅.
const isDev = process.env["NODE_ENV"] !== "production";
const app = Fastify({
  logger: isDev
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : true,
});

// Swagger(OpenAPI) — 라우트 등록보다 먼저 register해야 스키마가 수집된다.
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "sprint-kakao 스킬 서버 API",
      description:
        "카카오톡 채널 챗봇 스킬 서버(인바운드 웹훅). 요청 계약(SkillPayload)은 가설이며 POST /echo 실측으로 확정한다.",
      version: "0.0.0",
    },
    tags: [
      { name: "skill", description: "챗봇 스킬 웹훅" },
      { name: "system", description: "헬스체크 등" },
    ],
  },
});
await app.register(fastifySwaggerUi, {
  routePrefix: "/docs",
  uiConfig: { docExpansion: "list", deepLinking: true },
});

// 헬스체크
app.get(
  "/health",
  {
    schema: {
      tags: ["system"],
      summary: "헬스체크",
      response: {
        200: { type: "object", properties: { status: { type: "string" } } },
      },
    },
  },
  async () => ({ status: "ok" }),
);

await app.register(skillRoutes);
await app.register(echoRoutes);

const port = Number(process.env["PORT"] ?? 3000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
