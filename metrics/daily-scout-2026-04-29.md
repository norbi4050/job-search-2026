# Daily Scout — 2026-04-29

**Fecha de ejecución:** 2026-04-29  
**Hora aproximada:** mañana  
**Agente:** Claude (automated scout)

---

## Resumen ejecutivo

- **Fuentes revisadas:** 9 (n8n Community, WeWorkRemotely vía WebSearch + ManagementPedia, Himalayas.app vía WebSearch, LinkedIn vía WebSearch, RemoteOK, Remotive, Bamboo Works careers, Working Nomads, Workable/Supertech)
- **Ofertas encontradas y evaluadas:** ~30
- **Ofertas que pasaron filtros (nuevas, no duplicadas):** 3
- **Guardadas en Airtable:** 0 — ⚠️ API Airtable devuelve error 429 (PUBLIC_API_BILLING_LIMIT_EXCEEDED). Sexto scout consecutivo con este error. Verificar reset del período de billing en workspace settings.

---

## Problemas técnicos en la búsqueda

| Fuente | Estado |
|---|---|
| WeWorkRemotely (directo) | ❌ Error 403 — búsqueda vía Google/WebSearch + ManagementPedia |
| RemoteOK (directo) | ❌ Sin resultados visibles en scrape |
| Himalayas.app (directo) | ❌ Retorna listado genérico en vez de oferta específica |
| Bamboo Works career page | ❌ Error 410 Gone — listado expirado |
| Remotive (Bamboo Works / Supertech) | ❌ Error 410 Gone |
| n8n Community | ✅ Acceso completo |
| LinkedIn Jobs | ⚠️ Parcial — acceso vía WebSearch |
| ManagementPedia | ✅ Acceso directo con detalle de ofertas WeWorkRemotely |
| **Airtable API** | ❌ Error 429 — PUBLIC_API_BILLING_LIMIT_EXCEEDED (6to scout consecutivo) |

---

## Ofertas que pasaron filtros

### ⭐ 1. Recrutopia — Au AI Automation Engineer n8n (EU timezone overlap)

- **URL:** https://community.n8n.io/t/au-ai-automation-engineer-n8n-eu-timezone-overlap/292600
- **Fuente:** n8n Community — **PUBLICADO HOY** 🟢 (29 de abril de 2026)
- **Tier:** T2-Agencia (Recrutopia = agencia de reclutamiento)
- **Sueldo:** No especificado ⚠️
- **Remote:** Remoto (con preferencia EU timezone overlap)
- **Idioma manager:** Desconocido (no especificado en la oferta)
- **Estado:** Encontrada por agente
- **Tech:** n8n (workflows en producción), APIs y webhooks, LLMs, JavaScript/TypeScript o Python, AI agents (chat/workflow/voz)
- **Por qué matchea:** ⭐ Post publicado HOY. Stack core: n8n + LLMs + AI agents — 100% del perfil técnico de Carlos. No especifica nivel de inglés C1. Agencia de reclutamiento = posiblemente múltiples clientes con este perfil.
- **⚠️ Alerta timezone:** "EU timezone overlap" puede ser un desafío desde Argentina (UTC-3 vs EU UTC+1/+3 = diferencia de 4-6h). No hay restricción geográfica explícita, pero el solapamiento real es limitado. Verificar en el thread si aceptan LATAM con overlap parcial.
- **Aplicar:** Responder en el thread o DM al poster en n8n Community.

---

### ✅ 2. RestaurantFlow OS — Automation Engineer (n8n Core Role)

