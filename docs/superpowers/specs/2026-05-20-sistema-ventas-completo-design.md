# Sistema de Ventas Automático — Consultorio Inteligente — Design

**Goal:** Convertir el sistema actual en una máquina de ventas autónoma. Carlos va a una reunión, activa la demo, el bot muestra el sistema con los datos reales del prospecto, cierra con ROI personalizado y audio de impacto, y Sofía (Vapi) remata por voz. Carlos no vende — el producto se vende solo.

**The close:** El prospecto está siendo convencido por el mismo producto que está comprando. Al final Carlos dice: "Eso que acabás de vivir — eso es lo que van a vivir tus pacientes."

---

## Arquitectura: dos tracks

El sistema tiene DOS modos separados que nunca se mezclan:

| Track | WFs | Para qué |
|-------|-----|---------|
| **[DEMO]** | WF01-DEMO, WF02-DEMO, WF08-DEMO, WF09 | Vender el sistema a prospectos |
| **[PRODUCTO]** | Todos los WFs originales (pausados) | El sistema real que se mejora para clientes |

**Regla de sesión:** Al inicio de cada sesión de trabajo queda claro si estamos en modo DEMO o modo PRODUCTO. Los WFs del track inactivo están pausados. Claude lo registra en memoria para mantener el contexto entre sesiones.

---

## Fase previa: Backup completo → onboarding-kit

**Antes de tocar cualquier WF**, exportar el estado actual completo del sistema.

**Carpeta:** `C:/Users/noyag/Norberto-Documentos/onboarding-kit/`

### WFs a exportar (lista completa de n8n — solo Consultorio)

| WF | Tipo |
|----|------|
| Consultorio - WF01 Gateway WhatsApp | Core |
| Consultorio - WF02 Bot Conversacional | Core |
| Consultorio - WF03 Recordatorios | Core |
| Consultorio - WF04 Check-in Web | Core |
| Consultorio - WF05 Handoff Telegram | Core |
| Consultorio - WF06 Post-Consulta | Core |
| Consultorio - WF07 Waitlist Inteligente | Core |
| Consultorio - WF08 Selector de Turnos Web | Core |
| Consultorio - WF09 VAPI Tool Calls | Core |
| Consultorio - WF10 Cron Cierre Handoff | Core |
| WF-ADELANTO-1 — Buscar Candidato | Feature |
| WF-ADELANTO-2 — Procesar Respuesta | Feature |
| WF-ADELANTO-CRON — Timeout | Feature |
| WF-DASH-1 Cancelar Turno | Dashboard |
| WF-DASH-2 Generar Link | Dashboard |
| WF-DASH-3 Crear Paciente | Dashboard |
| WF-DASH-3 Reset Conversacion | Dashboard |
| WF-DASH-4 — Responder Handoff | Dashboard |
| WF-REMINDER — Recordatorios 24hs | Cron |
| WF-CAMPANAS Ejecución Manual | Cron |
| WF-REACTIVACION Pacientes Dormidos | Cron |
| WF-CUMPLEANOS Saludo Cumpleaños | Cron |
| WF-KEEPWARM — Bot Activo 24/7 | Infra |
| WF-MONTHLY-REPORT | Cron |
| NexoTerra - Error Handler Global | Infra |

*No incluir: WF-RP-01 (Reels Pipeline), Dashboard Demo — Predigma, My workflow 2 — son de otros proyectos.*

### Resto del backup

- `vapi/prompt.txt` — prompt completo del assistant Sofía (GET /assistant/1f39b10f-72e9-4185-84e4-95a884b49436)
- `supabase/schema.sql` — schema SQL de todas las tablas `consultorio_*`
- `dashboard/` — git tag del código actual del dashboard Next.js
- `env-vars.md` — lista de env vars de EasyPanel n8n (solo nombres, sin valores)
- `README.md` — checklist para onboarding de cliente nuevo desde cero

**Este backup no se modifica nunca.** Es el template de onboarding que se usa como base para cada cliente nuevo.

---

## El funnel de ventas (3 pasos)

### Paso 1 — Dashboard: cargar datos del prospecto

Carlos abre `/dashboard/demos` antes de la reunión (presencial) o antes de compartir el link (remoto).

**Form "Nueva Demo" — campos:**

| Campo | Obligatorio | Para qué |
|-------|-------------|----------|
| Nombre del prospecto | Sí | Saludo de Sofía |
| Nombre de la clínica | Sí | Personalizar todo |
| Turnos por día | Sí | ROI |
| Precio por consulta ($) | Sí | ROI exacto |
| Profesionales | Sí | Pitch de Sofía |
| Secretarias/recepcionistas | Sí | ROI ahorro administrativo |
| Sueldo mensual por secretaria ($) | No | ROI más preciso — si no se carga, usa promedio $700.000 |
| Tipo | Sí | Presencial / Remoto |

