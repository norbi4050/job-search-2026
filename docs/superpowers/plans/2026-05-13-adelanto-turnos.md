# Sistema de Adelanto de Turnos — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el sistema de cascada que, cuando se cancela un turno, ofrece automáticamente el slot liberado al paciente con el turno más lejano del mismo médico — con lógica de respuesta tardía, timeout de 20 minutos, hasta 5 candidatos, y manejo hermético del state machine del bot.

**Architecture:** WF-ADELANTO-1 (webhook) busca candidatos y envía la oferta. WF-ADELANTO-2 (Execute Workflow, llamado por WF01) procesa la respuesta del paciente con todos los casos borde. WF-ADELANTO-CRON (schedule cada 10 min) expira ofertas y dispara la cascada al siguiente candidato. WF01 recibe routing explícito para `adelanto_pendiente` y `respuesta_reminder` antes de caer a WF02. WF-REMINDER setea estado `respuesta_reminder` al enviar, para que el paciente siempre responda en contexto.

**Tech Stack:** n8n v2.19.5 (Code nodes JS), Supabase (PostgreSQL), WhatsApp Cloud API v21, Tooljet dashboard.

---

## Bugs corregidos en este plan (vs. versión anterior)

| # | Bug | Fix aplicado |
|---|-----|-------------|
| 1 | Exclusión no acumulativa: cascada podía repetir candidatos | WF-ADELANTO-1 consulta en BD todos los pacientes ya intentados para ese slot |
| 2 | El paciente que cancela podía recibir su propio slot liberado | WF02 pasa `cancelantePacienteId` a `triggerAdelanto` |
| 3 | Paciente en handoff podía recibir oferta (ignorada, expirada en 20min) | WF-ADELANTO-1 filtra pacientes en handoff antes de elegir candidato |
| 4 | Orden de pasos en Task 4 invertido (`fechaHoraISO` se usaba antes de definirse) | Reordenado: Step 1 agrega `fechaHoraISO`, Steps 2-3 lo usan |
| 5 | `N8N_HOST` no verificada — falla silenciosa si no está configurada | Prerequisito obligatorio en Task 0 |

---

## Archivos que se tocan

| Workflow / Archivo | Cambio |
|--------------------|--------|
| Supabase SQL | `ALTER TABLE consultorio_turnos`, `CREATE TABLE consultorio_adelanto_ofertas` |
| `WF01-gateway-whatsapp.json` | Nodo 5: eximir estados proactivos del reset de 30min. Nuevo nodo "6b" + "7c". |
| `WF-REMINDER-recordatorios.json` | Setear `respuesta_reminder` en ctx al enviar. |
| `WF02-bot-conversacional.json` | `triggerAdelanto` reemplaza `triggerWaitlist`. Fix `respuesta_reminder`. |
| `WF-ADELANTO-1-buscar-candidato.json` | **Nuevo.** Webhook + Code node. |
| `WF-ADELANTO-2-procesar-respuesta.json` | **Nuevo.** Execute Workflow Trigger + Code node. |
| `WF-ADELANTO-CRON-timeout.json` | **Nuevo.** Schedule trigger (10 min) + Code node. |
| Tooljet — Tab "Adelantos" | Nueva pestaña con lista de ofertas activas. |
| Tooljet — Tab "En Vivo" | Nueva pestaña con conversaciones activas. |

---

## Task 0: Prerequisito — Verificar env var N8N_HOST

**Files:** EasyPanel → App n8n → Environment Variables

Sin `N8N_HOST`, los workflows no pueden llamarse entre sí via webhook y la cascada falla silenciosamente.

- [ ] **Step 1: Verificar en EasyPanel**

EasyPanel → App n8n → Environment → buscar `N8N_HOST` o `WEBHOOK_URL`.

Si ya existe `WEBHOOK_URL` con valor `https://[tu-instancia].easypanel.host`, usarlo como referencia.

- [ ] **Step 2: Agregar si no existe**

Agregar env var: `N8N_HOST = https://[tu-instancia].easypanel.host` (sin barra final).

- [ ] **Step 3: Verificar que el valor funciona**

En n8n, en cualquier Code node activo, ejecutar:
```javascript
return [{ json: { host: $env.N8N_HOST || $env.WEBHOOK_URL || 'NO CONFIGURADO' } }];
```
Expected: URL completa, no `'NO CONFIGURADO'`.

---

## Task 1: Schema migration en Supabase

**Files:** Supabase → SQL Editor → New Query → Run

- [ ] **Step 1: Agregar columna a consultorio_turnos**

```sql
ALTER TABLE consultorio_turnos
  ADD COLUMN IF NOT EXISTS quiere_adelanto BOOLEAN DEFAULT TRUE;
```

Expected: `Success. No rows returned`

- [ ] **Step 2: Crear tabla de ofertas**

```sql
CREATE TABLE IF NOT EXISTS consultorio_adelanto_ofertas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_fecha      TIMESTAMPTZ NOT NULL,
  profesional_id  UUID REFERENCES consultorio_profesionales(id),
  turno_origen_id UUID REFERENCES consultorio_turnos(id),
  intento         INTEGER DEFAULT 1,
  estado          TEXT DEFAULT 'pendiente',
  oferta_at       TIMESTAMPTZ DEFAULT NOW(),
  expira_at       TIMESTAMPTZ,
  respuesta_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adelanto_estado ON consultorio_adelanto_ofertas(estado);
CREATE INDEX IF NOT EXISTS idx_adelanto_expira  ON consultorio_adelanto_ofertas(expira_at);
CREATE INDEX IF NOT EXISTS idx_adelanto_slot    ON consultorio_adelanto_ofertas(slot_fecha, profesional_id);
```

Expected: `Success. No rows returned` (3 veces)

- [ ] **Step 3: Verificar**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'consultorio_turnos' AND column_name = 'quiere_adelanto';

