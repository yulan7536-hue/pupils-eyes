import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command }) => {
  // GitHub Pages 项目站点部署在 /<repository>/ 子路径下，
  // 构建时必须带上前缀，否则 /assets/*.js 会 404 导致白屏。
  // 本地 dev 仍用根路径，方便直接访问 http://localhost:3000/。
  const base = process.env.VITE_BASE ?? (command === 'build' ? '/pupils-eyes/' : '/');

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
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
