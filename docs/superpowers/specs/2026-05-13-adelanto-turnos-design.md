# Sistema de Adelanto de Turnos — Diseño

**Fecha:** 2026-05-13  
**Proyecto:** Consultorio Inteligente  
**Feature:** Cascading Slot Fill (agenda llena garantizada)

---

## Problema

Cuando un paciente cancela, el slot queda libre y muchas veces no se rellena. La clínica pierde ingresos, el médico tiene huecos, y hay pacientes que tienen turno lejano y preferirían uno antes. El sistema actual no conecta estos dos lados.

---

## Diseño

### 1. Opt-in: activado por defecto

Al confirmar el turno (WF02 o WF08), el sistema guarda `quiere_adelanto = true` automáticamente. Sin pregunta al paciente.

El paciente puede desactivarlo desde el portal web (WF08 / checkin page) con un toggle "Avisarme si se libera un turno antes" → actualiza `quiere_adelanto = false` en su turno.

### 2. Trigger automático

Cuando un turno pasa a estado `cancelado` (bot, dashboard o cualquier workflow), WF-ADELANTO-1 se dispara automáticamente. Sin acción manual de la secretaria.

Trigger: llamado explícito desde WF02/WF05/WF10 en el momento en que hacen el UPDATE a `cancelado` (más confiable que un webhook de Supabase en esta instancia).

### 3. Lógica de cascada

```
Turno T se cancela → slot S queda libre para Doctor D
    ↓
WF-ADELANTO-1 se dispara
    ↓
Busca candidato: quiere_adelanto=true, mismo doctor, estado activo,
                 fecha_hora > slot_fecha, excluye ya-intentados en este ciclo
    ↓
Encontrado Paciente P (turno el día X, lejano)
    ↓
WF-ADELANTO-1:
  - Crea oferta en BD con expira_at = NOW() + 20min
  - Guarda en ctx de P: { estado: 'adelanto_pendiente', adelantoOfertaId,
      adelantoSlotFecha, adelantoTurnoActualFecha, adelantoDoctorNombre }
  - Envía WhatsApp: "Hola [nombre], se liberó un turno con el Dr. [D] para
      el [slot_fecha]. ¿Querés adelantar tu turno del [X]? Respondé SI o NO."
    ↓
[NO inmediato] → sin espera → siguiente candidato (intento+1)
[Sin respuesta 20min] → cron → siguiente candidato (intento+1)
[SI] → mueve turno, confirma, libera turno X → WF-ADELANTO-1 cicla con slot X
[Respuesta tardía, ver sección 4] → manejo especial
    ↓
Si intento > 5 o sin más candidatos → slot al pool normal, resetear estados colgados
```

### 4. Respuesta tardía (oferta ya expirada)

El cron **no resetea `ctx.estado`** al expirar. El paciente sigue en `adelanto_pendiente`. Cuando responde tarde, WF-ADELANTO-2 detecta `oferta.estado = 'expirado'` y consulta el estado actual del slot:

```
oferta.estado = 'expirado' + paciente responde SI
    ↓
¿Hay oferta 'pendiente' para el mismo slot? (candidato B lo tiene ahora)
    ├── SÍ → "Tu respuesta llegó mientras lo consultábamos con otra persona.
    │          Si no lo confirma, sos el primero de la lista. Te avisamos en breve."
    │          [Guarda referencia de A como candidato prioritario si B rechaza/expira]
    │
    └── NO (slot libre entre candidatos o todos rechazaron)
          ├── slot_fecha >= NOW() + 2hs → "¡El turno todavía está disponible! ¿Confirmás?"
          │    → Re-activa oferta → flujo normal de confirmación
          │
          └── slot_fecha < NOW() + 2hs → "Lo sentimos, ese turno ya no está disponible.
               Si se libera otro, te avisamos." → reset a 'inicio'

¿El slot ya fue aceptado por otro?
    └── "Ese turno ya fue tomado. Si se libera otro con el Dr. [D], te avisamos." → reset a 'inicio'
```

---

## Integridad del state machine — Puntos críticos

Esta es la sección más importante. El riesgo principal es que WF01 trate un mensaje de un paciente en `adelanto_pendiente` como una conversación nueva y rompa el flujo.

### WF01 — Routing explícito (cambio crítico)

WF01 debe agregar `adelanto_pendiente` como estado de ruteo **antes** del fallthrough a WF02:

```javascript
// Orden de evaluación en WF01:
if (handoff_humano)              → WF05
if (estado === 'procesando')     → ignorar (lock activo)
if (estado === 'adelanto_pendiente') → WF-ADELANTO-2   // ← NUEVO, antes de WF02
else                             → WF02
```

