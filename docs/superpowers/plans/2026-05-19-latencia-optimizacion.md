# Optimización de Latencia — Consultorio Inteligente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir la latencia de respuesta del bot de WhatsApp de ~2-3 segundos a ~1-1.5 segundos mediante optimizaciones de código (Fase A) y migración de Supabase a São Paulo (Fase B).

**Architecture:** Fase A modifica `wf02_code.js` con tres cambios independientes (keyword pre-filter, Promise.all, cache paciente) más un índice SQL. Fase B crea un nuevo proyecto Supabase en sa-east-1, migra solo las tablas `consultorio_*`, y actualiza todos los workflows con nuevas env vars (`CONSULTORIO_SUPABASE_URL` / `CONSULTORIO_SUPABASE_KEY`) sin tocar el proyecto actual que usan otros workflows.

**Tech Stack:** Node.js, n8n v2.19.5, Supabase REST API, WhatsApp Cloud API, deploy vía n8n REST API (JWT en `deploy_wf02.js`).

---

## Archivos modificados

| Archivo | Fase | Cambio |
|---|---|---|
| `C:/Users/noyag/wf02_code.js` | A + B | quickClassify, Promise.all, cache paciente, env vars |
| `C:/Users/noyag/wf08_code.js` | B | env vars líneas 6-7 |
| `C:/Users/noyag/wf_cumpleanos_code.js` | B | env vars líneas 1-2 |
| `C:/Users/noyag/wf_reactivacion_code.js` | B | env vars líneas 1-2 |
| `C:/Users/noyag/wf_campanas_code.js` | B | env vars líneas 1-2 |
| `C:/Users/noyag/deploy_wf02.js` | — | sin cambios (usado para deploy) |
| WF01, WF05, WF09, WF-DASH-3 | B | fetch n8n API → replace vars → PUT |
| Supabase proyecto nuevo | B | schema + datos consultorio_* |
| EasyPanel n8n env vars | B | agregar CONSULTORIO_SUPABASE_URL + KEY |
| EasyPanel dashboard env vars | B | actualizar valores Supabase |

---

## FASE A — Optimizaciones de código

---

### Task 1: Índice SQL en consultorio_pacientes.telefono_wa

**Files:**
- Supabase proyecto `xorjkjaimeampfdiichs`

- [ ] **Step 1: Aplicar el índice**

Usar MCP Supabase `execute_sql` con `project_id: "xorjkjaimeampfdiichs"`:

```sql
CREATE INDEX IF NOT EXISTS idx_pacientes_telefono 
ON consultorio_pacientes (telefono_wa);
```

- [ ] **Step 2: Verificar que el índice existe**

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'consultorio_pacientes' 
AND indexname = 'idx_pacientes_telefono';
```

Expected: 1 row con `indexname = 'idx_pacientes_telefono'`.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/noyag/Norberto-Documentos"
git add -A
git commit -m "feat(db): add index on consultorio_pacientes.telefono_wa"
```

---

### Task 2: Agregar quickClassify en wf02_code.js

**Files:**
- Modify: `C:/Users/noyag/wf02_code.js` (alrededor de línea 327)

- [ ] **Step 1: Leer la función classifyInput actual**

Leer líneas 327-335 de `C:/Users/noyag/wf02_code.js` para confirmar el punto de inserción exacto.

- [ ] **Step 2: Insertar quickClassify justo antes de classifyInput**

Agregar esta función entre la línea 326 (`}` de `askClaude`) y la línea 327 (`async function classifyInput`):

```js
function quickClassify(texto) {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/\b(cancelar|cancela|cancelacion|cancelar turno)\b/.test(t))
    return { intent: 'cancelar', sentiment: 'ok', confidence: 'alta' };
  if (/\b(turno|sacar turno|quiero turno|pedir turno|reservar|agendar|necesito turno)\b/.test(t))
    return { intent: 'turno', sentiment: 'ok', confidence: 'alta' };
  if (/\b(mis turnos|ver turno|tengo turno|cuando es|cuando tengo|proxim)\b/.test(t))
    return { intent: 'consultar', sentiment: 'ok', confidence: 'alta' };
  if (/\b(horario|atiende|dias|precio|costo|obra social|cuanto sale|cuanto cuesta)\b/.test(t))
    return { intent: 'pregunta', sentiment: 'ok', confidence: 'alta' };
  return null;
}
```

- [ ] **Step 3: Modificar classifyInput para llamar quickClassify primero**

