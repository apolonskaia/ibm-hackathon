/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployment
  output: 'standalone',
  // Optimize for production
  poweredByHeader: false,
  compress: true,
  // Image optimization
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  },
  // Environment variables that should be available on the client side
  env: {
    NEXT_PUBLIC_APP_NAME: 'AI System Design Assistant',
  },
  webpack: (config, { isServer }) => {
    // Fix for better-sqlite3
    if (isServer) {
      config.externals.push('better-sqlite3');
    }
    return config;
  },
}

module.exports = nextConfig

// Made with Bob
