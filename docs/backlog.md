# Backlog técnico

Pendientes técnicos identificados durante el desarrollo. No son decisiones (eso vive en `decisions.md`) ni diseño (eso vive en `design-brief.md`); son cosas que ya sabemos que faltan o que vamos a querer mejorar más adelante.

Cuando se completa un ítem, moverlo a `decisions.md` si la solución implicó una decisión de arquitectura, o simplemente borrarlo del backlog si fue un fix sin discusión.

---

## Materiales (repositorio)

- **Configurar `client_max_body_size 0;` en nginx/cPanel** — sin esto el reverse proxy corta las subidas grandes (>10GB) antes de que lleguen a Node. Documentar en el runbook de deploy.
- **Backups del directorio de storage local** — ahora hay datos pesados ahí. Coordinar con el plan de backups del VPS para incluir `LOCAL_STORAGE_PATH`.
- **Subidas resumibles** — hoy una subida de 10GB que se cae a la mitad arranca de cero. Si se vuelve un dolor, mover a un protocolo chunked tipo tus.io o partir el archivo en chunks del lado del cliente.
- **Cleanup job de archivos huérfanos** — si una transacción de DB falla después del upload streaming, el blob queda en disco sin referencia. Job nocturno que liste keys con prefijo `materials/<folderId>/` cuyo `folderId` no exista en `MaterialFolder`.

## Aulas — alta y matchmaker

- **Validación de slots solapados dentro de la misma aula** — el form actual permite elegir Lunes 18:00 y Lunes 18:15 sin error. La duración del slot las solapa. Validar en el zod schema o en `createClassGroup`.
- **Deshabilitar celdas amarillas en el heatmap cuando hay docente seleccionado** — hoy el coordinador puede clickear una celda donde el docente cubre pero solo algunos estudiantes, y la action rechaza al submit. Mejor prevenirlo en UI mostrando la celda como no clickeable cuando `studentsCovered < studentsTotal`.
- **Aviso soft de aulas que comparten día/hora** — al definir slots, mostrar un panel informativo "Otras aulas activas dictan en este horario" sin bloquear (puede ser intencional). Útil para coordinación.

## Aulas — sesiones materializadas

- **Rematerializar al cambiar de docente** — `setTeacher.action.ts` borra sesiones SCHEDULED futuras y abre nuevo assignment, pero no rematerializa con el docente nuevo. Hoy el coordinador tiene que ir a la card "Sesiones programadas" y clickear "Programar" otra vez. Decidir si automatizamos en la action o dejamos el flow de dos pasos.
- **Editor individual de sesión (mover/cancelar)** — mover horario puntual de una sesión específica con razón. La cancelación ya existe; lo que falta es reprogramación.
- **Override de `meetingUrl` / `location` por sesión** — hoy el docente edita el default del aula y se aplica a todas las sesiones SCHEDULED. Caso futuro: una clase puntual usa otro link/lugar (ej. excursión, link compartido por el alumno). Necesita un dialog en SessionWorkspace que actúe sobre la sesión, no el aula.

## Estudiante

- **¿Hacer `StudentPreferredSchedule` obligatorio al alta?** — hoy es opcional. Si el alumno no carga horario, el matchmaker no lo cuenta. Decidir si cortamos el alta sin horario o seguimos permitiéndolo y avisamos en el detalle.
- **Panel de cobertura agregada en `/admin/estudiantes`** — vista tipo "X estudiantes pendientes de aula tienen el martes 18h libre". Permite a coordinación detectar grupos posibles antes de armar aulas.

## Política de ausencias y reposiciones

- **Reporte de horas pendientes de reponer** — el dato existe (suma de `ClassParticipant.attendance=ABSENT` con `noticedAbsenceAt` ≥24h antes de `scheduledStart`, más cancelaciones del docente con timeliness LATE). Falta la query agregada y la UI para que coordinación reagende esas horas con clases extra al final del nivel.
- **Penalización al docente por cancelación tardía** — `cancelClassSession` ya registra `cancelledBy=TEACHER` y la timeliness se puede derivar de `cancelledAt - scheduledStart`. Falta que el módulo de payroll (cuando se construya) detecte estas cancelaciones tardías y excluya esas horas del cálculo. Ya hay UI que advierte al docente al cancelar.
- **Email al docente cuando un alumno avisa ausencia** — hoy el alumno avisa y solo aparece en el SessionWorkspace cuando el docente entra. Mandar email para que se entere antes (especialmente si es <24h y la clase es 1-a-1, donde podría liberar el horario).
- **Email al alumno y al docente cuando se cancela una sesión** — `cancelClassSession` ya marca `CANCELLED` pero no notifica. La UI lo aclara explícitamente ("no avisa por email a los alumnos en este MVP").
- **Reglas distintas según modalidad/cliente** — hoy la ventana de 24h es global (hardcoded). Si en el futuro cuentas corporativas piden ventanas distintas (48h, 12h), mover a setting por cliente o por programa.

## Postulaciones

- **Activar email de rechazo** — `reject.action.ts` tiene el hook comentado. Cuando se libere copy editorial, descomentar y mandar el email.

## Email / Notificaciones

- **Configurar SPF / DKIM / DMARC** — para que los emails desde Resend (o el provider en producción) no caigan en spam. Documentar en runbook de deploy.

## Infra / Deploy

- **Connection retry config para Neon** — agregar `?connect_timeout=30` al `DATABASE_URL` en producción. Neon free tier auto-suspende después de ~5 min de idle y al primer request del wake-up puede tardar.
- **Plantear migración de Neon free a paid o a Postgres dedicado** — antes de que producción tenga uso real, el auto-suspend va a hacer ruido.