Al crear → genera código `DEMO-XXXX` (4 chars A-Z0-9, único) + link WA copiable.

**ROI calculado con datos exactos:**

```
// No-shows recuperados
turnos_mes        = turnos_dia × 22
noshows_mes       = ROUND(turnos_mes × 0.15)
recuperados_mes   = ROUND(noshows_mes × 0.80)
roi_noshows       = recuperados_mes × precio_consulta

// Ahorro administrativo (secretaria)
sueldo_ref        = sueldo_secretaria ?? 700000
ahorro_admin      = secretarias × sueldo_ref × 0.40   // 40% del tiempo dedicado a turnos por teléfono

// Total
roi_total         = roi_noshows + ahorro_admin
```

---

### Paso 2 — WhatsApp: demo + cierre con ROI

#### Detección del código DEMO-XXXX (WF01-DEMO)

WF01 detecta mensaje que coincide con `/^DEMO-[A-Z0-9]{4}$/i`:

- **Número de Carlos (`541130875304`)** → presencial → carga sesión desde Supabase → saltea preguntas → va directo a la demo
- **Cualquier otro número** → remoto → si la sesión existe y tiene datos: usa esos datos; si no: hace las preguntas

#### Preguntas de calificación (solo flujo remoto / datos incompletos)

El bot hace estas preguntas en orden, una por mensaje. Framing: "Para mostrarte la demo con tus números reales, necesito unos datos."

1. "¿Cómo te llamás?"
2. "¿Cuál es el nombre de tu consultorio o clínica?"
3. "¿Cuántos turnos por día manejan? _(solo el número)_"
4. "¿Cuánto cobra cada consulta? _(en pesos, sin puntos)_"
5. "¿Tienen secretaria o recepcionista que atiende el teléfono? _(sí / no)_"
6. Si sí: "¿Cuántas? _(número)_"
7. Si sí: "¿Sabés cuánto pagan por mes cada una? _(podés escribir 'no sé' y usamos un promedio)_"

Después: "Perfecto. Ahora sí — te muestro cómo funciona el sistema con tus datos reales."

#### Simulación de la demo (flujo actual — sin cambios)

El bot corre el flujo de paciente real exactamente como está hoy. El prospecto lo vive como si fuera un paciente real:

> "Para arrancar, ingresá cualquier número de 7 u 8 dígitos..."
> → DNI fake → nombre → obra social → especialidad → botón turno → TURNO CONFIRMADO → "Esto es lo que pasa automáticamente..."

**Este flujo no se modifica.** Solo se envuelve entre el init y el cierre.

#### Cierre automático post-demo

Inmediatamente después del mensaje "Esto es lo que pasa automáticamente...":

---

**Mensaje texto — ROI personalizado:**

```
📊 *Lo que pasa hoy en tu clínica:*

• Turnos por mes: [turnos_mes]
• No-shows estimados (15%): [noshows_mes] turnos que se pierden
• Ingreso que no llega: $[roi_noshows]/mes

💼 Tu secretaria dedica ~40% de su tiempo a llamar, confirmar y recordar turnos manualmente.

✅ *Lo que cambia con el sistema:*
• [recuperados_mes] turnos recuperados por mes ($[roi_noshows])
• Tu secretaria se libera del teléfono ($[ahorro_admin]/mes en tiempo recuperado)

💰 *Impacto estimado: $[roi_total]/mes*
```

---

**Audio de Sofía — script de cierre (framework PAS: Pain → Agitate → Solve):**

> "Hola. Lo que acabás de ver no es solo un sistema de turnos. Cada mes, sin saberlo, tu clínica está perdiendo [noshows_mes] consultas. Pacientes que confirmaron, que tenían turno, que no aparecieron — y nadie los llamó, nadie los reactivó. A [precio_consulta] pesos por consulta, eso son $[roi_noshows] pesos que se van solos, todos los meses. Y además, tu secretaria está dedicando casi la mitad de su día a atender el teléfono, confirmar turnos, mandar recordatorios a mano — cuando podría estar con los pacientes, o siendo más efectiva en otras áreas del consultorio. El sistema hace todo eso solo. Confirma, recuerda, llena huecos en la agenda, reactiva pacientes que no vienen hace meses. Las veinticuatro horas, los siete días de la semana. Los números que te acabo de mostrar son los tuyos — calculados con los datos de tu clínica. Para saber cómo arrancar, hablás con Carlos."

*Nota: script estudiado sobre el framework PAS (Pain-Agitate-Solve). Cada frase tiene propósito: Pain identifica el problema conocido, Agitate lo hace doler con números reales del prospecto, Solve ofrece la salida.*

