# Tooljet Dashboard — Secretaria y Médicos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard interno self-hosted en Tooljet que permite a la secretaria y médicos ver y gestionar turnos del Consultorio Inteligente en tiempo real.

**Architecture:** Tooljet self-hosted en EasyPanel conecta directamente a Supabase REST para lectura. Las acciones con efecto WhatsApp pasan por WF-DASH, un nuevo workflow n8n con 3 webhooks autenticados. Auth nativa de Tooljet con roles Secretaria (completo) y Médico (solo lectura propia).

**Tech Stack:** Tooljet CE (EasyPanel Docker), PostgreSQL 15 (datos internos Tooljet), Supabase REST API, n8n webhook Code nodes, WhatsApp Cloud API v21.0.

**Spec:** `docs/superpowers/specs/2026-04-22-tooljet-dashboard-secretaria-design.md`

---

## Fase 1 — Infraestructura EasyPanel

### Task 1: Servicio PostgreSQL para Tooljet

**Files:**
- Ningún archivo de código — configuración UI en EasyPanel

- [ ] **Step 1: Crear servicio PostgreSQL en EasyPanel**

En EasyPanel → proyecto del cliente → "Create Service" → "Postgres".

Valores exactos:
```
Service name: tooljet-db
Image:        postgres:15
```

Variables de entorno a setear:
```
POSTGRES_DB:       tooljet_prod
POSTGRES_USER:     tooljet
POSTGRES_PASSWORD: <genera una password fuerte, ej: openssl rand -base64 24>
```

- [ ] **Step 2: Verificar que el servicio arranca**

En EasyPanel, el servicio `tooljet-db` debe mostrar estado "Running" con el ícono verde. Si muestra error, revisar los logs — suele ser un problema de volumen persistente.

- [ ] **Step 3: Anotar la connection string interna**

La URL interna de EasyPanel para este servicio es:
```
postgresql://tooljet:<PASSWORD>@tooljet-db:5432/tooljet_prod
```
Guardarla para el Task 2.

---

### Task 2: Servicio Tooljet en EasyPanel

**Files:**
- Ningún archivo de código — configuración UI en EasyPanel

- [ ] **Step 1: Generar claves secretas**

Correr en cualquier terminal:
```bash
# LOCKBOX_MASTER_KEY: exactamente 32 bytes hex
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# SECRET_KEY_BASE: exactamente 64 bytes hex  
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Guardar ambos valores — no se pueden recuperar después.

- [ ] **Step 2: Crear servicio Tooljet en EasyPanel**

EasyPanel → proyecto del cliente → "Create Service" → "App".

Valores exactos:
```
Service name: tooljet
Image:        tooljet/tooljet-ce:EE-LTS-latest
Port:         3000
```

Variables de entorno (reemplazar los placeholders):
```
TOOLJET_HOST=https://dashboard.<dominio-cliente>.com
LOCKBOX_MASTER_KEY=<valor del Step 1>
SECRET_KEY_BASE=<valor del Step 1>
ENABLE_TOOLJET_DB=true
TOOLJET_DB=tooljet_prod
TOOLJET_DB_HOST=tooljet-db
TOOLJET_DB_PORT=5432
TOOLJET_DB_USER=tooljet
TOOLJET_DB_PASS=<password del Task 1>
NODE_ENV=production
```

- [ ] **Step 3: Esperar que Tooljet inicie**

Primera vez tarda 2-3 minutos (crea las tablas internas). En los logs debe aparecer:
```
ToolJet server is up and running at http://0.0.0.0:3000
```

- [ ] **Step 4: Crear admin inicial**

Abrir `https://dashboard.<dominio-cliente>.com` → pantalla de setup → crear usuario admin:
```
Email:    admin@consultorio.com
Password: <password fuerte>
```
Este usuario es solo para configuración — no es la secretaria.

---

### Task 3: Dominio custom HTTPS

**Files:**
- Ningún archivo de código

- [ ] **Step 1: Configurar dominio en EasyPanel**

En el servicio `tooljet` → "Domains" → agregar:
```
Domain: dashboard.<dominio-cliente>.com
HTTPS:  enabled (Let's Encrypt automático)
```

- [ ] **Step 2: Verificar HTTPS**

Abrir `https://dashboard.<dominio-cliente>.com` → debe cargar sin warnings de certificado.

---

## Fase 2 — Supabase Schema

### Task 4: Tabla dashboard_usuarios

**Files:**
- Ningún archivo (SQL ejecutado en Supabase SQL Editor)

- [ ] **Step 1: Ejecutar SQL en Supabase**

En Supabase → proyecto del consultorio → SQL Editor → New query:

```sql
-- Tabla de mapeo email Tooljet → profesional
CREATE TABLE IF NOT EXISTS dashboard_usuarios (
  email          TEXT PRIMARY KEY,
  profesional_id INTEGER REFERENCES consultorio_profesionales(id) ON DELETE SET NULL,
  rol            TEXT NOT NULL CHECK (rol IN ('secretaria', 'medico'))
);

-- Insertar la secretaria de la demo (profesional_id NULL para secretaria)
INSERT INTO dashboard_usuarios (email, profesional_id, rol)
VALUES ('secretaria@consultorio.com', NULL, 'secretaria')
ON CONFLICT (email) DO NOTHING;
```

