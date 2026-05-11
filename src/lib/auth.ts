import "server-only"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { compare } from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { authConfig } from "@/lib/auth.config"

/**
 * Auth.js v5 con credenciales (email + password).
 *
 * Estrategia: JWT. Credentials provider en v5 es incompatible con
 * `session.strategy: "database"`. El adapter se mantiene para persistir usuarios
 * y soportar OAuth a futuro sin migrar.
 */

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
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
          role: user.role,
        }
      },
    }),
  ],
})
