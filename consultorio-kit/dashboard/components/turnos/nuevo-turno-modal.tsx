'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DateTimePicker } from './date-time-picker'

const OBRAS_SOCIALES = ['OSDE','Swiss Medical','Galeno','IOMA','PAMI','Medifé','Sancor Salud','OSECAC','OSPEDYC','Unión Personal','Particular']

// Argentina móvil: 549 + 10 dígitos = 13 total (ej: 5491137936325)
const WA_PHONE_RE = /^549\d{10}$/

function phoneError(val: string): string | null {
  if (!val) return null
  const clean = val.replace(/[\s\-\+]/g, '')
  if (!/^\d+$/.test(clean)) return 'Solo números, sin espacios ni guiones'
  if (!WA_PHONE_RE.test(clean)) return 'Formato: 549 + código de área + número (ej: 5491137936325)'
  return null
}

interface Profesional { id: string; nombre: string }
interface Props { onClose: () => void; profesionalId?: string }

export function NuevoTurnoModal({ onClose, profesionalId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre: '', dni: '', telefono_wa: '', obra_social: '',
    profesional_id: profesionalId ?? '', fecha_hora: '',
  })
  const [phoneTouched, setPhoneTouched] = useState(false)
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
    const phoneErr = phoneError(form.telefono_wa)
    if (phoneErr) { setPhoneTouched(true); setError(phoneErr); return }
    if (!form.nombre || !form.telefono_wa || !form.profesional_id || !form.fecha_hora) {
      setError('Completá nombre, teléfono, profesional y fecha/hora')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch('/api/turnos/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, telefono_wa: form.telefono_wa.replace(/[\s\-\+]/g, '') }),
    })
    if (res.ok) {
      router.refresh()
      onClose()
    } else {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Error al crear turno')
      setLoading(false)
    }
  }

  const phoneErr = phoneTouched ? phoneError(form.telefono_wa) : null
  const baseInput = "bg-[#0d1117] border rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none transition-colors"
  const inputClass = `${baseInput} border-[#30363d] focus:border-[#58a6ff]`
  const inputErrClass = `${baseInput} border-red-500 focus:border-red-400`
  const selectClass = inputClass

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-md flex flex-col gap-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#f0f6fc]">Nuevo turno</h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]">&#x2715;</button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8b949e]">Nombre del paciente</label>
          <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
            placeholder="Juan García" className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8b949e]">DNI</label>
          <input type="text" value={form.dni} onChange={e => set('dni', e.target.value)}
            placeholder="12345678" className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8b949e]">Teléfono WhatsApp</label>
          <input
            type="text"
            value={form.telefono_wa}
            onChange={e => set('telefono_wa', e.target.value)}
            onBlur={() => setPhoneTouched(true)}
            placeholder="5491137936325"
            className={phoneErr ? inputErrClass : inputClass}
          />
          {phoneErr
            ? <p className="text-[11px] text-red-400">{phoneErr}</p>
            : <p className="text-[11px] text-[#8b949e]">Código de país + 9 + número sin espacios (ej: 5491137936325)</p>
          }
        </div>

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
        <button onClick={submit} disabled={loading || !!phoneErr}
          className="bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-60">
          {loading ? 'Creando turno…' : '+ Crear turno'}
        </button>
      </div>
    </div>
  )
}
