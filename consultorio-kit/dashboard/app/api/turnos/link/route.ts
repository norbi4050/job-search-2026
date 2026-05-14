import { NextResponse } from 'next/server'
import { generarLink } from '@/lib/n8n'

export async function POST(req: Request) {
  const { turno_id } = await req.json()
  try {
    const data = await generarLink(turno_id)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
