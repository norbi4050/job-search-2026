# Daily Scout — 2026-04-22

**Fecha de ejecución:** 2026-04-22  
**Hora aproximada:** mañana  
**Agente:** Claude (automated scout)

---

## Resumen ejecutivo

- **Fuentes revisadas:** 11 (WeWorkRemotely, RemoteOK, Himalayas.app, n8n Community, LinkedIn/WebSearch, GetOnBoard, Arc.dev, Remotech.ai, GoRemoteJob.com, DynamiteJobs, Google/WebSearch general)
- **Ofertas encontradas y evaluadas:** ~35
- **Ofertas que pasaron filtros:** 4 (1 posiblemente expirada, 3 confirmadas abiertas/recientes)
- **Guardadas en Airtable:** 0 — ⚠️ API Airtable devolvió error 429 (PUBLIC_API_BILLING_LIMIT_EXCEEDED). Límite mensual excedido, mismo error que scouts anteriores. Cargar manualmente o aguardar reset del billing period.

---

## Problemas técnicos en la búsqueda

| Fuente | Estado |
|---|---|
| WeWorkRemotely (directo) | ❌ Error 403 — búsqueda vía Google/WebSearch |
| RemoteOK (directo) | ❌ Error 503 |
| Himalayas.app (directo) | ❌ Errores 503 — encontrado vía WebSearch |
| DynamiteJobs (directo) | ❌ Error 503 |
| n8n Community | ✅ Acceso completo |
| GetOnBoard | ✅ Acceso completo |
| Arc.dev | ✅ Acceso directo al listing |
| Remotech.ai | ✅ Acceso via WebSearch |
| GoRemoteJob.com | ✅ Acceso directo |
| LinkedIn Jobs | ⚠️ Parcial — acceso vía WebSearch + algunos directs |
| **Airtable API** | ❌ Error 429 — PUBLIC_API_BILLING_LIMIT_EXCEEDED |

---

## Ofertas que pasaron filtros

### ⭐ 1. Scale Army — AI Automation & Systems Engineer

- **URL:** https://jobs.ashbyhq.com/Scale%20Army%20Careers/e1f23893-5557-4436-aab5-992f231e2b8a
- **También en:** https://goremotejob.com/remote-jobs/ai-automation-systems-engineer
- **Fuente:** GoRemoteJob.com / Ashby (vía WebSearch)
- **Tier:** T2-Agencia (Scale Army es marketplace de staffing técnico: coloca LATAM en empresas USA)
- **Sueldo:** ~$100,000 USD/año (~$8,333/mes) ✅ (mencionado en una fuente agregadora; verificar contra oferta oficial)
- **Remote:** LATAM / África / Europa del Este ✅ — Argentina ✅
- **Horario:** Lunes–Viernes 9 AM–5 PM EST (overlap requerido)
- **Idioma manager:** Inglés (cliente: firma de consultoría política USA)
- **Estado:** Encontrada por agente
- **Fecha post:** March 18, 2026
- **Tech:** n8n, Make, Zapier, LLM integration (Claude, ChatGPT), Asana, API orchestration, prompt engineering ← **stack exacto de Carlos**
- **Por qué matchea:** ⭐ Match muy alto. El stack es el más cercano al perfil de Carlos encontrado hasta ahora: n8n + Make + Zapier + LLM integration (Claude). LATAM explícito. Salary arriba del objetivo. Sin requisito de inglés C1 explícito.
- **⚠️ ALERTA:** Una fuente (PitchMeAI agregador) marcó el listing como "expired April 20, 2026". El link directo de Ashby devuelve página con JavaScript que no se puede renderizar en el scraper. **VERIFICAR MANUALMENTE** si sigue abierto: https://jobs.ashbyhq.com/Scale%20Army%20Careers/e1f23893-5557-4436-aab5-992f231e2b8a
- **Aplicar:** Link de Ashby arriba. Si cerró, seguir a Scale Army Careers y verificar otras aperturas.

---

### ✅ 2. HireLATAM — AI Implementation Specialist

