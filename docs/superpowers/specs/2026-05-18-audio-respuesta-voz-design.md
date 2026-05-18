# Respuesta a Audios con Voz — Design

## Qué construimos

Cuando un paciente manda un audio de WhatsApp, el bot lo transcribe con ElevenLabs Scribe, lo procesa a través de la misma state machine que un mensaje de texto, y responde con audio sintetizado por ElevenLabs (voz Sofía). Para mensajes funcionales que contienen datos clave (links de booking, resumen de turno, etc.) la respuesta sigue siendo texto.

---

## Arquitectura

Dos archivos modificados: **WF01** (mínimo — pasar mediaId) y **WF02** (lógica principal). Sin workflows nuevos.

```
Paciente → audio WhatsApp
  → WF01: extrae msgType='audio' + mediaId
  → WF02:
      1. transcribeAudio(mediaId) → texto
      2. state machine normal (booking, cancelación, FAQ, etc.)
      3. respuesta: sendText(forceText=false) → audio vía ElevenLabs TTS
                    sendText(forceText=true) / sendCTAUrl / sendButtons → texto
```

---

## Cambio en WF01 — nodo "3. Extraer Mensaje"

Agregar `mediaId` al output cuando el tipo es media:

```js
// En el switch, case 'audio':
case 'audio':
case 'image':
case 'video':
case 'document':
  textoMensaje = '__MEDIA__';
  break;
```

Agregar al objeto de retorno final:
```js
mediaId: msg.audio?.id || msg.image?.id || msg.video?.id || msg.document?.id || null,
```

---

## Cambios en WF02

### 1. Nueva variable de entrada

```js
const msgType = data.msgType || 'text';
const mediaId = data.mediaId || null;
const isAudio = msgType === 'audio' && !!mediaId;
```

### 2. Nueva función: `transcribeAudio(mediaId)`

```js
async function transcribeAudio(mediaId) {
  // Paso 1: obtener URL del archivo
  const meta = await helpers.httpRequest({
    method: 'GET',
    url: `https://graph.facebook.com/v21.0/${mediaId}`,
    headers: { Authorization: `Bearer ${WA_TOKEN}` }
  });
  const audioUrl = meta.url;

  // Paso 2: descargar binary
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

### 3. Nueva función: `sendAudio(phone, text)`

```js
async function sendAudio(phone, text) {
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

  // Paso 2: subir a WhatsApp media
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
  const waMediaId = uploadRes.id;

  // Paso 3: enviar audio
  await helpers.httpRequest({
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'audio',
      audio: { id: waMediaId }
    })
  });

  // Log salida
  try {
    await helpers.httpRequest({
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/consultorio_mensajes`,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ telefono_wa: phone, direccion: 'salida', contenido: `[AUDIO] ${text}`, estado_bot: null })
    });
  } catch(e) {}
}
```

### 4. Modificar `sendText` para soporte de audio

```js
async function sendText(phone, text, estado, forceText = false) {
  if (isAudio && !forceText) {
    await sendAudio(phone, text);
    return;
  }
  // ... código actual de sendText sin cambios ...
}
```

### 5. Intercepción de audio al inicio del flujo

Reemplazar el handler actual de `__MEDIA__` para audio:

```js
if (texto === '__MEDIA__') {
  await updateConv(phone, estado, ctx);
  if (msgType === 'audio' && mediaId) {
    // Transcribir y continuar flujo normal
    const transcripcion = await transcribeAudio(mediaId);
    if (!transcripcion.trim()) {
      await sendText(phone, 'No pude escuchar bien el audio. ¿Podés repetirlo o escribirme?');
      return [{ json: { action: 'audio_transcription_failed', phone } }];
    }
    // Reemplazar texto y continuar — el flujo cae al procesamiento normal debajo
    // (implementar como función o goto equivalente)
    texto = transcripcion.trim();
    // → continúa al procesamiento normal de la state machine
  } else if (msgType === 'image' || msgType === 'video' || msgType === 'document') {
    await sendText(phone, 'Lo sentimos, no podemos recibir fotos ni archivos por este canal. Si tenés una consulta, escribinos con texto 😊');
    return [{ json: { action: 'media_rejected', phone, msgType } }];
  } else {
    await sendText(phone, 'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribís por favor?');
    return [{ json: { action: 'media_rejected', phone } }];
  }
}
```

### 6. Call sites con `forceText: true`

Marcar con `forceText: true` los `sendText` que contienen datos que el paciente necesita leer:

- Resumen de turno con fecha/hora/profesional
- Confirmación de cancelación con detalles
- Mensajes que incluyen URLs
- Mensaje de showcase (demo mode)

`sendCTAUrl`, `sendButtons`, `sendList` — sin cambios, siempre texto/interactivo.

---

## Regla audio vs texto

| Tipo de respuesta | Canal |
|-------------------|-------|
| Saludo, bienvenida | 🎙️ Audio |
| Preguntas al paciente (especialidad, profesional, OS) | 🎙️ Audio |
| Confirmaciones conversacionales | 🎙️ Audio |
| FAQ / answerFAQ | 🎙️ Audio |
| Mensajes de error / rechazo | 🎙️ Audio |
| Link de booking (sendCTAUrl) | 📝 Texto |
| Botones / listas interactivas | 📝 Texto |
| Resumen turno con fecha/hora/médico | 📝 Texto |
| Confirmación cancelación con datos | 📝 Texto |
| Mensajes con URL | 📝 Texto |

---

## Error handling

- Transcripción vacía → responder con audio: "No pude escuchar bien el audio. ¿Podés repetirlo?"
- TTS falla → fallback silencioso a `sendText` con el mismo texto
- Upload WA media falla → fallback a `sendText`
- Todo dentro de try/catch, nunca rompe el flujo de la conversación

---

## Lo que NO cambia

- State machine completa: booking, cancelación, reprogramación, FAQ, adelanto de turnos, demo mode
- `sendButtons`, `sendList`, `sendCTAUrl` — siempre texto/interactivo
- Flujo de handoff — siempre texto
- Logs en `consultorio_mensajes` — audio logueado como `[AUDIO] texto`
- Race condition lock — sin cambios

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `C:/Users/noyag/wf02_code.js` | Funciones nuevas + modificar sendText + handler audio |
| Deploy script existente (inline) | PUT WF02 vía n8n API |
| WF01 live (vía n8n API) | Agregar `mediaId` al output del nodo "3. Extraer Mensaje" |

---

## Fuera de scope

- Modo audio persistente por sesión (decidido: solo por mensaje)
- Envío de audio en campañas o recordatorios
- STT con OpenAI Whisper
