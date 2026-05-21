/**
 * Layout del flujo público de placement test (`/prueba/...`).
 *
 * Sin sidebar ni topbar — la prueba ocupa toda la ventana del candidato. Cada
 * sub-ruta define su propia composición.
 */
export default function PruebaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
