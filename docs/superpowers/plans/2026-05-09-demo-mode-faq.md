# Demo Mode FAQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el bot de demo en una herramienta de ventas autónoma: anuncia que es una demo, guía el flujo normal, y responde preguntas de negocio en cualquier momento sin alterar la state machine.

**Architecture:** Cinco cambios quirúrgicos al Code node "Bot - Maquina de Estados" de WF02. Sin cambios de estructura: (1) nuevo mensaje de bienvenida que anuncia la demo y aclara el DNI, (2) nuevo `DEMO_KNOWLEDGE_BASE` + función `answerFAQ()` en helpers, (3) routing para `intent === 'pregunta'` antes del switch de estados, (4) mensaje showcase automático al confirmar turno, (5) CTA final que alerta a Carlos por Telegram. El resto del flujo queda intacto.

**Tech Stack:** n8n Code node (JS), Claude Haiku (ya en uso), n8n Public API para deploy del workflow modificado.

---

## Contexto del código

**Workflow:** WF02 — `la5XjIMeKIMoTa0q`  
**Nodo a modificar:** `Bot - Maquina de Estados` (único Code node, ~54k chars)  
**Helpers relevantes:**
- `askClaude(sys, msg)` — llama a Claude Haiku, ya existe, max_tokens: 150
- `classifyInput(texto, estadoActual)` — ya clasifica `intent: 'pregunta'` pero sin handler
- `sendText(phone, text)` — envía mensaje WhatsApp

**Cambio de acceso:** Leer código completo → modificar 3 secciones → PUT via API.

---

## Task 1: Agregar DEMO_KNOWLEDGE_BASE y función answerFAQ

**Qué toca:** El bloque de helpers del Code node, después de la función `classifyInput`.

- [ ] **Leer el código actual completo de WF02**

```bash
curl -s "https://nexo-terra-n8n.6fwciw.easypanel.host/api/v1/workflows/la5XjIMeKIMoTa0q" \
  -H "X-N8N-API-KEY: <TOKEN>" \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ const wf=JSON.parse(d); const cn=wf.nodes.find(n=>n.name==='Bot - Maquina de Estados'); require('fs').writeFileSync('C:/Users/noyag/wf02_code.js', cn.parameters.jsCode); console.log('Guardado, chars:', cn.parameters.jsCode.length); })"
```

- [ ] **Agregar el knowledge base y función `answerFAQ` después de `classifyInput`**

Localizar el cierre de la función `classifyInput` (buscar `async function` que sigue después) e insertar esto:

```javascript
// ============================================================
// DEMO MODE — Knowledge base y FAQ handler
// ============================================================
const DEMO_KNOWLEDGE_BASE = `
SOBRE EL SISTEMA CONSULTORIO INTELIGENTE:
Plataforma de gestión de turnos médicos con IA: WhatsApp + voz (Sofía) + dashboard web.
Cada cliente tiene su propia instancia independiente. No es SaaS compartido — los datos son del consultorio.

OBJETIVO PRINCIPAL — AGENDA SIEMPRE LLENA:
El sistema está diseñado para mantener la agenda del consultorio siempre ocupada. Cuando un paciente cancela o no confirma, el turno puede ofrecerse automáticamente a pacientes en lista de espera. El objetivo es eliminar los huecos en la agenda.

CANCELACIÓN DE TURNOS POR EL PACIENTE:
El paciente puede cancelar su turno directamente desde WhatsApp en cualquier momento. La forma en que se cancela es completamente configurable: puede ser con un botón, escribiendo un mensaje, o requiriendo confirmación. Cuando un turno se libera, el sistema puede notificar automáticamente a pacientes en lista de espera para cubrirlo.

MÉTRICAS Y NO-SHOWS:
El sistema registra métricas de asistencia: cuántos turnos se confirmaron, cuántos se cancelaron, cuántos fueron no-shows (paciente que no vino sin avisar). Esto permite medir el impacto real del sistema y actuar sobre los turnos en riesgo. El objetivo es reducir los no-shows al mínimo.

RECORDATORIOS Y CONFIRMACIÓN:
El sistema envía recordatorios automáticos antes del turno. Si el paciente no confirma, se pueden configurar alertas adicionales o reasignación automática a lista de espera.

POST-CONSULTA Y RESEÑAS:
Al finalizar el turno, el sistema envía automáticamente un mensaje al paciente preguntando cómo le fue y con un link directo a Google para dejar una reseña. Esto ayuda a construir reputación online del consultorio de forma automática.

OBRAS SOCIALES Y COBERTURA:
Completamente configurable. El médico define qué obras sociales acepta, cuáles requieren autorización previa y cuáles no trabaja. La demo tiene una configuración de ejemplo.

