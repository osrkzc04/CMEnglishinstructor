import type { NextAuthConfig } from "next-auth"
import type { Role } from "@prisma/client"

/**
 * Config compartido entre el runtime Node (lib/auth.ts, con adapter y Prisma)
 * y el runtime Edge (middleware.ts). Este archivo no debe importar Prisma ni
 * bcrypt — solo callbacks puros y metadatos que funcionen en Edge.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: Role }).role
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        if (typeof token.id === "string") session.user.id = token.id
        const role = token.role as Role | undefined
        if (role) session.user.role = role
      }
      return session
    },
  },
} satisfies NextAuthConfig
