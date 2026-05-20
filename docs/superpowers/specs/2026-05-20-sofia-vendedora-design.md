# Sofía Vendedora — Design

**Goal:** Sofía (Vapi) actúa como cerradora de ventas cuando Carlos la llama estando con un prospecto. Sofía ya sabe quién es el prospecto (carga automática desde la sesión demo), va directo a resolver dudas y cierra.

**The close:** El prospecto está siendo convencido por el mismo producto que está comprando. Al final Carlos dice: "Eso que acabás de vivir — eso es lo que van a vivir tus pacientes."

---

## Funnel completo (3 piezas)

| Paso | Herramienta | Qué pasa |
|------|-------------|----------|
| 1. Cargar datos | Dashboard `/dashboard/demos` | Carlos crea sesión DEMO-XXXX con datos del prospecto |
| 2. Demo WhatsApp | Bot WF02 con código DEMO-XXXX | Prospecto experimenta el sistema, bot muestra ROI |
| 3. Llamada Sofía | Vapi — modo vendedora | Carlos llama, Sofía ya tiene el contexto, pasa el teléfono, Sofía cierra |

*Pasos 1 y 2 están especificados en `2026-05-20-demo-cierre-comercial-design.md`. Este spec cubre el paso 3.*

---

## Infraestructura de llamadas

**Flujo actual (Zadarma eliminado):**
```
Tel personal → Twilio → Vapi → Sofía
```
Carlos llama al número Twilio que apunta directamente a Vapi. Zadarma ya no existe en el stack.

---

## Flujo detallado — Paso 3

### Carga automática del contexto

Cuando entra una llamada a Sofía, WF09 recibe el evento `call-start` y ejecuta automáticamente una query a `consultorio_demo_sessions` buscando la sesión más reciente con `estado = 'activo'`. Retorna los datos del prospecto al assistant como contexto inicial.

**No hay fase de briefing verbal.** Carlos llama, pasa el teléfono a Javier. Punto.

Si WF09 no encuentra sesión activa (edge case), Sofía opera sin datos y pregunta el nombre del prospecto al inicio.

### Sofía con el prospecto

Carlos pasa el teléfono. Sofía va directo:

**1. Apertura** (ya sabe el nombre):
> "¡Hola Javier! ¿Qué te pareció la demo que te mostró el sistema por WhatsApp? ¿Te quedó alguna duda?"

El ROI ya lo vio en la demo de WhatsApp — Sofía no lo repite. Ataca desde las dudas.

**2. Modo preguntas / dudas:**
- Responde cualquier pregunta técnica del sistema con autoridad total
- Sabe todo: bot de WhatsApp, recordatorios, lista de espera, obras sociales, dashboard, campañas, reactivación de pacientes dormidos
- Si falta algún dato del prospecto (clínica, turnos), lo pregunta naturalmente en la conversación

**3. El pitch vivo:**
Sofía puede mostrar lo que hace EN LA MISMA LLAMADA:
> "Si querés, puedo mostrarte cómo transferiría una llamada de un paciente urgente — es exactamente lo que haría en tu consultorio."

Esto es la demostración definitiva: el prospecto experimenta la IA en tiempo real.

**4. Precio:**
> "Para los números de precio y los detalles del setup, Carlos te puede hablar mejor que yo — él conoce los distintos planes según el volumen del consultorio."
Nunca da precio. Siempre deriva a Carlos.

**5. Cierre:**
> "¿Tiene sentido esto para [nombre de la clínica]?"

Si interés confirmado: *"Carlos, creo que Javier está listo para los próximos pasos."* — devuelve el control.

Si dudas persistentes (más de 3 objeciones): *"Las preguntas que tenés son muy buenas para hablarlas con Carlos directamente — él puede mostrarte el proceso de setup y los tiempos reales."*

---

## Objeciones comunes y respuestas