- **URL:** https://www.getonbrd.com/jobs/programacion/remote-ai-implementation-specialist-hirelatam-remote
- **Fuente:** GetOnBoard (vía WebSearch)
- **Tier:** T3-Hispana USA (HireLATAM coloca talento LatAm en empresas USA; la empresa misma es LatAm-focused)
- **Sueldo:** No especificado ⚠️ — HireLATAM trabaja con US companies, típicamente $2k–$3k/mes para roles técnicos, pero no confirmado
- **Remote:** Fully remote, worldwide ✅ — Argentina ✅
- **Idioma manager:** Bilingüe (HireLATAM es firma orientada a LatAm)
- **Estado:** Encontrada por agente
- **Fecha post:** February 26, 2026 — **CONFIRMADO ABIERTO** (205 aplicaciones, "replies in the same day")
- **Tech:** Python, JavaScript, LLM APIs (OpenAI, Anthropic), REST APIs, webhooks, Supabase/Firebase/Postgres, Vercel/AWS, Git, AI system design
- **Por qué matchea:** "AI Implementation Specialist" es exactamente el posicionamiento de Carlos (implementador de soluciones, no dev backend clásico). HireLATAM es empresa LatAm-focused; inglés no es barrera declarada. El rol construye AI workflows end-to-end para HireLATAM internamente (recruiting, sales, marketing automation).
- **⚠️ Alerta:** Stack es más Python/JS puro que n8n/low-code. Carlos debería evaluar si su nivel de Python alcanza para el primer filtro. El rol es "freelance/contractor" no full-time.
- **⚠️ Nota:** 205 aplicaciones es alta competencia. Aplicar rápido con portfolio específico.
- **Aplicar:** https://www.getonbrd.com/jobs/remote-ai-implementation-specialist-hirelatam-remote/applications/new

---

### ✅ 3. The Business of Dance — AI Automations Specialist

- **URL:** https://www.getonbrd.com/empleos/machine-learning-ai/ai-automations-specialist-the-business-of-dance-remote
- **Fuente:** GetOnBoard
- **Tier:** T5-Job Board
- **Sueldo:** No especificado ("Competitive compensation discussed during interview") ⚠️ — verificar antes de avanzar
- **Remote:** Fully remote, trabajo desde cualquier lugar del mundo ✅ — Argentina ✅
- **Idioma manager:** Inglés (requiere aplicar en inglés)
- **Estado:** Encontrada por agente
- **Fecha post:** April 2, 2026 (20 días de antigüedad, probablemente abierta)
- **Tipo:** Part-time ⚠️ (no full-time)
- **Tech:** API integrations, no-code/low-code platforms, workflow automation — bonus: **Notion, Slack, Zapier, Make, n8n**, Jotform, Typeform, Stripe, MailerLite, ChatGPT, Claude
- **Por qué matchea:** Stack bonus cubre exactamente las herramientas de Carlos (n8n, Make, Zapier, Claude, ChatGPT). El rol es de construcción y mantenimiento de automatizaciones, no ventas. Remote worldwide sin restricciones geográficas.
- **⚠️ Alerta 1:** Part-time — evaluar si sirve como complemento o si Carlos necesita full-time.
- **⚠️ Alerta 2:** "Requires applying in English" implica algo de inglés escrito (no dice C1). Carlos puede manejarlo.
- **⚠️ Alerta 3:** Sueldo no especificado — riesgo de estar debajo de $1,500/mes. VERIFICAR antes de aplicar.
- **Aplicar:** https://www.getonbrd.com/jobs/ai-automations-specialist-the-business-of-dance-remote/applications/new

---

### ✅ 4. Arc.dev — Sr Workflow Automation / AI Agent Developer (PT/FT)

- **URL:** https://arc.dev/remote-jobs/details/sr-workflow-automation-ai-agent-developer-pt-ft-na-western-eu-latam-o7y6aa7mm3
- **Fuente:** Arc.dev
- **Tier:** T5-Job Board
- **Sueldo:** No especificado (hourly rate, freelance) ⚠️
- **Remote:** NA / Western EU / LATAM ✅ — Argentina ✅ (3+ hr overlap con Eastern Time)
- **Idioma manager:** Inglés / Desconocido
- **Estado:** Encontrada por agente
- **Fecha post:** ~February 2026 (2 meses antigüedad; activo como listing en Arc.dev)
- **Tipo:** Freelance PT/FT
- **Tech:** Python, LLM, Workflow Automation, Agentic frameworks — preferred: **n8n, LangChain, Microsoft/Azure**
- **Por qué matchea:** LATAM explícito, n8n como preferencia declarada, LLM + AI agent workflows. Sin requisito de inglés C1 explícito.
- **⚠️ ALERTA PRINCIPAL:** Requiere **"5+ years of engineering or automation experience"** — rol Senior explícito. Carlos debería evaluar si su portfolio (proyectos reales en producción) puede sostener este nivel. Si tiene 3+ años contando proyectos propios, puede intentarlo.
- **⚠️ Alerta 2:** Listing de 2 meses de antigüedad — puede estar llenado. Aplicar rápido.
- **Aplicar:** https://arc.dev/signup?userType=developer&publicRandomKey=o7y6aa7mm3 (requiere perfil Arc.dev)

