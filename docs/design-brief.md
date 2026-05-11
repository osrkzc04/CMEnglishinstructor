# CM English Instructor — Design Brief

> Documento de dirección visual para el producto. Antes de escribir cualquier
> componente, consultar este archivo. Si el diseño propuesto no calza con estos
> principios, **el principio gana**.

---

## Personalidad de marca

**Premium editorial con calidez humana.**

La marca no es ni juvenil (Duolingo), ni corporate frío (SAP), ni startup genérica (cualquier landing de Vercel). Es una academia dirigida por **Carolina Monsalve**, Certified English & Spanish Instructor, con énfasis en ejecutivos y empresas — pero con un slogan de calidez: _Helping Everyone Communicate_.

Referencias mentales a imitar:

- **Linear** — densidad de información, jerarquía tipográfica impecable.
- **Stripe** — confianza profesional, micro-interacciones precisas.
- **Pitch** — tonos editoriales, no demasiado SaaS.

Referencias a **evitar**:

- Duolingo (juvenil, gamificado).
- Cualquier dashboard genérico con purple gradient.
- SaaS con ilustraciones de undraw / storyset.

---

## Paleta de color

### Core — derivada directamente del logo y tarjeta de presentación

| Token      | Hex       | Uso                                                                  |
| ---------- | --------- | -------------------------------------------------------------------- |
| `ink.900`  | `#233641` | Dominante. Sidebar, topbar, dark mode background, texto principal    |
| `teal.500` | `#279F89` | **Acento único de marca.** CTAs primarios, estado activo, highlights |
| `teal.700` | `#267A6F` | Hover / pressed del teal                                             |
| `bone.100` | `#FAF8F5` | Fondo de área de trabajo (no white puro)                             |

**Regla estricta**: el teal aparece **solo en CTAs y estados activos**. Si lo usas en todas partes, pierde su función de marca. Iconografía general va en neutros.

### Ramp extendido de ink (neutrals)

Todos los grises del sistema derivan del ink, mantienen la temperatura azul-verde.

```
ink.50   #F4F6F7   hover muy sutil
ink.100  #EAECED   bordes en light mode
ink.200  #C4C9CC   divisores, texto terciario
ink.300  #B2B8BC   placeholders
ink.400  #8F999E   texto secundario claro
ink.500  #707C84   texto secundario
ink.600  #55646C   texto de énfasis sobre bone
ink.700  #3E4F58   bordes en dark mode
ink.800  #2C3E49   cards en dark mode
ink.900  #233641   fondo dark, texto principal light
ink.950  #162229   fondo más profundo en dark
```

### Ramp de teal

```
teal.50   #E7F6F3   fondo de badges de éxito
teal.100  #C7EBE3
teal.200  #9BDCD0
teal.300  #6BCDBA
teal.400  #3FB39B
teal.500  #279F89   ←── base de marca
teal.600  #228D79   hover inicial
teal.700  #267A6F   pressed
teal.800  #255B5A
teal.900  #1E4544
teal.950  #102827
```

### Estados semánticos

Nunca rojo/verde/amarillo saturados genéricos (tipo bootstrap). Usar tonos con carga emocional apropiada y con temperatura coherente con la paleta:

| Estado  | Hex                  | Nota                                 |
| ------- | -------------------- | ------------------------------------ |
| Success | `#279F89` (teal.500) | Reutiliza el acento de marca         |
| Warning | `#C88A2E`            | Mostaza cálida, no amarillo saturado |
| Danger  | `#B44C3A`            | Terracota profundo, no rojo primario |
| Info    | `#3A6D8C`            | Azul pizarra, coherente con ink      |

---

## Tipografía

**Prohibido absoluto**: Inter, Roboto, Arial, Helvetica, Space Grotesk. Son los sellos del "AI slop".

### Stack

```
Display / Titulares grandes:  Fraunces (Google Fonts — variable, con optical sizing)
Body / UI:                     Geist (sans-serif humanist moderna)
Mono / códigos:                Geist Mono
```

Fraunces es lo que nos ancla al mundo "editorial / académico" sin caer en serif anticuado. Su _optical sizing_ ajusta automáticamente el trazo según el tamaño — en 48px se ve editorial, en 14px se ve limpio.

### Escala

