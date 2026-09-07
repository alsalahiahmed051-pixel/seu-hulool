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

  // Left OUT of the server bundle on purpose.
  //
  // pdf-parse wraps pdf.js, which loads its parsing engine from a separate
  // worker file at runtime. Bundling the package rewrites it into
  // `.next/server/chunks/`, and the worker — a plain asset nothing imports
  // statically — does not come with it. Every PDF then fails on the deployed
  // site with «Cannot find module .../pdf.worker.mjs» while working perfectly
  // in local tests, because locally it is read straight from node_modules.
  //
  // Marking it external keeps it a real package on disk with its own files
  // beside it, which is the arrangement it was built for.
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],

    // And the worker itself is named here, because tracing follows IMPORTS and
    // nothing imports this file — pdf.js loads it by path at runtime. Keeping
    // the package external is not enough on its own: an untraced asset is left
    // out of the deployed function even when its package ships. Both routes
    // that read a PDF are listed; src/lib/pdf-worker checks the file is really
    // there before using it, so this staying true is verifiable, not assumed.
    outputFileTracingIncludes: {
      '/api/admin/index-files': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
      '/api/files': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
    },
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
