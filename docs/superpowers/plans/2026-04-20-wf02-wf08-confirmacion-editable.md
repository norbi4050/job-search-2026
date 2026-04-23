# WF02 + WF08 — Confirmación editable, CTA button y retorno a WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar al demo de Consultorios (WF02 + WF08) cuatro mejoras de UX: (1) resumen final editable pre-booking, (2) botón CTA WhatsApp en lugar de link texto, (3) redirect automático desde la web de booking al chat, (4) verificación proactiva de datos del paciente recurrente con opción "Actualizar mis datos".

**Architecture:** Modificaciones al código JavaScript dentro de nodos `Code` de dos workflows n8n existentes. Ningún workflow nuevo, ninguna tabla de Supabase nueva, ninguna dependencia externa nueva. Deploy vía `PUT /api/v1/workflows/{id}` de n8n Public API.

**Tech Stack:** n8n Cloud (v1.x Public API), WhatsApp Cloud API v21.0 (incluyendo `interactive / cta_url`), Supabase REST, Anthropic Claude Haiku 4.5.

**Spec de referencia:** `docs/superpowers/specs/2026-04-20-wf02-wf08-confirmacion-editable-design.md`

---

## Nota sobre TDD en este plan

Este proyecto **no tiene suite de tests automatizados** — la lógica vive dentro de nodos `Code` de n8n. El patrón TDD clásico (escribir test que falla, hacer pasar) no aplica directamente. Adaptamos la disciplina así:

- **Paso "red"**: describir con precisión el comportamiento esperado antes de codear.
- **Paso "green"**: aplicar el cambio y **verificar en vivo** enviando mensajes de WhatsApp al bot.
- **Paso "commit"**: checkpoint del plan en git cada vez que un cambio queda verificado.

La verificación manual vía WhatsApp es el test. Cada task explicita qué mensaje enviar y qué se espera ver.

---

## Prerrequisitos del ambiente

Antes de empezar:

1. **n8n Public API key** (JWT) de la instancia `nexo-terra-n8n.6fwciw.easypanel.host`. El owner la rota/entrega por sesión. **No commitear a git.**
2. **Número de WhatsApp del paciente de prueba** (el tuyo o uno de testing) — porque vamos a mandar mensajes reales al bot.
3. **Acceso a Supabase** (panel web) para setear fechas de `consultorio_turnos` en casos de test del Feature 4 (simular paciente inactivo).
4. **Node.js ≥ 20** local para scripts de push.

**Guardar el token como variable de entorno local:**

```bash
export N8N_API_KEY='eyJhbGc...'   # JWT completo
export N8N_BASE='https://nexo-terra-n8n.6fwciw.easypanel.host'
```

Estos valores se usan en todos los scripts de push.

---

## File Structure

No se crean archivos productivos nuevos. Se trabaja sobre dos workflows existentes:

| Workflow | ID | Nodo con código | Función |
|---|---|---|---|
| WF02 Bot Conversacional | `la5XjIMeKIMoTa0q` | `Bot - Maquina de Estados` (Code) | Todo el state machine del bot |
| WF08 Selector de Turnos Web | `lNSGEWwP4VlSVES8` | `Selector de Turnos` (Code) | HTML server-side del booking |

**Archivos locales transitorios** (no commitear):

- `.work/wf02.json`, `.work/wf02-code.js` — snapshot del workflow para editar.
- `.work/wf08.json`, `.work/wf08-code.js` — idem WF08.
- `.work/push.js` — script genérico que lee JSON + código y hace PUT.

Agregar `.work/` a `.gitignore` al inicio de la Task 0 para evitar leaks del token o del workflow completo.

**Archivos a commitear:**

- `docs/superpowers/plans/2026-04-20-wf02-wf08-confirmacion-editable.md` (este archivo — checkboxes se marcan).
- Eventuales notas en `docs/superpowers/notes/` si surgen decisiones de implementación que no estaban en el spec.

---

## Task 0: Setup del entorno de trabajo

**Files:**
- Create: `.gitignore` (agregar entrada)
- Create: `.work/push.js`

- [ ] **Step 1: Agregar `.work/` a `.gitignore`**

Abrir `.gitignore` y agregar al final:

```
# n8n workflow scratch space (contains full workflow JSON — never commit)
.work/
```

- [ ] **Step 2: Crear directorio `.work/`**

```bash
mkdir -p .work
```

- [ ] **Step 3: Escribir el script genérico de push**

Crear `.work/push.js`:

```js
// Uso: node .work/push.js <workflow-id> <json-path> <code-path> <code-node-index>
// Ej: node .work/push.js la5XjIMeKIMoTa0q .work/wf02.json .work/wf02-code.js 1
const fs = require('fs');

const [, , workflowId, jsonPath, codePath, nodeIdxStr] = process.argv;
if (!workflowId || !jsonPath || !codePath || !nodeIdxStr) {
  console.error('Usage: node .work/push.js <workflowId> <jsonPath> <codePath> <nodeIdx>');
  process.exit(1);
}

const token = process.env.N8N_API_KEY;
const base = process.env.N8N_BASE;
if (!token || !base) {
  console.error('Set N8N_API_KEY and N8N_BASE env vars');
  process.exit(1);
}

const wf = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const code = fs.readFileSync(codePath, 'utf8');
const nodeIdx = parseInt(nodeIdxStr, 10);
wf.nodes[nodeIdx].parameters.jsCode = code;

const payload = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings || {},
  staticData: wf.staticData || null
};

(async () => {
  const r = await fetch(`${base}/api/v1/workflows/${workflowId}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await r.text();
  console.log('Status:', r.status);
  if (r.status !== 200) { console.log(body.slice(0, 1000)); process.exit(1); }
  console.log('OK — workflow actualizado');
})();
```

- [ ] **Step 4: Escribir el script genérico de pull**

Crear `.work/pull.js`:

```js
// Uso: node .work/pull.js <workflow-id> <json-path> <code-path> <code-node-index>
const fs = require('fs');

const [, , workflowId, jsonPath, codePath, nodeIdxStr] = process.argv;
const token = process.env.N8N_API_KEY;
const base = process.env.N8N_BASE;
if (!token || !base) { console.error('Set N8N_API_KEY and N8N_BASE'); process.exit(1); }

