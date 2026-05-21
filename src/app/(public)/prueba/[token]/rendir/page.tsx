import type { Route } from "next"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getSessionStateById } from "@/modules/tests/sessions/queries"
import { checkDeviceAccess, DEVICE_COOKIE } from "@/modules/tests/sessions/device-lock"
import { finalizeAsTimedOut } from "@/modules/tests/sessions/finalize-as-timed-out"
import { PlacementTestPlayer } from "./_components/PlacementTestPlayer"
import { DeviceLockedShell } from "./_components/DeviceLockedShell"

export const metadata: Metadata = { title: "Evaluación en curso" }

type RouteParams = { token: string }

const GRACE_MS = 30_000

/**
 * `/prueba/[token]/rendir` — pantalla de rendición.
 *
 * Server fetch del estado actual (sección, preguntas visibles, deadline) y
 * pasa al cliente. El cliente se encarga del timer cosmético, auto-save,
 * navegación entre tarjetas y commit por sección.
 */
export default async function RendirPage({ params }: { params: Promise<RouteParams> }) {
  const { token } = await params
  const invite = await prisma.inviteToken.findUnique({
    where: { token },
    select: {
      candidateName: true,
      session: {
        select: {
          id: true,
          status: true,
          deadline: true,
          deviceCookieHash: true,
          deviceFingerprint: true,
        },
      },
    },
  })

  if (!invite || !invite.session) {
    redirect(`/prueba/${token}` as Route)
  }

  const session = invite.session
  if (
    session.status === "SUBMITTED" ||
    session.status === "TIMED_OUT" ||
    session.status === "REVIEWED" ||
    session.status === "ABANDONED"
  ) {
    redirect(`/prueba/${token}/finalizado` as Route)
  }

  // Server-side device check — no podemos leer UA/IP de Request acá, así que
  // solo validamos cookie. El UA/IP fingerprint los re-valida cada endpoint.
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(DEVICE_COOKIE.name)?.value ?? null
  const access = checkDeviceAccess({
    cookieHashOnSession: session.deviceCookieHash,
    fingerprintOnSession: null, // fingerprint solo se valida en route handlers (necesita headers).
    cookieValueFromRequest: cookieValue,
    userAgentFromRequest: null,
    ipFromRequest: null,
  })
  if (!access.ok) {
    return <DeviceLockedShell />
  }

  // Lazy expire si está vencida.
  if (Date.now() > session.deadline.getTime() + GRACE_MS) {
    await prisma.$transaction(async (tx) => {
      await finalizeAsTimedOut(tx, session.id)
    })
    redirect(`/prueba/${token}/finalizado` as Route)
  }

  const state = await getSessionStateById(session.id)
  if (!state) {
    redirect(`/prueba/${token}` as Route)
  }

  return <PlacementTestPlayer token={token} initialState={state} />
}
