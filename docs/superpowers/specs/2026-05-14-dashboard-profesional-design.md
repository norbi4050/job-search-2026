# Dashboard Profesional — Consultorio Inteligente

## Contexto

Reemplaza el dashboard Tooljet actual por una web propia alojada en EasyPanel. Tooljet tiene aspecto amateur y baja la percepción de calidad del sistema. El nuevo dashboard es Next.js 14, dark theme estilo GitHub/Linear, con auth real por roles y conversaciones en tiempo real.

Se integra con el stack existente sin modificar la lógica de negocio: lee de Supabase, escribe via webhooks n8n (WF-DASH-1/2/3/4). Se agrega al kit de instalación como un contenedor Docker más — un deploy por cliente, parametrizado por env vars.

---

## Stack técnico

- **Framework:** Next.js 14 (App Router, SSR)
- **UI:** shadcn/ui + Tailwind CSS — dark theme
- **Auth:** Supabase Auth — sesiones JWT, roles en `user_metadata`
- **Base de datos:** Supabase (existente) — lectura directa vía `@supabase/supabase-js`
- **Realtime:** Supabase Realtime WebSocket — tabs "Atenciones" y "En vivo"
- **Escritura:** Webhooks n8n (WF-DASH-1/2/3/4) con header auth
- **Deploy:** Docker (Node 18 Alpine) → EasyPanel, puerto 3000
- **Kit:** `consultorio-kit/dashboard/` — Dockerfile + README

---

## Roles y permisos

Tres roles definidos en `user_metadata.role` de Supabase Auth. Un solo login — el rol se detecta automáticamente al iniciar sesión.

| Sección | dueño | secretaria | médico |
|---|---|---|---|
| Hoy (todos los turnos) | ✓ | ✓ | Solo los suyos |
| Semana | ✓ | ✓ | Solo los suyos |
| Atenciones en curso | ✓ ver | ✓ ver + responder | — |
| Pacientes (CRUD) | ✓ | ✓ | — |
| Conversaciones en vivo | ✓ | — | — |
| Analytics | ✓ | — | — |
| Cancelar / modificar turno | ✓ | ✓ | Solo los suyos |

El médico filtra por `profesional_id` que coincide con su `user_metadata.profesional_id`.

---

## Tabs

### 1. Hoy (`/dashboard`)
- Stat cards: Confirmados / Pendientes / Cancelados / En atención
- Tabla de turnos del día ordenada por hora: paciente, especialidad, estado, acción
- Rol `médico`: tabla filtrada por `profesional_id = user_metadata.profesional_id` — no ve turnos de otros médicos
- Botón "+ Nuevo turno" → modal (WF-DASH-3 crear paciente + turno) — oculto para rol `médico`
- Click en fila → modal detalle con opción cancelar (WF-DASH-1) o generar link check-in (WF-DASH-2)
- Actualización vía Supabase Realtime en `consultorio_turnos` (sin polling)

### 2. Semana (`/dashboard/semana`)
- Misma tabla filtrada por `fecha_hora` entre hoy y +7 días
- Agrupada por día con separadores de fecha
- Rol `médico`: mismo filtro por `profesional_id` que en Hoy
- Sin nuevas llamadas — misma lógica y componentes que Hoy

### 3. Atenciones en curso (`/dashboard/atenciones`)
- Lista de conversaciones con `handoff_humano = true` (Supabase Realtime)
- Panel derecho: nombre, teléfono, contexto del `ctx` (turno próximo, obra social, último mensaje)
- Área de respuesta: textarea + botón "Enviar" → POST a WF-DASH-4 (nuevo webhook, ver sección n8n)
- Botón "Cerrar atención" → PATCH en Supabase `handoff_humano = false` + mensaje de cierre vía WF-DASH-4
- Badge contador en sidebar se actualiza en tiempo real

### 4. Pacientes (`/dashboard/pacientes`)
- Tabla paginada de `consultorio_pacientes`: nombre, DNI, teléfono, obra social
- Buscador por nombre o DNI (filtro client-side)
- Modal edición inline (PATCH directo a Supabase con anon key + RLS)
- Sin eliminar pacientes — solo edición de datos

### 5. Conversaciones en vivo (`/dashboard/en-vivo`)
- Solo visible para rol `dueño`
- Lista de conversaciones activas (estado ≠ 'inicio', updated_at < 30 min) — Supabase Realtime
- Dot de color por estado: verde (agendando), amarillo (pendiente/adelanto), azul (inicio/confirmado)
- Panel derecho: hilo de mensajes de `consultorio_mensajes` para ese `telefono_wa`
- Vista solo lectura — footer "Sofia está respondiendo automáticamente"
- Mensajes nuevos aparecen en tiempo real vía Supabase Realtime en `consultorio_mensajes`