SELECT table_name FROM information_schema.tables
WHERE table_name = 'consultorio_adelanto_ofertas';
```

Expected: 1 fila en cada query.

---

## Task 2: WF01 — Routing explícito y fix del reset de sesión

**Files:** `consultorio-kit/n8n/WF01-gateway-whatsapp.json`

### Step 2a — Eximir estados proactivos del reset de 30 minutos

- [ ] **Step 1: Abrir WF01 → nodo "5. Leer/Crear Conversacion"**

- [ ] **Step 2: Encontrar la línea del reset de sesión**

```javascript
if (diffMin > 30 && conv.estado !== 'inicio' && !conv.handoff_humano) {
```

- [ ] **Step 3: Reemplazar**

```javascript
const ESTADOS_SIN_RESET = ['adelanto_pendiente', 'respuesta_reminder'];
if (diffMin > 30 && conv.estado !== 'inicio' && !conv.handoff_humano && !ESTADOS_SIN_RESET.includes(conv.estado)) {
```

- [ ] **Step 4: Guardar nodo**

### Step 2b — Agregar nodo "6b. Rutear Adelanto"

- [ ] **Step 5: Insertar nodo IF entre nodo 6 (false) y nodo "7a. Ejecutar Bot"**

1. Desconectar: nodo 6 false branch → "7a. Ejecutar Bot"
2. Agregar nodo **IF**, nombre: `6b. Rutear Adelanto`
3. Condición: `{{ $json.convEstado }}` equals `adelanto_pendiente`
4. Conectar: nodo 6 false → 6b
5. Conectar: 6b FALSE → "7a. Ejecutar Bot"

### Step 2c — Agregar nodo "7c. Ejecutar Adelanto"

- [ ] **Step 6: Agregar nodo Execute Workflow**

1. Tipo: **Execute Workflow**, nombre: `7c. Ejecutar Adelanto`
2. Source: By ID → (poner ID de WF-ADELANTO-2 después de crearlo en Task 6)
3. Conectar: 6b TRUE → 7c
4. Options → Mode: "Run once for all items"

- [ ] **Step 7: Guardar y activar WF01**

- [ ] **Step 8: Test de routing**

Enviar WhatsApp desde número de prueba (estado normal, no `adelanto_pendiente`).
Expected en Executions: nodo 6b → FALSE → "7a. Ejecutar Bot". Flow normal.

---

## Task 3: WF-REMINDER — Setear estado al enviar recordatorio

**Files:** `consultorio-kit/n8n/WF-REMINDER-recordatorios.json` → nodo "Enviar Recordatorios"

El problema: WF-REMINDER envía el template pero no setea `ctx.estado`, así cuando el paciente responde WF01 lo manda a WF02 como conversación nueva.

- [ ] **Step 1: Abrir WF-REMINDER → nodo "Enviar Recordatorios"**

- [ ] **Step 2: Encontrar el bloque que marca `recordatorio_enviado: true`**

```javascript
await supaUpdate('consultorio_turnos', `id=eq.${turno.id}`, { recordatorio_enviado: true });
enviados++;
```

- [ ] **Step 3: Reemplazar con versión que setea el estado de la conversación**

```javascript
await supaUpdate('consultorio_turnos', `id=eq.${turno.id}`, { recordatorio_enviado: true });

// Setear estado para que el paciente responda en contexto del recordatorio
try {
  const convRes = await helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
    qs: { telefono_wa: `eq.${formatPhone(paciente.telefono_wa)}`, select: 'id,estado,handoff_humano', limit: '1' },
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const convActual = convRes?.[0];
  // Solo setear si el paciente no está en estado más prioritario
  const ESTADOS_PRIORITARIOS = ['adelanto_pendiente', 'procesando'];
  if (convActual && !ESTADOS_PRIORITARIOS.includes(convActual.estado) && !convActual.handoff_humano) {
    await helpers.httpRequest({
      method: 'PATCH',
      url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
      qs: { telefono_wa: `eq.${formatPhone(paciente.telefono_wa)}` },
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: 'respuesta_reminder',
        contexto: {
          turnoId: turno.id,
          profesionalId: turno.profesional_id,
          profesionalNombre: nombreMedico,
          fechaDisplay,
          horaDisplay
        },
        updated_at: new Date().toISOString()
      })
    });
  }
} catch(e) { /* no bloquear si falla el update de conv */ }

