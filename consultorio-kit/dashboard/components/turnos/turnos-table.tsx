'use client'
import { useState } from 'react'
import type { Turno } from '@/lib/types'
import { TurnoModal } from './turno-modal'
import { NuevoTurnoModal } from './nuevo-turno-modal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADO_CONFIG = {
  agendado:      { label: 'Agendado',   color: 'bg-blue-950 text-blue-400 border-blue-800' },
  confirmado:    { label: 'Confirmado', color: 'bg-green-950 text-green-400 border-green-800' },
  cancelado:     { label: 'Cancelado',  color: 'bg-red-950 text-red-400 border-red-800' },
  auto_cancelado:{ label: 'Cancelado',  color: 'bg-red-950 text-red-400 border-red-800' },
  asistido:      { label: 'Asistido',   color: 'bg-purple-950 text-purple-400 border-purple-800' },
} as const

function getTiempoStatus(fechaHora: Date, estado: string) {
  if (estado === 'asistido' || estado === 'cancelado' || estado === 'auto_cancelado') return 'neutro'
  const now = new Date()
  const diffMin = (fechaHora.getTime() - now.getTime()) / 60000
  if (diffMin >= -30 && diffMin <= 30) return 'en_curso'
  if (diffMin > 30 && diffMin <= 120) return 'proximo'
  if (diffMin < -30) return 'pasado'
  return 'neutro'
}

const TIEMPO_ROW: Record<string, string> = {
  en_curso: 'bg-amber-950/40 border-l-2 border-l-amber-500',
  proximo:  'border-l-2 border-l-blue-700',
  pasado:   'opacity-50',
  neutro:   '',
}

const TIEMPO_BADGE: Record<string, string> = {
  en_curso: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
  proximo:  'bg-blue-950 text-blue-400 border border-blue-800',
  pasado:   '',
  neutro:   '',
}

const TIEMPO_LABEL: Record<string, string> = {
  en_curso: 'En curso',
  proximo:  'Próximo',
  pasado:   '',
  neutro:   '',
}

interface Props {
  turnos: Turno[]
  showDate?: boolean
  canCreate?: boolean
  showLink?: boolean
}

export function TurnosTable({ turnos, showDate = false, canCreate = false, showLink = true }: Props) {
  const [selected, setSelected] = useState<Turno | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)

  return (
    <>
      {canCreate && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setShowNuevo(true)}
            className="bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
            + Nuevo turno
          </button>
        </div>
      )}
      <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0d1117] text-[11px] font-semibold text-[#8b949e] uppercase tracking-wide">
              <th className="text-left px-4 py-3">Hora{showDate ? ' / Fecha' : ''}</th>
              <th className="text-left px-4 py-3">Paciente</th>
              <th className="text-left px-4 py-3">Especialidad</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {turnos.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-[#8b949e] text-sm">Sin turnos para este período</td></tr>
            )}
            {turnos.map(t => {
              const fecha = new Date(t.fecha_hora)
              const cfg = ESTADO_CONFIG[t.estado] ?? ESTADO_CONFIG.agendado
              const tiempo = getTiempoStatus(fecha, t.estado)
              return (
                <tr key={t.id} className={`border-t border-[#21262d] hover:bg-[#1a1f2e] transition-colors ${TIEMPO_ROW[tiempo]}`}>
                  <td className="px-4 py-3 text-sm font-mono text-[#e6edf3]">
                    <div className="flex items-center gap-2">
                      {showDate
                        ? format(fecha, "d/MM · HH:mm", { locale: es })
                        : format(fecha, 'HH:mm')}
                      {TIEMPO_LABEL[tiempo] && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${TIEMPO_BADGE[tiempo]}`}>
                          {tiempo === 'en_curso' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                          {TIEMPO_LABEL[tiempo]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#e6edf3]">{t.consultorio_pacientes?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#8b949e]">{t.consultorio_profesionales?.especialidad ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(t)}
                      className="text-xs bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] rounded-md px-3 py-1 transition-colors">
                      Ver
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && <TurnoModal turno={selected} onClose={() => setSelected(null)} showLink={showLink} />}
      {showNuevo && <NuevoTurnoModal onClose={() => setShowNuevo(false)} />}
    </>
  )
}