| Token        | Tamaño                | Peso | Uso                                                |
| ------------ | --------------------- | ---- | -------------------------------------------------- |
| `display-lg` | clamp(2.5, 5vw, 4rem) | 500  | Hero de landing, pantalla de bienvenida del examen |
| `display`    | clamp(2, 4vw, 3rem)   | 500  | Títulos de página grandes                          |
| `h1`         | 1.875rem              | 500  | Título principal de una pantalla                   |
| `h2`         | 1.5rem                | 500  | Secciones dentro de una pantalla                   |
| `h3`         | 1.25rem               | 500  | Sub-secciones, cards destacadas                    |
| `h4`         | 1.125rem              | 500  | Títulos de tarjetas pequeñas                       |
| `body-lg`    | 1.0625rem             | 400  | Texto editorial                                    |
| `body`       | 1rem                  | 400  | Texto estándar                                     |
| `body-sm`    | 0.875rem              | 400  | Texto secundario, tablas                           |
| `caption`    | 0.75rem               | 500  | Etiquetas, labels de inputs                        |

### Reglas tipográficas

- **Display y h1 en Fraunces.** H2 en adelante en Geist (sans). No mezclar al revés.
- **Weight 500 máximo.** No usar 600/700/800 — se ven heavy y rompen la elegancia editorial. La negrita solo aparece en mono cuando hace falta énfasis real.
- **Letter-spacing negativo** (`-0.01em` a `-0.02em`) en titulares grandes.
- **Line-height 1.6** en body, **1.2-1.3** en titulares.
- **Sentence case** en toda la UI. Sin Title Case, sin ALL CAPS excepto en labels de inputs con tracking amplio (0.08em).

---

## Layout y composición

### Estructura global

- **Sidebar en ink.900** (dark siempre, sin importar modo light/dark general).
- **Topbar en ink.900** (misma regla).
- **Área de trabajo en bone.100** en light mode, en `ink.900` en dark mode.

Este contraste entre chrome oscuro y área de trabajo clara es **la firma visual** del producto. Se parece a la tarjeta de presentación impresa en vivo.

### Espacio y densidad

Densidad **media-alta** (herramienta de trabajo, no landing) pero con **respiración vertical generosa entre secciones** (48-64px). Padding interno de cards: 20-24px.

### Bordes antes que sombras

- `border: 0.5px solid theme(colors.ink.100)` en cards light mode.
- `border: 0.5px solid theme(colors.ink.700)` en cards dark mode.
- **Prohibido `box-shadow` en cards.** Las sombras son el tell de SaaS genérico.
- Focus rings (`:focus-visible`) sí usan `ring-2 ring-teal-500 ring-offset-2` — esa es la única "sombra" permitida.

### Radius

- Controles pequeños (botones, inputs): `6px`
- Cards: `8-10px`
- Secciones grandes: `12px`
- **Nunca pasar de 12px en UI controls** — más que eso se siente infantil y rompe el feel editorial.

---

## Componentes críticos

### CTA primario (botón con acción principal)

```
bg-teal-500 hover:bg-teal-600 active:bg-teal-700
text-white
px-4 py-2
rounded-md
font-medium (500)
transition-colors duration-150
```

Usarlo **solo una vez por pantalla**. Si hay dos CTAs, el secundario es outline.

### CTA secundario

```
bg-transparent
border border-ink-200 dark:border-ink-700
hover:bg-ink-50 dark:hover:bg-ink-800
text-ink-900 dark:text-bone
```

### Cards

```
bg-white dark:bg-ink-800
border border-ink-100 dark:border-ink-700
rounded-lg
p-5 sm:p-6
```

### Badges / estados

Fondos 50-100 del color correspondiente + texto 700-800 del mismo ramp. Nunca texto blanco sobre color saturado en badges pequeños.

### Forms

- Labels en `caption` (12px) con tracking amplio (`tracking-wide`), color `ink.500`.
- Inputs: altura 40px, borde `ink.200`, focus ring `teal-500`.
- Error state: borde `#B44C3A`, helper text en el mismo color.

### Tablas

- Header: fondo `bone.100`, text `caption` uppercase tracking-wide.
- Rows: borde inferior `ink.100`, hover `ink.50`.
- Primera columna con peso 500 (identificadora), resto regular.
- Números a la derecha, alineados decimalmente si son montos.

---

## Componentes estrella (los que diferencian el producto)