enviados++;
```

- [ ] **Step 4: Guardar y testear**

Ejecutar WF-REMINDER manualmente. Verificar en Supabase → `consultorio_conversaciones`: un paciente con turno mañana tiene `estado = 'respuesta_reminder'` y `contexto.turnoId` poblado.

---

## Task 4: WF02 — Reemplazar triggerWaitlist y fix respuesta_reminder

**Files:** `consultorio-kit/n8n/WF02-bot-conversacional.json` → nodo "Bot - Maquina de Estados"

### Step 4a — Agregar `fechaHoraISO` a ctx.turnoACancelar (PRIMERO — lo usan los pasos siguientes)

- [ ] **Step 1: Abrir WF02 → "Bot - Maquina de Estados"**

- [ ] **Step 2: Encontrar los 2 bloques donde se construye `ctx.turnoACancelar`**

Buscar (aparece dos veces con estructura similar):
```javascript
ctx.turnoACancelar = { id: t.id, profId: t.profesional_id, profNombre: pf?.[0]?.nombre||'', especialidad: pf?.[0]?.especialidad||'', fecha: fmtFechaLarga(d), hora:
```

- [ ] **Step 3: En AMBOS bloques, agregar `fechaHoraISO: t.fecha_hora`**

Resultado esperado (en ambos):
```javascript
ctx.turnoACancelar = {
  id: t.id,
  profId: t.profesional_id,
  profNombre: pf?.[0]?.nombre || '',
  especialidad: pf?.[0]?.especialidad || '',
  fecha: fmtFechaLarga(d),
  hora: `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`,
  fechaHoraISO: t.fecha_hora   // ← AGREGAR ESTO
};
```

### Step 4b — Nueva función `triggerAdelanto` (reemplaza `triggerWaitlist`)

- [ ] **Step 4: Encontrar la función `triggerWaitlist`**

```javascript
async function triggerWaitlist(profId) {
```

- [ ] **Step 5: Agregar `triggerAdelanto` ANTES de `triggerWaitlist`**

```javascript
async function triggerAdelanto(slotFecha, profId, cancelantePacienteId) {
  const N8N_HOST = $env.N8N_HOST || $env.WEBHOOK_URL || '';
  if (!N8N_HOST || !slotFecha || !profId) return;
  try {
    await helpers.httpRequest({
      method: 'POST',
      url: `${N8N_HOST}/webhook/adelanto-buscar`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot_fecha: slotFecha,
        profesional_id: profId,
        intento: 1,
        excluir_pacientes: cancelantePacienteId ? [cancelantePacienteId] : []
      })
    });
  } catch(e) { /* fire-and-forget */ }
}
```

### Step 4c — Reemplazar las 4 llamadas a `triggerWaitlist` en cancelaciones

- [ ] **Step 6: Estado `elegir_accion_turno` → `accion_reprogramar`**

Buscar:
```javascript
await triggerWaitlist(ctx.turnoACancelar.profId);
await sendText(phone, `Turno cancelado. Ahora elegí un nuevo horario con ${ctx.turnoACancelar.profNombre}:`);
```
Reemplazar:
```javascript
await triggerAdelanto(ctx.turnoACancelar.fechaHoraISO, ctx.turnoACancelar.profId, ctx.pacienteId);
await sendText(phone, `Turno cancelado. Ahora elegí un nuevo horario con ${ctx.turnoACancelar.profNombre}:`);
```

- [ ] **Step 7: Estado `confirmar_cancelacion` → `cancel_si`**

Buscar:
```javascript
await triggerWaitlist(ctx.turnoACancelar.profId);
ctx.turnoACancelar = undefined;
await updateConv(phone, 'inicio', {});
```
Reemplazar:
```javascript
await triggerAdelanto(ctx.turnoACancelar.fechaHoraISO, ctx.turnoACancelar.profId, ctx.pacienteId);
ctx.turnoACancelar = undefined;
await updateConv(phone, 'inicio', {});
```

- [ ] **Step 8: Estado `respuesta_reminder` → `rem_reprogramar` y `rem_cancelar` (2 ocurrencias)**

Buscar (aparece dos veces dentro del handler `respuesta_reminder`):
```javascript
if (ctx.profesionalId) await triggerWaitlist(ctx.profesionalId);
```
Reemplazar AMBAS con:
```javascript
if (ctx.profesionalId && ctx.turnoId) {
  const tRes = await supaGet('consultorio_turnos', { id: `eq.${ctx.turnoId}`, select: 'fecha_hora,paciente_id' });
  if (tRes?.[0]) await triggerAdelanto(tRes[0].fecha_hora, ctx.profesionalId, tRes[0].paciente_id);
}
```

### Step 4d — Fix `respuesta_reminder`: aceptar texto además de botones

- [ ] **Step 9: Encontrar el inicio del handler `respuesta_reminder`**

```javascript
if (estado === 'respuesta_reminder') {
  const tId = ctx.turnoId;
  if (btnId === 'rem_confirmar') {
```

- [ ] **Step 10: Insertar parsing de texto ANTES del primer `if (btnId...)`**

```javascript
if (estado === 'respuesta_reminder') {
  const tId = ctx.turnoId;

  // Normalizar texto libre a btnId equivalente
  if (!btnId) {
    const t = (texto || '').trim();
    if (/^(SI|SÍ|S[IÍ]|1|CONFIRMO|DALE|OK|CLARO|ASISTO|VOY)$/i.test(t))   btnId = 'rem_confirmar';
    else if (/^(REPROGRAMAR|CAMBIAR|OTRO HORARIO|CAMBIO)$/i.test(t))         btnId = 'rem_reprogramar';
    else if (/^(NO|CANCELO|CANCELAR|2|NO PUEDO|NO VOY|NO VOY)$/i.test(t))   btnId = 'rem_cancelar';
  }

  // Ambiguo → re-mostrar opciones (max 2 intentos, luego handoff)
  if (!['rem_confirmar','rem_reprogramar','rem_cancelar'].includes(btnId)) {
    ctx.retry_count = (ctx.retry_count || 0) + 1;
    await updateConv(phone, estado, ctx);
    if (ctx.retry_count >= 2) {
      return await sendHandoffWithContext(phone, ctx, estado, 'No puede responder recordatorio');
    }
    await sendButtons(phone,
      `Tenés turno mañana con ${ctx.profesionalNombre || 'tu médico'} a las ${ctx.horaDisplay}. ¿Confirmás?`,
      [{id:'rem_confirmar',title:'Sí, confirmo'},{id:'rem_reprogramar',title:'Reprogramar'},{id:'rem_cancelar',title:'Cancelar'}]
    );
    return [{ json: { action: 'reminder_ambiguous', phone } }];
  }

  // A partir de acá el código existente con if (btnId === 'rem_confirmar') etc. sigue igual
  if (btnId === 'rem_confirmar') {
```

- [ ] **Step 11: Guardar WF02**

---

## Task 5: WF-ADELANTO-1 — Nuevo workflow: buscar candidato y enviar oferta

**Files:** nuevo workflow en n8n → exportar a `consultorio-kit/n8n/WF-ADELANTO-1-buscar-candidato.json`

- [ ] **Step 1: Crear workflow**

n8n → New Workflow → Nombre: `WF-ADELANTO-1 — Buscar Candidato`

- [ ] **Step 2: Agregar Webhook trigger**

HTTP Method: POST | Path: `adelanto-buscar` | Response mode: Respond immediately

- [ ] **Step 3: Agregar nodo Code → "Buscar y Ofertar" — pegar código completo:**

```javascript
// WF-ADELANTO-1: Buscar candidato y enviar oferta de slot liberado
// Fix Bug 1: exclusión acumulativa via BD (no parámetro pasado)
// Fix Bug 2: excluir paciente que canceló (viene en excluir_pacientes)
// Fix Bug 3: filtrar candidatos en handoff activo
const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const WA_TOKEN = $env.META_WHATSAPP_TOKEN;
const PHONE_ID = $env.WA_PHONE_NUMBER_ID;

const input = $input.first().json.body || $input.first().json;
const slot_fecha = input.slot_fecha;
const profesional_id = input.profesional_id;
const intento = parseInt(input.intento) || 1;
// excluir_pacientes se usa como seed (ej: el que canceló), pero la exclusión
// real se construye consultando la BD para acumular todos los ya intentados
const excluir_seed = Array.isArray(input.excluir_pacientes) ? input.excluir_pacientes : [];

if (!slot_fecha || !profesional_id) {
  return [{ json: { action: 'error', reason: 'missing_params' } }];
}
if (intento > 5) {
  return [{ json: { action: 'max_intentos', slot_fecha, profesional_id } }];
}
const slotDate = new Date(slot_fecha);
if (slotDate < new Date(Date.now() + 2 * 60 * 60 * 1000)) {
  return [{ json: { action: 'slot_too_soon', slot_fecha } }];
}

// Info del profesional
const profRes = await helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/consultorio_profesionales`,
  qs: { id: `eq.${profesional_id}`, select: 'nombre,especialidad', limit: '1' },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});
const prof = profRes?.[0];
if (!prof) return [{ json: { action: 'error', reason: 'profesional_not_found' } }];

// --- FIX BUG 1: Construir lista de exclusión acumulativa desde BD ---
// Obtener todos los turno_origen_id de ofertas anteriores para este slot
const ofertasAntRes = await helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/consultorio_adelanto_ofertas`,
  qs: { slot_fecha: `eq.${slot_fecha}`, profesional_id: `eq.${profesional_id}`, select: 'turno_origen_id' },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});
const turnosYaIntentadosIds = (ofertasAntRes || []).map(o => o.turno_origen_id).filter(Boolean);

let pacientesExcluidos = [...excluir_seed];
if (turnosYaIntentadosIds.length) {
  const pacAntRes = await helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/consultorio_turnos`,
    qs: { id: `in.(${turnosYaIntentadosIds.join(',')})`, select: 'paciente_id' },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  pacientesExcluidos = [...new Set([...pacientesExcluidos, ...(pacAntRes || []).map(t => t.paciente_id).filter(Boolean)])];
}
// ---------------------------------------------------------------------

// Buscar candidatos: turno más lejano, quiere_adelanto=true, activo, no excluido
const candidatosRes = await helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/consultorio_turnos`,
  qs: {
    profesional_id: `eq.${profesional_id}`,
    quiere_adelanto: 'eq.true',
    estado: 'in.(agendado,confirmado)',
    fecha_hora: `gt.${slot_fecha}`,
    select: 'id,fecha_hora,paciente_id',
    order: 'fecha_hora.desc',
    limit: '20'
  },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});

// Filtrar excluidos
let candidatos = (candidatosRes || []).filter(c => !pacientesExcluidos.includes(c.paciente_id));
if (!candidatos.length) {
  return [{ json: { action: 'no_candidatos', slot_fecha, profesional_id, intento } }];
}

// --- FIX BUG 3: Filtrar pacientes en handoff activo ---
// Obtener teléfonos de los candidatos para verificar estado handoff
const pacIdsParaHandoffCheck = candidatos.map(c => c.paciente_id);
const pacTelRes = await helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/consultorio_pacientes`,
  qs: { id: `in.(${pacIdsParaHandoffCheck.join(',')})`, select: 'id,telefono_wa' },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});
const telPorPacienteId = {};
(pacTelRes || []).forEach(p => { telPorPacienteId[p.id] = p.telefono_wa; });

const telefonos = Object.values(telPorPacienteId).filter(Boolean);
let pacientesEnHandoff = new Set();
if (telefonos.length) {
  const convRes = await helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
    qs: { telefono_wa: `in.(${telefonos.join(',')})`, handoff_humano: 'eq.true', select: 'telefono_wa' },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const telEnHandoff = new Set((convRes || []).map(c => c.telefono_wa));
  // Mapear de vuelta a paciente_id
  Object.entries(telPorPacienteId).forEach(([pacId, tel]) => {
    if (telEnHandoff.has(tel)) pacientesEnHandoff.add(pacId);
  });
}
candidatos = candidatos.filter(c => !pacientesEnHandoff.has(c.paciente_id));
if (!candidatos.length) {
  return [{ json: { action: 'no_candidatos_disponibles', slot_fecha, profesional_id, intento, razon: 'todos_en_handoff_o_excluidos' } }];
}
// -------------------------------------------------------

const turnoOrigen = candidatos[0];

// Datos del paciente elegido
const paciente = { id: turnoOrigen.paciente_id, telefono_wa: telPorPacienteId[turnoOrigen.paciente_id] };
if (!paciente.telefono_wa) return [{ json: { action: 'error', reason: 'paciente_sin_telefono' } }];

const pacNombreRes = await helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/consultorio_pacientes`,
  qs: { id: `eq.${turnoOrigen.paciente_id}`, select: 'nombre', limit: '1' },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});
