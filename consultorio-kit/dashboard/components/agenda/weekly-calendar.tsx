'use client'
import { useState } from 'react'
import { format, addDays, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Turno } from '@/lib/types'
import { TurnoModal } from '@/components/turnos/turno-modal'

export interface Bloqueo {
  id: string
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  motivo: string | null
}

interface Props {
  turnos: Turno[]
  bloqueos: Bloqueo[]
  profesionalId: string
  desde: string
}

const ESTADO_COLOR: Record<string, string> = {
  agendado:       'bg-blue-950/60 border-blue-800/50 text-blue-300',
  confirmado:     'bg-green-950/60 border-green-800/50 text-green-300',
  asistido:       'bg-purple-950/60 border-purple-800/50 text-purple-300',
  cancelado:      'bg-red-950/40 border-red-900/40 text-red-400 opacity-50',
  auto_cancelado: 'bg-red-950/40 border-red-900/40 text-red-400 opacity-50',
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-[#0d1117] border border-[#30363d] rounded-md px-2 py-1 text-xs text-[#e6edf3] outline-none focus:border-[#58a6ff] w-24"
    />
  )
}

export function WeeklyCalendar({ turnos, bloqueos: initial, profesionalId, desde }: Props) {
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>(initial)
  const [selected, setSelected] = useState<Turno | null>(null)
  const [addingDia, setAddingDia] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ hora_inicio: '09:00', hora_fin: '10:00' })
  const [loading, setLoading] = useState<string | null>(null)

  const desdeDate = new Date(desde)
  const dias = Array.from({ length: 7 }, (_, i) => addDays(desdeDate, i))

  function bloqueosDia(fecha: Date) {
    const fechaStr = format(fecha, 'yyyy-MM-dd')
    return bloqueos.filter(b => b.fecha === fechaStr)
  }

  function isDiaBloqueado(fecha: Date) {
    return bloqueosDia(fecha).some(b => b.hora_inicio === null)
  }

  async function bloquearDia(fecha: Date) {
    const fechaStr = format(fecha, 'yyyy-MM-dd')
    if (!window.confirm(`¿Bloquear el día ${format(fecha, "EEEE d 'de' MMMM", { locale: es })} completo?`)) return
    setLoading(`dia-${fechaStr}`)
    const res = await fetch('/api/agenda/bloqueos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profesional_id: profesionalId, fecha: fechaStr }),
    })
    if (res.ok) {
      const data = await res.json()
      setBloqueos(prev => [...prev, data])
    }
    setLoading(null)
  }

  async function habilitarDia(fecha: Date) {
    const fechaStr = format(fecha, 'yyyy-MM-dd')
    const todosDelDia = bloqueosDia(fecha)
    setLoading(`dia-${fechaStr}`)
    await Promise.all(
      todosDelDia.map(b =>
        fetch(`/api/agenda/bloqueos/${b.id}`, { method: 'DELETE' })
      )
    )
    setBloqueos(prev => prev.filter(b => b.fecha !== fechaStr))
    setLoading(null)
  }

  async function agregarBloqueoHoras(fecha: Date) {
    const fechaStr = format(fecha, 'yyyy-MM-dd')
    if (!addForm.hora_inicio || !addForm.hora_fin) return
    if (addForm.hora_inicio >= addForm.hora_fin) return
    setLoading(`add-${fechaStr}`)
    const res = await fetch('/api/agenda/bloqueos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profesional_id: profesionalId,
        fecha: fechaStr,
        hora_inicio: addForm.hora_inicio,
        hora_fin: addForm.hora_fin,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setBloqueos(prev => [...prev, data])
    }
    setAddingDia(null)
    setLoading(null)
  }

  async function eliminarBloqueo(id: string) {
    setLoading(`del-${id}`)
    const res = await fetch(`/api/agenda/bloqueos/${id}`, { method: 'DELETE' })
    if (res.ok) setBloqueos(prev => prev.filter(b => b.id !== id))
    setLoading(null)
  }

  return (
    <>
      <div className="grid grid-cols-7 gap-2 h-full min-h-0">
        {dias.map(dia => {
          const fechaStr = format(dia, 'yyyy-MM-dd')
          const diaBloqueado = isDiaBloqueado(dia)
          const bloqueosHora = bloqueosDia(dia).filter(b => b.hora_inicio !== null)
          const turnosDia = turnos
            .filter(t => isSameDay(new Date(t.fecha_hora), dia))
            .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
          const isToday = isSameDay(dia, new Date())
          const isLoading = (key: string) => loading === key

          return (
            <div
              key={fechaStr}
              className={`flex flex-col rounded-xl border overflow-hidden ${
                diaBloqueado
                  ? 'border-red-900/40 bg-red-950/10'
                  : isToday
                    ? 'border-[#58a6ff]/30 bg-[#0d1117]'
                    : 'border-[#21262d] bg-[#161b22]'
              }`}
            >
              {/* Header */}
              <div className={`px-3 py-2 border-b flex items-start justify-between gap-1 ${
                diaBloqueado ? 'border-red-900/40 bg-red-950/20' : 'border-[#21262d] bg-[#0d1117]'
              }`}>
                <div>
                  <p className="text-[10px] text-[#8b949e] font-semibold uppercase tracking-wide">
                    {format(dia, 'EEE', { locale: es })}
                  </p>
                  <p className={`text-sm font-bold leading-tight ${isToday ? 'text-[#58a6ff]' : 'text-[#f0f6fc]'}`}>
                    {format(dia, 'd MMM', { locale: es })}
                  </p>
                  {!diaBloqueado && turnosDia.length > 0 && (
                    <p className="text-[10px] text-[#8b949e]">{turnosDia.length} turno{turnosDia.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
                {diaBloqueado && (
                  <button
                    onClick={() => habilitarDia(dia)}
                    disabled={isLoading(`dia-${fechaStr}`)}
                    className="text-[10px] text-red-400 hover:text-red-300 font-semibold shrink-0 disabled:opacity-50"
                  >
                    Habilitar
                  </button>
                )}
              </div>

              {/* Contenido */}
              <div className="flex-1 flex flex-col p-2 gap-1.5 overflow-y-auto">
                {diaBloqueado ? (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-xs text-red-400/70 font-medium">No disponible</span>
                  </div>
                ) : (
                  <>
                    {/* Turnos */}
                    {turnosDia.length === 0 && bloqueosHora.length === 0 && (
                      <p className="text-[10px] text-[#8b949e] text-center py-3">Sin turnos</p>
                    )}
                    {turnosDia.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelected(t)}
                        className={`w-full text-left border rounded-lg px-2 py-1.5 transition-colors hover:opacity-80 ${ESTADO_COLOR[t.estado] ?? ESTADO_COLOR.agendado}`}
                      >
                        <p className="text-[10px] font-mono font-bold">{format(new Date(t.fecha_hora), 'HH:mm')}</p>
                        <p className="text-[11px] truncate font-medium">{t.consultorio_pacientes?.nombre ?? '—'}</p>
                        {t.consultorio_pacientes?.obra_social && (
                          <p className="text-[10px] opacity-70">{t.consultorio_pacientes.obra_social}</p>
                        )}
                      </button>
                    ))}

                    {/* Bloqueos de horas */}
                    {bloqueosHora.map(b => (
                      <div key={b.id} className="flex items-center gap-1 bg-orange-950/30 border border-orange-900/40 rounded-lg px-2 py-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-mono text-orange-300">
                            {b.hora_inicio?.slice(0, 5)} – {b.hora_fin?.slice(0, 5)}
                          </p>
                          <p className="text-[10px] text-orange-400/70">Bloqueado</p>
                        </div>
                        <button
                          onClick={() => eliminarBloqueo(b.id)}
                          disabled={isLoading(`del-${b.id}`)}
                          className="text-orange-400/60 hover:text-orange-300 text-xs disabled:opacity-40 shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {/* Formulario añadir bloqueo de horas */}
                    {addingDia === fechaStr ? (
                      <div className="border border-[#30363d] rounded-lg p-2 flex flex-col gap-1.5 bg-[#0d1117]">
                        <p className="text-[10px] text-[#8b949e] font-semibold">Bloquear horario</p>
                        <div className="flex flex-col gap-1">
                          <TimeInput value={addForm.hora_inicio} onChange={v => setAddForm(f => ({ ...f, hora_inicio: v }))} />
                          <TimeInput value={addForm.hora_fin} onChange={v => setAddForm(f => ({ ...f, hora_fin: v }))} />
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => agregarBloqueoHoras(dia)}
                            disabled={isLoading(`add-${fechaStr}`)}
                            className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md py-1 text-[10px] font-semibold disabled:opacity-60"
                          >
                            {isLoading(`add-${fechaStr}`) ? '…' : 'Agregar'}
                          </button>
                          <button
                            onClick={() => setAddingDia(null)}
                            className="text-[#8b949e] hover:text-[#e6edf3] text-[10px] px-2"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-auto flex flex-col gap-1">
                        <button
                          onClick={() => bloquearDia(dia)}
                          disabled={isLoading(`dia-${fechaStr}`)}
                          className="text-[10px] text-[#8b949e] hover:text-red-400 border border-dashed border-[#30363d] hover:border-red-900/60 rounded-lg py-1.5 transition-colors disabled:opacity-50"
                        >
                          {isLoading(`dia-${fechaStr}`) ? '…' : '⊘ Bloquear día completo'}
                        </button>
                        <button
                          onClick={() => { setAddingDia(fechaStr); setAddForm({ hora_inicio: '09:00', hora_fin: '10:00' }) }}
                          className="text-[10px] text-[#8b949e] hover:text-[#e6edf3] border border-dashed border-[#30363d] hover:border-[#58a6ff]/50 rounded-lg py-1.5 transition-colors"
                        >
                          + Bloquear horas
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <TurnoModal turno={selected} onClose={() => setSelected(null)} showLink={false} />
      )}
    </>
  )
}
