import type { Route } from "next"
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  NotebookPen,
  School,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react"

/**
 * Configuración declarativa del menú por rol — alineada con design-mockups/
 * Layout.html:545-608. Items pueden mostrar un badge (count o tag teal)
 * y opcionalmente la sección puede mostrar un contador a la derecha.
 *
 * Los hrefs apuntan a rutas reales del producto. Si la página no existe aún,
 * Next renderiza el 404 — la decisión es no marcar visualmente "soon" porque
 * ningún mockup lo hace y rompe la voz editorial.
 *
 * NOTA: los contadores se removieron por ahora. Los tipos `NavBadge` y
 * `NavGroup.count` siguen vivos para no perder la infraestructura de
 * renderizado en `Sidebar.tsx`; cuando volvamos a cablear los counts
 * (postulaciones pendientes, estudiantes activos, etc.) los items van a
 * recibir su `badge` desde queries reales en `src/modules/`.
 */

export type NavBadge =
  | { kind: "count"; value: number; tone?: "default" | "teal" }
  | { kind: "tag"; value: string; tone?: "default" | "teal" | "warning" }

export type NavItem = {
  href: Route
  label: string
  icon: LucideIcon
  badge?: NavBadge
}

export type NavGroup = {
  label?: string
  count?: number
  items: NavItem[]
}

// =============================================================================
//  ADMIN — DIRECTOR + COORDINATOR
// =============================================================================

export const adminNav: NavGroup[] = [
  {
    label: "General",
    items: [
      {
        href: "/admin/dashboard" as Route,
        label: "Dashboard",
        icon: LayoutDashboard,
      },
      {
        href: "/admin/postulaciones" as Route,
        label: "Postulaciones",
        icon: FileText,
      },
    ],
  },
  {
    label: "Operación",
    items: [
      {
        href: "/admin/estudiantes" as Route,
        label: "Estudiantes",
        icon: UsersRound,
      },
      {
        href: "/admin/docentes" as Route,
        label: "Docentes",
        icon: GraduationCap,
      },
      {
        href: "/admin/aulas" as Route,
        label: "Aulas",
        icon: School,
      },
      {
        href: "/admin/clases" as Route,
        label: "Clases",
        icon: CalendarDays,
      },
      {
        href: "/admin/pruebas" as Route,
        label: "Pruebas",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Recursos",
    items: [
      {
        href: "/admin/materiales" as Route,
        label: "Materiales",
        icon: BookOpen,
      },
      {
        href: "/admin/reportes" as Route,
        label: "Reportes",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        href: "/admin/usuarios" as Route,
        label: "Usuarios",
        icon: ShieldCheck,
      },
      {
        href: "/admin/configuracion" as Route,
        label: "Configuración",
        icon: Settings,
      },
      {
        href: "/admin/ayuda" as Route,
        label: "Ayuda",
        icon: LifeBuoy,
      },
    ],
  },
]

// =============================================================================
//  TEACHER
// =============================================================================

export const teacherNav: NavGroup[] = [
  {
    label: "General",
    items: [
      {
        href: "/docente/dashboard" as Route,
        label: "Dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Mi día",
    items: [
      {
        href: "/docente/agenda" as Route,
        label: "Agenda",
        icon: CalendarDays,
      },
      {
        href: "/docente/aulas" as Route,
        label: "Mis aulas",
        icon: School,
      },
      {
        href: "/docente/clases" as Route,
        label: "Clases",
        icon: BookOpen,
      },
      {
        href: "/docente/bitacoras" as Route,
        label: "Bitácoras",
        icon: NotebookPen,
      },
      {
        href: "/docente/estudiantes" as Route,
        label: "Mis estudiantes",
        icon: Users,
      },
    ],
  },
  {
    label: "Mi cuenta",
    items: [
      {
        href: "/docente/disponibilidad" as Route,
        label: "Disponibilidad",
        icon: CalendarClock,
      },
      {
        href: "/docente/horas" as Route,
        label: "Mis horas",
        icon: Wallet,
      },
      {
        href: "/docente/materiales" as Route,
        label: "Materiales",
        icon: FolderOpen,
      },
      {
        href: "/docente/perfil" as Route,
        label: "Mi perfil",
        icon: UserCircle,
      },
    ],
  },
]

// =============================================================================
//  STUDENT
// =============================================================================

export const studentNav: NavGroup[] = [
  {
    label: "General",
    items: [
      {
        href: "/estudiante/dashboard" as Route,
        label: "Dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Académico",
    items: [
      {
        href: "/estudiante/clases" as Route,
        label: "Mis clases",
        icon: BookOpen,
      },
      {
        href: "/estudiante/progreso" as Route,
        label: "Mi progreso",
        icon: TrendingUp,
      },
      {
        href: "/estudiante/materiales" as Route,
        label: "Materiales",
        icon: FileText,
      },
    ],
  },
  {
    label: "Cuenta",
    items: [
      {
        href: "/estudiante/horario" as Route,
        label: "Mi horario",
        icon: CalendarClock,
      },
      {
        href: "/estudiante/perfil" as Route,
        label: "Mi perfil",
        icon: UserCircle,
      },
    ],
  },
]
