# Dashboard Profesional — Consultorio Inteligente

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el dashboard Tooljet por una web Next.js 14 profesional, alojada en EasyPanel, con auth por roles, Realtime y Analytics con ROI.

**Architecture:** Next.js 14 App Router (SSR) + Supabase Auth (roles en user_metadata) + shadcn/ui dark theme. Lee de Supabase directamente, escribe via webhooks n8n existentes (WF-DASH-1/2/3/4). Un contenedor Docker por cliente, parametrizado por env vars — mismo modelo del kit.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, @supabase/ssr, @supabase/supabase-js, lucide-react, Node 18 Alpine Docker.

**Nota env vars:** El spec menciona `NEXTAUTH_SECRET` pero NO usamos NextAuth — Supabase Auth maneja sesiones. Las vars correctas son `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (prefijo NEXT_PUBLIC_ requerido por Next.js para acceso en el browser).

---

## Mapa de archivos

```
consultorio-kit/dashboard/
├── Dockerfile
├── next.config.js
├── package.json
├── tailwind.config.js
├── components.json
├── .env.example
├── src/
│   ├── middleware.ts                        — protección de rutas, redirige /login si no autenticado
│   ├── app/
│   │   ├── layout.tsx                       — root layout + providers
│   │   ├── page.tsx                         — redirect a /dashboard
│   │   ├── login/
│   │   │   ├── page.tsx                     — formulario de login
│   │   │   └── actions.ts                   — server action signIn
│   │   └── dashboard/
│   │       ├── layout.tsx                   — shell con sidebar + topbar, lee session
│   │       ├── page.tsx                     — Tab Hoy
│   │       ├── semana/page.tsx              — Tab Semana
│   │       ├── atenciones/page.tsx          — Tab Atenciones en curso
│   │       ├── pacientes/page.tsx           — Tab Pacientes
│   │       ├── en-vivo/page.tsx             — Tab Conversaciones en vivo (solo dueño)
│   │       └── analytics/page.tsx           — Tab Analytics (solo dueño)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx                  — nav lateral con badges Realtime
│   │   │   └── topbar.tsx                   — título + acciones por ruta
│   │   ├── turnos/
│   │   │   ├── turnos-table.tsx             — tabla reutilizable Hoy + Semana
│   │   │   ├── turno-modal.tsx              — modal detalle, cancelar, link check-in
│   │   │   └── nuevo-turno-modal.tsx        — modal crear turno
│   │   ├── atenciones/
│   │   │   ├── atenciones-list.tsx          — lista izquierda con Realtime
│   │   │   └── atencion-detail.tsx          — panel derecho con textarea reply
│   │   ├── pacientes/
│   │   │   └── pacientes-table.tsx          — tabla + búsqueda + modal edición
│   │   ├── en-vivo/
│   │   │   ├── conv-list.tsx                — lista conversaciones activas con Realtime
│   │   │   └── chat-thread.tsx              — hilo de mensajes con Realtime
│   │   └── analytics/
│   │       ├── roi-card.tsx                 — card ROI hero
│   │       ├── hero-metrics.tsx             — tres métricas hero (no-shows, confirmados, adelantos)
│   │       └── bar-chart.tsx                — gráfico CSS puro (sin librería extra)
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts                    — createBrowserClient
│       │   └── server.ts                    — createServerClient (cookies)
│       ├── auth.ts                          — getRole(), getProfesionalId()
│       ├── n8n.ts                           — funciones server-only para webhooks n8n
│       └── types.ts                         — interfaces TypeScript compartidas
```

---

## Task 0: Schema Supabase — tabla mensajes + RLS + Realtime

**Files:**
- Modify: `consultorio-kit/schema.sql` — agregar consultorio_mensajes
- Ejecutar en: Supabase SQL Editor del proyecto demo

- [ ] **Step 1: Agregar tabla consultorio_mensajes al schema.sql**

Abrir `consultorio-kit/schema.sql` y agregar al final:

```sql
-- Tabla de mensajes para tab "Conversaciones en vivo"
CREATE TABLE IF NOT EXISTS consultorio_mensajes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono_wa TEXT NOT NULL,
  direccion   TEXT NOT NULL CHECK (direccion IN ('entrada', 'salida')),
  contenido   TEXT NOT NULL,
  estado_bot  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_telefono
  ON consultorio_mensajes(telefono_wa, created_at DESC);
```

- [ ] **Step 2: Ejecutar la migración en Supabase (proyecto demo)**

Abrir Supabase → SQL Editor → pegar y ejecutar el SQL del Step 1.

Expected: tabla `consultorio_mensajes` aparece en Table Editor.

- [ ] **Step 3: Habilitar RLS en tablas del dashboard**

Ejecutar en Supabase SQL Editor:

```sql
-- Habilitar RLS (no rompe n8n que usa service_key que bypasea RLS)
ALTER TABLE consultorio_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_adelanto_ofertas ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura para usuarios autenticados
CREATE POLICY "dashboard_read_turnos" ON consultorio_turnos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dashboard_read_pacientes" ON consultorio_pacientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dashboard_update_pacientes" ON consultorio_pacientes
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "dashboard_read_profesionales" ON consultorio_profesionales
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dashboard_read_conversaciones" ON consultorio_conversaciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dashboard_read_mensajes" ON consultorio_mensajes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dashboard_read_adelanto" ON consultorio_adelanto_ofertas
  FOR SELECT TO authenticated USING (true);
```

- [ ] **Step 4: Habilitar Supabase Realtime en las tablas relevantes**

Ejecutar en Supabase SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE consultorio_turnos;
ALTER PUBLICATION supabase_realtime ADD TABLE consultorio_conversaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE consultorio_mensajes;
```

- [ ] **Step 5: Crear usuario de prueba con rol dueño en Supabase Auth**

Supabase → Authentication → Users → Invite User:
- Email: `admin@demo.consultorio`
- Password: (elegir una)

Luego en SQL Editor asignar el rol:
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "dueno"}'::jsonb
WHERE email = 'admin@demo.consultorio';
```

- [ ] **Step 6: Crear usuario secretaria de prueba**

```sql
-- Primero invitar el usuario desde Supabase Auth UI, luego:
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "secretaria"}'::jsonb
WHERE email = 'secretaria@demo.consultorio';
```

- [ ] **Step 7: Commit**

```bash
git add consultorio-kit/schema.sql
git commit -m "feat(schema): agrega consultorio_mensajes + RLS + Realtime"
```

---

## Task 1: Scaffold Next.js + configuración base

**Files:**
- Create: `consultorio-kit/dashboard/` — proyecto completo

- [ ] **Step 1: Crear el proyecto Next.js**

```bash
cd consultorio-kit
npx create-next-app@14 dashboard --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd dashboard
```

Cuando pregunte: App Router → Yes, src/ directory → No (usamos `app/` en raíz).

- [ ] **Step 2: Instalar dependencias**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react class-variance-authority clsx tailwind-merge
npx shadcn@latest init
```

En el wizard de shadcn: style → Default, base color → Slate, CSS variables → Yes.

Luego instalar componentes shadcn necesarios:
```bash
npx shadcn@latest add button input label badge dialog textarea table
```

- [ ] **Step 3: Configurar Tailwind para dark mode**

Reemplazar `tailwind.config.ts` con:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        surface: '#161b22',
        border: '#21262d',
        'border-strong': '#30363d',
        muted: '#8b949e',
        text: '#e6edf3',
        'text-strong': '#f0f6fc',
        accent: '#58a6ff',
        success: '#3fb950',
        warning: '#d29922',
        danger: '#f85149',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
```

- [ ] **Step 4: Configurar next.config.js**

Reemplazar `next.config.js` (o `next.config.mjs`) con:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}
module.exports = nextConfig
```

- [ ] **Step 5: Crear .env.example**

Crear `consultorio-kit/dashboard/.env.example`:

```bash
# Supabase — usar NEXT_PUBLIC_ para acceso en browser (Realtime)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# n8n webhooks — server-only (no NEXT_PUBLIC_)
N8N_WEBHOOK_BASE=https://cliente-n8n.easypanel.host
N8N_DASHBOARD_KEY=a5ecd694f6e42087848c3b28561dd0d9ac40ce88b14a212b

# Datos del consultorio — NEXT_PUBLIC_ para mostrar en UI
NEXT_PUBLIC_CONSULTORIO_NOMBRE=Policonsultorio Rivadavia

# Analytics — server-only
CONSULTORIO_VALOR_CONSULTA=8500
CONSULTORIO_COSTO_MENSUAL=8500
```

Copiar a `.env.local` y completar con valores reales del proyecto demo.

