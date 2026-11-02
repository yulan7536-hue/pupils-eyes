import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command }) => {
  /**
   * 同一份 dist 要能挂在两种地方：
   * - GitHub Pages 项目站点，前缀 /pupils-eyes/
   * - 云端应用域名，直接吃根路径 /
   * 写死任何一边，另一边就会 404 白屏。用相对路径两边都成立 ——
   * 这个应用是纯 hash 路由（#note / #album），文档路径不会变，相对的 ./assets 解析得住。
   * 真要覆盖还可以用 VITE_BASE 指定。
   */
  const base = process.env.VITE_BASE ?? (command === 'build' ? './' : '/');

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // 云端发布走反向代理，Host 头不是 localhost，Vite 默认会拦下来
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
