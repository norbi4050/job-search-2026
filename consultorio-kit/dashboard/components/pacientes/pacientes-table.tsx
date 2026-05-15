// components/pacientes/pacientes-table.tsx
'use client'
import { useState } from 'react'

const OBRAS_SOCIALES = ['OSDE','Swiss Medical','Galeno','IOMA','PAMI','Medifé','Sancor Salud','OSECAC','OSPEDYC','Unión Personal','Particular']
import { createClient } from '@/lib/supabase/client'
import type { Paciente } from '@/lib/types'

interface Props { initial: Paciente[] }

export function PacientesTable({ initial }: Props) {
  const [pacientes, setPacientes] = useState(initial)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Paciente | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const filtered = pacientes.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.dni.includes(search) ||
    p.telefono_wa.includes(search)
  )

  async function save() {
    if (!editing) return
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    const { error } = await supabase.from('consultorio_pacientes').update({
      nombre: editing.nombre,
      obra_social: editing.obra_social,
      telefono_wa: editing.telefono_wa,
    }).eq('id', editing.id)
    if (error) {
      setSaveError('No se pudo guardar. Intentá de nuevo.')
      setSaving(false)
      return
    }
    setPacientes(prev => prev.map(p => p.id === editing.id ? editing : p))
    setEditing(null)
    setSaving(false)
  }

  return (
    <>
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, DNI o teléfono…"
          className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] transition-colors" />
      </div>

      <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0d1117] text-[11px] font-semibold text-[#8b949e] uppercase tracking-wide">
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">DNI</th>
              <th className="text-left px-4 py-3">Teléfono WA</th>
              <th className="text-left px-4 py-3">Obra social</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-[#8b949e] text-sm">Sin resultados</td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="border-t border-[#21262d] hover:bg-[#1a1f2e] transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-[#e6edf3]">{p.nombre}</td>
                <td className="px-4 py-3 text-sm text-[#8b949e] font-mono">{p.dni}</td>
                <td className="px-4 py-3 text-sm text-[#58a6ff]">{p.telefono_wa}</td>
                <td className="px-4 py-3 text-sm text-[#8b949e]">{p.obra_social}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(p)}
                    className="text-xs bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] rounded-md px-3 py-1 transition-colors">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#f0f6fc]">Editar paciente</h2>
              <button onClick={() => setEditing(null)} className="text-[#8b949e] hover:text-[#e6edf3]">✕</button>
            </div>
            {(['nombre', 'telefono_wa'] as const).map(field => (
              <div key={field} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#8b949e] capitalize">{field.replace('_', ' ')}</label>
                <input value={editing[field]} onChange={e => setEditing({ ...editing, [field]: e.target.value })}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]" />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#8b949e]">Obra social</label>
              <select value={editing.obra_social} onChange={e => setEditing({ ...editing, obra_social: e.target.value })}
                className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]">
                {OBRAS_SOCIALES.map(os => <option key={os} value={os}>{os}</option>)}
              </select>
            </div>
            {saveError && <p className="text-xs text-red-400">{saveError}</p>}
            <button onClick={save} disabled={saving}
              className="bg-[#238636] text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