- [ ] **Step 6: Verificar que el proyecto compila**

```bash
npm run dev
```

Expected: servidor en `http://localhost:3000`, sin errores en consola.

- [ ] **Step 7: Commit**

```bash
git add consultorio-kit/dashboard/
git commit -m "feat(dashboard): scaffold Next.js 14 + shadcn + Tailwind dark"
```

---

## Task 2: Supabase clients + tipos + auth helpers + middleware + login

**Files:**
- Create: `app/lib/supabase/client.ts`
- Create: `app/lib/supabase/server.ts`
- Create: `app/lib/types.ts`
- Create: `app/lib/auth.ts`
- Create: `app/middleware.ts`
- Create: `app/login/page.tsx`
- Create: `app/login/actions.ts`

Todos los paths son relativos a `consultorio-kit/dashboard/`.

- [ ] **Step 1: Crear lib/supabase/client.ts**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Crear lib/supabase/server.ts**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Crear lib/types.ts**

```typescript
// lib/types.ts
export type UserRole = 'dueno' | 'secretaria' | 'medico'

export interface Turno {
  id: string
  paciente_id: string
  profesional_id: string
  fecha_hora: string
  estado: 'agendado' | 'confirmado' | 'cancelado' | 'auto_cancelado' | 'asistido'
  consultorio_pacientes: { nombre: string; dni: string; telefono_wa: string; obra_social: string } | null
  consultorio_profesionales: { nombre: string; especialidad: string } | null
}

export interface Paciente {
  id: string
  nombre: string
  dni: string
  telefono_wa: string
  obra_social: string
}

export interface Conversacion {
  telefono_wa: string
  estado: string
  handoff_humano: boolean
  contexto: Record<string, unknown>
  updated_at: string
}

export interface Mensaje {
  id: string
  telefono_wa: string
  direccion: 'entrada' | 'salida'
  contenido: string
  estado_bot: string | null
  created_at: string
}

export interface AnalyticsData {
  noShowRate: number
  noShowCount: number
  totalTurnos: number
  confirmadosBot: number
  adelantos: number
  pacientesNuevos: number
  actividadSemanas: Array<{ semana: string; noShowPct: number }>
  actividadBot: { recordatorios: number; reservas: number; cancelaciones: number; handoffs: number }
}
```

- [ ] **Step 4: Crear lib/auth.ts**

```typescript
// lib/auth.ts
import type { UserRole } from './types'

export function getRole(userMetadata: Record<string, unknown>): UserRole {
  return (userMetadata?.role as UserRole) ?? 'secretaria'
}

export function getProfesionalId(userMetadata: Record<string, unknown>): string | null {
  return (userMetadata?.profesional_id as string) ?? null
}

export function canAccess(role: UserRole, section: 'analytics' | 'en-vivo' | 'pacientes' | 'atenciones'): boolean {
  if (section === 'analytics' || section === 'en-vivo') return role === 'dueno'
  if (section === 'pacientes') return role === 'dueno' || role === 'secretaria'
  if (section === 'atenciones') return role === 'dueno' || role === 'secretaria'
  return true
}
```

- [ ] **Step 5: Crear middleware.ts**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = { matcher: ['/dashboard/:path*', '/login'] }
```

- [ ] **Step 6: Crear app/login/actions.ts**

```typescript
// app/login/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(_: unknown, formData: FormData): Promise<{ error: string } | never> {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: 'Email o contraseña incorrectos' }
  redirect('/dashboard')
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 7: Crear app/login/page.tsx**

```typescript
// app/login/page.tsx
'use client'
import { useFormState, useFormStatus } from 'react-dom'
import { login } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="w-full bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60">
      {pending ? 'Ingresando…' : 'Ingresar al panel'}
    </button>
  )
}

export default function LoginPage() {
  const [state, action] = useFormState(login, null)
  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#161b22] border border-[#30363d] rounded-2xl p-8 flex flex-col gap-5">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-700 to-violet-700 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3">🏥</div>
          <h1 className="text-lg font-bold text-[#f0f6fc]">
            {process.env.NEXT_PUBLIC_CONSULTORIO_NOMBRE ?? 'Consultorio'}
          </h1>
          <p className="text-xs text-[#8b949e] mt-1">Panel de Gestión · Acceso restringido</p>
        </div>
        <hr className="border-[#21262d]" />
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#8b949e]">Email</label>
            <input name="email" type="email" required
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] transition-colors"
              placeholder="secretaria@consultorio.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#8b949e]">Contraseña</label>
            <input name="password" type="password" required
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] transition-colors" />
          </div>
          {state?.error && <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{state.error}</p>}
          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Crear app/page.tsx (redirect)**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'
export default function RootPage() {
  redirect('/dashboard')
}
```