### 6. Analytics (`/dashboard/analytics`)
- Solo visible para rol `dueño`
- Selector período: 7 días / este mes / 3 meses
- **ROI card hero:** turnos recuperados × valor consulta / costo mensual sistema
- **Métricas hero:** Tasa no-shows (%) / Turnos confirmados por bot / Adelantos de turno
- Gráfico barras no-shows por semana (con línea de referencia "antes del sistema" = 20%)
- Gráfico barras actividad bot: recordatorios / reservas / cancelaciones / handoffs
- Mini stats: tiempo respuesta promedio / % completaron flujo / pacientes nuevos / llamadas Sofia
- Todos los datos calculados con SQL agregado desde Supabase (no métricas hardcodeadas)

---

## Nueva tabla: `consultorio_mensajes`

```sql
CREATE TABLE consultorio_mensajes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono_wa TEXT NOT NULL,
  direccion   TEXT NOT NULL CHECK (direccion IN ('entrada', 'salida')),
  contenido   TEXT NOT NULL,
  estado_bot  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mensajes_telefono ON consultorio_mensajes(telefono_wa, created_at DESC);
```

**Cómo se llena:** parche en WF01 Gateway y WF02 Bot — agregar un INSERT a `consultorio_mensajes` en dos momentos:
1. Al recibir mensaje del paciente (`direccion = 'entrada'`)
2. Antes de cada `sendText()` saliente (`direccion = 'salida'`), guardando también el `estado_bot` actual del contexto

El INSERT usa la `SUPABASE_SERVICE_KEY` que ya está disponible en n8n como env var.

---

## Nuevo webhook: WF-DASH-4 Responder Handoff

La secretaria puede responder al paciente desde el tab "Atenciones". Requiere un nuevo workflow n8n:

- **Endpoint:** `POST /webhook/dashboard-responder` con header `X-Dashboard-Key`
- **Body:** `{ telefono_wa, mensaje, cerrar? }`
- **Lógica:** envía WhatsApp vía Graph API + si `cerrar=true` hace PATCH `handoff_humano=false` en `consultorio_conversaciones`
- **Se agrega al kit** como `WF-DASH-4-responder-handoff.json`

---

## Deployment

### Dockerfile (en `consultorio-kit/dashboard/Dockerfile`)

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### Variables de entorno requeridas (EasyPanel)

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase del cliente |
| `SUPABASE_ANON_KEY` | Clave pública (RLS activo) |
| `NEXTAUTH_SECRET` | String random 32 chars |
| `NEXTAUTH_URL` | URL pública del dashboard en EasyPanel |
| `N8N_WEBHOOK_BASE` | URL base del n8n del cliente |
| `N8N_DASHBOARD_KEY` | Header auth para WF-DASH-* |
| `CONSULTORIO_NOMBRE` | Nombre que aparece en sidebar y login |
| `CONSULTORIO_LOGO_URL` | Logo del cliente (opcional) |

### Incorporación al kit

- `consultorio-kit/dashboard/` — proyecto Next.js completo
- `consultorio-kit/dashboard/Dockerfile`
- `consultorio-kit/n8n/WF-DASH-4-responder-handoff.json`
- `consultorio-kit/schema.sql` — agregar `consultorio_mensajes`
- `consultorio-kit/checklist.md` — pasos de deploy del dashboard

---

## Integración con stack existente

| Operación | Cómo | Workflow |
|---|---|---|
| Cancelar turno | POST webhook | WF-DASH-1 (existente) |
| Generar link check-in | POST webhook | WF-DASH-2 (existente) |
| Crear paciente/turno | POST webhook | WF-DASH-3 (existente) |
| Responder handoff | POST webhook | WF-DASH-4 (nuevo) |
| Leer turnos/pacientes | SELECT Supabase | directo con anon key + RLS |
| Leer conversaciones | SELECT + Realtime | directo con anon key + RLS |
| Leer mensajes | SELECT + Realtime | directo con anon key + RLS |

---

## Diferenciación competitiva (vs. Keebot y similares)

El tab Analytics muestra las métricas que ninguna plataforma genérica puede ofrecer:
- **ROI calculado** en pesos argentinos, específico del consultorio
- **Reducción de no-shows** medida desde el inicio del sistema (benchmark 20% → objetivo <5%)
- **Adelantos de turno** — funcionalidad propia, no existe en competidores
- **Llamadas Sofia (voz)** — Keebot es solo texto, nosotros tenemos voz integrada

Estas métricas son el argumento de venta principal para el siguiente cliente — el médico le muestra el dashboard a un colega y se vende solo.

---

## Fuera de scope (v1)

- Gestión de agenda / bloqueo de horarios por médico (v2)
- Exportar reportes PDF/CSV
- Configuración del bot desde el dashboard
- Notificaciones push al browser
- App mobile
