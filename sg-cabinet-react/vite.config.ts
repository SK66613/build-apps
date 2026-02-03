import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Published as a subfolder of the existing cabinet site:
  // https://app.salesgenius.ru/panel-react/
  base: '/panel-react/',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://app.salesgenius.ru',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
