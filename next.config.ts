import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sharp', 'archiver', 'pdfkit'],
  experimental: {
    // Uploads laufen als Stream durch Route Handler, nicht durch Server Actions.
    serverActions: { bodySizeLimit: '2mb' },
  },
}

export default config
