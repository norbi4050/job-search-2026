# Sofia + WhatsApp Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sofia (Vapi voice AI) responde info y disponibilidad, luego envía WhatsApp personalizado con botón CTA para que el paciente agende su turno directo en el bot WF02, sin fricción.

**Architecture:** Tres capas coordinadas: (1) Vapi — Sofia con nuevo tool `consultarDisponibilidad` y prompt simplificado sin confirmación de número. (2) n8n WF09 — envía WhatsApp con CTA button personalizado (nombre + especialidad + wa.me link) y hace upsert del contexto en Supabase. (3) n8n WF02 — detecta `from_vapi` en estado `inicio` y salta el menú general yendo directo a DNI con especialidad pre-cargada.

**Tech Stack:** Vapi REST API v1, WhatsApp Cloud API v21.0 (`interactive/cta_url`), n8n Code nodes (JS async), Supabase REST (PostgREST), wa.me deeplink.

**IDs clave:**
- Vapi Assistant: `1f39b10f-72e9-4185-84e4-95a884b49436`
- Tool enviarWhatsAppBooking: `709b191c-bd24-42ae-9178-db4bbaef3518`
- Tool enviarWhatsAppCancelacion: `66614b0f-b691-450f-b432-6e0b38859404`
- n8n WF09: `c0m8vnnubPQSGnTe`
- n8n WF02: `la5XjIMeKIMoTa0q`
- WhatsApp número bot: `5491137936325`

---

## Nota sobre testing

No hay suite de tests automatizados. Patrón:
- **"Red"**: describir comportamiento esperado antes de implementar
- **"Green"**: aplicar cambio y verificar en vivo (llamada real o curl simulado)
- **"Commit"**: checkpoint en git tras verificación

---

## File Structure

| Archivo | Qué cambia |
|---|---|
| Vapi API (remoto) | Nuevo tool `consultarDisponibilidad`, tool descriptions actualizadas, system prompt de Sofia |
| `.work/wf09-code.js` | Mensaje WA con CTA button, upsert contexto Supabase, wa.me link |
| `.work/wf09.json` | Snapshot del workflow para push |
| `.work/wf02-code.js` | Handler `from_vapi` en estado `inicio`, especialidad pre-cargada en `esperando_dni` |
| `docs/superpowers/plans/2026-04-24-sofia-whatsapp-integration.md` | Este plan |

---

# FASE 1 — Vapi: nuevo tool `consultarDisponibilidad`

## Task 1: Crear tool `consultarDisponibilidad` via Vapi API

- [ ] **Step 1: Crear el tool**

```bash
curl -s -X POST "https://api.vapi.ai/tool" \
  -H "Authorization: Bearer 5d4b0fe8-806e-4fd8-b8d1-7d122008820a" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "function",
    "function": {
      "name": "consultarDisponibilidad",
      "description": "Consulta si un profesional tiene turnos disponibles esta semana. Usar cuando el paciente pregunta si hay turnos, cuando puede sacar turno, o qué días atiende un médico. Siempre terminar ofreciendo mandar el WhatsApp para elegir el horario exacto.",
      "parameters": {
        "type": "object",
        "properties": {
          "profesional_nombre": {
            "type": "string",
            "description": "Nombre del profesional (parcial está bien, ej: Suárez)",
            "default": ""
          },
          "especialidad": {
            "type": "string",
            "description": "Especialidad si no se mencionó profesional específico",
            "default": ""
          }
        },
        "required": []
      }
    },
    "messages": [
      { "type": "request-start", "blocking": false },
      { "type": "request-response-delayed", "content": "Déjame consultar la agenda...", "timingMilliseconds": 1500 }
    ],
    "server": {
      "url": "https://nexo-terra-n8n.6fwciw.easypanel.host/webhook/vapi-consultorio-tools",
      "timeoutSeconds": 20,
      "headers": { "x-vapi-secret": "NT2026-vapi-s3cur3-k3y" }
    }
  }'
```

Expected: respuesta JSON con `"id": "..."` — **copiar el ID generado para el Step 2**.

- [ ] **Step 2: Agregar el nuevo tool al assistant**

Reemplazar `NUEVO_TOOL_ID` con el ID del step anterior:

