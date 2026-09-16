import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { skillRoutes } from "./routes/skill.js";
import { echoRoutes } from "./routes/echo.js";
import { callbackSinkRoutes } from "./routes/callback-sink.js";
import { A2A_AUTH, A2A_ENDPOINT, A2A_MOCK_ENABLED, A2A_PROTOCOL } from "./a2a/config.js";

// A2A 설정 요약을 시작 로그로 남긴다(토큰 값은 숨김). env 주입 여부를 컨테이너 로그에서 바로 확인.
console.log(
  `[a2a] endpoint=${new URL(A2A_ENDPOINT).host} protocol=${A2A_PROTOCOL} mock=${A2A_MOCK_ENABLED} ` +
    `auth=${A2A_AUTH ? "설정됨" : "⚠️ 미설정(.env A2A_AUTH 확인 — 인증 필요한 엔드포인트는 401)"}`,
);

// 목업 A2A 서비스(MSW) 가동 — 실제 A2A/RAG 백엔드가 붙기 전 SSE 연동 파이프라인 검증용.
// 실제 서버를 붙이면 A2A_MOCK=0으로 끈다. msw는 동적 import(프로덕션 번들에서 분리).
if (A2A_MOCK_ENABLED) {
  const { startA2aMock } = await import("./a2a/mock.js");
  startA2aMock();
}

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
await app.register(callbackSinkRoutes);

const port = Number(process.env["PORT"] ?? 3000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
