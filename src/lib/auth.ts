import "server-only"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { compare } from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

/**
 * Auth.js v5 con credenciales (email + password) y sesiones en DB vía PrismaAdapter.
 *
 * Nota: el rol del usuario está en el modelo User de Prisma. Lo expandimos al
 * objeto de sesión vía callbacks para que esté disponible en `auth()` calls.
 */

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })

        if (!user || !user.passwordHash) return null
        if (user.status !== "ACTIVE") return null

        const valid = await compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, role: true, firstName: true, lastName: true },
        })
        if (dbUser) {
          session.user.id = dbUser.id
          // @ts-expect-error — extender tipo de sesión
          session.user.role = dbUser.role
        }
      }
      return session
    },
  },
})
