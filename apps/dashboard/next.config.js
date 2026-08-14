/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Prevent webpack from warning about platform-specific @next/swc managed paths
    config.snapshot = config.snapshot || {};
    config.snapshot.managedPaths = [];
    return config;
  },
}

module.exports = nextConfig
