# Sofía Vendedora — Design

**Goal:** Sofía (Vapi) actúa como cerradora de ventas cuando Carlos la llama estando con un prospecto. Carlos la briefea en voz, pasa el teléfono, y Sofía cierra la venta con los datos del prospecto.

**The close:** El prospecto está siendo convencido por el mismo producto que está comprando. Al final Carlos dice: "Eso que acabás de vivir — eso es lo que van a vivir tus pacientes."

---

## Funnel completo (3 piezas)

| Paso | Herramienta | Qué pasa |
|------|-------------|----------|
| 1. Cargar datos | Dashboard `/dashboard/demos` | Carlos crea sesión DEMO-XXXX con datos del prospecto |
| 2. Demo WhatsApp | Bot WF02 con código DEMO-XXXX | Prospecto experimenta el sistema, bot cierra con ROI |
| 3. Llamada Sofia | Vapi — modo vendedora | Carlos briefea a Sofia, pasa el teléfono, Sofia cierra |

*Pasos 1 y 2 ya están especificados en `2026-05-20-demo-cierre-comercial-design.md`. Este spec cubre solo el paso 3.*

---

## Flujo detallado — Paso 3

### Carlos briefea a Sofía

Carlos llama al número de Sofía (Zadarma +541150328146 → Vapi). Al conectar, dice algo como:

> "Sofía, estoy con Javier, tiene una clínica con 20 turnos por día y 4 médicos. Te lo voy a pasar."

O con el código demo:

> "Sofía, modo presentación, código DEMO-A7K3, te paso a Javier."

**Sofía detecta** que Carlos la está briefeando (no es un paciente llamando). Extrae:
- Nombre del prospecto (obligatorio)
- Nombre de la clínica (opcional)
- Turnos por día (opcional, para el ROI)
- Código DEMO-XXXX (opcional, para fetchear datos completos desde Supabase)

**Sofía responde a Carlos** en max 2 oraciones:

> "Entendido, tengo los datos de Javier y Clínica San Martín. Cuando me lo pasés arranco."

### Prospecto habla con Sofía

Carlos pasa el teléfono. Sofía:

1. **Saluda** por nombre: *"¡Hola Javier! Soy Sofía, la asistente de Consultorio Inteligente. Carlos me contó un poco de tu clínica."*

2. **Valida el contexto** (una sola pregunta de confirmación si falta info): *"¿Tienen más o menos 20 turnos por día, no?"*

3. **Responde preguntas técnicas** con autoridad. Sabe todo sobre el sistema: cómo funciona el bot de WhatsApp, los recordatorios, la lista de espera, la integración con obras sociales, el dashboard, las campañas.

4. **Presenta el ROI** si tiene los datos de turnos/día. Usa la misma fórmula: `turnos_dia × 22 × 0.15 × 0.80 × $45.000 = $/mes recuperados`.

5. **Cierre:** *"¿Tiene sentido esto para [nombre de la clínica]?"* — pregunta abierta, no de sí/no.

6. **En interés confirmado:** *"Carlos, creo que Javier está listo para arrancar."* — devuelve el control a Carlos.

7. **En dudas persistentes:** responde hasta 3 objeciones, luego: *"Creo que lo mejor es que Carlos te cuente los detalles del proceso de setup. Él puede explicarte los tiempos y costos mejor que yo."*

---

## Objeciones comunes y respuestas

| Objeción | Respuesta de Sofía |
|----------|-------------------|
| "¿Cuánto cuesta?" | "Eso lo define Carlos según el volumen de tu consultorio. Lo que sí te puedo decir es que en promedio el sistema se paga en el primer mes con los turnos que recupera." |
| "¿Y si los pacientes no quieren hablar con una IA?" | "Buena pregunta. La mayoría de los pacientes no saben que están hablando con un sistema — perciben que es la secretaria del consultorio. Y si prefieren hablar con una persona, el sistema los deriva automáticamente." |
| "Ya tenemos un sistema" | "¿Manejan las confirmaciones de turnos de forma automática? ¿Y la reactivación de pacientes que no vienen hace meses?" — explora el gap. |
| "Necesito pensarlo" | "Claro, es una decisión importante. ¿Qué es lo que más te genera dudas — el precio, la implementación, o cómo va a funcionar con tus pacientes?" |
| "¿Cuánto tiempo lleva implementar?" | "El setup inicial lleva entre 2 y 4 horas. Al día siguiente ya está atendiendo. Carlos te puede contar el proceso exacto." |

