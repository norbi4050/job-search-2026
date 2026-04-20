# WF02 + WF08 — Confirmación editable, CTA button y retorno a WhatsApp

**Fecha**: 2026-04-20
**Autor**: Carlos Norberto González Archilla
**Proyecto**: Consultorio Inteligente (demo Nexo Terra)
**Workflows afectados**: `la5XjIMeKIMoTa0q` (WF02 Bot Conversacional), `lNSGEWwP4VlSVES8` (WF08 Selector de Turnos Web)

---

## 1. Contexto

El flow de reserva de turno del demo `Consultorio Inteligente` tiene tres puntos de fricción identificados con usuarios reales (adultos mayores, familiar directo):

1. **No hay forma de corregir un dato mal cargado**. Si el paciente escribió mal su nombre, OS o eligió el médico equivocado, sigue avanzando sin posibilidad de volver atrás. Detectado cuando el papá del dueño del bot puso "SI OSDE" y el bot intentó parsear eso como una obra social.
2. **Link HTTP dentro del mensaje de WhatsApp** — el bot manda el link de selección de turnos como texto plano. Usuarios mayores no reconocen que es tocable, o lo confunden con un error.
3. **Desorientación después de reservar en la web** — el paciente completa la reserva en la página HTML, queda en esa pantalla y no se da cuenta de que tiene que volver a WhatsApp. Puede cerrar la ventana o seguir esperando algo que no va a pasar allí.

Este spec cubre los tres puntos en una sola iteración.

---

## 2. Scope

**Incluye:**

- Nuevo estado `confirmar_datos` en WF02 con resumen pre-booking y edición puntual de cada dato.
- Helper `sendCTAUrl()` en WF02 para usar botones tipo `interactive / cta_url` de WhatsApp Cloud API.
- Reemplazo de `sendText(link)` por `sendCTAUrl()` en los 3 puntos donde el bot envía el link de booking.
- Modificación de `sucPg()` en WF08 para: (a) botón visible "Volver a WhatsApp", (b) redirect automático al chat de WhatsApp después de 3 segundos con cuenta regresiva visible.

**No incluye (out of scope):**

- Reemplazar el flow de selección de horarios por botones/lista dentro de WhatsApp (se discutió y se descartó para este iter).
- Cambios al tono de los mensajes del bot fuera de los strings nuevos.
- Refactors de helpers existentes (`sendText`, `sendButtons`, `sendList`, `askClaude`) — se mantienen como están.
- Validación de nombre con 2+ palabras, email/SMS, typing indicator, política de cancelación, confirmación post-consulta. Quedan para futuras iteraciones.
- Cambios en WF01 (Gateway), WF03–WF10.

---

## 3. Datos requeridos (constantes de configuración)

| Dato | Valor | Dónde se usa |
|---|---|---|
| Número de WhatsApp del consultorio (demo) | `5491137936325` | Deep-link `wa.me/` en WF08 `sucPg()` |

En el código se define como constante al inicio del nodo Code:

```js
const CONSULTORIO_WA_NUMBER = '5491137936325';
```

Si el cliente final (no el demo) tiene otro número, basta editar esa constante.

---

## 4. Arquitectura general

```
┌─────────────┐      ┌──────────────────┐      ┌────────────────┐
│  WhatsApp   │─────▶│  WF02 Bot        │─────▶│   Supabase     │
│  Paciente   │◀─────│  Conversacional  │◀─────│   (datos)      │
└─────────────┘      └────────┬─────────┘      └────────────────┘
                              │
                     CTA URL (feature 2)
                              ▼
                     ┌──────────────────┐
                     │  WF08 Selector   │
                     │  Turnos Web      │
                     └────────┬─────────┘
                              │
                  push confirmación (ya existe)
                              ▼
                     ┌──────────────────┐
                     │ Redirect wa.me/  │  (feature 3)
                     │ + botón visible  │
                     └──────────────────┘
```

Ningún workflow nuevo. Ninguna tabla de Supabase nueva.

---

## 5. Feature 1 — Resumen final con edición

### 5.1 Estado nuevo: `confirmar_datos`

Se inserta entre los estados `esperando_profesional` (o `esperando_especialidad` cuando hay un solo profesional) y `elegir_dia`. El flujo actual salta directo de profesional → `mostrarDias()`. Con este cambio:

- En vez de `mostrarDias(phone, ctx)`, se llama a `mostrarResumenConfirmacion(phone, ctx)`.
- La función `mostrarResumenConfirmacion` setea el estado a `confirmar_datos` y envía una lista interactiva con el resumen en el body + opciones.

