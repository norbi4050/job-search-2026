'use client'
// components/layout/sidebar.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'
import type { UserRole } from '@/lib/types'

const NAV = [
  { href: '/dashboard', label: 'Hoy', icon: '📅', roles: ['dueno','secretaria','medico'] as UserRole[] },
  { href: '/dashboard/semana', label: 'Semana', icon: '📆', roles: ['dueno','secretaria','medico'] as UserRole[] },
  { href: '/dashboard/atenciones', label: 'Atenciones', icon: '🤝', roles: ['dueno','secretaria'] as UserRole[], badge: 'atenciones' },
  { href: '/dashboard/pacientes', label: 'Pacientes', icon: '👥', roles: ['dueno','secretaria'] as UserRole[] },
  { href: '/dashboard/en-vivo', label: 'En vivo', icon: '💬', roles: ['dueno'] as UserRole[], badge: 'enlivo' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📊', roles: ['dueno'] as UserRole[] },
]

interface Props {
  role: UserRole
  userName: string
  badges?: { atenciones: number; enlivo: number }
}

export function Sidebar({ role, userName, badges }: Props) {
  const pathname = usePathname()
  const items = NAV.filter(n => n.roles.includes(role))

  return (
    <aside className="w-52 bg-[#161b22] border-r border-[#21262d] flex flex-col flex-shrink-0 h-full">
      <div className="px-4 py-5 border-b border-[#21262d]">
        <p className="text-xs font-bold text-[#f0f6fc]">{process.env.NEXT_PUBLIC_CONSULTORIO_NOMBRE ?? 'Consultorio'}</p>
        <p className="text-[10px] text-[#8b949e] mt-0.5">Panel de Gestión</p>
      </div>

      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const count = item.badge ? badges?.[item.badge as 'atenciones' | 'enlivo'] ?? 0 : 0
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors ${
                active ? 'bg-[#1f3460] text-[#58a6ff] font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'
              }`}>
              <span className="w-5 text-center text-sm">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.badge === 'atenciones' ? 'bg-red-600 text-white' : 'bg-[#2ea043] text-white'
                }`}>{count}</span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-3 border-t border-[#21262d] flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#1f3460] flex items-center justify-center text-[11px] font-bold text-[#58a6ff] flex-shrink-0">
          {userName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#e6edf3] truncate">{userName}</p>
          <p className="text-[10px] text-[#8b949e] capitalize">{role === 'dueno' ? 'Dueño' : role === 'secretaria' ? 'Secretaria' : 'Médico'}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="text-[#8b949e] hover:text-[#e6edf3] text-xs transition-colors" title="Cerrar sesión">⎋</button>
        </form>
      </div>
    </aside>
  )
}
