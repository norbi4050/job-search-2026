// components/layout/topbar.tsx
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export function Topbar({ title, subtitle, children }: Props) {
  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es })
  return (
    <div className="px-6 py-4 border-b border-[#21262d] flex items-center justify-between flex-shrink-0 bg-[#0d1117]">
      <div>
        <h1 className="text-base font-bold text-[#f0f6fc]">{title}</h1>
        <p className="text-xs text-[#8b949e] mt-0.5">{subtitle ?? hoy}</p>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
