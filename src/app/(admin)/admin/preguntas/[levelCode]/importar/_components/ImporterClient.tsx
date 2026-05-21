"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleSlash,
  Download,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { previewImport } from "@/modules/questions/preview-import.action"
import { commitImport } from "@/modules/questions/commit-import.action"
import type { PreviewRow, PreviewSummary } from "@/modules/questions/import"

/**
 * Cliente del importador CSV. Tres estados visuales:
 *
 *  - idle    → zona de drop + descargar template.
 *  - preview → tabla con cada fila marcada ok/dup/error + resumen.
 *  - done    → resumen final con conteos y CTA para volver al nivel.
 *
 * El CSV se mantiene en memoria del cliente entre preview y commit; en commit
 * lo reenviamos al servidor para que re-valide y persista (no confiamos en
 * payloads ya validados del cliente).
 */

type Props = {
  level: { id: string; code: string; name: string }
  cancelHref: Route
}

type Stage =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "preview"; summary: PreviewSummary; csvText: string; fileName: string }
  | {
      kind: "done"
      created: number
      skippedDuplicates: number
      skippedErrors: number
    }

const TEMPLATE_HREF = (level: string) =>
  `/api/questions/csv-template?level=${encodeURIComponent(level)}`

export function ImporterClient({ level, cancelHref }: Props) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>({ kind: "idle" })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("El archivo debe ser .csv")
        return
      }
      if (file.size > 200_000) {
        setError("El archivo supera los 200 KB. Dividilo en lotes más chicos.")
        return
      }
      setError(null)
      setStage({ kind: "loading" })
      startTransition(async () => {
        const csvText = await file.text()
        const result = await previewImport({ csvText, levelId: level.id })
        if (!result.success) {
          setError(result.error)
          setStage({ kind: "idle" })
          return
        }
        if (result.summary.parseError) {
          setError(result.summary.parseError)
          setStage({ kind: "idle" })
          return
        }
        setStage({
          kind: "preview",
          summary: result.summary,
          csvText,
          fileName: file.name,
        })
      })
    },
    [level.id],
  )

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function reset() {
    setError(null)
    setStage({ kind: "idle" })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function onCommit() {
    if (stage.kind !== "preview") return
    setError(null)
    startTransition(async () => {
      const result = await commitImport({ csvText: stage.csvText, levelId: level.id })
      if (!result.success) {
        setError(result.error)
        return
      }
      setStage({
        kind: "done",
        created: result.created,
        skippedDuplicates: result.skippedDuplicates,
        skippedErrors: result.skippedErrors,
      })
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos procesar el archivo"
          description={error}
          onDismiss={() => setError(null)}
        />
      )}

      {stage.kind === "idle" && (
        <IdleStage
          level={level}
          isDragging={isDragging}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          fileInputRef={fileInputRef}
          onPickFile={onPickFile}
        />
      )}

      {stage.kind === "loading" && (
        <div className="border-border bg-surface flex items-center gap-3 rounded-xl border p-6">
          <Loader2 size={18} strokeWidth={1.7} className="animate-spin text-teal-500" />
          <p className="text-text-2 text-[14px]">Procesando archivo…</p>
        </div>
      )}

      {stage.kind === "preview" && (
        <PreviewStage
          level={level}
          summary={stage.summary}
          fileName={stage.fileName}
          isPending={isPending}
          onCancel={reset}
          onCommit={onCommit}
        />
      )}

      {stage.kind === "done" && (
        <DoneStage
          level={level}
          created={stage.created}
          skippedDuplicates={stage.skippedDuplicates}
          skippedErrors={stage.skippedErrors}
          cancelHref={cancelHref}
          onAnother={reset}
        />
      )}
    </div>
  )
}

