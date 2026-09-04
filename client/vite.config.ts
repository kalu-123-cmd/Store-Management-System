import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'storeos-logo.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: '/',
        name: 'StoreOS — Smart Retail Management',
        short_name: 'StoreOS',
        description: 'StoreOS store management — sales, inventory, purchase orders',
        theme_color: '#1e40af',
        background_color: '#0f172a',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'en',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        categories: ['business', 'productivity', 'utilities'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        // Don't cache image data URIs (base64 product images are large)
        globIgnores: ['**/node_modules/**/*'],
        runtimeCaching: [
          {
            // Cache GraphQL responses with network-first strategy
            urlPattern: ({ url }) => url.pathname === '/graphql',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'graphql-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 30, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  optimizeDeps: {
    include: [
      '@apollo/client',
      '@apollo/client/link/context',
      '@apollo/client/link/error',
      'graphql',
      '@tanstack/react-table',
    ],
  },
});
