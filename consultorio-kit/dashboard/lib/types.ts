// lib/types.ts
export type UserRole = 'dueno' | 'secretaria' | 'medico'

export interface Turno {
  id: string
  paciente_id: string
  profesional_id: string
  fecha_hora: string
  estado: 'agendado' | 'confirmado' | 'cancelado' | 'auto_cancelado' | 'asistido'
  consultorio_pacientes: { nombre: string; dni: string; telefono_wa: string; obra_social: string } | null
  consultorio_profesionales: { nombre: string; especialidad: string } | null
}

export interface Paciente {
  id: string
  nombre: string
  dni: string
  telefono_wa: string
  obra_social: string
}

export interface Conversacion {
  telefono_wa: string
  estado: string
  handoff_humano: boolean
  contexto: Record<string, unknown>
  updated_at: string
}

export interface Mensaje {
  id: string
  telefono_wa: string
  direccion: 'entrada' | 'salida'
  contenido: string
  estado_bot: string | null
  created_at: string
}

export interface AnalyticsData {
  noShowRate: number
  noShowCount: number
  totalTurnos: number
  confirmadosBot: number
  adelantos: number
  pacientesNuevos: number
  actividadSemanas: Array<{ semana: string; noShowPct: number }>
  actividadBot: { recordatorios: number; reservas: number; cancelaciones: number; handoffs: number }
}

export interface FeedbackRow {
  id: string
  calificacion: number
  comentario: string | null
  created_at: string
  turno_id: string
}

export interface Campana {
  id: string
  nombre: string
  template_key: 'reactivacion' | 'control_anual' | 'libre'
  audiencia_tipo: 'todos' | 'especialidad' | 'dormidos'
  audiencia_valor: string | null
  mensaje_custom: string | null
  programada_para: string | null
  estado: 'borrador' | 'enviando' | 'completada' | 'cancelada'
  total_destinatarios: number
  total_respondieron: number
  created_at: string
}
