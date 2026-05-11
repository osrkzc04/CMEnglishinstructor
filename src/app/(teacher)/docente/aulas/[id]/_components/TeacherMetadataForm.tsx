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
import { CopyButton } from "@/components/ui/copy-button"
import {
  TeacherUpdateClassGroupSchema,
  type TeacherUpdateClassGroupInput,
} from "@/modules/classGroups/schemas"
import { teacherUpdateClassGroup } from "@/modules/classGroups/teacherUpdate.action"

type Props = {
  classGroupId: string
  initialValues: {
    name: string
    defaultMeetingUrl?: string
  }
  modality: "VIRTUAL" | "PRESENCIAL" | "HIBRIDO"
  disabled?: boolean
}

export function TeacherMetadataForm({
  classGroupId,
  initialValues,
  modality,
  disabled,
}: Props) {
  const showMeeting = modality === "VIRTUAL" || modality === "HIBRIDO"
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
  } = useForm<TeacherUpdateClassGroupInput>({
    resolver: zodResolver(TeacherUpdateClassGroupSchema),
    defaultValues: initialValues,
  })

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await teacherUpdateClassGroup(classGroupId, data)
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
          Nombre del aula
        </Label>
        <Input
          id="cg-name"
          aria-invalid={!!errors.name}
          disabled={disabled}
          {...register("name")}
        />
        {errors.name && (
          <p className="mt-1 text-[12px] text-danger">{errors.name.message}</p>
        )}
      </div>

      {showMeeting && (
        <div>
          <Label htmlFor="cg-meeting" className="mb-1.5 block">
            Link de la reunión virtual
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
              <CopyButton
                value={initialValues.defaultMeetingUrl}
                label="Copiar link"
              />
            )}
          </div>
          <p className="mt-1 text-[12px] text-text-3">
            Este enlace se usa para todas las sesiones futuras del aula y se
            muestra a los estudiantes en su dashboard.
          </p>
          {errors.defaultMeetingUrl && (
            <p className="mt-1 text-[12px] text-danger">
              {errors.defaultMeetingUrl.message}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        {savedAt && !isDirty && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-3">
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
