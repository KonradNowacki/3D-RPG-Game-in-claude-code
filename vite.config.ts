import { defineConfig } from 'vite';

export default defineConfig({
  // esnext: keeps top-level await working (Vite's default es2020 target rejects it).
  build: { target: 'esnext' },
});
