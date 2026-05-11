-- CreateIndex
CREATE INDEX "ClassGroup_status_createdAt_idx" ON "ClassGroup"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClassParticipant_enrollmentId_attendance_idx" ON "ClassParticipant"("enrollmentId", "attendance");

-- CreateIndex
CREATE INDEX "ClassSession_status_scheduledEnd_idx" ON "ClassSession"("status", "scheduledEnd");

-- CreateIndex
CREATE INDEX "ClassSession_teacherId_status_scheduledStart_idx" ON "ClassSession"("teacherId", "status", "scheduledStart");

-- CreateIndex
CREATE INDEX "Enrollment_classGroupId_status_idx" ON "Enrollment"("classGroupId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_status_programLevelId_idx" ON "Enrollment"("status", "programLevelId");

-- CreateIndex
CREATE INDEX "TeacherApplication_status_createdAt_idx" ON "TeacherApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherAssignment_teacherId_endDate_idx" ON "TeacherAssignment"("teacherId", "endDate");

-- CreateIndex
CREATE INDEX "TeacherAssignment_classGroupId_endDate_idx" ON "TeacherAssignment"("classGroupId", "endDate");

-- =============================================================================
-- Partial indexes — Postgres específico, no expresable en `@@index` de Prisma.
-- Sirven para los filtros más frecuentes ("vigente", "no borrado", "en cola").
-- Son más chicos y más rápidos que un índice completo para esos casos.
-- =============================================================================

-- "Asignación vigente del docente" (cualquier dashboard con docente activo)
CREATE INDEX "TeacherAssignment_active_by_teacher_partial"
  ON "TeacherAssignment" ("teacherId")
  WHERE "endDate" IS NULL;

-- "Docente vigente del aula" (lectura por classGroupId en queries de aula)
CREATE INDEX "TeacherAssignment_active_by_classGroup_partial"
  ON "TeacherAssignment" ("classGroupId")
  WHERE "endDate" IS NULL;

-- Carpetas y archivos materializados (filtra siempre deletedAt IS NULL).
CREATE INDEX "MaterialFolder_alive_by_parent_partial"
  ON "MaterialFolder" ("programLevelId", "parentId")
  WHERE "deletedAt" IS NULL;

CREATE INDEX "MaterialFile_alive_by_folder_partial"
  ON "MaterialFile" ("folderId")
  WHERE "deletedAt" IS NULL;

-- Matrículas "en espera de aula" (classGroupId IS NULL, status ACTIVE) — usado
-- por el wizard "elegir o crear aula" para encontrar candidatos.
CREATE INDEX "Enrollment_waiting_for_class_group_partial"
  ON "Enrollment" ("programLevelId")
  WHERE "classGroupId" IS NULL AND "status" = 'ACTIVE';

-- Auto-cierre: WHERE status='SCHEDULED' AND scheduledEnd < cutoff. El partial
-- es más selectivo que el compuesto (status, scheduledEnd) porque solo
-- mantiene las filas SCHEDULED en el índice, que son las únicas que importan.
CREATE INDEX "ClassSession_open_by_scheduledEnd_partial"
  ON "ClassSession" ("scheduledEnd")
  WHERE "status" = 'SCHEDULED';

-- Cola de emails pendientes: WHERE status='QUEUED'. Acelera al retry-emails job.
CREATE INDEX "EmailNotification_queued_partial"
  ON "EmailNotification" ("scheduledFor")
  WHERE "status" = 'QUEUED';

-- =============================================================================
-- Vistas de soporte — para exploración SQL / herramientas de analytics.
-- No son consumidas por queries de Prisma (no usamos preview "views"); son
-- conveniencias de lectura para coordinación, reportería ad-hoc o un BI futuro.
-- =============================================================================

-- Docente vigente por aula con su nombre completo. Reemplaza el patrón
--   teacherAssignments: { where: { endDate: null }, ... }
-- cuando alguien quiere consultar directo desde psql.
CREATE OR REPLACE VIEW "vw_current_teacher_assignment" AS
SELECT
  ta."classGroupId",
  ta."teacherId",
  ta."startDate",
  u."firstName",
  u."lastName",
  u."email"
FROM "TeacherAssignment" ta
JOIN "User" u ON u."id" = ta."teacherId"
WHERE ta."endDate" IS NULL;

-- Progreso por matrícula activa: % avance contra el total del nivel.
-- Útil para reportes y filtros "estudiantes cerca del fin del nivel".
CREATE OR REPLACE VIEW "vw_enrollment_progress" AS
SELECT
  e."id"             AS "enrollmentId",
  e."studentId",
  e."classGroupId",
  e."programLevelId",
  e."status",
  e."consumedHours",
  pl."totalHours",
  CASE
    WHEN pl."totalHours" > 0
      THEN ROUND((e."consumedHours" / pl."totalHours") * 100, 2)
    ELSE 0
  END                AS "progressPct",
  GREATEST(pl."totalHours" - e."consumedHours", 0) AS "remainingHours"
FROM "Enrollment" e
JOIN "ProgramLevel" pl ON pl."id" = e."programLevelId";