PERSONALIZACIÓN DEL FLUJO:
Esta demo muestra un flujo estándar. Para cada consultorio se hace una auditoría completa y se diseña el flujo a medida: especialidades, profesionales, horarios, mensajes, validaciones.

IDENTIFICACIÓN DE PACIENTES — FLEXIBLE:
La demo usa DNI como método de identificación, pero cada consultorio elige cómo identificar a sus pacientes: DNI, nombre y apellido, teléfono, o número de historia clínica. Si el consultorio ya tiene una base de datos, el sistema se conecta a ella — no crea registros duplicados ni reemplaza el sistema existente.

DIFERENCIA CON WHATSAPP BUSINESS NORMAL:
WhatsApp Business permite responder mensajes manualmente o con respuestas automáticas básicas. Consultorio Inteligente entiende lenguaje natural: el paciente escribe como quiere y el sistema interpreta, toma decisiones y actúa. No son botones fijos — es IA conversacional conectada a la agenda y la base de datos del consultorio.

INTEGRACIÓN CON SISTEMAS EXISTENTES:
Se integra con sistemas de gestión clínica (HIS, software de turnos) que tengan API o exportación de datos. En la auditoría inicial se releva el stack tecnológico actual. El sistema trabaja junto al software existente, no lo reemplaza.

WHATSAPP Y NÚMERO DE TELÉFONO:
El consultorio usa su propio número de WhatsApp Business existente, o se crea uno nuevo. El sistema corre sobre el número del consultorio.

HANDOFF A PERSONAL HUMANO:
Cuando un paciente quiere hablar con una persona, el sistema hace el handoff automático al administrativo o médico vía WhatsApp o Telegram en tiempo real.

PRECIO:
El precio varía según cantidad de profesionales, especialidades y módulos requeridos. Para una propuesta personalizada: nexo-terra.com.ar.

SEGURIDAD Y PRIVACIDAD:
Los datos se alojan en servidores propios del consultorio (no compartidos). Cada cliente tiene su entorno completamente aislado.
`;

async function answerFAQ(texto) {
  const sys = `Sos Sofía, asistente de ventas del sistema Consultorio Inteligente.
Un potencial cliente (médico o administrativo) te está probando en una DEMO y tiene una pregunta sobre el sistema.
Respondé de forma directa, breve (máximo 3 líneas) y clara.
Usá este conocimiento como base de respuesta:

${DEMO_KNOWLEDGE_BASE}

Si la pregunta no está cubierta, decí que pueden consultar en nexo-terra.com.ar o contactar a Carlos directamente.
Al final de tu respuesta, agregá siempre una línea invitando a continuar con la demo (ej: "¿Seguimos con la demo?").`;
  const r = await askClaude(sys, texto);
  return r || 'Buena pregunta. Para esa info específica te recomiendo contactar a Carlos en nexo-terra.com.ar. ¿Seguimos con la demo?';
}
// ============================================================
```

- [ ] **Verificar que la función queda en el scope correcto** (antes de la sección principal de procesamiento, después de los helpers)

---

## Task 2: Actualizar el mensaje de bienvenida (estado `inicio`)

**Qué toca:** El bloque `if (estado === 'inicio')` del Code node.

- [ ] **Localizar el mensaje de bienvenida actual**

```javascript
// ACTUAL (buscar y reemplazar esta línea):
await sendText(phone, `¡Hola! Soy el asistente virtual del ${CONSULTORIO.nombre}. 👋\n\nTe puedo ayudar a sacar un turno, cancelar o reprogramar.\n\nPara empezar, pasame tu número de DNI (sin puntos).`);
```

- [ ] **Reemplazar por el mensaje de demo**

```javascript
await sendText(phone, `¡Hola! Soy *Sofía* 👋, la asistente del sistema *Consultorio Inteligente*.\n\n🔵 *Estás experimentando una DEMO del sistema.*\n\nTe voy a guiar por el flujo completo tal como lo vería un paciente real.\n\n💬 En cualquier momento podés hacerme una pregunta sobre el sistema y te respondo.\n\nPara arrancar, ingresá cualquier número de 7 u 8 dígitos _(en producción el paciente ingresaría su DNI, o el método que use tu clínica: nombre, historia clínica, etc.)_`);
```

- [ ] **Dejar el `updateConv` y `return` sin cambios** (solo cambia el texto del sendText)

---

## Task 3: Routing de preguntas FAQ antes del switch de estados

**Qué toca:** El bloque principal de procesamiento, antes de `if (estado === 'inicio')`.

- [ ] **Localizar el punto de inserción**

Buscar el bloque donde empieza el procesamiento principal (después de los guards de handoff y media). Hay una línea `try {` que abre el bloque principal. El FAQ handler va justo después de ese `try {` y antes de `if (estado === 'inicio')`.

- [ ] **Insertar el FAQ routing**

