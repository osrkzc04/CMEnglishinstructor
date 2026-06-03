-- Revierte CefrLevel.placementMinScore. La recomendación de ubicación dejó
-- de usar un rango por nivel: ahora se basa en el bloque adaptativo que el
-- candidato superó + un umbral global configurable (AppSetting
-- placement_confirmation_threshold_percent, default 78).

-- AlterTable
ALTER TABLE "CefrLevel" DROP COLUMN "placementMinScore";
