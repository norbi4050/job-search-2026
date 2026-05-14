'use client'
// app/login/page.tsx
import { useFormState, useFormStatus } from 'react-dom'
import { login } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="w-full bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60">
      {pending ? 'Ingresando…' : 'Ingresar al panel'}
    </button>
  )
}

export default function LoginPage() {
  const [state, action] = useFormState(login, null)
  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#161b22] border border-[#30363d] rounded-2xl p-8 flex flex-col gap-5">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-700 to-violet-700 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3">🏥</div>
          <h1 className="text-lg font-bold text-[#f0f6fc]">
            {process.env.NEXT_PUBLIC_CONSULTORIO_NOMBRE ?? 'Consultorio'}
          </h1>
          <p className="text-xs text-[#8b949e] mt-1">Panel de Gestión · Acceso restringido</p>
        </div>
        <hr className="border-[#21262d]" />
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#8b949e]">Email</label>
            <input name="email" type="email" required
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] transition-colors"
              placeholder="secretaria@consultorio.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#8b949e]">Contraseña</label>
            <input name="password" type="password" required
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] transition-colors" />
          </div>
          {state?.error && <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{state.error}</p>}
          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