- **URL:** https://community.n8n.io/t/hiring-automation-engineer-wanted-n8n-core-role-restaurant-tech-startup/292053
- **Fuente:** n8n Community — publicado April 28, 2026 (ayer) 🟢
- **Tier:** T4-Startup / Otro (restaurant tech startup early-stage)
- **Sueldo:** Paid build rate (monto no especificado) + retención mensual + equity ⚠️
- **Remote:** Remoto completo, sin restricción geográfica ✅
- **Idioma manager:** Inglés (documentación en inglés; no pide C1 explícito)
- **Estado:** Encontrada por agente
- **Tech:** n8n, Supabase, GoHighLevel (GHL), PostgreSQL APIs, webhooks con validación HMAC-SHA256, Printnode, lógica multi-rama compleja
- **Por qué matchea:** ✅ n8n core role en startup de restaurantes. Sin restricción geográfica. El stack (n8n + Supabase + GHL + webhooks) es alcanzable para Carlos. Buscan "construcción precisa con manejo limpio de errores" — exactamente el tipo de trabajo técnico que Carlos hace.
- **⚠️ Alerta 1:** Compensación no está detallada — confirmar monto de build rate antes de comprometerse. El modelo de "build rate + equity" puede ser bajo si el startup está muy early.
- **⚠️ Alerta 2:** GoHighLevel (GHL) puede ser nuevo para Carlos — evaluar curva de aprendizaje.
- **Aplicar:** Contacto via email/teléfono indicado en el post original del thread.

---

### ✅ 3. Fusemachines — Applied AI Engineer (Automation)

- **URL:** https://weworkremotely.com/remote-jobs/fusemachines-applied-ai-engineer-automation
- **Fuente:** WeWorkRemotely — publicado April 17, 2026 (12 días, no aparecía en scouts previos)
- **Tier:** T5-Job Board
- **Sueldo:** No especificado ⚠️ (empresa HQ Nepal, salarios variables por región)
- **Remote:** 100% remoto, sin restricción geográfica ✅
- **Idioma manager:** Inglés (no especifica nivel C1 explícitamente)
- **Estado:** Encontrada por agente
- **Tech:** Python, FastAPI, LLMs (OpenAI/IBM watsonx/Amazon Bedrock), LangChain, LangGraph, Google ADK, n8n/Make/Zapier, Pinecone/pgvector, Docker, AWS/GCP/Azure, Redis, Kafka
- **Por qué matchea:** ✅ n8n/Make/Zapier están en el stack requerido. HQ en Nepal = cultura global-remote sin restricción geográfica. Rol mid-to-senior de implementación de soluciones AI end-to-end — alineado con el perfil de Carlos. No pide C1 de inglés.
- **⚠️ Alerta:** Stack muy amplio — LangChain, LangGraph, Kafka, Redis son requeridos. Carlos puede tener gaps en LangGraph y mensajería async. El n8n/Make/Zapier aparece como herramienta entre muchas, no como core.
- **Aplicar:** https://weworkremotely.com/remote-jobs/fusemachines-applied-ai-engineer-automation

---

## Ofertas revisadas y descartadas hoy

