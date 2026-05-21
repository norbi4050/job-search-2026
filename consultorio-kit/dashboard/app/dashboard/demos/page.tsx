import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { DemosClient } from './demos-client'

export default async function DemosPage() {
  const supabase = createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch { redirect('/login') }
  if (!user) redirect('/login')
  if (getRole(user.user_metadata) !== 'dueno') redirect('/dashboard')

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: sessions } = await supabase
    .from('consultorio_demo_sessions')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Demos" subtitle="Sesiones de ventas con prospectos" />
      <div className="flex-1 overflow-y-auto p-6">
        <DemosClient initial={sessions ?? []} />
      </div>
    </div>
  )
}