const paciente_nombre = pacNombreRes?.[0]?.nombre || 'Paciente';

// Crear oferta en BD
const expiraAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
const ofertaRes = await helpers.httpRequest({
  method: 'POST',
  url: `${SUPABASE_URL}/rest/v1/consultorio_adelanto_ofertas`,
  headers: {
    apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json', Prefer: 'return=representation'
  },
  body: JSON.stringify({ slot_fecha, profesional_id, turno_origen_id: turnoOrigen.id, intento, estado: 'pendiente', expira_at: expiraAt })
});
const oferta = ofertaRes?.[0];
if (!oferta?.id) return [{ json: { action: 'error', reason: 'oferta_insert_failed' } }];

// Formatear fechas ART
const OFFSET_ART = -3 * 60 * 60 * 1000;
const DIAS = ['dom','lun','mar','mié','jue','vie','sáb'];
function fmtFecha(isoStr) {
  const d = new Date(new Date(isoStr).getTime() + OFFSET_ART);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth()+1} a las ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
}
const slotDisplay = fmtFecha(slot_fecha);
const turnoActualDisplay = fmtFecha(turnoOrigen.fecha_hora);
const primerNombre = paciente_nombre.split(' ')[0];

// Actualizar ctx del paciente
const nuevoCtx = {
  estado: 'adelanto_pendiente',
  adelantoOfertaId: oferta.id,
  adelantoSlotFecha: slot_fecha,
  adelantoTurnoOrigenId: turnoOrigen.id,
  adelantoTurnoActualFecha: turnoOrigen.fecha_hora,
  adelantoDoctorNombre: prof.nombre,
  adelantoProfesionalId: profesional_id,
  adelantoRepreguntas: 0
};

const convExRes = await helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
  qs: { telefono_wa: `eq.${paciente.telefono_wa}`, select: 'id', limit: '1' },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});

if (convExRes?.length) {
  await helpers.httpRequest({
    method: 'PATCH',
    url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
    qs: { telefono_wa: `eq.${paciente.telefono_wa}` },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'adelanto_pendiente', contexto: nuevoCtx, updated_at: new Date().toISOString() })
  });
} else {
  await helpers.httpRequest({
    method: 'POST',
    url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ telefono_wa: paciente.telefono_wa, estado: 'adelanto_pendiente', contexto: nuevoCtx, handoff_humano: false })
  });
}

