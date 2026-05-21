-- Drop Holiday table. La academia atiende estudiantes de distintos países,
-- por eso no aplica un calendario único de feriados al materializar sesiones.
-- Si en el futuro se necesita bloquear fechas puntuales, se cancela la
-- ClassSession específica desde la UI del aula.

DROP TABLE IF EXISTS "Holiday";
