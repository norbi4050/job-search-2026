// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole, getProfesionalId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { TurnosTable } from '@/components/turnos/turnos-table'
import type { Turno } from '@/lib/types'

async function getAtencionesPendientes(supabase: ReturnType<typeof createClient>) {
  const { count } = await supabase
    .from('consultorio_conversaciones')
    .select('*', { count: 'exact', head: true })
    .eq('handoff_humano', true)
  return count ?? 0
}

export default async function HoyPage() {
  const supabase = createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    redirect('/login')
  }
  if (!user) redirect('/login')

  const role = getRole(user!.user_metadata)
  const profId = getProfesionalId(user!.user_metadata)

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
  const turnosList = (turnos ?? []) as Turno[]

  const confirmados = turnosList.filter(t => t.estado === 'confirmado' || t.estado === 'asistido').length
  const pendientes = turnosList.filter(t => t.estado === 'agendado').length
  const cancelados = turnosList.filter(t => t.estado === 'cancelado' || t.estado === 'auto_cancelado').length
  const atenciones = await getAtencionesPendientes(supabase)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Turnos de hoy" subtitle={`${turnosList.length} turno${turnosList.length !== 1 ? 's' : ''} programado${turnosList.length !== 1 ? 's' : ''}`}>
        <div className="flex items-center gap-1.5 text-xs text-[#3fb950] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse"></span>
          En vivo
        </div>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Confirmados', val: confirmados, color: 'text-green-400' },
            { label: 'Pendientes', val: pendientes, color: 'text-blue-400' },
            { label: 'Cancelados', val: cancelados, color: 'text-red-400' },
            { label: 'En atención', val: atenciones, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
              <p className="text-[11px] text-[#8b949e] font-medium uppercase tracking-wide">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        <TurnosTable turnos={turnosList} canCreate={role !== 'medico'} showLink={role !== 'medico'} />
      </div>
    </div>
  )
}
