import { NextResponse } from 'next/server'
import { crearPaciente } from '@/lib/n8n'

export async function POST(req: Request) {
  let body: { nombre?: unknown; dni?: unknown; telefono_wa?: unknown; obra_social?: unknown; profesional_id?: unknown; fecha_hora?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { nombre, dni, telefono_wa, obra_social, profesional_id, fecha_hora } = body
  if (!nombre || !telefono_wa || !profesional_id || !fecha_hora ||
      typeof nombre !== 'string' || typeof telefono_wa !== 'string' ||
      typeof profesional_id !== 'string' || typeof fecha_hora !== 'string') {
    return NextResponse.json({ error: 'Campos requeridos: nombre, telefono_wa, profesional_id, fecha_hora' }, { status: 400 })
  }
  try {
    const data = await crearPaciente({
      nombre,
      dni: typeof dni === 'string' ? dni : '',
      telefono_wa,
      obra_social: typeof obra_social === 'string' ? obra_social : '',
      profesional_id,
      fecha_hora,
    })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error al crear turno' }, { status: 500 })
  }
}
