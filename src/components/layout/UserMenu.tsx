"use client"

import { useTransition } from "react"
import { Loader2, LogOut } from "lucide-react"
import { signOutAction } from "@/modules/auth/sign-out.action"
import { cn } from "@/lib/utils"

type UserMenuProps = {
  name: string
  roleLabel: string
  isCollapsed?: boolean
}

/**
 * Bloque de usuario en el foot del sidebar — design-mockups/Layout.html:610-621.
 *
 * Avatar 28px con iniciales en bone sobre rgba(bone, 0.08), name (13.5px bone)
 * + role (mono 11.5px chrome-muted). En colapsado: solo avatar centrado.
 *
 * Click sobre toda la fila ejecuta `signOutAction` por ahora. En el futuro:
 * abre un popover con perfil + opciones + logout.
 */
export function UserMenu({ name, roleLabel, isCollapsed }: UserMenuProps) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(() => {
      void signOutAction()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={isCollapsed ? `${name} — Cerrar sesión` : "Cerrar sesión"}
      aria-label="Menú del usuario"
      className={cn(
        "group hover:border-ink-700 hover:bg-bone/[0.03] flex w-full items-center gap-2.5 rounded-md border border-transparent text-left transition-[background-color,border-color] duration-[150ms] disabled:opacity-60",
        isCollapsed ? "justify-center p-1" : "p-1.5",
      )}
    >
      <span
        aria-hidden
        className="border-ink-600 bg-bone/[0.08] text-bone flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]"
      >
        {initials(name)}
      </span>

      {!isCollapsed && (
        <>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="text-bone block truncate text-[13.5px]">{name}</span>
            <span className="text-bone/60 mt-0.5 block font-mono text-[11.5px] tracking-[0.04em] uppercase">
              {roleLabel}
            </span>
          </span>
          <span aria-hidden className="text-bone/60 group-hover:text-bone transition-colors">
            {isPending ? (
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
            ) : (
              <LogOut size={14} strokeWidth={1.6} />
            )}
          </span>
        </>
      )}
    </button>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return `${first}${last}`.toUpperCase() || "·"
}
