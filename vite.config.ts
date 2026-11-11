import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom', 'react-reconciler'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react/jsx-runtime'] },
  server: {
    port: 5500,
    strictPort: true,
    // A API original permite explicitamente localhost:5500 no CORS.
  },
  preview: { port: 5501 },
  test: {
    exclude: ['node_modules/**', 'dist/**', 'tools/offline-tests/.build/**']
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    minify: 'esbuild',
    sourcemap: false
  }
});
