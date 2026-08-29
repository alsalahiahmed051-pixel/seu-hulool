/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Ship browser source maps so a production stack trace names real functions
  // instead of minified letters ("n is not a function") — the difference
  // between diagnosing a user report in one pass and guessing at it.
  productionBrowserSourceMaps: true,

  eslint: {
    ignoreDuringBuilds: true,
  },

  // Allow Supabase storage images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