### 1. Grilla de disponibilidad día × hora

Este componente aparece en 3 lugares (postulación de docente, preferencias del estudiante, asignación por coordinador). Tiene que verse **único y memorable**.

Principios:

- Grilla como **papel milimetrado editorial**. Líneas de `0.5px` en `ink.200`.
- Slots seleccionados se pintan con `teal.500` al 15% de opacidad + borde `teal.500` al 50%.
- Al hacer drag, el cursor muestra la hora de inicio y fin en un tooltip pequeño con mono type.
- Días de la semana en el eje horizontal en caption tracking-wide.
- Horas (06:00 → 22:00) en el eje vertical en mono type.
- **Sin íconos, sin gradientes, sin color más allá del teal.**

### 2. Motor de examen (rendir prueba)

Pantalla completa, inmersiva. Inspiración: lectura editorial, no quiz show.

- Fondo **ink.900** siempre, sin importar modo light/dark general.
- Pregunta centrada horizontalmente, max-width 640px.
- Pregunta en **Fraunces serif 28-32px**, line-height 1.4.
- Opciones en Geist, con radius 8px, hover teal.
- **Timer en mono type en esquina superior derecha**, pequeño, discreto, color bone al 60%. Se vuelve teal cuando queda <10% del tiempo, nunca rojo brillante.
- Progress bar inferior de 2px, color teal.
- Sin distractores: sin nav, sin logo prominente. El logo monograma aparece sutil en esquina en bone al 30%.

### 3. Calendario de clases

Vista semanal tipo Google Calendar pero con estética propia:

- Bloques de clase en **teal.100 con borde teal.500** para próximas, `ink.100` para pasadas.
- Horario en mono, nombre del estudiante en sans medium.
- Días pasados con opacity 0.6.
- Feriados marcados con una línea vertical dashed en `ink.300` y etiqueta en caption.
- Hover sobre un bloque: `elevate` con un border-teal-500 adicional, sin shadow.

---

## Modo oscuro

**Mandatorio desde el día 1.** La tarjeta de presentación es literalmente dark mode, así que es la expresión más fiel de la marca.

- Fondo: `ink.900` (`#233641`) — nunca puro negro.
- Cards: `ink.800`.
- Bordes: `ink.700`.
- Texto primario: `bone.100`.
- Texto secundario: `ink.400`.
- Teal en dark se ve igual que en light (no modificar su hex base).

---

## Motion

**Sutil, útil, nunca decorativo.**

- Transiciones de color y background: `150ms ease-out`.
- Entrada de elementos: `300ms cubic-bezier(0.16, 1, 0.3, 1)` (slide-up ligero).
- View Transitions API para navegación entre páginas del dashboard (feel nativo).
- **Prohibido**: spring bounce, rotaciones decorativas, auto-play de nada.

---

## Iconografía

Lucide React. Stroke width `1.5`, tamaño por defecto `16px` en UI, `20px` en nav.

Nunca:

- Íconos rellenos (solid fill) — rompen el trazo lineal del logo.
- Íconos en color — solo si señalan estado semántico (success/warning/danger/info).
- Emoji en la UI.

---

## Imágenes y contenido visual

- **Fotos**: cuando sea necesario (landing pública, avatares), tratamiento duotono ink + bone para homogeneizar. Nada de stock fotográfico saturado.
- **Sin ilustraciones decorativas**. Si hace falta un estado vacío, usa tipografía grande en serif + un ícono de Lucide pequeño.
- **Logo monograma**: aparece discreto en esquina superior izquierda del sidebar. El wordmark completo solo en la página de login y en emails.

---

## Anti-patrones — rechazar explícitamente

Si ves cualquiera de estos en un PR, es motivo automático de revisión:

- ❌ Fuente Inter o Roboto
- ❌ Gradientes de color (especialmente purple-to-pink)
- ❌ Drop shadows en cards
- ❌ Emojis en labels o buttons
- ❌ Ilustraciones de undraw, storyset, humaaans
- ❌ Border-radius >12px en controles
- ❌ Animaciones spring o bounce exageradas
- ❌ Colores saturados genéricos (bootstrap blue, success green genérico)
- ❌ Carrusel de cards en página principal
- ❌ Títulos en Title Case o ALL CAPS (excepto labels con tracking)
- ❌ Botones con ícono + texto + chevron (tres elementos, señal de indecisión)
- ❌ Dashboards con widgets de métricas grandes decorativos que nadie consulta

