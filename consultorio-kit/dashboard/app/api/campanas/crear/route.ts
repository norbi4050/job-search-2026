import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { nombre, template_key, audiencia_tipo, audiencia_valor, mensaje_custom, programada_para } = body

  if (!nombre || !template_key || !audiencia_tipo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Calculate destinatarios count
  let count = 0
  if (audiencia_tipo === 'todos') {
    const { count: c } = await supabase
      .from('consultorio_pacientes')
      .select('id', { count: 'exact', head: true })
      .not('telefono_wa', 'is', null)
    count = c ?? 0
  } else if (audiencia_tipo === 'especialidad' && audiencia_valor) {
    const { data: profs } = await supabase
      .from('consultorio_profesionales')
      .select('id')
      .eq('especialidad', audiencia_valor)
    const profIds = (profs ?? []).map(p => p.id)
    if (profIds.length > 0) {
      const { data: pacIds } = await supabase
        .from('consultorio_turnos')
        .select('paciente_id')
        .in('profesional_id', profIds)
      const uniq = Array.from(new Set((pacIds ?? []).map(t => t.paciente_id)))
      const { count: c } = await supabase
        .from('consultorio_pacientes')
        .select('id', { count: 'exact', head: true })
        .in('id', uniq)
      count = c ?? 0
    }
  } else if (audiencia_tipo === 'dormidos' && audiencia_valor) {
    // exact count done by n8n at send time — approximation here
    const { count: c } = await supabase
      .from('consultorio_pacientes')
      .select('id', { count: 'exact', head: true })
      .not('telefono_wa', 'is', null)
    count = c ?? 0
  } else {
    const { count: c } = await supabase
      .from('consultorio_pacientes')
      .select('id', { count: 'exact', head: true })
      .not('telefono_wa', 'is', null)
    count = c ?? 0
  }

  const { data, error } = await supabase
    .from('consultorio_campanas')
    .insert({
      nombre,
      template_key,
      audiencia_tipo,
      audiencia_valor: audiencia_valor || null,
      mensaje_custom: mensaje_custom || null,
      programada_para: programada_para || null,
      total_destinatarios: count,
      estado: 'borrador',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campana: data })
}