| Oferta | Motivo de descarte |
|---|---|
| ContentJet — AI Agent Architect / Builder | ⏭️ Ya encontrada en scout 2026-04-17 — skip |
| ContentJet — Automation & Integration Engineer | ⏭️ Ya encontrada en scout 2026-04-17 — skip |
| Supertech Group — AI Automation Engineer (n8n + AI Agents) | ⏭️ Ya descartada en scout 2026-04-23 (demasiado senior: Docker/K8s/GCP) |
| Trefle — Claude API + n8n Engineer (31-Agent BI) | ⏭️ Ya encontrada en scout 2026-04-17 — skip |
| Kogan.com — AI Automation & Architecture Lead | ❌ "US-based candidates" + visitas anuales a Melbourne HQ requeridas — excluye Argentina |
| Virtual Assist — AI Automation & Backend Developer | ❌ "Fluent English: non-negotiable" (C1 explícito) + Filipinas only |
| Bamboo Works — AI Automation Specialist | ❌ OFERTA EXPIRADA (410 Gone) + salario $800–$1,200/mes = debajo del filtro $1,500 |
| Business Automation Manager (Cybersecurity scale-up) | ❌ "Must be based in EU or UK" — ya descartada en scout 2026-04-23 |
| Feros — AI Agent Workflow Engineer | ⏭️ Ya encontrada en scout 2026-04-27 (sin salario confirmado — open-source) |
| Open Collaboration — n8n Specialists (Emma_Clark) | ⏭️ Ya encontrada en scout 2026-04-27 |
| Nikolaos Zissidis — n8n Automation Specialist (Shopify) | ⏭️ Ya encontrada en scout 2026-04-27 |
| Pearl Talent — n8n Tech Lead | ❌ 4+ years n8n + AWS/Azure/GCP + CI/CD requeridos — perfil senior por encima del de Carlos |
| Bamboo Works — AI Agent & Automation Specialist | ⏭️ Ya encontrada en scout 2026-04-21 — skip |
| Freelancer n8n Retell AI voice agent pipeline | ❌ Freelance puntual, no empleo full-time |
| n8n freelancers varios (multiple posts) | ❌ Proyectos puntuales sin estructura de empleo |
| Aloware — Automation Engineer (LATAM) | ❌ CERRADO desde Feb 2026 (confirmado en scouts anteriores) |
| Au AI Automation Engineer (n8n, EU) | ✅ → PASA (ver oferta #1 arriba) |

---

## Acción requerida

1. **⭐ Recrutopia (prioridad alta):** Publicado HOY. Responder en el thread de n8n Community antes de que reciba muchas respuestas. Verificar si el overlap EU es negociable. Stack n8n + LLMs + AI agents = match técnico. URL: https://community.n8n.io/t/au-ai-automation-engineer-n8n-eu-timezone-overlap/292600

2. **✅ RestaurantFlow OS (prioridad media):** Confirmar monto de build rate antes de comprometerse. Si el pago es razonable (≥ $1,500 primera fase), aplicar. Stack n8n + GHL + Supabase. URL: https://community.n8n.io/t/hiring-automation-engineer-wanted-n8n-core-role-restaurant-tech-startup/292053

3. **✅ Fusemachines (prioridad baja-media):** Publicada hace 12 días, puede estar recibiendo muchos candidatos. Si el pipeline de aplicaciones de la semana está bajo, incluirla. URL: https://weworkremotely.com/remote-jobs/fusemachines-applied-ai-engineer-automation

4. **⚠️ Airtable billing (URGENTE — 6to scout consecutivo con error):** ~27 ofertas acumuladas sin cargar desde scout 04-17. Verificar reset del billing en https://airtable.com/pricing?ref=bp.pale o en workspace settings. Si el plan es gratuito, el reset es mensual. Considerar upgrade a Airtable Team (~$20/mes).

---

## Notas para próximos scouts

1. **n8n Community** sigue siendo la fuente más productiva — hoy 2 de 3 nuevas vinieron de ahí. Las 2 más frescas (publicadas hoy y ayer) son las mejores.
2. **WeWorkRemotely** sigue bloqueando acceso directo (403) pero ManagementPedia permite leer las ofertas completas. Continuar usando ese mirror.
3. **Himalayas** no está devolviendo páginas de ofertas específicas (retorna listado genérico). Preferir búsqueda vía WebSearch para encontrar URLs, luego verificar en otras fuentes.
4. **Bamboo Works** ha aparecido en múltiples scouts. La oferta recurrente de AI Automation Specialist ($800-$1,200) ya está confirmada como below-filter. No revisar de nuevo.
5. **Próximas fuentes a agregar:**
   - **Ben's Bites Jobs:** https://news.bensbites.com/p/jobs-board (mencionada en múltiples scouts sin haber sido revisada aún)
   - **Adaptive Teams:** monitorear si tienen nuevos roles https://adaptiveteams.teamtailor.com/jobs
   - **AspenView Technology Partners:** verificar si el rol GTM Engineer (deadline June 7) sigue activo
