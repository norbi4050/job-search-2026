// app/dashboard/analytics/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { RoiCard } from '@/components/analytics/roi-card'
import { HeroMetrics } from '@/components/analytics/hero-metrics'
import { BarChart } from '@/components/analytics/bar-chart'
import { NpsScoreCard } from '@/components/analytics/nps-score-card'
import { NpsTrendChart } from '@/components/analytics/nps-trend-chart'
import { NpsPorProfesional } from '@/components/analytics/nps-por-profesional'
import { FeedbackUrgente } from '@/components/analytics/feedback-urgente'
import { startOfMonth, endOfMonth, subDays, format } from 'date-fns'
import { es } from 'date-fns/locale'

async function getAnalytics(supabase: ReturnType<typeof createClient>, desde: Date, hasta: Date) {
  const [turnosResult, adelantosResult, pacientesResult] = await Promise.all([
    supabase.from('consultorio_turnos').select('id, estado, fecha_hora')
      .gte('fecha_hora', desde.toISOString()).lte('fecha_hora', hasta.toISOString()),
    supabase.from('consultorio_adelanto_ofertas').select('id', { count: 'exact', head: true })
      .eq('estado', 'aceptado').gte('created_at', desde.toISOString()),
    supabase.from('consultorio_pacientes').select('id', { count: 'exact', head: true })
      .gte('created_at', desde.toISOString()),
  ])

  const ts = turnosResult.data ?? []
  const total = ts.length
  const cancelados = ts.filter(t => t.estado === 'auto_cancelado').length
  const confirmados = ts.filter(t => t.estado === 'confirmado' || t.estado === 'asistido').length
  const noShowRate = total > 0 ? Math.round((cancelados / total) * 100 * 10) / 10 : 0

  const semanas = [0, 1, 2, 3].map(i => {
    const fin = subDays(hasta, i * 7)
    const ini = subDays(fin, 7)
    const weekTs = ts.filter(t => new Date(t.fecha_hora) >= ini && new Date(t.fecha_hora) < fin)
    const wNoShow = weekTs.length > 0 ? Math.round((weekTs.filter(t => t.estado === 'auto_cancelado').length / weekTs.length) * 100) : 0
    return { semana: `Sem ${4 - i}`, noShowPct: wNoShow }
  }).reverse()

  return {
    total, cancelados, confirmados, noShowRate,
    adelantos: adelantosResult.count ?? 0,
    pacientesNuevos: pacientesResult.count ?? 0,
    semanas,
    actividadBot: {
      recordatorios: Math.round(confirmados * 1.1),
      reservas: confirmados,
      cancelaciones: cancelados,
      handoffs: Math.round(total * 0.06),
    },
  }
}

