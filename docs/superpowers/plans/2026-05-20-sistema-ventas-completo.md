# Sistema de Ventas Automático — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el sistema en una máquina de ventas autónoma con 3 pasos: Dashboard (cargar prospecto) → WhatsApp DEMO (demostrar + ROI) → Vapi Sofía (cerrar por voz).

**Architecture:** Track [DEMO] = WF01-DEMO + WF02-DEMO + WF08-DEMO (copias de los originales) + WF09 compartido + tabla `consultorio_demo_sessions` + página `/dashboard/demos`. Track [PRODUCTO] = WFs originales pausados durante DEMO. La sesión DEMO-XXXX es el nexo de datos entre los tres pasos.

**Tech Stack:** Next.js 14 App Router (TypeScript), Supabase REST API, n8n Code nodes (JavaScript), ElevenLabs TTS, Vapi REST API, WhatsApp Cloud API.

---

## File Map

| Acción | Archivo |
|--------|---------|
| CREATE | `consultorio-kit/dashboard/app/api/demos/crear/route.ts` |
| CREATE | `consultorio-kit/dashboard/app/api/demos/route.ts` |
| CREATE | `consultorio-kit/dashboard/app/dashboard/demos/page.tsx` |
| CREATE | `consultorio-kit/dashboard/app/dashboard/demos/demos-client.tsx` |
| MODIFY | `consultorio-kit/dashboard/components/layout/sidebar.tsx` |
| CREATE | `C:/Users/noyag/wf01_demo_code2.js` — gateway DEMO (Code node 2 de WF01-DEMO) |
| CREATE | `C:/Users/noyag/wf02_demo_additions.js` — bloques a agregar a la copia de WF02 |
| CREATE | `C:/Users/noyag/wf08_demo_code.js` — WF08-DEMO completo (WF08 con cierre demo) |
| MODIFY | `C:/Users/noyag/wf09-code.js` — agregar obtenerContextoDemo |
| CREATE | `C:/Users/noyag/vapi_demo_patch.js` — PATCH Vapi assistant |
| CREATE | `onboarding-kit/` (backup — pasos manuales) |

---

## Task 0: Backup completo → onboarding-kit

**Files:**
- Create: `C:/Users/noyag/Norberto-Documentos/onboarding-kit/env-vars.md`
- Create: `C:/Users/noyag/Norberto-Documentos/onboarding-kit/README.md`

> Este task es 100% manual. El código no toca nada aquí — el backup protege el estado actual antes de crear los WFs DEMO.

- [ ] **Step 1: Crear carpeta onboarding-kit**

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\noyag\Norberto-Documentos\onboarding-kit\n8n"
New-Item -ItemType Directory -Force -Path "C:\Users\noyag\Norberto-Documentos\onboarding-kit\vapi"
New-Item -ItemType Directory -Force -Path "C:\Users\noyag\Norberto-Documentos\onboarding-kit\supabase"
```

Expected: 3 directorios creados.

- [ ] **Step 2: Exportar los 25 WFs de Consultorio desde n8n UI**

Ir a `https://nexo-terra-n8n.6fwciw.easypanel.host/` → para cada WF de la lista del spec (WF01-WF10 + todos los WF-DASH, WF-ADELANTO, WF-REMINDER, WF-CAMPANAS, WF-REACTIVACION, WF-CUMPLEANOS, WF-KEEPWARM, WF-MONTHLY-REPORT, NexoTerra Error Handler):
- Abrir el workflow
- Settings (⚙) → Download → guardarlo en `onboarding-kit/n8n/` con nombre descriptivo

- [ ] **Step 3: Exportar prompt de Sofía desde Vapi**

```powershell
$vapiKey = "5d4b0fe8-806e-4fd8-b8d1-7d122008820a"
$assistantId = "1f39b10f-72e9-4185-84e4-95a884b49436"
$response = Invoke-RestMethod -Uri "https://api.vapi.ai/assistant/$assistantId" -Headers @{ Authorization = "Bearer $vapiKey" }
$response.model.messages | Where-Object { $_.role -eq "system" } | Select-Object -ExpandProperty content | Out-File -FilePath "C:\Users\noyag\Norberto-Documentos\onboarding-kit\vapi\prompt.txt" -Encoding utf8
```

Expected: `onboarding-kit/vapi/prompt.txt` con el system prompt completo de Sofía.

- [ ] **Step 4: Exportar schema SQL de Supabase**

Ir a `https://supabase.com/dashboard/project/ebkvrhrpejegfpdodymd/editor` → SQL Editor → ejecutar:

```sql
SELECT 'CREATE TABLE ' || tablename || ' (' ||
  string_agg(column_name || ' ' || data_type ||
    CASE WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')' ELSE '' END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
    ', '
  ) || ');'
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name LIKE 'consultorio_%'
GROUP BY tablename
ORDER BY tablename;
```

Copiar el resultado y guardarlo en `onboarding-kit/supabase/schema.sql`.

- [ ] **Step 5: Git tag del dashboard**

```powershell
cd "C:\Users\noyag\Norberto-Documentos\consultorio-kit\dashboard"
git tag -a "backup-pre-ventas-2026-05-20" -m "Backup antes de implementar Sistema de Ventas"
```

Expected: tag creado sin error.

- [ ] **Step 6: Crear env-vars.md y README**

Crear `onboarding-kit/env-vars.md`:
```markdown
# Env Vars de n8n (EasyPanel) — Consultorio Inteligente

Lista de claves (sin valores — ver EasyPanel para los valores reales):

- META_WHATSAPP_TOKEN
- WA_PHONE_NUMBER_ID
- ANTHROPIC_API_KEY
- ELEVENLABS_API_KEY
- ELEVENLABS_VOICE_ID
- CONSULTORIO_SUPABASE_URL
- CONSULTORIO_SUPABASE_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- CONSULTORIO_NOMBRE
- CONSULTORIO_DIRECCION
- CONSULTORIO_HORARIO
- CONSULTORIO_TELEFONO
- CONSULTORIO_WA_NUMBER
- CONSULTORIO_OBRAS_SOCIALES
- CONSULTORIO_PRECIO_PARTICULAR
- CONSULTORIO_MAPS_LINK
- CONSULTORIO_GOOGLE_REVIEWS_URL
- CARLOS_WA_NUMBER
- WEBHOOK_URL
- N8N_HOST
- TELEGRAM_BOT_TOKEN (hardcodeado en código, pero registrar aquí)
- TELEGRAM_CHAT_ID (ídem)
```

- [ ] **Step 7: Commit backup**

```powershell
cd "C:\Users\noyag\Norberto-Documentos"
git add onboarding-kit/
git commit -m "backup: onboarding-kit pre-sistema-ventas 2026-05-20"
```

Expected: commit exitoso.

---

## Task 1: Supabase — CREATE TABLE consultorio_demo_sessions

**Files:**
- No hay archivos — SQL ejecutado directamente en Supabase

- [ ] **Step 1: Ejecutar migración en Supabase SQL Editor**

Ir a `https://supabase.com/dashboard/project/ebkvrhrpejegfpdodymd/editor` → SQL Editor → ejecutar:

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
  sueldo_secretaria INTEGER,
  tipo TEXT NOT NULL DEFAULT 'remoto' CHECK (tipo IN ('presencial', 'remoto')),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'usado', 'expirado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_demo_sessions_code ON consultorio_demo_sessions (code);
CREATE INDEX idx_demo_sessions_estado ON consultorio_demo_sessions (estado);

ALTER TABLE consultorio_demo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON consultorio_demo_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Verificar tabla creada**

Ir a Table Editor → buscar `consultorio_demo_sessions` → confirmar que aparece con todas las columnas.

- [ ] **Step 3: Commit**

