"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Wrapper de scroll-reveal sutil para la landing. Cuando el bloque entra al
 * viewport (≥12% visible) se interpola opacidad + translate-y hacia el estado
 * final. Animación de una sola pasada — `disconnect()` apenas se gatilla.
 *
 * Respeta `prefers-reduced-motion` vía Tailwind `motion-reduce:*`. Si el JS
 * está deshabilitado el contenido queda con opacidad inicial 0 — aceptable
 * para una landing pública (los crawlers ven el DOM completo).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Component = "div",
}: {
  children: React.ReactNode
  className?: string
  /** Demora en ms — útil para encadenar Reveals dentro de la misma sección. */
  delay?: number
  as?: "div" | "section" | "article" | "header"
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Component
      ref={ref as React.RefObject<HTMLDivElement>}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        "motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        className,
      )}
    >
      {children}
    </Component>
  )
}
