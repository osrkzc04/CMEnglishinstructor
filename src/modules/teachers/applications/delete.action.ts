"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"

type Result = { success: true } | { success: false; error: string }

/**
 * Hard-delete de una postulación. Elimina las filas relacionadas vía
 * cascade (`TeacherApplicationLevel`, `ApplicationAvailability`).
 *
 * Las postulaciones no son entidades con historia — el alta de un docente
 * crea registros separados (`User`, `TeacherProfile`) y las APPROVED ya
 * apuntan al user vía `userId`. Borrar la postulación NO toca al docente
 * creado.
 *
 * Las filas en `EmailNotification` que se hayan generado (acuse de recibo)
 * permanecen como audit trail del envío.
 */
export async function deleteApplication(applicationId: string): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  try {
    await prisma.teacherApplication.delete({ where: { id: applicationId } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { success: false, error: "La postulación ya no existe" }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo eliminar",
    }
  }

  revalidatePath("/admin/postulaciones")
  return { success: true }
}