```powershell
cd "C:\Users\noyag\Norberto-Documentos"
git add -A
git commit -m "feat(supabase): CREATE TABLE consultorio_demo_sessions"
```

---

## Task 2: Dashboard API — POST /api/demos/crear + GET /api/demos

**Files:**
- Create: `consultorio-kit/dashboard/app/api/demos/crear/route.ts`
- Create: `consultorio-kit/dashboard/app/api/demos/route.ts`

- [ ] **Step 1: Crear directorio**

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\noyag\Norberto-Documentos\consultorio-kit\dashboard\app\api\demos\crear"
```

- [ ] **Step 2: Crear `app/api/demos/crear/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'DEMO-'
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function calcROI(turnos_dia: number, precio_consulta: number, secretarias: number, sueldo_secretaria: number | null) {
  const turnos_mes = turnos_dia * 22
  const noshows_mes = Math.round(turnos_mes * 0.15)
  const recuperados_mes = Math.round(noshows_mes * 0.80)
  const roi_noshows = recuperados_mes * precio_consulta
  const sueldo_ref = sueldo_secretaria ?? 700000
  const ahorro_admin = Math.round(secretarias * sueldo_ref * 0.40)
  return { turnos_mes, noshows_mes, recuperados_mes, roi_noshows, ahorro_admin, roi_total: roi_noshows + ahorro_admin }
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { nombre_prospecto, clinic_name, turnos_dia, precio_consulta, profesionales, secretarias, sueldo_secretaria, tipo } = body

  if (!nombre_prospecto || !clinic_name || !turnos_dia || !precio_consulta || !profesionales || tipo === undefined) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Generate unique code (retry up to 5 times on collision)
  let code = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCode()
    const { data: existing } = await supabase
      .from('consultorio_demo_sessions')
      .select('code')
      .eq('code', candidate)
      .maybeSingle()
    if (!existing) { code = candidate; break }
  }
  if (!code) return NextResponse.json({ error: 'No se pudo generar código único' }, { status: 500 })

  const roi = calcROI(Number(turnos_dia), Number(precio_consulta), Number(secretarias ?? 0), sueldo_secretaria ? Number(sueldo_secretaria) : null)

  const expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('consultorio_demo_sessions')
    .insert({
      code,
      nombre_prospecto,
      clinic_name,
      turnos_dia: Number(turnos_dia),
      precio_consulta: Number(precio_consulta),
      profesionales: Number(profesionales),
      secretarias: Number(secretarias ?? 0),
      sueldo_secretaria: sueldo_secretaria ? Number(sueldo_secretaria) : null,
      tipo: tipo || 'remoto',
      estado: 'activo',
      expires_at,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data, roi })
}
```

- [ ] **Step 3: Crear `app/api/demos/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('consultorio_demo_sessions')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data ?? [] })
}
```

- [ ] **Step 4: Commit**

```powershell
cd "C:\Users\noyag\Norberto-Documentos"
git add consultorio-kit/dashboard/app/api/demos/
git commit -m "feat(dashboard): POST /api/demos/crear + GET /api/demos"
```

---

## Task 3: Dashboard — página /dashboard/demos

**Files:**
- Create: `consultorio-kit/dashboard/app/dashboard/demos/page.tsx`
- Create: `consultorio-kit/dashboard/app/dashboard/demos/demos-client.tsx`

- [ ] **Step 1: Crear directorio**

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\noyag\Norberto-Documentos\consultorio-kit\dashboard\app\dashboard\demos"
```

- [ ] **Step 2: Crear `app/dashboard/demos/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { DemosClient } from './demos-client'

export default async function DemosPage() {
  const supabase = createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch { redirect('/login') }
  if (!user) redirect('/login')
  if (getRole(user.user_metadata) !== 'dueno') redirect('/dashboard')

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: sessions } = await supabase
    .from('consultorio_demo_sessions')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Demos" subtitle="Sesiones de ventas con prospectos" />
      <div className="flex-1 overflow-y-auto p-6">
        <DemosClient initial={sessions ?? []} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear `app/dashboard/demos/demos-client.tsx`**

```typescript
'use client'
import { useState } from 'react'

interface DemoSession {
  id: string
  code: string
  nombre_prospecto: string
  clinic_name: string
  turnos_dia: number
  precio_consulta: number
  profesionales: number
  secretarias: number
  sueldo_secretaria: number | null
  tipo: 'presencial' | 'remoto'
  estado: 'activo' | 'usado' | 'expirado'
  created_at: string
  expires_at: string
}

function calcROI(s: DemoSession) {
  const turnos_mes = s.turnos_dia * 22
  const noshows_mes = Math.round(turnos_mes * 0.15)
  const recuperados_mes = Math.round(noshows_mes * 0.80)
  const roi_noshows = recuperados_mes * s.precio_consulta
  const sueldo_ref = s.sueldo_secretaria ?? 700000
  const ahorro_admin = Math.round(s.secretarias * sueldo_ref * 0.40)
  return roi_noshows + ahorro_admin
}

const fmtN = (n: number) => n.toLocaleString('es-AR')
const WA_NUMBER = '5491137936325'

