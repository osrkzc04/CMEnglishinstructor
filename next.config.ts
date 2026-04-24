import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      // Agregar aquí el dominio de R2 cuando migre storage a cloud
      // { protocol: "https", hostname: "cdn.cmenglishinstructor.com" },
    ],
  },
}

export default nextConfig
