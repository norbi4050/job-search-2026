// app/dashboard/campanas/campanas-client.tsx
'use client'
import { useState } from 'react'
import type { Campana } from '@/lib/types'
import { CampanasList } from '@/components/campanas/campanas-list'
import { NuevaCampanaModal } from '@/components/campanas/nueva-campana-modal'

interface Props { initial: Campana[] }

export function CampanasClient({ initial }: Props) {
  const [campanas, setCampanas] = useState(initial)
  const [showModal, setShowModal] = useState(false)

  function handleCreated(c: Campana) {
    setCampanas(prev => [c, ...prev])
    setShowModal(false)
  }

  return (
    <>
      <CampanasList campanas={campanas} onNueva={() => setShowModal(true)} />
      {showModal && (
        <NuevaCampanaModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}
