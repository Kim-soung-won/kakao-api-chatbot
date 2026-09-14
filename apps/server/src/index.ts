import Fastify from "fastify";
import { skillRoutes } from "./routes/skill.js";
import { echoRoutes } from "./routes/echo.js";

const app = Fastify({
  logger: {
    transport: { target: "pino-pretty", options: { colorize: true } },
  },
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
