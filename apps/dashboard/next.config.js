const netlifyApi = 'https://comfy-starlight-51c0e7.netlify.app'

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.VERCEL === '1' ? netlifyApi : 'http://localhost:3001')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
  webpack: (config) => {
    // Prevent webpack from warning about platform-specific @next/swc managed paths
    config.snapshot = config.snapshot || {};
    config.snapshot.managedPaths = [];
    return config;
  },
}

module.exports = nextConfig
