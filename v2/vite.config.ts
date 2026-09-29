import { defineConfig, loadEnv } from 'vite';
import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const require = createRequire(import.meta.url);
const { validate } = require('../scripts/inject-config.js');

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const url = (env.VITE_SUPABASE_URL || '').trim();
  const key = (env.VITE_SUPABASE_KEY || '').trim();
  if (url || key) {
    const error = validate(url, key);
    if (error) throw new Error(error);
  }
  return {
  base: './',
  plugins: [react(), tailwindcss()],
  };
});