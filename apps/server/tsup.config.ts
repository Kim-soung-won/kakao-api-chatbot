import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  sourcemap: true,
  target: "node22",
  // msw는 목업 전용(동적 import)이라 번들에 넣지 않고 런타임 의존성으로 둔다.
  external: ["msw", "msw/node"],
});
