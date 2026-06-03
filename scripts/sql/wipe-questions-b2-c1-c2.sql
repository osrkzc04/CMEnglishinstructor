-- Elimina todas las preguntas de B2, C1 y C2 en inglés.
--
-- Cascada automática:
--   - QuestionOption.questionId tiene ON DELETE CASCADE.
--   - QuestionFillAnswer.questionId tiene ON DELETE CASCADE.
-- No es necesario tocar esas tablas a mano.
--
-- TestSessionQuestion.questionId NO tiene FK enforced, así que los snapshots
-- de intentos previos quedan intactos (el snapshot es la fuente de verdad;
-- el questionId queda apuntando a un id que ya no existe — semánticamente
-- correcto).
--
-- Ejecución desde la consola del contenedor de Postgres en Dokploy:
--   psql "$DATABASE_URL" -f wipe-questions-b2-c1-c2.sql
-- O pegando el contenido directo en psql / Beekeeper / pgAdmin.

BEGIN;

-- Mostrar cuántas se van a borrar antes de tirar el DELETE.
SELECT cl."code" AS level, COUNT(*) AS preguntas_a_borrar
FROM "Question" q
JOIN "CefrLevel" cl ON cl."id" = q."levelId"
JOIN "Language" l ON l."id" = cl."languageId"
WHERE l."code" = 'en'
  AND cl."code" IN ('B2', 'C1', 'C2')
GROUP BY cl."code"
ORDER BY cl."code";

DELETE FROM "Question"
WHERE "levelId" IN (
  SELECT cl."id"
  FROM "CefrLevel" cl
  JOIN "Language" l ON l."id" = cl."languageId"
  WHERE l."code" = 'en'
    AND cl."code" IN ('B2', 'C1', 'C2')
);

COMMIT;
