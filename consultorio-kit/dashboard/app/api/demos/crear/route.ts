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

  if (!nombre_prospecto || !clinic_name || !turnos_dia || !precio_consulta || !profesionales || !tipo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

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
