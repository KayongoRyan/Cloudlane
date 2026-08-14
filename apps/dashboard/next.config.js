/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  webpack: (config) => {
    // Prevent webpack from warning about platform-specific @next/swc managed paths
    config.snapshot = config.snapshot || {};
    config.snapshot.managedPaths = [];
    return config;
  },
}

module.exports = nextConfig
