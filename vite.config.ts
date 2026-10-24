import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  build: { outDir: '../dist-demo', emptyOutDir: true },
  // Previews are served through an external hostname.
  server: { allowedHosts: true },
  preview: { allowedHosts: true },
});
