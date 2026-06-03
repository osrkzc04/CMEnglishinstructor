import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getDefaultLanguageId, getLevelOverview, listLanguages } from "@/modules/questions/queries"
import { LanguageSwitcher } from "./_components/LanguageSwitcher"
import { LevelGrid } from "./_components/LevelGrid"

/**
 * `/admin/preguntas` — landing del banco de preguntas.
 *
 * Diseño:
 *  - Una tarjeta por nivel CEFR (A1→C2) con su salud y botón "Administrar"
 *    que entra a `/admin/preguntas/[code]`.
 *  - Sin listado plano: todo se administra por nivel para evitar que se cree
 *    una pregunta en el nivel equivocado.
 *
 * Solo DIRECTOR / COORDINATOR. Etapas siguientes: alta/edición individual
 * (etapa 2) e import masivo CSV (etapa 3) — ambos dentro de la página del
 * nivel.
 */

export const metadata: Metadata = { title: "Banco de evaluación" }

type SearchParams = { languageId?: string }

export default async function PreguntasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const sp = await searchParams

  const languages = await listLanguages()
  const defaultLanguageId = await getDefaultLanguageId()
  const requestedLanguageId =
    sp.languageId && languages.some((l) => l.id === sp.languageId) ? sp.languageId : null
  const languageId = requestedLanguageId ?? defaultLanguageId

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[
        { label: "Admin", href: "/admin/dashboard" as Route },
        { label: "Banco de evaluación" },
      ]}
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <header>
          <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
            Operación
          </p>
          <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
            Banco de evaluación
          </h1>
          <p className="text-text-3 mt-2 max-w-2xl text-[14px] leading-[1.55]">
            Administra las preguntas y la instrucción de redacción de cada nivel CEFR. Cada bloque del
            placement test sortea 20 preguntas, así que mantenemos al menos 50 activas por nivel.
          </p>
        </header>
        {languageId && <LanguageSwitcher languages={languages} current={languageId} />}
      </div>

      {!languageId ? (
        <div className="border-warning/40 bg-warning/[0.06] rounded-xl border px-5 py-4">
          <p className="text-foreground text-[14px] font-medium">No hay idiomas configurados</p>
          <p className="text-text-3 mt-1 text-[13px] leading-[1.55]">
            Configura al menos un idioma desde el catálogo para empezar a cargar preguntas.
          </p>
        </div>
      ) : (
        <LandingContent languageId={languageId} />
      )}
    </AppShell>
  )
}

async function LandingContent({ languageId }: { languageId: string }) {
  const levels = await getLevelOverview(languageId)
  return <LevelGrid levels={levels} languageId={languageId} />
}
