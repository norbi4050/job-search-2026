# Demo Auto-Cierre Comercial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar el demo de WhatsApp en una herramienta de cierre automático: el bot recibe un código `DEMO-XXXX`, muestra el sistema al prospecto con sus datos reales, calcula el ROI personalizado, y notifica a Carlos cuando hay interés — sin intervención manual.

**Architecture:** 3 capas independientes que se integran al final. (1) Supabase: nueva tabla `consultorio_demo_sessions`. (2) Dashboard Next.js: nueva página `/dashboard/demos` con API routes para crear/listar sesiones. (3) n8n: WF01 detecta el código y carga la sesión; WF02 maneja los nuevos estados `demo_prospecto_*`.

**Tech Stack:** Supabase REST + MCP, Next.js 14 (App Router), TypeScript, n8n Code nodes (WF01 + WF02), ElevenLabs TTS (voz Sofía), WhatsApp Cloud API.

---

## Archivos

| Archivo | Acción | Qué hace |
|---|---|---|
| Supabase `consultorio_demo_sessions` | Crear | Tabla de sesiones demo con código único |
| `consultorio-kit/dashboard/app/api/demos/crear/route.ts` | Crear | POST: genera código, inserta sesión |
| `consultorio-kit/dashboard/app/api/demos/route.ts` | Crear | GET: lista sesiones recientes |
| `consultorio-kit/dashboard/app/dashboard/demos/page.tsx` | Crear | Server component, auth guard dueno |
| `consultorio-kit/dashboard/app/dashboard/demos/demos-client.tsx` | Crear | Client: lista + modal nueva demo |
| `consultorio-kit/dashboard/components/layout/sidebar.tsx` o similar | Modificar | Agregar link "Demos" al nav (solo dueno) |
| `C:/Users/noyag/WF01_GATEWAY_code2.js` | Modificar | Detectar DEMO-XXXX, cargar sesión, setear estado |
| `C:/Users/noyag/wf02_code.js` | Modificar | 4 nuevos estados `demo_prospecto_*` |

---

## Task 1: Crear tabla Supabase `consultorio_demo_sessions`

**Files:**
- Supabase proyecto `ebkvrhrpejegfpdodymd` (sa-east-1)

- [ ] **Step 1: Crear tabla via MCP Supabase**

Usar `mcp__claude_ai_Supabase__execute_sql` con `project_id: "ebkvrhrpejegfpdodymd"`:

```sql
CREATE TABLE IF NOT EXISTS consultorio_demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(9) UNIQUE NOT NULL,
  clinic_name TEXT NOT NULL,
  turnos_dia INTEGER NOT NULL,
  profesionales INTEGER NOT NULL,
  admin_name TEXT,
  tipo TEXT NOT NULL DEFAULT 'remoto' CHECK (tipo IN ('presencial', 'remoto')),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'usado', 'expirado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demo_sessions_code ON consultorio_demo_sessions (code);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_estado ON consultorio_demo_sessions (estado);
```

- [ ] **Step 2: Verificar tabla**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'consultorio_demo_sessions'
ORDER BY ordinal_position;
```

Expected: 10 columnas (id, code, clinic_name, turnos_dia, profesionales, admin_name, tipo, estado, created_at, expires_at).

- [ ] **Step 3: Habilitar RLS y política para service_role**

```sql
ALTER TABLE consultorio_demo_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON consultorio_demo_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## Task 2: API routes del dashboard

**Files:**
- Crear: `consultorio-kit/dashboard/app/api/demos/crear/route.ts`
- Crear: `consultorio-kit/dashboard/app/api/demos/route.ts`

**Patrón de referencia:** `app/api/campanas/crear/route.ts` (usa `createClient`, `getRole`, `NextResponse`).

