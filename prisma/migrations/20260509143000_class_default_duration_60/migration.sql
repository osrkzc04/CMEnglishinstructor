-- Class default duration moved from 45 to 60 minutes.
--
-- 1. ALTER COLUMN: nuevos Courses creados sin valor explícito reciben 60.
-- 2. UPDATE: backfill de los Courses existentes que aún tienen el viejo
--    default (45) — los pone en 60.
--
-- IMPORTANTE: NO se tocan ClassGroup.durationMinutes ni
-- ClassSession.durationMinutes. Esos campos son snapshots inmutables del
-- valor que tenía Course al momento de crear el aula (ver schema.prisma
-- línea ~420). Cambiar el catálogo no debe alterar histórico.

ALTER TABLE "Course" ALTER COLUMN "classDuration" SET DEFAULT 60;

UPDATE "Course" SET "classDuration" = 60 WHERE "classDuration" = 45;
