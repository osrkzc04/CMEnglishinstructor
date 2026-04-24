# Flujo 6 — Facturación del docente (payroll)

## Actores

- **Coordinador / Director** (calcula y cierra periodos)
- **Docente** (ve su propia facturación)

## Pre-requisitos

- `ClassParticipant` cerrados con `hoursCounted` y `rateSnapshot` definidos.
- Si se va a cerrar un periodo: AppSetting que defina día/mes de corte (opcional, también puede ser manual).

## Filosofía

El payroll es **principalmente una vista calculada** sobre `ClassParticipant`. El modelo `PayrollPeriod` solo existe para **congelar** un periodo y volver el monto inmutable.

### Cálculo en vivo (vista por defecto)

```typescript
async function calculateLiveEarnings(teacherId: string, from: Date, to: Date) {
  const participants = await prisma.classParticipant.findMany({
    where: {
      session: {
        teacherId,
        scheduledStart: { gte: from, lte: to },
        status: 'COMPLETED',
      },
      hoursCounted: { gt: 0 },
    },
    include: { session: true, enrollment: { include: { student: { include: { user: true } } } } },
  })
  
  const totalHours  = participants.reduce((sum, p) => sum.add(p.hoursCounted), new Decimal(0))
  const totalAmount = participants.reduce((sum, p) => sum.add(p.hoursCounted.mul(p.rateSnapshot ?? 0)), new Decimal(0))
  
  return {
    teacherId,
    from, to,
    totalHours,
    totalAmount,
    classCount: participants.length,
    breakdown: participants,
  }
}
```

Se usa para mostrar el dashboard del docente y la vista del coordinador en tiempo real.

---

## Paso a paso

### 1. Vista del docente

**Ruta**: `/docente/facturacion` (guard: `requireRole(['TEACHER', 'DIRECTOR'])`)

Muestra:
- Selector de mes (default: mes actual).
- Total de horas y monto del periodo.
- Cantidad de clases dictadas.
- Tabla detallada por clase: fecha, estudiante(s), duración, tarifa, monto.
- Indicador si el periodo ya está cerrado/pagado (badge con estado).

Datos vienen de `calculateLiveEarnings` si no hay `PayrollPeriod` cerrado, o de `PayrollPeriod` directamente si está cerrado.

### 2. Vista del coordinador

**Ruta**: `/admin/facturacion` (guard: coordinador/director)

Lista de docentes activos con:
- Nombre.
- Total del mes en curso (cálculo en vivo).
- Estado del periodo anterior (DRAFT/CLOSED/PAID).
- Acciones: "Ver detalle", "Cerrar periodo", "Marcar como pagado".

### 3. Cerrar un periodo

**Action** `close-period.action.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

export async function closePayrollPeriod(input: {
  teacherId: string
  startDate: Date  // ej: 2026-04-01
  endDate: Date    // ej: 2026-04-30
  closedBy: string
}) {
  return prisma.$transaction(async (tx) => {
    // Verificar que no exista ya un periodo en este rango
    const existing = await tx.payrollPeriod.findFirst({
      where: {
        teacherId: input.teacherId,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    })
    if (existing) throw new AlreadyExistsError('PayrollPeriod')
    
    // Calcular totales (lectura dentro de la transacción para snapshot consistente)
    const participants = await tx.classParticipant.findMany({
      where: {
        session: {
          teacherId: input.teacherId,
          scheduledStart: { gte: input.startDate, lte: input.endDate },
          status: 'COMPLETED',
        },
        hoursCounted: { gt: 0 },
      },
    })
    
    const totalHours  = participants.reduce((s, p) => s.add(p.hoursCounted), new Decimal(0))
    const totalAmount = participants.reduce((s, p) => s.add(p.hoursCounted.mul(p.rateSnapshot ?? 0)), new Decimal(0))
    
    const period = await tx.payrollPeriod.create({
      data: {
        teacherId: input.teacherId,
        startDate: input.startDate,
        endDate:   input.endDate,
        totalHours,
        totalAmount,
        status: 'CLOSED',
        closedBy: input.closedBy,
        closedAt: new Date(),
      },
    })
    
    return period
  })
}
```

A partir de cerrar, **las sesiones del rango no pueden modificar `hoursCounted`** (ver flujo 5, validación en `closeClassSession`).

Después del commit:

```typescript
await enqueueEmail({
  type: 'PAYROLL_CLOSED',
  to: teacherEmail,
  templateData: { period, totalHours, totalAmount, breakdown },
})
```

### 4. Reabrir un periodo (caso excepcional)

Si la directora descubre un error en una clase ya facturada:

`POST /api/payroll/[id]/reopen` (guard: director, audit log obligatorio)

```typescript
await prisma.payrollPeriod.update({
  where: { id: periodId },
  data: { status: 'DRAFT', closedAt: null, closedBy: null },
})

await prisma.auditLog.create({
  data: {
    userId: directorId,
    action: 'payroll.reopen',
    entityType: 'PayrollPeriod',
    entityId: periodId,
    metadata: { reason },
  },
})
```

Una vez reabierto, las sesiones del rango pueden editarse. Debe re-cerrarse después con `closePayrollPeriod` (que recalculará los totales).

### 5. Marcar como pagado

`POST /api/payroll/[id]/mark-paid` (guard: director):

```typescript
await prisma.payrollPeriod.update({
  where: { id: periodId },
  data: { status: 'PAID', paidAt: new Date() },
})
```

A partir de aquí no se puede ni reabrir sin una "Reversión de pago" (acción aún más restringida, no incluida en v1).

---

## Reportes y exportación

### Comprobante en PDF

**Ruta**: `/admin/facturacion/[id]/comprobante.pdf`

Genera PDF con:
- Datos del docente.
- Periodo (fechas).
- Tabla de clases (fecha, estudiante, duración, tarifa, monto).
- Total de horas, total de monto.
- Estado (CLOSED o PAID con fecha).
- Logo y datos de la institución (Carolina Monsalve, CM English Instructor).

Usar `@react-pdf/renderer` o similar. El PDF se genera on-demand, no se almacena.

### Exportación CSV

`GET /admin/facturacion/[id]/export.csv` con headers `Content-Disposition: attachment`.

---

## Tests críticos

- `calculate-live-earnings.test.ts`:
  - Suma correcta con varias sesiones.
  - Excluye sesiones canceladas.
  - Excluye participantes con `hoursCounted = 0`.
  - Usa `rateSnapshot`, no la tarifa actual del docente.
- `close-period.test.ts`:
  - Crea periodo con totales correctos.
  - Falla si ya existe periodo en el rango.
  - Es transaccional (lectura + escritura coherentes).
- E2E: cerrar mes → ver que las sesiones quedan bloqueadas → reabrir → editar → re-cerrar.

## Edge cases

- **Periodo solapado pero no idéntico**: validar que no haya solapamiento parcial. Si abril es CLOSED y se intenta cerrar 15-abril a 15-mayo, debe fallar.
- **Tarifa del docente cambia mid-mes**: gracias a `rateSnapshot`, las clases anteriores al cambio facturan con la tarifa anterior, las posteriores con la nueva. Sin esfuerzo adicional.
- **Docente desactivado**: las facturaciones de meses anteriores siguen disponibles. No se pueden generar nuevas a menos que el docente vuelva a estar activo.
- **Clase cae al borde del periodo (medianoche)**: se asigna por `scheduledStart`. Una clase que arranca 23:55 del último día del mes pertenece a ese mes.