---

**Notificación Telegram a Carlos:**
```
🔥 Prospecto terminó la demo

Nombre: [nombre_prospecto]
Clínica: [clinic_name]
Turnos/día: [N] · Precio: $[N] · Secretarias: [N]
ROI no-shows: $[roi_noshows]/mes
Ahorro admin: $[ahorro_admin]/mes
ROI total: $[roi_total]/mes

WhatsApp: [phone]
```

**Mensaje final al prospecto:**
> "¡Eso es todo! 😊 *Pasale el teléfono a Carlos* para continuar — él te explica los próximos pasos."

---

### Paso 3 — Vapi: Sofía cierra por voz

Carlos llama al número de Sofía (Twilio → Vapi directo, Zadarma eliminado). Sofía carga el contexto automáticamente desde WF09.

#### Carga automática del contexto (WF09)

Al recibir llamada entrante:
1. Query `consultorio_demo_sessions` WHERE `estado = 'activo'` ORDER BY `created_at DESC` LIMIT 1
2. Si encontrado: inyectar en el assistant override: `nombre_prospecto`, `clinic_name`, `turnos_dia`, `precio_consulta`, `roi_total`
3. Sofía arranca ya briefeada — Carlos no dice nada

#### Comportamiento de Sofía con el prospecto

**Apertura:**
> "¡Hola [nombre]! ¿Qué te pareció la demo? ¿Te quedó alguna duda?"

**Modo operación:**
- No repite el ROI (ya lo vio). Resuelve dudas.
- Responde preguntas técnicas con autoridad total sobre el sistema
- Puede demostrar en vivo: *"¿Querés escuchar cómo sonaría el saludo para tu consultorio?"*
- Precio: derivar siempre a Carlos
- Máximo 3 objeciones. A la 4ta: *"Carlos te puede responder eso mejor que yo — él tiene todos los detalles."*
- Fuera de contexto (pregunta que Sofía no puede responder con seguridad): *"Eso es algo que Carlos te puede explicar mucho mejor que yo."* No inventar datos ni comprometerse con información que no tiene.

**Cierre:** *"¿Tiene sentido esto para [clínica]?"*

Interés confirmado: *"Carlos, creo que [nombre] está listo para los próximos pasos."*

---

## Objeciones de Sofía — versión corregida

| Objeción | Respuesta |
|----------|-----------|
| "¿Cuánto cuesta?" | "Para los números te habla Carlos — él maneja los planes según cada caso. Lo que sí te puedo mostrar es el impacto que calculamos con tus datos reales." |
| "Los pacientes no van a querer hablar con una IA" | "La mayoría no sabe que es un sistema — perciben que es la asistente del consultorio. Si alguien prefiere hablar con una persona, el sistema los deriva automáticamente. ¿Querés probar? Puedo mostrarte cómo sonaría el saludo para tu clínica ahora mismo." |
| "Ya tenemos sistema de turnos" | "¿Mandan recordatorios automáticos 24hs antes? ¿Y reactivan pacientes que no vienen hace meses sin que la secretaria haga nada?" |
| "Necesito pensarlo" | "Claro. ¿Qué es lo que más te genera duda — la implementación, cómo lo van a vivir tus pacientes, o algo del sistema en sí?" |
| "¿Cuánto lleva implementar?" | "Carlos te puede dar esa información concreta — él maneja los tiempos según cada caso." |
| "¿Y si falla?" | "Hay alertas automáticas — si algo no funciona, Carlos lo sabe antes que vos. Y siempre hay derivación humana como respaldo." |

---

## Lo que cambia técnicamente

### Supabase — tabla `consultorio_demo_sessions`

