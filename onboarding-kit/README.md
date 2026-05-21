# Consultorio Inteligente — Onboarding Kit

Template de onboarding para instalar el sistema en un cliente nuevo desde cero.

## Contenido

```
onboarding-kit/
├── n8n/              ← Exports JSON de todos los workflows (importar en n8n nuevo)
├── vapi/
│   └── prompt.txt    ← System prompt completo de Sofía
├── supabase/
│   └── schema.sql    ← Schema SQL de todas las tablas consultorio_*
├── env-vars.md       ← Lista de env vars necesarias (sin valores)
└── README.md         ← Este archivo
```

## Pasos para un cliente nuevo

1. **Supabase**: crear proyecto nuevo → ejecutar `supabase/schema.sql`
2. **n8n**: instalar instancia → importar todos los JSONs de `n8n/` → configurar env vars
3. **Vapi**: crear assistant nuevo → pegar `vapi/prompt.txt` como system prompt → crear tools
4. **Meta**: configurar webhook de WhatsApp apuntando a n8n (WF01)
5. **Dashboard**: actualizar env vars Next.js → git push → deploy

## Versión

Backup creado: 2026-05-20
Dashboard tag: `backup-pre-ventas-2026-05-20`
