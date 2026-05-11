import { requireRole } from "@/modules/auth/guards"

/**
 * Layout server-side de las rutas administrativas. Solo enforced auth — el
 * shell visual (AppShell con sidebar/topbar) lo arma cada page para poder
 * controlar sus propios breadcrumbs y CTA.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["DIRECTOR", "COORDINATOR"])
  return <>{children}</>
}
