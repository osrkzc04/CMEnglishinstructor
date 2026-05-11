import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/lib/auth.config"

/**
 * Middleware ligero (Edge runtime): verifica presencia de JWT en rutas
 * protegidas y redirige a /login. La autorización por rol se hace en cada
 * layout y Server Action vía requireRole() — el middleware NO hace esa
 * distinción para evitar depender de Prisma en Edge.
 */

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  const publicPaths = [
    "/",
    "/login",
    "/activar",
    "/recuperar",
    "/postular-docente",
    "/prueba",
    "/api/auth",
    "/api/cron",
    "/api/test-sessions",
  ]
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
