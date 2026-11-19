import { defineConfig } from "nitro/config";

export default defineConfig({
  vercel: {
    // Chromium 초기 실행과 폰트 로딩을 포함한 상한이며, 목표 처리시간은 아닙니다.
    functions: { maxDuration: 120, memory: 2048 },
  },
});
