import { requireRole } from "@/modules/auth/guards"

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["STUDENT"])
  return <>{children}</>
}
