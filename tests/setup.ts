import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// Forzar TZ predecible en tests
process.env.TZ = "UTC"

// Mock del módulo `server-only` para que vitest no falle al importar archivos server
vi.mock("server-only", () => ({}))
