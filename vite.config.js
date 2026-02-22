import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        minify: false,
        rollupOptions: {
            output: {
                // Force Vite to maintain separate files for the core logic
                manualChunks: (id) => {
                    if (id.includes('script.js')) return 'script';
                    if (id.includes('content_generator.js')) return 'content_generator';
                    if (id.includes('logo_data.js')) return 'logo_data';
                    if (id.includes('docx_export.js')) return 'docx_export';
                },
                entryFileNames: `[name]-v10.js`,
                chunkFileNames: `[name]-v10.js`,
                assetFileNames: `[name].[ext]`
            }
        }
    }
});
