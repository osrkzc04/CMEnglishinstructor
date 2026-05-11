import Link from "next/link"
import type { Route } from "next"
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"

/**
 * Shell visual compartido por las pantallas auxiliares de autenticación
 * (activar cuenta, recuperar contraseña). Es una tarjeta centrada sobre
 * fondo bone — más liviana que el split editorial del login, que reserva
 * ese tratamiento al ingreso principal.
 */

export function AuthCardShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen flex-col bg-background px-4 py-10">
      <header className="mb-10 flex items-center justify-center gap-3">
        <BrandMark className="text-foreground" size={28} />
        <BrandWordmark className="text-foreground" size="md" />
      </header>

      <div className="mx-auto w-full max-w-[440px] flex-1">
        <div className="rounded-xl border border-border bg-surface px-8 py-9">
          <h1 className="m-0 mb-1.5 font-serif text-[26px] font-normal leading-[1.2] tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="m-0 mb-7 text-[13.5px] leading-[1.6] text-text-2">
              {subtitle}
            </p>
          )}
          {children}
        </div>

        {footer && (
          <p className="mt-6 text-center text-[13px] text-text-3">{footer}</p>
        )}

        <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-text-4">
          <Link
            href={"/login" as Route}
            className="text-text-3 transition-colors hover:text-teal-500"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </main>
  )
}
