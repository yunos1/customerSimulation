/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // 游戏逻辑全是纯函数，跑在 node 下即可，无需 jsdom。
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
