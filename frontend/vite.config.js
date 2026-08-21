import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Inject service worker registration in every HTML page
      injectRegister: 'auto',

      // Pre-cache these static assets
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png'
      ],

      manifest: {
        id: '/',
        name: 'CleanVision AI — Bathroom Inspection',
        short_name: 'CleanVision',
        description: 'AI-powered hospital bathroom cleanliness evaluation and compliance tracking.',
        theme_color: '#0ea5e9',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en',
        categories: ['health', 'medical', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'apple touch icon'
          }
        ],
        shortcuts: [
          {
            name: 'Scan Bathroom',
            url: '/?action=scan',
            description: 'Start a new cleanliness audit'
          },
          {
            name: 'Report Issue',
            url: '/?action=report',
            description: 'Report a bathroom issue via QR'
          }
        ]
      },

      // Workbox service worker config
      workbox: {
        // Cache the app shell and all JS/CSS/HTML
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Runtime caching strategies
        runtimeCaching: [
          {
            // API calls — Network first, fall back to cache (max 60s stale)
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cleanvision-api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Image uploads — Cache first (they don't change)
            urlPattern: /\/uploads\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cleanvision-uploads-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Google Fonts — Cache first
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },

      // Dev options — enable service worker in development for testing
      devOptions: {
        enabled: false // Set to true to test SW in dev mode
      }
    })
  ],

  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