- [ ] **Step 2: Verificar creación**

```sql
SELECT * FROM dashboard_usuarios;
```
Debe mostrar la fila de la secretaria.

---

### Task 5: Extender estados en consultorio_turnos

**Files:**
- Ningún archivo (SQL ejecutado en Supabase SQL Editor)

- [ ] **Step 1: Verificar constraint actual**

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'consultorio_turnos'::regclass
  AND contype = 'c';
```

- [ ] **Step 2: Actualizar si faltan estados**

Si el resultado muestra un CHECK constraint que NO incluye `atendido` y `no_show`, ejecutar:

```sql
-- Primero eliminar el constraint viejo (usar el nombre que devolvió el paso anterior)
ALTER TABLE consultorio_turnos DROP CONSTRAINT IF EXISTS consultorio_turnos_estado_check;

-- Crear con todos los valores
ALTER TABLE consultorio_turnos
  ADD CONSTRAINT consultorio_turnos_estado_check
  CHECK (estado IN ('agendado','cancelado','auto_cancelado','atendido','no_show'));
```

Si ya incluye esos valores, saltar este step.

- [ ] **Step 3: Verificar**

```sql
SELECT DISTINCT estado FROM consultorio_turnos;
```

---

## Fase 3 — WF-DASH (n8n)

### Task 6: Código del endpoint /cancelar-turno

**Files:**
- Create: `.work/wf-dash-cancelar.js`

- [ ] **Step 1: Crear archivo de código**

Crear `.work/wf-dash-cancelar.js` con el siguiente contenido exacto:

```javascript
// WF-DASH: /cancelar-turno
// Cancela un turno en Supabase y notifica al paciente por WhatsApp
const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const WA_TOKEN = $env.META_WHATSAPP_TOKEN;
const PHONE_ID = '963190063548521';
const DASHBOARD_SECRET = $env.DASHBOARD_SECRET;
const WF08_BASE = $env.WF08_WEBHOOK_BASE || 'https://nexo-terra-n8n.6fwciw.easypanel.host/webhook/consultorio-turnos';

const reqHeaders = $input.first().json?.headers || {};
const body = $input.first().json?.body || {};

if (reqHeaders['x-dashboard-key'] !== DASHBOARD_SECRET) {
  return [{ json: { status: 401, error: 'Unauthorized' } }];
}

const { turno_id, motivo } = body;
if (!turno_id) return [{ json: { ok: false, error: 'turno_id requerido' } }];

async function supaGet(table, qs) {
  return helpers.httpRequest({
    method: 'GET', url: `${SUPABASE_URL}/rest/v1/${table}`, qs,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
}
async function supaPatch(table, qs, data) {
  return helpers.httpRequest({
    method: 'PATCH', url: `${SUPABASE_URL}/rest/v1/${table}`, qs,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() })
  });
}

const [turnoArr, ] = await Promise.all([
  supaGet('consultorio_turnos', { id: `eq.${turno_id}`, select: 'id,fecha_hora,profesional_id,paciente_id,estado' })
]);
const turno = turnoArr?.[0];
if (!turno) return [{ json: { ok: false, error: 'Turno no encontrado' } }];

const [pacienteArr, profArr] = await Promise.all([
  supaGet('consultorio_pacientes', { id: `eq.${turno.paciente_id}`, select: 'nombre,telefono_wa' }),
  supaGet('consultorio_profesionales', { id: `eq.${turno.profesional_id}`, select: 'nombre' })
]);
const paciente = pacienteArr?.[0];
const prof = profArr?.[0];

await supaPatch('consultorio_turnos', { id: `eq.${turno_id}` }, { estado: 'cancelado' });

let wa_sent = false;
if (paciente?.telefono_wa) {
  try {
    const d = new Date(new Date(turno.fecha_hora).getTime() - 3 * 60 * 60 * 1000);
    const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const fec = `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
    const hr = `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
    const motivoTxt = motivo ? `\n\nMotivo: ${motivo}` : '';
    const msgBody = `❌ *Tu turno fue cancelado*\n\n📅 ${fec}, ${hr} hs\n👨‍⚕️ ${prof?.nombre || 'el profesional'}${motivoTxt}\n\nEscribinos para reagendar cuando quieras. 👋`;
    await helpers.httpRequest({
      method: 'POST',
      url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: paciente.telefono_wa, type: 'interactive',
        interactive: {
          type: 'cta_url', body: { text: msgBody },
          action: { name: 'cta_url', parameters: { display_text: 'Reservar nuevo turno', url: WF08_BASE } }
        }
      })
    });
    wa_sent = true;
  } catch(e) {}
}