// Enviar WhatsApp
const mensaje = `Hola ${primerNombre}! 🗓️\n\nSe liberó un turno con el ${prof.nombre} para el *${slotDisplay}*.\n\n¿Querés adelantar tu turno del ${turnoActualDisplay}?\n\nRespondé *SI* para cambiarlo o *NO* para mantener el actual.`;
await helpers.httpRequest({
  method: 'POST',
  url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
  headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messaging_product: 'whatsapp', to: paciente.telefono_wa, type: 'text', text: { body: mensaje } })
});

return [{ json: { action: 'oferta_enviada', ofertaId: oferta.id, paciente: paciente_nombre, slot: slotDisplay, turnoActual: turnoActualDisplay, intento } }];
```

- [ ] **Step 4: Conectar Webhook → Code → Save → Activate**

- [ ] **Step 5: Anotar el webhook URL**

Formato: `https://[instancia]/webhook/adelanto-buscar`. Lo usan WF02, WF-ADELANTO-2 y WF-ADELANTO-CRON.

- [ ] **Step 6: Test manual**

Primero verificar en Supabase que existe al menos 1 turno con `quiere_adelanto = true`:
```sql
SELECT id, fecha_hora, profesional_id FROM consultorio_turnos
WHERE quiere_adelanto = true AND estado IN ('agendado','confirmado')
LIMIT 3;
```

Luego ejecutar (reemplazar UUIDs reales):
```bash
curl -X POST https://[instancia]/webhook/adelanto-buscar \
  -H "Content-Type: application/json" \
  -d '{"slot_fecha":"2026-06-01T13:00:00Z","profesional_id":"[uuid-prof]","intento":1,"excluir_pacientes":[]}'
```

Expected: `{"action":"oferta_enviada",...}` — WhatsApp llega al paciente y se crea fila en `consultorio_adelanto_ofertas`.

- [ ] **Step 7: Exportar**

n8n → WF-ADELANTO-1 → ⋮ → Download → guardar como `consultorio-kit/n8n/WF-ADELANTO-1-buscar-candidato.json`

---

## Task 6: WF-ADELANTO-2 — Nuevo workflow: procesar respuesta del paciente

**Files:** nuevo workflow → exportar a `consultorio-kit/n8n/WF-ADELANTO-2-procesar-respuesta.json`

- [ ] **Step 1: Crear workflow**

Nombre: `WF-ADELANTO-2 — Procesar Respuesta`

- [ ] **Step 2: Agregar trigger**

Tipo: **Execute Workflow Trigger**

- [ ] **Step 3: Agregar nodo Code → "Procesar Respuesta Adelanto" — pegar código completo:**

```javascript
// WF-ADELANTO-2: Procesar respuesta del paciente a oferta de adelanto
const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const WA_TOKEN = $env.META_WHATSAPP_TOKEN;
const PHONE_ID = $env.WA_PHONE_NUMBER_ID;
const N8N_HOST = $env.N8N_HOST || $env.WEBHOOK_URL || '';

const input = $input.first().json;
const phone = input.phone;
const texto = (input.text || '').trim();
const ctx = input.convContexto || {};

const {
  adelantoOfertaId, adelantoSlotFecha, adelantoTurnoOrigenId,
  adelantoTurnoActualFecha, adelantoDoctorNombre, adelantoProfesionalId,
  adelantoRepreguntas = 0
} = ctx;

// Helpers
async function sendText(to, body) {
  await helpers.httpRequest({
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } })
  });
}
async function updateConv(ph, estado, contexto) {
  await helpers.httpRequest({
    method: 'PATCH',
    url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
    qs: { telefono_wa: `eq.${ph}` },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado, contexto: contexto || {}, updated_at: new Date().toISOString() })
  });
}
async function callAdelanto1(slotFecha, profId, intento, excluirPacientes) {
  if (!N8N_HOST) return;
  try {
    await helpers.httpRequest({
      method: 'POST',
      url: `${N8N_HOST}/webhook/adelanto-buscar`,
      headers: { 'Content-Type': 'application/json' },
      // Nota: WF-ADELANTO-1 construirá la exclusión acumulativa desde BD.
      // Este parámetro solo sirve como seed extra (el que acaba de rechazar).
      body: JSON.stringify({ slot_fecha: slotFecha, profesional_id: profId, intento, excluir_pacientes: excluirPacientes || [] })
    });
  } catch(e) {}
}

const OFFSET_ART = -3 * 60 * 60 * 1000;
const DIAS = ['dom','lun','mar','mié','jue','vie','sáb'];
function fmtFecha(isoStr) {
  const d = new Date(new Date(isoStr).getTime() + OFFSET_ART);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth()+1} a las ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
}

// Lock
await updateConv(phone, 'procesando', ctx);

// Fetch oferta
const ofertaRes = await helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/consultorio_adelanto_ofertas`,
  qs: { id: `eq.${adelantoOfertaId}`, select: '*', limit: '1' },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});
const oferta = ofertaRes?.[0];

if (!oferta) {
  await sendText(phone, 'No encontramos una propuesta activa. Escribinos si necesitás algo.');
  await updateConv(phone, 'inicio', {});
  return [{ json: { action: 'oferta_not_found' } }];
}

// Parsing
const SI_RE = /^(SI|SÍ|S[IÍ]|1|DALE|OK|QUIERO|ACEPTO|CONFIRMO|CLARO|BUENO|DE ACUERDO)$/i;
const NO_RE = /^(NO|N|2|NO GRACIAS|PASO|MEJOR NO|NO QUIERO|RECHAZO|NOP|NOPE)$/i;
const esSI = SI_RE.test(texto);
const esNO = NO_RE.test(texto);