### 5.2 Mensaje del resumen

Body del `sendList`:

```
Antes de elegir el horario, revisá tus datos:

👤 Nombre: {ctx.pacienteNombre}
🆔 DNI: {ctx.dni}
🏥 Obra social: {ctx.obraSocial || 'Particular'}
👨‍⚕️ Profesional: {ctx.profesionalNombre} ({ctx.especialidad})

¿Está todo bien?
```

Botón de la lista: `"Ver opciones"`.

Secciones de la lista (con sus rows):

**Sección 1 — "Confirmar"**
- `confirmar_datos_ok` → **"✅ Sí, todo bien"**

**Sección 2 — "Corregir"**
- `edit_nombre` → **"Cambiar nombre"** (solo si paciente nuevo, ver 5.4)
- `edit_os` → **"Cambiar obra social"**
- `edit_especialidad` → **"Cambiar especialidad"**
- `edit_profesional` → **"Cambiar profesional"**

### 5.3 Handler del estado `confirmar_datos`

```js
if (estado === 'confirmar_datos') {
  if (btnId === 'confirmar_datos_ok') {
    ctx.retry_count = 0;
    await updateConv(phone, 'elegir_dia', ctx);
    await mostrarDias(phone, ctx);
    return [{ json: { action: 'datos_confirmados', phone } }];
  }

  if (btnId === 'edit_nombre') {
    await updateConv(phone, 'esperando_nombre', { ...ctx, edicion: true });
    await sendText(phone, '¿Cuál es tu nombre completo?');
    return [{ json: { action: 'edit_nombre', phone } }];
  }

  if (btnId === 'edit_os') {
    await updateConv(phone, 'esperando_obra_social', { ...ctx, edicion: true, pregOS: undefined });
    await sendButtons(phone, '¿Tenés obra social o prepaga?',
      [{ id: 'os_si', title: 'Sí, tengo' }, { id: 'os_no', title: 'No, particular' }]);
    return [{ json: { action: 'edit_os', phone } }];
  }

  if (btnId === 'edit_especialidad') {
    await updateConv(phone, 'esperando_especialidad', { ...ctx, edicion: true });
    await mostrarEsps(phone);
    return [{ json: { action: 'edit_especialidad', phone } }];
  }

  if (btnId === 'edit_profesional') {
    // Vuelve a la lista de profesionales de la misma especialidad ya elegida
    await updateConv(phone, 'esperando_profesional', { ...ctx, edicion: true });
    const pe = await supaGet('consultorio_profesionales',
      { especialidad: `eq.${ctx.especialidad}`, activo: 'eq.true',
        select: 'id,nombre,consultorio', order: 'nombre.asc' });
    await sendList(phone, `En ${ctx.especialidad} tenemos:`, 'Ver profesionales',
      [{ title: ctx.especialidad, rows: pe.map(p => ({ id: `prof_${p.id}`, title: p.nombre, description: p.consultorio || '' })) }]);
    return [{ json: { action: 'edit_profesional', phone } }];
  }

  // Fallback con retry
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No puede confirmar datos');
  }
  await mostrarResumenConfirmacion(phone, ctx); // re-envía el mismo mensaje
  return [{ json: { action: 'confirmar_datos_retry', phone } }];
}
```

### 5.4 Modo edición — preservar contexto y evitar duplicados

Cuando el usuario entra a un estado ya completado para editar, se setea `ctx.edicion = true`. Esto cambia el comportamiento del estado de destino en dos puntos:

**A) Evitar duplicar paciente en Supabase (`esperando_obra_social`):**

Hoy, al completar OS el bot hace `supaInsert('consultorio_pacientes', ...)` (línea 303). Si `ctx.pacienteId` ya existe (porque se pasó por ahí antes y ahora está editando), en vez de insertar hay que actualizar:

```js
if (ctx.pacienteId) {
  await supaUpdate('consultorio_pacientes',
    { id: `eq.${ctx.pacienteId}` },
    { obra_social: ctx.obraSocial, nombre: ctx.pacienteNombre });
} else {
  const np = await supaInsert('consultorio_pacientes', { dni: ctx.dni, nombre: ctx.pacienteNombre, telefono_wa: phone, obra_social: ctx.obraSocial });
  ctx.pacienteId = np?.[0]?.id;
}
```

**B) Volver al resumen en vez de avanzar:**