---

## Validación visual

Antes de mergear cualquier componente nuevo, verificar contra esta checklist:

- [ ] ¿Usa solo colores del ramp definido? (nada de hex aleatorios)
- [ ] ¿Usa solo los tamaños de la escala tipográfica?
- [ ] ¿El peso máximo es 500?
- [ ] ¿Si tiene card, usa border en lugar de shadow?
- [ ] ¿El teal solo aparece en CTAs o estados activos?
- [ ] ¿Está implementado en light Y dark mode?
- [ ] ¿Focus visible con ring teal?
- [ ] ¿Sin emojis, sin ilustraciones decorativas?
- [ ] ¿Densidad media-alta con respiración entre secciones?

---

## Aprobado contra mockups · 2026-04-25

Los mockups HTML aprobados son **la fuente de verdad final** del sistema visual. Cuando este brief contradice los mockups, ganan los mockups. Esta sección registra los overrides aplicados después del audit.

**Archivos de referencia (commit congelado):**

- `design-mockups/Layout.html` — app shell completo
- `design-mockups/Login.html` — autenticación
- `design-mockups/Dashboard.html` — dashboard admin con datos
- `design-mockups/Widgets.html` — catálogo de componentes (38 widgets, 8 secciones)

### Overrides sobre las secciones anteriores

#### Estructura global (deroga "Sidebar y Topbar en ink.900")

- **Sidebar:** ink-900 fijo (sin importar tema). ✓ se mantiene.
- **Topbar (header):** **light** en producto. White/`--surface` con borde inferior `ink-100` y un box-shadow muy sutil (`0 1px 0 rgba(35,54,65,0.04), 0 6px 18px rgba(35,54,65,0.05)`). Es la única sombra real del sistema. El contraste sidebar-dark / topbar-light es la nueva firma visual.
- **Área de trabajo:** bone (light) / ink-900 (dark). ✓ se mantiene.

> El brief original decía topbar también en ink-900. Carolina aprobó topbar light en Dashboard.html y Widgets.html — se descarta la versión dark del topbar.

#### Tipografía (deroga "weight 500 máximo")

- **Default Fraunces: weight 400.** Italic disponible en 300 y 400. Weight 500 reservado solo para énfasis dentro de body (`<em>` decorativo en activity items).
- **Default Geist: weight 400.** 500 disponible para acciones/labels.
- **Italic serif** es la voz editorial: usada en breadcrumb actual (`.here`), en `<em>` dentro de h1 ("— acá está hoy."), y en titles de empty state.
- **Italic teal** específica: solo en la quote del aside del login (`<em>everyone</em>`).

#### Escala tipográfica (deroga la tabla anterior)

| Token            | Tamaño              | Peso           | Uso                             |
| ---------------- | ------------------- | -------------- | ------------------------------- |
| `display` / `h1` | **40px** (2.5rem)   | Fraunces 400   | Greeting principal, page titles |
| `display-sm`     | **32px** (2rem)     | Fraunces 400   | Login h1                        |
| `h2`             | **28px** (1.75rem)  | Fraunces 400   | Sección dentro de página        |
| `h3`             | **20px** (1.25rem)  | Fraunces 400   | Card titles                     |
| `h4`             | **18px** (1.125rem) | Fraunces 400   | Empty state title               |
| `body-lg`        | **15px** (default)  | Geist 400      | Body principal                  |
| `body`           | 14px                | Geist 400      | Inputs, captions                |
| `body-sm`        | 13px                | Geist 400      | Meta info                       |
| `caption`        | 12px                | Geist 400      | Labels                          |
| `micro`          | **11px**            | Geist Mono 400 | Eyebrows, mono uppercase labels |
| `kpi`            | **38px**            | Fraunces 400   | KPI value                       |

Tracking discreto: `-0.02em` para display, `-0.015em` para h3, `0.06–0.10em` para mono caps.

#### Bordes (deroga "border 0.5px")

- Todas las cards y paneles: **`border: 1px solid var(--border)`** (no 0.5px).
- 0.5px solo se reserva para divisores extra-finos opcionales — no se usa en el mockup.

#### Border radius (refina la escala anterior)

Escala discreta del mockup:

