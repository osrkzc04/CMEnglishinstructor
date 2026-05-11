"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Check, Loader2 } from "lucide-react"
import { UserStatus } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  TeacherPersonalDataSchema,
  type TeacherPersonalDataInput,
} from "@/modules/teachers/schemas"
import { updateTeacherPersonal } from "@/modules/teachers/updatePersonal.action"
import { cn } from "@/lib/utils"

type Props = {
  teacherId: string
  initialValues: TeacherPersonalDataInput
}

export function PersonalDataForm({ teacherId, initialValues }: Props) {
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
  } = useForm<TeacherPersonalDataInput>({
    resolver: zodResolver(TeacherPersonalDataSchema),
    defaultValues: initialValues,
  })

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await updateTeacherPersonal(teacherId, data)
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
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos guardar los cambios"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="Nombre" error={errors.firstName?.message}>
          <Input
            id="firstName"
            autoComplete="given-name"
            aria-invalid={errors.firstName ? "true" : undefined}
            {...register("firstName")}
          />
        </Field>
        <Field id="lastName" label="Apellido" error={errors.lastName?.message}>
          <Input
            id="lastName"
            autoComplete="family-name"
            aria-invalid={errors.lastName ? "true" : undefined}
            {...register("lastName")}
          />
        </Field>
        <Field id="email" label="Correo" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? "true" : undefined}
            {...register("email")}
          />
        </Field>
        <Field id="phone" label="Teléfono" optional error={errors.phone?.message}>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+593 …"
            aria-invalid={errors.phone ? "true" : undefined}
            {...register("phone")}
          />
        </Field>
        <Field id="document" label="Documento" optional error={errors.document?.message}>
          <Input
            id="document"
            placeholder="Cédula o pasaporte"
            aria-invalid={errors.document ? "true" : undefined}
            {...register("document")}
          />
        </Field>
        <Field id="status" label="Estado" error={errors.status?.message}>
          <select
            id="status"
            className={cn(
              "border-border bg-surface text-foreground block w-full rounded-md border px-3 py-2 text-[13.5px]",
              "hover:border-border-strong transition-colors duration-[150ms] focus:border-teal-500 focus:outline-none",
            )}
            {...register("status")}
          >
            <option value={UserStatus.ACTIVE}>Activo</option>
            <option value={UserStatus.INACTIVE}>Inactivo</option>
          </select>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
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
            "Guardar cambios"
          )}
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && (
          <span className="text-text-4 font-sans text-[11px] tracking-normal normal-case">
            opcional
          </span>
        )}
      </div>
      {children}
      {error && <p className="text-danger mt-1 text-[12px]">{error}</p>}
    </div>
  )
}
