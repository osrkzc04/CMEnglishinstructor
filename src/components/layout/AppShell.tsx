import type { Role } from "@prisma/client"
import { Sidebar } from "@/components/layout/Sidebar"
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { AppFooter } from "@/components/layout/AppFooter"
import { Topbar, type Breadcrumb, type TopbarCTA } from "@/components/layout/Topbar"

type AppShellProps = {
  children: React.ReactNode
  role: Role
  user: {
    name: string
    email: string
    roleLabel: string
  }
  breadcrumbs: Breadcrumb[]
  cta?: TopbarCTA
}

/**
 * Chrome compartido — design-mockups/Layout.html:534-732 + Dashboard.html.
 *
 * Estructura grid:
 *   "sidebar header"
 *   "sidebar main"
 *   "sidebar footer"
 *
 * El sidebar es sticky a 100vh; el footer vive al final del scroll del main.
 */
export function AppShell({ children, role, user, breadcrumbs, cta }: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar role={role} user={{ name: user.name, roleLabel: user.roleLabel }} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar breadcrumbs={breadcrumbs} cta={cta} />
          <main className="bg-background flex-1 px-10 pt-8 pb-12">{children}</main>
          <AppFooter />
        </div>
      </div>
    </SidebarProvider>
  )
}