```bash
curl -s -X PATCH "https://api.vapi.ai/assistant/1f39b10f-72e9-4185-84e4-95a884b49436" \
  -H "Authorization: Bearer 5d4b0fe8-806e-4fd8-b8d1-7d122008820a" \
  -H "Content-Type: application/json" \
  -d '{
    "model": {
      "provider": "openai",
      "model": "gpt-4o",
      "toolIds": [
        "526cf6b0-a383-45c1-8b99-a7e14075d62c",
        "e1b0518c-8c5a-4191-bef9-bd22c4f1b819",
        "709b191c-bd24-42ae-9178-db4bbaef3518",
        "66614b0f-b691-450f-b432-6e0b38859404",
        "651eb955-442d-4305-aa18-724e09fd6e4d",
        "NUEVO_TOOL_ID"
      ],
      "maxTokens": 200,
      "temperature": 0.7
    }
  }'
```

Expected: respuesta con el assistant actualizado incluyendo 6 toolIds.

---

# FASE 2 — Vapi: limpiar tool descriptions y actualizar system prompt

## Task 2: Actualizar tool `enviarWhatsAppBooking`

Sacar "Confirmar el numero antes de enviar" — eso hace que Sofia pregunte el número por voz cuando ya lo tiene del caller ID.

- [ ] **Step 1: PATCH tool booking**

```bash
curl -s -X PATCH "https://api.vapi.ai/tool/709b191c-bd24-42ae-9178-db4bbaef3518" \
  -H "Authorization: Bearer 5d4b0fe8-806e-4fd8-b8d1-7d122008820a" \
  -H "Content-Type: application/json" \
  -d '{
    "function": {
      "name": "enviarWhatsAppBooking",
      "description": "Envía un WhatsApp al paciente para que agende su turno. Usar cuando el paciente quiere sacar turno. Ejecutar INMEDIATAMENTE sin pedir el número — ya está disponible del caller ID. Sofia debe decir: Te mando un WhatsApp ahora para que elijas el horario.",
      "parameters": {
        "type": "object",
        "properties": {
          "telefono": {
            "type": "string",
            "description": "Número en formato internacional. Usar el caller ID si está disponible.",
            "default": ""
          },
          "especialidad": {
            "type": "string",
            "description": "Especialidad mencionada por el paciente",
            "default": ""
          },
          "nombre_paciente": {
            "type": "string",
            "description": "Nombre del paciente si lo dijo durante la llamada",
            "default": ""
          }
        },
        "required": []
      }
    }
  }'
```

## Task 3: Actualizar tool `enviarWhatsAppCancelacion`

- [ ] **Step 1: PATCH tool cancelacion**

```bash
curl -s -X PATCH "https://api.vapi.ai/tool/66614b0f-b691-450f-b432-6e0b38859404" \
  -H "Authorization: Bearer 5d4b0fe8-806e-4fd8-b8d1-7d122008820a" \
  -H "Content-Type: application/json" \
  -d '{
    "function": {
      "name": "enviarWhatsAppCancelacion",
      "description": "Envía un WhatsApp al paciente para cancelar o reprogramar su turno. Ejecutar INMEDIATAMENTE sin pedir el número — ya está disponible del caller ID.",
      "parameters": {
        "type": "object",
        "properties": {
          "telefono": {
            "type": "string",
            "description": "Número en formato internacional. Usar el caller ID si está disponible.",
            "default": ""
          },
          "nombre_paciente": {
            "type": "string",
            "description": "Nombre del paciente si lo dijo",
            "default": ""
          }
        },
        "required": []
      }
    }
  }'
```

## Task 4: Actualizar system prompt de Sofia

- [ ] **Step 1: PATCH assistant — nuevo system prompt**

