# 카카오 스킬 서버 컨테이너 (모노레포).
# 빌드 컨텍스트 = 저장소 루트: docker build -f apps/server/Dockerfile .
# (docker compose가 context: . 로 이 규칙을 자동 적용)

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ── 빌드 스테이지: 의존성 설치 → contract·server 빌드 → 자체완결 번들 생성 ──
FROM base AS build
# 워크스페이스 매니페스트만 먼저 복사(레이어 캐시 최적화).
# frozen-lockfile 검증을 위해 모든 워크스페이스 package.json이 필요.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/server/package.json apps/server/
COPY apps/playground/package.json apps/playground/
RUN pnpm install --frozen-lockfile

# 소스 복사 후 빌드
COPY packages/contract packages/contract
COPY apps/server apps/server
RUN pnpm --filter @sprint-kakao/contract build \
 && pnpm --filter @sprint-kakao/server build

# 워크스페이스 의존성을 주입한 prod-only 배포 번들을 /app 에 생성
RUN pnpm --filter @sprint-kakao/server deploy --prod /app

# ── 런타임 스테이지: 번들만 담은 가벼운 이미지 ──
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "dist/index.js"]
