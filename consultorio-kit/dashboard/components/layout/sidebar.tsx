'use client'
// components/layout/sidebar.tsx
import Image from 'next/image'
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
  { href: '/dashboard/campanas', label: 'Campañas', icon: '📣', roles: ['dueno'] as UserRole[] },
  { href: '/dashboard/demos', label: 'Demos', icon: '🎯', roles: ['dueno'] as UserRole[] },
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
      {/* Client header */}
      <div className="px-4 py-4 border-b border-[#21262d] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1B3D8F] to-[#2563eb] flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-white">
            {(process.env.NEXT_PUBLIC_CONSULTORIO_NOMBRE ?? 'C').slice(0, 1)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#f0f6fc] leading-tight truncate">{process.env.NEXT_PUBLIC_CONSULTORIO_NOMBRE ?? 'Consultorio'}</p>
          <p className="text-[9px] text-[#8b949e] mt-0.5">Panel de Gestión</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const count = item.badge ? badges?.[item.badge as 'atenciones' | 'enlivo'] ?? 0 : 0
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors ${
                active ? 'bg-[#172554] text-[#4BA3F5] font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'
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

      {/* Footer */}
      <div className="border-t border-[#21262d]">
        {/* User row */}
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#172554] flex items-center justify-center text-[11px] font-bold text-[#4BA3F5] flex-shrink-0">
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
        {/* Nexo Terra brand */}
        <div className="px-4 pb-3 flex items-center gap-1.5">
          <Image src="/nexo-terra-logo.png" alt="" width={13} height={13} className="object-contain brightness-0 invert opacity-25 flex-shrink-0" />
          <span className="text-[9px] text-[#3d444d]">by <span className="text-[#4BA3F5] opacity-60 font-medium">Nexo Terra</span></span>
        </div>
      </div>
    </aside>
  )
}