```bash
curl -s -X PATCH "https://api.vapi.ai/assistant/1f39b10f-72e9-4185-84e4-95a884b49436" \
  -H "Authorization: Bearer 5d4b0fe8-806e-4fd8-b8d1-7d122008820a" \
  -H "Content-Type: application/json" \
  -d '{
    "model": {
      "provider": "openai",
      "model": "gpt-4o",
      "maxTokens": 200,
      "temperature": 0.7,
      "messages": [{
        "role": "system",
        "content": "Sos Sofia, la recepcionista virtual del Policonsultorio Rivadavia. Esta es una DEMO del producto Consultorios Inteligentes de Pragma.\n\nINFORMACION DEL CONSULTORIO:\n- Nombre: Policonsultorio Rivadavia\n- Direccion: Av. Rivadavia 4520, Piso 1, Caballito, CABA\n- Telefono: (011) 4555-1234\n- Horario: Lunes a Viernes 8:30 a 19:00, Sabados 9:00 a 13:00\n- Consulta particular: $45.000\n- Especialidades: Clinica Medica (Dr. Martin Suarez), Pediatria (Dra. Laura Mendez), Ginecologia (Dra. Carolina Rios), Cardiologia (Dr. Federico Bravo), Dermatologia (Dra. Valentina Torres)\n- Obras sociales: OSDE, Swiss Medical, Galeno, IOMA, PAMI, Medife, Sancor Salud, OSECAC, OSPEDYC, Union Personal\n\nCOMO HABLAR:\n- Espanol argentino con voseo (vos, tenes, podes)\n- Respuestas CORTAS: 1-2 oraciones maximo\n- Una pregunta por turno\n- Tono amable y profesional\n\nHERRAMIENTAS DISPONIBLES:\nTenes 6 herramientas. SIEMPRE ejecuta la herramienta, NUNCA digas su nombre en voz alta.\n\n1. consultarInfo — especialidades, profesionales, horarios, obras sociales, direccion, precios\n2. consultarDisponibilidad — si hay turnos disponibles esta semana para un medico o especialidad\n3. consultarTurnosPaciente — buscar turnos de un paciente por DNI\n4. enviarWhatsAppBooking — enviar WhatsApp para agendar turno\n5. enviarWhatsAppCancelacion — enviar WhatsApp para cancelar o reprogramar\n6. transferirRecepcion — transferir la llamada a un humano\n\nFLUJOS:\n\nPREGUNTAS DE INFO: Responde directamente o usa consultarInfo.\n\nDISPONIBILIDAD: Usa consultarDisponibilidad. Siempre termina con: Te puedo mandar un WhatsApp para que veas los horarios y elijas el que mejor te viene.\n\nSACAR TURNO: Decile \"Te mando un WhatsApp ahora para que elijas el horario\" y ejecuta enviarWhatsAppBooking INMEDIATAMENTE. No pidas el numero de telefono, ya lo tenes.\n\nCANCELAR O REPROGRAMAR TURNO: Decile \"Te mando un WhatsApp para cancelar\" y ejecuta enviarWhatsAppCancelacion INMEDIATAMENTE. No pidas el numero.\n\nCONSULTAR TURNO EXISTENTE: Pedi el DNI, confirma digito a digito, ejecuta consultarTurnosPaciente.\n\nHABLAR CON HUMANO: \"Te paso con alguien ahora\" y EJECUTA transferirRecepcion inmediatamente.\n\nFRUSTRACION: Si el paciente esta enojado o no entendes 2 veces, ejecuta transferirRecepcion.\n\nPREGUNTA MEDICA: \"No puedo darte consejo medico, te paso con alguien\" y ejecuta transferirRecepcion.\n\nEMERGENCIA: \"Si es una emergencia, llama al 107.\"\n\nDEMO: Si preguntan que es esto, explica que es una demo de Consultorios Inteligentes de Pragma.\n\nREGLAS CRITICAS:\n- NUNCA digas el nombre de una herramienta en voz alta.\n- NUNCA pidas el numero de telefono para enviar WhatsApp — ya lo tenes del caller ID.\n- NUNCA inventes informacion medica.\n- Respuestas CORTAS. Maximo 2 oraciones."
      }]
    }
  }'
```

Expected: respuesta con el assistant actualizado.

---

# FASE 3 — n8n WF09: nuevo handler `consultarDisponibilidad` + mensaje CTA

## Task 5: Pull WF09 y actualizar código

- [ ] **Step 1: Pull WF09 actual**

```bash
cd C:/Users/noyag/Norberto-Documentos
curl -s "https://nexo-terra-n8n.6fwciw.easypanel.host/api/v1/workflows/c0m8vnnubPQSGnTe" \
  -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ" \
  > .work/wf09.json
```

- [ ] **Step 2: Extraer código actual a .work/wf09-code.js**

```bash
node -e "const wf=require('./.work/wf09.json'); require('fs').writeFileSync('.work/wf09-code.js', wf.nodes[1].parameters.jsCode)"
```

- [ ] **Step 3: Aplicar cambios al código**

