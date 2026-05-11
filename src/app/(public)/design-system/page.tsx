"use client"

import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Download,
  Edit3,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Inbox,
  Info,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  UsersRound,
  Video,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card"
import { Input, InputAction } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { Avatar, AvatarStack } from "@/components/ui/avatar"
import { Alert } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Checkbox, Radio, CheckLabel } from "@/components/ui/checkbox"
import { Tag } from "@/components/ui/tag"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Tooltip } from "@/components/ui/tooltip"
import {
  Pagination,
  PaginationItem,
  PaginationNext,
  PaginationPrev,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ProgressRing } from "@/components/ui/progress-ring"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { KpiBand } from "@/components/dashboard/KpiBand"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"

/**
 * Página de inspección visual del sistema. Replica design-mockups/Widgets.html
 * con los componentes ya React. No está linkeada desde el nav — accesible solo
 * por URL directa (`/design-system`) para validar visualmente el catálogo.
 *
 * NOTA: el rendering vive en cliente para que los segmented/switches/etc.
 * con estado funcionen. Pero el shell es minimalista — no usa AppShell para
 * que se pueda inspeccionar sin auth.
 */

const COLOR_TOKENS = [
  { name: "ink-900", hex: "#233641" },
  { name: "ink-700", hex: "#3E4F58" },
  { name: "ink-500", hex: "#707C84" },
  { name: "ink-300", hex: "#C4C9CC" },
  { name: "ink-200", hex: "#EAECED" },
  { name: "ink-100", hex: "#EAECED" },
  { name: "bone", hex: "#FAF8F5" },
  { name: "teal-500", hex: "#279F89" },
  { name: "teal-700", hex: "#267A6F" },
  { name: "teal-100", hex: "#DDEFEC" },
  { name: "warning", hex: "#C88A2E" },
  { name: "danger", hex: "#B44C3A" },
  { name: "info", hex: "#3A6D8C" },
]

