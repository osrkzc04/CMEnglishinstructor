-- Placement test: puntaje sobre 400 + recomendación de nivel.
--
-- 1) Puntaje mínimo por nivel CEFR (sobre 400) para recomendar la ubicación
--    al cerrar la revisión. Null = rango sin definir; la recomendación lo
--    ignora. Coordinación lo edita en /admin/preguntas/[levelCode].
-- 2) Retroalimentación específica del writing en la evaluación de
--    habilidades, visible para el candidato (distinta de reviewerNotes).

-- AlterTable
ALTER TABLE "CefrLevel" ADD COLUMN "placementMinScore" INTEGER;

-- AlterTable
ALTER TABLE "PlacementSkillEvaluation" ADD COLUMN "writingFeedback" TEXT;
