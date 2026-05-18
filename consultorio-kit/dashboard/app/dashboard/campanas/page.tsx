// app/dashboard/campanas/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { CampanasClient } from './campanas-client'
import type { Campana } from '@/lib/types'

export default async function CampanasPage() {
  const supabase = createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch { redirect('/login') }
  if (!user) redirect('/login')
  if (getRole(user.user_metadata) !== 'dueno') redirect('/dashboard')

  const { data: campanas } = await supabase
    .from('consultorio_campanas')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Campañas" subtitle="Mensajes masivos para tus pacientes" />
      <div className="flex-1 overflow-y-auto p-6">
        <CampanasClient initial={(campanas ?? []) as Campana[]} />
      </div>
    </div>
  )
}
