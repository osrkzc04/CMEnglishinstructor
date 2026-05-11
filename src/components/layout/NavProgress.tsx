"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * Barra de progreso global tipo nprogress, sin dependencias externas.
 *
 * Estrategia:
 *  - Se dispara al click en cualquier `<a>` con href interno o al `submit`
 *    de un formulario (el wizard, los toggles del listado, etc.).
 *  - Se completa cuando cambia `pathname` o `searchParams` (la navegación
 *    realmente sucedió). Si pasan 8 s sin completar, se reinicia para no
 *    quedar colgada (caso: misma URL, falló la action, etc.).
 *
 * Diseño: 1.5 px de alto, color de marca (teal), z-index alto. No
 * intercepta clicks porque tiene `pointer-events-none`.
 */

const TICK_MS = 200
const COMPLETE_HIDE_MS = 220
const SAFETY_TIMEOUT_MS = 8_000

export function NavProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState<number | null>(null)
  const tickerRef = useRef<number | null>(null)
  const safetyRef = useRef<number | null>(null)
  const startedAt = useRef<string | null>(null)

  function clearTickers() {
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current)
      tickerRef.current = null
    }
    if (safetyRef.current) {
      window.clearTimeout(safetyRef.current)
      safetyRef.current = null
    }
  }

  function start() {
    clearTickers()
    setProgress((current) => Math.max(current ?? 0, 12))
    startedAt.current = `${pathname}?${searchParams.toString()}`
    tickerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p === null || p >= 90) return p
        // Easing: cuanto más cerca de 90, más despacio sube.
        return p + (90 - p) * 0.12
      })
    }, TICK_MS)
    safetyRef.current = window.setTimeout(() => {
      complete()
    }, SAFETY_TIMEOUT_MS)
  }

  function complete() {
    clearTickers()
    setProgress(100)
    window.setTimeout(() => setProgress(null), COMPLETE_HIDE_MS)
  }

  // Detectar navegaciones reales: cuando pathname o searchParams cambian
  // respecto al snapshot tomado al iniciar.
  useEffect(() => {
    if (progress === null) return
    if (startedAt.current === null) return
    const current = `${pathname}?${searchParams.toString()}`
    if (current !== startedAt.current) {
      complete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Listeners globales: clicks a links + submits.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      const target = e.target as HTMLElement | null
      if (!target) return
      const anchor = target.closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href) return
      if (anchor.target === "_blank") return
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return
      if (href.startsWith("http") && !href.startsWith(window.location.origin)) return
      start()
    }

    function onSubmit() {
      start()
    }

    document.addEventListener("click", onClick)
    document.addEventListener("submit", onSubmit, true)
    return () => {
      document.removeEventListener("click", onClick)
      document.removeEventListener("submit", onSubmit, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Cleanup al desmontar
  useEffect(() => () => clearTickers(), [])

  if (progress === null) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]">
      <div
        className="h-full bg-teal-500 shadow-[0_0_8px_rgba(39,159,137,0.55)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </div>
  )
}
