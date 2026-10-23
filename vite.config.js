
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    build: {
        outDir: 'static/chat/dist',
        emptyOutDir: true,
        lib: {
            entry: resolve(__dirname, 'static/chat/js/crypto.js'),
            formats: ['es'],
            fileName: 'crypto'
        }
    }
});