const ICONS = [
  LayoutDashboard,
  UsersRound,
  GraduationCap,
  CalendarDays,
  ClipboardCheck,
  FileText,
  BookOpen,
  BarChart3,
  Settings,
  LifeBuoy,
  Bell,
  MessageSquare,
  Search,
  Plus,
  Video,
  Eye,
  Calendar,
  CalendarClock,
  TrendingUp,
  UserPlus,
  FileCheck,
  AlertTriangle,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  PanelLeft,
  PanelRight,
  Download,
  Upload,
  Edit3,
  Trash2,
  Star,
  Clock,
]

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-10 pt-12 pb-16">
      {/* Page intro */}
      <header className="border-border mb-8 border-b pb-6">
        <p className="text-text-3 mb-2 font-mono text-[11.5px] tracking-[0.08em] uppercase">
          Sistema visual · v 1.0
        </p>
        <h1 className="font-serif text-[40px] leading-[1.15] font-normal tracking-[-0.02em]">
          Widgets
          <span className="text-text-2 font-light italic">{" — catálogo de componentes."}</span>
        </h1>
        <p className="text-text-2 mt-2.5 max-w-[640px] text-[15px]">
          Cada bloque y patrón visual del sistema, con su nombre técnico y variantes. Fuente única
          de verdad para mantener coherencia entre el producto y los mockups aprobados.
        </p>
      </header>

      {/* TOC */}
      <nav className="border-border bg-surface mb-8 grid grid-cols-2 gap-0 overflow-hidden rounded-2xl border lg:grid-cols-4">
        {[
          { label: "Fundamentos", num: "01 — 04" },
          { label: "Layout", num: "05 — 09" },
          { label: "Datos", num: "10 — 14" },
          { label: "Formularios", num: "15 — 21" },
          { label: "Feedback", num: "22 — 27" },
          { label: "Listas", num: "28 — 30" },
          { label: "Dominio", num: "31 — 35" },
          { label: "Navegación", num: "36 — 38" },
        ].map((t, i) => (
          <a
            key={t.label}
            href={`#${t.label.toLowerCase()}`}
            className={cn(
              "border-border text-foreground hover:bg-surface-alt flex items-center justify-between gap-2.5 border-r px-4 py-4 text-[13.5px] transition-colors",
              i % 4 === 3 && "lg:border-r-0",
              i % 2 === 1 && "border-r-0 lg:border-r",
            )}
          >
            <span>{t.label}</span>
            <span className="text-text-3 font-mono text-[11px] tracking-[0.06em]">{t.num}</span>
          </a>
        ))}
      </nav>

      {/* 01 FUNDAMENTOS */}
      <Section
        id="fundamentos"
        num="01"
        title="Fundamentos"
        subtitle="— color, tipografía, iconos."
      >
        <Block name="01 · Paleta" desc="Ink · bone · teal · semánticos">
          <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
            {COLOR_TOKENS.map((c) => (
              <div
                key={c.name}
                className="border-border bg-surface overflow-hidden rounded-lg border"
              >
                <div className="h-[60px]" style={{ background: c.hex }} />
                <div className="p-2.5">
                  <div className="text-foreground text-[12px]">{c.name}</div>
                  <div className="text-text-3 mt-0.5 font-mono text-[10.5px]">{c.hex}</div>
                </div>
              </div>
            ))}
          </div>
        </Block>

        <Block name="02 · Tipografía" desc="Fraunces · Geist · Geist Mono">
          <TypeRow meta="Display · Fraunces 40">
            <span className="font-serif text-[40px] leading-[1.15] font-normal tracking-[-0.02em]">
              Helping <em className="text-text-2 italic">everyone</em> communicate
            </span>
          </TypeRow>
          <TypeRow meta="H2 · Fraunces 28">
            <span className="font-serif text-[28px]">Carga por docente</span>
          </TypeRow>
          <TypeRow meta="H3 · Fraunces 20">
            <span className="font-serif text-[20px]">Postulaciones por revisar</span>
          </TypeRow>
          <TypeRow meta="Body · Geist 15 / 1.6">
            <span className="text-[15px]">
              3 postulaciones esperando revisión, 12 clases programadas, 1 prueba pendiente.
            </span>
          </TypeRow>
          <TypeRow meta="Caption · Geist 13">
            <span className="text-text-2 text-[13px]">Senior · B2-C1 · Business · Quito</span>
          </TypeRow>
          <TypeRow meta="Eyebrow · Mono 11">
            <span className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
              Próxima clase
            </span>
          </TypeRow>
          <TypeRow meta="Numérico · Mono tnum">
            <span className="font-mono text-[14px] tabular-nums">
              142 · 78% · 2026-04 · 17:00 — 18:00
            </span>
          </TypeRow>
        </Block>

        <Block name="03 · Iconografía" desc="Lucide · stroke 1.6">
          <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(80px,1fr))] gap-2">
            {ICONS.map((Icon, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="border-border bg-surface text-text-2 grid h-9 w-9 place-items-center rounded-md border">
                  <Icon size={18} strokeWidth={1.6} />
                </div>
                <span className="text-text-3 text-center font-mono text-[10px] leading-[1.2]">
                  {Icon.displayName ?? "icon"}
                </span>
              </div>
            ))}
          </div>
        </Block>

        <Block name="04 · Avatares" desc="sm · md · lg · square · stack · status">
          <div className="flex items-center gap-3.5">
            <Avatar size="sm" initials="CM" />
            <Avatar size="md" initials="CM" />
            <Avatar size="lg" initials="CM" />
            <Avatar size="md" shape="square" initials="CM" />
            <Avatar size="md" initials="CM" status />
            <AvatarStack>
              <Avatar initials="CM" />
              <Avatar initials="MO" />
              <Avatar initials="PA" />
              <Avatar initials="LV" />
              <Avatar initials="+14" className="!bg-ink-900 !text-bone !border-ink-900" />
            </AvatarStack>
          </div>
        </Block>
      </Section>

      {/* 02 LAYOUT */}
      <Section id="layout" num="02" title="Layout" subtitle="& contenedores.">
        <Block name="05 · Card básica" desc="Header con título · cuerpo libre">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Título de la card</CardTitle>
              <CardMeta>Meta opcional</CardMeta>
            </CardHeader>
            <CardContent className="text-text-2 text-[13.5px]">
              Contenido del bloque. El padding interno lo define el contenido — listas, tablas,
              KPIs, etc.
            </CardContent>
          </Card>
        </Block>

        <Block name="06 · KPI band" desc="3 columnas · Fraunces 38 · delta opcional">
          <KpiBand
            items={[
              {
                label: "Estudiantes",
                value: "142",
                icon: UsersRound,
                delta: { text: "+8", variant: "up" },
              },
              {
                label: "Clases hoy",
                value: "12",
                unit: "/14",
                icon: CalendarClock,
                delta: { text: "2 en curso" },
              },
              {
                label: "Ocupación",
                value: "78",
                unit: "%",
                icon: TrendingUp,
                delta: { text: "+4 pts", variant: "up" },
              },
            ]}
          />
        </Block>

        <Block name="07 · Toolbar" desc="Búsqueda · filtros · acción primaria">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="min-w-[200px] flex-1">
              <Input icon={Search} placeholder="Buscar…" />
            </div>
            <Segmented value="all" onValueChange={() => {}} ariaLabel="Filtros">
              <SegmentedItem value="all">Todas</SegmentedItem>
              <SegmentedItem value="active">Activas</SegmentedItem>
              <SegmentedItem value="paused">Pausadas</SegmentedItem>
            </Segmented>
            <Button variant="ghost" size="sm">
              <Filter />
              Filtros
              <Badge className="ml-1">3</Badge>
            </Button>
            <Button variant="ghost" size="sm">
              <Download />
              Exportar
            </Button>
            <Button variant="teal" size="sm">
              <Plus />
              Nueva
            </Button>
          </div>
        </Block>

        <Block name="09 · Divisores" desc="Solid · dashed">
          <div className="w-full">
            <Separator />
            <div className="text-text-3 my-3 text-[12px]">— solid (entre secciones)</div>
            <Separator variant="dashed" />
            <div className="text-text-3 mt-3 text-[12px]">— dashed (subdivisión visual)</div>
          </div>
        </Block>
      </Section>

      {/* 03 DATOS */}
      <Section id="datos" num="03" title="Datos" subtitle="& métricas.">
        <Block name="11 · Barra de progreso" desc="Default · warn · danger · info">
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
            <BarRow label="Saludable" value={46} suffix="28 / 60 hrs" />
            <BarRow label="Por renovar" value={95} suffix="38 / 40 hrs" variant="warn" />
            <BarRow label="Crítico" value={99} suffix="1 / 100 hrs" variant="danger" />
            <BarRow label="Subutilizado" value={44} suffix="11 / 25 hrs" variant="info" />
          </div>
        </Block>

        <Block name="12 · Progress ring" desc="Cuando el espacio horizontal es escaso">
          <ProgressRing value={25} />
          <ProgressRing value={46} />
          <ProgressRing value={78} />
          <ProgressRing value={95} />
        </Block>

        <Block name="13 · Tabla" desc="Header en mono caps · números tabulares">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Próx. clase</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Valentina Rojas</TableCell>
                <TableCell>Market Leader B1.2</TableCell>
                <TableCell className="font-mono tabular-nums">28 / 60</TableCell>
                <TableCell className="font-mono tabular-nums">28 abr · 18:00</TableCell>
                <TableCell className="text-right">
                  <Badge variant="teal">
                    <BadgeDot />
                    Activa
                  </Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Joaquín Cisneros</TableCell>
                <TableCell>Business Result B2.1</TableCell>
                <TableCell className="font-mono tabular-nums">41 / 80</TableCell>
                <TableCell className="font-mono tabular-nums">28 abr · 17:00</TableCell>
                <TableCell className="text-right">
                  <Badge variant="teal">
                    <BadgeDot />
                    En vivo
                  </Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Sebastián Mantilla</TableCell>
                <TableCell>Time Zones A2.1</TableCell>
                <TableCell className="font-mono tabular-nums">38 / 40</TableCell>
                <TableCell className="font-mono tabular-nums">26 abr · 16:30</TableCell>
                <TableCell className="text-right">
                  <Badge variant="warning">
                    <BadgeDot />
                    Por renovar
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Block>
      </Section>

      {/* 04 FORMULARIOS */}
      <Section id="formularios" num="04" title="Formularios" subtitle="& entrada de datos.">
        <Block name="15 · Botones" desc="Primary · Teal · Ghost · Link · Danger">
          <div className="flex flex-wrap gap-3">
            <Button>Guardar cambios</Button>
            <Button variant="teal">
              <Plus />
              Nueva clase
            </Button>
            <Button variant="ghost">
              <Download />
              Exportar
            </Button>
            <Button variant="link">Ver todo</Button>
            <Button variant="danger">
              <Trash2 />
              Eliminar
            </Button>
            <Button disabled>Procesando…</Button>
          </div>
          <Separator variant="dashed" className="my-4 w-full" />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Pequeño</Button>
            <Button>Default</Button>
            <Button size="lg">Grande</Button>
            <Button variant="ghost" size="icon" title="Editar">
              <Edit3 />
            </Button>
            <Button variant="ghost" size="icon" title="Más">
              <MoreHorizontal />
            </Button>
          </div>
        </Block>

        <Block name="16 · Inputs" desc="Default · con icono · error · disabled · textarea">
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
            <FieldStack label="Nombre">
              <Input placeholder="Carolina Monsalve" />
            </FieldStack>
            <FieldStack label="Correo">
              <Input icon={Mail} placeholder="nombre@empresa.com" />
            </FieldStack>
            <FieldStack label="Documento" error="Cédula inválida — debe contener solo números.">
              <Input defaultValue="0991234X" aria-invalid="true" />
            </FieldStack>
            <FieldStack label="Notas internas">
              <Textarea placeholder="Comentarios para el equipo…" />
            </FieldStack>
            <FieldStack label="Sólo lectura">
              <Input defaultValue="ID 04217" disabled />
            </FieldStack>
            <FieldStack label="Buscar">
              <Input icon={Search} placeholder="Estudiante, clase, prueba…" />
            </FieldStack>
          </div>
        </Block>

        <Block name="17 · Select" desc="Picker estilizado">
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
            <FieldStack label="Modalidad">
              <Select>
                <option>Virtual · 1 a 1</option>
                <option>Virtual · Grupo</option>
                <option>Presencial · 1 a 1</option>
                <option>Presencial · Grupo</option>
              </Select>
            </FieldStack>
            <FieldStack label="Programa">
              <Select>
                <option>Market Leader Intermediate</option>
                <option>Business Result Upper-Int.</option>
                <option>Time Zones 2</option>
                <option>Empower B1</option>
              </Select>
            </FieldStack>
            <FieldStack label="Nivel CEFR">
              <Select defaultValue="B1.2">
                <option>A1</option>
                <option>A2</option>
                <option>B1.2</option>
                <option>B2.1</option>
                <option>C1</option>
              </Select>
            </FieldStack>
          </div>
        </Block>

        <Block name="18 · Checkbox & radio" desc="Estados controlados">
          <CheckLabel>
            <Checkbox defaultChecked />
            Mantener sesión iniciada
          </CheckLabel>
          <CheckLabel>
            <Checkbox />
            Notificarme por correo
          </CheckLabel>
          <CheckLabel>
            <Radio name="r" defaultChecked />
            Virtual
          </CheckLabel>
          <CheckLabel>
            <Radio name="r" />
            Presencial
          </CheckLabel>
        </Block>

        <Block name="19 · Switch" desc="Preferencias binarias">
          <CheckLabel>
            <Switch defaultChecked />
            Resumen semanal
          </CheckLabel>
          <CheckLabel>
            <Switch />
            Grabación de clase
          </CheckLabel>
          <CheckLabel>
            <Switch defaultChecked />
            Cierre automático
          </CheckLabel>
        </Block>

        <Block name="21 · Tags / chips" desc="Filtros activos · keywords">
          <Tag>B1 — B2</Tag>
          <Tag onRemove={() => {}}>Virtual</Tag>
          <Tag onRemove={() => {}}>Business</Tag>
          <Tag onRemove={() => {}}>Quito</Tag>
          <Button variant="ghost" size="sm">
            <Plus />
            Agregar
          </Button>
        </Block>
      </Section>

      {/* 05 FEEDBACK */}
      <Section id="feedback" num="05" title="Feedback" subtitle="& estado.">
        <Block name="22 · Badges" desc="Default · solid · semánticos · con dot">
          <Badge>Borrador</Badge>
          <Badge variant="solid">Cerrada</Badge>
          <Badge variant="teal">
            <BadgeDot />
            Activa
          </Badge>
          <Badge variant="warning">
            <BadgeDot />
            Por renovar
          </Badge>
          <Badge variant="danger">
            <BadgeDot />
            Vencida
          </Badge>
          <Badge variant="info">
            <BadgeDot />
            En revisión
          </Badge>
          <Badge>7</Badge>
          <Badge variant="teal">142</Badge>
        </Block>

        <Block name="23 · Alerts" desc="Inline · 5 variantes" stack>
          <Alert
            icon={<Info />}
            title="Cambio de horario"
            description="El sistema actualizó tu disponibilidad para esta semana."
            onDismiss={() => {}}
          />
          <Alert
            variant="teal"
            icon={<CheckCircle />}
            title="Postulación enviada"
            description="Recibirás respuesta en un plazo de 5 a 7 días hábiles."
          />
          <Alert
            variant="warn"
            icon={<AlertTriangle />}
            title="Quedan 2 horas del programa"
            description="Coordina la renovación de Sebastián Mantilla antes del 02 may."
          />
          <Alert
            variant="danger"
            icon={<AlertOctagon />}
            title="Clase cancelada"
            description="D. Vela canceló su clase de las 19:00 — necesita ser reprogramada."
          />
          <Alert
            variant="info"
            icon={<Bell />}
            title="Recordatorio"
            description="3 postulaciones esperan tu revisión."
          />
        </Block>

        <Block name="24 · Empty state" desc="Cuando una lista no tiene contenido" stack>
          <EmptyState
            icon={Inbox}
            title="Sin postulaciones nuevas"
            description="Cuando alguien postule, vas a verlo acá. Mientras, podés revisar las archivadas."
            action={
              <Button variant="ghost" size="sm">
                <CheckSquare />
                Ver archivadas
              </Button>
            }
          />
        </Block>

        <Block name="25 · Skeleton" desc="Loading state" stack>
          <Skeleton style={{ width: "40%" }} />
          <Skeleton style={{ width: "80%" }} />
          <Skeleton style={{ width: "65%" }} />
          <div className="flex items-center gap-3.5 pt-2">
            <Skeleton className="!h-9 !w-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton style={{ width: "30%" }} />
              <Skeleton className="!h-2.5" style={{ width: "60%" }} />
            </div>
          </div>
        </Block>

        <Block name="27 · Tooltip" desc="Sobre hover de un control">
          <div className="flex flex-wrap gap-3 pt-6">
            <Tooltip>⌘K para buscar</Tooltip>
            <Tooltip>Renovar contrato</Tooltip>
            <Tooltip>Hace 12 minutos</Tooltip>
          </div>
        </Block>
      </Section>

      {/* 07 DOMINIO */}
      <Section id="dominio" num="07" title="Dominio" subtitle="académico.">
        <Block name="31 · Chip de nivel CEFR" desc="A1 · A2 · B1 · B2 · C1 · C2 + sub-niveles">
          <Tag>A1</Tag>
          <Tag>A2.1</Tag>
          <Tag className="!border-info/35 !bg-info/10 !text-info">B1.2</Tag>
          <Tag className="!border-teal-500/35 !bg-teal-500/10 !text-teal-500">B2.1</Tag>
          <Tag className="!border-warning/35 !bg-warning/10 !text-warning">C1.1</Tag>
        </Block>

        <Block name="32 · Modalidad" desc="Virtual · Presencial · 1 a 1 · Grupo · Corporativo">
          <Badge>
            <Video size={13} strokeWidth={1.6} />
            Virtual · 1 a 1
          </Badge>
          <Badge>
            <Video size={13} strokeWidth={1.6} />
            Virtual · Grupo
          </Badge>
          <Badge>
            <Building2 size={13} strokeWidth={1.6} />
            Virtual · Corporativo
          </Badge>
          <Badge>
            <MapPin size={13} strokeWidth={1.6} />
            Presencial · 1 a 1
          </Badge>
          <Badge>
            <Users size={13} strokeWidth={1.6} />
            Presencial · Grupo
          </Badge>
        </Block>

        <Block name="33 · Medidor CEFR" desc="Posición actual del estudiante" stack>
          <div className="w-full">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
                Valentina Rojas
              </span>
              <span className="font-mono text-[12.5px]">B1.2 — Intermedio</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {[true, true, true, false, false, false].map((on, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-sm",
                    on ? "bg-teal-500" : "border-border bg-background border",
                    on && i === 2 && "opacity-85",
                  )}
                />
              ))}
            </div>
            <div className="text-text-3 mt-1.5 grid grid-cols-6 gap-1 font-mono text-[10.5px] tracking-[0.04em]">
              <span>A1</span>
              <span>A2</span>
              <span>B1</span>
              <span>B2</span>
              <span>C1</span>
              <span>C2</span>
            </div>
          </div>
        </Block>

        <Block name="34 · Avance por unidad" desc="Programa de 12u · U4 en curso" stack>
          <div className="grid w-full grid-cols-12 gap-1">
            {Array.from({ length: 12 }).map((_, i) => {
              const n = i + 1
              const done = n <= 3
              const active = n === 4
              return (
                <div
                  key={n}
                  className={cn(
                    "grid h-6 place-items-center rounded-sm font-mono text-[10px]",
                    done && "bg-teal-500 text-white",
                    active && "border border-teal-500 bg-teal-500/15 text-teal-500",
                    !done && !active && "border-border bg-background text-text-3 border",
                  )}
                >
                  {n}
                </div>
              )
            })}
          </div>
        </Block>
      </Section>

      {/* 08 NAVEGACIÓN */}
      <Section id="navegacion" num="08" title="Navegación" subtitle="& wayfinding.">
        <Block name="36 · Breadcrumbs" desc="Página actual en Fraunces italic">
          <div className="text-text-3 flex items-center gap-2.5 text-[13px]">
            <a href="#" className="text-text-3 hover:text-foreground transition-colors">
              Admin
            </a>
            <span className="text-text-4">/</span>
            <a href="#" className="text-text-3 hover:text-foreground transition-colors">
              Estudiantes
            </a>
            <span className="text-text-4">/</span>
            <span className="text-foreground font-serif italic">Valentina Rojas</span>
          </div>
        </Block>

        <Block name="37 · Tabs" desc="Subnavegación · borde inferior teal" stack>
          <Tabs defaultValue="resumen">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="clases">
                Clases <Badge className="ml-1.5">28</Badge>
              </TabsTrigger>
              <TabsTrigger value="pruebas">Pruebas</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="notas">Notas</TabsTrigger>
            </TabsList>
            <TabsContent value="resumen" className="text-text-3 text-[13px]">
              Contenido del tab activo aparece debajo.
            </TabsContent>
            <TabsContent value="clases">Clases</TabsContent>
            <TabsContent value="pruebas">Pruebas</TabsContent>
            <TabsContent value="documentos">Documentos</TabsContent>
            <TabsContent value="notas">Notas</TabsContent>
          </Tabs>
        </Block>

        <Block name="38 · Paginación" desc="Para tablas largas">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-text-3 font-mono text-[12.5px]">Mostrando 1 — 12 de 142</span>
            <Pagination>
              <PaginationPrev />
              <PaginationItem isCurrent>1</PaginationItem>
              <PaginationItem>2</PaginationItem>
              <PaginationItem>3</PaginationItem>
              <PaginationEllipsis />
              <PaginationItem>12</PaginationItem>
              <PaginationNext />
            </Pagination>
          </div>
        </Block>
      </Section>
    </main>
  )
}

