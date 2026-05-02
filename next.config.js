/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Esto ayuda a que el despliegue sea más rápido
  swcMinify: true,
}

module.exports = nextConfig
