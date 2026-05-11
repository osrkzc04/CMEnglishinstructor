"use client"

import { useState } from "react"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme/ThemeProvider"

/**
 * Topbar del login — replica design-mockups/Login.html:483-500.
 *
 * ES/EN lang toggle a la izquierda + Light/Dark theme toggle a la derecha.
 * El idioma se conserva en estado local (no hay i18n cableado todavía).
 */
export function LoginTopbar() {
  const [lang, setLang] = useState<"ES" | "EN">("ES")
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <header className="flex items-center justify-between pb-2">
      {/* Lang toggle */}
      <div
        role="tablist"
        aria-label="Idioma"
        className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5"
      >
        {(["ES", "EN"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-pressed={lang === opt}
            onClick={() => setLang(opt)}
            className={cn(
              "rounded-[5px] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
              lang === opt
                ? "bg-ink-900 text-bone dark:bg-bone dark:text-ink-900"
                : "text-text-3 hover:text-foreground",
            )}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Theme toggle */}
      <div
        role="tablist"
        aria-label="Modo"
        className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5"
      >
        <button
          type="button"
          role="tab"
          aria-pressed={!isDark}
          onClick={() => setTheme("light")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-[12px] transition-colors",
            !isDark
              ? "bg-ink-900 text-bone dark:bg-bone dark:text-ink-900"
              : "text-text-3 hover:text-foreground",
          )}
        >
          <Sun size={13} strokeWidth={1.6} />
          Light
        </button>
        <button
          type="button"
          role="tab"
          aria-pressed={isDark}
          onClick={() => setTheme("dark")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-[12px] transition-colors",
            isDark
              ? "bg-ink-900 text-bone dark:bg-bone dark:text-ink-900"
              : "text-text-3 hover:text-foreground",
          )}
        >
          <Moon size={13} strokeWidth={1.6} />
          Dark
        </button>
      </div>
    </header>
  )
}
