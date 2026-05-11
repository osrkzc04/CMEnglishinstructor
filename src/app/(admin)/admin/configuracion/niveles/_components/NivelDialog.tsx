"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox, CheckLabel } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ProgramLevelInputSchema, type ProgramLevelInput } from "@/modules/catalog/schemas"
import { createProgramLevel } from "@/modules/catalog/createProgramLevel.action"
import { updateProgramLevel } from "@/modules/catalog/updateProgramLevel.action"
import type { ProgramLevelAdminRow, ProgramOption } from "@/modules/catalog/queries"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  programs: ProgramOption[]
  editing: ProgramLevelAdminRow | null
  onSaved: () => void
}

export function NivelDialog({ open, onOpenChange, programs, editing, onSaved }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const defaults: ProgramLevelInput = editing
    ? {
        programId: editing.programId,
        code: editing.code,
        name: editing.name,
        order: editing.order,
        cefrLevelCode: editing.cefrLevelCode ?? undefined,
        totalHours: Number(editing.totalHours),
        hasPlatformAccess: editing.hasPlatformAccess,
        hasPdfMaterial: editing.hasPdfMaterial,
      }
    : {
        programId: programs[0]?.id ?? "",
        code: "",
        name: "",
        order: 0,
        cefrLevelCode: undefined,
        totalHours: 48,
        hasPlatformAccess: true,
        hasPdfMaterial: true,
      }

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
    watch,
    setValue,
  } = useForm<ProgramLevelInput>({
    resolver: zodResolver(ProgramLevelInputSchema),
    defaultValues: defaults,
  })

  // Resync defaults cuando cambia el target editado
  useEffect(() => {
    if (open) {
      reset(defaults)
      setServerError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id])

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = editing
        ? await updateProgramLevel(editing.id, data)
        : await createProgramLevel(data)
      if (!result.success) {
        if (result.field) {
          setError(result.field, { type: "server", message: result.error })
        } else {
          setServerError(result.error)
        }
        return
      }
      onSaved()
    })
  })

  const platformChecked = watch("hasPlatformAccess")
  const pdfChecked = watch("hasPdfMaterial")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar nivel" : "Nuevo nivel"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <DialogBody>
            <div className="space-y-4">
              <Field id="programId" label="Programa" error={errors.programId?.message}>
                <select
                  id="programId"
                  className={cn(
                    "border-border bg-surface text-foreground block w-full rounded-md border px-3 py-2.5 text-[13.5px]",
                    "hover:border-border-strong transition-colors duration-[150ms] focus:border-teal-500 focus:outline-none",
                  )}
                  disabled={isPending}
                  {...register("programId")}
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.courseName} — {p.name} ({p.languageName})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                <Field id="code" label="Código" error={errors.code?.message}>
                  <Input id="code" placeholder="2" disabled={isPending} {...register("code")} />
                </Field>
                <Field
                  id="name"
                  label="Nombre"
                  error={errors.name?.message}
                  hint="Ej. Time Zones 2 / Pre-Intermediate"
                >
                  <Input
                    id="name"
                    placeholder="Pre-Intermediate"
                    disabled={isPending}
                    {...register("name")}
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  id="order"
                  label="Orden"
                  error={errors.order?.message}
                  hint="Posición dentro del programa"
                >
                  <Input
                    id="order"
                    type="number"
                    min={0}
                    disabled={isPending}
                    {...register("order")}
                  />
                </Field>
                <Field
                  id="cefrLevelCode"
                  label="CEFR"
                  optional
                  error={errors.cefrLevelCode?.message}
                  hint="A1, B2…"
                >
                  <Input
                    id="cefrLevelCode"
                    placeholder="B1"
                    disabled={isPending}
                    {...register("cefrLevelCode")}
                  />
                </Field>
                <Field
                  id="totalHours"
                  label="Horas totales"
                  error={errors.totalHours?.message}
                  hint="Ej. 48 / 72"
                >
                  <Input
                    id="totalHours"
                    type="number"
                    step="0.5"
                    min={1}
                    disabled={isPending}
                    {...register("totalHours")}
                  />
                </Field>
              </div>

              <div className="space-y-1.5">
                <Label>Recursos del nivel</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CheckLabel
                    className={cn(
                      "items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                      platformChecked
                        ? "border-teal-500 bg-teal-500/[0.06]"
                        : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <Checkbox
                      checked={platformChecked}
                      onChange={(e) =>
                        setValue("hasPlatformAccess", e.target.checked, {
                          shouldDirty: true,
                        })
                      }
                    />
                    <span className="text-foreground text-[13.5px]">
                      Acceso a plataforma externa
                    </span>
                  </CheckLabel>
                  <CheckLabel
                    className={cn(
                      "items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                      pdfChecked
                        ? "border-teal-500 bg-teal-500/[0.06]"
                        : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <Checkbox
                      checked={pdfChecked}
                      onChange={(e) =>
                        setValue("hasPdfMaterial", e.target.checked, {
                          shouldDirty: true,
                        })
                      }
                    />
                    <span className="text-foreground text-[13.5px]">Material en PDF</span>
                  </CheckLabel>
                </div>
              </div>
            </div>

            {serverError && (
              <Alert variant="danger" className="mt-3">
                {serverError}
              </Alert>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={isPending}>
              {isPending && <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />}
              {editing ? "Guardar" : "Crear nivel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-text-4 text-[11px]">opcional</span>}
      </div>
      {children}
      {error && <p className="text-danger mt-1 text-[12px]">{error}</p>}
      {!error && hint && <p className="text-text-3 mt-1.5 text-[12px]">{hint}</p>}
    </div>
  )
}
