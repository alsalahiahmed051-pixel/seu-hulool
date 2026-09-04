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
          // The assistant's voice input needs the microphone, and `microphone=()`
          // denied it to our own pages — so `getUserMedia` failed with
          // NotAllowedError and Chrome's speech recognition was gated too. The
          // button could not have worked on any browser. `(self)` grants it to
          // this origin only; embedded third parties still get nothing, and
          // camera and geolocation stay fully denied.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
