import { z } from "zod"

/**
 * Validación del form público de contacto del landing.
 *
 * El formulario es la única vía de entrada del landing — reemplaza a las
 * tarjetas mailto que existían antes. Por eso el schema cubre los tres
 * canales (personas, empresas, otro) en un solo modelo y el server-side
 * decide a qué inbox enrutar (hoy todos van a EMAIL_REPLY_TO).
 *
 * Campos:
 *  - `phone` es opcional (no todo el mundo quiere dejarlo en un primer
 *    contacto). Si llega vacío se transforma a undefined antes de tocar la
 *    capa de email.
 *  - `topic` clasifica la consulta — sirve para subject del email y para
 *    que coordinación priorice. No expone niveles ni programas porque eso
 *    se decide en la conversación.
 *  - `consentAccepted` literal true — protege LGPD/datos personales en EC.
 *  - `turnstileToken` se inyecta desde el widget. La action lo verifica
 *    contra Cloudflare; en dev sin secret se omite y queda solo el
 *    rate-limit por IP y email.
 */

export const InquiryTopicSchema = z.enum(["personas", "empresas", "otro"])
export type InquiryTopic = z.infer<typeof InquiryTopicSchema>

export const InquiryTopicLabel: Record<InquiryTopic, string> = {
  personas: "Programas para personas",
  empresas: "Propuesta corporativa",
  otro: "Otra consulta",
}

export const PublicInquirySchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  phone: z
    .string()
    .trim()
    .max(20, "Máximo 20 caracteres")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  topic: InquiryTopicSchema,
  message: z
    .string()
    .trim()
    .min(20, "Cuéntanos un poco más (mínimo 20 caracteres)")
    .max(2000, "Máximo 2000 caracteres"),
  consentAccepted: z.literal(true, {
    errorMap: () => ({
      message: "Debes aceptar el uso de tus datos para responderte",
    }),
  }),
  turnstileToken: z.string().min(1, "Validación anti-spam pendiente"),
})

export type PublicInquiryInput = z.infer<typeof PublicInquirySchema>
