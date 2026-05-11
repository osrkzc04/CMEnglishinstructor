"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "cm-sidebar"

type SidebarContextValue = {
  isCollapsed: boolean
  toggle: () => void
  setCollapsed: (next: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

/**
 * Estado compartido del colapso del sidebar entre Sidebar y Topbar.
 * Persiste en `localStorage["cm-sidebar"]` igual que el mockup
 * (Layout.html:746-748).
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === "1") setIsCollapsed(true)
    } catch {
      /* localStorage bloqueado */
    }
    setHydrated(true)
  }, [])

  const value = useMemo<SidebarContextValue>(
    () => ({
      isCollapsed: hydrated ? isCollapsed : false,
      toggle: () => {
        setIsCollapsed((prev) => {
          const next = !prev
          try {
            window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
          } catch {
            /* ignorar */
          }
          return next
        })
      },
      setCollapsed: (next: boolean) => {
        setIsCollapsed(next)
        try {
          window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
        } catch {
          /* ignorar */
        }
      },
    }),
    [isCollapsed, hydrated],
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar debe usarse dentro de <SidebarProvider>")
  return ctx
}
