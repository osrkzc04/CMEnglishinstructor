"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Loader2 } from "lucide-react"
import { UserStatus } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Radio, CheckLabel } from "@/components/ui/checkbox"
import { NewStaffSchema, type NewStaffInput, type StaffRole } from "@/modules/users/schemas"
import { createStaffUser } from "@/modules/users/create.action"
import { cn } from "@/lib/utils"

/**
 * Form de alta de usuario staff. Captura datos personales + rol + estado.
 * Si el alta queda en `ACTIVE`, dispara el email de activación al guardar.
 *
 * Solo lo expone `/admin/usuarios/nuevo`, accesible solo para DIRECTOR.
 */

const ROLE_OPTIONS: { value: StaffRole; label: string; hint: string }[] = [
  {
    value: "DIRECTOR",
    label: "Dirección",
    hint: "Acceso total al sistema. Gestiona usuarios y configuración.",
  },
  {
    value: "COORDINATOR",
    label: "Coordinación",
    hint: "Operación día a día: estudiantes, docentes, aulas y clases.",
  },
]

const STATUS_OPTIONS: { value: UserStatus; label: string; hint: string }[] = [
  {
    value: UserStatus.ACTIVE,
    label: "Activo",
    hint: "Recibe el correo de activación apenas se guarde",
  },
  {
    value: UserStatus.PENDING_APPROVAL,
    label: "Pendiente",
    hint: "Para casos en los que aún falta confirmar algún dato",
  },
  {
    value: UserStatus.INACTIVE,
    label: "Inactivo",
    hint: "No puede iniciar sesión. Útil para preparar el alta",
  },
]

export function NewStaffForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
    watch,
  } = useForm<NewStaffInput>({
    resolver: zodResolver(NewStaffSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: undefined,
      document: undefined,
      role: "COORDINATOR",
      status: UserStatus.ACTIVE,
    },
  })

  const watchedRole = watch("role")
  const watchedStatus = watch("status")

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await createStaffUser(data)
      if (!result.success) {
        if (result.field) {
          setError(result.field, { type: "server", message: result.error })
        } else {
          setServerError(result.error)
        }
        return
      }
      router.push(`/admin/usuarios/${result.id}` as Route)
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos crear al usuario"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <Section title="Datos personales">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="firstName" label="Nombres" error={errors.firstName?.message}>
            <Input id="firstName" autoComplete="given-name" {...register("firstName")} />
          </Field>
          <Field id="lastName" label="Apellidos" error={errors.lastName?.message}>
            <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
          </Field>
          <Field id="email" label="Correo" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field id="phone" label="Teléfono" optional error={errors.phone?.message}>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+593…"
              {...register("phone")}
            />
          </Field>
          <Field
            id="document"
            label="Cédula o pasaporte"
            optional
            error={errors.document?.message}
            className="sm:col-span-2"
          >
            <Input id="document" {...register("document")} />
          </Field>
        </div>
      </Section>

      <Section title="Rol" hint="Define qué puede hacer este usuario dentro del panel.">
        <RolePicker
          value={watchedRole}
          onChange={(r) => setValue("role", r, { shouldValidate: true, shouldDirty: true })}
          error={errors.role?.message}
        />
      </Section>

      <Section
        title="Estado de la cuenta"
        hint="Si lo creas activo, el usuario recibe de inmediato el correo para definir su contraseña."
      >
        <StatusPicker
          value={watchedStatus}
          onChange={(s) => setValue("status", s, { shouldValidate: true, shouldDirty: true })}
        />
      </Section>

      <div className="border-border flex items-center justify-end gap-3 border-t pt-5">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Creando…
            </>
          ) : (
            "Crear usuario"
          )}
        </Button>
      </div>
    </form>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-border bg-surface rounded-xl border p-5 sm:p-6">
      <h2 className="text-foreground font-serif text-[18px] font-normal tracking-[-0.01em]">
        {title}
      </h2>
      {hint ? (
        <p className="text-text-3 mt-1 mb-4 text-[13px] leading-[1.5]">{hint}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </section>
  )
}

function Field({
  id,
  label,
  optional,
  error,
  className,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-text-4 text-[11px]">opcional</span>}
      </div>
      {children}
      {error && <p className="text-danger mt-1 text-[12px]">{error}</p>}
    </div>
  )
}

function RolePicker({
  value,
  onChange,
  error,
}: {
  value: StaffRole
  onChange: (r: StaffRole) => void
  error?: string
}) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {ROLE_OPTIONS.map((opt) => (
          <CheckLabel
            key={opt.value}
            className={cn(
              "items-start gap-3 rounded-md border px-4 py-3 transition-colors",
              value === opt.value
                ? "border-teal-500 bg-teal-500/[0.06]"
                : "border-border bg-surface hover:border-border-strong",
            )}
          >
            <Radio
              name="role"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>
              <span className="text-foreground block text-[14px] font-medium">{opt.label}</span>
              <span className="text-text-3 mt-0.5 block text-[12px]">{opt.hint}</span>
            </span>
          </CheckLabel>
        ))}
      </div>
      {error && <p className="text-danger mt-2 text-[12.5px]">{error}</p>}
    </>
  )
}

function StatusPicker({
  value,
  onChange,
}: {
  value: UserStatus
  onChange: (s: UserStatus) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {STATUS_OPTIONS.map((opt) => (
        <CheckLabel
          key={opt.value}
          className={cn(
            "items-start gap-3 rounded-md border px-4 py-3 transition-colors",
            value === opt.value
              ? "border-teal-500 bg-teal-500/[0.06]"
              : "border-border bg-surface hover:border-border-strong",
          )}
        >
          <Radio
            name="status"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>
            <span className="text-foreground block text-[14px] font-medium">{opt.label}</span>
            <span className="text-text-3 mt-0.5 block text-[12px]">{opt.hint}</span>
          </span>
        </CheckLabel>
      ))}
    </div>
  )
}