Cuando un estado de edición termina correctamente y `ctx.edicion === true`, en vez de avanzar al siguiente estado del onboarding (por ejemplo, `esperando_obra_social` → `esperando_especialidad`), se vuelve a `confirmar_datos` y se re-muestra el resumen con los datos actualizados. Al final de cada estado editable se agrega:

```js
if (ctx.edicion) {
  ctx.edicion = false;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'edit_done', phone } }];
}
// ...flujo normal hacia el siguiente estado
```

**C) `edit_nombre` solo aparece si el paciente es nuevo.**

Para un paciente recurrente que vino por `menu_principal → Sacar turno`, el nombre ya está en Supabase y se asume correcto (la conversación nunca preguntó). Cambiar el nombre en ese caso implicaría cambiar un registro histórico y generar confusión. Por eso:

```js
const rows_corregir = [];
if (!ctx.esRecurrente) rows_corregir.push({ id: 'edit_nombre', title: 'Cambiar nombre' });
rows_corregir.push({ id: 'edit_os', title: 'Cambiar obra social' });
rows_corregir.push({ id: 'edit_especialidad', title: 'Cambiar especialidad' });
rows_corregir.push({ id: 'edit_profesional', title: 'Cambiar profesional' });
```

`ctx.esRecurrente` se setea a `true` cuando el paciente viene de `esperando_dni` con match en Supabase (línea 231-234 del código actual). Ya no existe ese flag hoy — se agrega en esa línea.

### 5.5 Recurrente que quiere editar su OS guardada

Si un paciente recurrente ve en el resumen que su OS guardada está desactualizada (ej. cambió de OSDE a Swiss Medical), toca "Cambiar obra social" y queda en `esperando_obra_social` con `ctx.edicion = true`. Al terminar, el `supaUpdate` actualiza `consultorio_pacientes.obra_social`. Esto sí es una actualización esperada de la DB.

### 5.6 Puntos donde se llama al nuevo estado

Reemplazar `await mostrarDias(phone, ctx)` por `await mostrarResumenConfirmacion(phone, ctx)` en:

1. `esperando_especialidad` → rama `if (pe.length === 1)` (línea 335)
2. `esperando_profesional` → al final del handler (línea 359)

El `mostrarDias` original queda como está y se llama desde `confirmar_datos` cuando el usuario confirma con "Sí, todo bien".

### 5.7 Reprograma desde reminder / menú — no toca este flow

Cuando un paciente reprograma desde un reminder (WF02 estado `respuesta_reminder → rem_reprogramar`, línea 511) o desde el menú (`accion_reprogramar`, línea 453), el código salta directo a `mostrarDias` sin pasar por `confirmar_datos`. Esto es correcto: en reprograma no hay datos para confirmar, solo un nuevo horario. No se modifica.

---

## 6. Feature 2 — Botón CTA "Elegir horario"

### 6.1 Helper nuevo

Agregar junto a `sendText`, `sendButtons`, `sendList` (después de línea 53 del WF02):

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
        action: {
          name: 'cta_url',
          parameters: { display_text: buttonText.substring(0, 20), url }
        }
      }
    })
  });
}
```

### 6.2 Call sites a reemplazar

**Call site 1 — `mostrarDias()` (línea 161):**

```js
// Antes:
await sendText(ph, `📅 Elegí tu turno con ${ctx.profesionalNombre} (${ctx.especialidad}):\n\n👉 ${bookingUrl}\n\nTocá el link para ver los horarios disponibles y confirmar.`);

// Después:
await sendCTAUrl(ph,
  `📅 Turno con ${ctx.profesionalNombre} (${ctx.especialidad})\n\nTocá el botón para ver los horarios disponibles.`,
  'Elegir horario',
  bookingUrl);
```

**Call site 2 — `triggerWaitlist()` (línea 68):**

```js
// Antes:
await sendText(wPac[0].telefono_wa, `¡Hola ${wPac[0].nombre.split(' ')[0]}! Se liberó un turno con ${wProf?.[0]?.nombre||'el profesional'} (${wProf?.[0]?.especialidad||''}).\n\nElegí tu horario acá:\n👉 ${bUrl}\n\n¡Apurate que se puede ocupar!`);

// Después:
await sendCTAUrl(wPac[0].telefono_wa,
  `¡Hola ${wPac[0].nombre.split(' ')[0]}! 🎉\n\nSe liberó un turno con ${wProf?.[0]?.nombre||'el profesional'} (${wProf?.[0]?.especialidad||''}).\n\n¡Apurate que se puede ocupar!`,
  'Ver turno libre',
  bUrl);
