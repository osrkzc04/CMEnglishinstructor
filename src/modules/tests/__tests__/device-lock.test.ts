import { describe, it, expect } from "vitest"

import {
  checkDeviceAccess,
  fingerprint,
  generateDeviceSecret,
  hashDeviceSecret,
} from "../sessions/device-lock"

/**
 * Tests del device lock. La idea es proteger la sesión contra:
 *  - Otro dispositivo (cookie ausente o distinta).
 *  - Otro navegador o red distinta (fingerprint UA+subnet cambia).
 *
 * Pero ser tolerante a cambios de IP dentro de la misma /24 (NAT, WiFi).
 */

describe("generateDeviceSecret", () => {
  it("devuelve 64 caracteres hex (32 bytes)", () => {
    const s = generateDeviceSecret()
    expect(s).toMatch(/^[0-9a-f]{64}$/)
  })

  it("genera valores distintos en llamadas consecutivas", () => {
    const a = generateDeviceSecret()
    const b = generateDeviceSecret()
    expect(a).not.toBe(b)
  })
})

describe("hashDeviceSecret", () => {
  it("es determinístico", () => {
    const s = "deadbeef".repeat(8)
    expect(hashDeviceSecret(s)).toBe(hashDeviceSecret(s))
  })

  it("cambia el hash si cambia un solo carácter", () => {
    const a = "0".repeat(64)
    const b = "0".repeat(63) + "1"
    expect(hashDeviceSecret(a)).not.toBe(hashDeviceSecret(b))
  })
})

describe("fingerprint", () => {
  it("es estable para el mismo UA y la misma subred /24", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0"
    const fp1 = fingerprint(ua, "190.123.45.10")
    const fp2 = fingerprint(ua, "190.123.45.250") // misma /24, distinto host
    expect(fp1).toBe(fp2)
  })

  it("cambia si cambia la subred /24", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0"
    const a = fingerprint(ua, "190.123.45.10")
    const b = fingerprint(ua, "190.123.46.10") // distinta /24
    expect(a).not.toBe(b)
  })

  it("cambia si cambia el user agent", () => {
    const ip = "190.123.45.10"
    const a = fingerprint("Mozilla/5.0 Chrome/120.0", ip)
    const b = fingerprint("Mozilla/5.0 Firefox/120.0", ip)
    expect(a).not.toBe(b)
  })

  it("tolera UA o IP null sin crashear", () => {
    expect(typeof fingerprint(null, null)).toBe("string")
    expect(fingerprint(null, "190.123.45.10")).not.toBe(fingerprint(null, "200.0.0.1"))
  })

  it("agrupa por /48 para IPv6 (primeros 3 grupos)", () => {
    const ua = "Mozilla/5.0 Chrome/120.0"
    const a = fingerprint(ua, "2001:db8:1234:abcd:0:0:0:1")
    const b = fingerprint(ua, "2001:db8:1234:beef:0:0:0:2")
    expect(a).toBe(b)
  })
})

describe("checkDeviceAccess", () => {
  const ua = "Mozilla/5.0 Chrome/120.0"
  const ip = "190.123.45.10"
  const secret = "a".repeat(64)
  const cookieHash = hashDeviceSecret(secret)
  const fp = fingerprint(ua, ip)

  it("ok cuando cookie y fingerprint matchean", () => {
    const r = checkDeviceAccess({
      cookieHashOnSession: cookieHash,
      fingerprintOnSession: fp,
      cookieValueFromRequest: secret,
      userAgentFromRequest: ua,
      ipFromRequest: ip,
    })
    expect(r).toEqual({ ok: true })
  })

  it("missing_cookie cuando no llega cookie del cliente", () => {
    const r = checkDeviceAccess({
      cookieHashOnSession: cookieHash,
      fingerprintOnSession: fp,
      cookieValueFromRequest: null,
      userAgentFromRequest: ua,
      ipFromRequest: ip,
    })
    expect(r).toEqual({ ok: false, reason: "missing_cookie" })
  })

  it("missing_cookie cuando la sesión no tiene cookieHash setado (edge race)", () => {
    const r = checkDeviceAccess({
      cookieHashOnSession: null,
      fingerprintOnSession: fp,
      cookieValueFromRequest: secret,
      userAgentFromRequest: ua,
      ipFromRequest: ip,
    })
    expect(r).toEqual({ ok: false, reason: "missing_cookie" })
  })

  it("cookie_mismatch cuando la cookie no hash-matchea con la guardada", () => {
    const r = checkDeviceAccess({
      cookieHashOnSession: cookieHash,
      fingerprintOnSession: fp,
      cookieValueFromRequest: "b".repeat(64),
      userAgentFromRequest: ua,
      ipFromRequest: ip,
    })
    expect(r).toEqual({ ok: false, reason: "cookie_mismatch" })
  })

  it("fingerprint_mismatch cuando cambia el UA", () => {
    const r = checkDeviceAccess({
      cookieHashOnSession: cookieHash,
      fingerprintOnSession: fp,
      cookieValueFromRequest: secret,
      userAgentFromRequest: "Mozilla/5.0 Firefox/120.0",
      ipFromRequest: ip,
    })
    expect(r).toEqual({ ok: false, reason: "fingerprint_mismatch" })
  })

  it("tolera cambio de IP dentro de la misma /24", () => {
    const r = checkDeviceAccess({
      cookieHashOnSession: cookieHash,
      fingerprintOnSession: fp,
      cookieValueFromRequest: secret,
      userAgentFromRequest: ua,
      ipFromRequest: "190.123.45.99", // misma subred
    })
    expect(r).toEqual({ ok: true })
  })

  it("salta validación de fingerprint si la sesión no lo tiene guardado (legacy)", () => {
    const r = checkDeviceAccess({
      cookieHashOnSession: cookieHash,
      fingerprintOnSession: null,
      cookieValueFromRequest: secret,
      userAgentFromRequest: "cualquier UA",
      ipFromRequest: "200.0.0.1",
    })
    expect(r).toEqual({ ok: true })
  })
})
