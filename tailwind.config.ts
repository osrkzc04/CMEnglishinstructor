import type { Config } from "tailwindcss"

/**
 * Tailwind tokens — alineados al 100% con los mockups aprobados:
 *   design-mockups/Layout.html · Login.html · Dashboard.html · Widgets.html
 *
 * Ver docs/design-brief.md (sección "Aprobado contra mockups · 2026-04-25")
 * para el rationale. Los hex aquí son la fuente de verdad — si algún color no
 * está en esta tabla, no debería aparecer en la UI.
 */

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "./emails/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // ──────────────────────────────────────────────────────────────────
        // INK — escala neutral azul-verde (10 niveles, mockup-exact)
        // ──────────────────────────────────────────────────────────────────
        ink: {
          DEFAULT: "#233641",
          100: "#EAECED", // border (light)
          200: "#C4C9CC", // border-strong (light)
          300: "#8F999E", // text-4 (placeholders, hints)
          400: "#707C84", // text-3 (text terciario, mono captions)
          500: "#55646C", // text-2 alt
          600: "#3E4F58", // ink-700 mockup — borders en dark
          650: "#4a5c66", // border-strong (dark) ← nuevo aprobado
          700: "#2d4451", // ink-800 mockup — surface-alt (dark) y divisores chrome
          850: "#2A3D49", // surface (dark) ← nuevo aprobado
          900: "#233641", // ink-900 — protagonista (sidebar, topbar, dark bg)
        },

        // ──────────────────────────────────────────────────────────────────
        // TEAL — acento único de marca (3 niveles reales del mockup + 50)
        // ──────────────────────────────────────────────────────────────────
        teal: {
          DEFAULT: "#279F89",
          50: "#E7F6F3", // tints muy suaves para fondos de selección
          100: "#DDEFEC", // teal-100 mockup — fondo de hover/pill teal sutil
          500: "#279F89", // base de marca
          700: "#267A6F", // hover/pressed
        },

        // ──────────────────────────────────────────────────────────────────
        // BONE — papel editorial (2 niveles reales del mockup)
        // ──────────────────────────────────────────────────────────────────
        bone: {
          DEFAULT: "#FAF8F5",
          50: "#F4F1EC", // surface-alt en light
          100: "#FAF8F5", // bg principal en light
        },

        // ──────────────────────────────────────────────────────────────────
        // SEMÁNTICOS planos — un solo nivel cada uno (mockup-exact)
        // Las variantes tinted se construyen en runtime con color-mix() o
        // con utilities `bg-warning/8` etc.
        // ──────────────────────────────────────────────────────────────────
        warning: "#C88A2E",
        danger: "#B44C3A",
        info: "#3A6D8C",

        // ──────────────────────────────────────────────────────────────────
        // SHADCN tokens — mapeados a CSS variables HSL (ver globals.css)
        // ──────────────────────────────────────────────────────────────────
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Aliases de texto (mockup --text-2/3/4)
        "text-2": "hsl(var(--text-2))",
        "text-3": "hsl(var(--text-3))",
        "text-4": "hsl(var(--text-4))",
        surface: "hsl(var(--surface))",
        "surface-alt": "hsl(var(--surface-alt))",
      },

      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },

      // Escala mockup-exact. Pesos default: Fraunces 400 · Geist 400.
      // (El brief original decía "weight 500 max" — los mockups usan 400 → mockups ganan.)
      fontSize: {
        // Display + headings (Fraunces)
        display: ["2.5rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "400" }], // 40px
        "display-sm": ["2rem", { lineHeight: "1.18", letterSpacing: "-0.02em", fontWeight: "400" }], // 32px (login h1)
        h1: ["2.5rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "400" }], // 40px
        h2: ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "400" }], // 28px
        h3: ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.015em", fontWeight: "400" }], // 20px
        h4: ["1.125rem", { lineHeight: "1.35", letterSpacing: "-0.01em", fontWeight: "400" }], // 18px

        // Body
        "body-lg": ["0.9375rem", { lineHeight: "1.6" }], // 15px (default body del mockup)
        body: ["0.875rem", { lineHeight: "1.55" }], // 14px (caption del mockup .h-search input)
        "body-sm": ["0.8125rem", { lineHeight: "1.5" }], // 13px
        caption: ["0.75rem", { lineHeight: "1.5" }], // 12px
        micro: ["0.6875rem", { lineHeight: "1.4" }], // 11px (mono labels uppercase)
        "micro-xs": ["0.625rem", { lineHeight: "1.3" }], // 10px

        // KPI value (Fraunces, tabular nums)
        kpi: ["2.375rem", { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "400" }], // 38px
        "kpi-sm": ["1.75rem", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "400" }], // 28px
      },

      letterSpacing: {
        // Tracks discretos del mockup
        tightest: "-0.025em",
        tighter: "-0.02em",
        tight: "-0.015em",
        normal: "0em",
        wide: "0.04em",
        wider: "0.06em",
        widest: "0.08em",
        ultra: "0.1em",
        "ultra-2": "0.12em", // login eyebrow
      },

      borderRadius: {
        // Escala discreta mockup: 4 / 6 / 7 / 8 / 10 / 12
        none: "0",
        sm: "4px", // badges, tags, micro pills
        DEFAULT: "6px", // pagination buttons
        md: "7px", // botones, sidebar links, inputs en toolbars, segmented
        lg: "8px", // inputs form-grade, primary button, alerts
        xl: "10px", // mid panels (toolbars internos, secondaries del login)
        "2xl": "12px", // cards y paneles macro
      },

      borderWidth: {
        // Mockup usa 1px consistente; las cards tienen border solid 1px.
        DEFAULT: "1px",
        hairline: "0.5px", // reservado, no usado en mockup pero útil para dividers extra-fine
      },

      spacing: {
        // Dimensiones de chassis (mockup-exact)
        sidebar: "248px",
        "sidebar-collapsed": "64px",
        header: "60px",
      },

      transitionDuration: {
        instant: "120ms", // hover de sidebar links, micro-interacciones
        fast: "150ms", // hover de botones, inputs
        slow: "250ms", // theme switch, sidebar collapse
      },

      transitionTimingFunction: {
        // Mockup usa ease lineal. Conservamos editorial cubic-bezier para
        // entradas de elementos (slide-up).
        editorial: "cubic-bezier(0.16, 1, 0.3, 1)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Variante de slide-up con más recorrido — usada para el stagger del
        // hero de la landing. 14px da más impacto editorial sin caer en spring.
        rise: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Pulse status indicator (footer "Sistemas operativos") — Layout.html:482-486
        "pulse-status": {
          "0%": { boxShadow: "0 0 0 0 color-mix(in oklab, #279F89 50%, transparent)" },
          "70%": { boxShadow: "0 0 0 6px color-mix(in oklab, #279F89 0%, transparent)" },
          "100%": { boxShadow: "0 0 0 0 color-mix(in oklab, #279F89 0%, transparent)" },
        },
        // Live dot pulse (clase en vivo) — Dashboard.html:557-562
        "pulse-live": {
          "0%": { boxShadow: "0 0 0 0 color-mix(in oklab, #279F89 50%, transparent)" },
          "70%": { boxShadow: "0 0 0 5px color-mix(in oklab, #279F89 0%, transparent)" },
          "100%": { boxShadow: "0 0 0 0 color-mix(in oklab, #279F89 0%, transparent)" },
        },
        // Skeleton shimmer — Widgets.html:929-934
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 200ms ease-out",
        "accordion-up": "accordion-up 200ms ease-out",
        "fade-in": "fade-in 300ms ease-out",
        "slide-up": "slide-up 300ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-status": "pulse-status 2s ease-out infinite",
        "pulse-live": "pulse-live 1.6s ease-out infinite",
        shimmer: "shimmer 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