- [ ] **Step 1: Crear `app/api/demos/crear/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'DEMO-'
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { clinic_name, turnos_dia, profesionales, admin_name, tipo } = body

  if (!clinic_name || !turnos_dia || !profesionales || !tipo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Generar código único (reintentar si hay colisión)
  let code = ''
  let attempts = 0
  while (attempts < 5) {
    code = generateCode()
    const { data: existing } = await supabase
      .from('consultorio_demo_sessions')
      .select('code')
      .eq('code', code)
      .single()
    if (!existing) break
    attempts++
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('consultorio_demo_sessions')
    .insert({
      code,
      clinic_name,
      turnos_dia: parseInt(String(turnos_dia), 10),
      profesionales: parseInt(String(profesionales), 10),
      admin_name: admin_name || null,
      tipo,
      estado: 'activo',
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const wa_link = `https://wa.me/5491137936325?text=${code}`
  return NextResponse.json({ session: data, wa_link })
}
```

- [ ] **Step 2: Crear `app/api/demos/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('consultorio_demo_sessions')
    .select('*')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data ?? [] })
}
```

- [ ] **Step 3: Verificar sintaxis TypeScript**

```bash
cd "C:\Users\noyag\Norberto-Documentos\consultorio-kit\dashboard"
npx tsc --noEmit 2>&1 | head -30
```

Expected: sin errores en los archivos nuevos.

---

## Task 3: Página `/dashboard/demos`

**Files:**
- Crear: `consultorio-kit/dashboard/app/dashboard/demos/page.tsx`
- Crear: `consultorio-kit/dashboard/app/dashboard/demos/demos-client.tsx`
- Modificar: sidebar/nav del dashboard para agregar link "Demos"

- [ ] **Step 1: Crear `app/dashboard/demos/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { DemosClient } from './demos-client'

export default async function DemosPage() {
  const supabase = createClient()
  let user: any
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch { redirect('/login') }
  if (!user) redirect('/login')
  if (getRole(user.user_metadata) !== 'dueno') redirect('/dashboard')

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: sessions } = await supabase
    .from('consultorio_demo_sessions')
    .select('*')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Demos Comerciales" subtitle="Gestión de sesiones de demo para prospectos" />
      <div className="flex-1 overflow-y-auto p-6">
        <DemosClient initial={sessions ?? []} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear `app/dashboard/demos/demos-client.tsx`**

