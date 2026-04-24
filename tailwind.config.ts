import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./emails/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // -----------------------------------------------------------------------
      // Tokens de marca CM English Instructor
      // -----------------------------------------------------------------------
      colors: {
        // ===== Brand =====
        ink: {
          DEFAULT: "#233641",
          50: "#F4F6F7",
          100: "#EAECED",
          200: "#C4C9CC",
          300: "#B2B8BC",
          400: "#8F999E",
          500: "#707C84",
          600: "#55646C",
          700: "#3E4F58",
          800: "#2C3E49",
          900: "#233641",
          950: "#162229",
        },
        teal: {
          DEFAULT: "#279F89",
          50: "#E7F6F3",
          100: "#C7EBE3",
          200: "#9BDCD0",
          300: "#6BCDBA",
          400: "#3FB39B",
          500: "#279F89",
          600: "#228D79",
          700: "#267A6F",
          800: "#255B5A",
          900: "#1E4544",
          950: "#102827",
        },
        bone: {
          DEFAULT: "#FAF8F5",
          50: "#FDFCFB",
          100: "#FAF8F5",
          200: "#F5F1EB",
          300: "#EDE7DE",
          400: "#DFD7CA",
          500: "#CBC2B1",
        },

        // ===== Semantic (mapeo de marca) =====
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
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },

      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },

      fontSize: {
        // Escala tipográfica definida (no usar arbitrary values)
        "display-lg": ["clamp(2.5rem, 5vw, 4rem)", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "500" }],
        "display":    ["clamp(2rem, 4vw, 3rem)",   { lineHeight: "1.1",  letterSpacing: "-0.015em", fontWeight: "500" }],
        "h1":         ["1.875rem", { lineHeight: "1.2",  letterSpacing: "-0.01em", fontWeight: "500" }],
        "h2":         ["1.5rem",   { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "500" }],
        "h3":         ["1.25rem",  { lineHeight: "1.3",  fontWeight: "500" }],
        "h4":         ["1.125rem", { lineHeight: "1.4",  fontWeight: "500" }],
        "body-lg":    ["1.0625rem", { lineHeight: "1.6" }],
        "body":       ["1rem",     { lineHeight: "1.6" }],
        "body-sm":    ["0.875rem", { lineHeight: "1.5" }],
        "caption":    ["0.75rem",  { lineHeight: "1.4" }],
      },

      borderRadius: {
        // Feel editorial, no infantil — máximo 12px en componentes UI
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
      },

      spacing: {
        // Base 4px, escala consistente
        "18": "4.5rem",
        "22": "5.5rem",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 200ms ease-out",
        "accordion-up":   "accordion-up 200ms ease-out",
        "fade-in":        "fade-in 300ms ease-out",
        "slide-up":       "slide-up 300ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
