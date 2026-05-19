# WF-MONTHLY-REPORT — Reporte mensual por WhatsApp

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar automáticamente el día 1 de cada mes un resumen de métricas del mes anterior por WhatsApp al médico/admin del consultorio.

**Architecture:** Workflow n8n con cron mensual. Un Code node calcula métricas del mes anterior + comparativa vs mes previo leyendo Supabase, y envía un WhatsApp template `reporte_mensual`. Sigue el mismo patrón que WF-REMINDER. Requiere nuevo template Meta aprobado.

**Tech Stack:** n8n Code node (JS), Supabase REST API, WhatsApp Cloud API (template), Telegram alerts

---

## Archivos

| Acción | Path |
|--------|------|
| Crear | `.work/wf-monthly-report-code.js` |
| Modificar | `consultorio-kit/docs/env-vars.md` |
| Modificar | `consultorio-kit/docs/setup-checklist.md` |
| Crear | `consultorio-kit/n8n/WF-MONTHLY-REPORT.json` (manual desde n8n UI) |

---

## Task 1: Diseñar y crear el template `reporte_mensual` en Meta

> El template necesita aprobación (~1-3 días). Crearlo primero para que mientras lo aprueban avanzamos con el código.

**Files:** ninguno (se hace en Meta Business Manager)

- [ ] **Step 1: Ir a Meta Business Manager → WhatsApp Manager → Message Templates → Create Template**

  - **Nombre:** `reporte_mensual`
  - **Categoría:** Utility
  - **Idioma:** Spanish (ARG) — `es_AR`
  - **Body (copiar exacto):**

  ```
  📊 *Reporte {{1}} — {{2}}*

  Turnos agendados: {{3}}
  Completados: {{4}}
  Ausencias: {{5}} ({{6}}%)
  Recordatorios enviados: {{7}}

  {{8}}
  ```

  - **Variables mapping** (para el formulario de Meta):
    - `{{1}}` → ejemplo: `Consultorio Dr. López`
    - `{{2}}` → ejemplo: `Abril 2026`
    - `{{3}}` → ejemplo: `89`
    - `{{4}}` → ejemplo: `71`
    - `{{5}}` → ejemplo: `8`
    - `{{6}}` → ejemplo: `9`
    - `{{7}}` → ejemplo: `81`
    - `{{8}}` → ejemplo: `📈 Ausencias: -6 puntos vs mes anterior ✅`

  - **Footer:** (vacío)
  - **Buttons:** ninguno

- [ ] **Step 2: Enviar a revisión**

  Meta aprueba templates de categoría Utility en 1-3 días hábiles. Mientras tanto avanzar con Tasks 2 y 3.

- [ ] **Step 3: Verificar aprobación**

  En WhatsApp Manager → Message Templates, el status pasa a `APPROVED`. Si dice `REJECTED`, revisar el mensaje de rechazo — generalmente piden reformular variables con ejemplos más claros.

---

## Task 2: Escribir el código del workflow

**Files:**
- Crear: `.work/wf-monthly-report-code.js`