function IdleStage({
  level,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  fileInputRef,
  onPickFile,
}: {
  level: { code: string }
  isDragging: boolean
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <>
      <section
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          isDragging
            ? "border-teal-500 bg-teal-500/[0.04]"
            : "border-border bg-surface hover:border-border-strong",
        )}
      >
        <span
          aria-hidden
          className="bg-surface-alt text-text-3 mx-auto inline-grid h-12 w-12 place-items-center rounded-full"
        >
          <Upload size={20} strokeWidth={1.6} />
        </span>
        <h2 className="text-foreground mt-4 font-serif text-[20px] leading-[1.2] font-normal tracking-[-0.01em]">
          Arrastra tu archivo .csv aquí
        </h2>
        <p className="text-text-3 mx-auto mt-1.5 max-w-[440px] text-[13.5px] leading-[1.55]">
          O selecciona un archivo desde tu computadora. El sistema valida cada fila y muestra el
          resumen antes de cargar.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileText size={14} strokeWidth={1.7} />
            Elegir archivo
          </Button>
          <a
            href={TEMPLATE_HREF(level.code)}
            className="border-border bg-surface text-text-2 inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-[13px] font-medium transition-colors hover:border-teal-500 hover:text-teal-500"
          >
            <Download size={13} strokeWidth={1.7} />
            Descargar template
          </a>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onPickFile}
          />
        </div>
      </section>

      <section className="border-border bg-surface rounded-xl border p-5">
        <h3 className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
          Formato del CSV
        </h3>
        <p className="text-text-2 mt-2 text-[13px] leading-[1.6]">
          Una pregunta por fila. La cabecera y el orden de columnas vienen en el template. Reglas
          clave:
        </p>
        <ul className="text-text-2 mt-2 space-y-1 text-[13px] leading-[1.55]">
          <li>
            <code className="bg-surface-alt rounded-sm px-1.5 font-mono text-[11.5px]">level</code>{" "}
            debe ser{" "}
            <code className="bg-surface-alt rounded-sm px-1.5 font-mono text-[11.5px]">
              {level.code}
            </code>{" "}
            para que la fila se acepte.
          </li>
          <li>
            <code className="bg-surface-alt rounded-sm px-1.5 font-mono text-[11.5px]">type</code>{" "}
            es <code className="bg-surface-alt rounded-sm px-1.5 font-mono text-[11.5px]">MC</code>{" "}
            u <code className="bg-surface-alt rounded-sm px-1.5 font-mono text-[11.5px]">FILL</code>
            .
          </li>
          <li>
            Para MC: rellena{" "}
            <code className="bg-surface-alt rounded-sm px-1.5 font-mono text-[11.5px]">
              option_a
            </code>
            …
            <code className="bg-surface-alt rounded-sm px-1.5 font-mono text-[11.5px]">
              option_d
            </code>{" "}
            (mínimo 2) e indica la letra correcta en{" "}
            <code className="bg-surface-alt rounded-sm px-1.5 font-mono text-[11.5px]">
              correct
            </code>{" "}
            (admite varias separadas por coma).
          </li>
          <li>
            Para FILL: respuestas en{" "}
            <code className="bg-surface-alt rounded-sm px-1.5 font-mono text-[11.5px]">
              fill_answers
            </code>{" "}
            separadas por{" "}
            <code className="bg-surface-alt rounded-sm px-1.5 font-mono text-[11.5px]">;</code>.
          </li>
          <li>
            Solo se agregan preguntas nuevas. Los duplicados (mismo enunciado) se saltan
            silenciosamente.
          </li>
        </ul>
      </section>
    </>
  )
}