return [{ json: { ok: true, wa_sent } }];
```

---

### Task 7: Código del endpoint /generar-link

**Files:**
- Create: `.work/wf-dash-generar-link.js`

- [ ] **Step 1: Crear archivo de código**

Crear `.work/wf-dash-generar-link.js`:

```javascript
// WF-DASH: /generar-link
// Genera un bookingToken para WF08, crea conversación si no existe
const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const DASHBOARD_SECRET = $env.DASHBOARD_SECRET;
const WF08_BASE = $env.WF08_WEBHOOK_BASE || 'https://nexo-terra-n8n.6fwciw.easypanel.host/webhook/consultorio-turnos';

const reqHeaders = $input.first().json?.headers || {};
const body = $input.first().json?.body || {};

if (reqHeaders['x-dashboard-key'] !== DASHBOARD_SECRET) {
  return [{ json: { status: 401, error: 'Unauthorized' } }];
}

const { telefono_wa, profesional_id } = body;
if (!telefono_wa || !profesional_id) {
  return [{ json: { ok: false, error: 'telefono_wa y profesional_id requeridos' } }];
}

const token = require('crypto').randomBytes(16).toString('hex');

const convArr = await helpers.httpRequest({
  method: 'GET', url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
  qs: { telefono_wa: `eq.${telefono_wa}`, select: 'telefono_wa,contexto' },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});

if (!convArr || convArr.length === 0) {
  await helpers.httpRequest({
    method: 'POST', url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      telefono_wa, estado: 'inicio', handoff_humano: false,
      contexto: { bookingToken: token, profesionalId: parseInt(profesional_id) }
    })
  });
} else {
  const ctx = convArr[0].contexto || {};
  await helpers.httpRequest({
    method: 'PATCH', url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
    qs: { telefono_wa: `eq.${telefono_wa}` },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contexto: { ...ctx, bookingToken: token, profesionalId: parseInt(profesional_id) }, updated_at: new Date().toISOString() })
  });
}

return [{ json: { ok: true, url: `${WF08_BASE}?token=${token}` } }];
```

---

### Task 8: Código del endpoint /crear-paciente

**Files:**
- Create: `.work/wf-dash-crear-paciente.js`

- [ ] **Step 1: Crear archivo de código**

Crear `.work/wf-dash-crear-paciente.js`:

```javascript
// WF-DASH: /crear-paciente
// Inserta paciente nuevo si no existe; devuelve id en ambos casos
const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const DASHBOARD_SECRET = $env.DASHBOARD_SECRET;

const reqHeaders = $input.first().json?.headers || {};
const body = $input.first().json?.body || {};

if (reqHeaders['x-dashboard-key'] !== DASHBOARD_SECRET) {
  return [{ json: { status: 401, error: 'Unauthorized' } }];
}

const { nombre, telefono_wa, obra_social } = body;
if (!nombre || !telefono_wa) {
  return [{ json: { ok: false, error: 'nombre y telefono_wa requeridos' } }];
}

const existing = await helpers.httpRequest({
  method: 'GET', url: `${SUPABASE_URL}/rest/v1/consultorio_pacientes`,
  qs: { telefono_wa: `eq.${telefono_wa}`, select: 'id,nombre' },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});

if (existing && existing.length > 0) {
  return [{ json: { ok: true, paciente_id: existing[0].id, created: false } }];
}

const payload = { nombre, telefono_wa };
if (obra_social) payload.obra_social = obra_social;

const res = await helpers.httpRequest({
  method: 'POST', url: `${SUPABASE_URL}/rest/v1/consultorio_pacientes`,
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify(payload)
});

const paciente = Array.isArray(res) ? res[0] : res;
return [{ json: { ok: true, paciente_id: paciente?.id, created: true } }];
```

---

### Task 9: Crear WF-DASH en n8n y agregar env var

**Files:**
- Ningún archivo de código — configuración en n8n UI + EasyPanel

- [ ] **Step 1: Agregar DASHBOARD_SECRET a n8n en EasyPanel**

En EasyPanel → servicio `n8n` → Environment Variables → agregar:
```
DASHBOARD_SECRET=<genera con: node -e "console.log(require('crypto').randomBytes(24).toString('hex'))">
WF08_WEBHOOK_BASE=https://nexo-terra-n8n.6fwciw.easypanel.host/webhook/consultorio-turnos
```
Guardar y esperar que n8n reinicie.

- [ ] **Step 2: Crear el workflow WF-DASH en n8n**

En n8n → New Workflow → renombrar como `Consultorio - WF-DASH Dashboard API`.

Agregar 3 ramas idénticas en estructura, una por endpoint:

**Rama 1 — /cancelar-turno:**
- Nodo: Webhook (`POST`, path: `dashboard-cancelar`)
- Nodo: Code (pegar contenido de `.work/wf-dash-cancelar.js`)
- Nodo: Respond to Webhook (response body: `{{ $json }}`, status: `{{ $json.status || 200 }}`)

**Rama 2 — /generar-link:**
- Nodo: Webhook (`POST`, path: `dashboard-generar-link`)
- Nodo: Code (pegar contenido de `.work/wf-dash-generar-link.js`)
- Nodo: Respond to Webhook

**Rama 3 — /crear-paciente:**
- Nodo: Webhook (`POST`, path: `dashboard-crear-paciente`)
- Nodo: Code (pegar contenido de `.work/wf-dash-crear-paciente.js`)
- Nodo: Respond to Webhook

- [ ] **Step 3: Activar el workflow**

Toggle "Active" en WF-DASH → debe mostrar verde.

- [ ] **Step 4: Verificar los 3 endpoints**

Correr en terminal (reemplazar `<SECRET>`):

```bash
export N8N_BASE=https://nexo-terra-n8n.6fwciw.easypanel.host
export DASH_KEY=<DASHBOARD_SECRET>