Sin esto, cualquier mensaje de un paciente en adelanto llega a WF02, que lo trata como conversación nueva.

### WF-ADELANTO-2 — Lock y parsing robusto

WF-ADELANTO-2 arranca igual que WF02: pone `estado = 'procesando'` en BD antes de procesar nada.

**Parsing de respuesta:**

| Mensaje del paciente | Interpretación |
|---------------------|----------------|
| SI / SÍ / si / sí / 1 / "dale" / "sí quiero" | Acepta |
| NO / no / 2 / "no gracias" / "mejor no" | Rechaza |
| Cualquier otra cosa (incluyendo "hola", "quiero un turno", "confirmo") | Ambiguo |

**Manejo de respuesta ambigua:**
- Primera vez: reenviar la oferta con contexto: *"Tenés una propuesta de adelanto pendiente. ¿Querés mover tu turno del [X] al [slot cercano]? Respondé SI o NO."*
- Si vuelve a ser ambiguo → tratar como NO, avisar: *"Mantenemos tu turno del [X]. Si querés cambiar algo, escribinos cuando quieras."*
- Máximo 1 re-pregunta. Al segundo mensaje ambiguo siempre va a NO.

**Caso "confirmo" (confusión con recordatorio):**
El paciente puede estar respondiendo al recordatorio de 24hs, no al adelanto. "Confirmo" es ambiguo. No interpretarlo como SI al adelanto — va al flujo ambiguo y re-muestra la oferta.

### WF-REMINDER — No enviar si hay adelanto pendiente

WF-REMINDER (cron 24hs antes) debe verificar `ctx.estado` antes de enviar:

```javascript
if (ctx.estado === 'adelanto_pendiente') {
  // No enviar recordatorio separado — el paciente ya está en conversación activa.
  // Loguear y saltar este paciente en el batch.
  // Alternativa: enviar recordatorio combinado (ver abajo).
}
```

**Opción A (recomendada): Saltear** — el paciente ya tiene una conversación activa sobre su turno, no hace falta el recordatorio.

**Opción B: Recordatorio combinado** — si se quiere notificar igual, el mensaje incluye ambas cosas:
*"Recordatorio: tenés turno el [X] con el Dr. [D]. También tenés pendiente una propuesta de adelanto — respondé SI para cambiarlo al [slot] o NO para mantener el del [X]."*

La Opción A es más simple y evita confusión. Se puede implementar B en una segunda iteración.

### Casos borde adicionales

**El turno original del paciente se cancela mientras está en `adelanto_pendiente`:**
- Alguien (secretaria o el mismo paciente) cancela el turno X mientras P está esperando confirmar el adelanto al slot S
- WF-ADELANTO-2 al procesar la respuesta: verifica que `turno_origen_id` sigue activo antes de mover
- Si ya está cancelado → *"Tu turno anterior ya fue cancelado. Agendamos el nuevo turno directamente al [slot]."* → crear turno nuevo en slot S

**El slot S se llena por otra vía mientras la oferta está pendiente:**
- Otro paciente saca turno por WF02/WF08 en ese mismo slot
- WF-ADELANTO-2 al procesar SI: intenta UPDATE en slot S, detecta colisión → *"Lo sentimos, ese turno fue tomado recién. Tu turno del [X] sigue vigente."* → reset a 'inicio'

**El paciente en `adelanto_pendiente` manda una palabra de handoff:**
- En estado `adelanto_pendiente`, las palabras de handoff ("secretaria", "humano", etc.) deben transferir a handoff normalmente
- WF01 verifica handoff keywords ANTES del routing a WF-ADELANTO-2

**Demo mode:**
- `adelanto_pendiente` se agrega a la lista de estados que van al FAQ handler (no al bot de inicio) — igual que los otros estados activos en demo

---

## Principio de diseño: estado de contexto en mensajes proactivos

**Problema general:** Cada vez que el sistema manda un mensaje proactivo (recordatorio, adelanto, post-consulta), el paciente puede responder cualquier cosa. Si `ctx.estado = 'inicio'` en ese momento, WF01 lo rutea a WF02 como conversación nueva — el bot no sabe a qué se refiere el paciente y responde con el saludo de inicio. Eso es incorrecto.

**Regla:** Todo workflow que envía un mensaje proactivo debe guardar un estado de contexto en `ctx` ANTES de enviar el mensaje. Cuando el paciente responde, WF01 rutea al handler correcto en lugar de WF02.

