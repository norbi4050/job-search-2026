// components/turnos/turno-modal.tsx
'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Turno } from '@/lib/types'

interface Props { turno: Turno; onClose: () => void; showLink?: boolean }

export function TurnoModal({ turno, onClose, showLink = true }: Props) {
  const [loading, setLoading] = useState<'cancelar' | 'link' | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCancelar() {
    setLoading('cancelar')
    const res = await fetch('/api/turnos/cancelar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno_id: turno.id }),
    })
    if (res.ok) { onClose() } else { setError('No se pudo cancelar'); setLoading(null) }
  }

  async function handleLink() {
    setLoading('link')
    setError(null)
    const res = await fetch('/api/turnos/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno_id: turno.id }),
    })
    if (!res.ok) {
      setError('No se pudo generar el link')
      setLoading(null)
      return
    }
    const data = await res.json()
    setLink(data.link ?? data.url ?? null)
    setLoading(null)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-md flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-[#f0f6fc]">{turno.consultorio_pacientes?.nombre ?? 'Paciente'}</h2>
            <p className="text-xs text-[#8b949e] mt-0.5">{turno.consultorio_pacientes?.telefono_wa}</p>
          </div>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3] text-lg">✕</button>
        </div>

        <div className="bg-[#0d1117] rounded-xl p-4 flex flex-col gap-2 text-xs">
          {[
            ['Fecha y hora', format(new Date(turno.fecha_hora), "EEEE d 'de' MMMM · HH:mm", { locale: es })],
            ['Especialidad', turno.consultorio_profesionales?.especialidad ?? '—'],
            ['Médico', turno.consultorio_profesionales?.nombre ?? '—'],
            ['Obra social', turno.consultorio_pacientes?.obra_social ?? '—'],
            ['DNI', turno.consultorio_pacientes?.dni ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-[#8b949e] w-24 flex-shrink-0">{k}</span>
              <span className="text-[#e6edf3] font-medium">{v}</span>
            </div>
          ))}
        </div>

        {link && (
          <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3">
            <p className="text-xs text-[#8b949e] mb-1">Link de check-in generado:</p>
            <p className="text-xs text-blue-400 break-all font-mono">{link}</p>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        {turno.estado !== 'cancelado' && turno.estado !== 'auto_cancelado' && (
          <div className="flex gap-2">
            {showLink && (
              <button onClick={handleLink} disabled={!!loading}
                className="flex-1 bg-[#21262d] border border-[#30363d] text-[#e6edf3] rounded-lg py-2 text-xs font-semibold hover:bg-[#2d3748] transition-colors disabled:opacity-60">
                {loading === 'link' ? 'Generando…' : '🔗 Link check-in'}
              </button>
            )}
            <button onClick={handleCancelar} disabled={!!loading}
              className={`bg-red-950/40 border border-red-800/40 text-red-400 rounded-lg py-2 text-xs font-semibold hover:bg-red-900/40 transition-colors disabled:opacity-60 ${showLink ? 'flex-1' : 'w-full'}`}>
              {loading === 'cancelar' ? 'Cancelando…' : '✕ Cancelar turno'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
