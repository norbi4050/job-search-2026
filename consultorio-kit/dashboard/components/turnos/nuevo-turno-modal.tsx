// components/turnos/nuevo-turno-modal.tsx
'use client'
import { useState } from 'react'

interface Props { onClose: () => void }

export function NuevoTurnoModal({ onClose }: Props) {
  const [form, setForm] = useState({
    nombre: '', dni: '', telefono_wa: '', obra_social: '', profesional_id: '', fecha_hora: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const fields: { key: keyof typeof form; label: string; type?: string; placeholder?: string }[] = [
    { key: 'nombre', label: 'Nombre del paciente', placeholder: 'Juan García' },
    { key: 'dni', label: 'DNI', placeholder: '12345678' },
    { key: 'telefono_wa', label: 'Teléfono WhatsApp', placeholder: '5491112345678' },
    { key: 'obra_social', label: 'Obra social', placeholder: 'OSDE / Particular' },
    { key: 'profesional_id', label: 'ID del profesional (UUID)', placeholder: 'xxxxxxxx-xxxx-xxxx-...' },
    { key: 'fecha_hora', label: 'Fecha y hora', type: 'datetime-local' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-md flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#f0f6fc]">Nuevo turno</h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]">&#x2715;</button>
        </div>
        {fields.map(f => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#8b949e]">{f.label}</label>
            <input
              type={f.type ?? 'text'}
              value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] transition-colors"
            />
          </div>
        ))}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button onClick={submit} disabled={loading}
          className="bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-60">
          {loading ? 'Creando turno…' : '+ Crear turno'}
        </button>
      </div>
    </div>
  )
}
