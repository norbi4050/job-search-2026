# Respuesta a Audios con Voz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando un paciente envía un audio de WhatsApp, el bot lo transcribe con ElevenLabs Scribe, lo procesa por la state machine existente, y responde con voz sintetizada (ElevenLabs TTS, voz Sofía). Mensajes funcionales con datos clave (links, resúmenes, URLs) siguen siendo texto.

**Architecture:** WF01 extrae el `mediaId` del audio y lo pasa a WF02. WF02 recibe `mediaId`, agrega `transcribeAudio()` (3 pasos: GET URL → download binary → POST Scribe) y `sendAudio()` (TTS → WA media upload → WA audio message con fallback silencioso a texto). `sendText()` recibe parámetro `forceText=false` y deriva a `sendAudio()` cuando `isAudio && !forceText`. Call sites funcionales marcan `forceText: true`.

**Tech Stack:** n8n Code node (vanilla JS, `helpers.httpRequest`), WhatsApp Cloud API v21.0, ElevenLabs Scribe (`scribe_v1`) + TTS (`eleven_multilingual_v2`), Supabase (logging), n8n Public API v1 (PUT workflow para deploy)

---

## Información del entorno

- **n8n URL:** `https://nexo-terra-n8n.6fwciw.easypanel.host`
- **n8n API header:** `X-N8N-API-KEY: <JWT>`
- **JWT (válido hasta ~2026-06-21):**
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ
  ```
- **WF01 ID:** `dVfZYeSsVigWd0cJ`
- **WF02 ID:** `la5XjIMeKIMoTa0q` — Code node ID: `c02-bot`
- **ElevenLabs voice ID (Sofía):** `9oPKasc15pfAbMr7N6Gs` (env var `ELEVENLABS_VOICE_ID` ya seteada)
- **Código WF02 local:** `C:/Users/noyag/wf02_code.js`
- **WA demo:** `5491137936325`

---

## File Structure

| Archivo | Cambio |
|---------|--------|
| `C:/Users/noyag/wf02_code.js` | Input parsing + funciones nuevas + sendText modificado + handler __MEDIA__ + call sites forceText |
| WF01 nodo "3. Extraer Mensaje" | Agregar `mediaId` al output — modificado directo vía n8n API (no hay archivo local) |

---

### Task 1: wf02_code.js — Input parsing + funciones transcribeAudio y sendAudio

**Files:**
- Modify: `C:/Users/noyag/wf02_code.js`

- [ ] **Step 1: Cambiar `const texto` a `let texto` y agregar `mediaId` / `isAudio`**

Localizar el bloque de input parsing (~líneas 334-339):

```js
const phone = data.phone;
const texto = (data.textoMensaje || '').trim();
const btnId = data.interactiveId || '';
const msgType = data.msgType || 'text';
let estado = data.convEstado || 'inicio';
let ctx = data.convContexto || {};
```

Reemplazar con:

```js
const phone = data.phone;
let texto = (data.textoMensaje || '').trim();
const btnId = data.interactiveId || '';
const msgType = data.msgType || 'text';
const mediaId = data.mediaId || null;
const isAudio = msgType === 'audio' && !!mediaId;
let estado = data.convEstado || 'inicio';
let ctx = data.convContexto || {};
```

Razón del `let`: el handler `__MEDIA__` reemplaza `texto` con la transcripción del audio.

- [ ] **Step 2: Agregar función `transcribeAudio` después de `sendCTAUrl`**

Insertar inmediatamente después del cierre `}` de `sendCTAUrl` (~línea 115):

```js
async function transcribeAudio(mediaId) {
  // Paso 1: obtener URL del archivo desde la API de WA
  const meta = await helpers.httpRequest({
    method: 'GET',
    url: `https://graph.facebook.com/v21.0/${mediaId}`,
    headers: { Authorization: `Bearer ${WA_TOKEN}` }
  });
  const audioUrl = meta.url;

  // Paso 2: descargar el binario del audio
  const audioBinary = await helpers.httpRequest({
    method: 'GET',
    url: audioUrl,
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
    encoding: 'arraybuffer'
  });

  // Paso 3: transcribir con ElevenLabs Scribe
  const result = await helpers.httpRequest({
    method: 'POST',
    url: 'https://api.elevenlabs.io/v1/speech-to-text',
    headers: { 'xi-api-key': $env.ELEVENLABS_API_KEY },
    bodyContentType: 'multipart-form-data',
    body: {
      file: { value: audioBinary, options: { filename: 'audio.ogg', contentType: 'audio/ogg' } },
      model_id: 'scribe_v1'
    }
  });
  return result.text || '';
}
```

- [ ] **Step 3: Agregar función `sendAudio` justo debajo de `transcribeAudio`**

```js
async function sendAudio(phone, text) {
  try {
    // Paso 1: TTS con ElevenLabs Sofía
    const mp3Binary = await helpers.httpRequest({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${$env.ELEVENLABS_VOICE_ID}`,
      headers: { 'xi-api-key': $env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
      encoding: 'arraybuffer'
    });

    // Paso 2: subir MP3 a WhatsApp media
    const uploadRes = await helpers.httpRequest({
      method: 'POST',
      url: `https://graph.facebook.com/v21.0/${PHONE_ID}/media`,
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
      bodyContentType: 'multipart-form-data',
      body: {
        messaging_product: 'whatsapp',
        type: 'audio/mpeg',
        file: { value: mp3Binary, options: { filename: 'respuesta.mp3', contentType: 'audio/mpeg' } }
      }
    });

    // Paso 3: enviar audio al paciente
    await helpers.httpRequest({
      method: 'POST',
      url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'audio',
        audio: { id: uploadRes.id }
      })
    });

    // Log salida (no bloquea el flujo)
    try {
      await helpers.httpRequest({
        method: 'POST',
        url: `${SUPABASE_URL}/rest/v1/consultorio_mensajes`,
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ telefono_wa: phone, direccion: 'salida', contenido: `[AUDIO] ${text}`, estado_bot: null })
      });
    } catch(e) {}

  } catch(e) {
    // Fallback silencioso a texto (evita recursión — no llama a sendText)
    try {
      await helpers.httpRequest({
        method: 'POST',
        url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } })
      });
    } catch(e2) {}
  }
}
```

- [ ] **Step 4: Verificar el código localmente**

Abrir `C:/Users/noyag/wf02_code.js` y confirmar:
1. Línea ~335 dice `let texto = ...` (no `const`)
2. Líneas ~336-337 tienen `mediaId` y `isAudio` nuevas
3. `transcribeAudio` existe y tiene 3 pasos internos
4. `sendAudio` existe con try/catch externo y fallback en catch

- [ ] **Step 5: Commit**

```powershell
git -C "C:/Users/noyag/Norberto-Documentos" add --all
git -C "C:/Users/noyag/Norberto-Documentos" commit -m "feat(wf02): add mediaId/isAudio input + transcribeAudio + sendAudio functions"
```

---

### Task 2: wf02_code.js — Modificar `sendText` + actualizar handler `__MEDIA__`

**Files:**
- Modify: `C:/Users/noyag/wf02_code.js`

- [ ] **Step 1: Modificar firma de `sendText` — agregar `forceText` y rama audio**

Localizar la función completa (~línea 71):

```js
async function sendText(phone, text, estado) {
  await helpers.httpRequest({ method: 'POST', url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' }, body: { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } } });
  try {
    await helpers.httpRequest({ method: 'POST', url: `${SUPABASE_URL}/rest/v1/consultorio_mensajes`, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ telefono_wa: phone, direccion: 'salida', contenido: text, estado_bot: estado || null }) });
  } catch(e) {}
}
```

Reemplazar con:

```js
async function sendText(phone, text, estado, forceText = false) {
  if (isAudio && !forceText) {
    await sendAudio(phone, text);
    return;
  }
  await helpers.httpRequest({ method: 'POST', url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' }, body: { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } } });
  try {
    await helpers.httpRequest({ method: 'POST', url: `${SUPABASE_URL}/rest/v1/consultorio_mensajes`, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ telefono_wa: phone, direccion: 'salida', contenido: text, estado_bot: estado || null }) });
  } catch(e) {}
}
```

- [ ] **Step 2: Actualizar handler `__MEDIA__` para audio fall-through**

Localizar el bloque completo (~líneas 415-423):

```js
if (texto === '__MEDIA__') {
  await updateConv(phone, estado, ctx);
  if (msgType === 'image' || msgType === 'video' || msgType === 'document') {
    await sendText(phone, 'Lo sentimos, no podemos recibir fotos ni archivos por este canal. Si tenés una consulta, escribinos con texto 😊');
  } else {
    await sendText(phone, 'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribís por favor?');
  }
  return [{ json: { action: 'media_rejected', phone, msgType } }];
}
```

Reemplazar con:

```js
if (texto === '__MEDIA__') {
  await updateConv(phone, estado, ctx);
  if (msgType === 'audio' && mediaId) {
    const transcripcion = await transcribeAudio(mediaId);
    if (!transcripcion.trim()) {
      await sendText(phone, 'No pude escuchar bien el audio. ¿Podés repetirlo o escribirme?');
      return [{ json: { action: 'audio_transcription_failed', phone } }];
    }
    texto = transcripcion.trim();
    // fall-through: continúa al procesamiento normal de la state machine
  } else if (msgType === 'image' || msgType === 'video' || msgType === 'document') {
    await sendText(phone, 'Lo sentimos, no podemos recibir fotos ni archivos por este canal. Si tenés una consulta, escribinos con texto 😊');
    return [{ json: { action: 'media_rejected', phone, msgType } }];
  } else {
    await sendText(phone, 'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribís por favor?');
    return [{ json: { action: 'media_rejected', phone } }];
  }
}
```

Nota crítica: el bloque de audio **no tiene `return`** — cae al procesamiento normal de la state machine con `texto` ya reemplazado por la transcripción.

- [ ] **Step 3: Verificar**

En el archivo, confirmar:
1. `sendText` tiene `forceText = false` en la firma
2. El primer `if` dentro de `sendText` es `if (isAudio && !forceText)`
3. El handler `__MEDIA__` tiene el case de audio sin `return` al final del if principal
4. El case de audio tiene `return` solo cuando la transcripción falla

- [ ] **Step 4: Commit**

```powershell
git -C "C:/Users/noyag/Norberto-Documentos" add --all
git -C "C:/Users/noyag/Norberto-Documentos" commit -m "feat(wf02): modify sendText with forceText param + update __MEDIA__ handler for audio fall-through"
```

---

### Task 3: wf02_code.js — Marcar call sites con `forceText: true`

Agregar `null, true` como 3° y 4° argumento a los `sendText` que contienen datos que el paciente necesita leer (URLs, fecha/hora/profesional, datos de contacto, showcase demo).

**Files:**
- Modify: `C:/Users/noyag/wf02_code.js`

- [ ] **Step 1: Línea ~447 — datos de contacto (teléfono + horario)**

Localizar:
```js
await sendText(phone, `Llamanos al ${CONSULTORIO.telefono}.\nHorario: ${CONSULTORIO.horario}\n\n¡Te esperamos!`);
```
Reemplazar con:
```js
await sendText(phone, `Llamanos al ${CONSULTORIO.telefono}.\nHorario: ${CONSULTORIO.horario}\n\n¡Te esperamos!`, null, true);
```

- [ ] **Step 2: Línea ~453 — URL nexo-terra.com.ar (demo mode)**

Localizar:
```js
await sendText(phone, `¡Perfecto! 🙌 Carlos te va a contactar a la brevedad.\n\nMientras tanto, podés ver más info en *nexo-terra.com.ar*`);
```
Reemplazar con:
```js
await sendText(phone, `¡Perfecto! 🙌 Carlos te va a contactar a la brevedad.\n\nMientras tanto, podés ver más info en *nexo-terra.com.ar*`, null, true);
```

- [ ] **Step 3: Líneas ~475 y ~499 — Demo welcome showcase (2 instancias)**

Buscar el mensaje que empieza con `¡Hola! Soy *Sofía* 👋, la asistente del sistema *Consultorio Inteligente*.\n\n🔵 *Estás experimentando una DEMO`. Hay **dos** instancias en el archivo. A **ambas** agregarles `, null, true` al final del sendText.

Primera instancia (~línea 475):
```js
await sendText(phone, `¡Hola! Soy *Sofía* 👋, la asistente del sistema *Consultorio Inteligente*.\n\n🔵 *Estás experimentando una DEMO del sistema.*\n\nTe voy a guiar por el flujo completo tal como lo vería un paciente real.\n\n💬 En cualquier momento podés hacerme una pregunta sobre el sistema y te respondo.\n\nPara arrancar, ingresá cualquier número de 7 u 8 dígitos _(en producción el paciente ingresaría su DNI, o el método que use tu clínica: nombre, historia clínica, etc.)_`);
```
Reemplazar con (agrega `, null, true` antes del cierre del paréntesis):
```js
await sendText(phone, `¡Hola! Soy *Sofía* 👋, la asistente del sistema *Consultorio Inteligente*.\n\n🔵 *Estás experimentando una DEMO del sistema.*\n\nTe voy a guiar por el flujo completo tal como lo vería un paciente real.\n\n💬 En cualquier momento podés hacerme una pregunta sobre el sistema y te respondo.\n\nPara arrancar, ingresá cualquier número de 7 u 8 dígitos _(en producción el paciente ingresaría su DNI, o el método que use tu clínica: nombre, historia clínica, etc.)_`, null, true);
```
Aplicar **lo mismo** a la segunda instancia (~línea 499).

- [ ] **Step 4: Línea ~859 — booking URL**

Localizar:
```js
await sendText(phone, `Elegí tu turno desde el link:\n\n👉 ${bookingUrl}\n\nSi querés cambiar de especialidad, avisame. Para hablar con alguien, escribí "recepción". 😊`);
```
Reemplazar con:
```js
await sendText(phone, `Elegí tu turno desde el link:\n\n👉 ${bookingUrl}\n\nSi querés cambiar de especialidad, avisame. Para hablar con alguien, escribí "recepción". 😊`, null, true);
```

- [ ] **Step 5: Línea ~979 — confirmación de cancelación con fecha/hora/profesional**

Localizar:
```js
await sendText(phone, `✅ Turno cancelado.\n\n📅 ${ctx.turnoACancelar.fecha}, ${ctx.turnoACancelar.hora} hs\n👨‍⚕️ ${ctx.turnoACancelar.profNombre}\n\nCuando quieras sacar otro turno, escribime. 👋`);
```
Reemplazar con:
```js
await sendText(phone, `✅ Turno cancelado.\n\n📅 ${ctx.turnoACancelar.fecha}, ${ctx.turnoACancelar.hora} hs\n👨‍⚕️ ${ctx.turnoACancelar.profNombre}\n\nCuando quieras sacar otro turno, escribime. 👋`, null, true);
```

- [ ] **Step 6: Línea ~1058 — URL Google Reviews**

Localizar:
```js
await sendText(phone, `¡Nos alegra que hayas tenido una buena experiencia! 😊\n\n¿Nos ayudás con una reseña en Google?\n👉 ${GOOGLE_REVIEWS_URL}`);
```
Reemplazar con:
```js
await sendText(phone, `¡Nos alegra que hayas tenido una buena experiencia! 😊\n\n¿Nos ayudás con una reseña en Google?\n👉 ${GOOGLE_REVIEWS_URL}`, null, true);
```

- [ ] **Step 7: Verificar — grep de todos los forceText aplicados**

Ejecutar en PowerShell para confirmar que todos los cambios están:
```powershell
Select-String -Path "C:/Users/noyag/wf02_code.js" -Pattern "null, true" | Select-Object -ExpandProperty Line
```
Esperado: 7 líneas con `null, true`.

- [ ] **Step 8: Commit**

```powershell
git -C "C:/Users/noyag/Norberto-Documentos" add --all
git -C "C:/Users/noyag/Norberto-Documentos" commit -m "feat(wf02): mark functional sendText call sites with forceText=true"
```

---

### Task 4: Deploy WF02 a n8n

**Context:** El deploy lee el archivo local, hace GET del workflow completo, actualiza el nodo `c02-bot`, y hace PUT. El JWT ya está disponible (ver sección "Información del entorno" arriba).

**Files:**
- Read: `C:/Users/noyag/wf02_code.js`

- [ ] **Step 1: Preparar variables en PowerShell**

```powershell
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ"
$headers = @{ "X-N8N-API-KEY" = $token }
$n8nBase = "https://nexo-terra-n8n.6fwciw.easypanel.host"
$wf02Id = "la5XjIMeKIMoTa0q"
$code = Get-Content -Path "C:/Users/noyag/wf02_code.js" -Raw
```

- [ ] **Step 2: GET del workflow WF02**

```powershell
$wf = Invoke-RestMethod -Uri "$n8nBase/api/v1/workflows/$wf02Id" -Headers $headers
$wf.name  # debe decir algo como "WF02 - Bot Conversacional"
```

- [ ] **Step 3: Actualizar el nodo c02-bot con el nuevo código**

```powershell
$node = $wf.nodes | Where-Object { $_.id -eq "c02-bot" }
$node.parameters.jsCode = $code
Write-Host "Nodo encontrado: $($node.name)"
```

- [ ] **Step 4: PUT el workflow actualizado**

```powershell
$body = $wf | ConvertTo-Json -Depth 50
$res = Invoke-RestMethod -Uri "$n8nBase/api/v1/workflows/$wf02Id" -Method PUT -Headers $headers -ContentType "application/json" -Body $body
Write-Host "Status: OK — WF02 actualizado"
```

Esperado: no lanza excepción, `$res.id` es `la5XjIMeKIMoTa0q`.

- [ ] **Step 5: Commit**

```powershell
git -C "C:/Users/noyag/Norberto-Documentos" commit --allow-empty -m "deploy: WF02 audio voice support (transcribeAudio + sendAudio + forceText)"
```

---

### Task 5: Actualizar WF01 — agregar `mediaId` al nodo "3. Extraer Mensaje"

**Context:** WF01 gateway ya extrae `msgType` y pasa `__MEDIA__` para audios. El único cambio es agregar `mediaId` al objeto de retorno del mismo nodo.

**Files:**
- WF01 nodo "3. Extraer Mensaje" — se lee y modifica directo vía n8n API

- [ ] **Step 1: GET WF01 y encontrar el nodo**

```powershell
$wf01Id = "dVfZYeSsVigWd0cJ"
$wf01 = Invoke-RestMethod -Uri "$n8nBase/api/v1/workflows/$wf01Id" -Headers $headers
$node3 = $wf01.nodes | Where-Object { $_.name -like "*Extraer*" }
Write-Host "Nodo: $($node3.name) — ID: $($node3.id)"
```

- [ ] **Step 2: Inspeccionar el código actual**

```powershell
$node3.parameters.jsCode
```

Buscar en el output el objeto de retorno (`return [{ json: {`). Debe verse algo como:
```js
return [{
  json: {
    phone: ...,
    textoMensaje: textoMensaje,
    msgType: msgType,
    interactiveId: ...,
    convEstado: ...,
    convContexto: ...,
    ...
  }
}];
```

Verificar que NO existe ya `mediaId` en el retorno:
```powershell
$node3.parameters.jsCode | Select-String "mediaId"
# Esperado: sin resultados
```

- [ ] **Step 3: Modificar el código — agregar mediaId al return**

Localizar el objeto de retorno final del nodo. Agregar la línea `mediaId: msg.audio?.id || msg.image?.id || msg.video?.id || msg.document?.id || null,` antes del cierre `}` del JSON:

```powershell
$oldCode = $node3.parameters.jsCode
# Insertar mediaId justo antes del cierre del json de retorno
# Buscar el patrón del campo que termina el objeto (normalmente convContexto o similar)
$newCode = $oldCode -replace '(convContexto\s*:\s*convContexto\s*,?)', '$1`n    mediaId: msg.audio?.id || msg.image?.id || msg.video?.id || msg.document?.id || null,'
$node3.parameters.jsCode = $newCode

# Verificar que se insertó
$node3.parameters.jsCode | Select-String "mediaId"
# Esperado: 1 línea con mediaId
```

**IMPORTANTE:** Si el regex no matchea exactamente (el campo antes del cierre puede llamarse diferente), leer el código del nodo e identificar manualmente el último campo del objeto de retorno. Luego hacer el reemplazo de esa línea específica para agregar `mediaId` después.

Alternativa manual si el regex falla:
```powershell
# Ver el código e identificar el último campo del return
$node3.parameters.jsCode -split "`n" | Select-Object -Last 15
# Luego hacer -replace del campo específico
```

- [ ] **Step 4: PUT WF01 actualizado**

```powershell
$body01 = $wf01 | ConvertTo-Json -Depth 50
$res01 = Invoke-RestMethod -Uri "$n8nBase/api/v1/workflows/$wf01Id" -Method PUT -Headers $headers -ContentType "application/json" -Body $body01
Write-Host "Status: OK — WF01 actualizado"
```

Esperado: no lanza excepción.

- [ ] **Step 5: Smoke test — audio a texto**

Enviar un **mensaje de texto** normal al número demo `5491137936325`:
```
Hola
```
Esperado: el bot responde con texto (bienvenida/DNI). Sin regresiones.

- [ ] **Step 6: Smoke test — audio con voz**

Grabar y enviar un audio de WhatsApp al número demo diciendo: "Hola, quiero sacar un turno".

Esperado:
1. WF01 recibe el mensaje, extrae `msgType: 'audio'` y `mediaId: <id>`
2. WF02 recibe, transcribe con ElevenLabs Scribe (el audio se convierte a texto)
3. La state machine procesa la transcripción (estado `inicio` → responde con bienvenida)
4. La respuesta llega al WhatsApp como **nota de voz** (ícono de auricular, no texto)

Si la respuesta llega como texto (no audio): revisar en n8n los logs de WF02 y verificar que `isAudio` es `true` en la ejecución.

- [ ] **Step 7: Commit final**

```powershell
git -C "C:/Users/noyag/Norberto-Documentos" commit --allow-empty -m "deploy: WF01 mediaId extraction — audio voice response complete"
```

---

## Self-Review

**Spec coverage:**
- ✅ WF01: `mediaId` en output — Task 5
- ✅ WF02 input: `mediaId`, `isAudio` — Task 1
- ✅ `transcribeAudio(mediaId)` — 3 pasos (GET meta → download binary → POST Scribe) — Task 1
- ✅ `sendAudio(phone, text)` — TTS → upload WA media → enviar audio — Task 1
- ✅ Fallback silencioso en `sendAudio` (TTS/upload falla → texto directo, sin recursión) — Task 1
- ✅ Log `[AUDIO] texto` en `consultorio_mensajes` — Task 1
- ✅ `sendText` con `forceText = false` — Task 2
- ✅ `__MEDIA__` handler: audio → transcribir → fall-through; image/video/doc → rechazar — Task 2
- ✅ Transcripción vacía → responder con audio pidiendo repetir — Task 2
- ✅ 7 call sites marcados `forceText: true` (teléfono, nexo-terra URL, demo x2, booking URL, cancelación con datos, Google reviews) — Task 3
- ✅ `sendCTAUrl`, `sendButtons`, `sendList` sin cambios — no se tocan
- ✅ Deploy WF02 — Task 4
- ✅ Deploy WF01 — Task 5

**Sin placeholders:** Todo el código está completo.

**Consistencia de tipos:** `transcribeAudio` retorna `string` → usado en `texto = transcripcion.trim()` ✅. `sendAudio` recibe `(phone: string, text: string)` consistente con los callers ✅. `sendText(phone, text, estado, forceText)` — firma consistente con los 7 call sites que pasan `null, true` ✅.
