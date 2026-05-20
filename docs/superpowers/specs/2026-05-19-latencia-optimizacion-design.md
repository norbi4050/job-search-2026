# Optimización de Latencia — Consultorio Inteligente

## Qué construimos

Reducir la latencia de respuesta del bot de WhatsApp de ~2-3 segundos actuales a ~1-1.5 segundos, ejecutando dos fases independientes: optimizaciones de código en WF02 (Fase A) y migración de Supabase a São Paulo (Fase B).

---

## Diagnóstico — Estado actual

### Infraestructura

| Componente | Región | RTT estimado |
|---|---|---|
| n8n / EasyPanel (Hostinger) | Brazil - Campinas | — (origen) |
| Supabase | **US East - North Virginia (us-east-1)** | ~80-100ms por call |
| Anthropic Claude Haiku | US | ~200-400ms por call |
| WhatsApp API (Meta) | Global | ~100-200ms |

### Problemas identificados en código (`wf02_code.js`)

1. **`consultorio_pacientes` sin índice en `telefono_wa`** — la query más frecuente hace full scan
2. **Cero `Promise.all`** — todas las lecturas de Supabase son secuenciales
3. **`classifyInput` en cada mensaje** — siempre llama a Claude Haiku aunque el intent sea obvio (cancelar, turno, horario)
4. **Paciente re-leído en cada mensaje** — después de identificarse no se cachea en `ctx`

### Latencia estimada por mensaje de texto simple (baseline)

```
Read conv (Supabase US):    ~90ms
Write 'procesando':         ~90ms
classifyInput (Haiku):     ~300ms
Reads adicionales (x2):    ~180ms
WhatsApp send:             ~150ms
Log Supabase:               ~90ms
─────────────────────────
TOTAL mínimo:              ~900ms
```

En flujos complejos (booking, cancelación con 4-6 lecturas): ~2-3 segundos.

---

## Arquitectura de la solución

Dos fases independientes, ejecutadas en orden. Fase A primero siempre — sin downtime, reversible. Fase B requiere ventana de mantenimiento de ~3 minutos.

```
Fase A — Código (sin downtime)
  A1. Índice SQL en consultorio_pacientes.telefono_wa
  A2. Keyword pre-filter antes de classifyInput
  A3. Promise.all para lecturas paralelas al inicio del flujo
  A4. Cache de paciente en ctx
  → Deploy WF02 vía n8n API
  → Validar en prod

Fase B — Migración Supabase (ventana ~3 min de downtime)
  B1. Crear nuevo proyecto en sa-east-1 (São Paulo)
  B2. Aplicar schema + índices
  B3. Migrar datos
  B4. Actualizar env vars (n8n + dashboard)
  B5. Validar en prod
  → Mantener proyecto viejo activo 48h (rollback)
```

---

## Fase A — Detalle

### A1. Índice SQL

```sql
CREATE INDEX idx_pacientes_telefono ON consultorio_pacientes (telefono_wa);
```

Aplicar vía MCP Supabase (`execute_sql`) sobre proyecto `xorjkjaimeampfdiichs`. Sin downtime.

### A2. Keyword pre-filter

Nueva función `quickClassify(texto)` en `wf02_code.js`, llamada al inicio de `classifyInput` antes de invocar Claude Haiku:

```js
function quickClassify(texto) {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/\b(cancelar|cancela|cancelacion)\b/.test(t))
    return { intent: 'cancelar', sentiment: 'ok', confidence: 'alta' };
  if (/\b(turno|sacar turno|quiero turno|pedir turno|reservar|agendar)\b/.test(t))
    return { intent: 'turno', sentiment: 'ok', confidence: 'alta' };
  if (/\b(mis turnos|ver turno|tengo turno|cuando es|cuando tengo)\b/.test(t))
    return { intent: 'consultar', sentiment: 'ok', confidence: 'alta' };
  if (/\b(horario|atiende|dias|precio|costo|obra social)\b/.test(t))
    return { intent: 'pregunta', sentiment: 'ok', confidence: 'alta' };
  return null;
}

async function classifyInput(texto, estadoActual) {
  const quick = quickClassify(texto);
  if (quick) return quick;
  // ... resto del código actual (Claude Haiku) sin cambios
}
```

Aplica a los 3 call sites de `classifyInput` (líneas 660, 1027, 1366) automáticamente al modificar la función.

### A3. Promise.all — lectura paralela al inicio

Reemplazar la lectura secuencial inicial de conv + paciente por una paralela:

```js
// ANTES (secuencial):
const freshConv = await supaGet('consultorio_conversaciones', { ... });
// ... más adelante ...
const pac = await supaGet('consultorio_pacientes', { telefono_wa: `eq.${phone}`, select: '*' });

// DESPUÉS (paralelo):
const [freshConvRows, pacRows] = await Promise.all([
  supaGet('consultorio_conversaciones', { telefono_wa: `eq.${phone}`, select: 'estado,contexto,updated_at' }),
  supaGet('consultorio_pacientes', { telefono_wa: `eq.${phone}`, select: '*' })
]);
const freshState = freshConvRows?.[0];
// pacRows disponible inmediatamente para los handlers que lo necesiten
```