```

**Call site 3 — `esperando_seguimiento` (línea 591):**

```js
// Antes:
await sendText(phone, `📅 Elegí tu turno de control con ${ctx.profesionalNombre}:\n\n👉 ${bookingUrl}\n\nTocá el link para ver los horarios disponibles.`);

// Después:
await sendCTAUrl(phone,
  `📅 Turno de control con ${ctx.profesionalNombre}\n\nTocá el botón para elegir horario.`,
  'Agendar control',
  bookingUrl);
```

### 6.3 Call site que NO se toca

El fallback `esperando_booking_web` (línea 372) se mantiene como `sendText` con el link. Ese estado se alcanza cuando el paciente escribe algo mientras debería estar en la web — el mensaje recuerda el link como backup. Tocarlo no aporta.

---

## 7. Feature 3 — Retorno automático a WhatsApp

### 7.1 Qué existe hoy

WF08 `sucPg()` (líneas 39-41) muestra una pantalla de éxito con tick verde, resumen del turno, y un pie que dice "Te enviamos la confirmación por WhatsApp. Podés cerrar esta ventana".

El push al WhatsApp del paciente con el resumen del turno ya se dispara antes de renderizar `sucPg()` (línea 65: `await sendText(conv.telefono_wa, msg)`).

### 7.2 Qué cambia

Dos cambios en la función `sucPg()`:

**A) Constante nueva arriba del Code node (línea 10, junto a `PHONE_ID`):**

```js
const CONSULTORIO_WA_NUMBER = '5491137936325';
const WA_DEEPLINK = `https://wa.me/${CONSULTORIO_WA_NUMBER}`;
```

**B) Botón "Volver a WhatsApp" visible + redirect automático:**

Agregar dentro del `<div class="a">` de `sucPg()`, después del `<div class="wa">` (antes del `<p class="cl">`):

```html
<a href="${WA_DEEPLINK}" class="back-wa">
  <svg viewBox="0 0 24 24" fill="currentColor">
    <!-- Reusar el path del SVG de WhatsApp ya presente en sucPg() línea 40 -->
  </svg>
  Volver a WhatsApp
</a>
<p class="countdown" id="cd">Volviendo en <span id="cd-n">3</span> segundos...</p>
```

> **Nota de implementación**: el `<path d="...">` del ícono de WhatsApp ya está definido en la `sucPg()` actual (línea 40, dentro del `<div class="wa">`). Reusar ese mismo path, no duplicar.

Estilos nuevos en el `<style>` (scope de `sucPg()`):

```css
.back-wa {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  margin-top: 24px; padding: 16px 24px;
  background: #25D366; color: #fff;
  text-decoration: none; font-weight: 600; font-size: 16px;
  border-radius: 100px;
  box-shadow: 0 8px 24px rgba(37, 211, 102, 0.3);
  min-height: 52px;
  transition: transform 0.2s;
}
.back-wa:active { transform: scale(0.97); }
.back-wa svg { width: 22px; height: 22px; }
.countdown {
  margin-top: 14px; font-size: 13px; color: #64748B; text-align: center;
}
```

Reemplazar el texto del pie ("Podés cerrar esta ventana") por el botón + countdown.

**Script del countdown + redirect**, al final del body:

```html
<script>
(function(){
  var n = 3;
  var el = document.getElementById('cd-n');
  var iv = setInterval(function(){
    n--;
    if (el) el.textContent = n;
    if (n <= 0) {
      clearInterval(iv);
      location.href = '${WA_DEEPLINK}';
    }
  }, 1000);
})();
</script>
```

### 7.3 Por qué un botón visible además del redirect

El redirect automático puede fallar por dos razones: (a) el navegador bloquea `location.href` por política de popup/navegación, o (b) el paciente toca la pantalla y detiene el foco. El botón visible con deep-link explícito es el fallback siempre tocable.

### 7.4 Comportamiento del deep-link

`https://wa.me/5491137936325` en un teléfono con WhatsApp instalado abre el chat directo con ese número. Si el paciente no tiene WhatsApp (improbable en el contexto del bot), el link cae a la landing de WhatsApp — degradación aceptable.

---

## 8. Error handling