// =============================================
// CASO A: Oferta EXPIRADA (respuesta tardía)
// =============================================
if (oferta.estado === 'expirado') {
  if (!esSI) {
    await sendText(phone, `Entendido, tu turno del ${fmtFecha(adelantoTurnoActualFecha)} sigue reservado. 👍`);
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'late_no' } }];
  }
  // SI tardío: verificar estado actual del slot
  const activaRes = await helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/consultorio_adelanto_ofertas`,
    qs: { slot_fecha: `eq.${adelantoSlotFecha}`, profesional_id: `eq.${oferta.profesional_id}`, estado: 'eq.pendiente', limit: '1' },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (activaRes?.length) {
    await sendText(phone, `Tu respuesta llegó mientras lo consultábamos con otra persona. Si no lo confirma, sos el primero de la lista. Te avisamos en breve. 🙌\n\nTu turno del ${fmtFecha(adelantoTurnoActualFecha)} sigue reservado. 👍`);
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'late_si_in_queue' } }];
  }
  const aceptadaRes = await helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/consultorio_adelanto_ofertas`,
    qs: { slot_fecha: `eq.${adelantoSlotFecha}`, profesional_id: `eq.${oferta.profesional_id}`, estado: 'eq.aceptado', limit: '1' },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (aceptadaRes?.length) {
    await sendText(phone, `Lo sentimos, ese turno ya fue tomado por otro paciente. Tu turno del ${fmtFecha(adelantoTurnoActualFecha)} sigue vigente. 👍`);
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'late_si_taken' } }];
  }
  if (new Date(adelantoSlotFecha) < new Date(Date.now() + 2 * 60 * 60 * 1000)) {
    await sendText(phone, `Lo sentimos, ese turno ya no está disponible. Tu turno del ${fmtFecha(adelantoTurnoActualFecha)} sigue vigente. 👍`);
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'late_si_too_soon' } }];
  }
  // Slot libre → re-activar
  const nuevaExpira = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const nuevaRes = await helpers.httpRequest({
    method: 'POST',
    url: `${SUPABASE_URL}/rest/v1/consultorio_adelanto_ofertas`,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ slot_fecha: adelantoSlotFecha, profesional_id: oferta.profesional_id, turno_origen_id: adelantoTurnoOrigenId, intento: oferta.intento, estado: 'pendiente', expira_at: nuevaExpira })
  });
  const nuevaOferta = nuevaRes?.[0];
  await updateConv(phone, 'adelanto_pendiente', { ...ctx, adelantoOfertaId: nuevaOferta?.id, adelantoRepreguntas: 0 });
  await sendText(phone, `¡Buenas noticias! El turno del *${fmtFecha(adelantoSlotFecha)}* todavía está disponible.\n\n¿Confirmás que querés adelantar tu turno del ${fmtFecha(adelantoTurnoActualFecha)}?\n\nRespondé *SI* o *NO*.`);
  return [{ json: { action: 'late_si_reactivated' } }];
}

// =============================================
// CASO B: Oferta ya procesada (no pendiente)
// =============================================
if (oferta.estado !== 'pendiente') {
  await sendText(phone, `Tu turno del ${fmtFecha(adelantoTurnoActualFecha)} sigue vigente. Escribinos si necesitás algo. 👍`);
  await updateConv(phone, 'inicio', {});
  return [{ json: { action: 'oferta_not_pending', estado: oferta.estado } }];
}

// =============================================
// CASO C: Oferta PENDIENTE activa
// =============================================
const turnoOrigenRes = await helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/consultorio_turnos`,
  qs: { id: `eq.${adelantoTurnoOrigenId}`, select: 'id,estado,fecha_hora,paciente_id,profesional_id', limit: '1' },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});
const turnoOrigen = turnoOrigenRes?.[0];

async function marcarOferta(estadoNuevo) {
  await helpers.httpRequest({
    method: 'PATCH',
    url: `${SUPABASE_URL}/rest/v1/consultorio_adelanto_ofertas`,
    qs: { id: `eq.${oferta.id}` },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: estadoNuevo, respuesta_at: new Date().toISOString() })
  });
}

// SI
if (esSI) {
  // Verificar colisión: el slot fue tomado por otra vía
  const slotOcRes = await helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/consultorio_turnos`,
    qs: { profesional_id: `eq.${oferta.profesional_id}`, fecha_hora: `eq.${adelantoSlotFecha}`, estado: 'not.in.(cancelado,auto_cancelado)', limit: '1' },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (slotOcRes?.length) {
    await marcarOferta('cancelado');
    await sendText(phone, `Lo sentimos, ese turno fue tomado en el último momento. Tu turno del ${fmtFecha(adelantoTurnoActualFecha)} sigue vigente. 👍`);
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'collision' } }];
  }
  // Turno origen cancelado mientras esperábamos → crear turno nuevo en slot
  if (!turnoOrigen || !['agendado','confirmado'].includes(turnoOrigen.estado)) {
    await marcarOferta('aceptado');
    if (turnoOrigen?.paciente_id) {
      await helpers.httpRequest({
        method: 'POST',
        url: `${SUPABASE_URL}/rest/v1/consultorio_turnos`,
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ paciente_id: turnoOrigen.paciente_id, profesional_id: oferta.profesional_id, fecha_hora: adelantoSlotFecha, estado: 'agendado', quiere_adelanto: true })
      });
    }
    await sendText(phone, `✅ ¡Perfecto! Tu turno quedó agendado para el *${fmtFecha(adelantoSlotFecha)}* con el ${adelantoDoctorNombre}. ¡Hasta entonces! 👋`);
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'accepted_new_booking' } }];
  }
  // Caso normal: mover turno
  const fechaAnterior = turnoOrigen.fecha_hora;
  await helpers.httpRequest({
    method: 'PATCH',
    url: `${SUPABASE_URL}/rest/v1/consultorio_turnos`,
    qs: { id: `eq.${adelantoTurnoOrigenId}` },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha_hora: adelantoSlotFecha, estado: 'agendado', recordatorio_enviado: false, updated_at: new Date().toISOString() })
  });
  await marcarOferta('aceptado');
  await sendText(phone, `✅ ¡Perfecto! Tu turno quedó adelantado al *${fmtFecha(adelantoSlotFecha)}* con el ${adelantoDoctorNombre}.\n\nTu turno anterior del ${fmtFecha(fechaAnterior)} fue liberado. ¡Nos vemos! 👋`);
  await updateConv(phone, 'inicio', {});
  // Cascada: ofrecer el slot liberado (intento 1, sin seed de exclusión — WF-ADELANTO-1 construye la lista desde BD)
  await callAdelanto1(fechaAnterior, oferta.profesional_id, 1, []);
  return [{ json: { action: 'accepted', slotAceptado: adelantoSlotFecha, slotLiberado: fechaAnterior } }];
}

// NO
if (esNO) {
  await marcarOferta('rechazado');
  await sendText(phone, `Entendido, tu turno del ${fmtFecha(adelantoTurnoActualFecha)} sigue reservado. 👍`);
  await updateConv(phone, 'inicio', {});
  // Siguiente candidato — WF-ADELANTO-1 construirá la exclusión acumulativa desde BD
  const excluirSeed = turnoOrigen?.paciente_id ? [turnoOrigen.paciente_id] : [];
  await callAdelanto1(adelantoSlotFecha, oferta.profesional_id, oferta.intento + 1, excluirSeed);
  return [{ json: { action: 'rejected' } }];
}