La lectura de paciente se hace siempre al inicio del flujo, en paralelo con la conv — se guarda en variable y se usa donde se necesite en lugar de re-fetchar.

### A4. Cache de paciente en ctx

Una vez identificado el paciente (después del paso `esperando_dni`), guardar en `ctx.pacienteCache`:

```js
ctx.pacienteCache = {
  id: pac.id,
  nombre: pac.nombre,
  obra_social: pac.obra_social,
  fecha_nacimiento: pac.fecha_nacimiento
};
```

En mensajes subsiguientes, si `ctx.pacienteCache` existe y el estado no es `inicio`/`esperando_dni`, saltearse el `supaGet` de paciente y usar el cache. Invalidar cache si el estado vuelve a `inicio`.

### Deploy Fase A

1. Aplicar índice SQL vía MCP Supabase
2. Modificar `C:/Users/noyag/wf02_code.js` con los cambios A2 + A3 + A4
3. Ejecutar `node C:/Users/noyag/deploy_wf02.js` (PUT WF02 vía n8n API)
4. Validar enviando mensajes reales al bot de demo

---

## Fase B — Detalle

**Decisión de alcance:** El proyecto actual de Supabase (`xorjkjaimeampfdiichs`, us-east-1) tiene tablas de múltiples sistemas (Content Engine, reels, leads, AlPunto, etc.). Solo migramos las tablas `consultorio_*`. El resto queda en el proyecto actual sin cambios.

Para no tocar los otros workflows, se usan **env vars nuevas** en n8n (`CONSULTORIO_SUPABASE_URL` + `CONSULTORIO_SUPABASE_KEY`) en lugar de reemplazar las existentes.

### B1. Crear nuevo proyecto Supabase

- Región: **sa-east-1 (South America - São Paulo)**
- Nombre: `Consultorio Inteligente`
- Anotar: nuevo proyecto URL y keys (anon + service role)

### B2. Aplicar schema + índices

Extraer DDL del proyecto actual vía MCP `execute_sql` y aplicar al nuevo proyecto en orden (respetando foreign keys):

1. Tablas base (sin FK entrantes): `consultorio_profesionales`, `consultorio_pacientes`
2. Tablas dependientes: `consultorio_conversaciones`, `consultorio_turnos`, `consultorio_horarios_profesional`, `consultorio_waitlist`, `consultorio_feedback`, `consultorio_mensajes`, `consultorio_configuracion`, `consultorio_campanas`, `consultorio_campana_envios`, `consultorio_adelanto_ofertas`, `consultorio_bloqueos`
3. Índices: todos los `idx_*` actuales + `idx_pacientes_telefono` (ya aplicado en Fase A sobre proyecto viejo — reaplicar en nuevo)
4. RLS policies: extraer del proyecto actual y replicar exactas

### B3. Migrar datos

Via MCP `execute_sql`: exportar cada tabla como INSERT batch e importar al nuevo proyecto. Orden respetando foreign keys (mismo que B2).

Tablas con datos a migrar:
- `consultorio_profesionales` — 5 filas
- `consultorio_pacientes` — 22 filas
- `consultorio_conversaciones` — 31 filas
- `consultorio_turnos` — 15 filas
- `consultorio_horarios_profesional` — 21 filas
- `consultorio_mensajes` — 129 filas
- `consultorio_configuracion` — 1 fila
- `consultorio_campana_envios` — 16 filas
- Resto de tablas consultorio_*: 0 filas (solo schema, sin datos)

### B4. Actualizar código de workflows consultorio

Los workflows actualmente usan `$env.SUPABASE_URL` / `$env.SUPABASE_SERVICE_KEY`. Hay que cambiarlos a las nuevas vars `CONSULTORIO_SUPABASE_URL` / `CONSULTORIO_SUPABASE_KEY`.

Workflows a actualizar (2 líneas al inicio de cada uno):
| Workflow | Archivo local | Cambio |
|---|---|---|
| WF02 | `C:/Users/noyag/wf02_code.js` | `$env.SUPABASE_URL` → `$env.CONSULTORIO_SUPABASE_URL` (línea 8) y `$env.SUPABASE_SERVICE_KEY` → `$env.CONSULTORIO_SUPABASE_KEY` (línea 9) |
| WF01 | inline n8n | mismo reemplazo en nodo "3. Extraer Mensaje" si referencia Supabase |
| WF05 | `C:/Users/noyag/wf05_new.js` | mismo reemplazo |
| WF08 | `C:/Users/noyag/wf08_code.js` | mismo reemplazo |
| WF09 | `C:/Users/noyag/wf09-code.js` | mismo reemplazo |
| WF-CUMPLEANOS | `C:/Users/noyag/wf_cumpleanos_code.js` | mismo reemplazo |
| WF-REACTIVACION | `C:/Users/noyag/wf_reactivacion_code.js` | mismo reemplazo |
| WF-CAMPANAS | `C:/Users/noyag/wf_campanas_code.js` | mismo reemplazo |
| WF-DASH-* | inline n8n | mismo reemplazo en cada nodo Code |