(async () => {
  const r = await fetch(`${base}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': token }
  });
  if (r.status !== 200) { console.log(await r.text()); process.exit(1); }
  const wf = await r.json();
  fs.writeFileSync(jsonPath, JSON.stringify(wf, null, 2));
  fs.writeFileSync(codePath, wf.nodes[parseInt(nodeIdxStr, 10)].parameters.jsCode);
  console.log(`Pulled ${workflowId} → ${jsonPath} + ${codePath} (${wf.nodes[parseInt(nodeIdxStr,10)].parameters.jsCode.split('\n').length} lines)`);
})();
```

- [ ] **Step 5: Commit setup**

```bash
git add .gitignore
git commit -m "chore: ignore .work/ scratch directory for n8n workflow edits"
```

- [ ] **Step 6: Verificar que el setup funciona**

```bash
node .work/pull.js la5XjIMeKIMoTa0q .work/wf02.json .work/wf02-code.js 1
node .work/pull.js lNSGEWwP4VlSVES8 .work/wf08.json .work/wf08-code.js 1
```

Expected: ambos comandos imprimen `Pulled ... → ...` sin errores. Los archivos `.work/wf02-code.js` y `.work/wf08-code.js` existen y contienen JavaScript.

---

# FASE 1 — Feature 3 (WF08 redirect a WhatsApp)

Deploy primero porque es aislado: WF08 no depende de cambios en WF02, y el efecto es solo visual en la página web final.

## Task 1: Agregar constante del número de WhatsApp en WF08

**Files:**
- Modify: `.work/wf08-code.js` (arriba del archivo, después de `PHONE_ID`)

- [ ] **Step 1: Pull fresh copy de WF08**

```bash
node .work/pull.js lNSGEWwP4VlSVES8 .work/wf08.json .work/wf08-code.js 1
```

- [ ] **Step 2: Insertar constantes después de `PHONE_ID`**

Buscar en `.work/wf08-code.js` la línea:

```js
const PHONE_ID = '963190063548521';
```

Y justo después insertar:

```js
const CONSULTORIO_WA_NUMBER = '5491137936325';
const WA_DEEPLINK = `https://wa.me/${CONSULTORIO_WA_NUMBER}`;
```

- [ ] **Step 3: Verificar sintácticamente**

```bash
node --check .work/wf08-code.js
```

Expected: sin output (ningún syntax error).

## Task 2: Modificar `sucPg()` con botón + countdown + redirect

**Files:**
- Modify: `.work/wf08-code.js` función `sucPg()`

- [ ] **Step 1: Agregar CSS al `<style>` de `sucPg()`**

En `sucPg()`, dentro del string de estilos, después del bloque `.cl{...}`, agregar:

```css
.back-wa{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:24px;padding:16px 24px;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:16px;border-radius:100px;box-shadow:0 8px 24px rgba(37,211,102,0.3);min-height:52px;transition:transform 0.2s}.back-wa:active{transform:scale(0.97)}.back-wa svg{width:22px;height:22px}.countdown{margin-top:14px;font-size:13px;color:#64748B;text-align:center}
```

- [ ] **Step 2: Reemplazar el texto de cierre por el botón + countdown**

Buscar en la función `sucPg()`:

```html
<p class="cl">Podés cerrar esta ventana</p>
```

Reemplazar por (usando template literal con `${WA_DEEPLINK}`):

```html
<a href="${WA_DEEPLINK}" class="back-wa"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>Volver a WhatsApp</a><p class="countdown" id="cd">Volviendo en <span id="cd-n">3</span> segundos...</p><script>(function(){var n=3;var el=document.getElementById('cd-n');var iv=setInterval(function(){n--;if(el)el.textContent=n;if(n<=0){clearInterval(iv);location.href='${WA_DEEPLINK}';}},1000);})();</script>
```

Toda la línea va dentro del mismo template literal existente de `sucPg()` (retorna una string con backticks).

- [ ] **Step 3: Verificar sintácticamente**

```bash
node --check .work/wf08-code.js
```

Expected: sin output.

- [ ] **Step 4: Smoke test local de la función `sucPg`**

Crear archivo temporal `.work/test-sucpg.js`:

```js
const code = require('fs').readFileSync('.work/wf08-code.js', 'utf8');
// Extraer la función sucPg usando un eval controlado dentro de un scope con mocks
const sucPgMatch = code.match(/function sucPg\(prof, fecha, hora\) \{([\s\S]*?)^\}/m);
if (!sucPgMatch) throw new Error('No se encontró sucPg');
const WA_DEEPLINK = 'https://wa.me/5491137936325';
const fn = new Function('prof', 'fecha', 'hora', 'WA_DEEPLINK', `${sucPgMatch[1]}`);
const html = fn({ nombre: 'Dra. López', especialidad: 'Cardiología', consultorio: 'Consultorio 3' }, 'Mar 23 de Abril', '10:30', WA_DEEPLINK);
require('fs').writeFileSync('.work/test-sucpg.html', html);
console.log('OK — HTML escrito a .work/test-sucpg.html');
```

```bash
node .work/test-sucpg.js
```

Expected: `OK — HTML escrito a .work/test-sucpg.html`. Abrir el archivo `.work/test-sucpg.html` en un navegador y verificar:
- Tick verde animado aparece.
- Datos del profesional visibles.
- Botón verde "Volver a WhatsApp" visible.
- Texto "Volviendo en 3... 2... 1... segundos" con countdown funcionando.
- Al llegar a 0, redirige al link `wa.me/5491137936325` (saldrá error si no hay WA instalado, pero el redirect ocurre).

## Task 3: Push WF08 y verificación live

- [ ] **Step 1: Push WF08 actualizado**

```bash
node .work/push.js lNSGEWwP4VlSVES8 .work/wf08.json .work/wf08-code.js 1
```

Expected: `Status: 200 / OK — workflow actualizado`

- [ ] **Step 2: Test live end-to-end**

Desde WhatsApp del número de prueba, enviar al bot:
1. "hola"
2. Responder con DNI válido (ver Supabase qué paciente usar).
3. Si es nuevo, completar nombre y OS. Si es recurrente, usar el menú.
4. Seleccionar "Sacar turno" → elegir especialidad → elegir profesional (si aplica).
5. El bot manda el link de selección de horarios. **Abrir el link**.
6. En la página: elegir un día y un horario, tocar "Confirmar turno".

**Verificar en la pantalla de éxito**:
- ✓ Aparece el tick verde animado.
- ✓ Se ve el resumen del turno.
- ✓ Aparece el botón verde "Volver a WhatsApp" grande abajo.
- ✓ Aparece el texto "Volviendo en 3 segundos..." con countdown.
- ✓ A los 3 segundos, la página redirige automáticamente al chat de WhatsApp.
- ✓ En WhatsApp aparece el mensaje de confirmación del turno (push que ya existía).

**Verificar en Supabase**:
- En `consultorio_turnos` existe una fila nueva con `estado: agendado`.

- [ ] **Step 3: Commit milestone Feature 3**

```bash
git add docs/superpowers/plans/2026-04-20-wf02-wf08-confirmacion-editable.md
git commit -m "feat(WF08): redirect automático a WhatsApp post-booking (Feature 3)"
```

---

# FASE 2 — Feature 2 (botón CTA WhatsApp)

## Task 4: Agregar helper `sendCTAUrl` en WF02

**Files:**
- Modify: `.work/wf02-code.js` (helpers al inicio, junto a `sendList`)

- [x] **Step 1: Pull fresh copy de WF02**

```bash
node .work/pull.js la5XjIMeKIMoTa0q .work/wf02.json .work/wf02-code.js 1
```

- [x] **Step 2: Agregar función `sendCTAUrl` después de `sendList`**

Buscar en `.work/wf02-code.js` el final de `sendList`:

```js
async function sendList(phone, text, buttonText, sections) {
  await helpers.httpRequest({ method: 'POST', url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: { type: 'list', body: { text }, action: { button: buttonText.substring(0,20), sections } } }) });
}
```

Y después insertar:

```js
async function sendCTAUrl(phone, text, buttonText, url) {
  await helpers.httpRequest({
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
    headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text },
        action: { name: 'cta_url', parameters: { display_text: buttonText.substring(0, 20), url } }
      }
    })
  });
}
```

- [x] **Step 3: Verificar syntax**

```bash
node --check .work/wf02-code.js
```

Expected: sin output.

## Task 5: Reemplazar call site en `mostrarDias()`

**Files:**
- Modify: `.work/wf02-code.js` función `mostrarDias()`

- [x] **Step 1: Reemplazar el `sendText` final de `mostrarDias`**

Buscar:

```js
await sendText(ph, `📅 Elegí tu turno con ${ctx.profesionalNombre} (${ctx.especialidad}):\n\n👉 ${bookingUrl}\n\nTocá el link para ver los horarios disponibles y confirmar.`);
```

Reemplazar por:

```js
await sendCTAUrl(ph,
  `📅 Turno con ${ctx.profesionalNombre} (${ctx.especialidad})\n\nTocá el botón para ver los horarios disponibles.`,
  'Elegir horario',
  bookingUrl);
```

## Task 6: Reemplazar call site en `triggerWaitlist()`

**Files:**
- Modify: `.work/wf02-code.js` función `triggerWaitlist()`

- [x] **Step 1: Reemplazar el `sendText` de `triggerWaitlist`**

Buscar:

```js
await sendText(wPac[0].telefono_wa, `¡Hola ${wPac[0].nombre.split(' ')[0]}! Se liberó un turno con ${wProf?.[0]?.nombre||'el profesional'} (${wProf?.[0]?.especialidad||''}).\n\nElegí tu horario acá:\n👉 ${bUrl}\n\n¡Apurate que se puede ocupar!`);
```

Reemplazar por:

```js
await sendCTAUrl(wPac[0].telefono_wa,
  `¡Hola ${wPac[0].nombre.split(' ')[0]}! 🎉\n\nSe liberó un turno con ${wProf?.[0]?.nombre||'el profesional'} (${wProf?.[0]?.especialidad||''}).\n\n¡Apurate que se puede ocupar!`,
  'Ver turno libre',
  bUrl);