// AMBIGUO
if (adelantoRepreguntas < 1) {
  await updateConv(phone, 'adelanto_pendiente', { ...ctx, adelantoRepreguntas: adelantoRepreguntas + 1 });
  await sendText(phone,
    `Tenés una propuesta de turno pendiente:\n\n📅 *Turno actual:* ${fmtFecha(adelantoTurnoActualFecha)} con ${adelantoDoctorNombre}\n🗓️ *Nuevo disponible:* ${fmtFecha(adelantoSlotFecha)}\n\n¿Querés adelantarlo?\nRespondé *SI* para cambiarlo o *NO* para mantener el actual.`
  );
  return [{ json: { action: 'ambiguous_repregunta' } }];
}
// Segunda vez ambiguo → tratar como NO
await marcarOferta('rechazado');
await sendText(phone, `Mantenemos tu turno del ${fmtFecha(adelantoTurnoActualFecha)}. Si necesitás algo, escribinos. 👋`);
await updateConv(phone, 'inicio', {});
const excluirSeed2 = turnoOrigen?.paciente_id ? [turnoOrigen.paciente_id] : [];
await callAdelanto1(adelantoSlotFecha, oferta.profesional_id, oferta.intento + 1, excluirSeed2);
return [{ json: { action: 'ambiguous_as_no' } }];
```

- [ ] **Step 4: Conectar trigger → Code → Save → Activate**

- [ ] **Step 5: Copiar ID del workflow y pegarlo en WF01 nodo "7c. Ejecutar Adelanto"**

Settings → copiar ID → WF01 → nodo 7c → Source: By ID → pegar.

- [ ] **Step 6: Test de integración**

En Supabase, setear manualmente en una conversación de prueba:
```sql
UPDATE consultorio_conversaciones
SET estado = 'adelanto_pendiente',
    contexto = '{"adelantoOfertaId":"uuid-inexistente","adelantoTurnoActualFecha":"2026-07-01T10:00:00Z","adelantoDoctorNombre":"Dr. Test"}'
WHERE telefono_wa = '[numero-prueba]';
```
Enviar "SI" desde ese número. Expected: mensaje "No encontramos una propuesta activa." y estado vuelve a `inicio`.

- [ ] **Step 7: Exportar**

Guardar como `consultorio-kit/n8n/WF-ADELANTO-2-procesar-respuesta.json`

---

## Task 7: WF-ADELANTO-CRON — Timeout y expiración automática

**Files:** nuevo workflow → exportar a `consultorio-kit/n8n/WF-ADELANTO-CRON-timeout.json`

- [ ] **Step 1: Crear workflow**

Nombre: `WF-ADELANTO-CRON — Timeout`

- [ ] **Step 2: Agregar Schedule Trigger — cada 10 minutos**

- [ ] **Step 3: Agregar nodo Code → "Expirar y Cascada":**

```javascript
// WF-ADELANTO-CRON: Expirar ofertas vencidas y disparar al siguiente candidato
// NO resetea ctx del paciente — permite manejar respuestas tardías en WF-ADELANTO-2
const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const N8N_HOST = $env.N8N_HOST || $env.WEBHOOK_URL || '';

const vencidas = await helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/consultorio_adelanto_ofertas`,
  qs: { estado: 'eq.pendiente', expira_at: `lte.${new Date().toISOString()}`, select: '*' },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
});

if (!vencidas?.length) return [{ json: { action: 'no_vencidas' } }];

let procesadas = 0;
for (const oferta of vencidas) {
  // Marcar expirada (NO resetear ctx del paciente — lo maneja WF-ADELANTO-2 si el paciente responde tarde)
  await helpers.httpRequest({
    method: 'PATCH',
    url: `${SUPABASE_URL}/rest/v1/consultorio_adelanto_ofertas`,
    qs: { id: `eq.${oferta.id}` },
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'expirado', respuesta_at: new Date().toISOString() })
  });

  if (oferta.intento < 5 && N8N_HOST) {
    // WF-ADELANTO-1 construirá la exclusión acumulativa desde BD automáticamente
    const tRes = await helpers.httpRequest({
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/consultorio_turnos`,
      qs: { id: `eq.${oferta.turno_origen_id}`, select: 'paciente_id', limit: '1' },
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const excluirSeed = tRes?.[0]?.paciente_id ? [tRes[0].paciente_id] : [];
    try {
      await helpers.httpRequest({
        method: 'POST',
        url: `${N8N_HOST}/webhook/adelanto-buscar`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_fecha: oferta.slot_fecha, profesional_id: oferta.profesional_id, intento: oferta.intento + 1, excluir_pacientes: excluirSeed })
      });
    } catch(e) {}
  } else if (oferta.intento >= 5) {
    // Ciclo completo agotado: resetear conversaciones colgadas en adelanto_pendiente para este slot
    const convsRes = await helpers.httpRequest({
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
      qs: { estado: 'eq.adelanto_pendiente', select: 'telefono_wa,contexto' },
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    for (const conv of (convsRes || [])) {
      if (conv.contexto?.adelantoSlotFecha === oferta.slot_fecha && conv.contexto?.adelantoProfesionalId === oferta.profesional_id) {
        await helpers.httpRequest({
          method: 'PATCH',
          url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
          qs: { telefono_wa: `eq.${conv.telefono_wa}` },
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'inicio', contexto: {}, updated_at: new Date().toISOString() })
        });
      }
    }
  }
  procesadas++;
}

return [{ json: { action: 'cron_done', procesadas, ts: new Date().toISOString() } }];
```

- [ ] **Step 4: Conectar → Save → Activate**

- [ ] **Step 5: Test**

Insertar oferta de prueba ya vencida:
```sql
INSERT INTO consultorio_adelanto_ofertas (slot_fecha, profesional_id, turno_origen_id, intento, estado, expira_at)
VALUES ('2026-06-01T13:00:00Z', '[uuid-prof]', '[uuid-turno]', 1, 'pendiente', NOW() - interval '1 minute');
```

Ejecutar "Test Workflow". Expected: la oferta queda `estado = 'expirado'` en Supabase.

- [ ] **Step 6: Exportar**

Guardar como `consultorio-kit/n8n/WF-ADELANTO-CRON-timeout.json`

---

## Task 8: Dashboard Tooljet — Pestaña "Adelantos"

- [ ] **Step 1: Agregar tab** — Nombre: `🔄 Adelantos`

- [ ] **Step 2: Agregar Query "getAdelantosActivos"**

```sql
SELECT
  ao.id,
  ao.slot_fecha AT TIME ZONE 'America/Argentina/Buenos_Aires' AS slot_art,
  ao.intento,
  ao.estado,
  ao.oferta_at AT TIME ZONE 'America/Argentina/Buenos_Aires' AS oferta_art,
  ao.expira_at AT TIME ZONE 'America/Argentina/Buenos_Aires' AS expira_art,
  p.nombre AS paciente,
  p.telefono_wa,
  prof.nombre AS medico,
  t.fecha_hora AT TIME ZONE 'America/Argentina/Buenos_Aires' AS turno_actual_art
