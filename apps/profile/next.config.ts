import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

  compiler: {
    removeConsole: true,
  }
};

export default nextConfig;
