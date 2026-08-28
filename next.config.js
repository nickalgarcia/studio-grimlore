/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Top-level, not under `experimental`: as of Next 15 `allowedDevOrigins` is
  // a root NextConfig key. It previously sat in next.config.ts under
  // `experimental`, where it did nothing — Next resolves next.config.js first,
  // so that whole file was ignored.
  allowedDevOrigins: ['http://localhost:9002', 'http://192.168.68.107:9002'],
};

module.exports = nextConfig;