Dentro de `async function classifyInput(texto, estadoActual)`, insertar al inicio del bloque `try`:

```js
async function classifyInput(texto, estadoActual) {
  try {
    const quick = quickClassify(texto);
    if (quick) return quick;
    // ... resto del código existente sin cambios (llamada a askClaude)
```

- [ ] **Step 4: Verificar con grep**

```bash
grep -n "quickClassify" C:/Users/noyag/wf02_code.js
```

Expected: 2 líneas — la definición de función y la llamada dentro de classifyInput.

---

### Task 3: Promise.all para lecturas paralelas al inicio del flujo

**Files:**
- Modify: `C:/Users/noyag/wf02_code.js` (líneas 529 y 559)

- [ ] **Step 1: Leer el bloque de inicio del flujo principal**

Leer líneas 519-580 de `C:/Users/noyag/wf02_code.js` para confirmar posiciones exactas.

- [ ] **Step 2: Reemplazar la lectura secuencial inicial por Promise.all**

Encontrar:
```js
// Race condition guard: re-fetch state and claim lock before processing
const freshConv = await supaGet('consultorio_conversaciones', { telefono_wa: `eq.${phone}`, select: 'estado,contexto,updated_at' });
```

Reemplazar con:
```js
// Race condition guard + prefetch paciente en paralelo (ahorro ~90ms)
const _initialCtx = data.convContexto || {};
const [freshConv, _pacPrefetch] = await Promise.all([
  supaGet('consultorio_conversaciones', { telefono_wa: `eq.${phone}`, select: 'estado,contexto,updated_at' }),
  _initialCtx.pacienteCache
    ? Promise.resolve(null)
    : supaGet('consultorio_pacientes', { telefono_wa: `eq.${phone}`, select: 'id,nombre,obra_social,fecha_nacimiento,dni' })
]);
```

- [ ] **Step 3: Confirmar que la línea siguiente no necesita cambio**

La línea `const freshState = freshConv?.[0];` ya funciona correctamente — `freshConv` sigue siendo el mismo nombre. Sin cambio.

- [ ] **Step 4: Usar _pacPrefetch en el handler confirmar (línea ~559)**

Encontrar:
```js
const pac = await supaGet('consultorio_pacientes', { telefono_wa: `eq.${phone}`, select: 'id' });
```

Reemplazar con:
```js
const pac = (_pacPrefetch?.length) ? _pacPrefetch : await supaGet('consultorio_pacientes', { telefono_wa: `eq.${phone}`, select: 'id' });
```

- [ ] **Step 5: Verificar que el archivo sigue siendo JS válido**

```bash
node --check C:/Users/noyag/wf02_code.js 2>&1
```

Expected: sin output (sin errores de sintaxis).

---

### Task 4: Cache de paciente en ctx

**Files:**
- Modify: `C:/Users/noyag/wf02_code.js` (líneas 725-730)

- [ ] **Step 1: Leer el handler esperando_dni donde se identifica el paciente**

Leer líneas 724-730 de `C:/Users/noyag/wf02_code.js` para confirmar el punto exacto donde `pacs[0]` se asigna a `ctx`.

- [ ] **Step 2: Agregar pacienteCache en ctx después de identificar al paciente**

Encontrar:
```js
const pacs = await supaGet('consultorio_pacientes', { dni: `eq.${dni}`, select: '*' });
  if (pacs?.length > 0) {
    const p = pacs[0];
    ctx = { ...ctx, pacienteId: p.id, pacienteNombre: p.nombre, dni, obraSocial: p.obra_social, esRecurrente: true, retry_count: 0 };
```

Reemplazar con:
```js
const pacs = await supaGet('consultorio_pacientes', { dni: `eq.${dni}`, select: '*' });
  if (pacs?.length > 0) {
    const p = pacs[0];
    ctx = { ...ctx, pacienteId: p.id, pacienteNombre: p.nombre, dni, obraSocial: p.obra_social, esRecurrente: true, retry_count: 0,
      pacienteCache: { id: p.id, nombre: p.nombre, obra_social: p.obra_social, fecha_nacimiento: p.fecha_nacimiento, dni: p.dni }
    };
```

- [ ] **Step 3: Invalidar cache cuando el estado vuelve a inicio**

Buscar todas las llamadas `updateConv(phone, 'inicio', {})` (ctx vacío) en el archivo:

```bash
grep -n "updateConv.*inicio.*{}" C:/Users/noyag/wf02_code.js
```

