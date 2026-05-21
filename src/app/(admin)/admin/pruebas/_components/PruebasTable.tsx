"use client"

import Link from "next/link"
import type { Route } from "next"
import { ArrowRight } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { InviteListItem } from "@/modules/tests/invites/queries"
import { CopyLinkButton } from "./CopyLinkButton"
import { InviteStateBadge } from "./InviteStateBadge"
import { ResendInviteButton } from "./ResendInviteButton"

type Props = {
  items: (InviteListItem & { link: string })[]
}

export function PruebasTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="border-border bg-surface rounded-xl border">
        <EmptyState
          title="Sin evaluaciones"
          description="No hay invitaciones que coincidan con los filtros. Crea una nueva desde el botón de arriba."
        />
      </div>
    )
  }

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <tr>
            <TableHead className="w-[280px]">Candidato</TableHead>
            <TableHead>Plantilla</TableHead>
            <TableHead className="w-[160px]">Estado</TableHead>
            <TableHead className="w-[160px]">Creada</TableHead>
            <TableHead className="w-[160px]">Vence</TableHead>
            <TableHead className="w-[150px] text-right">Acciones</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {items.map((row) => {
            const canResend = row.state === "PENDING"
            const disabledHint =
              row.state === "EXPIRED"
                ? "El enlace ya venció — crea una invitación nueva"
                : row.state === "IN_PROGRESS"
                  ? "El candidato ya inició la evaluación"
                  : row.state === "SUBMITTED" ||
                      row.state === "TIMED_OUT" ||
                      row.state === "REVIEWED"
                    ? "La evaluación ya fue entregada"
                    : undefined
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="text-foreground font-medium">{row.candidateName}</div>
                  <div className="text-text-3 mt-0.5 text-[12.5px]">{row.candidateEmail}</div>
                  {row.candidateDocument && (
                    <div className="text-text-3 mt-0.5 font-mono text-[11.5px] tracking-[0.02em]">
                      {row.candidateDocument}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-text-2 text-[13px]">{row.templateName}</TableCell>
                <TableCell>
                  <InviteStateBadge state={row.state} />
                  {row.state === "REVIEWED" &&
                    row.autoScore !== null &&
                    row.maxAutoScore !== null && (
                      <div className="text-text-3 mt-1 font-mono text-[11.5px] tracking-[0.02em]">
                        Auto: {row.autoScore}/{row.maxAutoScore}
                      </div>
                    )}
                </TableCell>
                <TableCell className="text-text-2 font-mono text-[12.5px] tracking-[0.02em]">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell className="text-text-2 font-mono text-[12.5px] tracking-[0.02em]">
                  {formatDate(row.expiresAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    {row.sessionId &&
                      (row.state === "SUBMITTED" ||
                        row.state === "TIMED_OUT" ||
                        row.state === "REVIEWED" ||
                        row.state === "IN_PROGRESS") && (
                        <Link
                          href={`/admin/pruebas/${row.sessionId}` as Route}
                          className="border-border bg-surface text-text-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors hover:border-teal-500 hover:text-teal-500"
                        >
                          {row.state === "REVIEWED" ? "Ver" : "Revisar"}
                          <ArrowRight size={12} strokeWidth={1.7} />
                        </Link>
                      )}
                    <CopyLinkButton link={row.link} />
                    <ResendInviteButton
                      inviteId={row.id}
                      disabled={!canResend}
                      disabledHint={disabledHint}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
})

function formatDate(d: Date): string {
  return dateFormatter.format(d).replace(/\./g, "")
}
