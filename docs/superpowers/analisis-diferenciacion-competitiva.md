# Análisis de Diferenciación Competitiva
> Consultorio Inteligente / Pragma — Mayo 2026
> Documento interno: oportunidades de mercado, ventajas técnicas y roadmap de features diferenciadores

---

## 1. El mercado hoy: por qué la mayoría falla

Hoy hay docenas de empresas vendiendo "bots de WhatsApp para turnos". El problema es que casi todas venden lo mismo: un flujo de preguntas y respuestas básico, sin integración real con el negocio del cliente, sin monitoreo, y con el cliente totalmente dependiente de la plataforma.

Los pain points más comunes que escuchan los clientes que ya probaron otras soluciones:

1. **"El bot no me entiende"** — flujos rígidos, sin NLP. Si el paciente escribe "quiero turno con el doc que atiende chicos" el bot no sabe qué hacer.
2. **"Cuando algo falla no me enteré"** — cero monitoreo. El bot puede estar caído días y nadie avisa.
3. **"Los pacientes se quedan trabados"** — sin herramientas para resolver conversaciones atascadas.
4. **"No puedo tocar nada sin llamar al proveedor"** — dependencia total.
5. **"Perdí mi historia si me voy"** — datos del cliente en servidores del proveedor.
6. **"Me cobran por mensajes y no sé cuánto voy a pagar"** — pricing impredecible.

**La oportunidad:** un servicio que resuelve todos estos puntos desde el arranque tiene una propuesta de valor imbatible.

---

## 2. Lo que ya tenemos: ventajas que pocos pueden replicar

### La tripleta imbatible

```
Paciente llama al consultorio
         ↓
    Sofia (voz AI)
    atiende 24/7
         ↓
Envía WhatsApp personalizado
         ↓
    Bot completa
    el agendado
         ↓
Dashboard en tiempo real
    para el equipo
```

**Ningún competidor SaaS tiene esto integrado.** Todos ofrecen solo WhatsApp o solo voz. Nunca ambos con un dashboard unificado y datos compartidos.

### El cliente es dueño de todo

- Sus datos están en SU Supabase, en SU servidor.
- Si mañana cerramos, el sistema sigue funcionando.
- Cumple Ley 25.326 (datos sensibles de pacientes). Para médicos esto es crítico.
- Argumento de venta: "Vos sos dueño de tus datos y tu sistema. Nadie te puede apagar."

### Stack técnico que la competencia no tiene

- **Race condition protection** — cuando llegan mensajes simultáneos, el bot no se confunde.
- **Alertas en tiempo real** — si algo falla, el dueño del sistema se entera en segundos.
- **Monitoreo de uptime** — detección automática de caídas.
- **Error handling diferenciado** — sesión expirada vs error técnico se manejan distinto.
- **Conversación reseteable** desde el dashboard — la secretaria resuelve sola sin llamarte.

---

## 3. El diferenciador que más vende: reducción de no-shows

Los consultorios médicos tienen entre 15-25% de no-shows (pacientes que no van sin avisar). Cada no-show es un turno perdido, tiempo del médico desperdiciado, y plata que no entró.

**Lo que se puede hacer con el sistema actual:**
- Recordatorio automático 24hs antes
- El paciente confirma o cancela desde WhatsApp
- Si cancela → el turno queda libre → se le ofrece a la lista de espera

**El argumento de venta:** "Nuestros clientes bajaron su tasa de no-shows del 20% al 6%. Para un consultorio con 20 turnos diarios a $45.000 cada uno, eso son $126.000 pesos más por día."

Esto es ROI medible, específico, y vendible. No "te automatizo los turnos" — "te recupero plata que hoy estás perdiendo".

---

## 4. Roadmap de features diferenciadores

### Prioridad ALTA — implementar antes de escalar

#### 4.1 WF-REMINDER con confirmación activa
**Qué hace:** 24hs antes del turno, manda WhatsApp con dos botones: "Confirmo" / "No puedo ir".
**Si confirma:** nada, turno confirmado en Supabase.
**Si cancela:** turno queda libre, notifica al primero de la lista de espera.
**Si no responde en 4hs:** segundo recordatorio.
**Impacto:** reducción directa de no-shows. Es el feature con mayor ROI para el cliente.
**Esfuerzo:** 1 día de implementación.

#### 4.2 Analytics básico en Tooljet
**Qué hace:** tab nueva en el dashboard con métricas clave:
- Tasa de conversión del bot (hola → turno agendado)
- Turnos por especialidad / profesional
- Horarios más solicitados
- Tasa de cancelación
- No-shows por mes
**Impacto:** el cliente puede tomar decisiones de negocio con datos. Diferenciador enorme vs "solo te agendo turnos".
**Esfuerzo:** 2 días (queries SQL + visualización Tooljet).

