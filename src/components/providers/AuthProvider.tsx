"use client"

import { SessionProvider } from "next-auth/react"

/**
 * Wrapper del SessionProvider para que Client Components puedan usar
 * `useSession()` sin roundtrip al servidor. La gran mayoría de pantallas sigue
 * leyendo la sesión con `auth()` server-side; este provider existe para casos
 * puntuales (ej: widgets que reaccionan a cambios de sesión sin recargar).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
