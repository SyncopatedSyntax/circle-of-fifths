import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served under /circle on the unified domain (Vercel multi-zone).
  base: '/circle/',
  plugins: [react()],
});