```javascript
// --- FAQ HANDLER (demo mode) ---
// Si el clasificador detecta intent=pregunta en cualquier estado,
// responde sin avanzar la state machine.
const clasificacionFAQ = await classifyInput(texto, estado);
if (clasificacionFAQ.intent === 'pregunta' && estado !== 'inicio') {
  const respFAQ = await answerFAQ(texto);
  await sendText(phone, respFAQ);
  await updateConv(phone, estado, ctx); // mantiene el estado actual
  return [{ json: { action: 'faq_answered', phone, intent: 'pregunta' } }];
}
// --- FIN FAQ HANDLER ---
```

**Nota:** La condición `estado !== 'inicio'` evita que el FAQ handler intercepte el primer mensaje (el DNI), donde el usuario aún no ha empezado el flujo. Si el usuario hace una pregunta ANTES de dar el DNI, el bot primero manda el welcome y luego procesa naturalmente.

---

## Task 4: Mensaje showcase al confirmar turno

**Qué toca:** El bloque del estado que envía la confirmación final del turno. Buscar en el Code node el texto que contiene "turno confirmado" o "quedó agendado" para identificar el punto exacto.

- [ ] **Localizar el sendText de confirmación final de turno**

```bash
node -e "
const fs = require('fs');
const code = fs.readFileSync('C:/Users/noyag/wf02_code.js', 'utf8');
const idx = code.indexOf('agendado');
console.log(code.substring(idx - 200, idx + 400));
"
```

- [ ] **Agregar el showcase inmediatamente después del sendText de confirmación**

Insertar este bloque justo después del `sendText` que confirma el turno (antes del `return`):

```javascript
// DEMO SHOWCASE — muestra features automáticas al prospecto
await sendText(phone,
  `✨ *Esto es lo que pasa automáticamente a partir de acá:*\n\n` +
  `📩 *24hs antes del turno* — el paciente recibe un recordatorio por WhatsApp y confirma con un botón.\n` +
  `⚡ *Si no confirma* — el turno se ofrece a la lista de espera. Agenda siempre llena.\n` +
  `🩺 *Después de la consulta* — el sistema le pregunta cómo le fue y le manda el link de Google para dejar una reseña.\n` +
  `📊 *En tu dashboard* — métricas de confirmaciones, cancelaciones y no-shows en tiempo real.\n\n` +
  `_Todo esto sin que hagas nada._ 👆\n\n` +
  `💬 ¿Tenés alguna pregunta sobre el sistema? Escribila acá.\n` +
  `📞 ¿Querés avanzar? Escribí *QUIERO SABER MÁS* y Carlos te contacta.`
);
```

- [ ] **Verificar que el `return` de confirmación sigue presente sin cambios** (el showcase es adicional, no reemplaza nada)

---

## Task 5: CTA final — alerta a Carlos por Telegram

**Qué toca:** Nuevo handler para cuando el prospecto escribe "QUIERO SABER MÁS". Va antes del switch de estados, después del FAQ handler.

- [ ] **Agregar el handler de CTA**

```javascript
// --- CTA HANDLER (demo mode) ---
if (texto.toLowerCase().includes('quiero saber más') || texto.toLowerCase().includes('quiero saber mas')) {
  await sendText(phone, `¡Perfecto! 🙌 Carlos te va a contactar a la brevedad.\n\nMientras tanto, podés ver más info en *nexo-terra.com.ar*`);
  await alertTelegram(`🎯 PROSPECTO INTERESADO\nNúmero: ${phone}\nEscribió: "QUIERO SABER MÁS" en la demo`);
  await updateConv(phone, estado, ctx); // mantiene estado
  return [{ json: { action: 'cta_triggered', phone } }];
}
// --- FIN CTA HANDLER ---
```

- [ ] **Verificar que `alertTelegram` ya existe en el código** (existe desde el setup original — envía a Telegram chat `6343825256`)

---

## Task 6: Deploy del workflow modificado vía API

- [ ] **Leer el workflow completo actualizado desde el archivo local**

```bash
node -e "
const fs = require('fs');
const code = fs.readFileSync('C:/Users/noyag/wf02_code.js', 'utf8');
console.log('Chars:', code.length);
console.log('FAQ KB:', code.includes('DEMO_KNOWLEDGE_BASE') ? 'OK' : 'FALTA');
console.log('answerFAQ fn:', code.includes('async function answerFAQ') ? 'OK' : 'FALTA');
console.log('Mensaje demo:', code.includes('Estás experimentando una DEMO') ? 'OK' : 'FALTA');
console.log('FAQ routing:', code.includes('faq_answered') ? 'OK' : 'FALTA');
console.log('Showcase:', code.includes('DEMO SHOWCASE') ? 'OK' : 'FALTA');
console.log('CTA handler:', code.includes('cta_triggered') ? 'OK' : 'FALTA');
"
```

Esperado: los 6 checks en OK.