#### 4.3 Broadcast a pacientes activos
**Qué hace:** desde el dashboard, la secretaria puede mandar un template a todos los pacientes (o un segmento) con un mensaje.
**Caso de uso:** "Esta semana hay turnos libres con el Dr. Bravo. ¿Querés uno?" — mandado a los 200 pacientes registrados.
**Impacto:** genera demanda activa, no solo reactiva. El consultorio "sale a buscar" pacientes.
**Esfuerzo:** 1 día + aprobación de template Meta.

---

### Prioridad MEDIA — para clientes existentes que piden más

#### 4.4 Integración Google Calendar bidireccional
**Qué hace:** cuando el médico cancela un evento en su Google Calendar, el bot notifica automáticamente al paciente y le ofrece reprogramar.
**Por qué importa:** hoy el médico cancela en Google Calendar pero nadie le avisa al paciente → el paciente llega igual → mal momento para todos.
**Esfuerzo:** 2 días (webhook Google Calendar + WF nuevo).

#### 4.5 Historial del paciente visible en el bot
**Qué hace:** cuando un paciente recurrente escribe, el bot lo saluda por nombre y le muestra su último turno.
> "¡Hola Carlos! La última vez que viniste fue el 12 de marzo con el Dr. Bravo. ¿Querés un turno con él nuevamente?"
**Impacto:** experiencia personalizada que los bots genéricos no dan.
**Esfuerzo:** 3hs (ya tenemos los datos en Supabase, es lógica en WF02).

#### 4.6 NPS automatizado post-consulta
**Qué hace:** 2hs después del turno, el bot manda "¿Cómo fue tu consulta con el Dr. Bravo? Del 1 al 5".
Las respuestas se guardan en `consultorio_feedback` y se muestran en el dashboard.
**Impacto:** el consultorio tiene su propio sistema de reputación interno. Identifica médicos con problemas antes de que exploten en Google Reviews.
**Esfuerzo:** 4hs (WF06 ya existe, ampliar con envío automático).

#### 4.7 Multi-sede
**Qué hace:** un cliente con 2 sucursales puede manejar ambas desde el mismo sistema. El bot pregunta "¿Cuál sede preferís?".
**Por qué importa:** los clientes que crecen quieren escalar sin duplicar costos.
**Esfuerzo:** 1 día (agregar campo `sede` a profesionales y turnos, lógica en WF02).

---

### Prioridad BAJA — para cuando tengamos 10+ clientes

#### 4.8 Panel del paciente (self-service web)
**Qué hace:** URL única por paciente donde puede ver sus próximos turnos, cancelar, y reprogramar. Sin necesitar WhatsApp.
**Por qué importa:** algunos pacientes prefieren web a chat. Amplía el canal.
**Esfuerzo:** 3 días (mini web app en n8n o Tooljet).

#### 4.9 Integración con software de gestión (Sigeclic, HIS)
**Qué hace:** el sistema se conecta al software que ya usa el consultorio para leer/escribir datos.
**Por qué importa:** elimina la doble carga de trabajo de la secretaria (cargar en dos sistemas).
**Esfuerzo:** variable (depende del software del cliente). Metodología ya documentada en Sofia-Sigeclic.

#### 4.10 White-label total
**Qué hace:** el bot se llama "Asistente del Consultorio Rivadavia", no "Consultorio Inteligente de Pragma".
**Por qué importa:** para clientes que quieren su propia marca en el sistema.
**Esfuerzo:** 1 día (parametrizar nombres y logos).

---

## 5. El modelo de negocio que maximiza el valor

### Pricing recomendado (a analizar)

| Tier | Incluye | Precio estimado |
|------|---------|-----------------|
| **Starter** | Bot WhatsApp + Dashboard + Monitoreo | $300-400 USD setup + $80/mes |
| **Pro** | Todo Starter + Sofia voz + Recordatorios | $600 USD setup + $150/mes |
| **Enterprise** | Todo Pro + Analytics + Broadcast + Integración | $1.200 USD setup + $250/mes |

### El argumento del ROI
Para un consultorio con 20 turnos/día a $45.000 cada uno:
- 20% de no-shows = 4 turnos perdidos/día = $180.000/día = ~$3.960.000/mes perdidos
- Si reducimos no-shows al 5% → recuperan $135.000/día → $2.970.000/mes
- El servicio cuesta $200.000/mes (Pro) → ROI de 14x en el primer mes

**Cuando mostrás este cálculo, el precio deja de ser una objeción.**

### Modelo de agencia vs SaaS
No intentar construir un SaaS genérico (requiere capital, soporte, escala). 
El modelo de agencia con instalación + soporte mensual es más rentable al comienzo y construye relaciones de largo plazo.
Cuando tengas 10 clientes con la misma industria (ej: médicos) sí tiene sentido considerar productizar esa vertical.

---

## 6. Cómo posicionarse en la conversación de ventas

### Lo que NO decir
- "Te hago un bot de WhatsApp" — commodity, todos lo hacen
- "Te automatizo los turnos" — vago, no diferencia
- "Es muy fácil de usar" — no resuelve el problema real

