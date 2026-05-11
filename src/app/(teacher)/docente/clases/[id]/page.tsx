import { notFound } from "next/navigation"
import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getClassSessionDetail } from "@/modules/classes/queries"
import { SessionWorkspace } from "./_components/SessionWorkspace"

export const metadata: Metadata = { title: "Clase" }

type RouteParams = { id: string }

export default async function TeacherClassSessionPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const user = await requireRole(["TEACHER", "DIRECTOR", "COORDINATOR"])
  const { id } = await params

  const detail = await getClassSessionDetail(id)
  if (!detail) notFound()

  // El docente solo ve clases propias. Admin ve todo.
  const isAdmin = user.role === "DIRECTOR" || user.role === "COORDINATOR"
  if (!isAdmin && detail.teacherId !== user.id) notFound()

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[
        { label: "Docente", href: "/docente/dashboard" as Route },
        { label: "Mis clases", href: "/docente/clases" as Route },
        { label: detail.classGroupName },
      ]}
    >
      <SessionWorkspace detail={detail} />
    </AppShell>
  )
}
