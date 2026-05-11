"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Check, Loader2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  TeacherAvailabilitySchema,
  type TeacherAvailabilityInput,
  type AvailabilityBlock,
} from "@/modules/teachers/schemas"
import { updateTeacherAvailability } from "@/modules/teachers/updateAvailability.action"
import { AvailabilityGrid } from "@/app/(admin)/admin/docentes/_components/AvailabilityGrid"

/**
 * Form inline para la disponibilidad semanal del docente. La grilla es la
 * superficie de edición; el `Controller` mantiene los bloques compactados
 * en sincronía con el estado del form para que `isDirty` y la validación
 * funcionen correctamente.
 */

type Props = {
  teacherId: string
  initialBlocks: AvailabilityBlock[]
}

export function AvailabilityForm({ teacherId, initialBlocks }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<TeacherAvailabilityInput>({
    resolver: zodResolver(TeacherAvailabilitySchema),
    defaultValues: { blocks: initialBlocks },
  })

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await updateTeacherAvailability(teacherId, data)
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
          title="No pudimos guardar la disponibilidad"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <Controller
        control={control}
        name="blocks"
        render={({ field }) => (
          <AvailabilityGrid
            blocks={field.value}
            onChange={(blocks) => field.onChange(blocks)}
            disabled={isPending}
          />
        )}
      />

      {errors.blocks && typeof errors.blocks.message === "string" && (
        <p className="text-danger text-[12.5px]">{errors.blocks.message}</p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        {savedAt && !isDirty && (
          <span className="text-text-3 inline-flex items-center gap-1.5 text-[12.5px]">
            <Check size={13} strokeWidth={1.8} className="text-teal-500" />
            Cambios guardados
          </span>
        )}
        <Button type="submit" variant="primary" size="md" disabled={isPending || !isDirty}>
          {isPending ? (
            <>
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Guardando…
            </>
          ) : (
            "Guardar disponibilidad"
          )}
        </Button>
      </div>
    </form>
  )
}
