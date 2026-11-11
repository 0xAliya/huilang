import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 相对路径，放在 GitHub Pages 的子目录下也能加载资源
  base: './',
  build: { chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.ts'] },
});
