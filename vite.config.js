import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  assetsInclude: ['**/*.glb', '**/*.fbx'],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        previewer: resolve(__dirname, 'previewer.html'),
        inspector: resolve(__dirname, 'inspector.html'),
      },
    },
  },
});