---

## Lo que cambia técnicamente

### 1. Prompt del assistant Sofía (Vapi) — cambio principal

Agregar una nueva sección al system prompt:

```
## MODO VENDEDORA

Cuando detectés que Carlos te está briefeando (dice tu nombre + datos de un prospecto + que te va a pasar el teléfono), respondé con lo siguiente:
1. Confirmá que entendiste los datos del prospecto en UNA oración.
2. Decí que estás lista para recibirlo.
3. NO hagas preguntas a Carlos — solo confirmá y esperá.

Cuando el prospecto tome el teléfono:
- Saludalo por su nombre de inmediato.
- Presentate como asistente de Consultorio Inteligente.
- Mencioná que Carlos te contó un poco sobre su clínica.
- Respondé sus preguntas con autoridad. Sos la experta en el sistema.
- Si pregunta por precio: nunca des un número, derivá a Carlos.
- Si pregunta cómo arrancar: derivá a Carlos.
- Calculá y presentá el ROI si tenés los datos de turnos por día.
- Cuando el prospecto esté convencido o haya dicho "me interesa" o similar: decí "Carlos, creo que [NOMBRE] está listo para arrancar" para que Carlos retome.
- Máximo 3 objeciones respondidas. A la 4ta: derivá a Carlos.

Señales de que es Carlos hablando (no un paciente):
- Menciona tu nombre "Sofía" al inicio de la llamada
- Dice "modo presentación", "modo venta", "te paso a", "estoy con"
- Dice un código del estilo "DEMO-XXXX"
- El contexto es de una reunión comercial, no de un turno médico
```

### 2. WF09 — tool opcional `cargarSesionDemo`

*Solo si se implementa el código DEMO como briefing.*

Nueva tool en Vapi + handler en WF09:
- Input: `{ code: "DEMO-A7K3" }`
- Acción: fetch de `consultorio_demo_sessions` WHERE `code = $code` AND `estado = 'activo'`
- Output: `{ clinic_name, turnos_dia, profesionales, admin_name }` o error si no encontrado
- Sofía usa los datos retornados para personalizar el pitch

Esta tool es **opcional para MVP**. Si Carlos prefiere decirle los datos de voz, no hace falta.

---

## Decisiones

- **Detección del briefing por LLM, no por regex:** la variedad de frases que Carlos puede usar es alta. Es más robusto dejar que el LLM entienda el contexto de la llamada que parsear con reglas fijas.
- **Precio siempre derivado a Carlos:** Sofía nunca da números de precio. Evita comprometer a Carlos en una oferta específica.
- **Cierre explícito "Carlos, [nombre] está listo":** marca el momento exacto para que Carlos retome el control sin awkwardness.
- **Máx 3 objeciones:** evita que Sofía se quede en bucle. Si el prospecto tiene muchas dudas, Carlos cierra mejor en persona.
- **Tool `cargarSesionDemo` es opcional:** el MVP funciona 100% con briefing de voz.

---

## MVP (implementable en 30 min)

Solo el item 1: actualizar el system prompt del assistant `1f39b10f-72e9-4185-84e4-95a884b49436` con la sección MODO VENDEDORA. PATCH vía Vapi API. Sin WF09, sin backend, sin dashboard.

**Script:** `C:/Users/noyag/fix_sofia_v2.js` ya tiene el patrón de PATCH al assistant — es el mismo mecanismo.