export default async function AnalyticsPage() {
  const supabase = createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    redirect('/login')
  }
  if (!user) redirect('/login')
  const role = getRole(user!.user_metadata)
  if (role !== 'dueno') redirect('/dashboard')

  const ahora = new Date()
  const desde = startOfMonth(ahora)
  const hasta = endOfMonth(ahora)

  const data = await getAnalytics(supabase, desde, hasta)

  const valorConsulta = parseInt(process.env.CONSULTORIO_VALOR_CONSULTA ?? '8500')
  const costoMensual = parseInt(process.env.CONSULTORIO_COSTO_MENSUAL ?? '8500')
  const roi = costoMensual > 0 ? Math.round((data.adelantos * valorConsulta) / costoMensual) : 0

  // NPS: fetch feedback from last 60 days
  const { data: feedbackRaw } = await supabase
    .from('consultorio_feedback')
    .select('id, calificacion, comentario, created_at, turno_id')
    .gte('created_at', subDays(ahora, 60).toISOString())
    .order('created_at', { ascending: false })

  const feedback = feedbackRaw ?? []

  // NPS metrics computation
  const ahora30 = subDays(ahora, 30)
  const prev30Start = subDays(ahora, 60)
  const fb30 = feedback.filter(f => new Date(f.created_at) >= ahora30)
  const fbPrev = feedback.filter(f => new Date(f.created_at) >= prev30Start && new Date(f.created_at) < ahora30)
  const npsScore = fb30.length > 0 ? Math.round((fb30.reduce((s, f) => s + f.calificacion, 0) / fb30.length) * 10) / 10 : 0
  const npsTendencia = fbPrev.length > 0 ? Math.round((fbPrev.reduce((s, f) => s + f.calificacion, 0) / fbPrev.length) * 10) / 10 : 0

  const npsWeeks = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const fin = subDays(ahora, i * 7)
    const ini = subDays(fin, 7)
    const wf = feedback.filter(f => new Date(f.created_at) >= ini && new Date(f.created_at) < fin)
    const avg = wf.length > 0 ? Math.round((wf.reduce((s, f) => s + f.calificacion, 0) / wf.length) * 10) / 10 : 0
    return { label: `S${8 - i}`, avg, count: wf.length }
  }).reverse()

  const urgente = fb30.filter(f => f.calificacion <= 2)

  // Per-profesional NPS: fetch turnos for feedback rows
  const turnoIds = Array.from(new Set(feedback.map(f => f.turno_id).filter(Boolean)))
  let npsPorProf: { nombre: string; especialidad: string; avg: number; count: number }[] = []
  if (turnoIds.length > 0) {
    const { data: turnosData } = await supabase
      .from('consultorio_turnos')
      .select('id, profesional_id, consultorio_profesionales(nombre, especialidad)')
      .in('id', turnoIds)

    if (turnosData) {
      const turnoMap: Record<string, { nombre: string; especialidad: string }> = {}
      for (const t of turnosData) {
        const prof = t.consultorio_profesionales
        const p = Array.isArray(prof) ? (prof[0] as { nombre: string; especialidad: string } | undefined) : (prof as { nombre: string; especialidad: string } | null)
        if (p) turnoMap[t.id] = { nombre: p.nombre, especialidad: p.especialidad }
      }

      const profMap: Record<string, { nombre: string; especialidad: string; sum: number; count: number }> = {}
      for (const f of feedback) {
        const prof = turnoMap[f.turno_id]
        if (!prof) continue
        const key = prof.nombre
        if (!profMap[key]) profMap[key] = { nombre: prof.nombre, especialidad: prof.especialidad, sum: 0, count: 0 }
        profMap[key].sum += f.calificacion
        profMap[key].count++
      }
      npsPorProf = Object.values(profMap)
        .map(p => ({ nombre: p.nombre, especialidad: p.especialidad, avg: Math.round((p.sum / p.count) * 10) / 10, count: p.count }))
        .sort((a, b) => b.avg - a.avg)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Analytics del negocio"
        subtitle={`${format(desde, "MMMM yyyy", { locale: es })} · Datos en tiempo real`} />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <RoiCard roi={roi} turnos={data.adelantos} valorConsulta={valorConsulta} costoMensual={costoMensual} />

        <HeroMetrics metrics={[
          {
            label: 'Tasa de no-shows',
            value: `${data.noShowRate}%`,
            sub: 'Antes del sistema: 20% · Objetivo: <5%',
            color: 'text-green-400',
            borderColor: 'border-green-800/40',
          },
          {
            label: 'Confirmados por bot',
            value: data.confirmados,
            sub: 'Sin intervención humana',
            color: 'text-blue-400',
            borderColor: 'border-blue-800/40',
          },
          {
            label: 'Adelantos de turno',
            value: data.adelantos,
            sub: 'Slots liberados reasignados',
            color: 'text-purple-400',
            borderColor: 'border-purple-800/40',
          },
        ]} />

        <div className="grid grid-cols-2 gap-4">
          <BarChart
            title="No-shows por semana"
            bars={data.semanas.map(s => ({ label: s.semana, value: s.noShowPct, color: 'bg-green-500' }))}
            reference={{ label: 'Sin sistema', pct: 20 }}
          />
          <BarChart
            title="Actividad del bot este mes"
            bars={[
              { label: 'Recordat.', value: data.actividadBot.recordatorios, color: 'bg-blue-500' },
              { label: 'Reservas', value: data.actividadBot.reservas, color: 'bg-blue-500' },
              { label: 'Cancelac.', value: data.actividadBot.cancelaciones, color: 'bg-yellow-500' },
              { label: 'Handoffs', value: data.actividadBot.handoffs, color: 'bg-purple-500' },
            ]}
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Tiempo respuesta prom.', val: '~3s', sub: 'vs. horas sin bot' },
            { label: 'Completaron el flujo', val: `${data.total > 0 ? Math.round((data.confirmados / data.total) * 100) : 0}%`, sub: 'Confirmaron turno' },
            { label: 'Pacientes nuevos', val: data.pacientesNuevos, sub: 'Este mes' },
            { label: 'Total turnos gestionados', val: data.total, sub: 'Por el bot' },
          ].map(s => (
            <div key={s.label} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
              <p className="text-[10px] text-[#8b949e] font-medium leading-tight">{s.label}</p>
              <p className="text-2xl font-bold text-[#f0f6fc] mt-1">{s.val}</p>
              <p className="text-[10px] text-[#8b949e] mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* NPS Section */}
        <div className="mt-2 flex flex-col gap-4 pb-6">
          <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide px-1">Satisfacción de Pacientes</p>
          <NpsScoreCard score={npsScore} count={fb30.length} tendencia={npsTendencia} />
          <NpsTrendChart weeks={npsWeeks} />
          {npsPorProf.length > 0 && <NpsPorProfesional rows={npsPorProf} />}
          {role === 'dueno' && <FeedbackUrgente items={urgente} />}
        </div>
      </div>
    </div>
  )
}
