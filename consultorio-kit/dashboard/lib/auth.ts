// lib/auth.ts
import type { UserRole } from './types'

export function getRole(userMetadata: Record<string, unknown>): UserRole {
  const role = userMetadata?.role as string | undefined
  if (role === 'admin') return 'dueno'
  if (!role || !(['dueno', 'secretaria', 'medico'] as string[]).includes(role)) {
    console.warn('[auth] user_metadata.role missing or invalid, defaulting to medico')
    return 'medico'
  }
  return role as UserRole
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
