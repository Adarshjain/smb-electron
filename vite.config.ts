import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [
        tailwindcss(),
        react()
    ],
    build: { outDir: "dist" },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    }
});

