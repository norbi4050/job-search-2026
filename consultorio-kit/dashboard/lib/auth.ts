// lib/auth.ts
import type { UserRole } from './types'

export function getRole(userMetadata: Record<string, unknown>): UserRole {
  return (userMetadata?.role as UserRole) ?? 'secretaria'
}

export function getProfesionalId(userMetadata: Record<string, unknown>): string | null {
  return (userMetadata?.profesional_id as string) ?? null
}

export function canAccess(role: UserRole, section: 'analytics' | 'en-vivo' | 'pacientes' | 'atenciones'): boolean {
  if (section === 'analytics' || section === 'en-vivo') return role === 'dueno'
  if (section === 'pacientes') return role === 'dueno' || role === 'secretaria'
  if (section === 'atenciones') return role === 'dueno' || role === 'secretaria'
  return true
}