Buscar en `.work/wf09-code.js` la línea con `const CONSULTORIO = {` y agregar `waNumber` a la constante:

**Buscar:**
```javascript
const CONSULTORIO = {
  nombre: 'Policonsultorio Rivadavia',
```

**Reemplazar por:**
```javascript
const CONSULTORIO = {
  nombre: 'Policonsultorio Rivadavia',
  waNumber: '5491137936325',
```

- [ ] **Step 4: Reemplazar función `sendText` de booking por `sendCTAUrl`**

Agregar esta función después de la función `sendText` existente:

```javascript
async function sendCTAUrl(phone, text, buttonText, url) {
  const resp = await helpers.httpRequest({
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
  if (!resp?.messages?.length) throw new Error('WA CTA send failed: ' + JSON.stringify(resp));
  return resp;
}
```

- [ ] **Step 5: Reemplazar handler `enviarWhatsAppBooking`**

**Buscar:**
```javascript
  if (functionName === 'enviarWhatsAppBooking') {
    // PRIORIDAD: customerPhone (caller ID real) > args.telefono
    let tel = '';
    if (isRealPhone(customerPhone)) tel = customerPhone;
    else if (isRealPhone(args.telefono)) tel = args.telefono;
    if (!tel) return [{ json: { toolCallId, result: 'No pude obtener el numero. Pedile que lo repita.' } }];
    const waPhone = formatPhone(tel);
    const nombre = args.nombre_paciente || '';
    const especialidad = args.especialidad || '';
    const saludo = nombre ? `Hola ${nombre.split(' ')[0]}!` : 'Hola!';
    let texto = `${saludo} Soy el asistente del ${CONSULTORIO.nombre}.\n\n`;
    if (especialidad) texto += `Queres sacar turno de ${especialidad}, perfecto.\n\n`;
    texto += 'Escribime *Hola* para empezar a sacar tu turno. Te guio paso a paso.';
    await sendText(waPhone, texto);
    if (especialidad) {
      const existing = await supaGet('consultorio_conversaciones', { telefono_wa: `eq.${waPhone}`, select: 'id' });
      if (existing?.length) {
        await supaUpdate('consultorio_conversaciones', { telefono_wa: `eq.${waPhone}` }, {
          estado: 'inicio', contexto: { from_vapi: true, especialidad_sugerida: especialidad, nombre_sugerido: nombre }, handoff_humano: false
        });
      }
    }
    return [{ json: { toolCallId, result: 'WhatsApp enviado correctamente.' } }];
  }
```

**Reemplazar por:**
```javascript
  if (functionName === 'enviarWhatsAppBooking') {
    let tel = '';
    if (isRealPhone(customerPhone)) tel = customerPhone;
    else if (isRealPhone(args.telefono)) tel = args.telefono;
    if (!tel) return [{ json: { toolCallId, result: 'No pude obtener el numero.' } }];
    const waPhone = formatPhone(tel);
    const nombre = args.nombre_paciente || '';
    const especialidad = args.especialidad || '';
    const primerNombre = nombre ? nombre.split(' ')[0] : '';
    const saludo = primerNombre ? `Hola ${primerNombre}! 👋` : 'Hola! 👋';
    const bodyText = especialidad
      ? `${saludo} Recién hablamos por teléfono.\n\nPara agendar tu turno de *${especialidad}*, tocá el botón 👇`
      : `${saludo} Recién hablamos por teléfono.\n\nPara agendar tu turno, tocá el botón 👇`;
    const waUrl = `https://wa.me/${CONSULTORIO.waNumber}?text=Hola`;
    await sendCTAUrl(waPhone, bodyText, '🗓️ Agendar mi turno', waUrl);
    // Upsert contexto para WF02
    const existing = await supaGet('consultorio_conversaciones', { telefono_wa: `eq.${waPhone}`, select: 'id' });
    const vapiCtx = { from_vapi: true, nombre_sugerido: nombre, especialidad_sugerida: especialidad };
    if (existing?.length) {
      await supaUpdate('consultorio_conversaciones', { telefono_wa: `eq.${waPhone}` },
        { estado: 'inicio', contexto: vapiCtx, handoff_humano: false });
    } else {
      await supaInsert('consultorio_conversaciones',
        { telefono_wa: waPhone, estado: 'inicio', contexto: vapiCtx, handoff_humano: false });
    }
    return [{ json: { toolCallId, result: 'WhatsApp enviado correctamente.' } }];
  }
