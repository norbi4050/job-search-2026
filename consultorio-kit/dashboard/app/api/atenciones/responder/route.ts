import { NextResponse } from 'next/server'
import { responderHandoff } from '@/lib/n8n'

export async function POST(req: Request) {
  let body: { telefono_wa?: unknown; mensaje?: unknown; cerrar?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { telefono_wa, mensaje, cerrar } = body
  if (!telefono_wa || typeof telefono_wa !== 'string' || !mensaje || typeof mensaje !== 'string') {
    return NextResponse.json({ error: 'telefono_wa y mensaje son requeridos' }, { status: 400 })
  }
  try {
    const data = await responderHandoff({ telefono_wa, mensaje, cerrar: cerrar === true })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
}
