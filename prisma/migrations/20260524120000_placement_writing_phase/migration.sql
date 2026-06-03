-- Placement test: agrega writing al flujo adaptativo.
--
-- 1) Estado nuevo PENDING_WRITING en el enum de sesión: la sesión llega
--    aquí cuando termina el último bloque que el candidato alcanzó
--    (fallo por umbral, o completar las 6 secciones) y le toca rendir
--    el writing.
-- 2) Consigna de writing por nivel, configurada en la plantilla.
-- 3) Snapshot del writing en la sesión — preserva la consigna usada y la
--    respuesta del candidato aunque coordinación luego edite la plantilla.

-- AlterEnum (postgres requiere ALTER TYPE aislado de DML que use el valor;
-- las ALTER TABLE de abajo no insertan filas con el valor nuevo).
ALTER TYPE "TestSessionStatus" ADD VALUE 'PENDING_WRITING';

-- AlterEnum: nuevos eventos para sampling + writing.
ALTER TYPE "TestEventType" ADD VALUE 'MISSING_READING';
ALTER TYPE "TestEventType" ADD VALUE 'WRITING_SUBMITTED';

-- AlterTable
ALTER TABLE "TestTemplateSection" ADD COLUMN "writingPrompt" TEXT;

-- AlterTable
ALTER TABLE "TestSession" ADD COLUMN "writingLevelCode" TEXT;
ALTER TABLE "TestSession" ADD COLUMN "writingPromptSnapshot" TEXT;
ALTER TABLE "TestSession" ADD COLUMN "writingResponse" TEXT;
ALTER TABLE "TestSession" ADD COLUMN "writingSubmittedAt" TIMESTAMP(3);
