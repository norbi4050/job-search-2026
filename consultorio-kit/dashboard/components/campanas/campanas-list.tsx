// components/campanas/campanas-list.tsx
import type { Campana } from '@/lib/types'
import { CampanaEstadoBadge } from './campana-estado-badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TEMPLATE_LABELS: Record<string, string> = {
  reactivacion: 'Reactivación',
  control_anual: 'Control anual',
  libre: 'Mensaje libre',
}

interface Props { campanas: Campana[]; onNueva: () => void }

export function CampanasList({ campanas, onNueva }: Props) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#f0f6fc]">Campañas</h2>
          <p className="text-xs text-[#8b949e] mt-0.5">{campanas.length} campaña{campanas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onNueva}
          className="bg-[#1B3D8F] hover:bg-[#2251c5] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
          + Nueva campaña
        </button>
      </div>

      {campanas.length === 0 ? (
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-10 text-center">
          <p className="text-[#8b949e] text-sm">Todavía no hay campañas.</p>
          <p className="text-[#8b949e] text-xs mt-1">Creá una para enviar mensajes masivos a tus pacientes.</p>
        </div>
      ) : (
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0d1117] text-[11px] font-semibold text-[#8b949e] uppercase tracking-wide">
                <th className="text-left px-5 py-3">Nombre</th>
                <th className="text-left px-5 py-3">Template</th>
                <th className="text-left px-5 py-3">Fecha</th>
                <th className="text-right px-5 py-3">Enviados</th>
                <th className="text-left px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {campanas.map(c => (
                <tr key={c.id} className="border-t border-[#21262d] hover:bg-[#1a1f2e] transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-[#e6edf3]">{c.nombre}</td>
                  <td className="px-5 py-3 text-sm text-[#8b949e]">{TEMPLATE_LABELS[c.template_key] ?? c.template_key}</td>
                  <td className="px-5 py-3 text-sm text-[#8b949e]">
                    {c.programada_para
                      ? format(new Date(c.programada_para), "d MMM HH:mm", { locale: es })
                      : format(new Date(c.created_at), "d MMM", { locale: es })}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-[#8b949e]">{c.total_destinatarios}</td>
                  <td className="px-5 py-3"><CampanaEstadoBadge estado={c.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
