import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'StoreOS — Ethiopian Store Management',
        short_name: 'StoreOS',
        description: 'Ethiopian store management — sales, inventory, traditional items, purchase orders',
        theme_color: '#1d4ed8',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'en',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
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
        enabled: true,
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
