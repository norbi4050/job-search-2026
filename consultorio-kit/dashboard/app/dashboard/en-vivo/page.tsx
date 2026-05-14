// app/dashboard/en-vivo/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ConvList } from '@/components/en-vivo/conv-list'
import { ChatThread } from '@/components/en-vivo/chat-thread'
import { Topbar } from '@/components/layout/topbar'
import type { Conversacion } from '@/lib/types'

export default function EnVivoPage() {
  const [convs, setConvs] = useState<Conversacion[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversacion | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    void supabase.from('consultorio_conversaciones').select('*')
      .neq('estado', 'inicio').gte('updated_at', thirtyMinAgo)
      .order('updated_at', { ascending: false })
      .then(({ data }) => { if (data) setConvs(data as Conversacion[]) })
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Conversaciones en vivo" subtitle={`${convs.length} activas ahora · Solo lectura — Sofia responde automáticamente`}>
        <div className="flex items-center gap-1.5 text-xs text-[#3fb950] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse"></span>
          Realtime activo
        </div>
      </Topbar>
      <div className="flex flex-1 overflow-hidden">
        <ConvList initial={convs} selectedPhone={selectedConv?.telefono_wa ?? null} onSelect={setSelectedConv} />
        <div className="flex-1 flex overflow-hidden">
          {selectedConv
            ? <ChatThread telefono_wa={selectedConv.telefono_wa} estado={selectedConv.estado} />
            : <div className="flex items-center justify-center flex-1 text-[#8b949e] text-sm">Seleccioná una conversación</div>
          }
        </div>
      </div>
    </div>
  )
}
