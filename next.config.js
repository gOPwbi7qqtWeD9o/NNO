/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['ws']
  },
  // Optimize for Railway builds
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  // Skip type checking during build (Railway will fail if there are TS errors anyway)
  typescript: {
    ignoreBuildErrors: false
  },
  // Optimize images
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