---

## Ofertas descartadas hoy

| Oferta | Motivo de descarte |
|---|---|
| Engine — Sr. AI Automations Engineer (LATAM) | ⏭️ Ya encontrada en scout 2026-04-17 — skip |
| Remote Leverage — Automation Specialist | ❌ "Fluent English, both verbal and written" requerido + no longer accepting applications |
| Remote Latinos — Automation Specialist (GoHighLevel) | ❌ 1 año antigüedad (cerrado) + GoHighLevel focus + $1,500–$2,000 CAD (< USD 1,500) |
| CitizenGo — Workflow Automation Specialist | ❌ 2 años antigüedad + test Duolingo "Fluency in English" requerido |
| HireLATAM — AI Automation Specialist (HVAC client) | ❌ Cerrado (9 meses antigüedad) |
| Aloware — Automation Engineer n8n (LATAM) | ❌ Cerrado Feb 27, 2026; sueldo $1,000–$2,000 debajo del objetivo |
| Lumago — Junior Automation Developer n8n | ❌ Cerrado desde Nov 2025 |
| Community Market Leader — Automation Architect | ❌ Cerrado desde Aug 2025 |
| Neuroly LLC — Desarrollador Automatización y APIs | ❌ Cerrado desde Jul 2025; sueldo inicial $500/mes |
| Heyraise LLC — Automation & AI Engineer | ❌ Cerrado desde Jul 2025 + "Excellent communication skills with fluency in English" |
| Blazestack — RevOps Automation & AI Prompt Engineer | ❌ Cerrado desde Sep 2025 |
| Properly — Automation Developer (Make/Zapier/n8n) | ❌ Cerrado desde Aug 2025 |
| Emprendimiento Consciente — Integrador Técnico n8n | ❌ Sueldo $1,200–$1,400 USD/mes < filtro $1,500 |
| Coderslab.io — Big Data & Reporting Lead | ❌ Rol de datos/BigData, no AI automation specialist |
| n8n Community — Business Automation Manager (EU) | ❌ EU/UK only — excluye Argentina |
| n8n Community — Online Collaboration Expert | ❌ Sin datos de sueldo/skills, posting informal |
| Arc.dev — otros roles (Workday, Marketing Ops) | ❌ No son AI automation roles |
| GetOnBoard — Rozeta Labs Senior Agentic AI Engineer | ❌ $4,000–$5,000/mes pero rol muy Senior (5+ años ML/AI), no low-code |

---

## Acción requerida

1. **⭐ Scale Army (verificar estado):** Abrir https://jobs.ashbyhq.com/Scale%20Army%20Careers/e1f23893-5557-4436-aab5-992f231e2b8a manualmente. Si sigue abierto, aplicar con prioridad máxima — es el match más alto del scout. Stack: n8n + Make + Zapier + LLM. LATAM. ~$100K.
2. **✅ HireLATAM AI Implementation Specialist:** Aplicar antes de que se llene (205 aplicaciones ya). Evaluar si el nivel de Python alcanza.
3. **✅ The Business of Dance:** Confirmar rango salarial en la entrevista antes de avanzar. Puede ser un buen candidato part-time si Scale Army no funciona.
4. **Arc.dev perfil:** Si Carlos no tiene perfil en Arc.dev, crearlo — la plataforma tiene roles LATAM recurrentes de n8n/automation.
5. **Airtable billing limit:** Tercer scout consecutivo con error 429. Verificar plan de Airtable y hacer upgrade o esperar reset mensual.

---

## Notas para próximos scouts

1. **GetOnBoard** se confirma como la fuente más productiva para LATAM con roles abiertos. Chequear directamente en cada scout: https://www.getonbrd.com/jobs-AI%20Automation y https://www.getonbrd.com/jobs-N8n
2. **Arc.dev** tiene rol LATAM de workflow automation activo. Vale agregarlo a rotación habitual.
3. **Muchos roles encontrados están CERRADOS** (de 2025 y early 2026) — la señal es que el mercado de n8n/automation LATAM existe pero los postings se llenan rápido. Velocidad de aplicación importa.
4. **Sagan Recruitment** (scout 04-21) y **Axe Automation** (scout 04-17) siguen siendo los mejores matches sin confirmar. Prioridad: seguir el estado de esas aplicaciones.
5. Fuentes a agregar en próximos scouts: **Ben's Bites Jobs** (https://news.bensbites.com/p/jobs-board), **Working Nomads** (workingnomads.com/remote-automation-jobs), **Remotive** con keyword "n8n".
