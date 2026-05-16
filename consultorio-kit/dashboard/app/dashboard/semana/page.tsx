// app/dashboard/semana/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole, getProfesionalId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { WeeklyCalendar } from '@/components/agenda/weekly-calendar'
import { AgendaSelectorView } from '@/components/agenda/agenda-selector-view'
import type { Turno } from '@/lib/types'
import type { Bloqueo } from '@/components/agenda/weekly-calendar'
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
  const subtitle = `${format(desde, "d 'de' MMM", { locale: es })} → ${format(hasta, "d 'de' MMM", { locale: es })}`

  // Vista médico: calendario propio
  if (role === 'medico' && profId) {
    const [turnosRes, bloqueosRes] = await Promise.all([
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
        .gte('fecha', format(desde, 'yyyy-MM-dd'))
        .lte('fecha', format(hasta, 'yyyy-MM-dd')),
    ])

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Topbar title="Mi agenda semanal" subtitle={subtitle} />
        <div className="flex-1 overflow-y-auto p-4">
          <WeeklyCalendar
            turnos={(turnosRes.data ?? []) as Turno[]}
            bloqueos={(bloqueosRes.data ?? []) as Bloqueo[]}
            profesionalId={profId}
            desde={desde.toISOString()}
          />
        </div>
      </div>
    )
  }

  // Vista secretaria/admin: calendario con selector de profesional
  const { data: profesionales } = await supabase
    .from('consultorio_profesionales')
    .select('id, nombre, especialidad')
    .eq('activo', true)
    .order('nombre')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Agenda semanal" subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto p-4">
        <AgendaSelectorView profesionales={profesionales ?? []} />
      </div>
    </div>
  )
}
