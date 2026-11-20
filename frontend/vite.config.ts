import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api/v1': { target: 'http://127.0.0.1:5080', changeOrigin: false, headers: { 'X-Forwarded-Proto': 'https' } } } },
  // DD-P13-18: the web image's policy, so every fixture E2E test runs under it. `vite` (dev) is unaffected.
  preview: { headers: { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
});