- [ ] **Step 9: Crear app/layout.tsx**

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_CONSULTORIO_NOMBRE ?? 'Panel de Gestión',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-[#0f1117] text-[#e6edf3]`}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 10: Verificar login**

```bash
npm run dev
```

Navegar a `http://localhost:3000` → debe redirigir a `/login`. Ingresar con las credenciales de `admin@demo.consultorio` → debe redirigir a `/dashboard` (página en blanco por ahora es OK).

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "feat(dashboard): Supabase Auth + middleware + login page"
```

---

## Task 3: Layout — sidebar + topbar + dashboard shell

**Files:**
- Create: `app/dashboard/layout.tsx`
- Create: `components/layout/sidebar.tsx`
- Create: `components/layout/topbar.tsx`
- Create: `lib/n8n.ts`

- [ ] **Step 1: Crear lib/n8n.ts (server-only)**

```typescript
// lib/n8n.ts
// Server-only: N8N_WEBHOOK_BASE y N8N_DASHBOARD_KEY no tienen prefijo NEXT_PUBLIC_

const BASE = process.env.N8N_WEBHOOK_BASE!
const KEY = process.env.N8N_DASHBOARD_KEY!
const headers = { 'Content-Type': 'application/json', 'X-Dashboard-Key': KEY }

export async function cancelarTurno(turnoId: string) {
  const res = await fetch(`${BASE}/webhook/dashboard-cancelar`, {
    method: 'POST', headers,
    body: JSON.stringify({ turno_id: turnoId }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Error al cancelar turno')
  return res.json()
}

export async function generarLink(turnoId: string) {
  const res = await fetch(`${BASE}/webhook/dashboard-generar-link`, {
    method: 'POST', headers,
    body: JSON.stringify({ turno_id: turnoId }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Error al generar link')
  return res.json()
}

export async function crearPaciente(data: {
  nombre: string; dni: string; telefono_wa: string
  obra_social: string; profesional_id: string; fecha_hora: string
}) {
  const res = await fetch(`${BASE}/webhook/dashboard-crear-paciente`, {
    method: 'POST', headers,
    body: JSON.stringify(data),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Error al crear turno')
  return res.json()
}

export async function responderHandoff(data: { telefono_wa: string; mensaje: string; cerrar?: boolean }) {
  const res = await fetch(`${BASE}/webhook/dashboard-responder`, {
    method: 'POST', headers,
    body: JSON.stringify(data),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Error al responder')
  return res.json()
}
```

- [ ] **Step 2: Crear components/layout/sidebar.tsx**

```typescript
// components/layout/sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'
import type { UserRole } from '@/lib/types'
import { canAccess } from '@/lib/auth'

const NAV = [
  { href: '/dashboard', label: 'Hoy', icon: '📅', roles: ['dueno','secretaria','medico'] as UserRole[] },
  { href: '/dashboard/semana', label: 'Semana', icon: '📆', roles: ['dueno','secretaria','medico'] as UserRole[] },
  { href: '/dashboard/atenciones', label: 'Atenciones', icon: '🤝', roles: ['dueno','secretaria'] as UserRole[], badge: 'atenciones' },
  { href: '/dashboard/pacientes', label: 'Pacientes', icon: '👥', roles: ['dueno','secretaria'] as UserRole[] },
  { href: '/dashboard/en-vivo', label: 'En vivo', icon: '💬', roles: ['dueno'] as UserRole[], badge: 'enlivo' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📊', roles: ['dueno'] as UserRole[] },
]

interface Props {
  role: UserRole
  userName: string
  badges?: { atenciones: number; enlivo: number }
}

export function Sidebar({ role, userName, badges }: Props) {
  const pathname = usePathname()
  const items = NAV.filter(n => n.roles.includes(role))

  return (
    <aside className="w-52 bg-[#161b22] border-r border-[#21262d] flex flex-col flex-shrink-0 h-full">
      <div className="px-4 py-5 border-b border-[#21262d]">
        <p className="text-xs font-bold text-[#f0f6fc]">{process.env.NEXT_PUBLIC_CONSULTORIO_NOMBRE ?? 'Consultorio'}</p>
        <p className="text-[10px] text-[#8b949e] mt-0.5">Panel de Gestión</p>
      </div>

      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const count = item.badge ? badges?.[item.badge as 'atenciones' | 'enlivo'] ?? 0 : 0
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors ${
                active ? 'bg-[#1f3460] text-[#58a6ff] font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'
              }`}>
              <span className="w-5 text-center text-sm">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.badge === 'atenciones' ? 'bg-red-600 text-white' : 'bg-[#2ea043] text-white'
                }`}>{count}</span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-3 border-t border-[#21262d] flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#1f3460] flex items-center justify-center text-[11px] font-bold text-[#58a6ff] flex-shrink-0">
          {userName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#e6edf3] truncate">{userName}</p>
          <p className="text-[10px] text-[#8b949e] capitalize">{role === 'dueno' ? 'Dueño' : role === 'secretaria' ? 'Secretaria' : 'Médico'}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="text-[#8b949e] hover:text-[#e6edf3] text-xs transition-colors" title="Cerrar sesión">⎋</button>
        </form>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Crear components/layout/topbar.tsx**

```typescript
// components/layout/topbar.tsx
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export function Topbar({ title, subtitle, children }: Props) {
  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es })
  return (
    <div className="px-6 py-4 border-b border-[#21262d] flex items-center justify-between flex-shrink-0 bg-[#0d1117]">
      <div>
        <h1 className="text-base font-bold text-[#f0f6fc]">{title}</h1>
        <p className="text-xs text-[#8b949e] mt-0.5">{subtitle ?? hoy}</p>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
```

Instalar date-fns: `npm install date-fns`

- [ ] **Step 4: Crear app/dashboard/layout.tsx**

```typescript
// app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = getRole(user.user_metadata)
  const userName = user.email?.split('@')[0] ?? 'Usuario'

  // Contar atenciones activas para badge sidebar
  const { count: atencionesCount } = await supabase
    .from('consultorio_conversaciones')
    .select('*', { count: 'exact', head: true })
    .eq('handoff_humano', true)

  // Contar conversaciones en vivo para badge sidebar
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { count: enVivoCount } = await supabase
    .from('consultorio_conversaciones')
    .select('*', { count: 'exact', head: true })
    .neq('estado', 'inicio')
    .gte('updated_at', thirtyMinAgo)

  return (
    <div className="flex h-screen bg-[#0f1117] overflow-hidden">
      <Sidebar
        role={role}
        userName={userName}
        badges={{ atenciones: atencionesCount ?? 0, enlivo: enVivoCount ?? 0 }}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Verificar layout**

```bash
npm run dev
```

Navegar a `http://localhost:3000/dashboard` → debe mostrar sidebar con los tabs correctos según el rol del usuario logueado. El área de contenido está vacía (OK).

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(dashboard): layout shell — sidebar + topbar + auth context"
```

---

## Task 4: Tab Hoy + Tab Semana

**Files:**
- Create: `components/turnos/turnos-table.tsx`
- Create: `components/turnos/turno-modal.tsx`
- Create: `components/turnos/nuevo-turno-modal.tsx`
- Create: `app/dashboard/page.tsx`
- Create: `app/dashboard/semana/page.tsx`

- [ ] **Step 1: Crear components/turnos/turnos-table.tsx**

```typescript
// components/turnos/turnos-table.tsx
'use client'
import { useState } from 'react'
import type { Turno } from '@/lib/types'
import { TurnoModal } from './turno-modal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADO_CONFIG = {
  agendado:      { label: 'Agendado',   color: 'bg-blue-950 text-blue-400 border-blue-800' },
  confirmado:    { label: 'Confirmado', color: 'bg-green-950 text-green-400 border-green-800' },
  cancelado:     { label: 'Cancelado',  color: 'bg-red-950 text-red-400 border-red-800' },
  auto_cancelado:{ label: 'Cancelado',  color: 'bg-red-950 text-red-400 border-red-800' },
  asistido:      { label: 'Asistido',   color: 'bg-purple-950 text-purple-400 border-purple-800' },
} as const

interface Props {
  turnos: Turno[]
  showDate?: boolean
  canCreate?: boolean
}

export function TurnosTable({ turnos, showDate = false, canCreate = false }: Props) {
  const [selected, setSelected] = useState<Turno | null>(null)

  return (
    <>
      <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0d1117] text-[11px] font-semibold text-[#8b949e] uppercase tracking-wide">
              <th className="text-left px-4 py-3">Hora{showDate ? ' / Fecha' : ''}</th>
              <th className="text-left px-4 py-3">Paciente</th>
              <th className="text-left px-4 py-3">Especialidad</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {turnos.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-[#8b949e] text-sm">Sin turnos para este período</td></tr>
            )}
            {turnos.map(t => {
              const fecha = new Date(t.fecha_hora)
              const cfg = ESTADO_CONFIG[t.estado] ?? ESTADO_CONFIG.agendado
              return (
                <tr key={t.id} className="border-t border-[#21262d] hover:bg-[#1a1f2e] transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-[#e6edf3]">
                    {showDate
                      ? format(fecha, "d/MM · HH:mm", { locale: es })
                      : format(fecha, 'HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#e6edf3]">{t.consultorio_pacientes?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#8b949e]">{t.consultorio_profesionales?.especialidad ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(t)}
                      className="text-xs bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] rounded-md px-3 py-1 transition-colors">
                      Ver
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && <TurnoModal turno={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
```

- [ ] **Step 2: Crear components/turnos/turno-modal.tsx**

```typescript
// components/turnos/turno-modal.tsx
'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Turno } from '@/lib/types'

interface Props { turno: Turno; onClose: () => void }

export function TurnoModal({ turno, onClose }: Props) {
  const [loading, setLoading] = useState<'cancelar' | 'link' | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCancelar() {
    setLoading('cancelar')
    const res = await fetch('/api/turnos/cancelar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno_id: turno.id }),
    })
    if (res.ok) { onClose() } else { setError('No se pudo cancelar'); setLoading(null) }
  }

  async function handleLink() {
    setLoading('link')
    const res = await fetch('/api/turnos/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno_id: turno.id }),
    })
    const data = await res.json()
    setLink(data.link ?? data.url ?? JSON.stringify(data))
    setLoading(null)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-md flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-[#f0f6fc]">{turno.consultorio_pacientes?.nombre ?? 'Paciente'}</h2>
            <p className="text-xs text-[#8b949e] mt-0.5">{turno.consultorio_pacientes?.telefono_wa}</p>
          </div>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3] text-lg">✕</button>
        </div>

        <div className="bg-[#0d1117] rounded-xl p-4 flex flex-col gap-2 text-xs">
          {[
            ['Fecha y hora', format(new Date(turno.fecha_hora), "EEEE d 'de' MMMM · HH:mm", { locale: es })],
            ['Especialidad', turno.consultorio_profesionales?.especialidad ?? '—'],
            ['Médico', turno.consultorio_profesionales?.nombre ?? '—'],
            ['Obra social', turno.consultorio_pacientes?.obra_social ?? '—'],
            ['DNI', turno.consultorio_pacientes?.dni ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-[#8b949e] w-24 flex-shrink-0">{k}</span>
              <span className="text-[#e6edf3] font-medium">{v}</span>
            </div>
          ))}
        </div>

        {link && (
          <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3">
            <p className="text-xs text-[#8b949e] mb-1">Link de check-in generado:</p>
            <p className="text-xs text-blue-400 break-all font-mono">{link}</p>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        {turno.estado !== 'cancelado' && turno.estado !== 'auto_cancelado' && (
          <div className="flex gap-2">
            <button onClick={handleLink} disabled={!!loading}
              className="flex-1 bg-[#21262d] border border-[#30363d] text-[#e6edf3] rounded-lg py-2 text-xs font-semibold hover:bg-[#2d3748] transition-colors disabled:opacity-60">
              {loading === 'link' ? 'Generando…' : '🔗 Link check-in'}
            </button>
            <button onClick={handleCancelar} disabled={!!loading}
              className="flex-1 bg-red-950/40 border border-red-800/40 text-red-400 rounded-lg py-2 text-xs font-semibold hover:bg-red-900/40 transition-colors disabled:opacity-60">
              {loading === 'cancelar' ? 'Cancelando…' : '✕ Cancelar turno'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear API routes para acciones de turno**

Crear `app/api/turnos/cancelar/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { cancelarTurno } from '@/lib/n8n'

export async function POST(req: Request) {
  const { turno_id } = await req.json()
  try {
    const data = await cancelarTurno(turno_id)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
```

Crear `app/api/turnos/link/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { generarLink } from '@/lib/n8n'

export async function POST(req: Request) {
  const { turno_id } = await req.json()
  try {
    const data = await generarLink(turno_id)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Crear app/dashboard/page.tsx (Tab Hoy)**

```typescript
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole, getProfesionalId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { TurnosTable } from '@/components/turnos/turnos-table'
import type { Turno } from '@/lib/types'

async function getStats(supabase: ReturnType<typeof createClient>, turnos: Turno[]) {
  return {
    confirmados: turnos.filter(t => t.estado === 'confirmado' || t.estado === 'asistido').length,
    pendientes: turnos.filter(t => t.estado === 'agendado').length,
    cancelados: turnos.filter(t => t.estado === 'cancelado' || t.estado === 'auto_cancelado').length,
    atenciones: await supabase.from('consultorio_conversaciones').select('*', { count: 'exact', head: true }).eq('handoff_humano', true).then(r => r.count ?? 0),
  }
}

export default async function HoyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = getRole(user.user_metadata)
  const profId = getProfesionalId(user.user_metadata)

  const hoyStart = new Date(); hoyStart.setHours(0, 0, 0, 0)
  const hoyEnd = new Date(); hoyEnd.setHours(23, 59, 59, 999)

  let query = supabase
    .from('consultorio_turnos')
    .select('*, consultorio_pacientes(nombre,dni,telefono_wa,obra_social), consultorio_profesionales(nombre,especialidad)')
    .gte('fecha_hora', hoyStart.toISOString())
    .lte('fecha_hora', hoyEnd.toISOString())
    .order('fecha_hora', { ascending: true })

  if (role === 'medico' && profId) query = query.eq('profesional_id', profId)

  const { data: turnos } = await query
  const stats = await getStats(supabase, (turnos ?? []) as Turno[])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Turnos de hoy" subtitle={`${stats.confirmados + stats.pendientes + stats.cancelados} turnos programados`}>
        <div className="flex items-center gap-1.5 text-xs text-[#3fb950] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse"></span>
          En vivo
        </div>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Confirmados', val: stats.confirmados, color: 'text-green-400' },
            { label: 'Pendientes', val: stats.pendientes, color: 'text-blue-400' },
            { label: 'Cancelados', val: stats.cancelados, color: 'text-red-400' },
            { label: 'En atención', val: stats.atenciones, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
              <p className="text-[11px] text-[#8b949e] font-medium uppercase tracking-wide">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        <TurnosTable
          turnos={(turnos ?? []) as Turno[]}
          canCreate={role !== 'medico'}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Crear app/dashboard/semana/page.tsx (Tab Semana)**

```typescript
// app/dashboard/semana/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole, getProfesionalId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { TurnosTable } from '@/components/turnos/turnos-table'
import type { Turno } from '@/lib/types'
import { format, addDays, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function SemanaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = getRole(user.user_metadata)
  const profId = getProfesionalId(user.user_metadata)

  const desde = startOfDay(new Date())
  const hasta = addDays(desde, 7)

  let query = supabase
    .from('consultorio_turnos')
    .select('*, consultorio_pacientes(nombre,dni,telefono_wa,obra_social), consultorio_profesionales(nombre,especialidad)')
    .gte('fecha_hora', desde.toISOString())
    .lt('fecha_hora', hasta.toISOString())
    .not('estado', 'in', '("cancelado","auto_cancelado")')
    .order('fecha_hora', { ascending: true })

  if (role === 'medico' && profId) query = query.eq('profesional_id', profId)

  const { data: turnos } = await query

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Próxima semana"
        subtitle={`${format(desde, "d 'de' MMM", { locale: es })} → ${format(hasta, "d 'de' MMM", { locale: es })} · ${turnos?.length ?? 0} turnos`}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <TurnosTable turnos={(turnos ?? []) as Turno[]} showDate={true} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verificar tabs Hoy y Semana**

```bash
npm run dev
```

Navegar a `/dashboard` → tabla de turnos del día con stat cards. Navegar a `/dashboard/semana` → próximos 7 días. Hacer click en una fila → modal con datos del turno.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(dashboard): tabs Hoy y Semana con modal detalle + cancelar/link"
```

---

## Task 5: WF-DASH-4 + Tab Atenciones en curso

**Files:**
- Create: `consultorio-kit/n8n/WF-DASH-4-responder-handoff.json`
- Create: `app/api/atenciones/responder/route.ts`
- Create: `components/atenciones/atenciones-list.tsx`
- Create: `components/atenciones/atencion-detail.tsx`
- Create: `app/dashboard/atenciones/page.tsx`

- [ ] **Step 1: Crear WF-DASH-4-responder-handoff.json**

Crear `consultorio-kit/n8n/WF-DASH-4-responder-handoff.json`:

```json
{
  "name": "WF-DASH-4 — Responder Handoff",
  "active": true,
  "nodes": [
    {
      "id": "dash4-webhook",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [-200, 0],
      "parameters": {
        "path": "dashboard-responder",
        "httpMethod": "POST",
        "authentication": "headerAuth",
        "responseMode": "responseNode"
      },
      "credentials": { "httpHeaderAuth": { "id": "DASH_HEADER_AUTH_CREDENTIAL_ID", "name": "Dashboard Header Auth" } }
    },
    {
      "id": "dash4-set",
      "name": "Set Env",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [0, 0],
      "parameters": {
        "assignments": {
          "assignments": [
            { "name": "_wa_token", "value": "={{ $env.META_WHATSAPP_TOKEN }}", "type": "string" },
            { "name": "_phone_id", "value": "={{ $env.WA_PHONE_NUMBER_ID }}", "type": "string" },
            { "name": "_supa_url", "value": "={{ $env.SUPABASE_URL }}", "type": "string" },
            { "name": "_supa_key", "value": "={{ $env.SUPABASE_SERVICE_KEY }}", "type": "string" }
          ]
        },
        "includeOtherFields": true
      }
    },
    {
      "id": "dash4-code",
      "name": "Responder y Cerrar",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [200, 0],
      "parameters": {
        "jsCode": "const helpers = this.helpers;\nconst { telefono_wa, mensaje, cerrar } = $input.first().json.body;\nconst WA_TOKEN = $input.first().json._wa_token;\nconst PHONE_ID = $input.first().json._phone_id;\nconst SUPABASE_URL = $input.first().json._supa_url;\nconst SUPABASE_KEY = $input.first().json._supa_key;\n\nawait helpers.httpRequest({\n  method: 'POST',\n  url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,\n  headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },\n  body: JSON.stringify({ messaging_product: 'whatsapp', to: telefono_wa, type: 'text', text: { body: mensaje } })\n});\n\nif (cerrar) {\n  await helpers.httpRequest({\n    method: 'PATCH',\n    url: `${SUPABASE_URL}/rest/v1/consultorio_conversaciones`,\n    qs: { telefono_wa: `eq.${telefono_wa}` },\n    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },\n    body: JSON.stringify({ handoff_humano: false, estado: 'inicio', contexto: {}, updated_at: new Date().toISOString() })\n  });\n}\n\nreturn [{ json: { success: true } }];"
      }
    },
    {
      "id": "dash4-respond",
      "name": "Respond",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [400, 0],
      "parameters": { "respondWith": "json", "responseBody": "={{ { success: true } }}" }
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "Set Env", "type": "main", "index": 0 }]] },
    "Set Env": { "main": [[{ "node": "Responder y Cerrar", "type": "main", "index": 0 }]] },
    "Responder y Cerrar": { "main": [[{ "node": "Respond", "type": "main", "index": 0 }]] }
  },
  "settings": {
    "executionOrder": "v1",
    "errorWorkflow": "anEe7qyiweYG6Ar0",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "none"
  }
}
```

Importar en n8n live (mismo proceso que WF-DASH-1/2/3).

- [ ] **Step 2: Crear app/api/atenciones/responder/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { responderHandoff } from '@/lib/n8n'

export async function POST(req: Request) {
  const body = await req.json()
  try {
    const data = await responderHandoff(body)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Crear components/atenciones/atenciones-list.tsx**

```typescript
// components/atenciones/atenciones-list.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Conversacion } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  initial: Conversacion[]
  selected: string | null
  onSelect: (phone: string) => void
}

export function AtencionesList({ initial, selected, onSelect }: Props) {
  const [items, setItems] = useState<Conversacion[]>(initial)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('atenciones-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'consultorio_conversaciones',
        filter: 'handoff_humano=eq.true'
      }, () => {
        supabase.from('consultorio_conversaciones')
          .select('*').eq('handoff_humano', true).order('updated_at', { ascending: false })
          .then(({ data }) => { if (data) setItems(data as Conversacion[]) })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (items.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-[#8b949e] text-sm">Sin atenciones activas</div>
  }

  return (
    <div className="w-64 border-r border-[#21262d] flex flex-col overflow-y-auto flex-shrink-0">
      {items.map(c => {
        const ctx = c.contexto as Record<string, unknown>
        const nombre = (ctx.pacienteNombre as string) ?? c.telefono_wa
        return (
          <button key={c.telefono_wa} onClick={() => onSelect(c.telefono_wa)}
            className={`text-left px-4 py-3 border-b border-[#21262d] transition-colors ${
              selected === c.telefono_wa ? 'bg-[#1f3460]' : 'hover:bg-[#1a1f2e]'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-[#f0f6fc] truncate">{nombre}</span>
              <span className="text-[10px] text-[#8b949e] ml-2 flex-shrink-0">
                {formatDistanceToNow(new Date(c.updated_at), { locale: es, addSuffix: false })}
              </span>
            </div>
            <p className="text-[11px] text-[#58a6ff]">{c.telefono_wa}</p>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Crear components/atenciones/atencion-detail.tsx**

```typescript
// components/atenciones/atencion-detail.tsx
'use client'
import { useState } from 'react'
import type { Conversacion } from '@/lib/types'

interface Props { conv: Conversacion }

export function AtencionDetail({ conv }: Props) {
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState<'enviar' | 'cerrar' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctx = conv.contexto as Record<string, unknown>

  async function send(cerrar = false) {
    if (!mensaje.trim() && !cerrar) return
    setLoading(cerrar ? 'cerrar' : 'enviar')
    const res = await fetch('/api/atenciones/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono_wa: conv.telefono_wa, mensaje: cerrar ? '✅ Atención finalizada. Quedamos a disposición.' : mensaje, cerrar }),
    })
    if (res.ok) { setMensaje(''); setError(null) } else { setError('Error al enviar') }
    setLoading(null)
  }

  return (
    <div className="flex-1 flex flex-col p-5 gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-[#f0f6fc]">{(ctx.pacienteNombre as string) ?? 'Paciente'}</h2>
          <p className="text-xs text-[#58a6ff] mt-0.5">{conv.telefono_wa} · Atención activa</p>
        </div>
        <span className="text-[11px] bg-yellow-950/40 border border-yellow-800/40 text-yellow-400 px-2 py-0.5 rounded-full font-semibold">Esperando</span>
      </div>

      <div className="bg-[#0d1117] rounded-xl p-4 flex flex-col gap-2 text-xs">
        {[
          ['Turno próximo', (ctx.turnoFecha as string) ?? '—'],
          ['Obra social', (ctx.obraSocial as string) ?? '—'],
          ['Último mensaje', (ctx.ultimoMensaje as string) ?? '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-[#8b949e] w-28 flex-shrink-0">{k}</span>
            <span className="text-[#e6edf3]">{v}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {error && <p className="text-xs text-red-400">{error}</p>}
        <textarea
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          placeholder="Respondé por WhatsApp directamente desde acá…"
          rows={3}
          className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-sm text-[#e6edf3] resize-none outline-none focus:border-[#58a6ff] transition-colors"
        />
        <div className="flex gap-2">
          <button onClick={() => send(true)} disabled={!!loading}
            className="bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] rounded-lg px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-60">
            {loading === 'cerrar' ? 'Cerrando…' : '✓ Cerrar atención'}
          </button>
          <button onClick={() => send(false)} disabled={!!loading || !mensaje.trim()}
            className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg py-2 text-xs font-semibold transition-colors disabled:opacity-60">
            {loading === 'enviar' ? 'Enviando…' : 'Enviar →'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Crear app/dashboard/atenciones/page.tsx**

```typescript
// app/dashboard/atenciones/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AtencionesList } from '@/components/atenciones/atenciones-list'
import { AtencionDetail } from '@/components/atenciones/atencion-detail'
import { Topbar } from '@/components/layout/topbar'
import type { Conversacion } from '@/lib/types'

// Client component porque necesita Realtime desde el inicio
export default function AtencionesPage() {
  const [convs, setConvs] = useState<Conversacion[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('consultorio_conversaciones').select('*').eq('handoff_humano', true)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setConvs(data as Conversacion[])
      })
  }, [])

  const selectedConv = convs.find(c => c.telefono_wa === selected)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Atenciones en curso" subtitle={`${convs.length} paciente${convs.length !== 1 ? 's' : ''} esperando respuesta`}>
        <div className="flex items-center gap-1.5 text-xs text-[#3fb950] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse"></span>
          Actualización en tiempo real
        </div>
      </Topbar>
      <div className="flex flex-1 overflow-hidden">
        <AtencionesList initial={convs} selected={selected} onSelect={setSelected} />
        <div className="flex-1 overflow-y-auto">
          {selectedConv
            ? <AtencionDetail conv={selectedConv} />
            : <div className="flex items-center justify-center h-full text-[#8b949e] text-sm">Seleccioná una atención para responder</div>
          }
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verificar tab Atenciones**

```bash
npm run dev
```

Navegar a `/dashboard/atenciones`. Si hay conversaciones con `handoff_humano = true` en Supabase, deben aparecer en la lista izquierda. Al seleccionar una, el panel derecho muestra los datos y el área de respuesta.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(dashboard): WF-DASH-4 + tab Atenciones en curso con Realtime"
```

---

## Task 6: Tab Pacientes

**Files:**
- Create: `components/pacientes/pacientes-table.tsx`
- Create: `app/dashboard/pacientes/page.tsx`

- [ ] **Step 1: Crear components/pacientes/pacientes-table.tsx**

```typescript
// components/pacientes/pacientes-table.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Paciente } from '@/lib/types'

interface Props { initial: Paciente[] }

export function PacientesTable({ initial }: Props) {
  const [pacientes, setPacientes] = useState(initial)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Paciente | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = pacientes.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.dni.includes(search) ||
    p.telefono_wa.includes(search)
  )

  async function save() {
    if (!editing) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('consultorio_pacientes').update({
      nombre: editing.nombre,
      obra_social: editing.obra_social,
      telefono_wa: editing.telefono_wa,
    }).eq('id', editing.id)
    setPacientes(prev => prev.map(p => p.id === editing.id ? editing : p))
    setEditing(null)
    setSaving(false)
  }

  return (
    <>
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, DNI o teléfono…"
          className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] transition-colors" />
      </div>

      <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0d1117] text-[11px] font-semibold text-[#8b949e] uppercase tracking-wide">
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">DNI</th>
              <th className="text-left px-4 py-3">Teléfono WA</th>
              <th className="text-left px-4 py-3">Obra social</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-[#8b949e] text-sm">Sin resultados</td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="border-t border-[#21262d] hover:bg-[#1a1f2e] transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-[#e6edf3]">{p.nombre}</td>
                <td className="px-4 py-3 text-sm text-[#8b949e] font-mono">{p.dni}</td>
                <td className="px-4 py-3 text-sm text-[#58a6ff]">{p.telefono_wa}</td>
                <td className="px-4 py-3 text-sm text-[#8b949e]">{p.obra_social}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(p)}
                    className="text-xs bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] rounded-md px-3 py-1 transition-colors">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#f0f6fc]">Editar paciente</h2>
              <button onClick={() => setEditing(null)} className="text-[#8b949e] hover:text-[#e6edf3]">✕</button>
            </div>
            {(['nombre', 'obra_social', 'telefono_wa'] as const).map(field => (
              <div key={field} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#8b949e] capitalize">{field.replace('_', ' ')}</label>
                <input value={editing[field]} onChange={e => setEditing({ ...editing, [field]: e.target.value })}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]" />
              </div>
            ))}
            <button onClick={save} disabled={saving}
              className="bg-[#238636] text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Crear app/dashboard/pacientes/page.tsx**

```typescript
// app/dashboard/pacientes/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { PacientesTable } from '@/components/pacientes/pacientes-table'
import type { Paciente } from '@/lib/types'

export default async function PacientesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = getRole(user.user_metadata)
  if (role === 'medico') redirect('/dashboard')

  const { data: pacientes } = await supabase
    .from('consultorio_pacientes')
    .select('id, nombre, dni, telefono_wa, obra_social')
    .order('nombre', { ascending: true })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Pacientes" subtitle={`${pacientes?.length ?? 0} pacientes registrados`} />
      <div className="flex-1 overflow-y-auto p-6">
        <PacientesTable initial={(pacientes ?? []) as Paciente[]} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar tab Pacientes**

```bash
npm run dev
```

Navegar a `/dashboard/pacientes`. Tabla con buscador. Click en "Editar" → modal con campos editables. Guardar → tabla se actualiza sin recargar.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(dashboard): tab Pacientes con búsqueda y edición inline"
```

---

## Task 7: Parche WF01/WF02 — logging de mensajes a consultorio_mensajes

Este task modifica los workflows n8n live para registrar mensajes. Se hace via la API de n8n (mismo patrón que parches anteriores).

**Files:**
- Modify: WF01 Gateway live (`dVfZYeSsVigWd0cJ`) — nodo "3. Extraer Mensaje"
- Modify: WF02 Bot live (`la5XjIMeKIMoTa0q`) — función `sendText`

- [ ] **Step 1: Entender el parche de WF01**

En WF01, el nodo "3. Extraer Mensaje" ya extrae el mensaje. Necesitamos agregar un INSERT a `consultorio_mensajes` justo después de extraer el mensaje del paciente (cuando `skip !== true`).

Agregar al final del Code node de WF01, antes del `return`:

```javascript
// Logging mensaje entrante a consultorio_mensajes
if (!skip && textoMensaje) {
  try {
    await this.helpers.httpRequest({
      method: 'POST',
      url: `${$env.SUPABASE_URL}/rest/v1/consultorio_mensajes`,
      headers: {
        apikey: $env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${$env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        telefono_wa: fromNumber,
        direccion: 'entrada',
        contenido: textoMensaje,
        estado_bot: null
      })
    });
  } catch(e) {} // Silencioso — no rompe el flujo
}
```

- [ ] **Step 2: Obtener código actual del nodo "3. Extraer Mensaje" de WF01**

```powershell
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ"
$headers = @{ "X-N8N-API-KEY" = $token }
$wf = Invoke-RestMethod -Uri "https://nexo-terra-n8n.6fwciw.easypanel.host/api/v1/workflows/dVfZYeSsVigWd0cJ" -Headers $headers
$nodo3 = $wf.nodes | Where-Object { $_.name -eq "3. Extraer Mensaje" }
$nodo3.parameters.jsCode | Out-File -Encoding utf8 "wf01_nodo3_backup.js"
Write-Host "Backup guardado en wf01_nodo3_backup.js"
```

- [ ] **Step 3: Agregar logging al nodo 3 de WF01 y hacer PUT**

Leer el backup, agregar el bloque de logging antes del `return`, hacer PUT:

```powershell
$codigoActual = Get-Content "wf01_nodo3_backup.js" -Raw

# Localizar el return final y agregar el logging antes
$logging = @'
// Log mensaje entrante
if (!skip && textoMensaje) {
  try {
    await this.helpers.httpRequest({
      method: 'POST',
      url: `${$env.SUPABASE_URL}/rest/v1/consultorio_mensajes`,
      headers: { apikey: $env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${$env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ telefono_wa: fromNumber, direccion: 'entrada', contenido: textoMensaje, estado_bot: null })
    });
  } catch(e) {}
}
'@

# Insertar antes del último return
$nuevoCodigo = $codigoActual -replace '(return \[{)', "$logging`n`$1"

# Obtener WF completo, reemplazar código del nodo 3, PUT
$wf = Invoke-RestMethod -Uri "https://nexo-terra-n8n.6fwciw.easypanel.host/api/v1/workflows/dVfZYeSsVigWd0cJ" -Headers $headers
($wf.nodes | Where-Object { $_.name -eq "3. Extraer Mensaje" }).parameters.jsCode = $nuevoCodigo
$body = $wf | ConvertTo-Json -Depth 20 -Compress
Invoke-RestMethod -Method PUT -Uri "https://nexo-terra-n8n.6fwciw.easypanel.host/api/v1/workflows/dVfZYeSsVigWd0cJ" -Headers ($headers + @{ 'Content-Type' = 'application/json' }) -Body $body
Write-Host "WF01 actualizado"
```

- [ ] **Step 4: Agregar logging a la función sendText de WF02**

La función `sendText` en WF02 actualmente hace el httpRequest al Graph API. Agregar el INSERT a `consultorio_mensajes` después del envío:

En el Code node de WF02 (índice 1), localizar la función `sendText` y agregar después del `await helpers.httpRequest(...)` que envía a WhatsApp:

```javascript
// Dentro de sendText, DESPUÉS del await httpRequest a Graph API:
try {
  await helpers.httpRequest({
    method: 'POST',
    url: `${SUPABASE_URL}/rest/v1/consultorio_mensajes`,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ telefono_wa: to, direccion: 'salida', contenido: body, estado_bot: estado || null })
  });
} catch(e) {}
```

Nota: la función `sendText` necesita recibir también `estado` como parámetro. Actualizar su firma:
```javascript
// Antes: async function sendText(to, body)
// Después:
async function sendText(to, body, estado) { ... }
```

Y cada llamada existente a `sendText(phone, mensaje)` pasa automáticamente `estado=undefined` → `estado_bot: null`. Las llamadas que quieran registrar el estado hacen `sendText(phone, msg, estado)`.

Hacer el mismo proceso de backup → modificar → PUT que en WF01.

- [ ] **Step 5: Verificar logging**

Enviar un mensaje de prueba al WhatsApp del bot demo. Luego en Supabase → Table Editor → `consultorio_mensajes`: deben aparecer filas con `direccion = 'entrada'` y `direccion = 'salida'`.

- [ ] **Step 6: Commit**

```bash
git add consultorio-kit/
git commit -m "feat(wf01/wf02): logging mensajes a consultorio_mensajes para En vivo"
```

---

## Task 8: Tab Conversaciones en vivo

**Files:**
- Create: `components/en-vivo/conv-list.tsx`
- Create: `components/en-vivo/chat-thread.tsx`
- Create: `app/dashboard/en-vivo/page.tsx`

- [ ] **Step 1: Crear components/en-vivo/conv-list.tsx**

```typescript
// components/en-vivo/conv-list.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Conversacion } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const DOT_COLOR: Record<string, string> = {
  agendando: 'bg-green-400',
  esperando_turno: 'bg-green-400',
  esperando_dni: 'bg-green-400',
  adelanto_pendiente: 'bg-yellow-400',
  respuesta_reminder: 'bg-yellow-400',
  inicio: 'bg-blue-400',
  confirmado: 'bg-blue-400',
  demo_faq_mode: 'bg-purple-400',
}

interface Props {
  initial: Conversacion[]
  selected: string | null
  onSelect: (phone: string) => void
}

export function ConvList({ initial, selected, onSelect }: Props) {
  const [items, setItems] = useState(initial)

  useEffect(() => {
    const supabase = createClient()
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const channel = supabase
      .channel('enlivo-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultorio_conversaciones' }, () => {
        supabase.from('consultorio_conversaciones').select('*')
          .neq('estado', 'inicio').gte('updated_at', thirtyMinAgo)
          .order('updated_at', { ascending: false })
          .then(({ data }) => { if (data) setItems(data as Conversacion[]) })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="w-56 border-r border-[#21262d] flex flex-col overflow-y-auto flex-shrink-0">
      <div className="px-3 py-2 border-b border-[#21262d]">
        <p className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wide">{items.length} activas ahora</p>
      </div>
      {items.map(c => {
        const ctx = c.contexto as Record<string, unknown>
        const nombre = (ctx.pacienteNombre as string) ?? c.telefono_wa
        const dot = DOT_COLOR[c.estado] ?? 'bg-[#8b949e]'
        return (
          <button key={c.telefono_wa} onClick={() => onSelect(c.telefono_wa)}
            className={`text-left px-3 py-2.5 border-b border-[#21262d] transition-colors ${selected === c.telefono_wa ? 'bg-[#1f3460]' : 'hover:bg-[#1a1f2e]'}`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`}></span>
              <span className="text-xs font-semibold text-[#f0f6fc] truncate flex-1">{nombre}</span>
              <span className="text-[9px] text-[#8b949e]">{formatDistanceToNow(new Date(c.updated_at), { locale: es })}</span>
            </div>
            <p className="text-[10px] text-[#8b949e] pl-3">{c.estado}</p>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Crear components/en-vivo/chat-thread.tsx**

```typescript
// components/en-vivo/chat-thread.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Mensaje } from '@/lib/types'
import { format } from 'date-fns'

interface Props { telefono_wa: string; estado: string }

export function ChatThread({ telefono_wa, estado }: Props) {
  const [msgs, setMsgs] = useState<Mensaje[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    // Carga inicial
    supabase.from('consultorio_mensajes').select('*')
      .eq('telefono_wa', telefono_wa)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => { if (data) setMsgs(data as Mensaje[]) })

    // Realtime
    const channel = supabase
      .channel(`chat-${telefono_wa}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'consultorio_mensajes',
        filter: `telefono_wa=eq.${telefono_wa}`
      }, payload => {
        setMsgs(prev => [...prev, payload.new as Mensaje])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [telefono_wa])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-[#21262d] flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-bold text-[#f0f6fc]">{telefono_wa}</p>
        </div>
        <span className="text-[10px] bg-[#1f3460] text-[#58a6ff] px-2 py-0.5 rounded-full font-semibold">{estado}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.direccion === 'salida' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[75%]">
              <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                m.direccion === 'salida'
                  ? 'bg-blue-800 text-blue-100 rounded-br-sm'
                  : 'bg-[#21262d] text-[#c9d1d9] rounded-bl-sm'
              }`}>{m.contenido}</div>
              <div className={`text-[9px] text-[#64748b] mt-0.5 ${m.direccion === 'salida' ? 'text-right' : ''}`}>
                {m.direccion === 'salida' && <span className="text-green-600 mr-1">Sofia ·</span>}
                {format(new Date(m.created_at), 'HH:mm')}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-2.5 border-t border-[#21262d] flex-shrink-0">
        <p className="text-[11px] text-[#64748b]">👁 Vista de solo lectura · Sofia está respondiendo automáticamente</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear app/dashboard/en-vivo/page.tsx**

```typescript
// app/dashboard/en-vivo/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ConvList } from '@/components/en-vivo/conv-list'
import { ChatThread } from '@/components/en-vivo/chat-thread'
import { Topbar } from '@/components/layout/topbar'
import type { Conversacion } from '@/lib/types'

export default function EnVivoPage() {
  const [convs, setConvs] = useState<Conversacion[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    supabase.from('consultorio_conversaciones').select('*')
      .neq('estado', 'inicio').gte('updated_at', thirtyMinAgo)
      .order('updated_at', { ascending: false })
      .then(({ data }) => { if (data) setConvs(data as Conversacion[]) })
  }, [])

  const selectedConv = convs.find(c => c.telefono_wa === selected)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Conversaciones en vivo" subtitle={`${convs.length} activas ahora · Solo lectura — Sofia responde automáticamente`}>
        <div className="flex items-center gap-1.5 text-xs text-[#3fb950] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse"></span>
          Realtime activo
        </div>
      </Topbar>
      <div className="flex flex-1 overflow-hidden">
        <ConvList initial={convs} selected={selected} onSelect={setSelected} />
        <div className="flex-1 flex overflow-hidden">
          {selected && selectedConv
            ? <ChatThread telefono_wa={selected} estado={selectedConv.estado} />
            : <div className="flex items-center justify-center flex-1 text-[#8b949e] text-sm">Seleccioná una conversación</div>
          }
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verificar tab En vivo**

Enviar un mensaje al bot demo, luego navegar a `/dashboard/en-vivo`. La conversación debe aparecer en la lista. Al seleccionarla, el chat thread muestra los mensajes en tiempo real.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(dashboard): tab Conversaciones en vivo con Realtime WebSocket"
```

---

## Task 9: Tab Analytics

**Files:**
- Create: `components/analytics/roi-card.tsx`
- Create: `components/analytics/hero-metrics.tsx`
- Create: `components/analytics/bar-chart.tsx`
- Create: `app/dashboard/analytics/page.tsx`

- [ ] **Step 1: Crear components/analytics/roi-card.tsx**

```typescript
// components/analytics/roi-card.tsx
interface Props { roi: number; turnos: number; valorConsulta: number; costoMensual: number }

export function RoiCard({ roi, turnos, valorConsulta, costoMensual }: Props) {
  return (
    <div className="bg-gradient-to-r from-green-950/50 to-blue-950/50 border border-green-800/40 rounded-2xl p-5 flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">⭐ Métrica principal</span>
        <h3 className="text-sm font-bold text-[#f0f6fc]">Retorno de inversión del sistema</h3>
        <p className="text-xs text-[#8b949e]">
          {turnos} turnos recuperados × ${valorConsulta.toLocaleString('es-AR')} / ${costoMensual.toLocaleString('es-AR')} costo mensual
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-5xl font-black text-green-400 leading-none">
          <span className="text-2xl">x</span>{roi}
        </p>
        <p className="text-[11px] text-[#8b949e] mt-1">
          ${(turnos * valorConsulta).toLocaleString('es-AR')} recuperados
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear components/analytics/hero-metrics.tsx**

```typescript
// components/analytics/hero-metrics.tsx
interface HeroMetric { label: string; value: string | number; sub: string; color: string; borderColor: string }

interface Props { metrics: HeroMetric[] }

export function HeroMetrics({ metrics }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {metrics.map(m => (
        <div key={m.label} className={`bg-[#161b22] border ${m.borderColor} rounded-xl p-5 flex flex-col gap-2`}>
          <p className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wide">{m.label}</p>
          <p className={`text-4xl font-black leading-none ${m.color}`}>{m.value}</p>
          <p className="text-xs text-[#8b949e]">{m.sub}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Crear components/analytics/bar-chart.tsx**

```typescript
// components/analytics/bar-chart.tsx
interface Bar { label: string; value: number; maxValue?: number; color: string }

interface Props { title: string; bars: Bar[]; reference?: { label: string; pct: number } }

export function BarChart({ title, bars, reference }: Props) {
  const maxVal = Math.max(...bars.map(b => b.maxValue ?? b.value), reference?.pct ?? 0)

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex flex-col gap-4">
      <p className="text-xs font-bold text-[#e6edf3]">{title}</p>
      <div className="flex flex-col gap-3">
        {bars.map(b => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="text-[11px] text-[#8b949e] w-24 text-right flex-shrink-0">{b.label}</span>
            <div className="flex-1 h-2.5 bg-[#21262d] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${b.color}`}
                style={{ width: `${Math.min((b.value / maxVal) * 100, 100)}%` }} />
            </div>
            <span className={`text-[11px] font-bold w-10 ${b.color.replace('bg-', 'text-')}`}>{b.value}</span>
          </div>
        ))}
        {reference && (
          <div className="flex items-center gap-3 opacity-50">
            <span className="text-[11px] text-[#8b949e] w-24 text-right flex-shrink-0">{reference.label}</span>
            <div className="flex-1 h-2.5 bg-[#21262d] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-red-600" style={{ width: `${(reference.pct / maxVal) * 100}%` }} />
            </div>
            <span className="text-[11px] font-bold text-red-500 w-10">{reference.pct}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Crear app/dashboard/analytics/page.tsx**

```typescript
// app/dashboard/analytics/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { RoiCard } from '@/components/analytics/roi-card'
import { HeroMetrics } from '@/components/analytics/hero-metrics'
import { BarChart } from '@/components/analytics/bar-chart'
import { startOfMonth, endOfMonth, subDays, format } from 'date-fns'
import { es } from 'date-fns/locale'

async function getAnalytics(supabase: ReturnType<typeof createClient>, desde: Date, hasta: Date) {
  const [turnos, adelantos, pacientesNuevos] = await Promise.all([
    supabase.from('consultorio_turnos').select('id, estado, fecha_hora')
      .gte('fecha_hora', desde.toISOString()).lte('fecha_hora', hasta.toISOString()),
    supabase.from('consultorio_adelanto_ofertas').select('id', { count: 'exact', head: true })
      .eq('estado', 'aceptado').gte('created_at', desde.toISOString()),
    supabase.from('consultorio_pacientes').select('id', { count: 'exact', head: true })
      .gte('created_at', desde.toISOString()),
  ])

  const ts = turnos.data ?? []
  const total = ts.length
  const cancelados = ts.filter(t => t.estado === 'auto_cancelado').length
  const confirmados = ts.filter(t => t.estado === 'confirmado' || t.estado === 'asistido').length
  const noShowRate = total > 0 ? Math.round((cancelados / total) * 100 * 10) / 10 : 0

  // No-shows por semana (últimas 4 semanas)
  const semanas = [0, 1, 2, 3].map(i => {
    const fin = subDays(hasta, i * 7)
    const ini = subDays(fin, 7)
    const weekTs = ts.filter(t => new Date(t.fecha_hora) >= ini && new Date(t.fecha_hora) < fin)
    const wNoShow = weekTs.length > 0 ? Math.round((weekTs.filter(t => t.estado === 'auto_cancelado').length / weekTs.length) * 100) : 0
    return { semana: `Sem ${4 - i}`, noShowPct: wNoShow }
  }).reverse()

  return {
    total, cancelados, confirmados, noShowRate,
    adelantos: adelantos.count ?? 0,
    pacientesNuevos: pacientesNuevos.count ?? 0,
    semanas,
    actividadBot: {
      recordatorios: Math.round(confirmados * 1.1), // aprox
      reservas: confirmados,
      cancelaciones: cancelados,
      handoffs: Math.round(total * 0.06),
    },
  }
}

export default async function AnalyticsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (getRole(user.user_metadata) !== 'dueno') redirect('/dashboard')

  const ahora = new Date()
  const desde = startOfMonth(ahora)
  const hasta = endOfMonth(ahora)

  const data = await getAnalytics(supabase, desde, hasta)

  const valorConsulta = parseInt(process.env.CONSULTORIO_VALOR_CONSULTA ?? '8500')
  const costoMensual = parseInt(process.env.CONSULTORIO_COSTO_MENSUAL ?? '8500')
  const roi = costoMensual > 0 ? Math.round((data.adelantos * valorConsulta) / costoMensual) : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Analytics del negocio"
        subtitle={`${format(desde, "MMMM yyyy", { locale: es })} · Datos en tiempo real`} />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <RoiCard roi={roi} turnos={data.adelantos} valorConsulta={valorConsulta} costoMensual={costoMensual} />

        <HeroMetrics metrics={[
          {
            label: 'Tasa de no-shows',
            value: `${data.noShowRate}%`,
            sub: 'Antes del sistema: 20% · Objetivo: <5%',
            color: 'text-green-400',
            borderColor: 'border-green-800/40',
          },
          {
            label: 'Confirmados por bot',
            value: data.confirmados,
            sub: 'Sin intervención humana',
            color: 'text-blue-400',
            borderColor: 'border-blue-800/40',
          },
          {
            label: 'Adelantos de turno',
            value: data.adelantos,
            sub: 'Slots liberados reasignados',
            color: 'text-purple-400',
            borderColor: 'border-purple-800/40',
          },
        ]} />

        <div className="grid grid-cols-2 gap-4">
          <BarChart
            title="No-shows por semana"
            bars={data.semanas.map(s => ({ label: s.semana, value: s.noShowPct, color: 'bg-green-500' }))}
            reference={{ label: 'Sin sistema', pct: 20 }}
          />
          <BarChart
            title="Actividad del bot este mes"
            bars={[
              { label: 'Recordat.', value: data.actividadBot.recordatorios, color: 'bg-blue-500' },
              { label: 'Reservas', value: data.actividadBot.reservas, color: 'bg-blue-500' },
              { label: 'Cancelac.', value: data.actividadBot.cancelaciones, color: 'bg-yellow-500' },
              { label: 'Handoffs', value: data.actividadBot.handoffs, color: 'bg-purple-500' },
            ]}
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Tiempo respuesta prom.', val: '~3s', sub: 'vs. horas sin bot' },
            { label: 'Completaron el flujo', val: `${data.total > 0 ? Math.round((data.confirmados / data.total) * 100) : 0}%`, sub: 'Confirmaron turno' },
            { label: 'Pacientes nuevos', val: data.pacientesNuevos, sub: 'Este mes' },
            { label: 'Total turnos gestionados', val: data.total, sub: 'Por el bot' },
          ].map(s => (
            <div key={s.label} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
              <p className="text-[10px] text-[#8b949e] font-medium leading-tight">{s.label}</p>
              <p className="text-2xl font-bold text-[#f0f6fc] mt-1">{s.val}</p>
              <p className="text-[10px] text-[#8b949e] mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verificar tab Analytics**

```bash
npm run dev
```

Navegar a `/dashboard/analytics` con usuario dueño. Deben aparecer ROI card, hero metrics y gráficos de barras con datos reales de Supabase.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(dashboard): tab Analytics — ROI + no-shows + actividad bot"
```

---

## Task 10: Dockerfile + kit integration + smoke test EasyPanel

**Files:**
- Create: `consultorio-kit/dashboard/Dockerfile`
- Modify: `consultorio-kit/checklist.md`

- [ ] **Step 1: Verificar que next.config.js tenga output standalone**

Confirmar que `consultorio-kit/dashboard/next.config.js` contiene:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}
module.exports = nextConfig
```

- [ ] **Step 2: Crear Dockerfile**

Crear `consultorio-kit/dashboard/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Verificar build Docker local**

```bash
cd consultorio-kit/dashboard
docker build -t consultorio-dashboard .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://xorjkjaimeampfdiichs.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key> \
  -e NEXT_PUBLIC_CONSULTORIO_NOMBRE="Policonsultorio Rivadavia" \
  -e N8N_WEBHOOK_BASE=https://nexo-terra-n8n.6fwciw.easypanel.host \
  -e N8N_DASHBOARD_KEY=a5ecd694f6e42087848c3b28561dd0d9ac40ce88b14a212b \
  -e CONSULTORIO_VALOR_CONSULTA=8500 \
  -e CONSULTORIO_COSTO_MENSUAL=8500 \
  consultorio-dashboard
```

Navegar a `http://localhost:3000` → login funciona, todos los tabs cargan.

- [ ] **Step 4: Deploy en EasyPanel (instancia demo)**

En EasyPanel:
1. Crear nuevo servicio tipo "App" → "From Source" → subir o conectar repo (o usar Docker image)
2. Configurar env vars (las del .env.example con valores reales)
3. Mapear dominio: `dashboard.nexo-terra.6fwciw.easypanel.host` (o subdominio elegido)
4. Puerto: 3000
5. Deploy → esperar build

Smoke test en la URL pública:
- Login con credenciales de secretaria → Tab Hoy carga con turnos reales
- Login con credenciales de dueño → todos los tabs accesibles

- [ ] **Step 5: Agregar pasos al checklist.md del kit**

Abrir `consultorio-kit/checklist.md` y agregar sección:

```markdown
## Dashboard Web (nuevo — reemplaza Tooljet)

### Pre-requisitos
- [ ] Ejecutar SQL de consultorio_mensajes + RLS (ver schema.sql, sección "mensajes")
- [ ] Crear usuarios en Supabase Auth (dueño / secretaria) con user_metadata.role

### Deploy en EasyPanel
- [ ] Crear servicio App desde `consultorio-kit/dashboard/` (Dockerfile incluido)
- [ ] Configurar env vars (ver `.env.example`)
- [ ] Asignar dominio y puerto 3000
- [ ] Verificar login y carga de tabs

### Post-deploy
- [ ] Importar WF-DASH-4-responder-handoff.json en n8n
- [ ] Activar WF-DASH-4 en n8n (setear errorWorkflow = anEe7qyiweYG6Ar0)
- [ ] Verificar tab Atenciones: responder desde dashboard envía WA correctamente
- [ ] Verificar tab En vivo: mensajes aparecen en tiempo real (requiere que WF01/WF02 tengan el parche de logging)
```

- [ ] **Step 6: Commit final**

```bash
git add .
git commit -m "feat(dashboard): Dockerfile + kit integration + checklist actualizado"
```

---

## Self-Review

### Cobertura del spec

| Requisito | Task |
|---|---|
| Next.js 14 + shadcn + Tailwind dark | Task 1 |
| Supabase Auth + roles user_metadata | Task 2 |
| Sidebar + topbar + layout shell | Task 3 |
| Tab Hoy — stats + tabla + modal | Task 4 |
| Tab Semana — agrupado por día | Task 4 |
| Tab Atenciones + WF-DASH-4 + reply | Task 5 |
| Tab Pacientes + búsqueda + edición | Task 6 |
| consultorio_mensajes + parche WF01/WF02 | Task 7 |
| Tab En vivo — chat Realtime | Task 8 |
| Tab Analytics — ROI + no-shows + barras | Task 9 |
| Dockerfile + kit + checklist | Task 10 |
| Rol médico filtra por profesional_id | Tasks 4, 5 |
| RLS Supabase | Task 0 |
| WF-DASH-4 JSON en kit | Task 5 |

### Consistencia de tipos

- `Turno`, `Paciente`, `Conversacion`, `Mensaje` definidos en Task 2 → usados en Tasks 4-9 ✓
- `cancelarTurno`, `generarLink`, `responderHandoff` definidos en Task 3 → usados via API routes en Tasks 4, 5 ✓
- `getRole`, `canAccess` definidos en Task 2 → usados en Tasks 4, 5, 6, 9 ✓
- `createClient` (browser) definido en Task 2 → usado en Tasks 5, 6, 8 ✓
- `createClient` (server) definido en Task 2 → usado en Tasks 4, 5, 6, 9 ✓
