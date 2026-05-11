"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Check, Loader2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  TeacherLevelsSchema,
  type TeacherLevelsInput,
} from "@/modules/teachers/schemas"
import { updateTeacherLevels } from "@/modules/teachers/updateLevels.action"
import type { CefrLanguageGroup } from "@/modules/teachers/queries"
import { cn } from "@/lib/utils"

/**
 * Form inline para los niveles CEFR que el docente puede dictar. Multiselect
 * agrupado por idioma para que la lista sea legible cuando hay más de un
 * idioma activo (Inglés / Español).
 */

type Props = {
  teacherId: string
  initialLevelIds: string[]
  groups: CefrLanguageGroup[]
}

export function TeachableLevelsForm({
  teacherId,
  initialLevelIds,
  groups,
}: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset,
  } = useForm<TeacherLevelsInput>({
    resolver: zodResolver(TeacherLevelsSchema),
    defaultValues: { levelIds: initialLevelIds },
  })

  const selected = watch("levelIds") ?? []

  function toggle(levelId: string) {
    const next = selected.includes(levelId)
      ? selected.filter((id) => id !== levelId)
      : [...selected, levelId]
    setValue("levelIds", next, { shouldValidate: true, shouldDirty: true })
  }

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await updateTeacherLevels(teacherId, data)
      if (!result.success) {
        setServerError(result.error)
        return
      }
      reset(data)
      setSavedAt(new Date())
      router.refresh()
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos guardar los niveles"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <Controller
        control={control}
        name="levelIds"
        render={() => (
          <div className="space-y-5">
            {groups.length === 0 ? (
              <p className="text-[13px] text-text-3">
                No hay niveles configurados en el catálogo.
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.languageId}>
                  <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
                    {g.languageName}
                  </p>
                  {g.levels.length === 0 ? (
                    <p className="text-[13px] text-text-4">
                      Sin niveles definidos para este idioma.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {g.levels.map((opt) => {
                        const isSelected = selected.includes(opt.id)
                        return (
                          <label
                            key={opt.id}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px] transition-colors duration-[120ms]",
                              isSelected
                                ? "border-teal-500/60 bg-teal-500/[0.08] text-foreground"
                                : "border-border bg-surface text-text-2 hover:border-border-strong hover:text-foreground",
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onChange={() => toggle(opt.id)}
                            />
                            <span className="font-mono text-[12.5px] tracking-[0.04em]">
                              {opt.code}
                            </span>
                            <span className="text-text-3">·</span>
                            <span>{opt.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      />

      {errors.levelIds && (
        <p className="text-[12.5px] text-danger">{errors.levelIds.message}</p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        {savedAt && !isDirty && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-3">
            <Check size={13} strokeWidth={1.8} className="text-teal-500" />
            Cambios guardados
          </span>
        )}
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isPending || !isDirty}
        >
          {isPending ? (
            <>
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Guardando…
            </>
          ) : (
            "Guardar niveles"
          )}
        </Button>
      </div>
    </form>
  )
}