- **Falla al insertar/actualizar paciente** — el flujo actual no valida respuestas de Supabase y sigue silenciosamente. No se toca ese comportamiento en este spec (queda para un iter de hardening dedicado).
- **Falla al enviar lista/CTA por WhatsApp** — los helpers ya envuelven en try/catch y silencian el error. No se agrega manejo nuevo.
- **Paciente elige "Cambiar profesional" pero en la especialidad solo queda uno** — el flow vuelve a la lista de profesionales con 1 solo item. Es aceptable: el paciente lo toca y vuelve al resumen. Alternativa rechazada: saltar al resumen directo (genera confusión, no refleja acción del usuario).
- **Token expirado en WF08** — ya manejado por `errPg('Sesión expirada', ...)`. No se toca.

---

## 9. Testing — casos a cubrir manualmente

### 9.1 Flujo feliz paciente nuevo

1. Mensaje inicial → DNI → nombre → OS (vía lista) → especialidad → profesional → resumen.
2. En resumen: tocar "Sí, todo bien" → aparece mensaje con **botón CTA "Elegir horario"**.
3. Tocar el botón → abre WF08 web.
4. Elegir día y horario → confirmar.
5. Pantalla de éxito con countdown 3→0 → redirect automático a WhatsApp.
6. En WhatsApp: push de confirmación ya está.

### 9.2 Edición de obra social

1. Llegar al resumen con OSDE.
2. Tocar "Cambiar obra social".
3. Elegir Swiss Medical en la lista.
4. Verificar que vuelve al resumen con Swiss Medical.
5. Confirmar y proceder.
6. En Supabase: `consultorio_pacientes.obra_social` = `'Swiss Medical'` (no se creó un registro nuevo).

### 9.3 Edición de profesional

1. Llegar al resumen con profesional X.
2. Tocar "Cambiar profesional".
3. Elegir profesional Y (misma especialidad).
4. Verificar que vuelve al resumen con profesional Y y misma especialidad.

### 9.4 Edición de especialidad

1. Llegar al resumen con especialidad X, profesional X1.
2. Tocar "Cambiar especialidad".
3. Elegir especialidad Z → nuevo profesional Z1.
4. Verificar que vuelve al resumen con especialidad Z y profesional Z1.

### 9.5 Recurrente

1. Paciente con DNI existente en Supabase.
2. Menu → Sacar turno → especialidad → profesional → resumen con datos guardados.
3. Verificar que la opción "Cambiar nombre" **no aparece**.
4. Cambiar OS y confirmar: datos actualizados en DB.

### 9.6 Fallback del estado `confirmar_datos`

1. Llegar al resumen.
2. Escribir texto libre ("qué tengo que hacer acá?").
3. Retry #1: re-envía el resumen.
4. Retry #2: dispara handoff a humano.

### 9.7 Waitlist + CTA

1. Paciente en waitlist de profesional X.
2. Se libera un turno (manual: cancelar un turno existente de X).
3. Verificar que el paciente recibe mensaje con **botón CTA "Ver turno libre"** (no link texto).

---

## 10. Dependencias y supuestos

- WhatsApp Cloud API soporta `interactive / cta_url` — confirmado en docs v21.0.
- El webhook WF08 responde con HTML válido al GET con `action=confirmar` (comportamiento actual, sin cambios).
- La variable `ctx.esRecurrente` se introduce en `esperando_dni` cuando hay match con Supabase. Es un booleano nuevo en el JSONB de `consultorio_conversaciones.contexto`. No requiere migración de tabla.
- La constante `CONSULTORIO_WA_NUMBER = '5491137936325'` vive en el código de ambos workflows (WF02 no la necesita porque no genera deep-links; WF08 sí).

---

## 11. Rollout

Los cambios son autocontenidos por workflow. Se pueden desplegar en orden:

1. **WF08** primero (retorno a WhatsApp) — aislado, no rompe nada si el bot sigue mandando links texto.
2. **WF02** después (resumen + CTA) — despliegue atómico vía PUT al API.

Ambos workflows quedan activos. No hace falta migración de datos en Supabase ni cambios de ENV.

---

## 12. Out of scope (para iteraciones futuras)

- Slots de horario dentro de WhatsApp (descartado explícitamente por el owner).
- Typing indicator, política de cancelación en mensaje, validación nombre+apellido.
- Preguntar "primera consulta o control" antes del turno.
- Email/SMS como canal alternativo.
- Manejo defensivo de fallos de Supabase (telemetry/alerting).
- Refactor de `askClaude` para DNI (hoy usa LLM, un regex alcanza).