// =============================================================================
//  Helpers locales
// =============================================================================

function cn(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ")
}

function Section({
  id,
  num,
  title,
  subtitle,
  children,
}: {
  id: string
  num: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="border-border mt-14 border-t pt-7 first:mt-0 first:border-t-0 first:pt-0"
    >
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-6">
        <div>
          <p className="text-text-3 font-mono text-[12px] tracking-[0.06em]">SECCIÓN / {num}</p>
          <h2 className="m-0 font-serif text-[28px] font-normal tracking-[-0.02em]">
            {title}
            <span className="text-text-2 font-light italic"> {subtitle}</span>
          </h2>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Block({
  name,
  desc,
  children,
  stack,
}: {
  name: string
  desc?: string
  children: React.ReactNode
  stack?: boolean
}) {
  return (
    <div className="border-border bg-surface overflow-hidden rounded-2xl border">
      <div className="border-border bg-surface-alt flex flex-wrap items-baseline justify-between gap-3 border-b px-5 py-3.5">
        <span className="text-foreground font-mono text-[12px] tracking-[0.04em]">{name}</span>
        {desc && <span className="text-text-3 text-right text-[12.5px]">{desc}</span>}
      </div>
      <div
        className={cn(
          "bg-surface flex px-5 py-6",
          stack ? "flex-col gap-3.5" : "flex-wrap items-center gap-3.5",
        )}
      >
        {children}
      </div>
    </div>
  )
}

function TypeRow({ meta, children }: { meta: string; children: React.ReactNode }) {
  return (
    <div className="border-border grid w-full grid-cols-[120px_1fr] items-baseline gap-6 border-b border-dashed py-3.5 last:border-b-0">
      <div className="text-text-3 font-mono text-[11px] leading-[1.6] tracking-[0.04em]">
        {meta}
      </div>
      <div className="text-foreground">{children}</div>
    </div>
  )
}

function FieldStack({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <span className="text-danger text-[11.5px]">{error}</span>}
    </div>
  )
}

function BarRow({
  label,
  value,
  suffix,
  variant,
}: {
  label: string
  value: number
  suffix: string
  variant?: "warn" | "danger" | "info"
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[12px]">
        <span className="text-text-3 font-mono text-[11px] tracking-[0.06em] uppercase">
          {label}
        </span>
        <span className="font-mono">
          {value}% — {suffix}
        </span>
      </div>
      <ProgressBar value={value} variant={variant} />
    </div>
  )
}
