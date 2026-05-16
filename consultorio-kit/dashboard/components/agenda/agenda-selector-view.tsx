'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WeeklyCalendar } from './weekly-calendar'
import type { Bloqueo } from './weekly-calendar'
import type { Turno } from '@/lib/types'
import { format, addDays, startOfDay } from 'date-fns'

interface Profesional { id: string; nombre: string; especialidad: string }

interface Props { profesionales: Profesional[] }

export function AgendaSelectorView({ profesionales }: Props) {
  const [profId, setProfId] = useState(profesionales[0]?.id ?? '')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([])
  const [loading, setLoading] = useState(false)

  const desde = startOfDay(new Date())
  const hasta = addDays(desde, 7)

  useEffect(() => {
    if (!profId) return
    setLoading(true)
    const supabase = createClient()
    const fechaDesde = format(desde, 'yyyy-MM-dd')
    const fechaHasta = format(hasta, 'yyyy-MM-dd')

    Promise.all([
      supabase
        .from('consultorio_turnos')
        .select('*, consultorio_pacientes(nombre,dni,telefono_wa,obra_social), consultorio_profesionales(nombre,especialidad)')
        .eq('profesional_id', profId)
        .gte('fecha_hora', desde.toISOString())
        .lt('fecha_hora', hasta.toISOString())
        .not('estado', 'in', '("cancelado","auto_cancelado")')
        .order('fecha_hora', { ascending: true }),
      supabase
        .from('consultorio_bloqueos')
        .select('*')
        .eq('profesional_id', profId)
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta),
    ]).then(([turnosRes, bloqueosRes]) => {
      setTurnos((turnosRes.data ?? []) as Turno[])
      setBloqueos((bloqueosRes.data ?? []) as Bloqueo[])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profId])

  const prof = profesionales.find(p => p.id === profId)

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-[#8b949e] shrink-0">Profesional</label>
        <select
          value={profId}
          onChange={e => setProfId(e.target.value)}
          className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] transition-colors"
        >
          {profesionales.map(p => (
            <option key={p.id} value={p.id}>{p.nombre} · {p.especialidad}</option>
          ))}
        </select>
        {loading && <span className="text-xs text-[#8b949e]">Cargando…</span>}
      </div>

      {prof && !loading && (
        <div className="flex-1 min-h-0">
          <WeeklyCalendar
            turnos={turnos}
            bloqueos={bloqueos}
            profesionalId={profId}
            desde={desde.toISOString()}
          />
        </div>
      )}
    </div>
  )
}
