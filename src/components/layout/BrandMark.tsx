import { cn } from "@/lib/utils"

/**
 * Logomark de la marca — inline SVG. Hereda color via `currentColor` para
 * adaptarse al chrome donde aparece (sidebar dark → bone, login form → text).
 *
 * El path proviene de public/brand/ico_white.svg, viewBox 93.79×97.78. El
 * `strokeWidth` se aplica sobre el mismo path lleno para engrosar la
 * silueta sin tocar la geometría — útil porque el ico original es muy fino
 * a tamaños chicos (24-36px). Default 2 unidades del viewBox (~2 px en un
 * logo de 90 px); subí a 2.5–3 para sidebars muy chicos.
 */
export function BrandMark({
  className,
  size = 22,
  strokeWidth = 2,
}: {
  className?: string
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 93.79 97.78"
      width={size}
      height={size}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={cn("shrink-0", className)}
    >
      <path d="M92.27,35.12c-.1-.34-.2-.69-.31-1.03C85.71,14.3,67.89,1,47.61,1,21.91,1,1,22.48,1,48.89s20.91,47.89,46.61,47.89c10.65,0,20.97-3.63,29.05-10.22l.7-.57v-38.06l15.27-11.55-.37-1.26ZM73.58,84.17c-7.31,5.69-16.49,8.81-25.97,8.81-3.59,0-7.07-.46-10.4-1.32v-30.39l10.63,8.98,25.74-19.47v33.38ZM73.58,46.03l-25.61,19.37-14.54-12.28v37.37c-4.05-1.47-7.82-3.54-11.2-6.11v-51.35l25.68,18.65,25.68-18.65v13ZM77.36,43.18v-17.58l-29.46,21.4-29.46-21.4v55.55c-8.4-8.05-13.67-19.54-13.67-32.26C4.78,24.58,24,4.8,47.61,4.8c18.51,0,34.81,12.1,40.64,30.14l-10.89,8.24Z" />
    </svg>
  )
}

/**
 * Wordmark "CM·English Instructor" en Fraunces italic con separador.
 * Usado al lado del BrandMark en el sidebar y en el aside del login.
 */
export function BrandWordmark({
  className,
  size = "sm",
}: {
  className?: string
  size?: "sm" | "md"
}) {
  return (
    <span
      className={cn(
        "font-serif italic tracking-[-0.005em]",
        size === "sm" ? "text-[15px]" : "text-base",
        className,
      )}
    >
      CM<span className="px-1 opacity-40">·</span>English Instructor
    </span>
  )
}
