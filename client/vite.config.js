import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In development the browser calls /api on the Vite server, which forwards it to Express.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