### WF-REMINDER — estado `recordatorio_pendiente`

Al enviar el recordatorio de 24hs, WF-REMINDER setea:
```json
{
  "estado": "recordatorio_pendiente",
  "recordatorioTurnoId": "uuid",
  "recordatorioTurnoFecha": "2026-05-21T10:00:00-03:00",
  "recordatorioDoctorNombre": "Dr. García"
}
```

WF01 rutea `recordatorio_pendiente` a un handler específico (puede ser un nodo dentro de WF02 o un sub-workflow).

**Manejo de respuestas en `recordatorio_pendiente`:**

| Respuesta del paciente | Acción |
|------------------------|--------|
| SI / Confirmo / Sí | Actualiza turno a `confirmado`, responde "Turno confirmado para el [fecha]. ¡Hasta mañana!" → reset `inicio` |
| NO / Cancelo / No puedo | Inicia flujo de cancelación, pregunta si quiere otro turno → reset según resultado |
| Cualquier otra cosa (pregunta, comentario, texto libre) | Responde en contexto del turno: "Tenés turno con el Dr. [D] el [fecha] a las [hora]. ¿Confirmas la asistencia? (SI / NO)" — re-muestra el contexto, no abre conversación nueva |
| Palabra de handoff | Escala a handoff con contexto del turno |

El estado `recordatorio_pendiente` expira automáticamente 2 horas antes del turno (el recordatorio ya no es relevante). WF-REMINDER-CRON o el mismo WF-ADELANTO-CRON puede hacer esta limpieza.

**Jerarquía de estados proactivos en WF01:**
```
handoff_humano         → WF05
procesando             → ignorar
adelanto_pendiente     → WF-ADELANTO-2
recordatorio_pendiente → handler recordatorio (en WF02 o sub-workflow)
[otros proactivos futuros van aquí, en orden de prioridad]
inicio / cualquier otro → WF02
```

Los estados proactivos tienen prioridad sobre WF02 genérico porque el paciente está respondiendo algo específico, no iniciando una conversación nueva.

### Otros mensajes proactivos (mismo patrón)

- **WF06 (post-consulta / feedback):** Si el sistema envía "¿Cómo fue tu consulta? Puntuá del 1 al 5", debe setear `ctx.estado = 'feedback_pendiente'`. Respuestas numéricas van al handler de feedback, no a WF02.
- **Futuras notificaciones:** mismo principio — siempre setear estado antes de enviar.

---

## Cambios de schema

```sql
-- Agregar a consultorio_turnos
ALTER TABLE consultorio_turnos
  ADD COLUMN quiere_adelanto BOOLEAN DEFAULT TRUE;  -- opt-out, no opt-in

-- Nueva tabla para rastrear el ciclo de ofertas
CREATE TABLE consultorio_adelanto_ofertas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_fecha      TIMESTAMPTZ NOT NULL,
  profesional_id  UUID REFERENCES consultorio_profesionales(id),
  turno_origen_id UUID REFERENCES consultorio_turnos(id),
  intento         INTEGER DEFAULT 1,              -- posición en la cascada (1-5)
  estado          TEXT DEFAULT 'pendiente',       -- pendiente, aceptado, rechazado, expirado, cancelado
  oferta_at       TIMESTAMPTZ DEFAULT NOW(),
  expira_at       TIMESTAMPTZ,                   -- oferta_at + 20 min
  respuesta_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_adelanto_estado ON consultorio_adelanto_ofertas(estado);
CREATE INDEX idx_adelanto_expira ON consultorio_adelanto_ofertas(expira_at);
CREATE INDEX idx_adelanto_slot   ON consultorio_adelanto_ofertas(slot_fecha, profesional_id);
```

**Campos en `ctx` de conversaciones al enviar oferta:**
```json
{
  "estado": "adelanto_pendiente",
  "adelantoOfertaId": "uuid",
  "adelantoSlotFecha": "2026-05-20T10:00:00-03:00",
  "adelantoTurnoActualFecha": "2026-06-15T10:00:00-03:00",
  "adelantoDoctorNombre": "Dr. García",
  "adelantoRepreguntas": 0
}
```
Guardar estos campos en ctx evita queries adicionales a BD para armar los mensajes al paciente.

---

## Nuevos workflows n8n

