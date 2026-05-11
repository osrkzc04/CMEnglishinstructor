import type { Route } from "next"
import type { Role } from "@prisma/client"

/**
 * Punto de entrada por rol tras el login. Mantener en un solo lugar para que
 * sidebar, redirect post-login y guards coincidan.
 *
 * El cast a `Route` es seguro: las rutas listadas existen en `src/app/`.
 * `typedRoutes` no puede inferir rutas construidas en runtime, así que este
 * helper es el único punto autorizado para mapear rol → destino.
 */
export function dashboardPathFor(role: Role): Route {
  switch (role) {
    case "DIRECTOR":
    case "COORDINATOR":
      return "/admin/dashboard" as Route
    case "TEACHER":
      return "/docente/dashboard" as Route
    case "STUDENT":
      return "/estudiante/dashboard" as Route
  }
}