FROM consultorio_adelanto_ofertas ao
JOIN consultorio_turnos t ON t.id = ao.turno_origen_id
JOIN consultorio_pacientes p ON p.id = t.paciente_id
JOIN consultorio_profesionales prof ON prof.id = ao.profesional_id
WHERE ao.estado IN ('pendiente','expirado')
  AND ao.created_at > NOW() - INTERVAL '24 hours'
ORDER BY ao.oferta_at DESC;
```

- [ ] **Step 3: Tabla** — columnas: Paciente | Médico | Slot ofrecido | Turno actual | Intento | Estado | Expira

- [ ] **Step 4: Botón "Cancelar" por fila**

Query `cancelarOferta`: `UPDATE consultorio_adelanto_ofertas SET estado = 'cancelado' WHERE id = '{{parameters.id}}';`

OnClick: run `cancelarOferta({id: row.id})` → run `getAdelantosActivos`.

- [ ] **Step 5: Auto-refresh cada 30 segundos**

---

## Task 9: Dashboard Tooljet — Pestaña "En Vivo"

- [ ] **Step 1: Agregar tab** — Nombre: `👁️ En Vivo`

- [ ] **Step 2: Agregar Query "getConversacionesActivas"**

```sql
SELECT
  c.telefono_wa,
  c.estado,
  c.handoff_humano,
  EXTRACT(EPOCH FROM (NOW() - c.updated_at)) / 60 AS minutos_inactivo,
  p.nombre AS paciente,
  c.contexto->>'ultimoMensaje' AS ultimo_mensaje
FROM consultorio_conversaciones c
LEFT JOIN consultorio_pacientes p ON p.telefono_wa = c.telefono_wa
WHERE c.updated_at > NOW() - INTERVAL '2 hours'
  AND c.estado != 'inicio'
ORDER BY c.updated_at DESC;
```

- [ ] **Step 3: Tabla** — columnas: Paciente | Estado (badge color) | Último mensaje | Hace (min) | Handoff

Badge colors: `adelanto_pendiente`=naranja, `respuesta_reminder`=amarillo, `handoff_humano=true`=rojo, resto=azul.

- [ ] **Step 4: Botón "Tomar handoff" por fila**

Query `tomarHandoff`: `UPDATE consultorio_conversaciones SET handoff_humano = true WHERE telefono_wa = '{{parameters.phone}}';`

- [ ] **Step 5: Auto-refresh cada 30 segundos**

---

## Verificación final — Smoke test completo

- [ ] **Test 1: Cancelación dispara cascada correctamente**

1. Sacar 3 turnos de prueba con el mismo médico (fechas lejanas distintas)
2. Cancelar uno de ellos via bot (el paciente manda "Cancelar")
3. Expected: WF-ADELANTO-1 se dispara → el paciente con el turno MÁS LEJANO recibe WhatsApp
4. Verificar en Supabase: `consultorio_adelanto_ofertas` tiene 1 fila `pendiente`

- [ ] **Test 2: SI funciona y cascada continúa**

El candidato responde "SI". Expected: su turno se mueve al slot, recibe confirmación, el slot anterior se ofrece al siguiente.

- [ ] **Test 3: NO inmediato pasa al siguiente sin esperar**

El candidato responde "NO". Expected: mensaje de confirmación de turno vigente, WF-ADELANTO-1 se dispara con siguiente candidato.

- [ ] **Test 4: Respuesta ambigua**

El candidato responde "Hola". Expected: re-pregunta con contexto de la oferta. Segunda respuesta ambigua → trata como NO.

- [ ] **Test 5: Timeout de 20 minutos**

No responder. Esperar que el cron (10 min) expire la oferta. Expected: oferta en `expirado`, WF-ADELANTO-1 disparado para siguiente candidato.

- [ ] **Test 6: Respuesta tardía (después del timeout)**

El candidato responde "SI" después de que expiró. Expected: mensaje "Tu respuesta llegó mientras lo consultábamos..." o re-activación si el slot está libre.

- [ ] **Test 7: El paciente que cancela no recibe su propio slot (Bug 2)**

El paciente que cancela tiene otro turno más lejano con el mismo médico. Expected: NO le llega la oferta. Le llega al siguiente candidato.

- [ ] **Test 8: WF-REMINDER setea estado**

Ejecutar WF-REMINDER. El paciente responde "Confirmo". Expected: WF02 reconoce el estado `respuesta_reminder`, confirma el turno, NO reinicia el flujo desde cero.

- [ ] **Commit final**

```bash
git add consultorio-kit/n8n/WF-ADELANTO-*.json \
        consultorio-kit/n8n/WF01-gateway-whatsapp.json \
        consultorio-kit/n8n/WF-REMINDER-recordatorios.json \
        consultorio-kit/n8n/WF02-bot-conversacional.json \
        docs/superpowers/specs/2026-05-13-adelanto-turnos-design.md \
        docs/superpowers/plans/2026-05-13-adelanto-turnos.md
git commit -m "feat(adelanto): sistema de cascada de slots + fix routing proactivo WF01 + fix respuesta_reminder"
```

---

## Limitaciones conocidas (no bugs — deuda técnica)

| Limitación | Impacto | Resolución futura |
|------------|---------|-------------------|
| Opt-out toggle en WF08 no implementado | Todos los turnos web son opt-in por DEFAULT TRUE | Agregar toggle en página de check-in |
| `consultorio_adelanto_ofertas` crece sin cleanup | A largo plazo la tabla se llena | Cron mensual: `DELETE WHERE created_at < NOW() - interval '30 days'` |
| Cancelaciones en demo mode disparan WF-ADELANTO-1 | Termina en `no_candidatos`, sin impacto real | Agregar guard: si `$env.DEMO_MODE === 'true'`, saltar |