| Objeción | Respuesta de Sofía |
|----------|-------------------|
| "¿Cuánto cuesta?" | "Para los números te habla Carlos — lo que sí te digo es que el sistema en promedio se paga en el primer mes con los turnos que recupera." |
| "¿Los pacientes van a aceptar hablar con una IA?" | "La mayoría no sabe que es un sistema — perciben que es la asistente del consultorio. Y si alguien prefiere hablar con una persona, el sistema los deriva automáticamente. Como ahora mismo, que Carlos está ahí con vos." |
| "Ya tenemos un sistema de turnos" | "¿El sistema les manda recordatorios automáticos 24 horas antes? ¿Y reactiva pacientes que no vienen hace meses sin que la secretaria tenga que hacer nada?" |
| "Necesito pensarlo" | "Claro, ¿qué es lo que más te genera duda — la implementación, cómo lo van a vivir tus pacientes, o algo del sistema en sí?" |
| "¿Cuánto lleva implementar?" | "Entre 2 y 4 horas el setup inicial. Al día siguiente ya está atendiendo. Carlos te puede contar el proceso exacto." |
| "¿Y si falla?" | "El sistema tiene alertas automáticas — si algo no funciona, Carlos lo sabe antes que vos. Y siempre hay un humano como respaldo cuando el sistema no puede resolver algo." |

---

## Lo que cambia técnicamente

### 1. WF09 — carga automática del contexto en `call-start`

WF09 ya maneja el webhook de Vapi. Agregar handler para el evento `type: 'assistant-request'` (o `call-start`) que:
1. Query a `consultorio_demo_sessions` WHERE `estado = 'activo'` ORDER BY `created_at DESC` LIMIT 1
2. Si encontrado: retorna `assistantOverrides` con el nombre del prospecto y datos del consultorio inyectados en el prompt
3. Si no encontrado: retorna sin overrides (Sofía opera en modo normal)

Alternativa más simple: nueva tool `obtenerContextoDemo` que Sofía llama automáticamente al inicio de cada llamada (configurada como `firstMessage` trigger en el prompt).

### 2. Prompt del assistant Sofía (Vapi) — sección MODO VENDEDORA

```
## MODO VENDEDORA

Al inicio de cada llamada, si tenés datos de un prospecto cargados (nombre, clínica, turnos/día), estás en modo vendedora. Aplicá estas reglas:

APERTURA: Saludá al prospecto por su nombre de inmediato. Preguntá qué le pareció la demo de WhatsApp y qué dudas le quedaron. NO repitas el ROI — ya lo vio.

FOCO: Tu trabajo es resolver dudas técnicas y objeciones, no hacer un pitch nuevo. El prospecto ya vio el sistema funcionar. Ahora necesita que le transmitas seguridad.

DEMOSTRACIÓN EN VIVO: Si el contexto lo permite, mostrá lo que podés hacer — ofrecerte a simular una transferencia de llamada urgente, explicar cómo sonaría el saludo para su consultorio, etc.

PRECIO: Nunca des números de precio. Siempre: "Para eso está Carlos — él maneja los planes según cada caso."

CIERRE: Cuando el prospecto muestre interés o diga algo como "me convence" / "qué hay que hacer": decí "Carlos, creo que [NOMBRE] está listo para los próximos pasos" — devolvés el control explícitamente.

LÍMITE DE OBJECIONES: Máximo 3 objeciones respondidas. A la cuarta: derivá a Carlos.

SI FALTA EL NOMBRE: preguntalo naturalmente al inicio ("¿Con quién tengo el gusto?") antes de continuar.
```

---

## Decisiones

- **Carga automática, no verbal:** Carlos no tiene que decir nada — la sesión demo ya está en Supabase. WF09 la fetchea al inicio de la llamada. Cero fricción para Carlos.
- **ROI no se repite:** el prospecto ya lo vio en WhatsApp. Repetirlo sería redundante y restaría impacto. Sofía ataca las dudas que quedaron.
- **Zadarma eliminado:** flujo es Twilio → Vapi directo.
- **Precio siempre a Carlos:** evita comprometer precios específicos.
- **Demostración en vivo:** Sofía puede mostrar lo que hace MIENTRAS habla. Es el argumento más poderoso — el prospecto lo vive.
- **Cierre explícito verbal:** "Carlos, [nombre] está listo" — marca el momento sin awkwardness para que Carlos retome.

---

## MVP (implementable en 30 min)

Solo el prompt — sin WF09 todavía. Sofía opera sin carga automática de datos: si Carlos dice el nombre al pasar el teléfono o el prospecto se presenta, Sofía lo toma del audio.

**Siguiente paso (1-2 horas):** WF09 handler `call-start` + tool `obtenerContextoDemo` para la carga automática desde Supabase.

**Script de deploy:** `C:/Users/noyag/fix_sofia_v2.js` — mismo patrón PATCH al assistant `1f39b10f-72e9-4185-84e4-95a884b49436`.