```

## Task 7: Reemplazar call site en `esperando_seguimiento`

**Files:**
- Modify: `.work/wf02-code.js` estado `esperando_seguimiento`

- [x] **Step 1: Reemplazar el `sendText` del agendado de control**

Dentro del bloque `if (btnId === 'fb_seguimiento_si') { ... }`, buscar:

```js
await sendText(phone, `📅 Elegí tu turno de control con ${ctx.profesionalNombre}:\n\n👉 ${bookingUrl}\n\nTocá el link para ver los horarios disponibles.`);
```

Reemplazar por:

```js
await sendCTAUrl(phone,
  `📅 Turno de control con ${ctx.profesionalNombre}\n\nTocá el botón para elegir horario.`,
  'Agendar control',
  bookingUrl);
```

## Task 8: Push WF02 y verificación live Feature 2

- [x] **Step 1: Verificar syntax final**

```bash
node --check .work/wf02-code.js
```

Expected: sin output.

- [x] **Step 2: Push WF02**

```bash
node .work/push.js la5XjIMeKIMoTa0q .work/wf02.json .work/wf02-code.js 1
```

Expected: `Status: 200 / OK — workflow actualizado`

- [x] **Step 3: Test live del call site #1 (mostrarDias)**

Desde WhatsApp: sacar un turno hasta el paso donde normalmente se mandaba el link.

**Verificar**:
- ✓ El mensaje llega con **botón grande "Elegir horario"** dentro del mensaje (no un link texto).
- ✓ El texto del mensaje NO contiene el link visible (solo el texto "Tocá el botón para ver los horarios disponibles.").
- ✓ Al tocar el botón se abre la página de selección de horarios (WF08).

- [ ] **Step 4: Test live del call site #3 (esperando_seguimiento)**

Simular: actualizar un turno en Supabase con `estado: finalizado` y disparar el WF06 Post-Consulta, responder con calificación 4 o 5 → el bot ofrece "Agendar control" → tocar "Sí, agendar".

**Verificar**:
- ✓ Mensaje con botón "Agendar control" (no link texto).

- [ ] **Step 5: Test live del call site #2 (waitlist) — opcional**

Requiere montar un escenario de waitlist. Se puede aplazar al testing final (Task 26).

- [ ] **Step 6: Commit milestone Feature 2**

```bash
git add docs/superpowers/plans/2026-04-20-wf02-wf08-confirmacion-editable.md
git commit -m "feat(WF02): botón CTA WhatsApp reemplaza link texto en booking/waitlist/seguimiento (Feature 2)"
```

---

# FASE 3 — Feature 1 (resumen editable)

## Task 9: Agregar `esRecurrente` en `esperando_dni`

**Files:**
- Modify: `.work/wf02-code.js` estado `esperando_dni`

- [ ] **Step 1: Setear `ctx.esRecurrente = true` al encontrar match**

Dentro del bloque `if (pacs?.length > 0) { ... }`, buscar:

```js
const p = pacs[0]; ctx = { ...ctx, pacienteId: p.id, pacienteNombre: p.nombre, dni, obraSocial: p.obra_social, retry_count: 0 };
```

Reemplazar por:

```js
const p = pacs[0];
ctx = { ...ctx, pacienteId: p.id, pacienteNombre: p.nombre, dni, obraSocial: p.obra_social, esRecurrente: true, retry_count: 0 };
```

No push aún — se agrupa con los otros cambios del Feature 1.

## Task 10: Helper `mostrarResumenConfirmacion`

**Files:**
- Modify: `.work/wf02-code.js` helpers (junto a `mostrarEsps`, `mostrarDias`)

- [ ] **Step 1: Agregar helper después de `mostrarEsps`**

Buscar la función `mostrarEsps`. Inmediatamente después de su `}`, insertar:

```js
async function mostrarResumenConfirmacion(phone, ctx) {
  const osLinea = ctx.obraSocial ? ctx.obraSocial : 'Particular';
  const resumenBody = [
    'Antes de elegir el horario, revisá tus datos:',
    '',
    `👤 Nombre: ${ctx.pacienteNombre}`,
    `🆔 DNI: ${ctx.dni}`,
    `🏥 Obra social: ${osLinea}`,
    `👨‍⚕️ Profesional: ${ctx.profesionalNombre} (${ctx.especialidad})`,
    '',
    '¿Está todo bien?'
  ].join('\n');

  const rowsCorregir = [];
  if (!ctx.esRecurrente) rowsCorregir.push({ id: 'edit_nombre', title: 'Cambiar nombre' });
  rowsCorregir.push({ id: 'edit_os', title: 'Cambiar obra social' });
  rowsCorregir.push({ id: 'edit_especialidad', title: 'Cambiar especialidad' });
  rowsCorregir.push({ id: 'edit_profesional', title: 'Cambiar profesional' });

  await sendList(phone, resumenBody, 'Ver opciones', [
    { title: 'Confirmar', rows: [{ id: 'confirmar_datos_ok', title: '✅ Sí, todo bien' }] },
    { title: 'Corregir', rows: rowsCorregir }
  ]);
}
```

- [ ] **Step 2: Verificar syntax**

```bash
node --check .work/wf02-code.js
```

## Task 11: Manejar `supaInsert` vs `supaUpdate` en `esperando_obra_social`

**Files:**
- Modify: `.work/wf02-code.js` dos lugares dentro de `esperando_obra_social`

La lógica actual inserta paciente cuando termina OS. Si ya existe paciente (porque viene de edición), debe actualizar en vez de insertar.

- [ ] **Step 1: Helper local de persistencia**

Justo antes del bloque `if (estado === 'esperando_obra_social') { ... }`, agregar NO — mejor agregarlo en la sección de helpers globales. Buscar al final del bloque de helpers (después de `mostrarResumenConfirmacion` que acabamos de agregar) y añadir:

```js
async function persistirPacienteOS(phone, ctx) {
  if (ctx.pacienteId) {
    await supaUpdate('consultorio_pacientes',
      { id: `eq.${ctx.pacienteId}` },
      { nombre: ctx.pacienteNombre, obra_social: ctx.obraSocial });
    return ctx.pacienteId;
  }
  const np = await supaInsert('consultorio_pacientes',
    { dni: ctx.dni, nombre: ctx.pacienteNombre, telefono_wa: phone, obra_social: ctx.obraSocial });
  return np?.[0]?.id;
}
```

- [ ] **Step 2: Reemplazar inserts directos en `esperando_obra_social`**

Hay dos lugares dentro del bloque `if (estado === 'esperando_obra_social')` donde hoy se llama a `supaInsert('consultorio_pacientes', ...)`.

**Lugar 1** — rama `if (btnId === 'os_no' || ...)`:

Buscar:

```js
ctx.obraSocial = null; ctx.retry_count = 0;
const np = await supaInsert('consultorio_pacientes', { dni: ctx.dni, nombre: ctx.pacienteNombre, telefono_wa: phone, obra_social: null });
ctx.pacienteId = np?.[0]?.id;
```

Reemplazar por:

```js
ctx.obraSocial = null; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
```

**Lugar 2** — rama de match OS exitosa:

Buscar:

```js
ctx.obraSocial = osR.trim(); ctx.pregOS = undefined; ctx.retry_count = 0;
const np = await supaInsert('consultorio_pacientes', { dni: ctx.dni, nombre: ctx.pacienteNombre, telefono_wa: phone, obra_social: ctx.obraSocial });
ctx.pacienteId = np?.[0]?.id;
```

Reemplazar por:

```js
ctx.obraSocial = osR.trim(); ctx.pregOS = undefined; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
```

**Lugar 3** — rama de selección desde lista (`btnId.startsWith('os_idx_')`):

Buscar:

```js
ctx.obraSocial = osElegida; ctx.pregOS = undefined; ctx.retry_count = 0;
const np = await supaInsert('consultorio_pacientes', { dni: ctx.dni, nombre: ctx.pacienteNombre, telefono_wa: phone, obra_social: ctx.obraSocial });
ctx.pacienteId = np?.[0]?.id;
```

Reemplazar por:

```js
ctx.obraSocial = osElegida; ctx.pregOS = undefined; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
```

## Task 12: Redirigir pre-booking a `confirmar_datos`

**Files:**
- Modify: `.work/wf02-code.js` dos lugares

- [ ] **Step 1: En `esperando_especialidad` rama un solo profesional**

Buscar:

```js
if (pe.length === 1) {
  ctx.profesionalId = pe[0].id; ctx.profesionalNombre = pe[0].nombre; ctx.consultorio = pe[0].consultorio;
  await updateConv(phone, 'elegir_dia', ctx); await mostrarDias(phone, ctx);
}
```

Reemplazar por:

```js
if (pe.length === 1) {
  ctx.profesionalId = pe[0].id; ctx.profesionalNombre = pe[0].nombre; ctx.consultorio = pe[0].consultorio;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
}
```

- [ ] **Step 2: En `esperando_profesional` al final del handler**

Buscar:

```js
ctx.profesionalId=pid; ctx.profesionalNombre=pd?.[0]?.nombre||''; ctx.consultorio=pd?.[0]?.consultorio||'';
await updateConv(phone,'elegir_dia',ctx); await mostrarDias(phone,ctx);
return [{ json: { action: 'prof_ok', phone } }];
```

Reemplazar por:

```js
ctx.profesionalId=pid; ctx.profesionalNombre=pd?.[0]?.nombre||''; ctx.consultorio=pd?.[0]?.consultorio||'';
await updateConv(phone, 'confirmar_datos', ctx);
await mostrarResumenConfirmacion(phone, ctx);
return [{ json: { action: 'prof_ok', phone } }];
```

## Task 13: Handler del estado `confirmar_datos`

**Files:**
- Modify: `.work/wf02-code.js` insertar nuevo estado antes del fallback graduado

- [ ] **Step 1: Insertar bloque completo**

Buscar la línea del fallback graduado que dice aproximadamente:

```js
const classification = await classifyInput(texto, estado);
```

**Justo antes** de esa línea, insertar:

```js
if (estado === 'confirmar_datos') {
  if (btnId === 'confirmar_datos_ok') {
    ctx.retry_count = 0;
    await updateConv(phone, 'elegir_dia', ctx);
    await mostrarDias(phone, ctx);
    return [{ json: { action: 'datos_confirmados', phone } }];
  }
  if (btnId === 'edit_nombre') {
    ctx.retry_count = 0;
    await updateConv(phone, 'esperando_nombre', { ...ctx, edicion: true });
    await sendText(phone, '¿Cuál es tu nombre completo?');
    return [{ json: { action: 'edit_nombre', phone } }];
  }
  if (btnId === 'edit_os') {
    ctx.retry_count = 0;
    await updateConv(phone, 'esperando_obra_social', { ...ctx, edicion: true, pregOS: undefined });
    await sendButtons(phone, '¿Tenés obra social o prepaga?',
      [{ id: 'os_si', title: 'Sí, tengo' }, { id: 'os_no', title: 'No, particular' }]);
    return [{ json: { action: 'edit_os', phone } }];
  }
  if (btnId === 'edit_especialidad') {
    ctx.retry_count = 0;
    await updateConv(phone, 'esperando_especialidad', { ...ctx, edicion: true });
    await mostrarEsps(phone);
    return [{ json: { action: 'edit_especialidad', phone } }];
  }
  if (btnId === 'edit_profesional') {
    ctx.retry_count = 0;
    await updateConv(phone, 'esperando_profesional', { ...ctx, edicion: true });
    const pe = await supaGet('consultorio_profesionales',
      { especialidad: `eq.${ctx.especialidad}`, activo: 'eq.true',
        select: 'id,nombre,consultorio', order: 'nombre.asc' });
    await sendList(phone, `En ${ctx.especialidad} tenemos:`, 'Ver profesionales',
      [{ title: ctx.especialidad, rows: pe.map(p => ({ id: `prof_${p.id}`, title: p.nombre, description: p.consultorio || '' })) }]);
    return [{ json: { action: 'edit_profesional', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No puede confirmar datos');
  }
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'confirmar_datos_retry', phone } }];
}
```

## Task 14: Retorno al resumen post-edición en los 4 estados editables

**Files:**
- Modify: `.work/wf02-code.js` estados `esperando_nombre`, `esperando_obra_social`, `esperando_especialidad`, `esperando_profesional`

Cada estado editable, al terminar su lógica exitosa, debe chequear `ctx.edicion`. Si es true, vuelve al resumen; si no, sigue el flujo normal.

- [ ] **Step 1: En `esperando_nombre`, al final**

Buscar la parte donde setea nombre y avanza:

```js
ctx.pacienteNombre = texto; ctx.retry_count = 0;
await updateConv(phone, 'esperando_obra_social', ctx);
await sendButtons(phone, `Perfecto, ${texto.split(' ')[0]}. ¿Tenés obra social o prepaga?`, [{ id: 'os_si', title: 'Sí, tengo' }, { id: 'os_no', title: 'No, particular' }]);
return [{ json: { action: 'name_ok', phone } }];
```

Reemplazar por:

```js
ctx.pacienteNombre = texto; ctx.retry_count = 0;
if (ctx.edicion) {
  ctx.edicion = false;
  // Persistir el nuevo nombre si ya hay paciente
  if (ctx.pacienteId) {
    await supaUpdate('consultorio_pacientes', { id: `eq.${ctx.pacienteId}` }, { nombre: ctx.pacienteNombre });
  }
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'name_edited', phone } }];
}
await updateConv(phone, 'esperando_obra_social', ctx);
await sendButtons(phone, `Perfecto, ${texto.split(' ')[0]}. ¿Tenés obra social o prepaga?`, [{ id: 'os_si', title: 'Sí, tengo' }, { id: 'os_no', title: 'No, particular' }]);
return [{ json: { action: 'name_ok', phone } }];
```

- [ ] **Step 2: En `esperando_obra_social`, rama `os_no`**

Buscar (la versión ya actualizada de Task 11):

```js
if (btnId === 'os_no' || texto.toLowerCase().includes('particular') || texto.toLowerCase() === 'no') {
  ctx.obraSocial = null; ctx.retry_count = 0;
  ctx.pacienteId = await persistirPacienteOS(phone, ctx);
  await updateConv(phone, 'esperando_especialidad', ctx);
  await sendText(phone, `Sin problema. La consulta particular es $${CONSULTORIO.precioParticular.toLocaleString('es-AR')}. Se abona en recepción.\n\nAhora vamos a buscar tu turno.`);
  await mostrarEsps(phone);
  return [{ json: { action: 'particular_ok', phone } }];
}
```

Reemplazar por:

```js
if (btnId === 'os_no' || texto.toLowerCase().includes('particular') || texto.toLowerCase() === 'no') {
  ctx.obraSocial = null; ctx.retry_count = 0;
  ctx.pacienteId = await persistirPacienteOS(phone, ctx);
  if (ctx.edicion) {
    ctx.edicion = false;
    await updateConv(phone, 'confirmar_datos', ctx);
    await mostrarResumenConfirmacion(phone, ctx);
    return [{ json: { action: 'os_edited_particular', phone } }];
  }
  await updateConv(phone, 'esperando_especialidad', ctx);
  await sendText(phone, `Sin problema. La consulta particular es $${CONSULTORIO.precioParticular.toLocaleString('es-AR')}. Se abona en recepción.\n\nAhora vamos a buscar tu turno.`);
  await mostrarEsps(phone);
  return [{ json: { action: 'particular_ok', phone } }];
}
```

- [ ] **Step 3: En `esperando_obra_social`, rama texto parseado OK (match)**

Buscar:

```js
ctx.obraSocial = osR.trim(); ctx.pregOS = undefined; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
await updateConv(phone, 'esperando_especialidad', ctx);
await sendText(phone, `Perfecto, ${ctx.obraSocial}. ¡Todo listo!\nAhora vamos a buscar tu turno.`);
await mostrarEsps(phone);
return [{ json: { action: 'os_ok', phone, os: ctx.obraSocial } }];
```

Reemplazar por:

```js
ctx.obraSocial = osR.trim(); ctx.pregOS = undefined; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
if (ctx.edicion) {
  ctx.edicion = false;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'os_edited_ok', phone, os: ctx.obraSocial } }];
}
await updateConv(phone, 'esperando_especialidad', ctx);
await sendText(phone, `Perfecto, ${ctx.obraSocial}. ¡Todo listo!\nAhora vamos a buscar tu turno.`);
await mostrarEsps(phone);
return [{ json: { action: 'os_ok', phone, os: ctx.obraSocial } }];
```

- [ ] **Step 4: En `esperando_obra_social`, rama lista interactiva (`os_idx_`)**

Buscar:

```js
ctx.obraSocial = osElegida; ctx.pregOS = undefined; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
await updateConv(phone, 'esperando_especialidad', ctx);
await sendText(phone, `Perfecto, ${ctx.obraSocial}. ¡Todo listo!\nAhora vamos a buscar tu turno.`);
await mostrarEsps(phone);
return [{ json: { action: 'os_ok', phone, os: ctx.obraSocial } }];
```

Reemplazar por:

```js
ctx.obraSocial = osElegida; ctx.pregOS = undefined; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
if (ctx.edicion) {
  ctx.edicion = false;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'os_idx_edited', phone, os: ctx.obraSocial } }];
}
await updateConv(phone, 'esperando_especialidad', ctx);
await sendText(phone, `Perfecto, ${ctx.obraSocial}. ¡Todo listo!\nAhora vamos a buscar tu turno.`);
await mostrarEsps(phone);
return [{ json: { action: 'os_idx_ok', phone, os: ctx.obraSocial } }];
```

- [ ] **Step 5: En `esperando_especialidad`, cuando hay 1 o muchos profesionales**

Ya se cambió en Task 12 para ir a `confirmar_datos` directamente (pasa tanto en flow normal como en edición — efecto idéntico). El `ctx.edicion` se preserva en el `ctx` porque nunca se limpia aquí; se consumirá cuando el profesional se elija y esa lógica lo respete.

No se hace cambio adicional en `esperando_especialidad`. Verificar mentalmente: si estado era edición y usuario cambia de especialidad, queda `edicion=true` y `profesionalId` viejo. Al llegar a `esperando_profesional` y elegir uno nuevo, la Task 14 Step 6 consume el flag.

Pero: ¿qué pasa si la nueva especialidad tiene un solo profesional? Task 12 Step 1 redirige a `confirmar_datos` directo sin consumir `edicion`. Necesitamos limpiar `edicion` cuando llegamos a `confirmar_datos` desde el flujo de edición. Modificar Task 12 Step 1:

Buscar (después de Task 12 Step 1):

```js
if (pe.length === 1) {
  ctx.profesionalId = pe[0].id; ctx.profesionalNombre = pe[0].nombre; ctx.consultorio = pe[0].consultorio;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
}
```

Reemplazar por:

```js
if (pe.length === 1) {
  ctx.profesionalId = pe[0].id; ctx.profesionalNombre = pe[0].nombre; ctx.consultorio = pe[0].consultorio;
  ctx.edicion = false;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
}
```

- [ ] **Step 6: En `esperando_profesional`, al final**

Buscar (después de Task 12 Step 2):

```js
ctx.profesionalId=pid; ctx.profesionalNombre=pd?.[0]?.nombre||''; ctx.consultorio=pd?.[0]?.consultorio||'';
await updateConv(phone, 'confirmar_datos', ctx);
await mostrarResumenConfirmacion(phone, ctx);
return [{ json: { action: 'prof_ok', phone } }];
```

Reemplazar por:

```js
ctx.profesionalId=pid; ctx.profesionalNombre=pd?.[0]?.nombre||''; ctx.consultorio=pd?.[0]?.consultorio||'';
ctx.edicion = false;
await updateConv(phone, 'confirmar_datos', ctx);
await mostrarResumenConfirmacion(phone, ctx);
return [{ json: { action: 'prof_ok', phone } }];
```

## Task 15: Push y verificación live Feature 1

- [ ] **Step 1: Syntax check**

```bash
node --check .work/wf02-code.js
```

- [ ] **Step 2: Push WF02**

```bash
node .work/push.js la5XjIMeKIMoTa0q .work/wf02.json .work/wf02-code.js 1
```

- [ ] **Step 3: Test live — flujo feliz paciente nuevo**

Desde un WhatsApp con DNI NO registrado:
1. "hola" → bot pide DNI.
2. Enviar un DNI nuevo (ej `99887766`).
3. "Juan Pérez de Test" → bot ofrece botones OS.
4. "Sí, tengo" → lista de OS.
5. Elegir OSDE.
6. Bot pide especialidad → elegir una.
7. Bot pide profesional (si hay más de 1) → elegir uno.
8. **Verificar: llega mensaje con resumen + botón "Ver opciones" → lista con "Sí, todo bien" + opciones de cambio.**
9. Tocar "✅ Sí, todo bien" → llega el mensaje con CTA button "Elegir horario".

- [ ] **Step 4: Test live — edición de OS**

Continuar con el paciente del Step 3 (o usar otro):
1. Llegar al resumen.
2. Tocar "Cambiar obra social".
3. Bot ofrece botones "Sí, tengo" / "No, particular".
4. Tocar "Sí, tengo" → lista.
5. Elegir otra OS, ej Swiss Medical.
6. **Verificar: bot vuelve al resumen mostrando Swiss Medical.**
7. **Verificar en Supabase: `consultorio_pacientes.obra_social = 'Swiss Medical'`** para ese DNI. El `pacienteId` es el mismo que antes (no se creó duplicado).

- [ ] **Step 5: Test live — edición de profesional**

1. Llegar al resumen.
2. Tocar "Cambiar profesional".
3. Elegir otro profesional de la lista.
4. **Verificar: bot vuelve al resumen con el nuevo profesional.**

- [ ] **Step 6: Test live — edición de especialidad**

1. Llegar al resumen.
2. Tocar "Cambiar especialidad".
3. Elegir otra especialidad.
4. Si tiene 1 profesional → bot vuelve directo al resumen con nueva especialidad y ese profesional.
5. Si tiene varios → bot pide elegir profesional → al elegir, vuelve al resumen.

- [ ] **Step 7: Test live — "Cambiar nombre" solo si paciente nuevo**

1. Usar un DNI **ya registrado** (recurrente).
2. Avanzar hasta el resumen.
3. **Verificar: la opción "Cambiar nombre" NO aparece.**

4. Usar otro DNI **no registrado** (nuevo).
5. Avanzar hasta el resumen.
6. **Verificar: la opción "Cambiar nombre" SÍ aparece.**

- [ ] **Step 8: Commit milestone Feature 1**

```bash
git add docs/superpowers/plans/2026-04-20-wf02-wf08-confirmacion-editable.md
git commit -m "feat(WF02): resumen final editable pre-booking con edición puntual (Feature 1)"
```

---

# FASE 4 — Feature 4 (verificación + actualización de datos)

## Task 16: Helper `mostrarMenuPrincipal` con lista interactiva

**Files:**
- Modify: `.work/wf02-code.js` helpers

- [ ] **Step 1: Agregar helper junto a los otros**

Después de `mostrarResumenConfirmacion` (o al final del bloque de helpers antes del handler principal), agregar:

```js
async function mostrarMenuPrincipal(phone) {
  await sendList(phone, '¿Qué necesitás?', 'Ver opciones', [
    { title: 'Turnos', rows: [
      { id: 'menu_turno', title: 'Sacar turno' },
      { id: 'menu_cancelar', title: 'Cancelar o reprogramar' },
      { id: 'menu_consultar', title: 'Ver mi próximo turno' }
    ]},
    { title: 'Mi cuenta', rows: [
      { id: 'menu_actualizar', title: 'Actualizar mis datos' }
    ]}
  ]);
}
```

## Task 17: Reemplazar call sites del menú principal

Hay 6 lugares donde hoy se envía el menú principal con `sendButtons`. Todos deben pasar a usar `mostrarMenuPrincipal`.

- [ ] **Step 1: En `esperando_dni` (match encontrado)**

Buscar:

```js
await updateConv(phone, 'menu_principal', ctx);
await sendButtons(phone, `¡Hola ${p.nombre.split(' ')[0]}! Qué bueno verte de nuevo.\n\n¿Qué necesitás?`, [{ id: 'menu_turno', title: 'Sacar turno' }, { id: 'menu_cancelar', title: 'Cancelar/Cambiar' }, { id: 'menu_consultar', title: 'Mi próximo turno' }]);
```

Reemplazar por:

```js
await updateConv(phone, 'menu_principal', ctx);
await sendText(phone, `¡Hola ${p.nombre.split(' ')[0]}! Qué bueno verte de nuevo.`);
await mostrarMenuPrincipal(phone);
```

- [ ] **Step 2: En `accion_volver` (dentro de `elegir_accion_turno`)**

Buscar:

```js
if (btnId === 'accion_volver') {
  await updateConv(phone, 'menu_principal', ctx);
  await sendButtons(phone, '¿Qué necesitás?', [{id:'menu_turno',title:'Sacar turno'},{id:'menu_cancelar',title:'Cancelar/Cambiar'},{id:'menu_consultar',title:'Mi próximo turno'}]);
  return [{ json: { action: 'volver_menu', phone } }];
}
```

Reemplazar por:

```js
if (btnId === 'accion_volver') {
  await updateConv(phone, 'menu_principal', ctx);
  await mostrarMenuPrincipal(phone);
  return [{ json: { action: 'volver_menu', phone } }];
}
```

- [ ] **Step 3: En `cancel_no` (dentro de `confirmar_cancelacion`)**

Buscar:

```js
if (btnId === 'cancel_no') {
  await updateConv(phone, 'menu_principal', ctx);
  await sendButtons(phone, 'Perfecto, no se canceló nada. ¿Qué necesitás?', [{id:'menu_turno',title:'Sacar turno'},{id:'menu_cancelar',title:'Cancelar/Cambiar'},{id:'menu_consultar',title:'Mi próximo turno'}]);
  return [{ json: { action: 'cancel_aborted', phone } }];
}
```

Reemplazar por:

```js
if (btnId === 'cancel_no') {
  await updateConv(phone, 'menu_principal', ctx);
  await sendText(phone, 'Perfecto, no se canceló nada.');
  await mostrarMenuPrincipal(phone);
  return [{ json: { action: 'cancel_aborted', phone } }];
}
```

- [ ] **Step 4: En el retry de `menu_principal`**

Buscar:

```js
await sendButtons(phone,'¿Qué necesitás? Tocá un botón:',[{id:'menu_turno',title:'Sacar turno'},{id:'menu_cancelar',title:'Cancelar/Cambiar'},{id:'menu_consultar',title:'Mi próximo turno'}]);
return [{ json: { action: 'menu_resent', phone } }];
```

Reemplazar por:

```js
await sendText(phone, 'No entendí. Elegí una opción del menú:');
await mostrarMenuPrincipal(phone);
return [{ json: { action: 'menu_resent', phone } }];
```

- [ ] **Step 5: En fallback redirect (clasificación IA = cancelar)**

Buscar:

```js
if (classification.intent === 'cancelar' && ctx.pacienteId) {
  await updateConv(phone, 'menu_principal', ctx);
  await sendButtons(phone, '¿Qué necesitás?', [{id:'menu_turno',title:'Sacar turno'},{id:'menu_cancelar',title:'Cancelar/Cambiar'},{id:'menu_consultar',title:'Mi próximo turno'}]);
  return [{ json: { action: 'fallback_redirect_menu', phone } }];
}
```

Reemplazar por:

```js
if (classification.intent === 'cancelar' && ctx.pacienteId) {
  await updateConv(phone, 'menu_principal', ctx);
  await mostrarMenuPrincipal(phone);
  return [{ json: { action: 'fallback_redirect_menu', phone } }];
}
```

- [ ] **Step 6: En `fb_cancelar` recovery**

Buscar:

```js
await updateConv(phone, 'menu_principal', ctx);
await sendButtons(phone, '¿Qué necesitás?', [{id:'menu_turno',title:'Sacar turno'},{id:'menu_cancelar',title:'Cancelar/Cambiar'},{id:'menu_consultar',title:'Mi próximo turno'}]);
return [{ json: { action: 'fallback_recovery_menu', phone } }];
```

Reemplazar por:

```js
await updateConv(phone, 'menu_principal', ctx);
await mostrarMenuPrincipal(phone);
return [{ json: { action: 'fallback_recovery_menu', phone } }];
```

## Task 18: Handler `menu_actualizar` en `menu_principal`

**Files:**
- Modify: `.work/wf02-code.js` estado `menu_principal`

- [ ] **Step 1: Agregar rama nueva**

Dentro del bloque `if (estado === 'menu_principal') { ... }`, **después** de la rama `menu_chau` y **antes** del retry del fallback (el `retry_count++` del final del menú), agregar:

```js
if (btnId === 'menu_actualizar') {
  ctx.retry_count = 0;
  await updateConv(phone, 'actualizar_datos', ctx);
  await mostrarOpcionesActualizar(phone, ctx);
  return [{ json: { action: 'menu_actualizar', phone } }];
}
```

## Task 19: Helper `mostrarOpcionesActualizar` y estado `actualizar_datos`

**Files:**
- Modify: `.work/wf02-code.js` helpers y nuevo estado

- [ ] **Step 1: Agregar helper junto a los otros**

Después de `mostrarMenuPrincipal`:

```js
async function mostrarOpcionesActualizar(phone, ctx) {
  const osActual = ctx.obraSocial
    ? `🏥 Obra social: ${ctx.obraSocial}`
    : `🏥 Particular (sin obra social)`;
  await sendButtons(phone,
    `¿Qué querés actualizar?\n\n${osActual}`,
    [{ id: 'actualizar_os', title: 'Cambiar obra social' },
     { id: 'actualizar_volver', title: 'Volver al menú' }]);
}
```

- [ ] **Step 2: Agregar handler del estado `actualizar_datos`**

Insertar antes del fallback graduado (al lado del handler de `confirmar_datos` agregado en Task 13):

```js
if (estado === 'actualizar_datos') {
  if (btnId === 'actualizar_os') {
    ctx.retry_count = 0;
    await updateConv(phone, 'esperando_obra_social',
      { ...ctx, edicion: true, modoActualizacion: true, pregOS: undefined });
    await sendButtons(phone, '¿Tenés obra social o prepaga?',
      [{ id: 'os_si', title: 'Sí, tengo' },
       { id: 'os_no', title: 'No, particular' }]);
    return [{ json: { action: 'actualizar_os_start', phone } }];
  }
  if (btnId === 'actualizar_volver') {
    ctx.retry_count = 0;
    await updateConv(phone, 'menu_principal', ctx);
    await mostrarMenuPrincipal(phone);
    return [{ json: { action: 'actualizar_volver_menu', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No puede actualizar datos');
  }
  await mostrarOpcionesActualizar(phone, ctx);
  return [{ json: { action: 'actualizar_retry', phone } }];
}
```

## Task 20: Cierre de edición standalone en `esperando_obra_social`

**Files:**
- Modify: `.work/wf02-code.js` 3 puntos dentro de `esperando_obra_social` (actualiza el código de Task 14)

Cuando el paciente viene desde "Actualizar mis datos" (`ctx.modoActualizacion === true`), al terminar debe volver al menú principal con mensaje de confirmación, no al resumen de booking.

- [ ] **Step 1: Rama `os_no` (particular)**

Buscar (la versión de Task 14 Step 2):

```js
if (btnId === 'os_no' || texto.toLowerCase().includes('particular') || texto.toLowerCase() === 'no') {
  ctx.obraSocial = null; ctx.retry_count = 0;
  ctx.pacienteId = await persistirPacienteOS(phone, ctx);
  if (ctx.edicion) {
    ctx.edicion = false;
    await updateConv(phone, 'confirmar_datos', ctx);
    await mostrarResumenConfirmacion(phone, ctx);
    return [{ json: { action: 'os_edited_particular', phone } }];
  }
  await updateConv(phone, 'esperando_especialidad', ctx);
  await sendText(phone, `Sin problema. La consulta particular es $${CONSULTORIO.precioParticular.toLocaleString('es-AR')}. Se abona en recepción.\n\nAhora vamos a buscar tu turno.`);
  await mostrarEsps(phone);
  return [{ json: { action: 'particular_ok', phone } }];
}
```

Reemplazar por:

```js
if (btnId === 'os_no' || texto.toLowerCase().includes('particular') || texto.toLowerCase() === 'no') {
  ctx.obraSocial = null; ctx.retry_count = 0;
  ctx.pacienteId = await persistirPacienteOS(phone, ctx);
  if (ctx.edicion && ctx.modoActualizacion) {
    ctx.edicion = false; ctx.modoActualizacion = false;
    await sendText(phone, `✅ Listo, actualicé tus datos: ahora figurás como *Particular*.`);
    await updateConv(phone, 'menu_principal', ctx);
    await mostrarMenuPrincipal(phone);
    return [{ json: { action: 'actualizacion_particular_done', phone } }];
  }
  if (ctx.edicion) {
    ctx.edicion = false;
    await updateConv(phone, 'confirmar_datos', ctx);
    await mostrarResumenConfirmacion(phone, ctx);
    return [{ json: { action: 'os_edited_particular', phone } }];
  }
  await updateConv(phone, 'esperando_especialidad', ctx);
  await sendText(phone, `Sin problema. La consulta particular es $${CONSULTORIO.precioParticular.toLocaleString('es-AR')}. Se abona en recepción.\n\nAhora vamos a buscar tu turno.`);
  await mostrarEsps(phone);
  return [{ json: { action: 'particular_ok', phone } }];
}
```

- [ ] **Step 2: Rama texto parseado (match Claude)**

Buscar (la versión de Task 14 Step 3):

```js
ctx.obraSocial = osR.trim(); ctx.pregOS = undefined; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
if (ctx.edicion) {
  ctx.edicion = false;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'os_edited_ok', phone, os: ctx.obraSocial } }];
}
await updateConv(phone, 'esperando_especialidad', ctx);
await sendText(phone, `Perfecto, ${ctx.obraSocial}. ¡Todo listo!\nAhora vamos a buscar tu turno.`);
await mostrarEsps(phone);
return [{ json: { action: 'os_ok', phone, os: ctx.obraSocial } }];
```

Reemplazar por:

```js
ctx.obraSocial = osR.trim(); ctx.pregOS = undefined; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
if (ctx.edicion && ctx.modoActualizacion) {
  ctx.edicion = false; ctx.modoActualizacion = false;
  await sendText(phone, `✅ Listo, actualicé tu obra social a *${ctx.obraSocial}*.`);
  await updateConv(phone, 'menu_principal', ctx);
  await mostrarMenuPrincipal(phone);
  return [{ json: { action: 'actualizacion_os_texto_done', phone, os: ctx.obraSocial } }];
}
if (ctx.edicion) {
  ctx.edicion = false;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'os_edited_ok', phone, os: ctx.obraSocial } }];
}
await updateConv(phone, 'esperando_especialidad', ctx);
await sendText(phone, `Perfecto, ${ctx.obraSocial}. ¡Todo listo!\nAhora vamos a buscar tu turno.`);
await mostrarEsps(phone);
return [{ json: { action: 'os_ok', phone, os: ctx.obraSocial } }];
```

- [ ] **Step 3: Rama lista interactiva (`os_idx_`)**

Buscar (la versión de Task 14 Step 4):

```js
ctx.obraSocial = osElegida; ctx.pregOS = undefined; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
if (ctx.edicion) {
  ctx.edicion = false;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'os_idx_edited', phone, os: ctx.obraSocial } }];
}
await updateConv(phone, 'esperando_especialidad', ctx);
await sendText(phone, `Perfecto, ${ctx.obraSocial}. ¡Todo listo!\nAhora vamos a buscar tu turno.`);
await mostrarEsps(phone);
return [{ json: { action: 'os_idx_ok', phone, os: ctx.obraSocial } }];
```

Reemplazar por:

```js
ctx.obraSocial = osElegida; ctx.pregOS = undefined; ctx.retry_count = 0;
ctx.pacienteId = await persistirPacienteOS(phone, ctx);
if (ctx.edicion && ctx.modoActualizacion) {
  ctx.edicion = false; ctx.modoActualizacion = false;
  await sendText(phone, `✅ Listo, actualicé tu obra social a *${ctx.obraSocial}*.`);
  await updateConv(phone, 'menu_principal', ctx);
  await mostrarMenuPrincipal(phone);
  return [{ json: { action: 'actualizacion_os_idx_done', phone, os: ctx.obraSocial } }];
}
if (ctx.edicion) {
  ctx.edicion = false;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'os_idx_edited', phone, os: ctx.obraSocial } }];
}
await updateConv(phone, 'esperando_especialidad', ctx);
await sendText(phone, `Perfecto, ${ctx.obraSocial}. ¡Todo listo!\nAhora vamos a buscar tu turno.`);
await mostrarEsps(phone);
return [{ json: { action: 'os_idx_ok', phone, os: ctx.obraSocial } }];
```

## Task 21: Constante de días + chequeo 90 días en `esperando_dni`

**Files:**
- Modify: `.work/wf02-code.js` constantes iniciales y estado `esperando_dni`

- [ ] **Step 1: Agregar constante `DIAS_VERIFICACION`**

Arriba, donde están las constantes `CONSULTORIO`, `DIAS`, etc., agregar:

```js
const DIAS_VERIFICACION = 90;
```

- [ ] **Step 2: Reemplazar bloque de match en `esperando_dni`**

Buscar (la versión actualizada por Task 9):

```js
if (pacs?.length > 0) {
  const p = pacs[0];
  ctx = { ...ctx, pacienteId: p.id, pacienteNombre: p.nombre, dni, obraSocial: p.obra_social, esRecurrente: true, retry_count: 0 };
  await updateConv(phone, 'menu_principal', ctx);
  await sendText(phone, `¡Hola ${p.nombre.split(' ')[0]}! Qué bueno verte de nuevo.`);
  await mostrarMenuPrincipal(phone);
}
```

Reemplazar por:

```js
if (pacs?.length > 0) {
  const p = pacs[0];
  ctx = { ...ctx, pacienteId: p.id, pacienteNombre: p.nombre, dni, obraSocial: p.obra_social, esRecurrente: true, retry_count: 0 };

  const ultTurno = await supaGet('consultorio_turnos',
    { paciente_id: `eq.${p.id}`, select: 'fecha_hora',
      order: 'fecha_hora.desc', limit: '1' });
  const diasDesdeUltimo = ultTurno?.[0]
    ? Math.floor((Date.now() - new Date(ultTurno[0].fecha_hora).getTime()) / (1000*60*60*24))
    : 999;

  if (diasDesdeUltimo > DIAS_VERIFICACION) {
    await updateConv(phone, 'verificar_datos', ctx);
    const tiempo = diasDesdeUltimo > 365
      ? 'hace más de un año'
      : `hace ${Math.floor(diasDesdeUltimo/30)} meses`;
    const osLinea = p.obra_social
      ? `🏥 Obra social: ${p.obra_social}`
      : '🏥 Particular (sin obra social)';
    await sendButtons(phone,
      `¡Hola ${p.nombre.split(' ')[0]}! 👋\n\nVeo que no nos vemos ${tiempo}. Antes de seguir, ¿tus datos siguen iguales?\n\n${osLinea}`,
      [{ id: 'verif_ok', title: 'Sí, todo igual' },
       { id: 'verif_actualizar', title: 'Actualizar' }]);
  } else {
    await updateConv(phone, 'menu_principal', ctx);
    await sendText(phone, `¡Hola ${p.nombre.split(' ')[0]}! Qué bueno verte de nuevo.`);
    await mostrarMenuPrincipal(phone);
  }
}
```

## Task 22: Handler del estado `verificar_datos`

**Files:**
- Modify: `.work/wf02-code.js` agregar nuevo estado

- [ ] **Step 1: Insertar bloque antes del fallback graduado**

Junto a los handlers de `confirmar_datos` y `actualizar_datos`, agregar:

```js
if (estado === 'verificar_datos') {
  if (btnId === 'verif_ok') {
    ctx.retry_count = 0;
    await updateConv(phone, 'menu_principal', ctx);
    await mostrarMenuPrincipal(phone);
    return [{ json: { action: 'datos_verificados_ok', phone } }];
  }
  if (btnId === 'verif_actualizar') {
    ctx.retry_count = 0;
    await updateConv(phone, 'actualizar_datos', ctx);
    await mostrarOpcionesActualizar(phone, ctx);
    return [{ json: { action: 'ir_actualizar_desde_verif', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No responde a verificacion de datos');
  }
  await sendButtons(phone, '¿Tus datos siguen iguales?',
    [{ id: 'verif_ok', title: 'Sí, todo igual' },
     { id: 'verif_actualizar', title: 'Actualizar' }]);
  return [{ json: { action: 'verif_retry', phone } }];
}
```

## Task 23: Push y verificación live Feature 4

- [ ] **Step 1: Syntax check**

```bash
node --check .work/wf02-code.js
```

- [ ] **Step 2: Push WF02**

```bash
node .work/push.js la5XjIMeKIMoTa0q .work/wf02.json .work/wf02-code.js 1
```

- [ ] **Step 3: Test live — recurrente activo (<90 días)**

1. Identificar en Supabase un paciente con un turno reciente (últimos 30 días).
2. Desde WhatsApp mandar "hola" → pedir DNI → ingresar el DNI del paciente recurrente reciente.
3. **Verificar**: el bot saluda con nombre y muestra directo el menú **como lista interactiva con 4 opciones** ("Sacar turno", "Cancelar o reprogramar", "Ver mi próximo turno", "Actualizar mis datos").
4. Tocar "Ver opciones" y verificar las 4 filas.

- [ ] **Step 4: Test live — recurrente inactivo (>90 días)**

1. En Supabase, editar un `consultorio_turnos.fecha_hora` de un paciente existente para que sea de hace 100+ días, y asegurarse que ese paciente NO tiene turnos más recientes.
2. Desde WhatsApp mandar "hola" → DNI de ese paciente.
3. **Verificar**: el bot responde con el prompt `"Veo que no nos vemos hace X meses..."` y botones "Sí, todo igual" / "Actualizar".
4. **Caso A**: tocar "Sí, todo igual" → aparece el menú principal normal.
5. **Caso B** (re-iniciar la prueba): tocar "Actualizar" → bot muestra "¿Qué querés actualizar?" con botones "Cambiar obra social" / "Volver al menú".
6. Tocar "Cambiar obra social" → flow de OS → elegir una nueva → **Verificar**: bot confirma "✅ Listo, actualicé tu obra social a X" y muestra el menú principal.
7. **Verificar en Supabase**: `consultorio_pacientes.obra_social` actualizado para ese DNI.

- [ ] **Step 5: Test live — actualización standalone desde menú**

1. Con cualquier paciente recurrente (activo o inactivo), llegar al menú principal.
2. Tocar "Actualizar mis datos".
3. Cambiar OS.
4. **Verificar**: vuelve al menú tras actualizar, DB actualizada.

- [ ] **Step 6: Test live — paciente sin turnos previos**

1. Crear manualmente en Supabase un `consultorio_pacientes` con DNI de prueba y sin turnos.
2. Desde WhatsApp → DNI.
3. **Verificar**: dispara el prompt de verificación (porque `diasDesdeUltimo = 999`).

- [ ] **Step 7: Commit milestone Feature 4**

```bash
git add docs/superpowers/plans/2026-04-20-wf02-wf08-confirmacion-editable.md
git commit -m "feat(WF02): verificación proactiva de datos + actualización standalone del recurrente (Feature 4)"
```

---

# FASE 5 — Integración end-to-end y cleanup

## Task 24: Testing integral (todos los casos del spec §9)

- [ ] **Step 1: Caso 9.1 — Flujo feliz paciente nuevo**

Ya probado en Tasks 3 y 15. Re-ejecutar end-to-end para confirmar integración con Feature 4:
- DNI nuevo → nombre → OS → especialidad → profesional → resumen → confirmar → CTA button → web → redirect a WhatsApp → push confirmación. Todo en un solo flujo.

- [ ] **Step 2: Caso 9.2, 9.3, 9.4 — ediciones**

Ya cubiertos en Task 15 Steps 4-6. Re-ejecutar para validar que siguen pasando después de los cambios de Feature 4 (ej. el menú ahora es lista, no debe romper el path de edición).

- [ ] **Step 3: Caso 9.5 — recurrente activo**

Re-ejecutar Task 23 Step 3.

- [ ] **Step 4: Caso 9.6 — recurrente inactivo**

Re-ejecutar Task 23 Step 4.

- [ ] **Step 5: Caso 9.7 — actualización standalone**

Re-ejecutar Task 23 Step 5.

- [ ] **Step 6: Caso 9.8 — paciente sin turnos previos**

Re-ejecutar Task 23 Step 6.

- [ ] **Step 7: Caso 9.9 — fallback `confirmar_datos`**

1. Llegar al resumen (cualquier DNI).
2. Escribir "qué hago acá?" (texto libre).
3. **Verificar**: bot re-envía el resumen (retry #1).
4. Escribir "??".
5. **Verificar**: bot dispara handoff a humano (retry #2).

- [ ] **Step 8: Caso 9.10 — waitlist + CTA**

1. Identificar paciente en `consultorio_waitlist` con `notificado: false` (o crear uno manualmente).
2. Disparar la cancelación de un turno del profesional correspondiente (desde WhatsApp o Supabase).
3. **Verificar**: el paciente en waitlist recibe mensaje con **botón CTA "Ver turno libre"** (no link).

## Task 25: Cleanup y commit final

- [ ] **Step 1: Remover scratch directory del working dir**

```bash
rm -rf .work/
```

(El contenido nunca estuvo en git porque `.gitignore` lo bloquea.)

- [ ] **Step 2: Verificar que no quedaron archivos sueltos**

```bash
git status
```

Expected: solo `docs/superpowers/plans/2026-04-20-wf02-wf08-confirmacion-editable.md` potencialmente modificado (checkboxes marcados). Nada en `.work/`, nada con `wf02*` o `wf08*`.

- [ ] **Step 3: Commit final con plan completo**

```bash
git add docs/superpowers/plans/2026-04-20-wf02-wf08-confirmacion-editable.md
git commit -m "docs: marcar plan WF02+WF08 como completado"
```

- [ ] **Step 4: Actualizar memoria del proyecto**

Agregar una línea al archivo de memoria del proyecto de Consultorios (si existe) o crear uno nuevo con: "Demo Consultorio: implementadas 4 features (resumen editable, CTA button, redirect a WA, verificación recurrente). Deploy live en n8n Nexo Terra el 2026-04-20."

---

## Rollback plan

Si algún deploy rompe la producción:

1. **Desactivar workflow temporalmente** desde la UI de n8n (`Active` toggle). El bot dejará de responder a mensajes — es preferible a respuestas rotas.
2. **Restaurar versión anterior**: n8n mantiene versionado interno. Desde la UI → `Workflow History` → seleccionar versión previa → `Restore`.
3. **Reactivar** tras restaurar.

Si el WF08 rompe el booking:
1. Mismo procedimiento via UI.
2. Como fallback extremo: sobrescribir con un HTML plano que diga "Reserva temporalmente no disponible, escribinos por WhatsApp" hasta identificar el bug.

---

## Done criteria

Plan completo cuando:
- Los 10 casos del spec §9 pasan la verificación manual.
- Los 4 commits de milestone (uno por feature) + 2 de setup/cleanup están en el historial.
- `.work/` no existe.
- El usuario reporta "funciona" tras probarlo en su WhatsApp personal con su papá.
