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
    "/resultados",
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
  // `api/materials/upload` se excluye del middleware a propósito: es un upload
  // binario en streaming (archivos de cientos de MB / GB). Si el middleware
  // corre sobre esa ruta, Next bufferea el body para pasárselo y lo trunca a
  // 10MB (middlewareClientMaxBodySize). El route handler ya hace su propia
  // autorización con requireRole(), así que saltarse el middleware no abre hueco.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|api/materials/upload|.*\\..*).*)"],
}