```typescript
'use client'
import { useState } from 'react'

type DemoSession = {
  id: string
  code: string
  clinic_name: string
  turnos_dia: number
  profesionales: number
  admin_name: string | null
  tipo: 'presencial' | 'remoto'
  estado: 'activo' | 'usado' | 'expirado'
  created_at: string
  expires_at: string
}

export function DemosClient({ initial }: { initial: DemoSession[] }) {
  const [sessions, setSessions] = useState<DemoSession[]>(initial)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    clinic_name: '', turnos_dia: '', profesionales: '',
    admin_name: '', tipo: 'remoto' as 'presencial' | 'remoto'
  })
  const [creating, setCreating] = useState(false)
  const [newSession, setNewSession] = useState<{ code: string; wa_link: string } | null>(null)
  const [copied, setCopied] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/demos/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_name: form.clinic_name,
          turnos_dia: parseInt(form.turnos_dia, 10),
          profesionales: parseInt(form.profesionales, 10),
          admin_name: form.admin_name || null,
          tipo: form.tipo,
        }),
      })
      const data = await res.json()
      if (data.session) {
        setSessions(prev => [data.session, ...prev])
        setNewSession({ code: data.session.code, wa_link: data.wa_link })
      }
    } finally {
      setCreating(false)
    }
  }

  function copyLink(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  function estadoBadge(s: DemoSession) {
    const now = new Date()
    const exp = new Date(s.expires_at)
    if (s.estado === 'usado') return <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">Usado</span>
    if (exp < now || s.estado === 'expirado') return <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400">Expirado</span>
    return <span className="px-2 py-0.5 rounded text-xs bg-emerald-900 text-emerald-300">Activo</span>
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const h = Math.floor(diff / 3600000)
    if (h < 1) return 'hace menos de 1h'
    if (h < 24) return `hace ${h}h`
    return `hace ${Math.floor(h / 24)} días`
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">Sesiones de demo</h2>
        <button
          onClick={() => { setShowModal(true); setNewSession(null) }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          + Nueva Demo
        </button>
      </div>

      {/* Lista de sesiones */}
      <div className="space-y-3">
        {sessions.length === 0 && (
          <p className="text-gray-500 text-sm">No hay sesiones de demo en los últimos 30 días.</p>
        )}
        {sessions.map(s => (
          <div key={s.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-mono text-blue-400 font-bold text-sm">{s.code}</span>
              <div>
                <div className="text-white text-sm font-medium">{s.clinic_name}</div>
                <div className="text-gray-400 text-xs">
                  {s.turnos_dia} turnos/día · {s.profesionales} profesionales · {s.tipo}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {estadoBadge(s)}
              <span className="text-gray-500 text-xs">{timeAgo(s.created_at)}</span>
              <button
                onClick={() => copyLink(`https://wa.me/5491137936325?text=${s.code}`, s.code)}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded border border-gray-700 hover:border-gray-500"
              >
                {copied === s.code ? '✓ Copiado' : 'Copiar link'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal nueva demo */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
            {newSession ? (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">¡Demo creada! 🎉</h3>
                <div className="bg-gray-800 rounded-lg p-4 mb-4 text-center">
                  <div className="font-mono text-2xl text-blue-400 font-bold mb-2">{newSession.code}</div>
                  <div className="text-gray-400 text-sm">Código a compartir con el prospecto</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 mb-4">
                  <div className="text-gray-400 text-xs mb-1">Link de WhatsApp:</div>
                  <div className="text-blue-300 text-sm font-mono break-all">{newSession.wa_link}</div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => copyLink(newSession.wa_link, 'link')}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    {copied === 'link' ? '✓ Copiado' : 'Copiar link'}
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate}>
                <h3 className="text-lg font-semibold text-white mb-4">Nueva sesión de demo</h3>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Nombre del consultorio *</label>
                    <input
                      type="text" required
                      value={form.clinic_name}
                      onChange={e => setForm(f => ({ ...f, clinic_name: e.target.value }))}
                      placeholder="Ej: Clínica San Martín"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Turnos por día *</label>
                      <input
                        type="number" required min="1"
                        value={form.turnos_dia}
                        onChange={e => setForm(f => ({ ...f, turnos_dia: e.target.value }))}
                        placeholder="Ej: 20"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Profesionales *</label>
                      <input
                        type="number" required min="1"
                        value={form.profesionales}
                        onChange={e => setForm(f => ({ ...f, profesionales: e.target.value }))}
                        placeholder="Ej: 4"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Nombre del dueño (opcional)</label>
                    <input
                      type="text"
                      value={form.admin_name}
                      onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))}
                      placeholder="Ej: Dr. García"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Tipo de demo</label>
                    <div className="flex gap-3">
                      {(['presencial', 'remoto'] as const).map(t => (
                        <label key={t} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio" name="tipo" value={t}
                            checked={form.tipo === t}
                            onChange={() => setForm(f => ({ ...f, tipo: t }))}
                            className="text-blue-500"
                          />
                          <span className="text-gray-300 text-sm capitalize">{t}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      {form.tipo === 'presencial'
                        ? 'El bot usa los datos cargados directamente — sin preguntas al prospecto.'
                        : 'El bot pregunta 3 datos al prospecto antes de la demo.'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit" disabled={creating}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                  >
                    {creating ? 'Creando...' : 'Crear Demo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Agregar "Demos" al sidebar**

Leer el sidebar actual para identificar dónde están los links (buscar el link de "Campañas"). Agregar link a `/dashboard/demos` en la misma posición relativa al de Campañas, con mismo guard `dueno`. El ícono puede ser 🎯 o un icono de presentación.

Comando para encontrar el sidebar:
```bash
grep -rn "campanas\|Campañas" "C:\Users\noyag\Norberto-Documentos\consultorio-kit\dashboard\components" --include="*.tsx" | head -10
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd "C:\Users\noyag\Norberto-Documentos\consultorio-kit\dashboard"
npx tsc --noEmit 2>&1 | grep -i "demos\|error" | head -20
```

Expected: 0 errores en archivos de demos.

---

## Task 4: WF01 — Detección DEMO-XXXX

**Files:**
- Modificar: `C:/Users/noyag/WF01_GATEWAY_code2.js`

El archivo actual (WF01_GATEWAY_code2.js) carga la conversación de Supabase y hace merge con el mensaje. Hay que agregar la lógica de detección DESPUÉS del merge y ANTES del return.

- [ ] **Step 1: Leer el archivo actual**

```
Read C:/Users/noyag/WF01_GATEWAY_code2.js
```

Verificar que las variables `SUPABASE_URL`, `SUPABASE_KEY`, `msgData` y `conv` existen y son accesibles en el scope donde vamos a insertar el código.

- [ ] **Step 2: Agregar detección DEMO al final de WF01_GATEWAY_code2.js**

Insertar este bloque ANTES del `return` final (que retorna `[{ json: {...msgData, convEstado, convContexto, ...} }]`):

```javascript
// Detección DEMO-XXXX: solo en estado inicio y si el mensaje coincide
const CONSULTORIO_SUPABASE_URL = $env.CONSULTORIO_SUPABASE_URL;
const CONSULTORIO_SUPABASE_KEY = $env.CONSULTORIO_SUPABASE_KEY;
const demoMatch = msgData.textoMensaje.toUpperCase().match(/^DEMO-[A-Z0-9]{4}$/);
if (demoMatch && (conv.estado === 'inicio' || !conv.estado)) {
  try {
    const demoRes = await this.helpers.httpRequest({
      method: 'GET',
      url: `${CONSULTORIO_SUPABASE_URL}/rest/v1/consultorio_demo_sessions`,
      qs: {
        code: `eq.${demoMatch[0]}`,
        estado: 'eq.activo',
        select: '*',
        limit: '1'
      },
      headers: { 'apikey': CONSULTORIO_SUPABASE_KEY, 'Authorization': `Bearer ${CONSULTORIO_SUPABASE_KEY}` }
    });
    const demoSession = demoRes?.[0];
    const now = new Date();
    if (demoSession && new Date(demoSession.expires_at) > now) {
      // Sesión válida: actualizar conversación
      const newCtx = {
        demo_session: {
          code: demoSession.code,
          clinic_name: demoSession.clinic_name,
          turnos_dia: demoSession.turnos_dia,
          profesionales: demoSession.profesionales,
          admin_name: demoSession.admin_name,
          tipo: demoSession.tipo,
          session_id: demoSession.id
        }
      };
      await this.helpers.httpRequest({
        method: 'PATCH',
        url: `${CONSULTORIO_SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
        qs: { telefono_wa: `eq.${msgData.phone}` },
        headers: {
          'apikey': CONSULTORIO_SUPABASE_KEY, 'Authorization': `Bearer ${CONSULTORIO_SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: 'demo_prospecto_init', contexto: newCtx, updated_at: now.toISOString() })
      });
      conv.estado = 'demo_prospecto_init';
      conv.contexto = newCtx;
    }
  } catch(err) {
    // Si falla, continúa normal (el prospecto verá el flujo demo estándar)
  }
}
```

- [ ] **Step 3: Commit del archivo local**

```bash
cd "C:\Users\noyag\Norberto-Documentos"
git add -A
git commit -m "feat(wf01): detect DEMO-XXXX code and load demo session"
```

---

## Task 5: WF02 — `demo_prospecto_init` + `demo_prospecto_preguntas`

**Files:**
- Modificar: `C:/Users/noyag/wf02_code.js`

Los nuevos estados se insertan ANTES del bloque `if (estado === 'inicio')` (línea ~712 actual).

**Patrón crítico (feedback memory):** Todo `return` en la state machine debe tener `updateConv` antes. Sin eso el estado queda en 'procesando' y resetea a 'inicio'.

- [ ] **Step 1: Agregar estado `demo_prospecto_init` en wf02_code.js**

Insertar antes del bloque `if (estado === 'inicio')`:

```javascript
// === DEMO AUTO-CIERRE: INIT ===
if (estado === 'demo_prospecto_init') {
  const ds = ctx.demo_session;
  if (!ds) {
    // contexto perdido — resetear
    await updateConv(phone, 'inicio', {});
    await sendText(phone, '¡Hola! Soy Sofía. Escribí el código DEMO que te compartieron para empezar.');
    return [{ json: { action: 'demo_init_no_session', phone } }];
  }
  if (ds.tipo === 'presencial') {
    await updateConv(phone, 'demo_prospecto_didactica', ctx);
    await sendText(phone, `¡Hola! Soy *Sofía* 👋, la asistente de *Consultorio Inteligente*.\n\nCarlos me contó que estás evaluando el sistema. Te voy a mostrar exactamente cómo funciona con los datos de *${ds.clinic_name}*. ¡Empecemos!`);
    await sendDemoDidactica(phone, ctx);
    return [{ json: { action: 'demo_presencial_didactica', phone } }];
  }
  // Remoto: preguntar datos si no están completos
  if (!ds.clinic_name || !ds.turnos_dia || !ds.profesionales) {
    ctx.demo_q_step = 1;
    await updateConv(phone, 'demo_prospecto_preguntas', ctx);
    await sendText(phone, `¡Hola! Soy *Sofía* 👋, la asistente de *Consultorio Inteligente*.\n\nPara mostrarte cómo funciona el sistema *con tus números reales*, necesito 3 datos rápidos. ¿Cómo se llama tu consultorio o clínica?`);
  } else {
    await updateConv(phone, 'demo_prospecto_didactica', ctx);
    await sendText(phone, `¡Hola! Soy *Sofía* 👋, la asistente de *Consultorio Inteligente*.\n\nTe muestro cómo funciona el sistema para *${ds.clinic_name}*. ¡Empecemos!`);
    await sendDemoDidactica(phone, ctx);
  }
  return [{ json: { action: 'demo_init_remoto', phone } }];
}
// === FIN DEMO INIT ===

// === DEMO AUTO-CIERRE: PREGUNTAS ===
if (estado === 'demo_prospecto_preguntas') {
  const ds = ctx.demo_session;
  const step = ctx.demo_q_step || 1;

  if (step === 1) {
    // Recibe nombre del consultorio
    const clinicName = texto.trim().slice(0, 100);
    ctx.demo_session = { ...ds, clinic_name: clinicName };
    ctx.demo_q_step = 2;
    await updateConv(phone, 'demo_prospecto_preguntas', ctx);
    await sendText(phone, `Perfecto, *${clinicName}*. ¿Cuántos turnos por día manejan aproximadamente? _(solo el número)_`);
    return [{ json: { action: 'demo_q1_answered', phone } }];
  }

  if (step === 2) {
    const turnos = parseInt(texto.replace(/\D/g, ''), 10);
    if (!turnos || turnos < 1 || turnos > 500) {
      await updateConv(phone, 'demo_prospecto_preguntas', ctx);
      await sendText(phone, 'Ingresá solo el número. Por ejemplo: *20*');
      return [{ json: { action: 'demo_q2_invalid', phone } }];
    }
    ctx.demo_session = { ...ds, turnos_dia: turnos };
    ctx.demo_q_step = 3;
    await updateConv(phone, 'demo_prospecto_preguntas', ctx);
    await sendText(phone, `¿Y cuántos profesionales tienen? _(médicos, odontólogos, psicólogos — el número total)_`);
    return [{ json: { action: 'demo_q2_answered', phone } }];
  }

  // Step 3: profesionales
  const profs = parseInt(texto.replace(/\D/g, ''), 10);
  if (!profs || profs < 1 || profs > 200) {
    await updateConv(phone, 'demo_prospecto_preguntas', ctx);
    await sendText(phone, 'Ingresá solo el número. Por ejemplo: *4*');
    return [{ json: { action: 'demo_q3_invalid', phone } }];
  }
  ctx.demo_session = { ...ds, profesionales: profs };
  ctx.demo_q_step = 0;
  await updateConv(phone, 'demo_prospecto_didactica', ctx);
  await sendText(phone, `Listo. Ahora sí — te muestro el sistema. Y al final te cuento lo que esto significa en pesos para *${ctx.demo_session.clinic_name}*.`);
  await sendDemoDidactica(phone, ctx);
  return [{ json: { action: 'demo_q3_done', phone } }];
}
// === FIN DEMO PREGUNTAS ===
```

- [ ] **Step 2: Commit parcial**

```bash
cd "C:\Users\noyag\Norberto-Documentos"
git add -A
git commit -m "feat(wf02): add demo_prospecto_init + demo_prospecto_preguntas states"
```

---

## Task 6: WF02 — `sendDemoDidactica` + `demo_prospecto_didactica`

**Files:**
- Modificar: `C:/Users/noyag/wf02_code.js`

La función `sendDemoDidactica` se agrega junto a las demás helpers (cerca de `sendAudio`, `sendText`). El estado `demo_prospecto_didactica` solo se activa si el bot llega a él sin haber llamado a `sendDemoDidactica` todavía (caso de reinicio de sesión).

- [ ] **Step 1: Agregar función `sendDemoDidactica`**

Agregar después de la función `sendAudio` (aproximadamente línea 300 del archivo):

```javascript
async function sendDemoDidactica(phone, ctx) {
  const msgs = [
    '📅 *Así arranca todo:* un paciente nuevo escribe por WhatsApp. Sin importar el horario, el sistema lo atiende, verifica si es paciente existente, y le muestra los turnos disponibles.',
    '📲 El paciente elige horario y médico, y confirma en el chat. El turno se registra automáticamente — *sin que la secretaria toque nada*.',
    '⏰ *24 horas antes del turno*, el sistema manda un recordatorio automático. Si el paciente no puede, lo reprograma solo. Los no-shows caen de 15% a menos del 3%.',
    '⭐ *Después de la consulta*, el sistema pide una calificación. Si es baja, avisa al dueño antes de que el paciente se vaya a las redes. Si es alta, le pide reseña en Google.',
    '😴 *Pacientes dormidos* — los que no vinieron en meses — reciben un mensaje de reactivación automático. En promedio, el 30% vuelve a sacar turno.\n\n_Ahora te muestro lo que esto significa en números para vos..._'
  ];
  for (const msg of msgs) {
    await sendText(phone, msg);
    await new Promise(r => setTimeout(r, 1200));
  }
}
```

- [ ] **Step 2: Agregar estado `demo_prospecto_didactica`**

Agregar después del bloque `demo_prospecto_preguntas`:

```javascript
// === DEMO AUTO-CIERRE: DIDÁCTICA ===
if (estado === 'demo_prospecto_didactica') {
  // Si ya se envió la didáctica (reinicio de sesión o mensaje duplicado), ir al cierre
  if (ctx.didactica_sent) {
    await updateConv(phone, 'demo_prospecto_cierre', ctx);
    await sendDemoCierre(phone, ctx);
    return [{ json: { action: 'demo_cierre_retry', phone } }];
  }
  // Primera vez: marcar y enviar
  ctx.didactica_sent = true;
  await updateConv(phone, 'demo_prospecto_didactica', ctx);
  await sendDemoDidactica(phone, ctx);
  await updateConv(phone, 'demo_prospecto_cierre', ctx);
  await sendDemoCierre(phone, ctx);
  return [{ json: { action: 'demo_didactica_sent', phone } }];
}
// === FIN DEMO DIDÁCTICA ===
```

---

## Task 7: WF02 — `sendDemoCierre` + `demo_prospecto_cierre`

**Files:**
- Modificar: `C:/Users/noyag/wf02_code.js`

- [ ] **Step 1: Agregar función `sendDemoCierre`**

Agregar junto a `sendDemoDidactica`:

```javascript
async function sendDemoCierre(phone, ctx) {
  const ds = ctx.demo_session;
  const clinic = ds.clinic_name || 'tu consultorio';
  const turnosDia = ds.turnos_dia || 20;
  const PRECIO_TURNO = 45000;

  const turnosMes = turnosDia * 22;
  const turnosPerdidos = Math.round(turnosMes * 0.15);
  const turnosRecuperados = Math.round(turnosPerdidos * 0.80);
  const roiMensual = turnosRecuperados * PRECIO_TURNO;
  const roiFmt = roiMensual.toLocaleString('es-AR');

  const textoROI = [
    `🔢 *Los números de ${clinic}:*`,
    ``,
    `• Turnos por mes: ${turnosMes}`,
    `• No-shows actuales (15%): ${turnosPerdidos} turnos perdidos`,
    `• Turnos que recuperamos: ${turnosRecuperados} por mes`,
    `• Ingreso recuperado: $${roiFmt}/mes`,
    ``,
    `💡 En un mes, el sistema te devuelve mucho más de lo que cuesta.`,
    ``,
    `¿Querés que Carlos te cuente los detalles? Escribí *ME INTERESA* 👇`
  ].join('\n');

  await sendText(phone, textoROI);

  // Audio personalizado (ElevenLabs Sofía)
  const audioScript = `Hola. Ahora que ya viste cómo funciona el sistema, te cuento lo que esto significa para ${clinic} en números reales. Con ${turnosDia} turnos por día y el 15% de no-shows que es el promedio del sector, estás dejando ir ${turnosPerdidos} consultas por mes. Nosotros recuperamos el 80% de esas. Eso son ${turnosRecuperados} pacientes más, que a 45 mil pesos por consulta, son ${roiFmt} pesos mensuales que hoy se están yendo. Un solo mes cubre el costo anual del sistema. Si esto tiene sentido para vos, escribí ME INTERESA y Carlos te llama hoy.`;

  try {
    await sendAudio(phone, audioScript);
  } catch(e) {
    // Si falla el audio, el texto ya está enviado — no es crítico
  }
}
```

- [ ] **Step 2: Agregar estado `demo_prospecto_cierre`**

Agregar después del bloque `demo_prospecto_didactica`:

```javascript
// === DEMO AUTO-CIERRE: CIERRE ===
if (estado === 'demo_prospecto_cierre') {
  const ds = ctx.demo_session;

  // Primer mensaje en cierre: si no se envió aún el cierre completo, enviarlo
  if (!ctx.cierre_sent) {
    ctx.cierre_sent = true;
    await updateConv(phone, 'demo_prospecto_cierre', ctx);
    await sendDemoCierre(phone, ctx);
    return [{ json: { action: 'demo_cierre_sent', phone } }];
  }

  // Detectar interés del prospecto
  const textoLower = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const interesKeywords = ['me interesa', 'interesa', 'si', 'sí', 'quiero', 'quiero saber', 'mas info', 'más info', 'contacto', 'llamame', 'llamame'];
  const hayInteres = interesKeywords.some(k => textoLower.includes(k));

  if (hayInteres) {
    const clinic = ds?.clinic_name || '(sin nombre)';
    const turnosDia = ds?.turnos_dia || '?';
    const profs = ds?.profesionales || '?';
    const turnosMes = (ds?.turnos_dia || 20) * 22;
    const roiMensual = Math.round(turnosMes * 0.15 * 0.80) * 45000;
    const roiFmt = roiMensual.toLocaleString('es-AR');

    await notifyTelegram(
      `🔥 *Prospecto interesado!*\n` +
      `Consultorio: ${clinic}\n` +
      `Turnos/día: ${turnosDia} · Profesionales: ${profs}\n` +
      `ROI calculado: $${roiFmt}/mes\n` +
      `WhatsApp: ${phone}`
    );

    await sendText(phone, `¡Genial! Carlos va a estar en contacto con vos muy pronto. Gracias por el tiempo. 😊`);

    // Marcar sesión como usada
    if (ds?.session_id) {
      try {
        await supaPost(`consultorio_demo_sessions?id=eq.${ds.session_id}`, { estado: 'usado' }, 'PATCH');
      } catch(e) {}
    }
    ctx.cierre_interes = true;
    await updateConv(phone, 'demo_prospecto_cierre', ctx);
    return [{ json: { action: 'demo_interes_notificado', phone } }];
  }

  // Interés ya registrado
  if (ctx.cierre_interes) {
    await updateConv(phone, 'demo_prospecto_cierre', ctx);
    await sendText(phone, 'Carlos ya está al tanto. Te contacta en breve. 😊');
    return [{ json: { action: 'demo_post_interes', phone } }];
  }

  // OOC: no es interes — guiar
  await updateConv(phone, 'demo_prospecto_cierre', ctx);
  await sendText(phone, `Si tenés alguna pregunta sobre el sistema, escribime. Y cuando estés listo, escribí *ME INTERESA* para que Carlos te contacte.`);
  return [{ json: { action: 'demo_cierre_ooc', phone } }];
}
// === FIN DEMO CIERRE ===
```

- [ ] **Step 3: Verificar que `supaPost` con método PATCH existe o usar httpRequest directo**

Buscar en wf02_code.js si existe `supaPost` con soporte para PATCH. Si no existe, reemplazar la línea de actualización de estado con:

```javascript
await helpers.httpRequest({
  method: 'PATCH',
  url: `${SUPABASE_URL}/rest/v1/consultorio_demo_sessions`,
  qs: { id: `eq.${ds.session_id}` },
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ estado: 'usado' })
});
```

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\noyag\Norberto-Documentos"
git add -A
git commit -m "feat(wf02): add demo_prospecto_didactica + demo_prospecto_cierre + sendDemoCierre"
```

---

## Task 8: Deploy WF01 + WF02 + Dashboard

**Files:**
- `C:/Users/noyag/WF01_GATEWAY_code2.js` — deploy a n8n
- `C:/Users/noyag/wf02_code.js` — deploy a n8n
- Dashboard — push a GitHub → CI → EasyPanel

### 8A: Deploy WF01

- [ ] **Step 1: Fetch WF01 actual desde n8n**

```javascript
// Script: C:/Users/noyag/deploy_wf01_demo.js
const https = require('https');
const fs = require('fs');

const N8N_BASE = 'nexo-terra-n8n.6fwciw.easypanel.host';
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ';
const WF01_ID = 'dVfZYeSsVigWd0cJ';

function req(opts, body) {
  return new Promise((res, rej) => {
    const r = https.request(opts, resp => {
      const c = []; resp.on('data', d => c.push(d));
      resp.on('end', () => { try { res(JSON.parse(Buffer.concat(c).toString())); } catch(e) { res(Buffer.concat(c).toString()); } });
    });
    r.on('error', rej);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  const wf01 = await req({ hostname: N8N_BASE, path: `/api/v1/workflows/${WF01_ID}`, method: 'GET', headers: { 'X-N8N-API-KEY': N8N_KEY } });
  if (!wf01.nodes) { console.log('❌ Fetch error:', JSON.stringify(wf01).slice(0,200)); return; }

  // Encontrar el nodo code2 (buscar por el contenido: "SUPABASE_URL" + "conv.estado")
  const codeNodes = wf01.nodes.filter(n => n.type === 'n8n-nodes-base.code');
  console.log('Code nodes:', codeNodes.map(n => `${n.name} (${n.parameters?.jsCode?.slice(0,50)}...)`));

  // Reemplazar el nodo que contiene "conv.estado" con el nuevo código
  const code2 = fs.readFileSync('C:/Users/noyag/WF01_GATEWAY_code2.js', 'utf8');
  const targetNode = codeNodes.find(n => n.parameters?.jsCode?.includes('conv.estado'));
  if (!targetNode) { console.log('❌ No se encontró nodo code2'); return; }

  targetNode.parameters.jsCode = code2;
  const putRes = await req(
    { hostname: N8N_BASE, path: `/api/v1/workflows/${WF01_ID}`, method: 'PUT',
      headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' } },
    { name: wf01.name, nodes: wf01.nodes, connections: wf01.connections, settings: wf01.settings }
  );
  if (putRes.id) console.log('✅ WF01 deployed');
  else console.log('❌ Deploy error:', JSON.stringify(putRes).slice(0,200));
}
main().catch(console.error);
```

Crear el script en `C:/Users/noyag/deploy_wf01_demo.js` y ejecutar:

```bash
node "C:/Users/noyag/deploy_wf01_demo.js"
```

Expected: `✅ WF01 deployed`

### 8B: Deploy WF02

- [ ] **Step 2: Deploy WF02 con script existente**

```bash
node "C:/Users/noyag/deploy_fase_b.js"
```

Si el script no incluye WF02 solo, crear `deploy_wf02_demo.js` usando el mismo patrón que `deploy_wf01_demo.js` pero con `WF02_ID = 'la5XjIMeKIMoTa0q'` y `wf02_code.js`.

Expected: `✅ WF02 deployed`

### 8C: Deploy Dashboard

- [ ] **Step 3: Push dashboard a GitHub**

```bash
cd "C:\Users\noyag\Norberto-Documentos\consultorio-kit\dashboard"
git add -A
git commit -m "feat: add demos page + API routes for commercial demo sessions"
git push
```

Expected: GitHub Actions dispara build → imagen Docker → EasyPanel pull automático.

- [ ] **Step 4: Verificar build**

Ir a GitHub Actions del repo del dashboard. Esperar a que el build pase (≈3-5 min). Si falla, revisar logs de TypeScript.

---

## Task 9: Test End-to-End

### Test Flujo A (Presencial)

- [ ] **Step 1: Crear demo presencial desde dashboard**

1. Ir a `https://nexo-terra-consultorio-rivadavia-dashboard.6fwciw.easypanel.host/dashboard/demos`
2. Loguear como `admin@rivadavia.com`
3. Click "Nueva Demo" → completar: "Clínica Test", 15 turnos/día, 3 profesionales, tipo "presencial"
4. Copiar el código generado (ej: `DEMO-A7K3`) y el link WA

- [ ] **Step 2: Enviar código desde WhatsApp de prueba**

Enviar el código (ej: `DEMO-A7K3`) al número del bot (`+5491137936325`).

Expected:
- Bot responde con saludo presencial mencionando "Clínica Test"
- Envía los 5 mensajes de la didáctica (con pausas de ~1.2s entre ellos)
- Envía texto con ROI calculado: 15 × 22 = 330 turnos/mes, 50 perdidos, 40 recuperados, $1.782.000/mes
- Envía audio de Sofía con el closing script

- [ ] **Step 3: Responder "ME INTERESA"**

Expected:
- Bot responde "¡Genial! Carlos va a estar en contacto..."
- Llega notificación por Telegram al bot `nexoterra-bot` (chat 6343825256)
- Notificación incluye: clinic_name, turnos/día, profesionales, ROI, phone

### Test Flujo B (Remoto)

- [ ] **Step 4: Crear demo remoto desde dashboard**

Mismo flow pero:
- Tipo: "remoto"
- No completar datos (dejar que el bot los pida)

O crear demo remoto con datos: verificar que el bot los usa sin preguntar.

- [ ] **Step 5: Enviar código y responder preguntas**

Con demo remoto sin datos pre-cargados:
1. Enviar código
2. Bot pregunta "¿cómo se llama tu consultorio?"
3. Responder "Clínica Demo"
4. Bot pregunta turnos/día → responder "20"
5. Bot pregunta profesionales → responder "5"
6. Bot envía secuencia didáctica → ROI → audio

Expected: ROI calculado para 20 turnos/día: $2.376.000/mes

- [ ] **Step 6: Verificar expiración**

En Supabase, actualizar manualmente `expires_at` a una fecha pasada para una sesión activa. Intentar usar el código.

Expected: WF01 no detecta la sesión (expirada) → el mensaje llega a WF02 como texto normal en estado 'inicio' → bot responde con el flujo de demo estándar (no el cierre comercial).

---

## Spec de referencia

`docs/superpowers/specs/2026-05-20-demo-cierre-comercial-design.md`
