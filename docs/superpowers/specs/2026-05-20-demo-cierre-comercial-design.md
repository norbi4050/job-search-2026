# Demo Auto-Cierre Comercial — Consultorio Inteligente — Design

**Goal:** Convertir el demo de WhatsApp en una herramienta de ventas autónoma que muestra el sistema con los datos del prospecto, calcula el ROI personalizado, y cierra la venta sin intervención de Carlos.

**The insight:** El prospecto no compra el sistema — compra el número que le aparece en la pantalla con su nombre. El bot es el vendedor.

---

## Dos flujos

### Flujo A — Presencial
Carlos está con el prospecto. Antes de la reunión, carga los datos en el dashboard y genera un código `DEMO-XXXX`. Le da el teléfono al prospecto y le dice "mandá este código". El bot ya tiene los datos y hace la demo completa con números reales del consultorio.

### Flujo B — Remoto
Carlos comparte el link de WhatsApp `wa.me/...?text=DEMO-XXXX`. El prospecto lo abre y envía el código. Como Carlos no estuvo en persona para cargar los datos, el bot hace 3 preguntas de calificación (framed como "necesito tus datos para personalizar la demo") antes de arrancar.

---

## Componentes

### 1. Supabase — tabla `consultorio_demo_sessions`

```sql
CREATE TABLE consultorio_demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(9) UNIQUE NOT NULL,     -- 'DEMO-XXXX'
  clinic_name TEXT NOT NULL,
  turnos_dia INTEGER NOT NULL,
  profesionales INTEGER NOT NULL,
  admin_name TEXT,                      -- nombre del dueño (para personalizar)
  tipo TEXT NOT NULL DEFAULT 'remoto',  -- 'presencial' | 'remoto'
  estado TEXT NOT NULL DEFAULT 'activo',-- 'activo' | 'usado' | 'expirado'
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL       -- created_at + 48h
);
```

El código se genera en el servidor: 4 chars aleatorios A-Z0-9, con comprobación de unicidad.

### 2. Dashboard — `/dashboard/demos`

Acceso: solo `dueno`. Mismo guard que `/dashboard/campanas`.

**Lista de sesiones activas:**
- Código, nombre consultorio, tipo, turnos/día, creada hace X, expira en Y
- Link copiable (ícono copy): `https://wa.me/5491137936325?text=DEMO-XXXX`
- Badge estado: verde (activo), gris (expirado/usado)

**Modal "Nueva Demo":**
- Campo: Nombre del consultorio o clínica
- Campo: Turnos por día (número)
- Campo: Cantidad de profesionales (número)
- Campo: Nombre del dueño/admin (para el audio personalizado, opcional)
- Radio: Presencial / Remoto
- Al crear → muestra el código + link copiable inmediatamente

**API routes:**
- `POST /api/demos/crear` → genera código, inserta, retorna `{code, wa_link}`
- `GET /api/demos` → lista todas las sesiones del último mes

### 3. WF01 — detección DEMO-XXXX

En `WF01_GATEWAY_code2.js`, después de cargar/crear la conversación:

1. Si `textoMensaje.toUpperCase().match(/^DEMO-[A-Z0-9]{4}$/)` Y `conv.estado === 'inicio'`:
2. Fetch `consultorio_demo_sessions` WHERE `code = texto` AND `estado = 'activo'` AND `expires_at > now()`
3. Si encontrado: PATCH `conv.contexto = {demo_session: {...}}` + `conv.estado = 'demo_prospecto_init'`
4. Si no encontrado (expirado, inválido): no hacer nada → WF02 maneja como texto normal en `inicio`

El output de code2.js incluye `convEstado: 'demo_prospecto_init'` y `convContexto: {demo_session: {...}}`.

### 4. WF02 — nuevos estados

#### `demo_prospecto_init`

Entry point. Siempre envía un saludo personalizado, luego:
- Si `ctx.demo_session.tipo === 'presencial'` → transición directa a `demo_prospecto_didactica` (el bot ya tiene todos los datos)
- Si `tipo === 'remoto'` → primer pregunta de calificación, transición a `demo_prospecto_preguntas`

Mensaje de saludo (presencial):
> "¡Hola! Soy *Sofía* 👋, la asistente de *Consultorio Inteligente*. Carlos me contó que estás evaluando el sistema. Perfecto — te voy a mostrar exactamente cómo funciona con los datos de *[clinic_name]*."

Mensaje de saludo (remoto):
> "¡Hola! Soy *Sofía* 👋, la asistente de *Consultorio Inteligente*. Para mostrarte cómo funciona el sistema *con tus números reales*, necesito 3 datos rápidos. ¿Cómo se llama tu consultorio o clínica?"

#### `demo_prospecto_preguntas`

Solo para flujo remoto. Colecta datos en `ctx.demo_q_step`:
- Step 1 → recibe clinic_name, guarda en `ctx.demo_session.clinic_name`, pregunta turnos_dia
- Step 2 → recibe turnos_dia (int), guarda, pregunta profesionales
- Step 3 → recibe profesionales (int), guarda, dice "Listo, te muestro el sistema", transición a `demo_prospecto_didactica`