function PreviewStage({
  level,
  summary,
  fileName,
  isPending,
  onCancel,
  onCommit,
}: {
  level: { code: string }
  summary: PreviewSummary
  fileName: string
  isPending: boolean
  onCancel: () => void
  onCommit: () => void
}) {
  return (
    <>
      <section className="border-border bg-surface rounded-xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="bg-surface-alt text-text-3 grid h-9 w-9 place-items-center rounded-md">
              <FileText size={16} strokeWidth={1.6} />
            </span>
            <div>
              <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
                Archivo
              </p>
              <p className="text-foreground text-[14px] font-medium">{fileName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="text-text-3 hover:text-foreground inline-flex items-center gap-1 text-[12.5px] transition-colors disabled:opacity-50"
          >
            <X size={12} strokeWidth={1.7} />
            Cargar otro
          </button>
        </div>

        {summary.headerWarning && (
          <div className="border-warning/40 bg-warning/[0.06] text-warning mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-[12.5px] leading-[1.5]">
            <AlertTriangle size={13} strokeWidth={1.7} className="mt-0.5 flex-shrink-0" />
            <span>{summary.headerWarning}</span>
          </div>
        )}

        <div className="border-border mt-5 grid gap-3 border-t pt-5 sm:grid-cols-4">
          <Stat label="Total" value={summary.total} />
          <Stat label="Válidas" value={summary.ok} tone="ok" />
          <Stat label="Duplicadas" value={summary.duplicates} tone="warning" />
          <Stat
            label="Con error"
            value={summary.errors}
            tone={summary.errors > 0 ? "danger" : "default"}
          />
        </div>
      </section>

      <section className="border-border bg-surface overflow-hidden rounded-xl border">
        <header className="border-border flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-foreground font-serif text-[15px]">Vista previa</h3>
          <p className="text-text-3 font-mono text-[11px] tracking-[0.02em]">
            Solo las filas válidas se importarán a {level.code}
          </p>
        </header>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface-alt text-text-3 sticky top-0 font-mono text-[11px] tracking-[0.04em] uppercase">
              <tr>
                <th className="px-4 py-2 text-center">Fila</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Enunciado / detalle</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-text-3 px-4 py-6 text-center text-[13px]">
                    No hay filas de datos en el CSV.
                  </td>
                </tr>
              ) : (
                summary.rows.map((row) => <PreviewRowItem key={row.rowNumber} row={row} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <p className="text-text-3 text-[12.5px]">
          {summary.ok > 0
            ? `Se importarán ${summary.ok} preguntas nuevas a ${level.code}.`
            : "No hay filas válidas para importar."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onCommit}
            disabled={isPending || summary.ok === 0}
          >
            {isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                Importando…
              </>
            ) : (
              <>
                Importar {summary.ok} válidas
                <ArrowRight size={14} strokeWidth={1.6} />
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

function PreviewRowItem({ row }: { row: PreviewRow }) {
  return (
    <tr className="border-border border-t align-top">
      <td className="text-text-3 px-4 py-3 text-center font-mono text-[12px] tabular-nums">
        {row.rowNumber}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={row.status} />
      </td>
      <td className="text-text-2 px-4 py-3 font-mono text-[12px]">
        {row.type === "MULTIPLE_CHOICE" ? (
          "MC"
        ) : row.type === "FILL_IN" ? (
          "FILL"
        ) : (
          <span className="text-text-4">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.prompt ? (
          <p className="text-foreground line-clamp-2 text-[13px] leading-[1.5]">{row.prompt}</p>
        ) : (
          <span className="text-text-4 text-[12.5px] italic">Sin enunciado</span>
        )}
        {row.errors.length > 0 && (
          <ul className="text-danger mt-1 space-y-0.5 text-[12px] leading-[1.4]">
            {row.errors.map((e, i) => (
              <li key={i}>· {e}</li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  )
}

function StatusPill({ status }: { status: PreviewRow["status"] }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-teal-500/40 bg-teal-500/[0.08] px-2 py-0.5 font-mono text-[11px] text-teal-500">
        <Check size={10} strokeWidth={2.2} />
        Válida
      </span>
    )
  }
  if (status === "dup") {
    return (
      <span className="border-warning/40 bg-warning/[0.08] text-warning inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px]">
        <CircleSlash size={10} strokeWidth={2.2} />
        Duplicada
      </span>
    )
  }
  return (
    <span className="border-danger/40 bg-danger/[0.08] text-danger inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px]">
      <X size={10} strokeWidth={2.2} />
      Con error
    </span>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "default" | "ok" | "warning" | "danger"
}) {
  return (
    <div>
      <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-serif text-[22px] tabular-nums",
          tone === "ok"
            ? "text-teal-500"
            : tone === "warning"
              ? "text-warning"
              : tone === "danger"
                ? "text-danger"
                : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function DoneStage({
  level,
  created,
  skippedDuplicates,
  skippedErrors,
  cancelHref,
  onAnother,
}: {
  level: { code: string }
  created: number
  skippedDuplicates: number
  skippedErrors: number
  cancelHref: Route
  onAnother: () => void
}) {
  return (
    <section className="rounded-xl border border-teal-500/30 bg-teal-500/[0.03] p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-500/15 text-teal-500">
          <Check size={18} strokeWidth={2} />
        </span>
        <div className="flex-1">
          <h2 className="text-foreground font-serif text-[22px] leading-[1.2] font-normal tracking-[-0.01em]">
            {created > 0
              ? `Se cargaron ${created} preguntas al banco de ${level.code}`
              : "No se cargaron preguntas nuevas"}
          </h2>
          <p className="text-text-2 mt-2 text-[13.5px] leading-[1.55]">
            {skippedDuplicates > 0 && (
              <span>
                {skippedDuplicates} {skippedDuplicates === 1 ? "duplicada" : "duplicadas"} se
                saltaron.{" "}
              </span>
            )}
            {skippedErrors > 0 && (
              <span>
                {skippedErrors} {skippedErrors === 1 ? "fila con error" : "filas con error"} se
                descartaron.{" "}
              </span>
            )}
            {created === 0 && skippedDuplicates === 0 && skippedErrors === 0 && (
              <span>El archivo no traía filas para procesar.</span>
            )}
          </p>
        </div>
      </div>
      <div className="border-border mt-5 flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        <button
          type="button"
          onClick={onAnother}
          className="text-text-3 hover:text-foreground text-[13px] transition-colors"
        >
          Cargar otro archivo
        </button>
        <a
          href={cancelHref}
          className="bg-ink-900 dark:bg-bone text-bone dark:text-ink-900 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13.5px] font-medium transition-colors hover:bg-teal-500"
        >
          Volver al banco {level.code}
          <ArrowRight size={13} strokeWidth={1.6} />
        </a>
      </div>
    </section>
  )
}
