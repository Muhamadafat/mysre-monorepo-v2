// apps/brain/next.config.ts
import type { NextConfig } from 'next';
import type { Configuration } from 'webpack';

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
      'http://brain.localhost:3001',
      'http://main.localhost:3000',
      'brain.localhost:3001',
      'main.localhost:3000',
    ],
  }),

  reactStrictMode: true,
  transpilePackages: ['@sre-monorepo/lib', '@sre-monorepo/components'],

  webpack: (config: Configuration, { isServer }: { isServer: boolean }) => {
    // Fix ChunkLoadError dari react-pdf-highlighter / pdfjs-dist di Next.js 15
    // canvas adalah native module yang tidak tersedia di browser build
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...(config.resolve.alias as Record<string, string>),
        canvas: false,
      };
    }

    // Paksa pdfjs-dist (termasuk yang di-bundle di dalam react-pdf-highlighter)
    // menjadi chunk yang terpisah dengan nama yang pendek & stabil
    config.module = config.module ?? {};
    config.module.rules = config.module.rules ?? [];
    (config.module.rules as any[]).push({
      test: /pdf\.worker(\.min)?\.m?js$/,
      type: 'asset/resource',
    });

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
            // Set ke '*' untuk localhost development agar mempermudah cross-origin
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

  // TypeScript settings
  typescript: {
    ignoreBuildErrors: true,
  },

  // Development settings
  ...(process.env.NODE_ENV === 'development' && {
    eslint: {
      ignoreDuringBuilds: false,
    },
  }),

  images: {
    domains: ['vefmmrwuwritxbgowqyv.supabase.co'],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