```

- [ ] **Step 6: Reemplazar handler `enviarWhatsAppCancelacion`**

**Buscar:**
```javascript
  if (functionName === 'enviarWhatsAppCancelacion') {
    let tel = '';
    if (isRealPhone(customerPhone)) tel = customerPhone;
    else if (isRealPhone(args.telefono)) tel = args.telefono;
    if (!tel) return [{ json: { toolCallId, result: 'No pude obtener el numero.' } }];
    const waPhone = formatPhone(tel);
    const nombre = args.nombre_paciente || '';
    const saludo = nombre ? `Hola ${nombre.split(' ')[0]}!` : 'Hola!';
    await sendText(waPhone, `${saludo} Soy el asistente del ${CONSULTORIO.nombre}.\n\nEscribime *Cancelar* para ver tus turnos y cancelar o reprogramar.`);
    return [{ json: { toolCallId, result: 'WhatsApp enviado para cancelacion.' } }];
  }
```

**Reemplazar por:**
```javascript
  if (functionName === 'enviarWhatsAppCancelacion') {
    let tel = '';
    if (isRealPhone(customerPhone)) tel = customerPhone;
    else if (isRealPhone(args.telefono)) tel = args.telefono;
    if (!tel) return [{ json: { toolCallId, result: 'No pude obtener el numero.' } }];
    const waPhone = formatPhone(tel);
    const nombre = args.nombre_paciente || '';
    const primerNombre = nombre ? nombre.split(' ')[0] : '';
    const saludo = primerNombre ? `Hola ${primerNombre}! 👋` : 'Hola! 👋';
    const bodyText = `${saludo} Recién hablamos por teléfono.\n\nPara cancelar o reprogramar tu turno, tocá el botón 👇`;
    const waUrl = `https://wa.me/${CONSULTORIO.waNumber}?text=Cancelar`;
    await sendCTAUrl(waPhone, bodyText, '❌ Cancelar turno', waUrl);
    return [{ json: { toolCallId, result: 'WhatsApp enviado para cancelacion.' } }];
  }
