import "server-only"
import { z } from "zod"
import { TestEventType } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Registra un `TestSessionEvent`. Rate-limit en el route handler — acá la
 * función es side-effect puro.
 *
 * Regla 5 del motor: estos eventos NO interrumpen el examen, son defensa en
 * profundidad para la revisión humana.
 */

export const LogEventInputSchema = z.object({
  sessionId: z.string().min(1),
  type: z.nativeEnum(TestEventType),
  metadata: z.record(z.unknown()).optional(),
})

export type LogEventInput = z.infer<typeof LogEventInputSchema>

export async function logSessionEvent(input: LogEventInput): Promise<void> {
  await prisma.testSessionEvent.create({
    data: {
      sessionId: input.sessionId,
      type: input.type,
      metadata: input.metadata as never,
    },
  })
}
