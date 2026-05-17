import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const WA_PHONE_ID = '963190063548521'
const WA_PHONE_RE = /^549\d{10}$/

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { nombre, dni, telefono_wa, obra_social, profesional_id, fecha_hora } = body as Record<string, string>

  if (!nombre || !telefono_wa || !profesional_id || !fecha_hora) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }
  if (!WA_PHONE_RE.test(telefono_wa)) {
    return NextResponse.json({ error: 'Teléfono inválido. Formato: 549 + código de área + número (ej: 5491137936325)' }, { status: 400 })
  }

  const supabase = createClient()

  // 1. Upsert paciente
  const { data: existing } = await supabase
    .from('consultorio_pacientes')
    .select('id')
    .eq('telefono_wa', telefono_wa)
    .maybeSingle()

  let paciente_id: string
  if (existing) {
    paciente_id = existing.id
    await supabase.from('consultorio_pacientes').update({
      nombre,
      ...(dni ? { dni } : {}),
      ...(obra_social ? { obra_social } : {}),
    }).eq('id', paciente_id)
  } else {
    const { data: nuevo, error } = await supabase
      .from('consultorio_pacientes')
      .insert({ nombre, telefono_wa, ...(dni ? { dni } : {}), ...(obra_social ? { obra_social } : {}) })
      .select('id')
      .single()
    if (error || !nuevo) return NextResponse.json({ error: 'Error al crear paciente' }, { status: 500 })
    paciente_id = nuevo.id
  }

  // 2. Crear turno
  const { data: turno, error: turnoErr } = await supabase
    .from('consultorio_turnos')
    .insert({
      paciente_id,
      profesional_id,
      fecha_hora,
      estado: 'agendado',
      tipo_pago: obra_social ? 'obra_social' : 'particular',
    })
    .select('id')
    .single()

  if (turnoErr || !turno) {
    return NextResponse.json({ error: 'Error al crear turno' }, { status: 500 })
  }

  // 3. WhatsApp de confirmación con template turno_recordatorio
  const waToken = process.env.META_WHATSAPP_TOKEN
  if (waToken) {
    try {
      const { data: prof } = await supabase
        .from('consultorio_profesionales')
        .select('nombre')
        .eq('id', profesional_id)
        .single()

      const dt = new Date(fecha_hora)
      const fecha = format(dt, "EEEE d 'de' MMMM", { locale: es })
      const hora = format(dt, 'HH:mm')

      await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefono_wa,
          type: 'template',
          template: {
            name: 'turno_recordatorio',
            language: { code: 'es_AR' },
            components: [{
              type: 'body',
              parameters: [
                { type: 'text', text: nombre },
                { type: 'text', text: fecha },
                { type: 'text', text: hora },
                { type: 'text', text: prof?.nombre ?? '' },
              ],
            }],
          },
        }),
      })
    } catch {
      // El turno se creó igual, el WA falló silenciosamente
    }
  }

  return NextResponse.json({ ok: true, turno_id: turno.id, wa_sent: !!waToken })
}
