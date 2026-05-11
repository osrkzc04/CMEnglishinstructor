"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Modality } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateClassGroupMeetingDefaults } from "@/modules/classGroups/updateMeetingDefaults.action"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  classGroupId: string
  modality: Modality | string
  currentMeetingUrl: string | null
  currentLocation: string | null
}

export function EditMeetingDialog({
  open,
  onOpenChange,
  classGroupId,
  modality,
  currentMeetingUrl,
  currentLocation,
}: Props) {
  const router = useRouter()
  const [meetingUrl, setMeetingUrl] = useState(currentMeetingUrl ?? "")
  const [location, setLocation] = useState(currentLocation ?? "")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const showMeeting =
    modality === Modality.VIRTUAL || modality === Modality.HIBRIDO
  const showLocation =
    modality === Modality.PRESENCIAL || modality === Modality.HIBRIDO

  useEffect(() => {
    if (open) {
      setMeetingUrl(currentMeetingUrl ?? "")
      setLocation(currentLocation ?? "")
      setError(null)
      setInfo(null)
    }
  }, [open, currentMeetingUrl, currentLocation])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const result = await updateClassGroupMeetingDefaults({
        classGroupId,
        meetingUrl: showMeeting ? meetingUrl : undefined,
        location: showLocation ? location : undefined,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setInfo(
        result.sessionsUpdated > 0
          ? `Actualizado. Se aplicó a ${result.sessionsUpdated} ${result.sessionsUpdated === 1 ? "clase programada" : "clases programadas"}.`
          : "Actualizado.",
      )
      router.refresh()
      // Cierre suave después de un instante para que el usuario vea el mensaje.
      setTimeout(() => onOpenChange(false), 900)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Editar enlaces del aula</DialogTitle>
          <DialogDescription>
            Los datos cargados acá se guardan en el aula y se aplican a todas
            las clases programadas a futuro. Las clases ya cerradas mantienen
            su valor original.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="space-y-3">
              {showMeeting && (
                <div className="space-y-1.5">
                  <Label htmlFor="meeting-url">Link de la clase</Label>
                  <Input
                    id="meeting-url"
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    disabled={isPending}
                  />
                </div>
              )}
              {showLocation && (
                <div className="space-y-1.5">
                  <Label htmlFor="meeting-location">Ubicación</Label>
                  <Input
                    id="meeting-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Av. Amazonas 1234, oficina 502"
                    disabled={isPending}
                  />
                </div>
              )}
            </div>
            {error && (
              <Alert variant="danger" className="mt-3">
                {error}
              </Alert>
            )}
            {info && (
              <Alert variant="teal" className="mt-3">
                {info}
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
              Cerrar
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={isPending}>
              {isPending && (
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
