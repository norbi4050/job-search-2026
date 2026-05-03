# Daily Scout — 2026-05-03 (sesión de mejora de fuentes)

**Hora ejecución:** 2026-05-03 ~21:20 UTC (agente automático — sesión de análisis + búsqueda extendida)
**Objetivo de esta sesión:** Ampliar fuentes de búsqueda + aplicar prompt v2 mejorado por primera vez
**Fuentes revisadas:** InfoJobs España, Indeed España, Tecnoempleo, Manfred, Get on Board, Himalayas, Wellfound, Glassdoor España, n8n Community, WeWorkRemotely (mirrors), Remotive, Working Nomads, Workable, Torre.co, WeRemoto, Ben's Bites, HN Who is Hiring (May 2026), Twitter/X (vía WebSearch), career pages (Plain Concepts, Ruby Labs)
**Total ofertas revisadas:** ~50 listados
**Total que pasaron filtros:** 2 nuevas (+ 7 de sesión anterior del 2026-05-01)
**Airtable:** ✅ 2 nuevos registros agregados (total acumulado del día: 9)

---

## Novedades de esta sesión

Esta sesión tuvo dos objetivos:
1. Explorar 20+ fuentes nuevas no revisadas antes (España, LatAm, AI boards)
2. Crear el prompt v2 del agente con ranking de probabilidad

Los 7 registros del scout 2026-05-01 ya están en Airtable.
Esta sesión agrega 2 más: Consultoriadeventas (de 30-abr, no cargado) y Ruby Labs.

---

## 🥇 Nivel 1 — Español nativo (mayor probabilidad de respuesta)

### 1. ⭐ Consultoriadeventas — Technical Lead / Sovereign AI Agentic Platform

- **URL:** https://community.n8n.io/t/hiring-building-a-sovereign-ai-agentic-platform-on-bare-metal-n8n-ollama-qdrant-looking-for-someone-to-own-the-tech/283632
- **Fuente:** n8n Community Jobs
- **Publicada:** 1 de abril 2026
- **Empresa:** Española (confirmado)
- **Tipo:** Part-time + retainer mensual fijo
- **Idioma manager:** Español (empresa española)
- **Stack:** N8N, Ollama (Llama 3.1/Qwen 2.5), Qdrant, faster-whisper, Kokoro TTS, Twilio/WhatsApp API
- **Inglés:** No requerido / no mencionado
- **Países:** Sin restricción (remota)
- **Por qué matchea:** Empresa española → español nativo. Stack de voice agent casi idéntico a Vapi pero on-premise (faster-whisper + TTS = equivalente a lo que Carlos ya hace con Vapi). N8N como orquestador. Alto ownership técnico.
- **Template sugerido:** `cover-letters/template-hispanic-usa-es.md` (en español)
- **⚠️ Nota:** Publicada hace ~30 días — verificar si sigue activa antes de aplicar.

---

## 🥈 Nivel 2 — Bilingüe / LATAM-preferred

*(Ver scout 2026-05-01 — The Global Talent Co. x2 son los mejores de este nivel)*

---

## 🥉 Nivel 3 — Inglés escrito OK / async-first

### 2. Ruby Labs — N8N Engineer (Payments and Automation)

- **URL:** https://jobs.ashbyhq.com/ruby-labs/da019cc7-adb0-49e8-a424-2bc278ec2a96/application
- **Fuente:** Glassdoor España + Ashby
- **Publicada:** Fecha desconocida (activa en múltiples agregadores mayo 2026)
- **Empresa:** Ruby Labs (global, HQ Londres)
- **Tipo:** Contrato independiente, flexible, 100% remoto
- **Idioma manager:** Inglés (empresa londinense)
- **Stack:** n8n (principal), Tooljet, JavaScript, REST APIs, webhooks, payment processors (Primer.io)
- **Inglés:** No dice fluent/C1+ — "good communication skills" general
- **Zona horaria:** ±4 horas de CET → Buenos Aires (UTC-3) = CET-4h, exactamente en el límite ✅
- **Por qué matchea:** n8n como skill principal, worldwide si respeta CET±4h, sin C1 explícito, empresa global establecida (100M+ users). Stack similar al de Carlos.
- **Template sugerido:** `cover-letters/template-agency-en.md`
- **⚠️ Nota:** Verificar que la oferta sigue abierta en Ashby antes de aplicar. Múltiples versiones de este rol circulan — confirmar URL correcta.

---

## Fuentes sin resultados relevantes o con errores

