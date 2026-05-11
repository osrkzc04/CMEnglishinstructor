"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Power, PowerOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tag } from "@/components/ui/tag"
import { setProgramLevelActive } from "@/modules/catalog/setProgramLevelActive.action"
import type {
  ProgramLevelAdminRow,
  ProgramOption,
} from "@/modules/catalog/queries"
import { NivelDialog } from "./NivelDialog"

type Props = {
  levels: ProgramLevelAdminRow[]
  programs: ProgramOption[]
}

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; level: ProgramLevelAdminRow }
  | null

export function NivelesWorkspace({ levels, programs }: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Agrupar por curso → programa.
  const grouped = groupLevels(levels)

  function toggleActive(row: ProgramLevelAdminRow) {
    setTogglingId(row.id)
    startTransition(async () => {
      await setProgramLevelActive(row.id, { isActive: !row.isActive })
      setTogglingId(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[12.5px] text-text-3">
          {levels.length} {levels.length === 1 ? "nivel" : "niveles"} en el
          catálogo
        </span>
        <Button
          variant="primary"
          size="md"
          onClick={() => setDialog({ kind: "create" })}
          disabled={programs.length === 0}
        >
          <Plus size={14} strokeWidth={1.6} />
          Nuevo nivel
        </Button>
      </div>

      {levels.length === 0 ? (
        <EmptyState
          title="Sin niveles cargados"
          description="Crea el primer nivel para empezar a configurar el catálogo."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((course) => (
            <section key={course.courseId}>
              <header className="mb-2 flex items-baseline gap-2">
                <h2 className="font-serif text-[18px] font-normal text-foreground">
                  {course.courseName}
                </h2>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-4">
                  {course.languageName}
                </span>
              </header>
              <div className="space-y-3">
                {course.programs.map((program) => (
                  <div
                    key={program.programId}
                    className="overflow-hidden rounded-xl border border-border bg-surface"
                  >
                    <header className="flex items-baseline justify-between gap-2 border-b border-border bg-surface-alt px-4 py-2">
                      <h3 className="text-[13.5px] font-medium text-foreground">
                        {program.programName}
                      </h3>
                      <span className="font-mono text-[11.5px] text-text-3">
                        {program.levels.length}{" "}
                        {program.levels.length === 1 ? "nivel" : "niveles"}
                      </span>
                    </header>
                    <Table>
                      <TableHeader>
                        <tr>
                          <TableHead className="w-[100px]">Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead className="w-[80px]">CEFR</TableHead>
                          <TableHead className="w-[100px] text-right">Horas</TableHead>
                          <TableHead className="w-[140px] text-center">Uso</TableHead>
                          <TableHead className="w-[120px]">Estado</TableHead>
                          <TableHead className="w-[120px] text-right">Acciones</TableHead>
                        </tr>
                      </TableHeader>
                      <TableBody>
                        {program.levels.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-[13px] text-text-2">
                              {row.code}
                            </TableCell>
                            <TableCell>
                              <span className="text-foreground">{row.name}</span>
                              <div className="mt-0.5 text-[11.5px] text-text-3">
                                Orden {row.order}
                                {!row.hasPlatformAccess && " · sin plataforma"}
                                {!row.hasPdfMaterial && " · sin PDF"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {row.cefrLevelCode ? (
                                <Tag>{row.cefrLevelCode}</Tag>
                              ) : (
                                <span className="text-text-3">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] text-foreground">
                              {row.totalHours}
                            </TableCell>
                            <TableCell className="text-center text-[12px] text-text-3">
                              {row.enrollmentsCount} m · {row.classGroupsCount} a
                            </TableCell>
                            <TableCell>
                              {row.isActive ? (
                                <span className="inline-flex items-center gap-1 text-[12.5px] text-teal-600">
                                  <Power size={11} strokeWidth={1.8} />
                                  Activo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[12.5px] text-text-3">
                                  <PowerOff size={11} strokeWidth={1.8} />
                                  Inactivo
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDialog({ kind: "edit", level: row })
                                  }
                                  className="inline-flex items-center justify-center rounded-md border border-border bg-surface p-1.5 text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500"
                                  aria-label={`Editar ${row.name}`}
                                >
                                  <Pencil size={12} strokeWidth={1.6} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleActive(row)}
                                  disabled={togglingId === row.id}
                                  className="inline-flex items-center justify-center rounded-md border border-border bg-surface p-1.5 text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label={
                                    row.isActive
                                      ? `Desactivar ${row.name}`
                                      : `Activar ${row.name}`
                                  }
                                >
                                  {row.isActive ? (
                                    <PowerOff size={12} strokeWidth={1.6} />
                                  ) : (
                                    <Power size={12} strokeWidth={1.6} />
                                  )}
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <NivelDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        programs={programs}
        editing={dialog?.kind === "edit" ? dialog.level : null}
        onSaved={() => {
          setDialog(null)
          router.refresh()
        }}
      />
    </>
  )
}

type GroupedCourse = {
  courseId: string
  courseName: string
  languageName: string
  programs: {
    programId: string
    programName: string
    levels: ProgramLevelAdminRow[]
  }[]
}

function groupLevels(levels: ProgramLevelAdminRow[]): GroupedCourse[] {
  const map = new Map<string, GroupedCourse>()
  for (const level of levels) {
    let course = map.get(level.courseId)
    if (!course) {
      course = {
        courseId: level.courseId,
        courseName: level.courseName,
        languageName: level.languageName,
        programs: [],
      }
      map.set(level.courseId, course)
    }
    let program = course.programs.find((p) => p.programId === level.programId)
    if (!program) {
      program = {
        programId: level.programId,
        programName: level.programName,
        levels: [],
      }
      course.programs.push(program)
    }
    program.levels.push(level)
  }
  return Array.from(map.values())
}
