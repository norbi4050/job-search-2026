'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DateTimePicker } from './date-time-picker'

const OBRAS_SOCIALES = ['OSDE','Swiss Medical','Galeno','IOMA','PAMI','Medifé','Sancor Salud','OSECAC','OSPEDYC','Unión Personal','Particular']

interface Profesional { id: string; nombre: string }
interface Props { onClose: () => void; profesionalId?: string }

export function NuevoTurnoModal({ onClose, profesionalId }: Props) {
  const [form, setForm] = useState({
    nombre: '', dni: '', telefono_wa: '', obra_social: '',
    profesional_id: profesionalId ?? '', fecha_hora: '',
  })
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profesionalId) return
    createClient().from('consultorio_profesionales').select('id,nombre').order('nombre')
      .then(({ data }) => { if (data) setProfesionales(data as Profesional[]) })
  }, [profesionalId])

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit() {
    if (!form.nombre || !form.telefono_wa || !form.profesional_id || !form.fecha_hora) {
      setError('Completá nombre, teléfono, profesional y fecha/hora')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch('/api/turnos/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      onClose()
    } else {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Error al crear turno')
      setLoading(false)
    }
  }

  const selectClass = "bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] transition-colors"
  const inputClass = selectClass

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-md flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#f0f6fc]">Nuevo turno</h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]">&#x2715;</button>
        </div>

        {[
          { key: 'nombre', label: 'Nombre del paciente', placeholder: 'Juan García' },
          { key: 'dni', label: 'DNI', placeholder: '12345678' },
          { key: 'telefono_wa', label: 'Teléfono WhatsApp', placeholder: '5491112345678' },
        ].map(f => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#8b949e]">{f.label}</label>
            <input type="text" value={form[f.key as keyof typeof form]}
              onChange={e => set(f.key as keyof typeof form, e.target.value)}
              placeholder={f.placeholder} className={inputClass} />
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8b949e]">Obra social</label>
          <select value={form.obra_social} onChange={e => set('obra_social', e.target.value)} className={selectClass}>
            <option value="">Seleccioná obra social</option>
            {OBRAS_SOCIALES.map(os => <option key={os} value={os}>{os}</option>)}
          </select>
        </div>

        {profesionalId ? null : (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#8b949e]">Profesional</label>
            <select value={form.profesional_id} onChange={e => set('profesional_id', e.target.value)} className={selectClass}>
              <option value="">Seleccioná profesional</option>
              {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8b949e]">Fecha y horario</label>
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
            <DateTimePicker
              profesionalId={form.profesional_id}
              value={form.fecha_hora}
              onChange={val => set('fecha_hora', val)}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        <button onClick={submit} disabled={loading}
          className="bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-60">
          {loading ? 'Creando turno…' : '+ Crear turno'}
        </button>
      </div>
    </div>
  )
}