export function DemosClient({ initial }: { initial: DemoSession[] }) {
  const [sessions, setSessions] = useState<DemoSession[]>(initial)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre_prospecto: '', clinic_name: '', turnos_dia: '', precio_consulta: '',
    profesionales: '', secretarias: '0', sueldo_secretaria: '', tipo: 'remoto'
  })
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/demos/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          turnos_dia: Number(form.turnos_dia),
          precio_consulta: Number(form.precio_consulta),
          profesionales: Number(form.profesionales),
          secretarias: Number(form.secretarias || 0),
          sueldo_secretaria: form.sueldo_secretaria ? Number(form.sueldo_secretaria) : null,
        })
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Error al crear demo'); return }
      setSessions(prev => [json.session, ...prev])
      setForm({ nombre_prospecto: '', clinic_name: '', turnos_dia: '', precio_consulta: '', profesionales: '', secretarias: '0', sueldo_secretaria: '', tipo: 'remoto' })
      setShowForm(false)
    } catch { setError('Error de red') } finally { setLoading(false) }
  }

  function copyLink(code: string) {
    const link = `https://wa.me/${WA_NUMBER}?text=${code}`
    navigator.clipboard.writeText(link)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const estadoBadge = (s: DemoSession) => {
    const expired = new Date(s.expires_at) < new Date()
    const estado = expired ? 'expirado' : s.estado
    const colors: Record<string, string> = { activo: 'bg-[#2ea043] text-white', usado: 'bg-[#1b3d8f] text-white', expirado: 'bg-[#3d444d] text-[#8b949e]' }
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colors[estado] || colors.expirado}`}>{estado}</span>
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-[#f0f6fc]">Sesiones de Demo</h2>
          <p className="text-xs text-[#8b949e] mt-0.5">Últimos 30 días</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="text-xs bg-[#1b3d8f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
          + Nueva Demo
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 mb-6 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Nombre del prospecto *</label>
            <input required value={form.nombre_prospecto} onChange={e => setForm(v => ({ ...v, nombre_prospecto: e.target.value }))}
              placeholder="Ej: María González" className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Nombre de la clínica *</label>
            <input required value={form.clinic_name} onChange={e => setForm(v => ({ ...v, clinic_name: e.target.value }))}
              placeholder="Ej: Consultorio San Martín" className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]" />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Turnos por día *</label>
            <input required type="number" min="1" value={form.turnos_dia} onChange={e => setForm(v => ({ ...v, turnos_dia: e.target.value }))}
              placeholder="Ej: 20" className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]" />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Precio por consulta ($) *</label>
            <input required type="number" min="1000" value={form.precio_consulta} onChange={e => setForm(v => ({ ...v, precio_consulta: e.target.value }))}
              placeholder="Ej: 40000" className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]" />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Profesionales *</label>
            <input required type="number" min="1" value={form.profesionales} onChange={e => setForm(v => ({ ...v, profesionales: e.target.value }))}
              placeholder="Ej: 3" className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]" />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Secretarias</label>
            <input type="number" min="0" value={form.secretarias} onChange={e => setForm(v => ({ ...v, secretarias: e.target.value }))}
              placeholder="0" className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]" />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Sueldo/secretaria (dejar vacío = $700.000)</label>
            <input type="number" min="0" value={form.sueldo_secretaria} onChange={e => setForm(v => ({ ...v, sueldo_secretaria: e.target.value }))}
              placeholder="700000" className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]" />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Tipo *</label>
            <select value={form.tipo} onChange={e => setForm(v => ({ ...v, tipo: e.target.value }))}
              className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]">
              <option value="remoto">Remoto (link por WA)</option>
              <option value="presencial">Presencial (Carlos da el teléfono)</option>
            </select>
          </div>
          {error && <p className="col-span-2 text-xs text-red-400">{error}</p>}
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-xs text-[#8b949e] hover:text-[#e6edf3] px-3 py-1.5">Cancelar</button>
            <button type="submit" disabled={loading} className="text-xs bg-[#1b3d8f] hover:bg-[#2563eb] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-semibold transition-colors">
              {loading ? 'Creando...' : 'Crear Demo'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {sessions.length === 0 && (
          <p className="text-xs text-[#8b949e] text-center py-8">No hay demos en los últimos 30 días.</p>
        )}
        {sessions.map(s => (
          <div key={s.id} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#4BA3F5] font-mono">{s.code}</span>
                {estadoBadge(s)}
                <span className="text-[10px] text-[#8b949e]">{s.tipo}</span>
              </div>
              <p className="text-xs text-[#f0f6fc] font-semibold mt-0.5 truncate">{s.nombre_prospecto} — {s.clinic_name}</p>
              <p className="text-[10px] text-[#8b949e] mt-0.5">
                {s.turnos_dia} turnos/día · ${fmtN(s.precio_consulta)}/consulta · {s.secretarias} secretaria{s.secretarias !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold text-[#2ea043]">${fmtN(calcROI(s))}/mes</p>
              <p className="text-[10px] text-[#8b949e]">ROI estimado</p>
            </div>
            <button onClick={() => copyLink(s.code)}
              className="text-[10px] bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0">
              {copied === s.code ? '✓ Copiado' : '📋 Link WA'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```powershell
cd "C:\Users\noyag\Norberto-Documentos"
git add consultorio-kit/dashboard/app/dashboard/demos/
git commit -m "feat(dashboard): página /dashboard/demos con form nueva demo y lista"
```

---

## Task 4: Sidebar — agregar "Demos"

**Files:**
- Modify: `consultorio-kit/dashboard/components/layout/sidebar.tsx`

- [ ] **Step 1: Agregar item al array NAV**

En `consultorio-kit/dashboard/components/layout/sidebar.tsx`, en el array `NAV` (línea 9), agregar después de `campanas`:

```typescript
// Buscar esta línea:
  { href: '/dashboard/campanas', label: 'Campañas', icon: '📣', roles: ['dueno'] as UserRole[] },

// Reemplazar con:
  { href: '/dashboard/campanas', label: 'Campañas', icon: '📣', roles: ['dueno'] as UserRole[] },
  { href: '/dashboard/demos', label: 'Demos', icon: '🎯', roles: ['dueno'] as UserRole[] },
```

- [ ] **Step 2: Commit**

```powershell
cd "C:\Users\noyag\Norberto-Documentos"
git add consultorio-kit/dashboard/components/layout/sidebar.tsx
git commit -m "feat(dashboard): agregar Demos al sidebar (solo dueno)"
```

---

## Task 5: WF01-DEMO — código gateway con detección DEMO-XXXX

**Files:**
- Create: `C:/Users/noyag/wf01_demo_code2.js`

Este archivo reemplaza el Code node 2 de WF01-DEMO (el nodo que carga la conversación). WF01-DEMO debe ser creado en n8n UI (duplicar WF01) antes de deployar el código.

- [ ] **Step 1: Crear WF01-DEMO en n8n UI**

1. Ir a n8n → abrir `WF01 Gateway WhatsApp` → Settings → Duplicate
2. Renombrar la copia a `[DEMO] WF01 Gateway`
3. **IMPORTANTE**: el nodo Execute Workflow que llama a WF02 debe apuntar a WF02-DEMO (se hará en Task 6 después de crear WF02-DEMO)
4. Anotar el ID del nuevo workflow (está en la URL: `/workflow/XXXXXXXXXX`)

- [ ] **Step 2: Crear `C:/Users/noyag/wf01_demo_code2.js`**

```javascript
const SUPABASE_URL = $env.CONSULTORIO_SUPABASE_URL;
const SUPABASE_KEY = $env.CONSULTORIO_SUPABASE_KEY;
const CARLOS_WA_NUMBER = $env.CARLOS_WA_NUMBER || '541130875304';
const phone = $input.first().json.phone;
const msgData = $input.first().json;
const texto = (msgData.texto || msgData.text || '').trim().toUpperCase();

// Detectar código DEMO-XXXX
const demoMatch = texto.match(/^(DEMO-[A-Z0-9]{4})$/);

if (demoMatch) {
  const demoCode = demoMatch[1];
  let demoSession = null;
  try {
    const res = await this.helpers.httpRequest({
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/consultorio_demo_sessions`,
      qs: { code: `eq.${demoCode}`, estado: 'eq.activo', limit: '1' },
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    demoSession = res?.[0] || null;
  } catch(e) {}

  if (demoSession && new Date(demoSession.expires_at) > new Date()) {
    const esPresencial = (phone === CARLOS_WA_NUMBER);
    const demoCtx = {
      demo_session: demoCode,
      demo_session_id: demoSession.id,
      es_presencial: esPresencial,
      nombre_prospecto: demoSession.nombre_prospecto,
      clinic_name: demoSession.clinic_name,
      turnos_dia: demoSession.turnos_dia,
      precio_consulta: demoSession.precio_consulta,
      profesionales: demoSession.profesionales,
      secretarias: demoSession.secretarias,
      sueldo_secretaria: demoSession.sueldo_secretaria
    };

    // Upsert conversación al estado demo_prospecto_init
    let conv = null;
    try {
      const existing = await this.helpers.httpRequest({
        method: 'GET',
        url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
        qs: { telefono_wa: `eq.${phone}`, limit: '1' },
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      conv = existing?.[0] || null;
    } catch(e) {}

    if (conv) {
      try {
        await this.helpers.httpRequest({
          method: 'PATCH',
          url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
          qs: { telefono_wa: `eq.${phone}` },
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'demo_prospecto_init', contexto: demoCtx, handoff_humano: false, updated_at: new Date().toISOString() })
        });
      } catch(e) {}
    } else {
      try {
        const res = await this.helpers.httpRequest({
          method: 'POST',
          url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify({ telefono_wa: phone, estado: 'demo_prospecto_init', contexto: demoCtx, handoff_humano: false })
        });
        conv = res?.[0] || null;
      } catch(e) {}
    }

    return [{ json: {
      ...msgData,
      convEstado: 'demo_prospecto_init',
      convContexto: demoCtx,
      convHandoff: false,
      convId: conv?.id
    }}];
  }
  // Código inválido o expirado — caer al flujo normal
}

// Flujo normal: cargar conversación existente
let conv = null;
try {
  const res = await this.helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
    qs: { telefono_wa: `eq.${phone}`, limit: '1' },
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  conv = res?.[0] || null;
} catch(err) {}

if (!conv) {
  try {
    const res = await this.helpers.httpRequest({
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ telefono_wa: phone, estado: 'inicio', contexto: {}, handoff_humano: false })
    });
    conv = res?.[0] || { estado: 'inicio', contexto: {}, handoff_humano: false };
  } catch(err) {
    conv = { estado: 'inicio', contexto: {}, handoff_humano: false };
  }
}

// Resetear sesión expirada (30 min sin actividad)
const lastUpdate = new Date(conv.updated_at || 0);
const diffMin = (Date.now() - lastUpdate) / 60000;
if (diffMin > 30 && conv.estado !== 'inicio' && !conv.handoff_humano) {
  conv.estado = 'inicio'; conv.contexto = {};
  try {
    await this.helpers.httpRequest({
      method: 'PATCH',
      url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,
      qs: { telefono_wa: `eq.${phone}` },
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'inicio', contexto: {}, updated_at: new Date().toISOString() })
    });
  } catch(err) {}
}

return [{ json: {
  ...msgData,
  convEstado: conv.estado,
  convContexto: conv.contexto || {},
  convHandoff: conv.handoff_humano || false,
  convId: conv.id
}}];
```

- [ ] **Step 3: Pegar el código en el nodo code2 de WF01-DEMO**

1. Abrir `[DEMO] WF01 Gateway` en n8n
2. Abrir el nodo Code correspondiente a `WF01_GATEWAY_code2` (segundo nodo Code)
3. Reemplazar el contenido completo con el código de `wf01_demo_code2.js`
4. Guardar el workflow

- [ ] **Step 4: Commit**

```powershell
cd "C:\Users\noyag\Norberto-Documentos"
git add C:/Users/noyag/wf01_demo_code2.js 2>/dev/null; true
cd "C:\Users\noyag"
git add wf01_demo_code2.js 2>/dev/null; true
```

*Nota: los archivos `.js` locales se trackan en el repo de Norberto-Documentos via git si están en la carpeta. Si no están en el repo, commitear solo los archivos del dashboard.*

---

## Task 6: WF02-DEMO — estados demo_prospecto_init + demo_prospecto_preguntas

**Files:**
- Create: `C:/Users/noyag/wf02_demo_additions.js` — los bloques a agregar a la copia de WF02

WF02-DEMO = copia de WF02 con 3 cambios:
1. **Cambio de ruta de booking**: `consultorio-turnos` → `consultorio-turnos-demo` en la URL del link de turnos
2. **Función `sendDemoCierre`** (ver Task 7 — se agrega en WF08-DEMO, no aquí)
3. **Estados nuevos** `demo_prospecto_init` y `demo_prospecto_preguntas`

- [ ] **Step 1: Crear WF02-DEMO en n8n UI**

1. n8n → abrir `WF02 Bot Conversacional` → Settings → Duplicate
2. Renombrar a `[DEMO] WF02 Bot`
3. Anotar el ID del nuevo workflow
4. En WF01-DEMO: abrir el nodo Execute Workflow → cambiar el workflow target al ID de WF02-DEMO

- [ ] **Step 2: Cambiar ruta de booking en WF02-DEMO**

En el Code node de WF02-DEMO, buscar la función `mostrarDias` que contiene el URL del booking. Buscar la cadena `/webhook/consultorio-turnos?token=` y cambiarla por `/webhook/consultorio-turnos-demo?token=`.

También buscar `consultorio-turnos?token=` en la función `triggerWaitlist` (si existe) y en `esperando_booking_web` y aplicar el mismo reemplazo.

En el Code node de WF02-DEMO, hacer el reemplazo global:
```
Buscar:   /webhook/consultorio-turnos?token=
Reemplazar: /webhook/consultorio-turnos-demo?token=
```

- [ ] **Step 3: Agregar estados demo_prospecto_init + demo_prospecto_preguntas**

En el Code node de WF02-DEMO, buscar esta línea (alrededor de línea 691):
```javascript
// --- DEMO FAQ MODE (post-showcase) ---
if (estado === 'demo_faq_mode') {
```

Insertar el siguiente bloque **ANTES** de esa línea:

```javascript
// --- DEMO PROSPECTO STATES ---
if (estado === 'demo_prospecto_init') {
  const hasAllData = ctx.nombre_prospecto && ctx.clinic_name && ctx.turnos_dia && ctx.precio_consulta;
  if (hasAllData) {
    const firstName = (ctx.nombre_prospecto || '').split(' ')[0];
    await updateConv(phone, 'esperando_dni', ctx); // preservar ctx con demo_session
    await sendText(phone,
      `¡Hola ${firstName}! 👋\n\nTe voy a mostrar cómo funciona el sistema con los datos reales de *${ctx.clinic_name}*.\n\n` +
      `El flujo que vas a vivir es exactamente el mismo que verían tus pacientes.\n\n` +
      `Para arrancar, ingresá cualquier número de 7 u 8 dígitos _(en producción el paciente ingresaría su DNI)_.`,
      'esperando_dni', true
    );
    return [{ json: { action: 'demo_prospecto_init_ok', phone } }];
  }
  // Faltan datos — iniciar preguntas
  await updateConv(phone, 'demo_prospecto_preguntas', { ...ctx, preg_step: 1 });
  await sendText(phone, `¡Hola! 👋 Para mostrarte la demo con tus números reales, necesito unos datos.\n\n¿Cómo te llamás?`, 'demo_prospecto_preguntas', true);
  return [{ json: { action: 'demo_prospecto_init_preguntas', phone } }];
}

if (estado === 'demo_prospecto_preguntas') {
  const step = ctx.preg_step || 1;

  if (step === 1) {
    ctx.nombre_prospecto = texto.trim();
    ctx.preg_step = 2;
    await updateConv(phone, 'demo_prospecto_preguntas', ctx);
    await sendText(phone, '¿Cuál es el nombre de tu consultorio o clínica?', 'demo_prospecto_preguntas', true);
    return [{ json: { action: 'demo_preg_nombre', phone } }];
  }
  if (step === 2) {
    ctx.clinic_name = texto.trim();
    ctx.preg_step = 3;
    await updateConv(phone, 'demo_prospecto_preguntas', ctx);
    await sendText(phone, '¿Cuántos turnos por día manejan? _(solo el número)_', 'demo_prospecto_preguntas', true);
    return [{ json: { action: 'demo_preg_clinica', phone } }];
  }
  if (step === 3) {
    const n = parseInt(texto.replace(/\D/g, ''), 10);
    if (!n || n < 1 || n > 999) {
      await updateConv(phone, 'demo_prospecto_preguntas', ctx);
      await sendText(phone, 'Escribí solo el número de turnos por día (ej: 20).', 'demo_prospecto_preguntas', true);
      return [{ json: { action: 'demo_preg_turnos_retry', phone } }];
    }
    ctx.turnos_dia = n; ctx.preg_step = 4;
    await updateConv(phone, 'demo_prospecto_preguntas', ctx);
    await sendText(phone, '¿Cuánto cobra cada consulta? _(en pesos, sin puntos — ej: 40000)_', 'demo_prospecto_preguntas', true);
    return [{ json: { action: 'demo_preg_turnos', phone } }];
  }
  if (step === 4) {
    const p = parseInt(texto.replace(/\D/g, ''), 10);
    if (!p || p < 500) {
      await updateConv(phone, 'demo_prospecto_preguntas', ctx);
      await sendText(phone, 'Escribí el precio en pesos, sin puntos (ej: 40000).', 'demo_prospecto_preguntas', true);
      return [{ json: { action: 'demo_preg_precio_retry', phone } }];
    }
    ctx.precio_consulta = p; ctx.preg_step = 5;
    await updateConv(phone, 'demo_prospecto_preguntas', ctx);
    await sendButtons(phone, '¿Tienen secretaria o recepcionista que atiende el teléfono?', [{ id: 'ds_sec_si', title: 'Sí' }, { id: 'ds_sec_no', title: 'No' }]);
    return [{ json: { action: 'demo_preg_precio', phone } }];
  }
  if (step === 5) {
    const noSec = btnId === 'ds_sec_no' || texto.toLowerCase().startsWith('no');
    if (noSec) {
      ctx.secretarias = 0; ctx.sueldo_secretaria = null; ctx.preg_step = 0;
      await updateConv(phone, 'esperando_dni', ctx);
      await sendText(phone,
        `Perfecto. Ahora sí — te muestro cómo funciona el sistema con los datos reales de *${ctx.clinic_name}*.\n\n` +
        `Para arrancar, ingresá cualquier número de 7 u 8 dígitos.`,
        'esperando_dni', true
      );
      return [{ json: { action: 'demo_preg_done_no_sec', phone } }];
    }
    ctx.preg_step = 6;
    await updateConv(phone, 'demo_prospecto_preguntas', ctx);
    await sendText(phone, '¿Cuántas secretarias? _(número)_', 'demo_prospecto_preguntas', true);
    return [{ json: { action: 'demo_preg_sec_si', phone } }];
  }
  if (step === 6) {
    const n = parseInt(texto.replace(/\D/g, ''), 10);
    if (!n || n < 1) {
      await updateConv(phone, 'demo_prospecto_preguntas', ctx);
      await sendText(phone, 'Escribí el número de secretarias.', 'demo_prospecto_preguntas', true);
      return [{ json: { action: 'demo_preg_sec_count_retry', phone } }];
    }
    ctx.secretarias = n; ctx.preg_step = 7;
    await updateConv(phone, 'demo_prospecto_preguntas', ctx);
    await sendText(phone, '¿Sabés cuánto pagan por mes cada una? _(podés escribir "no sé" y usamos un promedio)_', 'demo_prospecto_preguntas', true);
    return [{ json: { action: 'demo_preg_sec_count', phone } }];
  }
  if (step === 7) {
    const noSabe = /no\s*s[eé]/i.test(texto);
    ctx.sueldo_secretaria = noSabe ? null : (parseInt(texto.replace(/\D/g, ''), 10) || null);
    ctx.preg_step = 0;
    await updateConv(phone, 'esperando_dni', ctx);
    await sendText(phone,
      `Perfecto. Ahora sí — te muestro cómo funciona el sistema con los datos reales de *${ctx.clinic_name}*.\n\n` +
      `Para arrancar, ingresá cualquier número de 7 u 8 dígitos.`,
      'esperando_dni', true
    );
    return [{ json: { action: 'demo_preg_done', phone } }];
  }
  // Step desconocido → reiniciar
  await updateConv(phone, 'demo_prospecto_preguntas', { ...ctx, preg_step: 1 });
  await sendText(phone, '¿Cómo te llamás?', 'demo_prospecto_preguntas', true);
  return [{ json: { action: 'demo_preg_restart', phone } }];
}

if (estado === 'demo_completado') {
  await sendText(phone, '¿Tenés alguna otra pregunta sobre el sistema? Para continuar, hablás con Carlos. 😊', 'demo_completado', true);
  await updateConv(phone, 'demo_completado', ctx);
  return [{ json: { action: 'demo_completado_msg', phone } }];
}
// --- FIN DEMO PROSPECTO STATES ---
```

- [ ] **Step 4: Guardar el workflow en n8n**

Guardar el Code node y el workflow completo.

---

## Task 7: WF08-DEMO — código completo con cierre post-booking

**Files:**
- Create: `C:/Users/noyag/wf08_demo_code.js`

WF08-DEMO = copia de WF08 con:
1. Webhook path cambiado a `/webhook/consultorio-turnos-demo`
2. Al confirmar booking: si `ctx.demo_session` → preservar contexto + ir a `demo_prospecto_cierre` → enviar ROI + audio + Telegram + mensaje final

- [ ] **Step 1: Crear WF08-DEMO en n8n UI**

1. n8n → abrir `WF08 Selector Turnos Web` → Settings → Duplicate
2. Renombrar a `[DEMO] WF08 Selector Turnos`
3. En el nodo Webhook trigger: cambiar el path de `consultorio-turnos` a `consultorio-turnos-demo`
4. Anotar el ID del nuevo workflow

- [ ] **Step 2: Crear `C:/Users/noyag/wf08_demo_code.js`**

Copiar el contenido de `wf08_code.js` y aplicar estos cambios en el bloque `// === CONFIRMAR ===` (alrededor de línea 68-97):

Reemplazar el bloque:
```javascript
// === CONFIRMAR ===
if (action === 'confirmar' && slotParam) {
  const slotIso = decodeURIComponent(slotParam);
  await supaInsert('consultorio_turnos',{paciente_id:ctx.pacienteId,profesional_id:ctx.profesionalId,fecha_hora:slotIso,estado:'agendado',tipo_pago:ctx.obraSocial?'obra_social':'particular'});
  await supaUpdate('consultorio_conversaciones',{telefono_wa:`eq.${conv.telefono_wa}`},{estado:'demo_faq_mode',contexto:{}});
```

Por:
```javascript
// === CONFIRMAR ===
if (action === 'confirmar' && slotParam) {
  const slotIso = decodeURIComponent(slotParam);
  await supaInsert('consultorio_turnos',{paciente_id:ctx.pacienteId,profesional_id:ctx.profesionalId,fecha_hora:slotIso,estado:'agendado',tipo_pago:ctx.obraSocial?'obra_social':'particular'});

  // Si hay sesión demo → preservar contexto y estado demo_prospecto_cierre
  const isDemoSession = !!(ctx.demo_session);
  const nextEstado = isDemoSession ? 'demo_prospecto_cierre' : 'demo_faq_mode';
  const nextCtx = isDemoSession ? {
    demo_session: ctx.demo_session,
    demo_session_id: ctx.demo_session_id,
    nombre_prospecto: ctx.nombre_prospecto,
    clinic_name: ctx.clinic_name,
    turnos_dia: ctx.turnos_dia,
    precio_consulta: ctx.precio_consulta,
    profesionales: ctx.profesionales,
    secretarias: ctx.secretarias,
    sueldo_secretaria: ctx.sueldo_secretaria
  } : {};
  await supaUpdate('consultorio_conversaciones',{telefono_wa:`eq.${conv.telefono_wa}`},{estado: nextEstado, contexto: nextCtx});
```

Y después del bloque que envía el mensaje de showcase (después de `return [{json:{html:sucPg(prof,fec,hr)}}];`), insertar la lógica de cierre. En realidad, el cierre debe enviarse ANTES del return. Reemplazar el return con:

```javascript
  // Showcase (igual para demo y demo prospecto)
  await sendText(conv.telefono_wa,
    `✨ *Esto es lo que pasa automáticamente a partir de acá:*\n\n` +
    `📩 *24hs antes del turno* — el paciente recibe un recordatorio por WhatsApp y confirma con un botón.\n` +
    `⚡ *Si no confirma* — el turno se ofrece a la lista de espera. Agenda siempre llena.\n` +
    `🩺 *Después de la consulta* — el sistema le pregunta cómo le fue y le manda el link de Google para dejar una reseña.\n` +
    `📊 *En tu dashboard* — métricas de confirmaciones, cancelaciones y no-shows en tiempo real.\n\n` +
    `_Todo esto sin que hagas nada._ 👆`
  );

  // Si es sesión de prospecto → enviar cierre ROI + audio + Telegram
  if (isDemoSession) {
    await sendDemoProspectoCierre(conv.telefono_wa, nextCtx);
    await supaUpdate('consultorio_conversaciones',{telefono_wa:`eq.${conv.telefono_wa}`},{estado:'demo_completado', contexto: nextCtx});
  }

  return [{json:{html:sucPg(prof,fec,hr)}}];
```

Y agregar la función `sendDemoProspectoCierre` al inicio del archivo, después de las funciones `sendCTAUrl` y `sendText`:

```javascript
async function sendDemoProspectoCierre(phone, ds) {
  const turnos_mes = ds.turnos_dia * 22;
  const noshows_mes = Math.round(turnos_mes * 0.15);
  const recuperados_mes = Math.round(noshows_mes * 0.80);
  const roi_noshows = recuperados_mes * ds.precio_consulta;
  const sueldo_ref = ds.sueldo_secretaria || 700000;
  const ahorro_admin = Math.round((ds.secretarias || 0) * sueldo_ref * 0.40);
  const roi_total = roi_noshows + ahorro_admin;
  const fmtN = n => n.toLocaleString('es-AR');

  // 1. Texto ROI
  let roiMsg =
    `📊 *Lo que pasa hoy en tu clínica:*\n\n` +
    `• Turnos por mes: ${fmtN(turnos_mes)}\n` +
    `• No-shows estimados (15%): ${fmtN(noshows_mes)} turnos que se pierden\n` +
    `• Ingreso que no llega: $${fmtN(roi_noshows)}/mes\n\n` +
    `💼 Tu secretaria dedica ~40% de su tiempo a llamar, confirmar y recordar turnos manualmente.\n\n` +
    `✅ *Lo que cambia con el sistema:*\n` +
    `• ${recuperados_mes} turnos recuperados por mes ($${fmtN(roi_noshows)})\n`;
  if (ahorro_admin > 0) roiMsg += `• Tu secretaria se libera del teléfono ($${fmtN(ahorro_admin)}/mes en tiempo recuperado)\n`;
  roiMsg += `\n💰 *Impacto estimado: $${fmtN(roi_total)}/mes*`;
  await sendText(phone, roiMsg);

  // 2. Audio PAS (ElevenLabs TTS → WhatsApp)
  const script =
    `Hola. Lo que acabás de ver no es solo un sistema de turnos. ` +
    `Cada mes, sin saberlo, tu clínica está perdiendo ${fmtN(noshows_mes)} consultas. ` +
    `Pacientes que confirmaron, que tenían turno, que no aparecieron — y nadie los llamó, nadie los reactivó. ` +
    `A ${fmtN(ds.precio_consulta)} pesos por consulta, eso son ${fmtN(roi_noshows)} pesos que se van solos, todos los meses. ` +
    (ahorro_admin > 0
      ? `Y además, tu secretaria está dedicando casi la mitad de su día a atender el teléfono, confirmar turnos, mandar recordatorios a mano — cuando podría estar con los pacientes, o siendo más efectiva en otras áreas del consultorio. `
      : '') +
    `El sistema hace todo eso solo. Confirma, recuerda, llena huecos en la agenda, reactiva pacientes que no vienen hace meses. ` +
    `Las veinticuatro horas, los siete días de la semana. ` +
    `Los números que te acabo de mostrar son los tuyos — calculados con los datos de tu clínica. ` +
    `Para saber cómo arrancar, hablás con Carlos.`;

  // TTS ElevenLabs → upload WA → send audio
  // (reusar el mismo patrón de sendAudio del WF02)
  try {
    const voiceId = $env.ELEVENLABS_VOICE_ID;
    const mp3Binary = await this.helpers.httpRequest({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: { 'xi-api-key': $env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: script, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      encoding: 'arraybuffer'
    });
    const mp3Buf = Buffer.isBuffer(mp3Binary) ? mp3Binary
                 : mp3Binary instanceof ArrayBuffer ? Buffer.from(mp3Binary)
                 : typeof mp3Binary === 'string' ? Buffer.from(mp3Binary, 'binary')
                 : Buffer.from(mp3Binary);

    const { execSync } = require('child_process');
    const fs = require('fs');
    const crypto = require('crypto');
    const rand = crypto.randomBytes(8).toString('hex');
    const tmpMp3 = `/tmp/demo_cierre_${rand}.mp3`;
    const tmpScript = `/tmp/wa_upload_demo_${rand}.js`;
    fs.writeFileSync(tmpMp3, mp3Buf);
    const uploadScript = [
      `const https=require('https'),fs=require('fs');`,
      `const buf=fs.readFileSync(${JSON.stringify(tmpMp3)});`,
      `const token=process.env.WA_TOKEN,phoneId=process.env.PHONE_ID;`,
      `const bd='FB'+Date.now();`,
      `const body=Buffer.concat([`,
      `  Buffer.from('--'+bd+'\\r\\nContent-Disposition: form-data; name="messaging_product"\\r\\n\\r\\nwhatsapp\\r\\n'),`,
      `  Buffer.from('--'+bd+'\\r\\nContent-Disposition: form-data; name="type"\\r\\n\\r\\naudio/mpeg\\r\\n'),`,
      `  Buffer.from('--'+bd+'\\r\\nContent-Disposition: form-data; name="file"; filename="cierre.mp3"\\r\\nContent-Type: audio/mpeg\\r\\n\\r\\n'),`,
      `  buf,Buffer.from('\\r\\n--'+bd+'--\\r\\n')`,
      `]);`,
      `const r=https.request({hostname:'graph.facebook.com',path:'/v21.0/'+phoneId+'/media',method:'POST',`,
      `  headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/form-data; boundary='+bd,'Content-Length':body.length}`,
      `},(res)=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>process.stdout.write(Buffer.concat(c).toString('utf8')));});`,
      `r.on('error',e=>{process.stderr.write(e.message);process.exit(1);});r.write(body);r.end();`
    ].join('\n');
    fs.writeFileSync(tmpScript, uploadScript);
    let waMediaId;
    try {
      const out = execSync(`node ${tmpScript}`, {
        encoding: 'utf8', timeout: 20000,
        env: { WA_TOKEN: WA_TOKEN, PHONE_ID: PHONE_ID, PATH: '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin' }
      });
      const parsed = JSON.parse(out);
      if (!parsed?.id) throw new Error('No media ID: ' + out.substring(0, 80));
      waMediaId = parsed.id;
    } finally {
      try { fs.unlinkSync(tmpMp3); } catch(e2) {}
      try { fs.unlinkSync(tmpScript); } catch(e2) {}
    }
    await this.helpers.httpRequest({
      method: 'POST',
      url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'audio', audio: { id: waMediaId } })
    });
  } catch(e) {
    // Fallback a texto si el audio falla
    await this.helpers.httpRequest({
      method: 'POST',
      url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: script } })
    });
  }

  // 3. Telegram a Carlos
  try {
    await this.helpers.httpRequest({
      method: 'POST',
      url: `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: `🔥 <b>Prospecto terminó la demo</b>\n\nNombre: ${ds.nombre_prospecto}\nClínica: ${ds.clinic_name}\nTurnos/día: ${ds.turnos_dia} · Precio: $${fmtN(ds.precio_consulta)} · Secretarias: ${ds.secretarias || 0}\nROI no-shows: $${fmtN(roi_noshows)}/mes\nAhorro admin: $${fmtN(ahorro_admin)}/mes\nROI total: $${fmtN(roi_total)}/mes\n\nWhatsApp: ${phone}`,
        parse_mode: 'HTML'
      })
    });
  } catch(e) {}

  // 4. Mensaje final
  await sendText(phone, `¡Eso es todo! 😊 *Pasale el teléfono a Carlos* para continuar — él te explica los próximos pasos.`);
}
```

- [ ] **Step 3: Pegar el código en el Code node de WF08-DEMO**

1. Abrir `[DEMO] WF08 Selector Turnos` en n8n
2. Abrir el Code node principal
3. Reemplazar con el código de `wf08_demo_code.js`
4. Guardar

> **Nota:** `WA_TOKEN`, `PHONE_ID`, `TG_BOT_TOKEN`, `TG_CHAT_ID` deben estar disponibles en el scope del Code node de WF08 (son las mismas variables que usa WF08 original — verificar que el nodo las define al inicio del código).

- [ ] **Step 4: Commit**

```powershell
cd "C:\Users\noyag\Norberto-Documentos"
git add -A
git commit -m "feat(wf-demo): WF01-DEMO + WF02-DEMO + WF08-DEMO código completo"
```

---

## Task 8: WF09 — agregar tool obtenerContextoDemo

**Files:**
- Modify: `C:/Users/noyag/wf09-code.js`

- [ ] **Step 1: Agregar handler `obtenerContextoDemo` en wf09-code.js**

En `C:/Users/noyag/wf09-code.js`, en el bloque `try { if (functionName === 'consultarInfo') { ... }` , agregar al final (antes del `return [{ json: { toolCallId, result: \`Tool ${functionName} no reconocida.\` } }]`):

```javascript
  if (functionName === 'obtenerContextoDemo') {
    // Fetch la sesión demo más reciente activa
    const sessions = await supaGet('consultorio_demo_sessions', {
      estado: 'eq.activo',
      order: 'created_at.desc',
      limit: '1',
      select: 'nombre_prospecto,clinic_name,turnos_dia,precio_consulta,profesionales,secretarias,sueldo_secretaria'
    });
    if (!sessions?.length) {
      return [{ json: { toolCallId, result: 'No hay sesión de prospecto activa. Operá en modo normal.' } }];
    }
    const ds = sessions[0];
    const turnos_mes = ds.turnos_dia * 22;
    const noshows_mes = Math.round(turnos_mes * 0.15);
    const recuperados_mes = Math.round(noshows_mes * 0.80);
    const roi_noshows = recuperados_mes * ds.precio_consulta;
    const sueldo_ref = ds.sueldo_secretaria || 700000;
    const ahorro_admin = Math.round((ds.secretarias || 0) * sueldo_ref * 0.40);
    const roi_total = roi_noshows + ahorro_admin;
    const fmtN = n => n.toLocaleString('es-AR');

    return [{ json: {
      toolCallId,
      result: [
        `CONTEXTO DEL PROSPECTO:`,
        `Nombre: ${ds.nombre_prospecto}`,
        `Clínica: ${ds.clinic_name}`,
        `Turnos/día: ${ds.turnos_dia} | Precio consulta: $${fmtN(ds.precio_consulta)}`,
        `Profesionales: ${ds.profesionales} | Secretarias: ${ds.secretarias || 0}`,
        `ROI calculado: $${fmtN(roi_total)}/mes (no-shows: $${fmtN(roi_noshows)} + ahorro admin: $${fmtN(ahorro_admin)})`,
        ``,
        `Saludá a ${ds.nombre_prospecto} por nombre inmediatamente. No repitas el ROI — ya lo vio. Preguntá qué le pareció la demo y qué dudas le quedaron.`
      ].join('\n')
    }}];
  }
```

- [ ] **Step 2: Deployar WF09 actualizado vía n8n API**

```powershell
$n8nToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZjMGUyNmM2LWI5OGItNGZhOC1iZDQ3LTQ4NTBhNDYxNjlmOSIsImVtYWlsIjoibm9yYmk0MDUwQGdtYWlsLmNvbSIsImlhdCI6MTc0NzY4NTQ4MCwiZXhwIjoxNzUwMjc3NDgwfQ.V3uOdlN1-H4UfVPHIGnlLaJ4gFJI8A-_-9Sj7qhDzSA"
$wf09Id = "c0m8vnnubPQSGnTe"
$n8nBase = "https://nexo-terra-n8n.6fwciw.easypanel.host"

# Fetch workflow actual
$wf = Invoke-RestMethod -Uri "$n8nBase/api/v1/workflows/$wf09Id" -Headers @{ "X-N8N-API-KEY" = $n8nToken }

# Leer código actualizado
$newCode = Get-Content "C:\Users\noyag\wf09-code.js" -Raw

# Actualizar el nodo Code (buscar por nombre o tipo)
$codeNode = $wf.nodes | Where-Object { $_.type -eq "n8n-nodes-base.code" } | Select-Object -First 1
if ($codeNode) {
  $codeNode.parameters.jsCode = $newCode
  $body = $wf | ConvertTo-Json -Depth 20
  Invoke-RestMethod -Uri "$n8nBase/api/v1/workflows/$wf09Id" -Method PUT -Headers @{ "X-N8N-API-KEY" = $n8nToken; "Content-Type" = "application/json" } -Body $body
  Write-Host "WF09 actualizado OK"
} else {
  Write-Host "ERROR: No se encontró nodo Code en WF09"
}
```

Expected: `WF09 actualizado OK`

- [ ] **Step 3: Commit**

```powershell
cd "C:\Users\noyag\Norberto-Documentos"
git add C:/Users/noyag/wf09-code.js 2>/dev/null; true
git commit -m "feat(wf09): agregar tool obtenerContextoDemo para MODO VENDEDORA"
```

---

## Task 9: Vapi — PATCH assistant con MODO VENDEDORA + tool obtenerContextoDemo

**Files:**
- Create: `C:/Users/noyag/vapi_demo_patch.js`

- [ ] **Step 1: Crear tool `obtenerContextoDemo` en Vapi**

```javascript
// vapi_demo_patch.js
const https = require('https');

const VAPI_KEY = '5d4b0fe8-806e-4fd8-b8d1-7d122008820a';
const ASSISTANT_ID = '1f39b10f-72e9-4185-84e4-95a884b49436';
const WF09_WEBHOOK = 'https://nexo-terra-n8n.6fwciw.easypanel.host/webhook/vapi-consultorio-tools';
const SECRET_KEY = 'NT2026-vapi-s3cur3-k3y';

async function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.vapi.ai', path, method,
      headers: {
        'Authorization': `Bearer ${VAPI_KEY}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // 1. Crear la tool obtenerContextoDemo
  console.log('Creando tool obtenerContextoDemo...');
  const tool = await apiCall('POST', '/tool', {
    type: 'function',
    function: {
      name: 'obtenerContextoDemo',
      description: 'Obtiene el contexto del prospecto activo (nombre, clínica, ROI). Llamar al inicio de cada llamada para saber si hay un prospecto esperando.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    server: {
      url: WF09_WEBHOOK,
      secret: SECRET_KEY
    }
  });
  console.log('Tool creada:', tool.id);

  // 2. Fetch assistant actual para obtener tools y system prompt actuales
  console.log('Fetching assistant...');
  const assistant = await apiCall('GET', `/assistant/${ASSISTANT_ID}`);
  const currentTools = assistant.model?.toolIds || [];
  const currentMessages = assistant.model?.messages || [];
  const systemMsg = currentMessages.find(m => m.role === 'system');

  // 3. Agregar sección MODO VENDEDORA al system prompt
  const modoVendedora = `

## MODO VENDEDORA

Al inicio de cada llamada, llamá obtenerContextoDemo para ver si hay un prospecto activo.

Si la tool devuelve datos de prospecto:
- Saludalo por nombre de inmediato: "¡Hola [nombre]! ¿Qué te pareció la demo?"
- Tu trabajo es resolver dudas y cerrar — NO repetir el ROI (ya lo vio en WhatsApp)
- Respondé con autoridad técnica total sobre el sistema
- Precio: SIEMPRE derivar a Carlos ("Carlos maneja los planes")
- Máximo 3 objeciones. Cuarta: "Carlos te puede responder eso mejor."
- Cierre: "¿Tiene sentido esto para [clínica]?"
- Interés confirmado: "Carlos, creo que [nombre] está listo para los próximos pasos."

Si la tool devuelve "No hay sesión activa": operá en modo recepcionista normal.`;

  const updatedSystemContent = (systemMsg?.content || '') + modoVendedora;
  const updatedMessages = currentMessages.map(m =>
    m.role === 'system' ? { ...m, content: updatedSystemContent } : m
  );

  // 4. PATCH assistant — agregar tool + actualizar prompt
  console.log('Actualizando assistant...');
  const patch = await apiCall('PATCH', `/assistant/${ASSISTANT_ID}`, {
    model: {
      ...assistant.model,
      toolIds: [...currentTools, tool.id],
      messages: updatedMessages
    }
  });
  console.log('Assistant actualizado. Tools:', patch.model?.toolIds);
}

main().catch(console.error);
```

- [ ] **Step 2: Ejecutar el script**

```powershell
node "C:\Users\noyag\vapi_demo_patch.js"
```

Expected output:
```
Creando tool obtenerContextoDemo...
Tool creada: XXXX-...
Fetching assistant...
Actualizando assistant...
Assistant actualizado. Tools: ['d4556cd4-...', '651eb955-...', ..., 'XXXX-...']
```

- [ ] **Step 3: Verificar en Vapi dashboard**

Ir a `https://dashboard.vapi.ai/` → Assistants → Sofía → Tools → verificar que `obtenerContextoDemo` aparece en la lista.

- [ ] **Step 4: Commit**

```powershell
cd "C:\Users\noyag\Norberto-Documentos"
git add C:/Users/noyag/vapi_demo_patch.js 2>/dev/null; true
git commit -m "feat(vapi): agregar MODO VENDEDORA + tool obtenerContextoDemo a Sofía"
```

---

## Task 10: Deploy — env var + dashboard + activar DEMO track

**Files:**
- No hay archivos nuevos — pasos de configuración y deploy

- [ ] **Step 1: Agregar CARLOS_WA_NUMBER en EasyPanel n8n**

1. Ir a EasyPanel → nexo-terra-n8n → Variables de entorno
2. Agregar: `CARLOS_WA_NUMBER = 541130875304`
3. Guardar y reiniciar el servicio n8n

- [ ] **Step 2: Deploy dashboard Next.js**

```powershell
cd "C:\Users\noyag\Norberto-Documentos\consultorio-kit\dashboard"
git add -A
git commit -m "feat(dashboard): sistema de ventas — demos page + sidebar + APIs"
git push
```

Si el dashboard está en Vercel/EasyPanel con deploy automático: esperar el build.
Si es manual: correr el build y deployar.

Expected: dashboard accesible en la URL de producción con `/dashboard/demos` visible en el sidebar para rol `dueno`.

- [ ] **Step 3: Pausar WFs del track PRODUCTO**

En n8n UI, pausar (toggle off) estos workflows:
- WF03 Recordatorios
- WF04 Check-in Web
- WF06 Post-Consulta
- WF07 Waitlist Inteligente
- WF10 Cron Cierre Handoff
- WF-REMINDER Recordatorios 24hs
- WF-CUMPLEANOS Saludo Cumpleaños
- WF-REACTIVACION Pacientes Dormidos
- WF-MONTHLY-REPORT
- WF-ADELANTO-1, WF-ADELANTO-2, WF-ADELANTO-CRON
- WF01 Gateway (PRODUCTO) — el que existía antes de los DEMO
- WF02 Bot (PRODUCTO)
- WF08 Selector Turnos (PRODUCTO)

Dejar activos: WF-KEEPWARM, Error Handler Global, WF05 Handoff Telegram.

- [ ] **Step 4: Activar WFs del track DEMO**

En n8n UI, activar:
- [DEMO] WF01 Gateway
- [DEMO] WF02 Bot
- [DEMO] WF08 Selector Turnos
- WF09 VAPI Tool Calls (ya estaba activo, ahora con obtenerContextoDemo)

---

## Task 11: Test E2E — presencial + remoto

- [ ] **Step 1: Test flujo remoto completo**

1. Dashboard → crear nueva demo: clínica ficticia "Test Remoto", 15 turnos/día, $30.000/consulta, 1 secretaria, tipo=remoto
2. Copiar el link WA generado
3. Desde un número de teléfono DIFERENTE al de Carlos, enviar el código DEMO-XXXX al número de WhatsApp del bot (5491137936325)

Esperar:
- Bot responde con welcome personalizado (nombre del prospecto + nombre de clínica)
- Flujo DNI → nombre → obra social → especialidad → link de turno
- WF08-DEMO abre correctamente en el browser (path `/webhook/consultorio-turnos-demo`)
- Al confirmar turno: bot envía showcase → ROI texto → audio de Sofía → Telegram a Carlos → "Pasale el teléfono"

- [ ] **Step 2: Verificar Telegram**

En el chat de Telegram del bot (@nexoterra-bot), verificar que llegó la notificación con:
- Nombre del prospecto
- Clínica
- ROI total calculado correctamente

- [ ] **Step 3: Test flujo presencial**

1. Dashboard → crear nueva demo: misma clínica o diferente, tipo=presencial
2. Desde el número de Carlos (541130875304), enviar el código DEMO-XXXX
3. Esperar: bot arranca la demo DIRECTAMENTE sin preguntas (ya tiene todos los datos del prospecto)
4. Completar el flujo → verificar mismo cierre

- [ ] **Step 4: Test Vapi / Sofía**

1. Tener una demo activa (estado='activo')
2. Llamar al número de Sofía (Twilio → Vapi)
3. Sofía debe llamar `obtenerContextoDemo` al inicio
4. Saludar al prospecto por nombre
5. Modo vendedora activo

- [ ] **Step 5: Verificar ROI en dashboard**

1. Crear una sesión demo con datos conocidos
2. Verificar que el ROI mostrado en la card de la lista coincide con la fórmula:
   - turnos_mes = turnos_dia × 22
   - noshows_mes = ROUND(turnos_mes × 0.15)
   - recuperados_mes = ROUND(noshows_mes × 0.80)
   - roi_noshows = recuperados_mes × precio_consulta
   - ahorro_admin = secretarias × (sueldo_secretaria ?? 700000) × 0.40
   - roi_total = roi_noshows + ahorro_admin

---

## Self-Review

**Spec coverage check:**

| Requisito spec | Task que lo implementa |
|----------------|----------------------|
| Tabla consultorio_demo_sessions | Task 1 |
| POST /api/demos/crear | Task 2 |
| GET /api/demos | Task 2 |
| Página /dashboard/demos | Task 3 |
| Link WA copiable | Task 3 (DemosClient) |
| Sidebar Demos (solo dueno) | Task 4 |
| Detección DEMO-XXXX en WF01 | Task 5 |
| Routing presencial vs remoto | Task 5 (wf01_demo_code2) |
| Estados demo_prospecto_init/preguntas | Task 6 |
| ROI texto post-booking | Task 7 (WF08-DEMO) |
| Audio PAS ElevenLabs | Task 7 (WF08-DEMO sendDemoProspectoCierre) |
| Telegram a Carlos | Task 7 (WF08-DEMO sendDemoProspectoCierre) |
| "Pasale el teléfono" | Task 7 (WF08-DEMO) |
| Carga contexto Vapi (obtenerContextoDemo) | Task 8 + Task 9 |
| MODO VENDEDORA en prompt Sofía | Task 9 |
| CARLOS_WA_NUMBER env var | Task 10 |
| Pausar WFs PRODUCTO | Task 10 |
| Test E2E | Task 11 |
| Backup onboarding-kit | Task 0 |

**Placeholder scan:** ninguno. Todos los pasos tienen código completo.

**Type consistency:** `DemoSession` interface en `demos-client.tsx` coincide con la tabla Supabase. `calcROI()` idéntica en `route.ts` y `demos-client.tsx`.