### WF-ADELANTO-1: Buscar candidato y enviar oferta
- **Trigger:** Llamado por WF02/WF05/WF10 al cancelar + llamado interno desde WF-ADELANTO-2 (cascada)
- **Input:** `{ slot_fecha, profesional_id, intento, excluir_pacientes[] }`
- Valida: `slot_fecha >= NOW() + 2hs` y `intento <= 5`
- Query candidato: `quiere_adelanto=true`, mismo doctor, estado activo, `fecha_hora > slot_fecha`, NOT IN `excluir_pacientes`, ORDER BY `fecha_hora DESC`, LIMIT 1
- Si sin candidato → log + fin (slot al pool)
- Crea oferta en BD, guarda ctx del candidato, envía WhatsApp

### WF-ADELANTO-2: Procesar respuesta
- **Trigger:** WF01 cuando `ctx.estado = 'adelanto_pendiente'`
- Lock `procesando` inmediato
- Fetch oferta por `ctx.adelantoOfertaId`
- Evalúa estado de oferta + parsing de mensaje → árbol de decisión completo (ver secciones 3 y 4)
- Siempre libera lock al final

### WF-ADELANTO-CRON: Timeout de 20 minutos
- **Trigger:** Cada 10 minutos
- Busca ofertas `pendiente` con `expira_at <= NOW()`
- Marca `expirado` (NO resetea ctx.estado del paciente)
- Si `intento < 5` → dispara WF-ADELANTO-1 con `intento+1` y el paciente expirado en `excluir_pacientes`
- Si `intento = 5` → slot al pool; resetea ctx.estado de todos los `adelanto_pendiente` de ese ciclo a `inicio`

### Cambios en workflows existentes
- **WF01:** Agregar routing explícito para `adelanto_pendiente` → WF-ADELANTO-2 (antes del fallthrough a WF02). Verificar handoff keywords antes de ese routing.
- **WF02:** Al confirmar turno → setear `quiere_adelanto = true`. Al cancelar turno → llamar WF-ADELANTO-1.
- **WF05:** Al cerrar handoff con turno cancelado → llamar WF-ADELANTO-1.
- **WF10 (cron cierre handoff):** Al cancelar turnos inactivos → llamar WF-ADELANTO-1.
- **WF-REMINDER:** Verificar `ctx.estado !== 'adelanto_pendiente'` antes de enviar. Si está pendiente → saltear.

---

## Feature 2: Monitoreo en vivo (Pestaña "En Vivo")

Nueva pestaña Tooljet, auto-refresh 30 segundos.

| Columna | Fuente |
|---------|--------|
| Paciente | `consultorio_pacientes.nombre` |
| Estado bot | `consultorio_conversaciones.estado` (badge color) |
| Último mensaje | `ctx->>'ultimoMensaje'` |
| Tiempo en estado | `NOW() - updated_at` |
| Handoff | `handoff_humano = true` → badge rojo |

Filtro: `updated_at > NOW() - INTERVAL '2 hours'`.

Acciones por fila: ver ctx completo (modal), tomar handoff.

---

## Orden de implementación

1. **Schema migration** — ALTER + CREATE TABLE (5 min)
2. **WF01** — routing explícito: `adelanto_pendiente` + `recordatorio_pendiente` + handoff keywords antes de ambos (20 min)
3. **WF-REMINDER** — setear `recordatorio_pendiente` en ctx al enviar + handler de respuestas en WF02 (30 min)
4. **WF-ADELANTO-1** — buscar candidato + enviar oferta (45 min)
5. **WF-ADELANTO-2** — procesar respuesta con todos los casos borde (60 min)
6. **WF-ADELANTO-CRON** — timeout cada 10 min (15 min)
7. **WF02/WF05/WF10** — llamar WF-ADELANTO-1 al cancelar + set quiere_adelanto (20 min)
8. **Dashboard: pestaña "Adelantos"** (30 min)
9. **Dashboard: pestaña "En Vivo"** (30 min)

**Total estimado:** ~4 horas.

---

## Decisiones tomadas

- **Opt-out** — `quiere_adelanto = true` por defecto. Más participación, menos fricción.
- **Trigger desde workflows existentes, no Supabase webhook** — más confiable en la instancia actual.
- **20 min timeout, 5 intentos máx** — equilibrio entre dar tiempo al paciente y no tener el slot congelado.
- **NO inmediato → siguiente sin espera** — no tiene sentido esperar si ya rechazó.
- **El cron no resetea ctx** — permite manejar respuestas tardías con lógica inteligente.
- **Ambiguo ≠ SI** — "Confirmo" puede ser respuesta al recordatorio. Se re-pregunta antes de asumir.
- **WF-REMINDER saltea si hay adelanto pendiente** — el paciente ya está en conversación activa sobre su turno.
- **WF07 desactivado** — esta lógica lo reemplaza completamente.
