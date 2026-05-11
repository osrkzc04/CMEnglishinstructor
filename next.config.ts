import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

// next-intl sin URL routing: el locale activo vive en una cookie
// (`NEXT_LOCALE`) y se resuelve server-side en `src/i18n/request.ts`.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next.js 15.5+ movió typedRoutes fuera de `experimental`.
  typedRoutes: true,
  // ESLint desactivado durante el build porque el scaffold referencia
  // `@eslint/eslintrc` sin declararlo en package.json. Se corregirá cuando
  // se aborde la capa de CI/lint; el typecheck sigue corriendo.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Paquetes Node-only que webpack NO debe intentar empaquetar. Sin esto,
  // el análisis estático del bundle Edge (instrumentation.ts se compila para
  // ambos runtimes) intenta resolver módulos como `nodemailer` que usan
  // `fs`/`net`/`tls` y rompe el build.
  //   - nodemailer: SMTP provider (src/lib/email/smtp-provider.ts).
  //   - bcryptjs: hashing de contraseñas en el seed + actions de auth.
  //   - @prisma/client: ya es externo por su naturaleza, lo listamos
  //     explícitamente para evitar warnings de "package was bundled".
  serverExternalPackages: ["nodemailer", "bcryptjs", "@prisma/client"],
  images: {
    remotePatterns: [
      // Agregar aquí el dominio de R2 cuando migre storage a cloud
      // { protocol: "https", hostname: "cdn.cmenglishinstructor.com" },
      // Fotos editoriales del landing — placeholders mientras no haya
      // sesión de fotos propia. Reemplazables dropeando archivos en
      // /public/landing/ y cambiando las constantes en los Marketing*.tsx.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
}

export default withNextIntl(nextConfig)