Para cada una, el ctx vacío `{}` ya descarta `pacienteCache` — no se necesitan cambios adicionales. Confirmar visualmente que ninguna pasa el viejo ctx con cache.

- [ ] **Step 4: Verificar sintaxis**

```bash
node --check C:/Users/noyag/wf02_code.js 2>&1
```

Expected: sin output.

---

### Task 5: Deploy Fase A y validar

**Files:**
- `C:/Users/noyag/deploy_wf02.js` (sin cambios — solo se ejecuta)

- [ ] **Step 1: Deploy WF02**

```bash
node C:/Users/noyag/deploy_wf02.js
```

Expected: `✅ WF02 actualizado exitosamente` (o similar según el script).

- [ ] **Step 2: Validar keyword pre-filter**

Enviar mensaje de WhatsApp al número demo (`5491137936325`) con texto `"quiero cancelar"`.

Verificar en n8n → Executions → WF02:
- El execution completó sin error
- En el log de ejecución, el nodo Code debe haber retornado respuesta en < 1.5 segundos total

- [ ] **Step 3: Validar que mensajes ambiguos siguen usando Claude Haiku**

Enviar mensaje `"quiero saber si puedo"`.
Verificar que classifyInput fue llamado (no se cortocircuitó con quickClassify) y respondió correctamente.

- [ ] **Step 4: Commit Fase A**

```bash
cd "C:/Users/noyag/Norberto-Documentos"
git add -A
git commit -m "feat(wf02): latencia fase A — quickClassify + Promise.all + cache paciente"
```

---

## FASE B — Migración Supabase a sa-east-1

> **IMPORTANTE:** La Fase B requiere una ventana de downtime de ~3 minutos al momento de actualizar env vars (Step B5). Planificar en horario de baja actividad (ej: madrugada o fin de semana). Los pasos B1-B4 se pueden hacer sin downtime.

---

### Task 6: Crear nuevo proyecto Supabase en sa-east-1

**Este paso es manual — realizarlo en supabase.com.**

- [ ] **Step 1: Crear el proyecto**

Ir a `https://supabase.com/dashboard/new/wltwbugiijsueriyzols`:
- Name: `Consultorio Inteligente`
- Region: **South America (São Paulo)** — `sa-east-1`
- Database password: elegir y guardar en un lugar seguro

- [ ] **Step 2: Esperar que el proyecto esté listo**

El dashboard muestra "Project is provisioning..." — esperar hasta que diga "Your project is ready" (~2 minutos).

- [ ] **Step 3: Anotar las credenciales del nuevo proyecto**

Ir a Settings → API y copiar:
- Project URL: `https://<nuevo-ref>.supabase.co`
- anon key (public)
- service_role key (secret)

Guardar temporalmente — se usan en Tasks 8, 9, 10.

- [ ] **Step 4: Anotar el nuevo project_id**

Usar MCP Supabase `list_projects` para obtener el `id` del nuevo proyecto y usarlo en los siguientes tasks.

---

### Task 7: Aplicar schema al nuevo proyecto

**Files:**
- Nuevo proyecto Supabase en sa-east-1

- [ ] **Step 1: Extraer definición de columnas del proyecto actual**

Ejecutar en proyecto actual (`xorjkjaimeampfdiichs`) via MCP `execute_sql`:

```sql
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name,
  column_default,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name LIKE 'consultorio_%'
ORDER BY table_name, ordinal_position;
```

- [ ] **Step 2: Extraer constraints y foreign keys**

```sql
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
WHERE tc.table_schema = 'public'
AND tc.table_name LIKE 'consultorio_%'
ORDER BY tc.table_name, tc.constraint_type;
```

- [ ] **Step 3: Extraer índices del proyecto actual**

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename LIKE 'consultorio_%'
ORDER BY tablename, indexname;
```

- [ ] **Step 4: Extraer RLS policies**

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename LIKE 'consultorio_%'
ORDER BY tablename, policyname;
```

- [ ] **Step 5: Crear tablas en el nuevo proyecto**

Con la información de los pasos anteriores, aplicar via MCP `apply_migration` en el nuevo proyecto el siguiente DDL (en este orden exacto para respetar foreign keys):

