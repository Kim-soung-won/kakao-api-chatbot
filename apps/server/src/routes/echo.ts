import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import type { SkillResponse } from "@sprint-kakao/contract";

const CAPTURE_DIR = join(process.cwd(), "captured-requests");

/**
 * POST /echo
 * 실제 카카오 요청을 **원문 그대로 캡처**해 파일로 저장하고 로그로 남긴다.
 * 목적: 공개 문서에 없는 요청 계약을 실측 확정한다.
 *   - user.id(botUserKey)가 세션 간 고정인가
 *   - 응답 context.params가 다음 요청 contexts로 왕복되는가
 *   - contexts params 수명(lifeSpan/ttl)
 * 카카오가 뭔가 렌더링하도록 최소 유효 응답을 돌려준다.
 */
export async function echoRoutes(app: FastifyInstance): Promise<void> {
  app.post("/echo", async (request) => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const payload = {
      receivedAt: new Date().toISOString(),
      headers: request.headers,
      body: request.body,
    };

    await mkdir(CAPTURE_DIR, { recursive: true });
    const file = join(CAPTURE_DIR, `echo-${ts}.json`);
    await writeFile(file, JSON.stringify(payload, null, 2), "utf8");

    // 실측 관심 필드를 콘솔에 요약
    const body = request.body as Record<string, unknown> | undefined;
    const userRequest = body?.["userRequest"] as Record<string, unknown> | undefined;
    request.log.info(
      {
        savedTo: file,
        userId: (userRequest?.["user"] as Record<string, unknown> | undefined)?.["id"],
        hasContexts: Array.isArray(userRequest?.["contexts"]),
      },
      "echo captured",
    );

    const response: SkillResponse = {
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: "✅ 요청을 캡처했습니다. (서버 콘솔 및 captured-requests/ 확인)",
            },
          },
        ],
      },
    };
    return response;
  });
}