# Test /cancelar-turno (sin turno_id real — debe devolver error controlado)
curl -s -X POST "$N8N_BASE/webhook/dashboard-cancelar" \
  -H "Content-Type: application/json" \
  -H "X-Dashboard-Key: $DASH_KEY" \
  -d '{"turno_id": 99999}' | node -e "process.stdin.resume();process.stdin.on('data',d=>console.log(JSON.parse(d)))"

# Expected: { ok: false, error: 'Turno no encontrado' }

# Test auth fallida
curl -s -X POST "$N8N_BASE/webhook/dashboard-cancelar" \
  -H "Content-Type: application/json" \
  -H "X-Dashboard-Key: wrong-key" \
  -d '{"turno_id": 1}' | node -e "process.stdin.resume();process.stdin.on('data',d=>console.log(JSON.parse(d)))"

# Expected: { status: 401, error: 'Unauthorized' }
```

---

## Fase 4 — Tooljet Setup

### Task 10: Datasources en Tooljet

**Files:**
- Ningún archivo de código — configuración en Tooljet UI

- [ ] **Step 1: Crear datasource Supabase**

En Tooljet → Settings → Datasources → "Add datasource" → "Supabase".

Valores:
```
Name:    Consultorio Supabase
Host:    <SUPABASE_URL sin /rest/v1, ej: https://xyzabc.supabase.co>
API key: <SUPABASE_SERVICE_KEY>
```
Click "Test connection" → debe mostrar "Connection successful".

- [ ] **Step 2: Crear datasource REST para WF-DASH**

Settings → Datasources → "Add datasource" → "REST API".

Valores:
```
Name:    WF-DASH n8n
Base URL: https://nexo-terra-n8n.6fwciw.easypanel.host/webhook
```
Headers (Authentication headers, aplicados a todas las requests):
```
X-Dashboard-Key: <DASHBOARD_SECRET>
Content-Type:    application/json
```

---

### Task 11: Usuarios y grupos

**Files:**
- Ningún archivo de código — configuración en Tooljet UI

- [ ] **Step 1: Crear grupos**

Settings → Groups → "Add group":
- Nombre: `Secretaria`
- Nombre: `Medico`

- [ ] **Step 2: Crear usuarios**

Settings → Users → "Invite user":

```
secretaria@consultorio.com  → grupo: Secretaria
dr.garcia@consultorio.com   → grupo: Medico    (uno por médico real)
```

Los usuarios van a recibir un email de invitación para setear su password.

- [ ] **Step 3: Insertar mapeo en Supabase para cada médico**

Por cada médico creado, ejecutar en Supabase SQL Editor:

```sql
-- Reemplazar email y profesional_id real
INSERT INTO dashboard_usuarios (email, profesional_id, rol)
VALUES ('dr.garcia@consultorio.com', 1, 'medico')
ON CONFLICT (email) DO UPDATE SET profesional_id = EXCLUDED.profesional_id;
```

Para la secretaria el `profesional_id` queda NULL (ya insertado en Task 4).

---

## Fase 5 — App Tooljet

### Task 12: App skeleton y variables globales

**Files:**
- Ningún archivo de código — Tooljet visual builder

- [ ] **Step 1: Crear la app**

Apps → "Create new app" → nombre: `Dashboard Consultorio`.

- [ ] **Step 2: Crear query `cargar_usuario`**

En el Query Panel → "Add query" → datasource: Consultorio Supabase → Operation: Raw SQL Query.

Nombre: `cargar_usuario`
SQL:
```sql
SELECT email, profesional_id, rol
FROM dashboard_usuarios
WHERE email = '{{globals.currentUser.email}}'
LIMIT 1;
```
Settings: "Run this query on page load? → Yes"

- [ ] **Step 3: Crear variables globales de sesión**

En el panel de componentes → "Variables" → crear:

| Variable | Valor inicial | Descripción |
|---|---|---|
| `user_rol` | `""` | se llena al cargar con `cargar_usuario.data[0]?.rol` |
| `user_profesional_id` | `null` | se llena con `cargar_usuario.data[0]?.profesional_id` |
| `semana_offset` | `0` | offset de semanas para la vista calendario |

- [ ] **Step 4: Setear variables al cargar**

En el evento `onSuccess` de la query `cargar_usuario`:

```javascript
// Acción: Run JS code
actions.setVariable('user_rol', cargar_usuario.data[0]?.rol || '');
actions.setVariable('user_profesional_id', cargar_usuario.data[0]?.profesional_id || null);
```

- [ ] **Step 5: Crear layout con sidebar**

Agregar componente "Container" para sidebar izquierda (ancho 200px, fijo).
Dentro del sidebar, agregar 3 botones de navegación:
- "Hoy" → `actions.setVariable('vista_activa', 'hoy')`
- "Semana" → `actions.setVariable('vista_activa', 'semana')`
- "Handoffs" → `actions.setVariable('vista_activa', 'handoffs')` (visible solo si `{{variables.user_rol === 'secretaria'}}`)

Agregar variable `vista_activa` al panel de Variables con valor inicial `'hoy'`.

Agregar en el header del área principal (fuera del sidebar):
- Botón "＋ Nuevo turno" → `actions.setVariable('modal_paso', 1); actions.showModal('modal_nuevo_turno')`
- Visible solo cuando `{{variables.user_rol === 'secretaria'}}`

Cada contenedor de vista (Hoy, Semana, Handoffs) tiene condición de visibilidad:
- Container Hoy: `{{variables.vista_activa === 'hoy'}}`
- Container Semana: `{{variables.vista_activa === 'semana'}}`
- Container Handoffs: `{{variables.vista_activa === 'handoffs'}}`

---

### Task 13: Vista "Hoy" — Lista del día

**Files:**
- Ningún archivo de código — Tooljet visual builder

- [ ] **Step 1: Crear query `turnos_hoy`**

Query Panel → "Add query" → datasource: Consultorio Supabase → Raw SQL Query.

Nombre: `turnos_hoy`
SQL:
```sql
SELECT
  t.id,
  to_char(t.fecha_hora AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI') AS hora,
  t.fecha_hora,
  t.estado,
  t.tipo_pago,
  p.nombre AS paciente_nombre,
  p.telefono_wa,
  p.obra_social,
  pr.nombre AS profesional_nombre,
  pr.id AS profesional_id
FROM consultorio_turnos t
JOIN consultorio_pacientes p ON t.paciente_id = p.id
JOIN consultorio_profesionales pr ON t.profesional_id = pr.id
WHERE (t.fecha_hora AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = CURRENT_DATE
  AND t.estado NOT IN ('cancelado', 'auto_cancelado')
  {{variables.user_rol === 'medico' ? 'AND pr.id = ' + variables.user_profesional_id : ''}}
ORDER BY t.fecha_hora ASC;
```

Settings: Run on page load: Yes. Auto-run every: 30 seconds.

- [ ] **Step 2: Agregar tabla de turnos**

Componente "Table" → datos: `{{turnos_hoy.data}}`.

Columnas a configurar:
| Column key | Label | Type |
|---|---|---|
| `hora` | Hora | Text |
| `paciente_nombre` | Paciente | Text |
| `profesional_nombre` | Profesional | Text (ocultar si rol=medico) |
| `obra_social` | Obra Social | Text |
| `tipo_pago` | Pago | Text |
| `estado` | Estado | Badge |

Para la columna Estado (Badge), configurar colores:
```javascript
// Cell value mapping (JS en la columna Badge)
const colores = { agendado: 'blue', atendido: 'green', no_show: 'orange', cancelado: 'gray' };
return colores[cellValue] || 'gray';
```

- [ ] **Step 3: Agregar columna de acciones**

En la tabla → "Add column" → tipo: "Custom".

HTML de la columna de acciones:
```html
<div style="display:flex;gap:6px">
  <button onclick="actions.showModal('modal_cancelar'); actions.setVariable('turno_seleccionado', {{currentRow}})"
    style="background:#EF4444;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer"
    {{currentRow.estado !== 'agendado' ? 'disabled style="opacity:0.4"' : ''}}>
    Cancelar
  </button>
  <button onclick="actions.runQuery('marcar_atendido', {id: '{{currentRow.id}}'})"
    style="background:#10B981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer">
    ✓
  </button>
  <button onclick="actions.runQuery('marcar_no_show', {id: '{{currentRow.id}}'})"
    style="background:#F59E0B;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer">
    NS
  </button>
</div>
```

- [ ] **Step 4: Crear queries de mutación directa**

Query `marcar_atendido` → Supabase → Raw SQL:
```sql
UPDATE consultorio_turnos
SET estado = 'atendido', updated_at = NOW()
WHERE id = {{queryParams.id}};
```
onSuccess: `turnos_hoy.run()`

Query `marcar_no_show` → Supabase → Raw SQL:
```sql
UPDATE consultorio_turnos
SET estado = 'no_show', updated_at = NOW()
WHERE id = {{queryParams.id}};
```
onSuccess: `turnos_hoy.run()`

- [ ] **Step 5: Filtro por profesional (solo secretaria)**

Agregar componente "Select" con datos:
```javascript
{{[{label: 'Todos', value: ''}, ...query_profesionales.data.map(p => ({label: p.nombre, value: p.id}))]}}
```

Visible solo cuando `{{variables.user_rol === 'secretaria'}}`.

Crear query `query_profesionales` → Supabase → Raw SQL:
```sql
SELECT id, nombre FROM consultorio_profesionales ORDER BY nombre;
```

Modificar `turnos_hoy` SQL para usar el filtro:
```sql
-- Agregar al WHERE:
AND ({{components.select_profesional.value === '' ? 'true' : 'pr.id = ' + components.select_profesional.value}})
```

---

### Task 14: Vista "Semana" — Calendario

**Files:**
- Ningún archivo de código — Tooljet visual builder

- [ ] **Step 1: Crear query `turnos_semana`**

Query Panel → Supabase → Raw SQL.

Nombre: `turnos_semana`
```sql
SELECT
  t.id,
  t.fecha_hora,
  t.estado,
  p.nombre AS title,
  pr.nombre AS profesional_nombre,
  pr.id AS profesional_id,
  p.telefono_wa,
  p.obra_social,
  t.tipo_pago
FROM consultorio_turnos t
JOIN consultorio_pacientes p ON t.paciente_id = p.id
JOIN consultorio_profesionales pr ON t.profesional_id = pr.id
WHERE t.fecha_hora >= (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    + ({{variables.semana_offset}} * INTERVAL '7 days')
  AND t.fecha_hora <  (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    + (({{variables.semana_offset}} + 1) * INTERVAL '7 days')
  AND t.estado NOT IN ('cancelado', 'auto_cancelado')
  {{variables.user_rol === 'medico' ? 'AND pr.id = ' + variables.user_profesional_id : ''}}
ORDER BY t.fecha_hora;
```

Auto-run every: 30 seconds.

- [ ] **Step 2: Agregar componente Calendar**

Componente "Calendar" → configuración:
```
Events: {{turnos_semana.data.map(t => ({
  id: t.id,
  title: t.title + ' — ' + t.profesional_nombre,
  start: t.fecha_hora,
  end: new Date(new Date(t.fecha_hora).getTime() + 30*60*1000).toISOString(),
  backgroundColor: {agendado:'#3B82F6', atendido:'#10B981', no_show:'#F59E0B'}[t.estado] || '#94A3B8'
}))}}
Default view: week
```

- [ ] **Step 3: Navegación semana anterior / siguiente**

Dos botones: "← Semana anterior" y "Semana siguiente →"

Botón anterior: `actions.setVariable('semana_offset', variables.semana_offset - 1); turnos_semana.run()`
Botón siguiente: `actions.setVariable('semana_offset', variables.semana_offset + 1); turnos_semana.run()`

- [ ] **Step 4: Panel lateral al hacer click en evento**

En el evento `onEventClick` del Calendar:
```javascript
actions.setVariable('turno_seleccionado', eventData);
actions.showModal('modal_detalle_turno');
```

Crear modal `modal_detalle_turno` con:
- Texto: `{{variables.turno_seleccionado?.title}}`
- Texto: `{{new Date(variables.turno_seleccionado?.start).toLocaleString('es-AR', {timeZone: 'America/Argentina/Buenos_Aires'})}}`
- Botón "Cancelar turno" → `actions.showModal('modal_cancelar')`
- Botón "Marcar atendido" → `actions.runQuery('marcar_atendido', {id: variables.turno_seleccionado?.id})`

---

### Task 15: Vista "Handoffs"

**Files:**
- Ningún archivo de código — Tooljet visual builder

- [ ] **Step 1: Crear query `handoffs_pendientes`**

Query Panel → Supabase → Raw SQL.

Nombre: `handoffs_pendientes`
```sql
SELECT
  c.telefono_wa,
  p.nombre AS paciente_nombre,
  c.updated_at,
  EXTRACT(EPOCH FROM (NOW() - c.updated_at))/60 AS minutos_esperando
FROM consultorio_conversaciones c
LEFT JOIN consultorio_pacientes p ON c.telefono_wa = p.telefono_wa
WHERE c.handoff_humano = true
ORDER BY c.updated_at ASC;
```

Auto-run every: 30 seconds.

- [ ] **Step 2: Agregar badge en sidebar**

En el botón "Handoffs" del sidebar, agregar badge:
```javascript
// Texto del badge:
{{handoffs_pendientes.data?.length > 0 ? handoffs_pendientes.data.length : ''}}
// Visible cuando:
{{handoffs_pendientes.data?.length > 0}}
```

- [ ] **Step 3: Agregar tabla de handoffs**

Componente "Table" → datos: `{{handoffs_pendientes.data}}`.

Columnas:
| Column key | Label |
|---|---|
| `paciente_nombre` | Paciente |
| `telefono_wa` | Teléfono |
| `minutos_esperando` | Espera (min) |

Columna de acción: Botón "Atendido"
```javascript
// onClick:
actions.runQuery('cerrar_handoff', {telefono: currentRow.telefono_wa})
```

- [ ] **Step 4: Crear query `cerrar_handoff`**

```sql
UPDATE consultorio_conversaciones
SET handoff_humano = false, updated_at = NOW()
WHERE telefono_wa = '{{queryParams.telefono}}';
```
onSuccess: `handoffs_pendientes.run()`

---

### Task 16: Modal "Cancelar turno"

**Files:**
- Ningún archivo de código — Tooljet visual builder

- [ ] **Step 1: Crear modal**

Componente "Modal" → nombre: `modal_cancelar`.

Contenido:
- Título: "Cancelar turno"
- Texto: `{{variables.turno_seleccionado?.paciente_nombre}} — {{new Date(variables.turno_seleccionado?.fecha_hora).toLocaleString('es-AR', {timeZone: 'America/Argentina/Buenos_Aires'})}}`
- Input text → nombre: `input_motivo` → placeholder: "Motivo (opcional)"
- Botón "Confirmar cancelación" → rojo
- Botón "Volver" → cierra modal

- [ ] **Step 2: Crear query `wf_cancelar_turno`**

Query Panel → datasource: WF-DASH n8n → Method: POST → URL: `/dashboard-cancelar`

Body:
```json
{
  "turno_id": "{{variables.turno_seleccionado?.id}}",
  "motivo": "{{components.input_motivo.value}}"
}
```

onSuccess:
```javascript
// Mostrar resultado
if (wf_cancelar_turno.data?.wa_sent === false) {
  actions.showAlert('Turno cancelado. Notificación WhatsApp no enviada.', 'warning');
} else {
  actions.showAlert('Turno cancelado y paciente notificado.', 'success');
}
actions.closeModal('modal_cancelar');
turnos_hoy.run();
turnos_semana.run();
```

- [ ] **Step 3: Conectar botón "Confirmar cancelación"**

onClick → `wf_cancelar_turno.run()`

---

### Task 17: Modal "Nuevo turno"

**Files:**
- Ningún archivo de código — Tooljet visual builder

- [ ] **Step 1: Crear variables del modal**

```
modal_paso:           1          (1=paciente, 2=turno)
modal_paciente_id:    null
modal_paciente_nombre: ""
modal_es_nuevo:       false
```

- [ ] **Step 2: Crear modal y Paso 1 (Paciente)**

Componente "Modal" → nombre: `modal_nuevo_turno`.

**Paso 1 — Paciente** (visible cuando `{{variables.modal_paso === 1}}`):
- Input text → nombre: `input_telefono` → placeholder: "Teléfono WhatsApp (ej: 5491155551234)"
- Botón "Buscar" → `wf_buscar_paciente.run()`
- Container resultado (visible cuando `{{wf_buscar_paciente.data !== null}}`):
  - Si existe: texto `{{wf_buscar_paciente.data?.nombre}}`
  - Si no existe: formulario con inputs `input_nombre_nuevo` y `input_os_nueva`
- Botón "Siguiente" → valida y avanza a paso 2

- [ ] **Step 3: Crear query `wf_buscar_paciente`**

Query Panel → Supabase → Raw SQL:
```sql
SELECT id, nombre, obra_social
FROM consultorio_pacientes
WHERE telefono_wa = '{{components.input_telefono.value}}'
LIMIT 1;
```

- [ ] **Step 4: Lógica del botón "Siguiente" en Paso 1**

```javascript
// Si paciente existe
if (wf_buscar_paciente.data?.length > 0) {
  actions.setVariable('modal_paciente_id', wf_buscar_paciente.data[0].id);
  actions.setVariable('modal_paciente_nombre', wf_buscar_paciente.data[0].nombre);
  actions.setVariable('modal_es_nuevo', false);
  actions.setVariable('modal_paso', 2);
} else {
  // Crear paciente nuevo via WF-DASH
  await actions.runQuery('wf_crear_paciente_query');
  // onSuccess seteará modal_paciente_id y avanzará a paso 2
}
```

- [ ] **Step 5: Crear query `wf_crear_paciente_query`**

Query Panel → WF-DASH n8n → POST → `/dashboard-crear-paciente`

Body:
```json
{
  "nombre": "{{components.input_nombre_nuevo.value}}",
  "telefono_wa": "{{components.input_telefono.value}}",
  "obra_social": "{{components.input_os_nueva.value}}"
}
```

onSuccess:
```javascript
actions.setVariable('modal_paciente_id', wf_crear_paciente_query.data?.paciente_id);
actions.setVariable('modal_paciente_nombre', components.input_nombre_nuevo.value);
actions.setVariable('modal_paso', 2);
```

- [ ] **Step 6: Paso 2 — Turno** (visible cuando `{{variables.modal_paso === 2}}`)

Agregar dentro del modal:
- Select Profesional → datos: `{{query_profesionales.data}}`
- Date picker → nombre: `input_fecha_turno`
- Select hora → nombre: `select_hora_turno` → datos generados en Step 7
- Select tipo pago → opciones: `[{label:'Obra social', value:'obra_social'}, {label:'Particular', value:'particular'}]`
- Botón "Confirmar turno" → `wf_crear_turno_query.run()`
- Botón "Generar link WF08" → `wf_generar_link_query.run()`

- [ ] **Step 7: Crear query `query_slots_disponibles`**

```sql
WITH horarios AS (
  SELECT hora_inicio, hora_fin
  FROM consultorio_horarios_profesional
  WHERE profesional_id = {{components.select_profesional_modal.value}}
    AND dia_semana = EXTRACT(ISODOW FROM '{{components.input_fecha_turno.value}}'::date)
),
ocupados AS (
  SELECT fecha_hora::time AS hora
  FROM consultorio_turnos
  WHERE profesional_id = {{components.select_profesional_modal.value}}
    AND fecha_hora::date = '{{components.input_fecha_turno.value}}'::date
    AND estado NOT IN ('cancelado', 'auto_cancelado')
),
slots AS (
  SELECT generate_series(
    hora_inicio::time,
    hora_fin::time - INTERVAL '15 minutes',
    INTERVAL '15 minutes'
  ) AS slot
  FROM horarios
)
SELECT to_char(slot, 'HH24:MI') AS hora
FROM slots
WHERE slot NOT IN (SELECT hora FROM ocupados)
ORDER BY slot;
```

Run on event: cuando cambia `input_fecha_turno` o `select_profesional_modal`.

- [ ] **Step 8: Crear query `wf_crear_turno_query`**

Query Panel → Supabase → Raw SQL:
```sql
INSERT INTO consultorio_turnos (paciente_id, profesional_id, fecha_hora, estado, tipo_pago)
VALUES (
  {{variables.modal_paciente_id}},
  {{components.select_profesional_modal.value}},
  ('{{components.input_fecha_turno.value}} ' || '{{components.select_hora_turno.value}}')::timestamptz AT TIME ZONE 'America/Argentina/Buenos_Aires',
  'agendado',
  '{{components.select_tipo_pago.value}}'
);
```

onSuccess:
```javascript
actions.showAlert('Turno creado exitosamente.', 'success');
actions.closeModal('modal_nuevo_turno');
actions.setVariable('modal_paso', 1);
turnos_hoy.run();
```

- [ ] **Step 9: Crear query `wf_generar_link_query`**

Query Panel → WF-DASH n8n → POST → `/dashboard-generar-link`

Body:
```json
{
  "telefono_wa": "{{components.input_telefono.value}}",
  "profesional_id": "{{components.select_profesional_modal.value}}"
}
```

onSuccess:
```javascript
actions.showModal('modal_link_generado');
actions.setVariable('link_generado', wf_generar_link_query.data?.url);
```

- [ ] **Step 10: Crear modal de link generado**

Componente "Modal" → nombre: `modal_link_generado`.

Contenido:
- Texto: "Link generado:"
- Input text (read-only): `{{variables.link_generado}}`
- Botón "Copiar" → `actions.copyToClipboard(variables.link_generado)`
- Texto aclaratorio: "Mandá este link al paciente por WhatsApp"

---

## Fase 6 — Testing

### Task 18: Test con rol Secretaria

**Files:**
- Ningún archivo de código — testing manual

- [ ] **Step 1: Login como secretaria**

Abrir `https://dashboard.<dominio-cliente>.com` → login con `secretaria@consultorio.com`.

- [ ] **Step 2: Verificar vista Hoy**

- [ ] Aparecen turnos del día con hora, paciente, profesional, estado
- [ ] Auto-refresh funciona (esperar 30s, si se agrega un turno en Supabase debe aparecer)
- [ ] Filtro por profesional funciona
- [ ] Botón "Cancelar" abre modal con datos correctos
- [ ] Cancelar un turno → Supabase muestra estado=cancelado, WhatsApp badge si falla

- [ ] **Step 3: Verificar vista Semana**

- [ ] Calendario muestra turnos con colores correctos
- [ ] Navegación anterior/siguiente funciona
- [ ] Click en evento abre panel lateral

- [ ] **Step 4: Verificar Handoffs**

- [ ] Badge aparece si hay conversaciones con `handoff_humano=true`
- [ ] Botón "Atendido" actualiza Supabase y remueve de la tabla

- [ ] **Step 5: Crear turno manual**

- [ ] Buscar teléfono existente → autocompleta datos
- [ ] Buscar teléfono nuevo → muestra formulario de creación
- [ ] Slots disponibles se calculan correctamente (no muestra slots ocupados)
- [ ] Confirmar turno → aparece en vista Hoy

- [ ] **Step 6: Generar link**

- [ ] Genera URL válida de WF08
- [ ] Botón copiar funciona
- [ ] Abrir la URL en browser → carga la página de selección de turnos

---

### Task 19: Test con rol Médico

**Files:**
- Ningún archivo de código — testing manual

- [ ] **Step 1: Login como médico**

Login con `dr.garcia@consultorio.com`.

- [ ] **Step 2: Verificar filtro de datos**

- [ ] Vista Hoy muestra SOLO los turnos del Dr. García
- [ ] NO aparece el filtro por profesional
- [ ] Vista Semana muestra SOLO su agenda
- [ ] La sección "Handoffs" NO aparece en el sidebar
- [ ] Los botones de acciones NO están visibles (solo lectura)

- [ ] **Step 3: Verificar mobile (desde teléfono)**

Abrir la URL en el celular → debe cargar responsive y mostrar la agenda correctamente.

---

### Task 20: Commit final

- [ ] **Step 1: Actualizar MEMORY.md**

El spec y el plan están en git. Actualizar la memoria del proyecto:

```bash
# El plan está en:
# docs/superpowers/plans/2026-04-22-tooljet-dashboard.md
git add docs/superpowers/plans/2026-04-22-tooljet-dashboard.md
git commit -m "plan: implementación dashboard Tooljet secretaria/médico"
```
