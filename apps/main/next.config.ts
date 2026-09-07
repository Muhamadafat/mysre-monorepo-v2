// apps/main/next.config.ts
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
  //prod ready settings
  reactStrictMode: true,

  // Production settings
  ...(process.env.NODE_ENV === 'production' && {
    compress: true,
    poweredByHeader: false,
    generateEtags: true,
  }),

  compiler: {
    removeConsole: true,
  }
}

export default nextConfig;