Mensajes de preguntas (framing FOMO):
- Q1: "¿Cuántos turnos por día manejan aproximadamente?"
- Q2: "¿Y cuántos profesionales tienen? (médicos, odontólogos, psicólogos...)"
- Transición: "Listo. Ahora sí, la demo — y al final te muestro lo que esto significa en pesos para *[clinic_name]*."

#### `demo_prospecto_didactica`

Si es el primer mensaje en este estado (`!ctx.didactica_sent`), manda la secuencia y setea el flag. Luego transición a `demo_prospecto_cierre`.

Secuencia de mensajes (5 mensajes en orden, con 1s de pausa entre ellos):
1. "📅 *Así arranca todo:* un paciente nuevo te escribe por WhatsApp. Sin importar si es las 3 de la mañana, el sistema lo atiende, verifica si es paciente existente, y le muestra turnos disponibles."
2. "📲 El paciente elige horario, médico y confirma. Se crea el turno automáticamente en el sistema — sin que la secretaria toque nada."
3. "⏰ *24 horas antes del turno*, el sistema le manda un recordatorio automático. Si el paciente no puede, lo reprograma solo. Los no-shows caen de 15% a menos del 3%."
4. "⭐ *Después de la consulta*, el sistema le pide una calificación. Si es baja, te avisa antes de que se vaya a las redes. Si es alta, le pide que te deje reseña en Google."
5. "😴 *Pacientes dormidos* — los que no vinieron en 3 meses — reciben un mensaje de reactivación automático. En promedio, el 30% vuelve a sacar turno."

Después del último mensaje: transición a `demo_prospecto_cierre`.

#### `demo_prospecto_cierre`

Si `!ctx.cierre_sent`:
1. Calcula ROI con datos del demo_session
2. Envía texto con números personalizados
3. Envía audio ElevenLabs (Sofía) con el closing script personalizado
4. Setea `ctx.cierre_sent = true`

**Fórmula ROI:**
```
turnos_perdidos_mes = turnos_dia × 22 × 0.15   // 15% no-show promedio
turnos_recuperados = turnos_perdidos_mes × 0.80  // 80% recovery
roi_mensual = turnos_recuperados × 45000          // $45.000 por turno (promedio)
```

**Texto mensaje:**
```
🔢 *Los números de [clinic_name]:*

• Turnos por mes: [turnos_dia × 22]
• No-shows actuales (15%): [turnos_perdidos_mes] turnos perdidos
• Turnos que recuperamos: [turnos_recuperados] por mes
• Ingreso recuperado: $[roi_mensual]/mes

💡 En un mes, el sistema te devuelve mucho más de lo que cuesta.

¿Querés que Carlos te cuente los detalles? Escribí *ME INTERESA* 👇
```

**Script del audio (30-45 segundos):**
> "Hola. Ahora que ya viste cómo funciona el sistema, te cuento lo que esto significa para [clinic_name] en números reales. Con [turnos_dia] turnos por día y el 15% de no-shows que es el promedio del sector, estás dejando ir [turnos_perdidos_mes] consultas por mes. Nosotros recuperamos el 80% de esas. Eso son [turnos_recuperados] pacientes más por mes, que a $45.000 por consulta, son $[roi_mensual_formatted] pesos que hoy se están yendo. Un solo mes cubre el costo anual del sistema. Si esto tiene sentido para vos, escribí ME INTERESA y Carlos te llama hoy."

Si el prospecto escribe "ME INTERESA" (case-insensitive, también "me interesa", "sí", "si", "quiero saber más", "quiero más info"):
1. Notifica a Carlos por Telegram: `🔥 Prospecto interesado!\n[clinic_name]\nTurnos/día: [N]\nProfesionales: [N]\nROI calculado: $[N]/mes\nContacto WA: [phone]`
2. Responde al prospecto: "¡Genial! Carlos te va a contactar en breve. Gracias por tu tiempo. 😊"
3. PATCH `demo_session.estado = 'usado'`

OOC en cierre: responde "Si tenés alguna pregunta sobre el sistema, escribime. Y si querés hablar con Carlos, escribí *ME INTERESA*."

---

## Routing en el dashboard

La nueva tab "Demos" aparece al lado de "Campañas" en el sidebar, solo visible para `dueno`.

---

## Decisiones

- **Código 4 chars A-Z0-9:** da 36^4 = ~1.7M combinaciones. Para el volumen esperado (docenas de demos) hay colisión prácticamente nula.
- **Expiración 48h:** tiempo suficiente para una reunión comercial sin que queden códigos indefinidamente activos.
- **No hay audio en preguntas:** el flow de preguntas es texto puro. El audio va solo en el closing donde el impacto emocional justifica el tiempo de síntesis.
- **Sin auth en WhatsApp:** el código `DEMO-XXXX` es el factor de autenticación. Si alguien lo adivina, ve una demo — no hay riesgo de seguridad.
- **`demo_prospecto_*` estados separados de `demo_faq_mode`:** el nuevo flow es comercial; el flow existente es técnico. No mezclar.
- **CONSULTORIO_SUPABASE_URL/KEY** para la query en WF01 (patrón consultorio correcto).
