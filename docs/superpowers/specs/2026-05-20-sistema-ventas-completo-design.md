# Sistema de Ventas Automático — Consultorio Inteligente — Design

**Goal:** Convertir el sistema actual en una máquina de ventas autónoma. Carlos va a una reunión, activa la demo, el bot muestra el sistema con los datos reales del prospecto, cierra con ROI personalizado, y Sofía (Vapi) remata por voz. Carlos no vende — el producto se vende solo.

**The close:** El prospecto está siendo convencido por el mismo producto que está comprando. Al final Carlos dice: "Eso que acabás de vivir — eso es lo que van a vivir tus pacientes."

---

## Arquitectura: dos tracks

El sistema tiene DOS modos separados que nunca se mezclan:

| Track | WFs | Para qué |
|-------|-----|---------|
| **[DEMO]** | WF01-DEMO, WF02-DEMO, WF08-DEMO, WF09 | Vender el sistema a prospectos |
| **[PRODUCTO]** | WF01, WF02, WF08, WF09 (originales) | El sistema real que se mejora para clientes |

**Regla:** En cada sesión de trabajo, queda claro si estamos en modo DEMO o modo PRODUCTO. Los WFs del track inactivo están pausados.

---

## Fase previa: Backup completo → "Preparados para el onboarding"

Antes de tocar nada, exportar el estado actual del sistema:

**Carpeta:** `C:/Users/noyag/Norberto-Documentos/onboarding-kit/`

Contenido:
- `n8n/` — JSONs exportados de todos los WFs activos (WF01-WF10, WF-DASH-*, WF-REMINDER, WF-CUMPLEANOS, WF-REACTIVACION, WF-CAMPANAS, WF-MONTHLY-REPORT, WF-KEEPWARM, WF-ADELANTO-*)
- `vapi/` — prompt completo del assistant Sofía (GET /assistant/1f39b10f)
- `supabase/` — schema SQL de todas las tablas `consultorio_*`
- `dashboard/` — snapshot del código actual (git tag)
- `env-vars.md` — lista de todas las env vars de EasyPanel (sin valores, solo nombres)
- `README.md` — cómo arrancar un cliente nuevo desde cero con este kit

**Este backup no se toca.** Es el template de onboarding. Evoluciona en paralelo al producto.

---

## El funnel de ventas (3 pasos)

### Paso 1 — Dashboard: cargar datos del prospecto

Carlos abre `/dashboard/demos` antes de la reunión.

**Form "Nueva Demo":**
- Nombre del prospecto (obligatorio) — para el saludo de Sofía
- Nombre de la clínica (obligatorio) — para personalizar todo
- Turnos por día (obligatorio) — para el ROI
- Precio por consulta en $ (obligatorio) — para el ROI exacto
- Profesionales (obligatorio) — para el pitch de Sofía
- Tipo: Presencial / Remoto

Al crear → genera código `DEMO-XXXX` + link WA copiable.

**ROI calculado con datos exactos del prospecto:**
```
turnos_mes      = turnos_dia × 22
noshows_mes     = turnos_mes × 0.15
recuperados_mes = noshows_mes × 0.80
roi_mensual     = recuperados_mes × precio_consulta
```

### Paso 2 — WhatsApp: demo + cierre con ROI

#### Detección del código DEMO-XXXX

WF01 detecta mensaje que coincide con `/^DEMO-[A-Z0-9]{4}$/i`:

- **Si el número que escribe es el de Carlos (`+541130875304`)** → carga la sesión desde dashboard (presencial), estado `demo_prospecto_init`, salta las preguntas
- **Cualquier otro número** → carga la sesión si existe y tipo=remoto, o crea contexto vacío para preguntar

#### Preguntas de calificación (solo si faltan datos / flujo remoto)

El bot hace estas 4 preguntas en orden, una por mensaje:

1. "Para personalizar la demo con tus números reales, necesito 4 datos. ¿Cómo te llamás?"
2. "¿Cuál es el nombre de tu consultorio o clínica?"
3. "¿Cuántos turnos por día manejan aproximadamente? _(solo el número)_"
4. "¿Cuánto cobra cada consulta? _(en pesos, sin puntos — ej: 45000)_"

Después: "Listo. Ahora sí, la demo — y al final te muestro lo que esto significa en pesos para *[clínica]*."

#### Simulación de la demo (flujo actual — sin cambios)

El bot corre el flujo de paciente real exactamente como está hoy:

> "Para arrancar, ingresá cualquier número de 7 u 8 dígitos (en producción el paciente ingresaría su DNI...)."
> → DNI fake → nombre → obra social → especialidad → botón turno → TURNO CONFIRMADO → dirección + recordatorios info

Este flujo no se toca. El prospecto lo vive como si fuera un paciente real.

#### Cierre automático post-demo

Después del mensaje "Esto es lo que pasa automáticamente..." (que ya existe), se agregan:

