import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    build: {
        rolldownOptions: {
            output: {
                advancedChunks: {
                    groups: [
                        { name: 'editor', test: /node_modules\/(@codemirror|@uiw|@lezer|codemirror)/ },
                        { name: 'compiler', test: /node_modules\/sucrase/ },
                        { name: 'elements', test: /node_modules\/@unlayer/ },
                        { name: 'react', test: /node_modules\/(react|react-dom|scheduler)/ },
                    ],
                },
            },
        },
    },
});
