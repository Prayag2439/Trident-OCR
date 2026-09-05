/** @type {import('next').NextConfig} */
const isCapacitor = process.env.CAPACITOR_BUILD === 'true';

const nextConfig = {
  reactStrictMode: false,
  ...(isCapacitor
    ? { output: 'export', images: { unoptimized: true } }
    : {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000/api/:path*',
            },
          ];
        },
      }),
};

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: false,
});

module.exports = withPWA(nextConfig);