**Mensaje texto con ROI personalizado:**
```
🔢 *Los números de [clínica]:*

• Turnos por mes: [turnos_mes]
• No-shows que perdés hoy (15%): [noshows_mes] turnos
• Turnos que recuperamos: [recuperados_mes] por mes
• A $[precio_consulta] por consulta = *$[roi_mensual]/mes recuperados*

💡 Un mes del sistema cuesta mucho menos que lo que recuperás en la primera semana.
```

**Audio de Sofía (ElevenLabs TTS, ~35 segundos):**
> "Hola, soy Sofía. Acabás de vivir exactamente lo que van a vivir tus pacientes en [clínica]. Ahora los números: con [turnos_dia] turnos por día y el 15% de no-shows del sector, estás perdiendo [noshows_mes] consultas por mes. Nosotros recuperamos el 80% — eso son [recuperados_mes] pacientes más, a $[precio_consulta] cada uno. Son $[roi_mensual] pesos mensuales que hoy se van solos. El sistema se paga en la primera semana. Para arrancar, solo necesitás hablar con Carlos."

**Notificación Telegram a Carlos:**
```
🔥 Prospecto terminó la demo
Nombre: [nombre_prospecto]
Clínica: [nombre_clinica]
Turnos/día: [N] · Precio consulta: $[N]
ROI calculado: $[roi_mensual]/mes
WhatsApp: [phone]
```

**Mensaje final al prospecto:**
> "¡Eso es todo! 😊 Ahora *pasale el teléfono a Carlos* para continuar. Él te explica los próximos pasos."

### Paso 3 — Vapi: Sofía cierra por voz

Carlos llama al número de Sofía (Twilio → Vapi). Sofía carga automáticamente el contexto.

#### Carga automática del contexto

WF09 maneja evento `call-start`. Al recibir llamada de Carlos:
1. Query a `consultorio_demo_sessions` WHERE `estado = 'activo'` ORDER BY `created_at DESC` LIMIT 1
2. Si encontrado: inyecta `nombre_prospecto`, `clinica`, `turnos_dia`, `precio_consulta`, `roi_mensual` en el contexto de la llamada
3. Sofía comienza ya briefeada — sin que Carlos diga nada

#### Comportamiento de Sofía

**Apertura directa al prospecto (Carlos pasa el teléfono):**
> "¡Hola [nombre]! ¿Qué te pareció la demo que te mostró el sistema? ¿Te quedó alguna duda?"

**Modo de operación:**
- No repite el ROI — el prospecto ya lo vio. Resuelve dudas.
- Responde cualquier pregunta técnica con autoridad total
- Puede demostrar en vivo: "¿Querés que te muestre cómo sonaría el saludo para tu consultorio?"
- Precio: "Para eso está Carlos — él maneja los planes según cada caso."
- Máximo 3 objeciones respondidas. A la 4ta: deriva a Carlos.

**Cierre:**
> "¿Tiene sentido esto para [clínica]?"

Si hay interés: *"Carlos, creo que [nombre] está listo para los próximos pasos."*

---

## Objeciones y respuestas de Sofía

| Objeción | Respuesta |
|----------|-----------|
| "¿Cuánto cuesta?" | "Para los números te habla Carlos — lo que sí te digo es que el sistema en promedio se paga en la primera semana con los turnos que recupera." |
| "Los pacientes no van a querer hablar con una IA" | "La mayoría no sabe que es un sistema — perciben que es la asistente del consultorio. Si alguien prefiere hablar con una persona, el sistema los deriva. Como ahora mismo, que Carlos está con vos." |
| "Ya tenemos sistema de turnos" | "¿Mandan recordatorios automáticos 24hs antes? ¿Y reactivan pacientes que no vienen hace meses sin que la secretaria haga nada?" |
| "Necesito pensarlo" | "Claro. ¿Qué es lo que más te genera duda — la implementación, cómo lo van a vivir tus pacientes, o algo del sistema?" |
| "¿Cuánto lleva implementar?" | "Entre 2 y 4 horas el setup. Al día siguiente ya está atendiendo. Carlos te cuenta el proceso exacto." |
| "¿Y si falla?" | "Hay alertas automáticas — si algo no funciona, Carlos lo sabe antes que vos. Y siempre hay derivación humana como respaldo." |

---

## Lo que cambia técnicamente

### Supabase — tabla nueva

```sql
CREATE TABLE consultorio_demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(9) UNIQUE NOT NULL,           -- 'DEMO-XXXX'
  nombre_prospecto TEXT NOT NULL,
  clinic_name TEXT NOT NULL,
  turnos_dia INTEGER NOT NULL,
  precio_consulta INTEGER NOT NULL,          -- en pesos
  profesionales INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'remoto',       -- 'presencial' | 'remoto'
  estado TEXT NOT NULL DEFAULT 'activo',     -- 'activo' | 'usado' | 'expirado'
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL            -- +48h
);
```