```sql
CREATE TABLE consultorio_demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(9) UNIQUE NOT NULL,
  nombre_prospecto TEXT NOT NULL,
  clinic_name TEXT NOT NULL,
  turnos_dia INTEGER NOT NULL,
  precio_consulta INTEGER NOT NULL,
  profesionales INTEGER NOT NULL,
  secretarias INTEGER NOT NULL DEFAULT 0,
  sueldo_secretaria INTEGER,               -- NULL = usar promedio $700.000
  tipo TEXT NOT NULL DEFAULT 'remoto' CHECK (tipo IN ('presencial', 'remoto')),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'usado', 'expirado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

### Dashboard — `/dashboard/demos`

- Solo rol `dueno`
- Form con todos los campos del punto anterior
- Lista sesiones: código, clínica, tipo, ROI calculado, estado, expires_at
- Link copiable: `wa.me/5491137936325?text=DEMO-XXXX`

APIs:
- `POST /api/demos/crear` — genera código, calcula ROI (roi_noshows + ahorro_admin), inserta
- `GET /api/demos` — lista últimas 30 días

### WF01-DEMO — detección + routing

- Detectar `/^DEMO-[A-Z0-9]{4}$/i` en mensaje entrante
- Si `phone === $env.CARLOS_WA_NUMBER` (`541130875304`) → presencial → cargar sesión → `demo_prospecto_init`
- Si otro número → remoto → `demo_prospecto_init` (con preguntas si faltan datos)

Nueva env var: `CARLOS_WA_NUMBER = 541130875304`

### WF02-DEMO — estados nuevos

| Estado | Descripción |
|--------|-------------|
| `demo_prospecto_init` | Entry: presencial va directo a simulación; remoto va a preguntas |
| `demo_prospecto_preguntas` | Colecta datos (nombre, clínica, turnos, precio, secretarias) |
| `demo_prospecto_simulacion` | Flujo real: `esperando_dni` → turno confirmado → "Esto es lo que pasa..." |
| `demo_prospecto_cierre` | ROI texto + audio ElevenLabs + Telegram + "pasale el teléfono" |

### WF09 — tool `obtenerContextoDemo`

- Handler en event `call-start` o tool llamada automáticamente al inicio
- Fetch sesión más reciente activa
- Retorna datos para que el assistant override los inyecte en el prompt de Sofía

### Vapi — sección MODO VENDEDORA en prompt

```
## MODO VENDEDORA

Si al inicio de la llamada tenés datos de un prospecto (nombre, clínica, turnos, ROI):
- Saludá por nombre de inmediato
- Preguntá qué le pareció la demo y qué dudas le quedaron
- NO repitas el ROI — ya lo vio. Tu trabajo es resolver dudas y cerrar
- Respondé con autoridad técnica total sobre el sistema
- Precio: siempre derivar a Carlos
- Máximo 3 objeciones. Cuarta: "Carlos te puede responder eso mejor."
- Cierre: "¿Tiene sentido esto para [clínica]?"
- Interés confirmado: "Carlos, creo que [nombre] está listo para los próximos pasos."
```

---

## WFs a pausar durante track DEMO

| WF | Motivo |
|----|--------|
| WF03 Recordatorios | Puede mandar recordatorios reales a prospectos de prueba |
| WF04 Check-in Web | No aplica al flujo demo |
| WF06 Post-Consulta | Puede mandar NPS a prospectos de prueba |
| WF07 Waitlist | No aplica al flujo demo |
| WF10 Cron Cierre Handoff | No aplica |
| WF-REMINDER | Idem WF03 |
| WF-CUMPLEANOS | Puede mandar mensajes a prospectos |
| WF-REACTIVACION | Idem |
| WF-MONTHLY-REPORT | No aplica durante demo |
| WF-ADELANTO-* | No aplica al flujo demo |

| WF | Mantener |
|----|---------|
| WF-KEEPWARM | ✅ — previene cold starts, no afecta nada |
| Error Handler Global | ✅ — necesario siempre |

---

## Orden de implementación

1. **Backup** → exportar todos los WFs a `onboarding-kit/n8n/` + prompt Sofía + schema SQL + git tag dashboard
2. **Pausar WFs producto** (lista de arriba)
3. **Supabase** → crear tabla `consultorio_demo_sessions`
4. **Dashboard** → `/api/demos/crear` + `/api/demos` + página `/dashboard/demos`
5. **WF01-DEMO** → copiar WF01, agregar detección DEMO-XXXX + routing
6. **WF02-DEMO** → copiar WF02, agregar estados `demo_prospecto_*`
7. **WF09** → agregar tool `obtenerContextoDemo` + handler call-start
8. **Vapi prompt** → agregar sección MODO VENDEDORA
9. **Deploy + test E2E** → flujo presencial + flujo remoto

---

## Decisiones

- **Secretaria 40% del tiempo**: estimación conservadora del tiempo que pasa gestionando turnos por teléfono. Si el prospecto no sabe el sueldo, se usa $700.000/mes como promedio de referencia Argentina 2026.
- **Audio sigue framework PAS**: Pain (nombra el problema), Agitate (lo hace doler con números reales), Solve (ofrece la salida). Estructura validada en ventas consultivas B2B.
- **Sin datos falsos en objeciones**: se eliminaron claims no verificables ("primera semana", "2-4 horas"). Precio y tiempos siempre se derivan a Carlos.
- **Carga automática en Vapi**: WF09 fetchea la sesión más reciente sin que Carlos diga nada. Solo funciona porque Carlos raramente tiene más de una sesión activa simultánea.
- **Two-track nunca se mezcla**: los WFs [DEMO] son copias, los originales [PRODUCTO] quedan intactos y se retoman cuando se trabaja en el sistema real.
