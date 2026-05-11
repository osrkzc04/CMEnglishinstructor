import type { Role } from "@prisma/client"

export function roleLabel(role: Role): string {
  switch (role) {
    case "DIRECTOR":
      return "Dirección"
    case "COORDINATOR":
      return "Coordinación"
    case "TEACHER":
      return "Docente"
    case "STUDENT":
      return "Estudiante"
  }
}
