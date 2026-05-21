import { NextResponse } from "next/server"
import {
  DeviceMismatchError,
  InviteExpiredError,
  InviteNotFoundError,
  InvalidStateError,
  SectionIncompleteError,
  SectionLockedError,
  SessionNotFoundError,
  TimedOutError,
} from "@/modules/tests/sessions/errors"
import { InsufficientQuestionsError } from "@/modules/tests/sessions/sampling"

/**
 * Helpers compartidos por los route handlers del motor de exámenes.
 *
 * - `clientHints(req)`: extrae UA y IP del request. Prefiere `x-forwarded-for`
 *   si el deploy va detrás de proxy/CDN; cae a `x-real-ip` y a la conexión
 *   directa como último recurso.
 *
 * - `errorToResponse(err)`: traduce errores conocidos a HTTP. Los unknown
 *   los re-lanza para que el runtime los catchee y devuelva 500.
 */

export function clientHints(req: Request): { userAgent: string | null; ip: string | null } {
  const userAgent = req.headers.get("user-agent")
  const fwd = req.headers.get("x-forwarded-for")
  const realIp = req.headers.get("x-real-ip")
  let ip: string | null = null
  if (fwd) {
    ip = fwd.split(",")[0]?.trim() ?? null
  } else if (realIp) {
    ip = realIp.trim()
  }
  return { userAgent, ip }
}

export function errorToResponse(err: unknown): NextResponse {
  if (err instanceof InviteNotFoundError) {
    return NextResponse.json({ error: "invite_not_found" }, { status: 404 })
  }
  if (err instanceof InviteExpiredError) {
    return NextResponse.json({ error: "invite_expired" }, { status: 410 })
  }
  if (err instanceof SessionNotFoundError) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 })
  }
  if (err instanceof TimedOutError) {
    return NextResponse.json({ error: "timed_out" }, { status: 410 })
  }
  if (err instanceof DeviceMismatchError) {
    return NextResponse.json({ error: "device_mismatch", reason: err.reason }, { status: 423 })
  }
  if (err instanceof SectionLockedError) {
    return NextResponse.json({ error: "section_locked" }, { status: 403 })
  }
  if (err instanceof SectionIncompleteError) {
    return NextResponse.json({ error: "section_incomplete" }, { status: 409 })
  }
  if (err instanceof InvalidStateError) {
    return NextResponse.json({ error: "invalid_state", message: err.message }, { status: 409 })
  }
  if (err instanceof InsufficientQuestionsError) {
    return NextResponse.json(
      {
        error: "insufficient_bank",
        level: err.cefrLevelCode,
        required: err.required,
        available: err.available,
      },
      { status: 503 },
    )
  }
  // No conocido — log y 500.
  // eslint-disable-next-line no-console
  console.error("[test-sessions] unexpected error", err)
  return NextResponse.json({ error: "internal" }, { status: 500 })
}
