import { z } from "zod"

/**
 * Validaciones del módulo de materiales (carpetas + archivos).
 *
 * Las raíces se autocrean a demanda (una por `ProgramLevel`) — no se exponen
 * como crear-folder con `parentId=null`.
 */

// Caracteres prohibidos en nombres (alineado con NTFS/macOS para portabilidad)
const FORBIDDEN = /[\\/:*?"<>|]/

export const NameSchema = z
  .string()
  .trim()
  .min(1, "Nombre requerido")
  .max(120, "Máximo 120 caracteres")
  .refine((v) => !FORBIDDEN.test(v), {
    message: "El nombre no puede contener / \\ : * ? \" < > |",
  })
  .refine((v) => v !== "." && v !== "..", { message: "Nombre inválido" })

export const CreateFolderSchema = z.object({
  parentId: z.string().cuid("Carpeta inválida"),
  name: NameSchema,
})
export type CreateFolderInput = z.infer<typeof CreateFolderSchema>

export const RenameFolderSchema = z.object({
  folderId: z.string().cuid("Carpeta inválida"),
  name: NameSchema,
})
export type RenameFolderInput = z.infer<typeof RenameFolderSchema>

export const DeleteFolderSchema = z.object({
  folderId: z.string().cuid("Carpeta inválida"),
})
export type DeleteFolderInput = z.infer<typeof DeleteFolderSchema>

export const RenameFileSchema = z.object({
  fileId: z.string().cuid("Archivo inválido"),
  name: NameSchema,
})
export type RenameFileInput = z.infer<typeof RenameFileSchema>

export const DeleteFileSchema = z.object({
  fileId: z.string().cuid("Archivo inválido"),
})
export type DeleteFileInput = z.infer<typeof DeleteFileSchema>