```

- [ ] **Step 7: Agregar handler `consultarDisponibilidad`**

Agregar ANTES del bloque `return [{ json: { toolCallId, result: \`Tool ${functionName} no reconocida.\` } }];` al final:

```javascript
  if (functionName === 'consultarDisponibilidad') {
    const nombre = args.profesional_nombre || '';
    const especialidad = args.especialidad || '';
    const filters = { activo: 'eq.true', select: 'id,nombre,especialidad,duracion_turno_min' };
    if (nombre) filters.nombre = `ilike.*${nombre}*`;
    if (especialidad && !nombre) filters.especialidad = `eq.${especialidad}`;
    const profs = await supaGet('consultorio_profesionales', filters);
    if (!profs?.length) return [{ json: { toolCallId, result: 'No encontré ese profesional o especialidad.' } }];
    const prof = profs[0];
    const horarios = await supaGet('consultorio_horarios_profesional', {
      profesional_id: `eq.${prof.id}`, select: 'dia_semana,hora_inicio,hora_fin', order: 'dia_semana.asc'
    });
    if (!horarios?.length) return [{ json: { toolCallId, result: `${prof.nombre} no tiene agenda configurada todavía.` } }];
    const diasNombre = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const lista = horarios.map(h => `${diasNombre[h.dia_semana]} de ${h.hora_inicio.slice(0,5)} a ${h.hora_fin.slice(0,5)}`).join(', ');
    return [{ json: { toolCallId, result: `${prof.nombre} (${prof.especialidad}) atiende ${lista}. Hay turnos disponibles. ¿Querés que te mande un WhatsApp para que elijas el horario que más te convenga?` } }];
  }
```

- [ ] **Step 8: Push WF09 a n8n**

```bash
cd C:/Users/noyag/Norberto-Documentos
N8N_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ" \
N8N_BASE="https://nexo-terra-n8n.6fwciw.easypanel.host" \
node .work/push.js c0m8vnnubPQSGnTe .work/wf09.json .work/wf09-code.js 1
```

Expected: `Status: 200 — OK — workflow actualizado`

---

# FASE 4 — n8n WF02: detectar `from_vapi` en estado `inicio`

## Task 6: Actualizar WF02 para recibir contexto de Vapi

- [ ] **Step 1: Reemplazar handler de estado `inicio`**

En `.work/wf02-code.js`, buscar:

```javascript
if (estado === 'inicio') {
  await sendText(phone, `¡Hola! Soy el asistente virtual del ${CONSULTORIO.nombre}. 👋\n\nTe puedo ayudar a sacar un turno, cancelar o reprogramar.\n\nPara empezar, pasame tu número de DNI (sin puntos).`);
  await updateConv(phone, 'esperando_dni', {});
  return [{ json: { action: 'welcome_sent', phone } }];
}
```

Reemplazar por:

```javascript
if (estado === 'inicio') {
  if (ctx.from_vapi && ctx.nombre_sugerido) {
    const primerNombre = ctx.nombre_sugerido.split(' ')[0];
    await updateConv(phone, 'esperando_dni', ctx);
    await sendText(phone, `¡Hola ${primerNombre}! 😊 Para confirmar y agendar tu turno, pasame tu DNI (sin puntos).`);
    return [{ json: { action: 'welcome_vapi', phone } }];
  }
  await sendText(phone, `¡Hola! Soy el asistente virtual del ${CONSULTORIO.nombre}. 👋\n\nTe puedo ayudar a sacar un turno, cancelar o reprogramar.\n\nPara empezar, pasame tu número de DNI (sin puntos).`);
  await updateConv(phone, 'esperando_dni', {});
  return [{ json: { action: 'welcome_sent', phone } }];
}
```

- [ ] **Step 2: Agregar especialidad pre-cargada en `esperando_dni` — paciente recurrente**

En `esperando_dni`, buscar el bloque donde el paciente recurrente pasa el chequeo de 90 días y va al menú:

```javascript
    } else {
      await updateConv(phone, 'menu_principal', ctx);
      await sendText(phone, `¡Hola ${p.nombre.split(' ')[0]}! Qué bueno verte de nuevo.`);
      await mostrarMenuPrincipal(phone);
    }
```

Reemplazar por:

```javascript
    } else {
      if (ctx.from_vapi && ctx.especialidad_sugerida) {
        ctx.from_vapi = false;
        ctx.especialidad = ctx.especialidad_sugerida;
        await updateConv(phone, 'esperando_profesional', ctx);
        const pe = await supaGet('consultorio_profesionales',
          { especialidad: `eq.${ctx.especialidad}`, activo: 'eq.true', select: 'id,nombre,consultorio', order: 'nombre.asc' });
        if (pe?.length === 1) {
          ctx.profesionalId = pe[0].id; ctx.profesionalNombre = pe[0].nombre; ctx.consultorio = pe[0].consultorio;
          ctx.edicion = false;
          await updateConv(phone, 'confirmar_datos', ctx);
          await mostrarResumenConfirmacion(phone, ctx);
        } else if (pe?.length > 1) {
          await sendList(phone, `En ${ctx.especialidad} tenemos:`, 'Ver profesionales',
            [{ title: ctx.especialidad, rows: pe.map(p => ({ id: `prof_${p.id}`, title: p.nombre, description: p.consultorio || '' })) }]);
        } else {
          await updateConv(phone, 'menu_principal', ctx);
          await mostrarMenuPrincipal(phone);
        }
      } else {
        await updateConv(phone, 'menu_principal', ctx);
        await sendText(phone, `¡Hola ${p.nombre.split(' ')[0]}! Qué bueno verte de nuevo.`);
        await mostrarMenuPrincipal(phone);
      }
    }
```

- [ ] **Step 3: Agregar especialidad pre-cargada en `esperando_dni` — paciente nuevo**

En `esperando_dni`, buscar el bloque del paciente nuevo:

```javascript
  } else {
    ctx = { ...ctx, dni, retry_count: 0 }; await updateConv(phone, 'esperando_nombre', ctx);
    await sendText(phone, 'Parece que es tu primera vez con nosotros. 😊\nTe pido unos datos para crearte la ficha.\n\n¿Cuál es tu nombre completo?');
  }
```

Reemplazar por:

```javascript
  } else {
    const nombreSugerido = ctx.nombre_sugerido || '';
    ctx = { ...ctx, dni, retry_count: 0 };
    if (nombreSugerido) {
      ctx.pacienteNombre = nombreSugerido;
      ctx.from_vapi = false;
      await updateConv(phone, 'esperando_obra_social', ctx);
      await sendText(phone, `Perfecto, te registro como *${nombreSugerido}*. 😊`);
      await sendButtons(phone, '¿Tenés obra social?', [{ id: 'os_si', title: 'Sí' }, { id: 'os_no', title: 'No, particular' }]);
    } else {
      await updateConv(phone, 'esperando_nombre', ctx);
      await sendText(phone, 'Parece que es tu primera vez con nosotros. 😊\nTe pido unos datos para crearte la ficha.\n\n¿Cuál es tu nombre completo?');
    }
  }
```

- [ ] **Step 4: Push WF02 a n8n**

```bash
cd C:/Users/noyag/Norberto-Documentos
N8N_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ" \
N8N_BASE="https://nexo-terra-n8n.6fwciw.easypanel.host" \
node .work/push.js la5XjIMeKIMoTa0q .work/wf02.json .work/wf02-code.js 1
```

Expected: `Status: 200 — OK — workflow actualizado`

---

# FASE 5 — Testing y commit

## Task 7: Test via curl simulado (WhatsApp booking)

- [ ] **Step 1: Simular tool call `enviarWhatsAppBooking`**

Esto envía un WhatsApp real al número `+541130875304` (tuyo):

```bash
curl -s -X POST "https://nexo-terra-n8n.6fwciw.easypanel.host/webhook/vapi-consultorio-tools" \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: NT2026-vapi-s3cur3-k3y" \
  -d '{
    "message": {
      "toolCallList": [{
        "id": "test-booking-001",
        "function": {
          "name": "enviarWhatsAppBooking",
          "arguments": {
            "telefono": "+541130875304",
            "especialidad": "Clínica Médica",
            "nombre_paciente": "Carlos González"
          }
        }
      }],
      "call": {
        "customer": { "number": "+541130875304" }
      }
    }
  }'
```

Expected:
- Respuesta JSON: `{"toolCallId":"test-booking-001","result":"WhatsApp enviado correctamente."}`
- WhatsApp llega al celular con el mensaje personalizado y botón "🗓️ Agendar mi turno"

- [ ] **Step 2: Verificar mensaje WhatsApp recibido**

El mensaje debe verse así:
```
Hola Carlos! 👋 Recién hablamos por teléfono.

Para agendar tu turno de *Clínica Médica*, tocá el botón 👇

[🗓️ Agendar mi turno]
```

- [ ] **Step 3: Tocar el botón y verificar WF02**

Al tocar el botón → abre WhatsApp con "Hola" pre-escrito → enviar.

WF02 debe responder: `¡Hola Carlos! 😊 Para confirmar y agendar tu turno, pasame tu DNI (sin puntos).`

- [ ] **Step 4: Test `consultarDisponibilidad` via curl**

```bash
curl -s -X POST "https://nexo-terra-n8n.6fwciw.easypanel.host/webhook/vapi-consultorio-tools" \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: NT2026-vapi-s3cur3-k3y" \
  -d '{
    "message": {
      "toolCallList": [{
        "id": "test-disp-001",
        "function": {
          "name": "consultarDisponibilidad",
          "arguments": { "profesional_nombre": "Suárez" }
        }
      }],
      "call": { "customer": { "number": "+541130875304" } }
    }
  }'
```

Expected: respuesta con días y horarios del Dr. Suárez + oferta de mandar WhatsApp.

## Task 8: Commit final

- [ ] **Step 1: Commit del plan**

```bash
cd C:/Users/noyag/Norberto-Documentos
git add docs/superpowers/plans/2026-04-24-sofia-whatsapp-integration.md
git commit -m "plan: Sofia + WhatsApp integration — CTA button, from_vapi context, consultarDisponibilidad"
```

---

## Rollback

Si algo rompe en producción:
1. WF09 o WF02 rotos → desactivar workflow en n8n UI (toggle Active) → restaurar versión anterior desde Workflow History
2. Sofia prompt roto → PATCH /assistant con el system prompt original (está en el historial de Vapi dashboard)

---

## Done criteria

- Sofia ejecuta `enviarWhatsAppBooking` sin pedir número
- WhatsApp llega con nombre del paciente + botón CTA wa.me
- Al tocar el botón y decir "Hola", WF02 saluda por nombre y pide DNI
- `consultarDisponibilidad` devuelve info real de agenda desde Supabase
