// components/campanas/nueva-campana-modal.tsx
'use client'
import { useState } from 'react'
import type { Campana } from '@/lib/types'

const TEMPLATES = [
  { key: 'reactivacion', label: 'Reactivación', desc: 'Para pacientes que no vienen hace tiempo. Incluye botón de booking.' },
  { key: 'control_anual', label: 'Control anual', desc: 'Recordatorio de chequeo anual. Incluye botón de booking.' },
  { key: 'libre', label: 'Mensaje libre', desc: 'Texto personalizado (máx. 100 chars). Sin botón.' },
]

const AUDIENCIAS = [
  { key: 'todos', label: 'Todos los pacientes' },
  { key: 'especialidad', label: 'Por especialidad' },
  { key: 'dormidos', label: 'Dormidos más de X días' },
]

interface Props {
  onClose: () => void
  onCreated: (c: Campana) => void
}

export function NuevaCampanaModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1)
  const [template, setTemplate] = useState('')
  const [audiencia, setAudiencia] = useState('todos')
  const [audienciaValor, setAudienciaValor] = useState('')
  const [mensajeCustom, setMensajeCustom] = useState('')
  const [nombre, setNombre] = useState('')
  const [programar, setProgramar] = useState(false)
  const [programadaPara, setProgramadaPara] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(campanaId: string) {
    const res = await fetch('/api/campanas/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campana_id: campanaId }),
    })
    if (!res.ok) setError('Campaña creada pero no se pudo enviar. Intentá de nuevo.')
    else onClose()
  }

  async function crear() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/campanas/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre || `Campaña ${new Date().toLocaleDateString('es-AR')}`,
          template_key: template,
          audiencia_tipo: audiencia,
          audiencia_valor: audienciaValor || null,
          mensaje_custom: template === 'libre' ? mensajeCustom : null,
          programada_para: programar && programadaPara ? new Date(programadaPara).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (!programar) {
        await enviar(data.campana.id)
      } else {
        onCreated(data.campana)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear campaña')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#21262d]">
          <div>
            <h2 className="text-sm font-bold text-[#f0f6fc]">Nueva campaña</h2>
            <p className="text-xs text-[#8b949e] mt-0.5">Paso {step} de 4</p>
          </div>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3] text-lg leading-none">✕</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 min-h-[280px]">
          {step === 1 && (
            <>
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">Elegí el template</p>
              {TEMPLATES.map(t => (
                <button key={t.key} onClick={() => setTemplate(t.key)}
                  className={`text-left p-4 rounded-xl border-2 transition-colors ${template === t.key ? 'border-[#4BA3F5] bg-[#172554]' : 'border-[#30363d] hover:border-[#4BA3F5]/40'}`}>
                  <p className="text-sm font-semibold text-[#f0f6fc]">{t.label}</p>
                  <p className="text-xs text-[#8b949e] mt-0.5">{t.desc}</p>
                </button>
              ))}
              {template === 'libre' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#8b949e]">Mensaje personalizado <span className="font-normal">(máx. 100 chars)</span></label>
                  <textarea value={mensajeCustom} onChange={e => setMensajeCustom(e.target.value.slice(0, 100))}
                    rows={3} maxLength={100}
                    className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5] resize-none"
                    placeholder="Ej: Ya llegaron los turnos de invierno. ¡Agendá el tuyo!" />
                  <p className="text-xs text-[#8b949e] text-right">{mensajeCustom.length}/100</p>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">Audiencia</p>
              {AUDIENCIAS.map(a => (
                <button key={a.key} onClick={() => setAudiencia(a.key)}
                  className={`text-left p-3 rounded-xl border-2 transition-colors ${audiencia === a.key ? 'border-[#4BA3F5] bg-[#172554]' : 'border-[#30363d] hover:border-[#4BA3F5]/40'}`}>
                  <p className="text-sm font-semibold text-[#f0f6fc]">{a.label}</p>
                </button>
              ))}
              {audiencia === 'especialidad' && (
                <input value={audienciaValor} onChange={e => setAudienciaValor(e.target.value)}
                  placeholder="Ej: Cardiología"
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5]" />
              )}
              {audiencia === 'dormidos' && (
                <div className="flex items-center gap-2">
                  <input type="number" value={audienciaValor} onChange={e => setAudienciaValor(e.target.value)}
                    placeholder="180" min="7" max="365"
                    className="w-24 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5]" />
                  <span className="text-sm text-[#8b949e]">días sin visitar</span>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">Preview del mensaje</p>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
                <p className="text-xs text-[#8b949e] mb-2 font-medium">Así verá el mensaje el paciente:</p>
                {template === 'reactivacion' && (
                  <p className="text-sm text-[#e6edf3] leading-relaxed">Hola <strong>Juan</strong>, hace tiempo que no te vemos en <strong>Policonsultorio Rivadavia</strong>. ¿Querés agendar un turno? 👇</p>
                )}
                {template === 'control_anual' && (
                  <p className="text-sm text-[#e6edf3] leading-relaxed">Hola <strong>Juan</strong>, es hora de tu control anual en <strong>Policonsultorio Rivadavia</strong>. ¿Lo agendamos? 👇</p>
                )}
                {template === 'libre' && (
                  <p className="text-sm text-[#e6edf3] leading-relaxed">Hola <strong>Juan</strong>, <strong>Policonsultorio Rivadavia</strong> te informa: {mensajeCustom || <em className="text-[#8b949e]">mensaje personalizado</em>}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#8b949e]">Nombre de la campaña</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder={`Campaña ${new Date().toLocaleDateString('es-AR')}`}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5]" />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">¿Cuándo enviamos?</p>
              {[
                { key: false, label: 'Enviar ahora' },
                { key: true, label: 'Programar para después' },
              ].map(opt => (
                <button key={String(opt.key)} onClick={() => setProgramar(opt.key)}
                  className={`text-left p-3 rounded-xl border-2 transition-colors ${programar === opt.key ? 'border-[#4BA3F5] bg-[#172554]' : 'border-[#30363d] hover:border-[#4BA3F5]/40'}`}>
                  <p className="text-sm font-semibold text-[#f0f6fc]">{opt.label}</p>
                </button>
              ))}
              {programar && (
                <input type="datetime-local" value={programadaPara} onChange={e => setProgramadaPara(e.target.value)}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5]" />
              )}
              {error && <p className="text-xs text-red-400">{error}</p>}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#21262d] flex items-center justify-between gap-3">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            {step === 1 ? 'Cancelar' : '← Atrás'}
          </button>
          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !template}
              className="bg-[#1B3D8F] hover:bg-[#2251c5] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Siguiente →
            </button>
          ) : (
            <button onClick={crear} disabled={saving}
              className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Creando…' : 'Confirmar y enviar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
