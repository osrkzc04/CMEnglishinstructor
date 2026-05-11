"use server"

import { AuthError } from "next-auth"
import { signIn } from "@/lib/auth"
import { LoginSchema, type LoginInput } from "@/modules/auth/schemas"

type SignInResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string }

/**
 * Login con credenciales. Valida con Zod, invoca NextAuth con
 * `redirect: false` y devuelve un resultado discriminado para que el cliente
 * decida cómo reaccionar (router.push, toast, etc.).
 *
 * El redirect final por rol se calcula en el Server Component que renderiza el
 * layout — aquí solo devolvemos el `callbackUrl` que pidió el middleware o un
 * fallback neutro a "/" (la raíz redirige según rol).
 */
export async function signInWithCredentials(
  input: LoginInput,
  callbackUrl?: string,
): Promise<SignInResult> {
  const parsed = LoginSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { success: false, error: "Correo o contraseña incorrectos" }
      }
      return { success: false, error: "No se pudo iniciar sesión" }
    }
    throw error
  }

  return { success: true, redirectTo: callbackUrl ?? "/" }
}
