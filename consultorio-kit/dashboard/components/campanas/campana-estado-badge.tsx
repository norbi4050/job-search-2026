// components/campanas/campana-estado-badge.tsx
type Estado = 'borrador' | 'enviando' | 'completada' | 'cancelada'

const styles: Record<Estado, string> = {
  borrador: 'bg-[#21262d] text-[#8b949e]',
  enviando: 'bg-blue-900/40 text-blue-400',
  completada: 'bg-green-900/40 text-green-400',
  cancelada: 'bg-red-900/40 text-red-400',
}

const labels: Record<Estado, string> = {
  borrador: 'Borrador',
  enviando: 'Enviando…',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

export function CampanaEstadoBadge({ estado }: { estado: string }) {
  const e = (estado as Estado) || 'borrador'
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${styles[e] ?? styles.borrador}`}>
      {labels[e] ?? estado}
    </span>
  )
}
