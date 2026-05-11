/**
 * Layout público: pasthrough. Sin sidebar ni topbar — las páginas internas
 * (login, postulación, pruebas, design-system) definen su propia composición
 * y eligen su propio elemento semántico (main, section, etc.).
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
