import { ImageResponse } from "next/og"

/**
 * Apple touch icon (iOS home screen / pinned tab).
 *
 * iOS aplica esquinas redondeadas y sombras automáticamente, así que el PNG
 * va con fondo sólido bone (#FAF8F5) y el monograma teal centrado. Tamaño
 * estándar de Apple: 180×180.
 *
 * El path SVG es el mismo de `BrandMark.tsx` y `public/brand/ico_color.svg`
 * — fuente de verdad de la silueta. Si el logo cambia, sincronizar acá.
 */
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

const LOGO_PATH =
  "M92.27,35.12c-.1-.34-.2-.69-.31-1.03C85.71,14.3,67.89,1,47.61,1,21.91,1,1,22.48,1,48.89s20.91,47.89,46.61,47.89c10.65,0,20.97-3.63,29.05-10.22l.7-.57v-38.06l15.27-11.55-.37-1.26ZM73.58,84.17c-7.31,5.69-16.49,8.81-25.97,8.81-3.59,0-7.07-.46-10.4-1.32v-30.39l10.63,8.98,25.74-19.47v33.38ZM73.58,46.03l-25.61,19.37-14.54-12.28v37.37c-4.05-1.47-7.82-3.54-11.2-6.11v-51.35l25.68,18.65,25.68-18.65v13ZM77.36,43.18v-17.58l-29.46,21.4-29.46-21.4v55.55c-8.4-8.05-13.67-19.54-13.67-32.26C4.78,24.58,24,4.8,47.61,4.8c18.51,0,34.81,12.1,40.64,30.14l-10.89,8.24Z"

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#FAF8F5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="120" height="125" viewBox="0 0 93.79 97.78" xmlns="http://www.w3.org/2000/svg">
        <path
          d={LOGO_PATH}
          fill="#279F89"
          stroke="#279F89"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { ...size },
  )
}
