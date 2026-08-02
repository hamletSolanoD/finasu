import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Finasu',
        short_name: 'Finasu',
        description: 'Control de gastos personales con categorización por IA.',
        start_url: '/',
        display: 'standalone',
        background_color: '#FFFCF6',
        theme_color: '#B7D9A1',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Los paquetes de idioma de Tesseract.js (wasm + traineddata) se cachean
        // aparte, la primera vez que se usan, vía el propio cache API del navegador
        // (ver ocr.ts) — no hace falta precachearlos aquí.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
