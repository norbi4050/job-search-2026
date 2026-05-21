'use client'
import { useState } from 'react'

interface DemoSession {
  id: string
  code: string
  nombre_prospecto: string
  clinic_name: string
  turnos_dia: number
  precio_consulta: number
  profesionales: number
  secretarias: number
  sueldo_secretaria: number | null
  tipo: 'presencial' | 'remoto'
  estado: 'activo' | 'usado' | 'expirado'
  created_at: string
  expires_at: string
}

function calcROI(s: DemoSession) {
  const turnos_mes = s.turnos_dia * 22
  const noshows_mes = Math.round(turnos_mes * 0.15)
  const recuperados_mes = Math.round(noshows_mes * 0.80)
  const roi_noshows = recuperados_mes * s.precio_consulta
  const sueldo_ref = s.sueldo_secretaria ?? 700000
  const ahorro_admin = Math.round(s.secretarias * sueldo_ref * 0.40)
  return roi_noshows + ahorro_admin
}

const fmtN = (n: number) => n.toLocaleString('es-AR')
const WA_NUMBER = '5491137936325'

export function DemosClient({ initial }: { initial: DemoSession[] }) {
  const [sessions, setSessions] = useState<DemoSession[]>(initial)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre_prospecto: '', clinic_name: '', turnos_dia: '', precio_consulta: '',
    profesionales: '', secretarias: '0', sueldo_secretaria: '', tipo: 'remoto'
  })
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/demos/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          turnos_dia: Number(form.turnos_dia),
          precio_consulta: Number(form.precio_consulta),
          profesionales: Number(form.profesionales),
          secretarias: Number(form.secretarias || 0),
          sueldo_secretaria: form.sueldo_secretaria ? Number(form.sueldo_secretaria) : null,
        })
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Error al crear demo'); return }
      setSessions(prev => [json.session, ...prev])
      setForm({ nombre_prospecto: '', clinic_name: '', turnos_dia: '', precio_consulta: '', profesionales: '', secretarias: '0', sueldo_secretaria: '', tipo: 'remoto' })
      setShowForm(false)
    } catch { setError('Error de red') } finally { setLoading(false) }
  }

  function copyLink(code: string) {
    const link = `https://wa.me/${WA_NUMBER}?text=${code}`
    navigator.clipboard.writeText(link)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  function estadoBadge(s: DemoSession) {
    const expired = new Date(s.expires_at) < new Date()
    const estado = expired ? 'expirado' : s.estado
    const colors: Record<string, string> = {
      activo: 'bg-[#2ea043] text-white',
      usado: 'bg-[#1b3d8f] text-white',
      expirado: 'bg-[#3d444d] text-[#8b949e]'
    }
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colors[estado] || colors.expirado}`}>{estado}</span>
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-[#f0f6fc]">Sesiones de Demo</h2>
          <p className="text-xs text-[#8b949e] mt-0.5">Últimos 30 días</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-xs bg-[#1b3d8f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
        >
          + Nueva Demo
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 mb-6 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Nombre del prospecto *</label>
            <input
              required value={form.nombre_prospecto}
              onChange={e => setForm(v => ({ ...v, nombre_prospecto: e.target.value }))}
              placeholder="Ej: María González"
              className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Nombre de la clínica *</label>
            <input
              required value={form.clinic_name}
              onChange={e => setForm(v => ({ ...v, clinic_name: e.target.value }))}
              placeholder="Ej: Consultorio San Martín"
              className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Turnos por día *</label>
            <input
              required type="number" min="1" value={form.turnos_dia}
              onChange={e => setForm(v => ({ ...v, turnos_dia: e.target.value }))}
              placeholder="20"
              className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Precio por consulta ($) *</label>
            <input
              required type="number" min="1000" value={form.precio_consulta}
              onChange={e => setForm(v => ({ ...v, precio_consulta: e.target.value }))}
              placeholder="40000"
              className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Profesionales *</label>
            <input
              required type="number" min="1" value={form.profesionales}
              onChange={e => setForm(v => ({ ...v, profesionales: e.target.value }))}
              placeholder="3"
              className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Secretarias</label>
            <input
              type="number" min="0" value={form.secretarias}
              onChange={e => setForm(v => ({ ...v, secretarias: e.target.value }))}
              placeholder="0"
              className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Sueldo/secretaria (vacío = $700.000)</label>
            <input
              type="number" min="0" value={form.sueldo_secretaria}
              onChange={e => setForm(v => ({ ...v, sueldo_secretaria: e.target.value }))}
              placeholder="700000"
              className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] uppercase font-semibold">Tipo *</label>
            <select
              value={form.tipo}
              onChange={e => setForm(v => ({ ...v, tipo: e.target.value }))}
              className="w-full mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-xs text-[#f0f6fc] focus:outline-none focus:border-[#4BA3F5]"
            >
              <option value="remoto">Remoto (link por WA)</option>
              <option value="presencial">Presencial (Carlos da el teléfono)</option>
            </select>
          </div>
          {error && <p className="col-span-2 text-xs text-red-400">{error}</p>}
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-xs text-[#8b949e] hover:text-[#e6edf3] px-3 py-1.5">
              Cancelar
            </button>
            <button
              type="submit" disabled={loading}
              className="text-xs bg-[#1b3d8f] hover:bg-[#2563eb] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Creando...' : 'Crear Demo'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {sessions.length === 0 && (
          <p className="text-xs text-[#8b949e] text-center py-8">No hay demos en los últimos 30 días.</p>
        )}
        {sessions.map(s => (
          <div key={s.id} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#4BA3F5] font-mono">{s.code}</span>
                {estadoBadge(s)}
                <span className="text-[10px] text-[#8b949e]">{s.tipo}</span>
              </div>
              <p className="text-xs text-[#f0f6fc] font-semibold mt-0.5 truncate">
                {s.nombre_prospecto} — {s.clinic_name}
              </p>
              <p className="text-[10px] text-[#8b949e] mt-0.5">
                {s.turnos_dia} turnos/día · ${fmtN(s.precio_consulta)}/consulta · {s.secretarias} sec.
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold text-[#2ea043]">${fmtN(calcROI(s))}/mes</p>
              <p className="text-[10px] text-[#8b949e]">ROI estimado</p>
            </div>
            <button
              onClick={() => copyLink(s.code)}
              className="text-[10px] bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              {copied === s.code ? '✓ Copiado' : '📋 Link WA'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
