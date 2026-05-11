import { requireRole } from "@/modules/auth/guards"

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["TEACHER"])
  return <>{children}</>
}
