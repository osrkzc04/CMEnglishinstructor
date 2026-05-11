"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Check, Loader2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CopyButton } from "@/components/ui/copy-button"
import { UpdateClassGroupSchema, type UpdateClassGroupInput } from "@/modules/classGroups/schemas"
import { updateClassGroup } from "@/modules/classGroups/update.action"

type Props = {
  classGroupId: string
  initialValues: {
    name: string
    notes?: string
    defaultMeetingUrl?: string
    defaultLocation?: string
  }
  modality: "VIRTUAL" | "PRESENCIAL" | "HIBRIDO"
  disabled?: boolean
}

export function MetadataForm({ classGroupId, initialValues, modality, disabled }: Props) {
  const showMeeting = modality === "VIRTUAL" || modality === "HIBRIDO"
  const showLocation = modality === "PRESENCIAL" || modality === "HIBRIDO"
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setError,
    reset,
  } = useForm<UpdateClassGroupInput>({
    resolver: zodResolver(UpdateClassGroupSchema),
    defaultValues: initialValues,
  })

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await updateClassGroup(classGroupId, data)
      if (!result.success) {
        if (result.field) {
          setError(result.field, { type: "server", message: result.error })
        } else {
          setServerError(result.error)
        }
        return
      }
      reset(data)
      setSavedAt(new Date())
      router.refresh()
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos guardar"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <div>
        <Label htmlFor="cg-name" className="mb-1.5 block">
          Nombre
        </Label>
        <Input
          id="cg-name"
          aria-invalid={!!errors.name}
          disabled={disabled}
          {...register("name")}
        />
        {errors.name && <p className="text-danger mt-1 text-[12px]">{errors.name.message}</p>}
      </div>

      {showMeeting && (
        <div>
          <Label htmlFor="cg-meeting" className="mb-1.5 block">
            Link de reunión recurrente
          </Label>
          <div className="flex gap-2">
            <Input
              id="cg-meeting"
              type="url"
              aria-invalid={!!errors.defaultMeetingUrl}
              disabled={disabled}
              placeholder="https://meet.google.com/abc-defg-hij"
              className="flex-1"
              {...register("defaultMeetingUrl")}
            />
            {initialValues.defaultMeetingUrl && (
              <CopyButton value={initialValues.defaultMeetingUrl} label="Copiar link de la clase" />
            )}
          </div>
          <p className="text-text-3 mt-1 text-[12px]">
            Lo carga el docente desde su panel cuando esté listo; coordinación puede pisarlo desde
            acá. Se aplica a todas las sesiones futuras del aula.
          </p>
          {errors.defaultMeetingUrl && (
            <p className="text-danger mt-1 text-[12px]">{errors.defaultMeetingUrl.message}</p>
          )}
        </div>
      )}

      {showLocation && (
        <div>
          <Label htmlFor="cg-location" className="mb-1.5 block">
            Ubicación
          </Label>
          <Input
            id="cg-location"
            aria-invalid={!!errors.defaultLocation}
            disabled={disabled}
            placeholder="Av. Amazonas 1234, oficina 502"
            {...register("defaultLocation")}
          />
          {errors.defaultLocation && (
            <p className="text-danger mt-1 text-[12px]">{errors.defaultLocation.message}</p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="cg-notes" className="mb-1.5 block">
          Notas internas
        </Label>
        <Textarea
          id="cg-notes"
          rows={3}
          aria-invalid={!!errors.notes}
          disabled={disabled}
          placeholder="Para uso de coordinación. No las ven el docente ni el estudiante."
          {...register("notes")}
        />
        {errors.notes && <p className="text-danger mt-1 text-[12px]">{errors.notes.message}</p>}
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        {savedAt && !isDirty && (
          <span className="text-text-3 inline-flex items-center gap-1.5 text-[12.5px]">
            <Check size={13} strokeWidth={1.8} className="text-teal-500" />
            Guardado
          </span>
        )}
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isPending || !isDirty || disabled}
        >
          {isPending ? (
            <>
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Guardando…
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </div>
    </form>
  )
}