| Fuente | Estado | Motivo |
|---|---|---|
| InfoJobs España | Sin ofertas n8n accesibles | Requiere JavaScript habilitado (fetch bloqueado) |
| Get on Board | Sin resultados | Error 503 |
| Torre.co | Sin resultados directos | No retornó ofertas específicas vía WebSearch |
| Wellfound | Error 403 | Bloquea fetches directos |
| WeRemoto | 1 oferta (TripleTen Ireland only) | ❌ Descartada — Ireland only + "fluency in English" |
| Manfred | Sin listados accesibles | Solo muestra interfaz de búsqueda, no resultados |
| Ben's Bites Pallet | ECONNREFUSED | Servidor no accesible |
| HN Who is Hiring May 2026 | 0 matches | No hay menciones de n8n/automation en el thread |
| Twitter/X | Sin resultados directos | No retorna tweets individuales vía WebSearch |
| Hacker News | 0 matches | No hay puestos automation en mayo 2026 thread |
| Ruby Labs Ashby (jobs list) | Página vacía | Solo muestra "Jobs" header |
| Plain Concepts Workable | Página incompleta | Solo info de empresa, no listings |

---

## Ofertas descartadas (nuevas de esta sesión)

| Empresa | Rol | Motivo descarte |
|---|---|---|
| TripleTen (WeRemoto) | Part-time Instructor AI Automation | Ireland only + "fluency in English" hablado |
| LanguageWire | Full Stack Engineer (AI Tools) | Full Stack puro, no automation specialist |
| Octane (n8n community) | Founding Engineer AI Workflows | "Houston/Texas preferred" — EEUU |
| Ruby Labs (builtin.com) | Low-Code Automation Engineer (Marketing) | ELIMINADA agosto 2025 |
| TOMORROW HIRE | AI Automation Specialist | USA only |

---

## Mejoras implementadas hoy

1. ✅ Prompt v2 creado en `docs/agent-scout-prompt-v2.md`
2. ✅ 20+ nuevas fuentes identificadas y priorizadas
3. ✅ Ranking de mayor a menor probabilidad (🥇 español primero)
4. ✅ Keywords en español agregados (automatización, agentes IA, teletrabajo)
5. ✅ Detección async-first como señal positiva
6. ✅ Template de cover letter sugerido por oferta
7. ✅ Señal de frescura ("puede estar cerrada") en notas
8. ✅ Inferencia de salario mejorada (cuando disponible)

---

## Ranking completo acumulado (todas las ofertas activas en Airtable)

Priorizadas de mayor a menor para que Carlos aplique:

| Prioridad | Empresa | Rol | Idioma | Acción |
|---|---|---|---|---|
| 🥇 1 | Consultoriadeventas | Technical Lead AI Agentic Platform | Español | Aplicar HOY (verificar activa) |
| 🥈 2 | The Global Talent Co. | AI Automation Specialist | Inglés/bilingüe | Aplicar HOY — Argentina-only |
| 🥈 3 | The Global Talent Co. | GTM Engineer / AI Engineer | Inglés/bilingüe | Aplicar esta semana |
| 🥉 4 | ContentJet Inc. | Automation & Integration Engineer | Inglés escrito | Aplicar esta semana |
| 🥉 5 | ContentJet Inc. | AI Agent Architect / Builder | Inglés escrito | Aplicar esta semana |
| 🏅 6 | Engine | Sr. AI Automations Engineer (LATAM) | Inglés | Aplicar esta semana |
| 🥉 7 | Ruby Labs | N8N Engineer — Payments & Automation | Inglés | Verificar activa → aplicar |
| 🎖️ 8 | Human Intelligence | Automation Workflow Specialist | Inglés | Verificar Argentina incluida → aplicar |
| 🎖️ 9 | Trefle | Claude API + n8n Engineer (freelance) | Inglés | Evaluar si tiempo libre → aplicar |

---

## Acción prioritaria para Carlos

**Hoy mismo:**
1. Verificar que https://community.n8n.io/t/...283632 sigue activo → aplicar en español
2. Aplicar a The Global Talent Co. AI Automation Specialist (deadline 28-jun, stack perfecto)

**Esta semana:**
3. ContentJet Inc. Automation & Integration Engineer (mostrar proyectos n8n)
4. ContentJet Inc. AI Agent Architect / Builder
5. Ruby Labs — confirmar que Ashby URL está activa → aplicar

**Pendiente verificar:**
6. Human Intelligence — confirmar que Argentina está en LATAM aceptado
