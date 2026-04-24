import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * Middleware ligero: solo verifica presencia de sesión para rutas protegidas.
 * La autorización por rol se hace en cada layout / Server Action vía requireRole().
 */
export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  const publicPaths = ["/", "/login", "/postular-docente", "/prueba", "/api/auth", "/api/cron", "/api/test-sessions"]
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (!isPublic && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\..*).*)"],
}