```sql
-- 1. consultorio_profesionales
CREATE TABLE IF NOT EXISTS consultorio_profesionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  especialidad TEXT NOT NULL,
  consultorio TEXT,
  duracion_turno_min INTEGER DEFAULT 30,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. consultorio_pacientes
CREATE TABLE IF NOT EXISTS consultorio_pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  telefono_wa TEXT UNIQUE,
  dni TEXT UNIQUE,
  obra_social TEXT,
  fecha_nacimiento DATE,
  ultima_reactivacion DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. consultorio_conversaciones
CREATE TABLE IF NOT EXISTS consultorio_conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono_wa TEXT UNIQUE NOT NULL,
  estado TEXT DEFAULT 'inicio',
  contexto JSONB DEFAULT '{}',
  handoff_humano BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. consultorio_turnos
CREATE TABLE IF NOT EXISTS consultorio_turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES consultorio_pacientes(id),
  profesional_id UUID REFERENCES consultorio_profesionales(id),
  fecha_hora TIMESTAMPTZ NOT NULL,
  estado TEXT DEFAULT 'agendado',
  tipo_pago TEXT,
  booking_token TEXT,
  check_in_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. consultorio_horarios_profesional
CREATE TABLE IF NOT EXISTS consultorio_horarios_profesional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_id UUID REFERENCES consultorio_profesionales(id),
  dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL
);

-- 6. consultorio_waitlist
CREATE TABLE IF NOT EXISTS consultorio_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES consultorio_pacientes(id),
  profesional_id UUID REFERENCES consultorio_profesionales(id),
  notificado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. consultorio_feedback
CREATE TABLE IF NOT EXISTS consultorio_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID REFERENCES consultorio_turnos(id),
  calificacion INTEGER CHECK (calificacion BETWEEN 1 AND 10),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. consultorio_mensajes
CREATE TABLE IF NOT EXISTS consultorio_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono_wa TEXT NOT NULL,
  direccion TEXT NOT NULL,
  contenido TEXT,
  estado_bot TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. consultorio_configuracion
CREATE TABLE IF NOT EXISTS consultorio_configuracion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave TEXT UNIQUE NOT NULL,
  valor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. consultorio_campanas
CREATE TABLE IF NOT EXISTS consultorio_campanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  template_key TEXT,
  audiencia_tipo TEXT,
  audiencia_valor TEXT,
  mensaje_custom TEXT,
  estado TEXT DEFAULT 'borrador',
  total_destinatarios INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. consultorio_campana_envios
CREATE TABLE IF NOT EXISTS consultorio_campana_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id UUID REFERENCES consultorio_campanas(id),
  paciente_id UUID REFERENCES consultorio_pacientes(id),
  telefono_wa TEXT,
  tipo TEXT,
  estado TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. consultorio_adelanto_ofertas
CREATE TABLE IF NOT EXISTS consultorio_adelanto_ofertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_id UUID REFERENCES consultorio_profesionales(id),
  paciente_id UUID REFERENCES consultorio_pacientes(id),
  slot_fecha TIMESTAMPTZ,
  estado TEXT DEFAULT 'pendiente',
  expira_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. consultorio_bloqueos
CREATE TABLE IF NOT EXISTS consultorio_bloqueos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_id UUID REFERENCES consultorio_profesionales(id),
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

> **Nota:** Si alguna columna no existe en el DDL anterior pero aparece en los resultados del Step 1, agregarla antes de continuar. El DDL se basa en el schema conocido — verificar contra los resultados reales.

- [ ] **Step 6: Aplicar índices al nuevo proyecto**

```sql
CREATE INDEX IF NOT EXISTS idx_conv_telefono ON consultorio_conversaciones (telefono_wa);
CREATE INDEX IF NOT EXISTS idx_pacientes_telefono ON consultorio_pacientes (telefono_wa);
CREATE INDEX IF NOT EXISTS idx_mensajes_telefono ON consultorio_mensajes (telefono_wa, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_turnos_paciente ON consultorio_turnos (paciente_id);
CREATE INDEX IF NOT EXISTS idx_turnos_prof_fecha ON consultorio_turnos (profesional_id, fecha_hora);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_turno_activo ON consultorio_turnos (profesional_id, fecha_hora) WHERE estado NOT IN ('cancelado', 'auto_cancelado');
CREATE UNIQUE INDEX IF NOT EXISTS idx_turnos_checkin_token ON consultorio_turnos (check_in_token);
CREATE INDEX IF NOT EXISTS idx_adelanto_estado ON consultorio_adelanto_ofertas (estado);
CREATE INDEX IF NOT EXISTS idx_adelanto_expira ON consultorio_adelanto_ofertas (expira_at);
CREATE INDEX IF NOT EXISTS idx_adelanto_slot ON consultorio_adelanto_ofertas (slot_fecha, profesional_id);
```

- [ ] **Step 7: Habilitar RLS en todas las tablas**

```sql
ALTER TABLE consultorio_profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_horarios_profesional ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_campanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_campana_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_adelanto_ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_bloqueos ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 8: Aplicar políticas RLS**

Extraer las políticas del Step 4 y replicarlas en el nuevo proyecto. Si en el proyecto actual todas las tablas solo tienen service_role policy (lo más común en n8n), la política es:

```sql
-- Para cada tabla: permitir acceso completo con service_role
CREATE POLICY "service_role full access" ON consultorio_profesionales 
  FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Repetir para cada tabla...
```

Si las policies son diferentes, usar el resultado del Step 4 para construirlas exactas.

- [ ] **Step 9: Verificar schema aplicado**

MCP `list_tables` en el nuevo proyecto → debe mostrar 13 tablas `consultorio_*`.

---

### Task 8: Migrar datos al nuevo proyecto

**Files:**
- Proyectos Supabase: origen `xorjkjaimeampfdiichs`, destino `<nuevo-id>`

Exportar de origen e importar a destino en el siguiente orden (respetar foreign keys).

- [ ] **Step 1: Migrar consultorio_profesionales**

En proyecto origen — MCP `execute_sql`:
```sql
SELECT id, nombre, especialidad, consultorio, duracion_turno_min, activo, created_at, updated_at 
FROM consultorio_profesionales ORDER BY created_at;
```

Tomar los resultados y ejecutar en proyecto destino:
```sql
INSERT INTO consultorio_profesionales (id, nombre, especialidad, consultorio, duracion_turno_min, activo, created_at, updated_at)
VALUES
  -- pegar filas del resultado anterior
  ('<uuid>', '<nombre>', '<especialidad>', '<consultorio>', <min>, <activo>, '<created_at>', '<updated_at>')
  -- repetir por cada fila
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Migrar consultorio_pacientes**

```sql
-- Origen:
SELECT id, nombre, telefono_wa, dni, obra_social, fecha_nacimiento, ultima_reactivacion, created_at, updated_at 
FROM consultorio_pacientes ORDER BY created_at;
```

INSERT en destino con los mismos campos.

- [ ] **Step 3: Migrar consultorio_conversaciones**

```sql
-- Origen:
SELECT id, telefono_wa, estado, contexto, handoff_humano, created_at, updated_at 
FROM consultorio_conversaciones ORDER BY created_at;
```

INSERT en destino.

- [ ] **Step 4: Migrar consultorio_turnos**

```sql
-- Origen:
SELECT id, paciente_id, profesional_id, fecha_hora, estado, tipo_pago, booking_token, check_in_token, created_at, updated_at 
FROM consultorio_turnos ORDER BY created_at;
```

INSERT en destino.

- [ ] **Step 5: Migrar consultorio_horarios_profesional**

```sql
-- Origen:
SELECT id, profesional_id, dia_semana, hora_inicio, hora_fin 
FROM consultorio_horarios_profesional ORDER BY profesional_id, dia_semana;
```

INSERT en destino.

- [ ] **Step 6: Migrar consultorio_mensajes**

```sql
-- Origen (en batches si hay muchos):
SELECT id, telefono_wa, direccion, contenido, estado_bot, created_at 
FROM consultorio_mensajes ORDER BY created_at;
```

INSERT en destino.

- [ ] **Step 7: Migrar consultorio_configuracion**

```sql
-- Origen:
SELECT id, clave, valor, created_at FROM consultorio_configuracion;
```

INSERT en destino.

- [ ] **Step 8: Migrar consultorio_campana_envios**

```sql
-- Origen:
SELECT id, campana_id, paciente_id, telefono_wa, tipo, estado, created_at 
FROM consultorio_campana_envios ORDER BY created_at;
```

INSERT en destino.

- [ ] **Step 9: Verificar conteos**

En destino, ejecutar:
```sql
SELECT 
  'consultorio_profesionales' AS tabla, COUNT(*) FROM consultorio_profesionales UNION ALL
  SELECT 'consultorio_pacientes', COUNT(*) FROM consultorio_pacientes UNION ALL
  SELECT 'consultorio_conversaciones', COUNT(*) FROM consultorio_conversaciones UNION ALL
  SELECT 'consultorio_turnos', COUNT(*) FROM consultorio_turnos UNION ALL
  SELECT 'consultorio_horarios_profesional', COUNT(*) FROM consultorio_horarios_profesional UNION ALL
  SELECT 'consultorio_mensajes', COUNT(*) FROM consultorio_mensajes UNION ALL
  SELECT 'consultorio_configuracion', COUNT(*) FROM consultorio_configuracion UNION ALL
  SELECT 'consultorio_campana_envios', COUNT(*) FROM consultorio_campana_envios;
```

Expected counts: 5, 22, 31, 15, 21, 129, 1, 16 (±diferencia por mensajes nuevos desde que empezó la migración).

---

### Task 9: Actualizar env vars en código de workflows locales

**Files:**
- Modify: `C:/Users/noyag/wf02_code.js` líneas 8-9
- Modify: `C:/Users/noyag/wf08_code.js` líneas 6-7
- Modify: `C:/Users/noyag/wf_cumpleanos_code.js` líneas 1-2
- Modify: `C:/Users/noyag/wf_reactivacion_code.js` líneas 1-2
- Modify: `C:/Users/noyag/wf_campanas_code.js` líneas 1-2

- [ ] **Step 1: Actualizar wf02_code.js**

Encontrar:
```js
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
```

Reemplazar con:
```js
const SUPABASE_URL = $env.CONSULTORIO_SUPABASE_URL;
const SUPABASE_KEY = $env.CONSULTORIO_SUPABASE_KEY;
```

- [ ] **Step 2: Actualizar wf08_code.js**

Misma sustitución en líneas 6-7.

- [ ] **Step 3: Actualizar wf_cumpleanos_code.js**

Misma sustitución en líneas 1-2.

- [ ] **Step 4: Actualizar wf_reactivacion_code.js**

Misma sustitución en líneas 1-2.

- [ ] **Step 5: Actualizar wf_campanas_code.js**

Misma sustitución en líneas 1-2.

- [ ] **Step 6: Verificar que no quedaron referencias a la env var vieja en archivos locales**

```bash
grep -rn "SUPABASE_URL\|SUPABASE_SERVICE_KEY" \
  C:/Users/noyag/wf02_code.js \
  C:/Users/noyag/wf08_code.js \
  C:/Users/noyag/wf_cumpleanos_code.js \
  C:/Users/noyag/wf_reactivacion_code.js \
  C:/Users/noyag/wf_campanas_code.js
```

Expected: 0 matches (todas cambiadas a `CONSULTORIO_SUPABASE_URL` / `CONSULTORIO_SUPABASE_KEY`).

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/noyag/Norberto-Documentos"
git add -A
git commit -m "feat(wf): usar CONSULTORIO_SUPABASE_URL/KEY en todos los workflows"
```

---

### Task 10: Actualizar workflows inline en n8n (WF01, WF05, WF09, WF-DASH-3)

Estos workflows no tienen archivo local completo — se actualizan via n8n API.

**Credenciales n8n (de deploy_wf02.js):**
- URL: `https://nexo-terra-n8n.6fwciw.easypanel.host`
- JWT: el valor de la constante `JWT` en `C:/Users/noyag/deploy_wf02.js`

- [ ] **Step 1: Crear script helper de deploy genérico**

Crear `C:/Users/noyag/update_wf_supabase_vars.js`:

```js
const https = require('https');
const fs = require('fs');

const N8N_URL = 'nexo-terra-n8n.6fwciw.easypanel.host';
// Copiar JWT desde deploy_wf02.js:
const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ';

const WF_IDS = {
  WF01: 'dVfZYeSsVigWd0cJ',
  WF05: 'oqLjbCu3JJnOLvSK',
  WF09: 'c0m8vnnubPQSGnTe',
  'WF-DASH-3': 'zDJs7JOk16HGsbUJ',
};

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: N8N_URL, port: 443, path, method,
      headers: { 'X-N8N-API-KEY': JWT, 'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    };
    const r = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, body: d }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function replaceSupabaseVars(jsCode) {
  return jsCode
    .replace(/\$env\.SUPABASE_URL/g, '$env.CONSULTORIO_SUPABASE_URL')
    .replace(/\$env\.SUPABASE_SERVICE_KEY/g, '$env.CONSULTORIO_SUPABASE_KEY');
}

const READONLY = ['id','createdAt','updatedAt','versionId','meta','tags'];

async function updateWorkflow(name, wfId) {
  console.log(`\n→ Fetching ${name} (${wfId})...`);
  const { body: wf } = await req('GET', `/api/v1/workflows/${wfId}`);
  
  let changed = 0;
  const nodes = (wf.nodes || []).map(node => {
    if (node.type === 'n8n-nodes-base.code' && node.parameters?.jsCode) {
      const updated = replaceSupabaseVars(node.parameters.jsCode);
      if (updated !== node.parameters.jsCode) {
        changed++;
        return { ...node, parameters: { ...node.parameters, jsCode: updated } };
      }
    }
    return node;
  });
  
  if (changed === 0) {
    console.log(`  ℹ️  Sin referencias a SUPABASE_URL/SERVICE_KEY — skip`);
    return;
  }
  
  console.log(`  ✏️  ${changed} nodo(s) con referencias actualizadas`);
  const payload = { ...wf, nodes };
  READONLY.forEach(k => delete payload[k]);
  
  const { status, body: result } = await req('PUT', `/api/v1/workflows/${wfId}`, payload);
  console.log(`  → PUT status: ${status}`);
  if (status !== 200) console.error('  ❌ Error:', JSON.stringify(result).substring(0, 300));
  else console.log(`  ✅ ${name} actualizado`);
}

(async () => {
  for (const [name, wfId] of Object.entries(WF_IDS)) {
    await updateWorkflow(name, wfId);
  }
  console.log('\n✅ Todos los workflows procesados');
})().catch(console.error);
```

- [ ] **Step 2: Ejecutar el script** *(después de que las env vars estén en EasyPanel — ver Task 11)*

```bash
node C:/Users/noyag/update_wf_supabase_vars.js
```

Expected: 4 workflows procesados, al menos WF01 y WF05 con "✏️ nodo(s) actualizado".

---

### Task 11: Agregar env vars en EasyPanel y actualizar dashboard

> **⚠️ VENTANA DE DOWNTIME — ~3 minutos.** El bot no responde mientras n8n reinicia. Realizar en horario de baja actividad.

- [ ] **Step 1: Agregar env vars en EasyPanel → n8n**

Ir a `https://nexo-terra-n8n.6fwciw.easypanel.host` (panel EasyPanel) → servicio `n8n` → **Environment** → agregar:

| Variable | Valor |
|---|---|
| `CONSULTORIO_SUPABASE_URL` | `https://<nuevo-ref>.supabase.co` |
| `CONSULTORIO_SUPABASE_KEY` | service_role key del nuevo proyecto |

**NO modificar** `SUPABASE_URL` ni `SUPABASE_SERVICE_KEY` existentes.

- [ ] **Step 2: Reiniciar servicio n8n en EasyPanel**

Click "Deploy" o "Restart" en el servicio n8n. Esperar ~30 segundos hasta que esté healthy.

- [ ] **Step 3: Actualizar env vars en dashboard Next.js**

EasyPanel → servicio dashboard → **Environment** → actualizar:

| Variable | Valor nuevo |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<nuevo-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key del nuevo proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key del nuevo proyecto |

- [ ] **Step 4: Reiniciar dashboard en EasyPanel**

Click "Deploy" en el servicio dashboard.

- [ ] **Step 5: Configurar Supabase Auth en el nuevo proyecto**

En `https://supabase.com` → nuevo proyecto → **Authentication** → **URL Configuration**:
- Site URL: `https://nexo-terra-consultorio-rivadavia-dashboard.6fwciw.easypanel.host`
- Redirect URLs: agregar `https://nexo-terra-consultorio-rivadavia-dashboard.6fwciw.easypanel.host/**`

- [ ] **Step 6: Recrear usuario de acceso al dashboard**

En nuevo proyecto → **Authentication** → **Users** → **Invite user** con el email de Carlos (`norbi4050@gmail.com`). Confirmar por email.

---

### Task 12: Deploy de todos los workflows actualizados

- [ ] **Step 1: Deploy WF02**

```bash
node C:/Users/noyag/deploy_wf02.js
```

Expected: success.

- [ ] **Step 2: Crear scripts de deploy para los demás workflows locales**

Para cada workflow, crear un script similar a `deploy_wf02.js` cambiando `WF_ID` y `NODE_ID`. Los IDs y node IDs son:

| Workflow | WF_ID | NODE_ID (buscar en JSON del workflow) |
|---|---|---|
| WF08 | `lNSGEWwP4VlSVES8` | deploy_generic.js encuentra el nodo por ref SUPABASE_URL |
| WF-CUMPLEANOS | `POwcI2JmcR0bufaK` | idem |
| WF-REACTIVACION | `KFnxnbgvFGATS1Sj` | idem |
| WF-CAMPANAS | `rMQC7PyekqZHYVsv` | idem |

Alternativamente, crear un script genérico de deploy:

```js
// C:/Users/noyag/deploy_generic.js
const https = require('https');
const fs = require('fs');

const N8N_URL = 'nexo-terra-n8n.6fwciw.easypanel.host';
const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ';

const [,, WF_ID, CODE_FILE] = process.argv;
if (!WF_ID || !CODE_FILE) {
  console.error('Uso: node deploy_generic.js <WF_ID> <code_file.js>');
  process.exit(1);
}

const newCode = fs.readFileSync(CODE_FILE, 'utf8');
const READONLY = ['id','createdAt','updatedAt','versionId','meta','tags'];

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: N8N_URL, port: 443, path, method,
      headers: { 'X-N8N-API-KEY': JWT, 'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    };
    const r = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, body: d }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const { body: wf } = await req('GET', `/api/v1/workflows/${WF_ID}`);
  // Solo actualiza el nodo Code que tiene la referencia Supabase vieja
  const nodes = (wf.nodes || []).map(n => {
    if (n.type === 'n8n-nodes-base.code' && n.parameters?.jsCode?.includes('$env.SUPABASE_URL')) {
      return { ...n, parameters: { ...n.parameters, jsCode: newCode } };
    }
    return n;
  });
  const payload = { ...wf, nodes };
  READONLY.forEach(k => delete payload[k]);
  const { status, body } = await req('PUT', `/api/v1/workflows/${WF_ID}`, payload);
  console.log(`Status: ${status}`);
  if (status === 200) console.log(`✅ WF ${WF_ID} actualizado`);
  else console.error('❌', JSON.stringify(body).substring(0, 300));
})().catch(console.error);
```

- [ ] **Step 3: Desplegar WF08, WF-CUMPLEANOS, WF-REACTIVACION, WF-CAMPANAS**

```bash
node C:/Users/noyag/deploy_generic.js lNSGEWwP4VlSVES8 C:/Users/noyag/wf08_code.js
node C:/Users/noyag/deploy_generic.js POwcI2JmcR0bufaK C:/Users/noyag/wf_cumpleanos_code.js
node C:/Users/noyag/deploy_generic.js KFnxnbgvFGATS1Sj C:/Users/noyag/wf_reactivacion_code.js
node C:/Users/noyag/deploy_generic.js rMQC7PyekqZHYVsv C:/Users/noyag/wf_campanas_code.js
```

- [ ] **Step 4: Ejecutar script de actualización de workflows inline**

```bash
node C:/Users/noyag/update_wf_supabase_vars.js
```

---

### Task 13: Validación final

- [ ] **Step 1: Validar bot de WhatsApp**

Enviar mensaje al número demo `5491137936325`:
- Texto: `"hola"` → debe responder (verifica WF01 + WF02 + Supabase nuevo)
- Texto: `"quiero cancelar"` → debe ofrecer turnos (verifica classifyInput + quickClassify)

- [ ] **Step 2: Validar dashboard**

Abrir `https://nexo-terra-consultorio-rivadavia-dashboard.6fwciw.easypanel.host`.
- Login con email de Carlos → debe funcionar (verifica Supabase Auth nuevo)
- Tab "Hoy" → debe mostrar turnos (verifica conexión Supabase nuevo)
- Tab "En vivo" → Realtime debe conectar

- [ ] **Step 3: Verificar n8n execution logs**

En n8n → Executions → filtrar por WF02 → verificar:
- 0 errores de conexión Supabase
- Tiempo de ejecución del nodo Code notablemente menor que antes

- [ ] **Step 4: Verificar que workflows no-consultorio siguen funcionando**

En n8n → Executions → buscar ejecuciones recientes de workflows Content Engine / reels → deben seguir usando `SUPABASE_URL` (proyecto viejo) sin errores.

- [ ] **Step 5: Commit final**

```bash
cd "C:/Users/noyag/Norberto-Documentos"
git add -A
git commit -m "feat: latencia fase B — migración Supabase consultorio a sa-east-1"
```

- [ ] **Step 6: Registrar en memoria el nuevo proyecto Supabase**

Actualizar `reference_consultorio_stack.md` con el ID y URL del nuevo proyecto Supabase en sa-east-1.

> **Rollback:** Si algo falla en Fase B, los workflows vuelven al proyecto viejo simplemente eliminando `CONSULTORIO_SUPABASE_URL` y `CONSULTORIO_SUPABASE_KEY` de EasyPanel y revirtiendo los deploys de los workflows (el código viejo usaba `$env.SUPABASE_URL`). El proyecto viejo permanece activo mínimo 1 semana.