- [ ] **Step 1: Crear el archivo de código**

  Crear `.work/wf-monthly-report-code.js` con el siguiente contenido:

  ```javascript
  // ============================================================
  // WF-MONTHLY-REPORT: Reporte mensual de métricas
  // Corre el día 1 de cada mes a las 9:00 ART.
  // Envía reporte_mensual al admin/médico del consultorio.
  // ============================================================

  const helpers = this.helpers;
  const SUPABASE_URL = $env.SUPABASE_URL;
  const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
  const WA_TOKEN = $env.META_WHATSAPP_TOKEN;
  const PHONE_ID = $env.WA_PHONE_NUMBER_ID;
  const ADMIN_PHONE = $env.CONSULTORIO_ADMIN_WA;
  const CONSULTORIO_NOMBRE = $env.CONSULTORIO_NOMBRE || 'Consultorio';
  const TG_BOT_TOKEN = '8736535917:AAEgHkDacG5kPaKSGIJa4dR0XjJNhIkaX0U';
  const TG_CHAT_ID = '6343825256';
  const OFFSET_ART = -3 * 60 * 60 * 1000;

  const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  async function supaFetch(path) {
    return await helpers.httpRequest({
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/${path}`,
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
  }

  async function alertTelegram(msg) {
    try {
      await helpers.httpRequest({
        method: 'POST',
        url: `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'HTML' })
      });
    } catch(e) {}
  }

  function formatPhone(phone) {
    if (!phone) return '';
    let p = phone.replace(/[^0-9]/g, '');
    if (p.startsWith('54') && p.length >= 12) return p;
    if (p.startsWith('9') && p.length >= 10) return '54' + p;
    if (p.length === 10) return '549' + p;
    return p;
  }

  // Retorna { start, end, month, year } en UTC para un mes N meses atrás (ART)
  function getMonthRange(monthsAgo) {
    const now = new Date();
    const nowART = new Date(now.getTime() + OFFSET_ART);
    const d = new Date(nowART.getFullYear(), nowART.getMonth() - monthsAgo, 1);
    // 00:00 ART = 03:00 UTC
    const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 3, 0, 0));
    const end = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1, 3, 0, 0));
    return { start: start.toISOString(), end: end.toISOString(), month: d.getMonth(), year: d.getFullYear() };
  }

  function calcMetrics(turnos) {
    const total = turnos.length;
    const completados = turnos.filter(t => t.estado === 'completado').length;
    const cancelados  = turnos.filter(t => t.estado === 'cancelado').length;
    const recordatorios = turnos.filter(t => t.recordatorio_enviado === true).length;
    // No-show: turno pasado que sigue en agendado/confirmado (mes ya cerrado, todos son pasados)
    const noShowEstimado = turnos.filter(t =>
      ['agendado','confirmado'].includes(t.estado)
    ).length;
    const turnosPasados = completados + cancelados + noShowEstimado;
    const tasaNoShow = turnosPasados > 0
      ? Math.round((noShowEstimado / turnosPasados) * 100)
      : 0;
    return { total, completados, cancelados, recordatorios, noShowEstimado, tasaNoShow };
  }

  // Guard: deshabilitar desde EasyPanel sin tocar código
  if ($env.REPORTE_MENSUAL_HABILITADO === 'false') {
    return [{ json: { action: 'disabled', reason: 'REPORTE_MENSUAL_HABILITADO=false' } }];
  }

  if (!ADMIN_PHONE) {
    await alertTelegram('⚠️ WF-MONTHLY-REPORT: CONSULTORIO_ADMIN_WA no configurado — reporte no enviado');
    return [{ json: { action: 'error', reason: 'CONSULTORIO_ADMIN_WA not set' } }];
  }

  const mesAnterior   = getMonthRange(1);
  const mesAntAnterior = getMonthRange(2);

  const [turnosMes, turnosMesAnt] = await Promise.all([
    supaFetch(`consultorio_turnos?fecha_hora=gte.${mesAnterior.start}&fecha_hora=lt.${mesAnterior.end}&select=id,fecha_hora,estado,recordatorio_enviado`),
    supaFetch(`consultorio_turnos?fecha_hora=gte.${mesAntAnterior.start}&fecha_hora=lt.${mesAntAnterior.end}&select=id,fecha_hora,estado,recordatorio_enviado`)
  ]);

  const metricas    = calcMetrics(turnosMes    || []);
  const metricasAnt = calcMetrics(turnosMesAnt || []);

  const mesLabel = `${MESES_ES[mesAnterior.month]} ${mesAnterior.year}`;

  // Comparativa
  let comparativaMsg = '➡️ Sin datos del mes anterior para comparar.';
  if ((turnosMesAnt || []).length > 0) {
    const delta = metricasAnt.tasaNoShow - metricas.tasaNoShow;
    if (delta > 0) {
      comparativaMsg = `📈 Ausencias: -${delta} puntos vs mes anterior ✅`;
    } else if (delta < 0) {
      comparativaMsg = `📉 Ausencias: +${Math.abs(delta)} puntos vs mes anterior ⚠️`;
    } else {
      comparativaMsg = `➡️ Ausencias estables vs mes anterior.`;
    }
  }

  // Enviar template
  const params = [
    CONSULTORIO_NOMBRE,
    mesLabel,
    String(metricas.total),
    String(metricas.completados),
    String(metricas.noShowEstimado),
    String(metricas.tasaNoShow),
    String(metricas.recordatorios),
    comparativaMsg
  ];

  const resp = await helpers.httpRequest({
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
    headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formatPhone(ADMIN_PHONE),
      type: 'template',
      template: {
        name: 'reporte_mensual',
        language: { code: 'es_AR' },
        components: [{
          type: 'body',
          parameters: params.map(t => ({ type: 'text', text: String(t) }))
        }]
      }
    })
  });

  if (!resp?.messages?.length) {
    await alertTelegram(`⚠️ WF-MONTHLY-REPORT fallo\nError: ${JSON.stringify(resp)}`);
    return [{ json: { action: 'error', response: resp } }];
  }

  await alertTelegram(`📊 WF-MONTHLY-REPORT: Reporte ${mesLabel} enviado a ${ADMIN_PHONE} ✅`);

  return [{ json: { action: 'report_sent', mes: mesLabel, metricas } }];
  ```

- [ ] **Step 2: Commit del código**

  ```bash
  git add .work/wf-monthly-report-code.js
  git commit -m "feat(monthly-report): code node para reporte mensual WhatsApp"
  ```

---

## Task 3: Crear el workflow en n8n y testear

**Files:** n8n UI (instancia de producción)

- [ ] **Step 1: Crear nuevo workflow en n8n**

  Nombre: `WF-MONTHLY-REPORT`

- [ ] **Step 2: Agregar nodo Cron**

  - Tipo: Schedule Trigger
  - Mode: Custom (Cron)
  - Expression: `0 12 1 * *`
    (día 1 de cada mes a las 12:00 UTC = 09:00 ART)

- [ ] **Step 3: Agregar nodo Code**

  - Tipo: Code
  - Language: JavaScript
  - Pegar el código completo de `.work/wf-monthly-report-code.js`

- [ ] **Step 4: Agregar catch global con Telegram**

  Igual al de WF-REMINDER:
  - Nodo: Code (nombre: "Error Handler")
  - Conectar como error output del nodo Code principal
  - Código:
    ```javascript
    const TG_BOT_TOKEN = '8736535917:AAEgHkDacG5kPaKSGIJa4dR0XjJNhIkaX0U';
    const TG_CHAT_ID = '6343825256';
    const err = $input.first().json.error || 'unknown error';
    await this.helpers.httpRequest({
      method: 'POST',
      url: `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: `🔴 WF-MONTHLY-REPORT crash\n${err}`, parse_mode: 'HTML' })
    });
    return $input.all();
    ```

- [ ] **Step 5: Agregar env var `CONSULTORIO_ADMIN_WA` en EasyPanel**

  EasyPanel → servicio n8n → Environment Variables:
  - `CONSULTORIO_ADMIN_WA` = número del médico/admin con formato `549XXXXXXXXXX`

  Reiniciar n8n después.

- [ ] **Step 6: Test del Code node (sin template aprobado todavía)**

  En el workflow, hacer click en el nodo Code → "Test step".
  
  Verificar en el output JSON:
  - `metricas.total` tiene un número razonable
  - `metricas.tasaNoShow` es un porcentaje válido (0-100)
  - `mesLabel` tiene el formato correcto (ej: `"Abril 2026"`)
  - Si el template no está aprobado aún, el resultado será `action: 'error'` con el error de Meta — eso es esperado. Lo importante es que las métricas calculadas sean correctas.

- [ ] **Step 7: Una vez aprobado el template — test completo**

  Hacer "Test Workflow" desde el inicio.
  
  Esperado:
  - Output: `{ action: 'report_sent', mes: 'Abril 2026', metricas: { ... } }`
  - WhatsApp llega al número `CONSULTORIO_ADMIN_WA` con el reporte formateado
  - Telegram recibe: `📊 WF-MONTHLY-REPORT: Reporte Abril 2026 enviado a 549... ✅`

- [ ] **Step 8: Activar el workflow**

  Toggle "Active" en ON. El workflow correrá automáticamente el día 1 de cada mes.

---

## Task 4: Actualizar el kit

**Files:**
- Modificar: `consultorio-kit/docs/env-vars.md`
- Modificar: `consultorio-kit/docs/setup-checklist.md`

- [ ] **Step 1: Agregar `CONSULTORIO_ADMIN_WA` a env-vars.md**

  En la sección "Datos del consultorio / negocio", agregar la fila:

  ```markdown
  | `CONSULTORIO_ADMIN_WA` | Número WhatsApp del médico/admin que recibe reportes (con 9 móvil) | `5491155556666` |
  ```

  Y al final, en la sección opcional, agregar:

  ```markdown
  | `REPORTE_MENSUAL_HABILITADO` | Desactivar reportes mensuales (opcional, default: activo) | `false` para desactivar |
  ```

- [ ] **Step 2: Agregar WF-MONTHLY-REPORT a setup-checklist.md**

  En el Paso 3 (Importar workflows), agregar:
  ```markdown
  - [ ] Importar `WF-MONTHLY-REPORT.json`
  ```

  En Paso 2 (Variables de entorno), agregar:
  ```markdown
  - [ ] `CONSULTORIO_ADMIN_WA` — número WhatsApp médico/admin con 9 móvil: `549XXXXXXXXXX`
  ```

  En Paso 5 (Templates WhatsApp), agregar:
  ```markdown
  - [ ] Crear template `reporte_mensual` (categoría: Utilidad)
  ```

- [ ] **Step 3: Commit del kit**

  ```bash
  git add consultorio-kit/docs/env-vars.md consultorio-kit/docs/setup-checklist.md
  git commit -m "docs(kit): agrega CONSULTORIO_ADMIN_WA y WF-MONTHLY-REPORT al checklist"
  ```

---

## Task 5: Exportar workflow al kit

**Files:**
- Crear: `consultorio-kit/n8n/WF-MONTHLY-REPORT.json`

- [ ] **Step 1: Exportar desde n8n UI**

  En n8n → WF-MONTHLY-REPORT → menú (⋯) → Download. Guardar como `consultorio-kit/n8n/WF-MONTHLY-REPORT.json`.

- [ ] **Step 2: Commit final**

  ```bash
  git add consultorio-kit/n8n/WF-MONTHLY-REPORT.json
  git commit -m "feat(kit): agrega WF-MONTHLY-REPORT al kit de instalación"
  ```

---

## Resumen de ejecución

| Task | Bloqueante | Tiempo estimado |
|------|-----------|----------------|
| Task 1 — Template Meta | No (paralelo) | 10 min + 1-3 días aprobación |
| Task 2 — Código | No | 5 min |
| Task 3 — n8n workflow | Requiere Task 2 | 15 min (+ esperar template) |
| Task 4 — Kit docs | No | 5 min |
| Task 5 — Exportar JSON | Requiere Task 3 activo | 2 min |

**Orden recomendado:** Task 1 + Task 2 + Task 4 en paralelo → Task 3 (test parcial) → esperar aprobación template → Task 3 (test completo) → Task 5.
