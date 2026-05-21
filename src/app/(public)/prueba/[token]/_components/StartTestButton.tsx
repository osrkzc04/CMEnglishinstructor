"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Inicia (o retoma) la sesión llamando a `POST /api/test-sessions/start`.
 * Si retorna 200 redirige a `/prueba/[token]/rendir`. Si hay un error de
 * caducidad o lock de dispositivo, muestra el mensaje al usuario.
 */
export function StartTestButton({ token }: { token: string }) {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function start() {
    setErrorMessage(null)
    startTransition(async () => {
      const res = await fetch("/api/test-sessions/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        router.replace(`/prueba/${token}/rendir` as Route)
        router.refresh()
        return
      }
      const code = res.status
      try {
        const body = (await res.json()) as { error?: string; reason?: string }
        setErrorMessage(translateError(code, body.error, body.reason))
      } catch {
        setErrorMessage("No pudimos iniciar la evaluación. Intenta de nuevo.")
      }
    })
  }

  return (
    <div>
      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={start}
        disabled={isPending}
        className="w-full justify-center"
      >
        {isPending ? (
          <>
            <Loader2 size={15} strokeWidth={1.6} className="animate-spin" />
            Iniciando…
          </>
        ) : (
          <>
            Iniciar evaluación
            <ArrowRight size={15} strokeWidth={1.6} />
          </>
        )}
      </Button>
      {errorMessage && <p className="text-danger mt-3 text-center text-[12.5px]">{errorMessage}</p>}
    </div>
  )
}

function translateError(status: number, code: string | undefined, reason?: string): string {
  if (code === "invite_expired") {
    return "Este enlace ya venció. Pídele a coordinación uno nuevo."
  }
  if (code === "invite_not_found") {
    return "No encontramos esta evaluación. Confirma el enlace con quien te lo envió."
  }
  if (code === "device_mismatch") {
    if (reason === "missing_cookie") {
      return "Esta evaluación se inició en otro dispositivo o navegador. Continúa donde la abriste por primera vez."
    }
    return "Esta evaluación ya está abierta en otro dispositivo."
  }
  if (code === "insufficient_bank") {
    return "La evaluación no está lista todavía. Avísanos para que terminemos de cargarla."
  }
  if (status >= 500) {
    return "Hubo un problema técnico de nuestro lado. Intenta de nuevo en un momento."
  }
  return "No pudimos iniciar la evaluación. Intenta de nuevo."
}
