-- Clona todas las preguntas activas de A1 (inglés) hacia B2, C1 y C2.
-- Útil como banco temporal mientras se carga el material real de niveles
-- altos.
--
-- Resultado: por cada pregunta de A1, quedan 3 copias nuevas — una en B2,
-- otra en C1 y otra en C2 — con todas sus opciones / respuestas aceptadas.
-- Los IDs se generan con formato cuid (`c` + 24 hex chars), así la UI
-- (que valida con Zod `.cuid()`) puede editarlas sin rechazos.
--
-- IMPORTANTE: este script NO es idempotente. Correrlo dos veces duplica las
-- copias. Si necesitas limpiar y volver a clonar, ejecuta antes
-- `wipe-questions-b2-c1-c2.sql`.
--
-- Ejecución:
--   psql "$DATABASE_URL" -f clone-a1-to-b2-c1-c2.sql

BEGIN;

-- 1. Mapping (old_question_id, new_question_id, target_level_id).
--    Un registro por cada pregunta A1 × cada nivel destino (B2/C1/C2).
CREATE TEMP TABLE _q_clone_map (
  old_id        TEXT NOT NULL,
  new_id        TEXT NOT NULL PRIMARY KEY,
  new_level_id  TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _q_clone_map (old_id, new_id, new_level_id)
SELECT
  src."id"  AS old_id,
  'c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24) AS new_id,
  tgt."id"  AS new_level_id
FROM "Question" src
JOIN "CefrLevel" src_lvl ON src_lvl."id" = src."levelId"
JOIN "Language" lang     ON lang."id"    = src_lvl."languageId"
JOIN "CefrLevel" tgt     ON tgt."languageId" = lang."id"
                        AND tgt."code" IN ('B2', 'C1', 'C2')
WHERE lang."code" = 'en'
  AND src_lvl."code" = 'A1'
  AND src."isActive" = TRUE;

-- 2. Crear las nuevas preguntas usando el mapping.
INSERT INTO "Question" (
  "id", "levelId", "type", "prompt", "topic",
  "difficulty", "points", "isActive", "createdBy",
  "createdAt", "updatedAt"
)
SELECT
  m.new_id,
  m.new_level_id,
  src."type",
  src."prompt",
  src."topic",
  src."difficulty",
  src."points",
  src."isActive",
  src."createdBy",
  NOW(),
  NOW()
FROM _q_clone_map m
JOIN "Question" src ON src."id" = m.old_id;

-- 3. Clonar las opciones (multiple choice) apuntando a la pregunta nueva.
INSERT INTO "QuestionOption" ("id", "questionId", "text", "isCorrect", "order")
SELECT
  'c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  m.new_id,
  o."text",
  o."isCorrect",
  o."order"
FROM _q_clone_map m
JOIN "QuestionOption" o ON o."questionId" = m.old_id;

-- 4. Clonar las respuestas aceptadas (fill in).
INSERT INTO "QuestionFillAnswer" ("id", "questionId", "acceptedAnswer", "caseSensitive")
SELECT
  'c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  m.new_id,
  a."acceptedAnswer",
  a."caseSensitive"
FROM _q_clone_map m
JOIN "QuestionFillAnswer" a ON a."questionId" = m.old_id;

-- 5. Resumen visible.
SELECT cl."code" AS level, COUNT(*) AS preguntas_clonadas
FROM _q_clone_map m
JOIN "CefrLevel" cl ON cl."id" = m.new_level_id
GROUP BY cl."code"
ORDER BY cl."code";

COMMIT;
