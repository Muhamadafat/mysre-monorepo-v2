// apps/main/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tambahkan allowedDevOrigins untuk mengatasi warning
  // allowedDevOrigins: process.env.NODE_ENV === 'development' ? [
  //   'http://localhost:3000',
  //   'http://localhost:3001',
  //   'http://brain.localhost:3001',
  //   'http://main.localhost:3000',
  //   'brain.localhost:3001',
  //   'main.localhost:3000',
  // ] : undefined,

  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://brain.localhost:3001',
      'http://main.localhost:3000',
      'brain.localhost:3001',
      'main.localhost:3000',
    ],
  }),
  //prod ready settings
  reactStrictMode: true,

  // Development settings
  ...(process.env.NODE_ENV === 'development' && {
    typescript: {
      ignoreBuildErrors: true,
    },
    eslint: {
      ignoreDuringBuilds: false,
    },
  }),

  // Tambahkan untuk production deployment
  ...(process.env.NODE_ENV === 'production' && {
    typescript: {
      ignoreBuildErrors: true, // ← Tambah ini
    },
    eslint: {
      ignoreDuringBuilds: true, // ← Tambah ini
    },
    compress: true,
    poweredByHeader: false,
    generateEtags: true,
  }),

  compiler: {
    removeConsole: true,
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cookie',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
