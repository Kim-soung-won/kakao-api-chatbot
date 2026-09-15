# playground 정적 빌드 → nginx 서빙 (모노레포).
# 빌드 컨텍스트 = 저장소 루트 (docker compose가 context: . 로 적용)

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ── 빌드 스테이지: 의존성 설치 → contract·playground 빌드 ──
FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/server/package.json apps/server/
COPY apps/playground/package.json apps/playground/
RUN pnpm install --frozen-lockfile

COPY packages/contract packages/contract
COPY apps/playground apps/playground
RUN pnpm --filter @sprint-kakao/contract build \
 && pnpm --filter @sprint-kakao/playground build

# ── 런타임 스테이지: nginx 정적 서빙 + API 프록시 ──
FROM nginx:alpine AS runtime
COPY apps/playground/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/playground/dist /usr/share/nginx/html
EXPOSE 80
