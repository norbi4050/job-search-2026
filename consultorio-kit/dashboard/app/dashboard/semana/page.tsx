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
  const turnosList = (turnos ?? []) as Turno[]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Próxima semana"
        subtitle={`${format(desde, "d 'de' MMM", { locale: es })} → ${format(hasta, "d 'de' MMM", { locale: es })} · ${turnosList.length} turno${turnosList.length !== 1 ? 's' : ''}`}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <TurnosTable turnos={turnosList} showDate={true} />
      </div>
    </div>
  )
}