### Dashboard — página nueva `/dashboard/demos`

- Solo rol `dueno`
- Form con 6 campos + tipo
- Lista sesiones activas con código + link copiable
- Al crear: muestra código `DEMO-XXXX` y link `wa.me/5491137936325?text=DEMO-XXXX`

APIs:
- `POST /api/demos/crear` — genera código, calcula ROI, inserta
- `GET /api/demos` — lista últimas 30 días

### WF01-DEMO — detección DEMO-XXXX

En el nodo code2 (carga de conversación), después del merge:
- Detectar patrón `/^DEMO-[A-Z0-9]{4}$/i`
- Si número == `$env.CARLOS_WA_NUMBER` → tipo presencial → cargar desde Supabase → saltear preguntas
- Si otro número → tipo remoto → cargar si existe con datos, sino iniciar preguntas
- Setear `conv.estado = 'demo_prospecto_init'` y `conv.contexto.demo_session = {...}`

Nueva env var en EasyPanel n8n: `CARLOS_WA_NUMBER = 541130875304`

### WF02-DEMO — nuevos estados

| Estado | Qué hace |
|--------|----------|
| `demo_prospecto_init` | Entry: presencial→didáctica, remoto→preguntas |
| `demo_prospecto_preguntas` | Colecta 4 datos (nombre, clínica, turnos, precio) |
| `demo_prospecto_simulacion` | Flujo de paciente real (esperando_dni en adelante — sin cambios) |
| `demo_prospecto_cierre` | ROI text + audio ElevenLabs + Telegram + "pasale el teléfono" |

**Transición clave:** Al terminar `demo_prospecto_preguntas` → pasar a `demo_prospecto_simulacion` que corre el mismo flujo actual desde `esperando_dni`.

**Al terminar la simulación** (cuando el bot envía el mensaje "Esto es lo que pasa automáticamente...") → transición automática a `demo_prospecto_cierre`.

### WF09 — tool `obtenerContextoDemo`

Nueva tool en Vapi + handler en WF09:
- Se llama automáticamente al inicio de llamada entrante desde Carlos
- Fetch `consultorio_demo_sessions` WHERE `estado = 'activo'` ORDER BY `created_at DESC` LIMIT 1
- Retorna: `nombre_prospecto`, `clinic_name`, `turnos_dia`, `precio_consulta`, `roi_mensual`

### Infraestructura de llamadas (actualizado)

```
Tel personal Carlos → Twilio → Vapi → Sofía
```
Zadarma eliminado. Flujo directo Twilio → Vapi.

---

## Qué NO cambia

- **WF03** (recordatorios), **WF04** (checkin), **WF06** (postconsulta), **WF07** (waitlist): pausados durante demo track
- **WF-REMINDER, WF-CUMPLEANOS, WF-REACTIVACION**: pausados durante demo track
- **WF-MONTHLY-REPORT, WF-KEEPWARM**: pausar WF-MONTHLY-REPORT, mantener WF-KEEPWARM (previene cold starts)
- **Dashboard Next.js**: sin cambios en las tabs existentes — solo se agrega `/dashboard/demos`
- **Supabase schema existente**: sin modificaciones a tablas actuales
- **Sofía — comportamiento actual** (turnos, info, disponibilidad): sigue igual, solo se agrega MODO VENDEDORA

---

## Orden de implementación

1. **Backup → onboarding-kit** (exportar todo antes de tocar nada)
2. **Supabase**: crear tabla `consultorio_demo_sessions`
3. **Dashboard**: API `/api/demos/crear` + página `/dashboard/demos`
4. **WF01-DEMO**: copiar WF01 → agregar detección DEMO-XXXX
5. **WF02-DEMO**: copiar WF02 → agregar estados `demo_prospecto_*`
6. **WF09**: agregar tool `obtenerContextoDemo` + handler call-start
7. **Vapi prompt**: agregar sección MODO VENDEDORA al assistant
8. **Pausar WFs originales** (producto track)
9. **Deploy + test E2E** (flujo presencial y remoto)

---

## Memoria de sesión

Al inicio de cada sesión:
- **Modo DEMO activo**: trabajamos en el funnel de ventas. WFs [DEMO] activados, originales pausados.
- **Modo PRODUCTO activo**: trabajamos en el sistema para clientes. WFs originales activados, [DEMO] pausados.

El modo actual se guarda en memoria para que Claude lo sepa al arrancar cada conversación.

---

## Specs anteriores reemplazados por este documento

- `2026-05-20-demo-cierre-comercial-design.md` → reemplazado
- `2026-05-20-sofia-vendedora-design.md` → reemplazado

El plan de implementación (`2026-05-20-demo-cierre-comercial.md`) será reescrito cuando este spec esté aprobado.