### B5. Agregar env vars en EasyPanel + ventana de downtime (~3 min)

**EasyPanel → n8n → Environment Variables (AGREGAR, no reemplazar):**
| Variable nueva | Valor |
|---|---|
| `CONSULTORIO_SUPABASE_URL` | URL del nuevo proyecto sa-east-1 |
| `CONSULTORIO_SUPABASE_KEY` | Service role key del nuevo proyecto |

Las vars `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` **permanecen sin cambios** — siguen siendo usadas por Content Engine, reels y demás.

**EasyPanel → dashboard Next.js → Environment Variables (actualizar valores):**

El dashboard solo sirve consultorio, así que los valores cambian pero los nombres de vars no:
| Variable | Valor nuevo |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del nuevo proyecto sa-east-1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key del nuevo proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key del nuevo proyecto |

Después de actualizar: reiniciar el servicio de dashboard en EasyPanel.

**Supabase Auth (nuevo proyecto):**
- Site URL: `https://nexo-terra-consultorio-rivadavia-dashboard.6fwciw.easypanel.host`
- Redirect URLs: mismas que el proyecto actual
- Recrear usuario de acceso al dashboard (sign up con el mismo email — los datos están en Auth del proyecto viejo, no en tabla pública)

### B6. Desplegar workflows actualizados

Después de agregar las env vars en EasyPanel, deployar todos los workflows modificados en B4 vía n8n API. Orden: WF02 primero (ya tiene deploy script), el resto vía PUT manual o scripts equivalentes.

### B7. Validar

1. Enviar mensaje de WhatsApp al bot de demo → verificar respuesta correcta
2. Login al dashboard con el usuario recreado → verificar autenticación
3. Verificar que un turno existente aparece en el dashboard
4. Revisar n8n execution logs → 0 errores Supabase
5. Verificar que los otros workflows (Content Engine, reels) siguen funcionando con el proyecto viejo

### Rollback Fase B

Si algo falla antes de completar B6: no hay nada que revertir — el código viejo sigue apuntando a `SUPABASE_URL` (proyecto viejo). Si falla después de deployar: revertir los workflows a sus versiones anteriores (el código viejo no usa `CONSULTORIO_SUPABASE_URL`). Proyecto viejo permanece activo indefinidamente (no se elimina hasta confirmar estabilidad en producción por al menos 1 semana).

---

## Ganancia esperada

| Optimización | Ahorro estimado |
|---|---|
| A1. Índice telefono_wa | ~10-20ms por lookup de paciente |
| A2. Keyword pre-filter | ~250-350ms cuando matchea (~40% de mensajes) |
| A3. Promise.all reads | ~80-100ms por mensaje |
| A4. Cache paciente | ~80-100ms desde el 2do mensaje en adelante |
| B. Supabase São Paulo | ~60ms × 5 calls = ~300ms por mensaje |
| **Total Fase A** | **~300-400ms por mensaje** |
| **Total Fase A + B** | **~600-750ms por mensaje** |

Resultado esperado: de ~2-3 segundos actuales → **~1-1.5 segundos**. Competitivo con productos comerciales.

---

## Lo que NO cambia

- Schema de Supabase (mismas tablas, mismas columnas)
- IDs de workflows n8n
- Templates de WhatsApp aprobados
- State machine completa de WF02
- Vapi / Sofía / WF09
- URLs del dashboard

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `C:/Users/noyag/wf02_code.js` | A2 + A3 + A4 |
| Supabase proyecto actual | A1 (índice) |
| Supabase proyecto nuevo (sa-east-1) | Schema + datos completos |
| Supabase proyecto nuevo (sa-east-1) | Schema + datos consultorio_* solamente |
| EasyPanel n8n env vars | AGREGAR: CONSULTORIO_SUPABASE_URL + CONSULTORIO_SUPABASE_KEY (no tocar SUPABASE_URL) |
| EasyPanel dashboard env vars | NEXT_PUBLIC_SUPABASE_URL + anon key + service key (actualizar valores) |
| WF01/05/08/09/WF-CUMPLEANOS/WF-REACTIVACION/WF-CAMPANAS/WF-DASH-* | Reemplazar $env.SUPABASE_URL → CONSULTORIO_SUPABASE_URL en cada nodo Code |
