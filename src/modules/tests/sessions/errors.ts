/**
 * Errores específicos del motor de exámenes. Los route handlers los mapean a
 * status HTTP concretos para que el cliente reaccione apropiadamente.
 */

export class InviteNotFoundError extends Error {
  constructor() {
    super("Invitación no encontrada")
    this.name = "InviteNotFoundError"
  }
}

export class InviteExpiredError extends Error {
  constructor() {
    super("El enlace ya venció")
    this.name = "InviteExpiredError"
  }
}

export class SessionNotFoundError extends Error {
  constructor() {
    super("Sesión no encontrada")
    this.name = "SessionNotFoundError"
  }
}

export class TimedOutError extends Error {
  constructor() {
    super("El tiempo de la evaluación se agotó")
    this.name = "TimedOutError"
  }
}

export class InvalidStateError extends Error {
  constructor(message = "La sesión no admite esta operación") {
    super(message)
    this.name = "InvalidStateError"
  }
}

export class SectionIncompleteError extends Error {
  constructor() {
    super("Faltan preguntas por responder en este bloque")
    this.name = "SectionIncompleteError"
  }
}

export class SectionLockedError extends Error {
  constructor() {
    super("No se pueden editar respuestas de bloques anteriores")
    this.name = "SectionLockedError"
  }
}

export class DeviceMismatchError extends Error {
  constructor(
    public readonly reason: "missing_cookie" | "cookie_mismatch" | "fingerprint_mismatch",
  ) {
    super("Esta evaluación ya fue iniciada en otro dispositivo")
    this.name = "DeviceMismatchError"
  }
}
