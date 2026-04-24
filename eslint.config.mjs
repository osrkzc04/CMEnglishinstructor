import { FlatCompat } from "@eslint/eslintrc"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Forzar uso de paths absolutos
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "../../*", "../../../*"],
              message: "Use absolute imports (@/...) instead of relative paths.",
            },
          ],
        },
      ],
      // Marcar uso de any explícito
      "@typescript-eslint/no-explicit-any": "warn",
      // Permitir _ prefix para vars no usadas
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "prisma/migrations/**", "storage/**"],
  },
]
