import Fastify from "fastify";
import { skillRoutes } from "./routes/skill.js";
import { echoRoutes } from "./routes/echo.js";

// 개발에서만 pino-pretty(devDependency) 사용. 프로덕션(컨테이너)에서는 기본 JSON 로깅.
const isDev = process.env["NODE_ENV"] !== "production";
const app = Fastify({
  logger: isDev
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : true,
});

// 헬스체크
app.get("/health", async () => ({ status: "ok" }));

await app.register(skillRoutes);
await app.register(echoRoutes);

const port = Number(process.env["PORT"] ?? 3000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