```
4px   → badges, tags, micro pills
6px   → pagination buttons
7px   → botones, sidebar links, inputs en toolbars, segmented
8px   → inputs form-grade, primary button (login), alerts
10px  → mid panels (toolbars internos, secondaries)
12px  → cards y paneles macro
50%   → avatares circulares
```

**Nada > 12px** se mantiene.

#### Shadows (refina "prohibido box-shadow en cards")

La regla "sin shadow en cards" se mantiene. **Excepciones permitidas:**

1. **Header light** sobre área de trabajo: `0 1px 0 rgba(35,54,65,0.04), 0 6px 18px rgba(35,54,65,0.05)`. Marca el chrome flotando.
2. **Focus ring** teal: `0 0 0 2px var(--bg), 0 0 0 4px color-mix(teal 35%, transparent)`. Doble shadow obligatorio para accesibilidad.
3. **Avatar stack**: `0 0 0 2px var(--surface)` ring para separar avatares apilados.
4. **Switch knob**: `0 1px 2px rgba(0,0,0,0.18)` micro-shadow del thumb.
5. **Pulse animado** del status indicator y live-dot — animación de box-shadow expanding.

#### Iconografía (refina "stroke 1.5")

- **Stroke width 1.6** en todos los iconos Lucide (mockup script: `lucide.createIcons({ attrs: { 'stroke-width': 1.6 } })`).
- Tamaños: `18px` en sidebar, `16px` en h-btn del topbar, `14px` en h-cta y filas, `13px` en KPI labels, `12–11px` en pills/badges.

#### Tokens nuevos (no estaban antes)

Añadidos tras el audit de los mockups:

```
ink-650  #4a5c66   border-strong en dark mode
ink-850  #2A3D49   surface (cards) en dark mode
teal-100 #DDEFEC   fondo de hover/pill teal sutil
chrome-bg / fg / muted / faint    overlays de sidebar y header dark
```

Las paletas teal y bone se redujeron a sus niveles realmente usados: teal en `50/100/500/700`, bone en `50/100`. Lo demás eran inventos del scaffold inicial que no aparecen en ningún mockup.

#### Componentes confirmados como canon

Las 38 entradas de `Widgets.html` son la **biblioteca canónica**. Cualquier nuevo componente debe construirse con estos primitives o argumentarse explícitamente por qué no encaja:

- Botones (5 variantes × 4 tamaños)
- Inputs (default · con icono · error · disabled · textarea · select)
- Checkbox, radio (round box variant)
- Switch
- Segmented control
- Tags / chips
- Badges (default · solid · 4 semánticos · con dot)
- Avatar (sm/md/lg · square · stack · status)
- Alerts (5 variantes)
- Tabla (header mono caps, num tabular)
- Tabs (border-bottom 2px teal)
- Pagination (32px min-width, ink-900 active)
- Tooltip bubble (ink-900)
- Empty state (Fraunces italic title + ico round)
- Skeleton (gradient shimmer)
- Toast = alert con max-width 380px
- KPI cell (label mono · value Fraunces · delta mono)
- Bar / Progress ring
- Class row, activity item, pend row, teach row, level row
- CEFR meter (6 bars), Unit progress (12 bars)
- Question card (label-as-radio teal-tinted)

#### CTA primario — patrón refinado

El brief original decía `bg-teal-500 → hover bg-teal-600 → active teal-700`. **El mockup usa otro patrón en form-grade:**

- **Form-grade primary** (login, modales): `bg-ink-900 text-bone` → hover salta a teal-500. El hover-to-teal es la firma de marca: el botón "florece" al teal en lugar de oscurecerse.
- **Toolbar/header CTA** (Nueva clase, etc.): `bg-teal-500` → hover `bg-teal-700`. Más discreto, ya marca contexto.
- **Dark mode form-grade**: `bg-bone` → hover teal.

Aplicar form-grade cuando es la acción principal del flujo. Aplicar toolbar/header cuando convive con otros CTAs en el mismo viewport.

#### Scope deprecado del scaffold

- `.roles` selector de 4 roles del login (Login.html:250-272) — descartado. No se usa, lo borramos del proyecto.
- `bone-200/300/400/500` y `ink-300/B2B8BC` del Tailwind original — no existen en mockups, se descartan.
- `--teal-100` originalmente declarado pero no usado: ahora sí lo usamos para fondos de pill teal.