- [ ] **Obtener el workflow completo y actualizarlo via API**

```bash
curl -s "https://nexo-terra-n8n.6fwciw.easypanel.host/api/v1/workflows/la5XjIMeKIMoTa0q" \
  -H "X-N8N-API-KEY: <TOKEN>" | node -e "
const fs = require('fs');
let d = '';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  const wf = JSON.parse(d);
  const newCode = fs.readFileSync('C:/Users/noyag/wf02_code.js', 'utf8');
  const codeNodeIdx = wf.nodes.findIndex(n => n.name === 'Bot - Maquina de Estados');
  wf.nodes[codeNodeIdx].parameters.jsCode = newCode;
  // Strip read-only fields
  delete wf.createdAt; delete wf.updatedAt; delete wf.activeVersionId; delete wf.isArchived;
  fs.writeFileSync('C:/Users/noyag/wf02_payload.json', JSON.stringify(wf));
  console.log('Payload listo');
});
"

curl -s -X PUT "https://nexo-terra-n8n.6fwciw.easypanel.host/api/v1/workflows/la5XjIMeKIMoTa0q" \
  -H "X-N8N-API-KEY: <TOKEN>" \
  -H "Content-Type: application/json" \
  --data-binary @C:/Users/noyag/wf02_payload.json \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ const r=JSON.parse(d); console.log('ID:', r.id, '| updatedAt:', r.updatedAt); })"
```

---

## Task 7: Testing manual vía WhatsApp

Enviar los siguientes mensajes al número de demo en secuencia y verificar respuestas:

- [ ] **Test 1 — Mensaje de bienvenida**
  - Enviar: "Hola"
  - Esperado: Mensaje con "🔵 *Estás experimentando una DEMO*" + instrucción de ingresar DNI

- [ ] **Test 2 — Pregunta de negocio antes de dar DNI**
  - Enviar: "¿Trabajan con IOMA?"
  - Esperado: Respuesta sobre obras sociales + invitación a continuar demo. Estado NO avanza.

- [ ] **Test 3 — DNI válido (continuar flujo)**
  - Enviar: "12345678"
  - Esperado: Flujo normal continúa (busca paciente o crea nuevo)

- [ ] **Test 4 — Pregunta sobre identificación por nombre**
  - Enviar: "¿Se puede buscar por nombre en lugar de DNI?"
  - Esperado: Respuesta explicando identificación flexible + "¿Seguimos con la demo?" + estado NO avanza

- [ ] **Test 4b — Pregunta diferencia con WhatsApp Business**
  - Enviar: "¿Qué diferencia tiene esto con WhatsApp Business normal?"
  - Esperado: Respuesta sobre IA conversacional vs botones fijos + invitación a continuar

- [ ] **Test 5 — Pregunta no cubierta**
  - Enviar: "¿Tienen app móvil?"
  - Esperado: Respuesta derivando a nexo-terra.com.ar + invitación a continuar

- [ ] **Test 6 — Showcase al confirmar turno**
  - Completar el flujo hasta confirmar un turno
  - Esperado: Mensaje de confirmación normal + mensaje showcase con los 4 bullets automáticos + CTA "QUIERO SABER MÁS"

- [ ] **Test 7 — CTA Telegram**
  - Enviar: "QUIERO SABER MÁS"
  - Esperado: Respuesta de confirmación en WhatsApp + alerta llega al Telegram de Carlos con el número del prospecto

- [ ] **Test 8 — Flujo normal post-FAQ**
  - Después de una pregunta FAQ, continuar el flujo normalmente
  - Esperado: Flujo continúa desde el estado donde estaba

---

## Contenido FAQ — Revisar con Carlos

El `DEMO_KNOWLEDGE_BASE` incluido en Task 1 cubre las preguntas más comunes. Antes de deployar, Carlos debe revisar y ajustar:

- [x] IMPLEMENTACIÓN Y TIEMPO — eliminado (lo responde Carlos personalmente)
- [x] CANCELACIÓN del servicio — eliminado
- [x] Agenda siempre llena — agregado
- [x] Cancelación de turnos por paciente — agregado con flujo configurable
- [x] Métricas y no-shows — agregado
- [x] Post-consulta y reseñas Google — agregado
- [x] Identificación flexible (DNI/nombre/HC) — agregado (insight de conversación con Nahuel/Corde)
- [x] Diferencia con WhatsApp Business normal — agregado
- [x] Integración sin duplicar registros — aclarado
- [x] Showcase automático al confirmar turno — Task 4
- [x] CTA "QUIERO SABER MÁS" + alerta Telegram a Carlos — Task 5
- [ ] ¿El precio/contacto apunta al canal correcto? (nexo-terra.com.ar)

Agregar preguntas adicionales editando el string `DEMO_KNOWLEDGE_BASE` directamente.
