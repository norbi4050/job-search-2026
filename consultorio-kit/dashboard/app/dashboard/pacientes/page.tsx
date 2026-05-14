// app/dashboard/pacientes/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { PacientesTable } from '@/components/pacientes/pacientes-table'
import type { Paciente } from '@/lib/types'

export default async function PacientesPage() {
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
  if (role === 'medico') redirect('/dashboard')

  const { data: pacientes } = await supabase
    .from('consultorio_pacientes')
    .select('id, nombre, dni, telefono_wa, obra_social')
    .order('nombre', { ascending: true })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Pacientes" subtitle={`${pacientes?.length ?? 0} pacientes registrados`} />
      <div className="flex-1 overflow-y-auto p-6">
        <PacientesTable initial={(pacientes ?? []) as Paciente[]} />
      </div>
    </div>
  )
}