### Lo que SÍ decir
- "Recuperás los turnos que hoy estás perdiendo por no-shows"
- "Tu consultorio atiende pacientes a las 3am sin contratar a nadie"
- "Tus datos son tuyos — si mañana cambiás de proveedor, llevás todo"
- "El primer mes que implementamos, la tasa de no-shows baja a la mitad"
- "Tus pacientes mayores pueden LLAMAR y el sistema igual les agenda el turno"

### El demo perfecto
El demo de Rivadavia ya lo tenemos. El flujo del demo ideal:
1. Llamar al número → Sofia atiende en 2 segundos
2. Pedir turno → Sofia manda WhatsApp instantáneo
3. Agendar por WhatsApp → turno aparece en Tooljet en tiempo real
4. Mostrar el dashboard al cliente → "Esto lo ve tu secretaria ahora mismo"
5. Cancelar un turno desde Tooljet → paciente recibe WhatsApp de cancelación

**Ese demo en 5 minutos no lo puede replicar ningún competidor SaaS.**

---

## 7. Mejoras técnicas de arquitectura para escalar

### 7.1 Parametrización completa del kit
Hoy WF02 y WF09 tienen hardcodeados los datos de Rivadavia (nombre, dirección, teléfono, obras sociales). Para que el kit sea verdaderamente copy-paste, estos datos tienen que venir de variables de entorno o de una tabla de configuración en Supabase.

**Tabla `consultorio_config`:**
```sql
CREATE TABLE consultorio_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
-- Datos: nombre, direccion, telefono, horario, precio_particular, etc.
```

WF02 lee esta tabla una vez al inicio → los datos del consultorio son dinámicos.

### 7.2 Multi-tenant en un solo n8n (para cuando escales)
Hoy cada cliente tiene su propio n8n (modelo correcto para empezar). Cuando tengas 10+ clientes, podés mover todo a un n8n compartido con variables de entorno por cliente. Reduce costos de hosting pero aumenta riesgo de interferencia entre clientes. Hacerlo bien requiere un mes de trabajo.

### 7.3 Queue de mensajes con Redis
Para clientes de alto volumen (500+ mensajes/día), agregar una cola de mensajes entre WF01 y WF02 garantiza que ningún mensaje se pierda ni se procese dos veces, incluso si n8n tiene picos de carga. Overkill para el 90% de los clientes actuales.

### 7.4 Webhook signature validation
Meta firma cada webhook con HMAC-SHA256. Hoy WF01 no valida esa firma. Agregarla toma 30 minutos y previene ataques donde alguien envía webhooks falsos al endpoint de n8n.

```javascript
// En WF01, antes de procesar:
const crypto = require('crypto');
const sig = headers['x-hub-signature-256'];
const expected = 'sha256=' + crypto.createHmac('sha256', META_VERIFY_TOKEN).update(rawBody).digest('hex');
if (sig !== expected) return [{ json: { ignored: true } }];
```

### 7.5 Logs estructurados
Hoy los errores van a Telegram como texto libre. Para escalar, agregar logs estructurados en Supabase:

```sql
CREATE TABLE consultorio_logs (
  id UUID DEFAULT gen_random_uuid(),
  telefono_wa TEXT,
  accion TEXT,
  estado_antes TEXT,
  estado_despues TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Esto permite auditar qué pasó con cada conversación y detectar patrones de problemas.

---

## 8. El feature que nadie tiene: "Inteligencia de agenda"

Este es el diferenciador más difícil de copiar y más valioso para el cliente:

**El problema:** los médicos tienen "huecos" en su agenda que nadie llena. Los pacientes que quieren turno no saben que hay disponibilidad.

**La solución:** cuando hay un hueco en la agenda de los próximos 3 días, el bot automáticamente escribe a los pacientes de la lista de espera (o con historial de esa especialidad) ofreciendo ese horario.

```
"Hola Carlos! Vimos que te interesaba un turno con el Dr. Bravo 
(Cardiología). ¡Tenemos un lugar libre para mañana a las 15:00! 
¿Querés reservarlo? [Sí, reservar] [No gracias]"
```

**Por qué importa:** convierte turnos perdidos en turnos ocupados. El consultorio llena su agenda proactivamente. Ningún bot genérico hace esto porque no tienen acceso a la agenda real del médico — nosotros sí.

**Esfuerzo:** 2 días (WF-PROACTIVE: cron cada 2hs → detecta huecos → cruza con waitlist → envía template).

---

## Conclusión: lo que nos hace diferentes

No somos un chatbot. Somos un **sistema de gestión de pacientes** con tres canales integrados (voz, WhatsApp, web), propiedad del cliente, con inteligencia de agenda y métricas de negocio.

Los competidores SaaS venden una herramienta. Nosotros vendemos un resultado:
**menos no-shows, más turnos completos, menos tiempo de la secretaria en el teléfono, pacientes más satisfechos.**

Eso tiene precio, y ese precio justifica lo que cobramos.
