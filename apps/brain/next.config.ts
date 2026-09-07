// apps/brain/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tambahkan allowedDevOrigins untuk mengatasi warning
  // allowedDevOrigins: process.env.NODE_ENV === 'development' ? [
  //   'http://localhost:3000',
  //   'http://localhost:3001', 
  //   'http://brain.lvh.me:3001',
  //   'http://main.lvh.me:3000',
  //   'brain.lvh.me:3001',
  //   'main.lvh.me:3000',
  // ] : undefined,

  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [
      'localhost',
      'main.lvh.me',
      'brain.lvh.me',
      'profile.lvh.me',
      'writer.lvh.me',
    ]
  }),

  reactStrictMode: true,
  transpilePackages: ['@sre-monorepo/lib', '@sre-monorepo/components'],

  // @citation-js/core statically imports node-fetch/sync-fetch, but only ever
  // calls them on the server (it switches to native fetch in the browser at
  // runtime). Bundlers still need to resolve those Node-only packages for the
  // client bundle, so point them at a no-op stub instead.
  turbopack: {
    resolveAlias: {
      'node-fetch': './src/stubs/node-fetch-stub.ts',
      'sync-fetch': './src/stubs/node-fetch-stub.ts',
      '@mediapipe/face_mesh': './src/stubs/mediapipe-face-mesh-shim.ts',
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'node-fetch': require.resolve('./src/stubs/node-fetch-stub.ts'),
        'sync-fetch': require.resolve('./src/stubs/node-fetch-stub.ts'),
        '@mediapipe/face_mesh': require.resolve('./src/stubs/mediapipe-face-mesh-shim.ts'),
      };
    }
    return config;
  },

  // Production-ready settings
  ...(process.env.NODE_ENV === 'production' && {
    compress: true,
    poweredByHeader: false,
    generateEtags: true,
  }),
  
  // Headers configuration untuk CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' 
              ? 'http://main.lvh.me:3000,http://brain.lvh.me:3001' 
              : 'https://yourdomain.com'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cookie'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          }
        ]
      }
    ]
  },

  compiler: {
    removeConsole: true,
  }
}

export default nextConfig;