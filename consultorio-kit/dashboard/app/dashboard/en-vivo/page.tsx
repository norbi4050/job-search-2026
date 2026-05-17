import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRole, canAccess } from '@/lib/auth'
import { EnVivoPageClient } from './en-vivo-client'

export default async function EnVivoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = getRole(user.user_metadata)
  if (!canAccess(role, 'en-vivo')) redirect('/dashboard')

  return <EnVivoPageClient />
}
