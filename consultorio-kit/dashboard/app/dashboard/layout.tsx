// app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = getRole(user.user_metadata)
  const userName = user.email?.split('@')[0] ?? 'Usuario'

  const { count: atencionesCount } = await supabase
    .from('consultorio_conversaciones')
    .select('*', { count: 'exact', head: true })
    .eq('handoff_humano', true)

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { count: enVivoCount } = await supabase
    .from('consultorio_conversaciones')
    .select('*', { count: 'exact', head: true })
    .neq('estado', 'inicio')
    .gte('updated_at', thirtyMinAgo)

  return (
    <div className="flex h-screen bg-[#0f1117] overflow-hidden">
      <Sidebar
        role={role}
        userName={userName}
        badges={{ atenciones: atencionesCount ?? 0, enlivo: enVivoCount ?? 0 }}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
