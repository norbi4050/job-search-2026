# Plan Ejecutable — Empleo Full-Time AI Automation Specialist

> **Para agentic workers:** usar `superpowers:executing-plans` para implementación. Steps usan checkbox (`- [ ]`) syntax para tracking.

**Goal:** Conseguir oferta firmada de empleo full-time remoto ≥ USD 2.000/mes en 6-12 semanas, en rol de AI Automation Specialist o equivalente, con inglés requerido compatible con B1/B2.

**Architecture (estrategia):** Tres carriles paralelos — (1) Reposicionamiento de perfil y materiales, (2) Distribución pasiva en plataformas de matching, (3) Aplicaciones quirúrgicas a empresas filtradas por compatibilidad de inglés. Tracking centralizado en Airtable. Sin construcción de nuevos proyectos durante el período.

**Tech Stack:** Markdown (CV / cover letters / case study), Airtable vía MCP (tracker), Gmail vía MCP (envíos), Google Calendar vía MCP (entrevistas), LinkedIn (perfil + Open to Work), 5 plataformas de matching (Howdy, Terminal, Lemon, Arc, Pangea), 4 job boards (n8n / Make / Vapi / WeWorkRemotely).

**Spec referenciado:** `docs/superpowers/specs/2026-04-16-plan-empleo-ai-automation-design.md`

---

## Estructura de archivos del repo

**Crear durante ejecución del plan:**

```
docs/
  superpowers/
    specs/        ← spec aprobado (existe)
    plans/        ← este plan (existe)
cv/
  cv-es.md                              ← CV español
  cv-en.md                              ← CV inglés
  case-study-misionesarrienda.md        ← caso de estudio único
cover-letters/
  template-agency-en.md                 ← plantilla para agencias gringas
  template-hispanic-usa-es.md           ← plantilla para empresas hispanas USA
  template-startup-en.md                ← plantilla para startups YC con AI
  sent/                                 ← copias de las cartas enviadas (por fecha)
targets/
  tier-1-plataformas-matching.md        ← 5 plataformas
  tier-2-agencias-automation.md         ← ~20 agencias gringas con LatAm
  tier-3-empresas-hispanas-usa.md       ← ~10 empresas hispanas USA
  tier-4-startups-yc-ai.md              ← ~10 startups YC con stack IA
  tier-5-jobboards-comunidades.md       ← 5 job boards de comunidades
tracker/
  airtable-schema.md                    ← schema de la tabla Airtable
metrics/
  weekly-checkins.md                    ← log semanal de métricas
backlog.md                              ← ideas de proyectos en pausa
README.md                               ← índice y reglas no-negociables
```

**Por qué esta estructura:**
- Separación por responsabilidad (materiales / objetivos / tracking / métricas)
- Templates separados de cartas enviadas (sent/) → permite reutilizar y auditar
- `backlog.md` y `README.md` en raíz → visibles al abrir el repo

---

## Reglas de ejecución (recordatorio del spec)

1. **Cap diario: 1.5h máximo** total para todo el plan. Si terminás antes, terminás antes — no llenes el tiempo.
2. **Prohibido iniciar proyectos nuevos.** Toda idea va a `backlog.md`.
3. **Cero outbound agresivo.** Solo aplicaciones a roles publicados.
4. **Métrica primaria: aplicaciones enviadas/semana.** No tiempo, no proyectos.
5. **Commit después de cada task** completada — el repo te queda como bitácora.

---

## SEMANA 1 — Reposicionamiento (1h/día)

### Task 1.1: Crear estructura inicial del repo

**Files:**
- Create: `README.md`
- Create: `backlog.md`
- Create: `cv/`, `cover-letters/`, `cover-letters/sent/`, `targets/`, `tracker/`, `metrics/` (carpetas)

**Pasos:**

- [ ] **Step 1: Crear las carpetas**

```bash
cd "C:/Users/noyag/Norberto-Documentos"
mkdir -p cv cover-letters/sent targets tracker metrics
```

- [ ] **Step 2: Escribir `README.md`**

Contenido exacto:

```markdown
# Búsqueda de empleo — AI Automation Specialist

**Inicio:** 2026-04-16
**Target:** Oferta firmada ≥ USD 2.000/mes en 6-12 semanas

## Reglas no-negociables

1. Cap diario: 1.5h máximo de plan
2. Prohibido iniciar proyectos nuevos (van a backlog.md)
3. Solo aplicaciones a roles publicados (cero outbound agresivo)
4. Métrica primaria: aplicaciones enviadas/semana

## Documentos clave

- Spec: `docs/superpowers/specs/2026-04-16-plan-empleo-ai-automation-design.md`
- Plan: `docs/superpowers/plans/2026-04-16-plan-empleo-ai-automation.md`
- CV: `cv/cv-es.md` y `cv/cv-en.md`
- Targets: `targets/`
- Métricas: `metrics/weekly-checkins.md`
```

- [ ] **Step 3: Escribir `backlog.md`**

Contenido exacto:

```markdown
# Backlog (proyectos en pausa)

Toda idea de nuevo proyecto que aparezca durante la búsqueda va acá. **No se ejecuta hasta tener empleo.**

## Proyectos en pausa
- elan.casa — mejoras pendientes (pausado)
- misionesarrienda — features adicionales (pausado)

## Ideas nuevas
(agregar acá según aparezcan, con fecha)
```

- [ ] **Step 4: Commit**

```bash
git add README.md backlog.md
git commit -m "chore: estructura inicial del repo de búsqueda"
```

---

### Task 1.2: Escribir CV en español

**Files:**
- Create: `cv/cv-es.md`

**Pasos:**

- [ ] **Step 1: Escribir CV con narrativa "AI Automation Specialist"**

Contenido base (Carlos completa con datos personales reales — fechas, datos de contacto, estudios):

```markdown
# Carlos Norberto González Archilla
**AI Automation Specialist · Solutions Implementer**

📧 [email] · 💼 linkedin.com/in/carlos-norberto-gonzalez-archilla · 🌐 [portfolio principal]
📍 Argentina (UTC-3) · Disponible remoto · Inglés intermedio (B1/B2)

---

## Resumen profesional

AI Automation Specialist con experiencia construyendo soluciones end-to-end usando n8n, Vapi (voice AI), e integraciones con APIs de IA (OpenAI, Anthropic Claude). Tres sitios web propios en producción y múltiples workflows de automatización funcionando hoy. Foco en proptech y soluciones para PyMEs.

## Skills técnicos

**Automatización & IA:**
- n8n (workflow design, ejecución, integraciones complejas)
- Vapi (voice agents: recepcionistas, qualifiers, asistentes async)
- OpenAI API, Anthropic Claude API
- Make.com, Zapier (nivel funcional)

**Desarrollo web:**
- HTML/CSS, JavaScript
- Frameworks usados en proyectos actuales (especificar)
- Hosting & dominios (Vercel, Netlify, etc. — lo que uses)

**Integraciones:**
- APIs REST, webhooks
- Airtable, Google Workspace
- WhatsApp Business API (si aplica)

## Proyectos propios (en producción)

### misionesarrienda.com.ar — Portal inmobiliario regional
- Plataforma de listings inmobiliarios para la provincia de Misiones
- Stack: [tecnologías]
- Automatización: captura y calificación de leads con n8n + Vapi

### elan.casa — [descripción corta]
- [propuesta de valor]
- Stack: [tecnologías]

### nexo-terra.com.ar — [descripción corta]
- [propuesta de valor]
- Stack: [tecnologías]

## Experiencia laboral

[Si tenés experiencia laboral previa, listarla acá. Si no, omitir esta sección.]

## Educación

[Estudios formales]

## Idiomas

- Español: nativo
- Inglés: intermedio (B1/B2) — lectura/escritura fluida, conversación funcional

## Disponibilidad

- Modalidad: remoto full-time
- Zona horaria: UTC-3 (compatible con horario USA EST/CST/PST)
- Inicio: inmediato
```

- [ ] **Step 2: Carlos completa los placeholders entre corchetes** con sus datos reales

- [ ] **Step 3: Commit**

```bash
git add cv/cv-es.md
git commit -m "docs: CV español como AI Automation Specialist"
```

---

### Task 1.3: Traducir CV al inglés

**Files:**
- Create: `cv/cv-en.md`

**Pasos:**

- [ ] **Step 1: Traducir manteniendo narrativa**

Contenido base (Carlos completa con sus datos):

```markdown
# Carlos Norberto González Archilla
**AI Automation Specialist · Solutions Implementer**

📧 [email] · 💼 linkedin.com/in/carlos-norberto-gonzalez-archilla · 🌐 [portfolio]
📍 Argentina (UTC-3) · Available remote · English: Intermediate (B1/B2)

---

## Professional Summary

AI Automation Specialist with hands-on experience building end-to-end solutions using n8n, Vapi (voice AI), and AI API integrations (OpenAI, Anthropic Claude). Three personal websites in production and multiple automation workflows running today. Focus on proptech and SMB solutions.

## Technical Skills

**Automation & AI:**
- n8n (workflow design, execution, complex integrations)
- Vapi (voice agents: receptionists, lead qualifiers, async assistants)
- OpenAI API, Anthropic Claude API
- Make.com, Zapier (functional level)

**Web development:**
- HTML/CSS, JavaScript
- [Frameworks used]
- Hosting & domains (Vercel, Netlify, etc.)

**Integrations:**
- REST APIs, webhooks
- Airtable, Google Workspace
- WhatsApp Business API (if applicable)

## Projects in Production

### misionesarrienda.com.ar — Regional real estate portal
- Listings platform for Misiones province (Argentina)
- Stack: [tech]
- Automation: lead capture and qualification with n8n + Vapi

### elan.casa — [short description]
### nexo-terra.com.ar — [short description]

## Work Experience

[List if any. Otherwise omit.]

## Education

[Formal studies]

## Languages

- Spanish: native
- English: Intermediate (B1/B2) — fluent reading/writing, functional conversation

## Availability

- Mode: full-time remote
- Timezone: UTC-3 (compatible with US EST/CST/PST)
- Start: immediate
```

- [ ] **Step 2: Commit**

```bash
git add cv/cv-en.md
git commit -m "docs: CV inglés como AI Automation Specialist"
```

---

### Task 1.4: Optimizar LinkedIn — Headline + About

**Files:**
- No archivo local — cambios directos en linkedin.com/in/carlos-norberto-gonzalez-archilla

**Pasos:**

- [ ] **Step 1: Cambiar headline en LinkedIn**

Headline exacto a poner (220 caracteres máx, este tiene ~165):

```
AI Automation Specialist | n8n · Vapi · OpenAI · Claude API | Building end-to-end automation solutions | Available for remote roles | ES native · EN B2
```

- [ ] **Step 2: Cambiar sección "About"**

Pegar exactamente esto (está optimizado para que recruiters de AI/automation te encuentren):

```
🤖 I build AI-powered automation solutions end-to-end.

What I do:
→ Design and ship n8n workflows that solve real business problems
→ Build conversational voice agents with Vapi (receptionists, lead qualifiers, async assistants)
→ Integrate OpenAI and Anthropic Claude APIs into production systems
→ Connect everything: APIs, webhooks, Airtable, Google Workspace, WhatsApp Business

What I've shipped:
🏠 misionesarrienda.com.ar — Real estate portal with automated lead capture (n8n + Vapi)
🏡 elan.casa — Real estate platform
🌍 nexo-terra.com.ar — Web project

Currently exploring opportunities as:
- AI Automation Engineer
- n8n Developer / Workflow Engineer
- AI Solutions Engineer (junior/mid)
- Integration Engineer
- Voice AI Developer

Languages: Spanish (native) · English (intermediate B1/B2 — fluent reading/writing, functional conversation)

Available: full-time remote, UTC-3 (compatible with US timezones)

📩 Best contact: LinkedIn DM
```

- [ ] **Step 3: Activar "Open to Work"** (visible solo a recruiters)

En LinkedIn:
1. Ir a tu perfil
2. Botón "Open to" → "Finding a new job"
3. **Job titles** a poner (uno por línea):
   - AI Automation Engineer
   - n8n Developer
   - Workflow Engineer
   - AI Solutions Engineer
   - Integration Engineer
   - Voice AI Developer
   - Make.com Specialist
   - Implementation Specialist
4. **Locations:** Remote · Argentina · United States · Spain · Mexico · Colombia
5. **Job types:** Full-time · Contract
6. **Start date:** Immediately
7. **Visibility:** "Recruiters only" (NO "All LinkedIn members" — preserva tu privacidad)

- [ ] **Step 4: Documentar el cambio**

Crear `metrics/linkedin-baseline.md` con captura de métricas iniciales:

```markdown
# LinkedIn — Baseline 2026-04-16

- Conexiones totales: [número antes del cambio]
- Visualizaciones de perfil últimos 90 días: [número]
- InMails recibidos último mes: [número]
- Headline antes: [tu headline anterior]
- About antes: [primer párrafo del about anterior]

## Cambios aplicados
- Headline → AI Automation Specialist (ver task 1.4)
- About → reescrito completo
- Open to Work → activado (solo recruiters)
```

- [ ] **Step 5: Commit**

```bash
git add metrics/linkedin-baseline.md
git commit -m "docs: baseline LinkedIn antes de optimización"
```

---

### Task 1.5: Escribir caso de estudio — misionesarrienda

**Files:**
- Create: `cv/case-study-misionesarrienda.md`

**Pasos:**

- [ ] **Step 1: Escribir caso de estudio (15-20 min máximo)**

Contenido base — Carlos rellena entre corchetes con datos reales:

```markdown
# Case Study: misionesarrienda.com.ar
## Automated Lead Capture & Qualification with n8n + Vapi

**Project:** Regional real estate listings portal for Misiones province (Argentina)
**Role:** Sole builder — design, development, automation
**Stack:** n8n · Vapi · [database/CMS] · [hosting] · WhatsApp Business API
**Status:** Live in production

---

## The Problem

Local real estate agencies in [region] struggled with:
- Slow lead response times (avg [N] hours)
- Manual qualification of every inquiry
- No after-hours coverage
- Lost leads to faster competitors

## The Solution

End-to-end automation pipeline:

1. **Capture:** Listing inquiries hit a webhook (form submission, WhatsApp message, or call)
2. **Triage:** n8n workflow classifies the inquiry (rental vs sale vs visit request)
3. **Qualify:** Vapi voice agent calls back automatically (or chats via WhatsApp), asks 4-5 qualifying questions
4. **Route:** Qualified leads pushed to agent's CRM (Airtable) with priority tag
5. **Notify:** Real-time push notification to the agent on duty

## Architecture

```
[Webhook/WhatsApp/Call]
        ↓
   [n8n Trigger]
        ↓
[Classification node (LLM)]
        ↓
   [Vapi outbound call OR WhatsApp]
        ↓
[Qualification questions]
        ↓
[Airtable record + priority]
        ↓
[Agent notification]
```

## Results

- Response time: from [N hours] → [N minutes] (autom)
- Qualified leads ratio: [%] before → [%] after
- After-hours coverage: 0 → 24/7
- Time saved per agent: [X hours/week]

## Lessons learned

- [Insight técnico 1 — algo que aprendiste]
- [Insight técnico 2]
- [Decisión de diseño que harías diferente]

## Tools & APIs used

- n8n (self-hosted / cloud — especificar)
- Vapi (voice agents)
- OpenAI / Claude API for classification
- Airtable as lead CRM
- WhatsApp Business API
- [hosting]

---

**Live:** https://misionesarrienda.com.ar
**Contact:** [tu LinkedIn]
```

- [ ] **Step 2: Carlos rellena placeholders con números reales** (aunque sean estimaciones honestas)

- [ ] **Step 3: Subir el caso de estudio a una URL pública** (opciones):
  - Publicarlo como artículo en LinkedIn (mejor para distribución)
  - Subirlo a tu sitio personal
  - Gist público de GitHub
  - Notion público

- [ ] **Step 4: Commit local**

```bash
git add cv/case-study-misionesarrienda.md
git commit -m "docs: case study de misionesarrienda con n8n+Vapi"
```

---

## SEMANA 1-2 — Distribución pasiva (2h totales, una vez)

### Task 2.1: Alta en Howdy.com (LatAm → USA)

**URL:** https://www.howdy.com/

**Pasos:**

- [ ] **Step 1: Crear cuenta** (sign up como talent)
- [ ] **Step 2: Completar perfil** con datos del CV (cv/cv-en.md)
- [ ] **Step 3: Listar skills exactos** que importan para matching:
  - n8n
  - Vapi
  - Voice AI
  - Workflow Automation
  - OpenAI API
  - Anthropic Claude
  - Integration Engineering
  - WhatsApp Business API
- [ ] **Step 4: Subir cv-en.md como PDF** (exportar primero a PDF — usar herramienta gratuita)
- [ ] **Step 5: Indicar nivel de inglés honestamente: B2** (no inflar a C1)
- [ ] **Step 6: Indicar disponibilidad: full-time, immediate, remote**
- [ ] **Step 7: Indicar rate esperado:** USD 25-40/hora (rango realista para AI automation, LatAm, B2)
- [ ] **Step 8: Marcar como "active" / "available"**

---

### Task 2.2: Alta en Terminal.io

**URL:** https://www.terminal.io/

**Pasos:**

- [ ] **Step 1: Sign up como engineer**
- [ ] **Step 2: Mismo proceso que Howdy** — perfil con CV en inglés, skills, disponibilidad
- [ ] **Step 3: Indicar foco: AI Automation, no software engineering tradicional**

---

### Task 2.3: Alta en Lemon.io

**URL:** https://lemon.io/

**Pasos:**

- [ ] **Step 1: Aplicar como dev** (proceso tiene screening)
- [ ] **Step 2: Subir CV inglés**
- [ ] **Step 3: Esperar respuesta** (Lemon tiene proceso de review más estricto, puede tardar 5-7 días)

---

### Task 2.4: Alta en Arc.dev

**URL:** https://arc.dev/

**Pasos:**

- [ ] **Step 1: Sign up como remote dev**
- [ ] **Step 2: Completar perfil con foco "AI Automation"**
- [ ] **Step 3: Tagear con keywords: AI, n8n, Vapi, Voice AI, Automation**

---

### Task 2.5: Alta en Pangea.app

**URL:** https://pangea.app/

**Pasos:**

- [ ] **Step 1: Sign up**
- [ ] **Step 2: Mismo proceso de perfil**

**Alternativa adicional opcional:** Braintrust, Outdefine — solo si tenés energía extra.

---

### Task 2.6: Suscripción a job boards de comunidades

**Pasos:**

- [ ] **Step 1: n8n Community Jobs**
  - URL: https://community.n8n.io/c/jobs/
  - Crear cuenta + suscribirse a la categoría
  - Activar email notifications

- [ ] **Step 2: Make Community**
  - URL: https://community.make.com/
  - Buscar canal/categoría de jobs si existe
  - Suscribirse

- [ ] **Step 3: Vapi Discord**
  - URL: invite link en https://vapi.ai/
  - Unirse al server
  - Buscar canal #jobs / #hiring
  - Activar notificaciones

- [ ] **Step 4: WeWorkRemotely**
  - URL: https://weworkremotely.com/
  - Configurar búsqueda guardada con keywords: "automation" OR "n8n" OR "AI engineer"
  - Activar email diario

- [ ] **Step 5: RemoteOK** (bonus)
  - URL: https://remoteok.com/
  - Misma config de búsqueda guardada

- [ ] **Step 6: Commit log de plataformas**

Crear `targets/tier-1-plataformas-matching.md`:

```markdown
# Tier 1 — Plataformas de matching (alta única)

| Plataforma | URL | Estado | Fecha alta | Notas |
|---|---|---|---|---|
| Howdy | https://howdy.com | ☐ | | |
| Terminal | https://terminal.io | ☐ | | |
| Lemon.io | https://lemon.io | ☐ | | screening 5-7d |
| Arc.dev | https://arc.dev | ☐ | | |
| Pangea | https://pangea.app | ☐ | | |

# Job boards comunidades (suscripción)

| Board | URL | Suscripto | Notas |
|---|---|---|---|
| n8n community | https://community.n8n.io/c/jobs/ | ☐ | email notif |
| Make community | https://community.make.com | ☐ | |
| Vapi Discord | (invite) | ☐ | canal #jobs |
| WeWorkRemotely | https://weworkremotely.com | ☐ | búsqueda guardada |
| RemoteOK | https://remoteok.com | ☐ | búsqueda guardada |
```

```bash
git add targets/tier-1-plataformas-matching.md
git commit -m "docs: registro de altas en plataformas de matching"
```

---

## SEMANA 1 — Setup tracker en Airtable

### Task 3.1: Crear base "Job Search 2026" en Airtable

**Tooling:** MCP Airtable (ya conectado en Claude Code)

**Pasos:**

- [ ] **Step 1: Crear base nueva**

Comando (a ejecutar dentro de Claude Code para que use el MCP):

```
Crear base "Job Search 2026" en Airtable con tabla "Applications".
```

- [ ] **Step 2: Definir campos de la tabla "Applications"**

| Campo | Tipo | Opciones |
|---|---|---|
| Empresa | Single line text | — |
| Rol | Single line text | — |
| Tier | Single select | T1-Plataforma · T2-Agencia · T3-Hispana USA · T4-Startup YC · T5-Job Board |
| Fuente | Single select | LinkedIn · Howdy · Terminal · Lemon · Arc · Pangea · WeWorkRemotely · n8n community · Make community · Vapi Discord · RemoteOK · Otro |
| URL oferta | URL | — |
| Fecha aplicación | Date | — |
| Estado | Single select | Aplicado · Visto · Respuesta inicial · Entrevista screening · Entrevista técnica · Oferta · Rechazado · Sin respuesta (>14d) |
| Idioma manager | Single select | Español · Inglés · Bilingüe · Desconocido |
| Salario min (USD) | Number | — |
| Salario max (USD) | Number | — |
| Modalidad | Single select | Remote · Hybrid · On-site |
| Notas | Long text | — |
| Follow-up enviado | Checkbox | — |
| Fecha follow-up | Date | — |

- [ ] **Step 3: Crear tabla "Empresas Target"** (lista de 60 a investigar/aplicar)

| Campo | Tipo |
|---|---|
| Empresa | Single line text |
| Tier | Single select (mismo que arriba) |
| Sitio web | URL |
| Por qué encaja | Long text |
| Estado búsqueda | Single select (Sin investigar · Investigado · Aplicado · Descartado) |
| Aplicaciones relacionadas | Link to Applications |

- [ ] **Step 4: Crear vistas filtradas en "Applications"**
  - "Esta semana" → filtro: Fecha aplicación = esta semana
  - "Pendientes follow-up" → filtro: Estado = Sin respuesta · Fecha aplicación > 14 días · Follow-up enviado = false
  - "Activas" → filtro: Estado IN (Respuesta inicial, Entrevista screening, Entrevista técnica, Oferta)
  - "Embudo" → group by Estado

- [ ] **Step 5: Documentar schema**

Crear `tracker/airtable-schema.md` con la definición exacta de tablas + vistas (mismo contenido que arriba). Sirve de referencia si la base se daña.

```bash
git add tracker/airtable-schema.md
git commit -m "docs: schema de Airtable para tracking de aplicaciones"
```

---

## SEMANA 2 — Lista de empresas target (60)

### Task 4.1: Investigar y cargar 60 empresas en "Empresas Target"

**Tiempo:** 2h totales (una vez), distribuido en 3-4 sesiones de 30 min.

**Output:** Tabla "Empresas Target" en Airtable con 60 registros + 5 archivos markdown en `targets/` con la misma lista (backup local).

#### Tier 2 — Agencias de AI Automation (target: 20 empresas)

**Pasos:**

- [ ] **Step 1: Buscar agencias con perfil "AI automation agency LatAm hire"**

Lista de **arranque verificada** (Carlos investiga cada una, las que no encajen las descarta y reemplaza):

```markdown
# targets/tier-2-agencias-automation.md

| Empresa | URL | Por qué encaja | Estado |
|---|---|---|---|
| Goodbits | goodbits.io | UK, contrata LatAm async | ☐ investigar |
| Toolflare | toolflare.com | AI automation agency | ☐ |
| Hatchworks | hatchworks.com | US, hire LatAm devs | ☐ |
| Sintra AI | sintra.ai | AI automation, hire remote | ☐ |
| Helio AI | heliogen.ai | AI solutions agency | ☐ |
| Devoted Studios | devotedstudios.com | LatAm-friendly | ☐ |
| BairesDev | bairesdev.com | Argentina, paga USD | ☐ |
| Globant | globant.com | Argentina HQ, roles AI | ☐ |
| Plain Concepts | plainconcepts.com | España, AI roles | ☐ |
| 10Pearls | 10pearls.com | LatAm friendly, AI/automation | ☐ |
| Encora | encora.com | LatAm, automation roles | ☐ |
| Belatrix | belatrixsf.com | LatAm, automation | ☐ |
| Hexacta | hexacta.com | Argentina, ofertas remote | ☐ |
| Ravn | ravn.co | Argentina | ☐ |
| Wolox / Accenture Song | wolox.com.ar | Argentina, AI/automation | ☐ |
| Octobot | octobot.io | Uruguay, friendly LatAm | ☐ |
| Eleven Labs (services) | elevenlabs.io | voice AI, hire global | ☐ |
| Cresta | cresta.com | conversational AI | ☐ |
| Sierra | sierra.ai | AI agents, hiring | ☐ |
| Decagon | decagon.ai | AI agents enterprise | ☐ |
```

- [ ] **Step 2: Investigar cada empresa (5 min c/u)**

Por cada una verificar:
- ¿Tienen carreras / jobs page?
- ¿Aparecen ofertas compatibles (AI engineer / automation / integration)?
- ¿Mencionan que contratan LatAm o remote international?
- ¿El stack mencionado incluye n8n, Vapi, Make, Zapier, OpenAI, Claude?

- [ ] **Step 3: Cargar las verificadas en Airtable** (vía MCP) y marcar como "Investigado"

#### Tier 3 — Empresas hispanas en USA / España (target: 10)

```markdown
# targets/tier-3-empresas-hispanas-usa.md

| Empresa | URL | Por qué encaja | Estado |
|---|---|---|---|
| Jeeves | tryjeeves.com | YC, founder LatAm, fintech | ☐ |
| Belvo | belvo.com | YC, fintech LatAm-USA | ☐ |
| Tapi | tapi.la | Argentina-USA fintech | ☐ |
| Pomelo | pomelo.la | Argentina HQ, fintech LatAm | ☐ |
| Selia | selia.co | Colombia HQ, healthtech | ☐ |
| Nelo | nelo.co | México fintech | ☐ |
| Kueski | kueski.com | México fintech | ☐ |
| Rappi | rappi.com | Colombia HQ, contratan LatAm | ☐ |
| MercadoLibre | mercadolibre.com | Argentina HQ, USD pagos | ☐ |
| Konfío | konfio.mx | México fintech | ☐ |
```

#### Tier 4 — Startups YC con foco AI/automation (target: 10)

```markdown
# targets/tier-4-startups-yc-ai.md

| Empresa | URL | Por qué encaja | Estado |
|---|---|---|---|
| Vapi | vapi.ai | usás su producto, conocés stack | ☐ |
| Hippocratic AI | hippocraticai.com | voice AI healthcare | ☐ |
| Hebbia | hebbia.com | enterprise AI | ☐ |
| Glean | glean.com | enterprise AI search | ☐ |
| Adept | adept.ai | AI agents | ☐ |
| Otter.ai | otter.ai | AI transcription | ☐ |
| Sana | sana.ai | enterprise AI learning | ☐ |
| Cohere | cohere.com | LLM infrastructure | ☐ |
| LangChain | langchain.com | LLM framework | ☐ |
| Fixie.ai | fixie.ai | AI agents | ☐ |
```

**Nota:** YC startups tienden a requerir inglés alto. Marcar idioma manager como "Inglés" y filtrar después según response rate.

- [ ] **Step 4: Cargar en Airtable + commit local**

```bash
git add targets/
git commit -m "docs: lista de empresas target (60) por tier"
```

---

### Task 4.2: Templates de cover letter (3 variantes)

**Files:**
- Create: `cover-letters/template-agency-en.md`
- Create: `cover-letters/template-hispanic-usa-es.md`
- Create: `cover-letters/template-startup-en.md`

**Pasos:**

- [ ] **Step 1: Escribir template para agencias gringas (inglés)**

Contenido `cover-letters/template-agency-en.md`:

```markdown
# Template — AI Automation Agency (English)

**Cómo usarlo:** reemplazar `{{...}}` con datos específicos de cada aplicación. NO enviar sin personalizar al menos {{COMPANY}} y {{SPECIFIC_HOOK}}.

---

Subject: AI Automation Engineer — n8n, Vapi, Claude/OpenAI

Hi {{HIRING_MANAGER_NAME or "team"}},

I'm Carlos, an AI Automation Specialist based in Argentina (UTC-3). I noticed {{COMPANY}} {{SPECIFIC_HOOK — e.g., "is hiring n8n developers" / "builds voice AI solutions for healthcare" / "recently launched X"}}, and my stack matches what you're building.

What I bring:
• n8n: production workflows running today (lead capture, qualification, CRM sync)
• Vapi: voice agents in production (live demo at misionesarrienda.com.ar)
• Claude/OpenAI integrations: classification, generation, RAG patterns
• 3 web projects shipped end-to-end

Quick references:
→ Case study: {{LINK to case study en LinkedIn or your site}}
→ Live voice agent: {{phone number or URL}}
→ Portfolio: misionesarrienda.com.ar · elan.casa · nexo-terra.com.ar

I'm fluent in Spanish, intermediate in English (B2 — comfortable async on Slack/Loom, conversational on calls). Available full-time remote, immediate start.

CV attached. Happy to walk through any of the projects on a quick call.

Best,
Carlos Norberto González Archilla
{{LINKEDIN URL}}
{{EMAIL}}
```

- [ ] **Step 2: Escribir template para empresas hispanas USA (español)**

Contenido `cover-letters/template-hispanic-usa-es.md`:

```markdown
# Template — Empresa hispana USA (Español)

**Cómo usarlo:** reemplazar `{{...}}` con datos específicos.

---

Asunto: AI Automation Engineer — n8n, Vapi, Claude

Hola {{NOMBRE_HIRING_MANAGER or "equipo"}},

Soy Carlos, AI Automation Specialist desde Argentina. Vi que {{COMPANY}} {{ENGANCHE — "está creciendo en X" / "publicó búsqueda para Y" / "lanzó recientemente Z"}} y creo que mi perfil les puede sumar valor.

Lo que aporto:
• n8n: workflows en producción hoy (captura de leads, calificación, integración CRM)
• Vapi: agentes de voz funcionando (demo live en misionesarrienda.com.ar)
• Integración Claude/OpenAI: clasificación, generación, patrones RAG
• 3 proyectos web propios shipping end-to-end

Referencias rápidas:
→ Caso de estudio: {{LINK}}
→ Voice agent live: {{teléfono o URL}}
→ Portfolio: misionesarrienda.com.ar · elan.casa · nexo-terra.com.ar

Idiomas: español nativo, inglés intermedio (B1/B2 — fluido en escritura, funcional en conversación). Disponible full-time remoto, zona horaria UTC-3 (compatible con USA).

CV adjunto. Quedo atento a vuestro feedback.

Saludos,
Carlos Norberto González Archilla
{{LINKEDIN URL}}
{{EMAIL}}
```

- [ ] **Step 3: Escribir template para startups YC (inglés, más concise)**

Contenido `cover-letters/template-startup-en.md`:

```markdown
# Template — YC Startup (English, concise)

---

Subject: {{ROLE TITLE}} — applied · n8n / Vapi / Claude

Hey {{NAME}},

Carlos here, AI Automation Specialist from Argentina. Saw the {{ROLE}} opening at {{COMPANY}} — {{ONE-SENTENCE WHY THIS COMPANY}}.

I ship:
- n8n workflows in prod (lead capture → qualification → CRM)
- Vapi voice agents in prod (live demo: {{URL}})
- Claude + OpenAI integrations (classification, RAG)

Recent work: misionesarrienda.com.ar (real estate portal w/ automated lead pipeline) — case study: {{LINK}}

English is intermediate (B2). Spanish native. Async-first works best for me. Open to full-time remote.

Resume attached. Cheers,

Carlos
{{LINKEDIN}} · {{EMAIL}}
```

- [ ] **Step 4: Commit los 3 templates**

```bash
git add cover-letters/
git commit -m "docs: 3 templates de cover letter (agency / hispanic USA / startup)"
```

---

### Task 4.3: Daily routine documentada — Aplicaciones quirúrgicas

**Files:**
- Create: `metrics/daily-routine.md`

**Pasos:**

- [ ] **Step 1: Escribir routine**

Contenido `metrics/daily-routine.md`:

```markdown
# Daily Routine — Aplicaciones (30 min/día, lunes a viernes)

**Tiempo total: 30 min. Si tarda más, parar.**

## Setup (3 min)
1. Abrir Airtable base "Job Search 2026"
2. Abrir Gmail (carpeta etiquetada "Job Search")
3. Abrir LinkedIn

## Buscar nuevas ofertas (10 min)
Revisar en orden:
1. Job alerts en email (LinkedIn, WeWorkRemotely, RemoteOK) — 3 min
2. n8n community / Vapi Discord / Make community — 3 min
3. Búsqueda directa en LinkedIn Jobs con keywords: "n8n" OR "Vapi" OR "AI Automation" + remote + (Latin America OR Argentina OR Spanish) — 4 min

**Filtrar al vuelo:**
- ☐ ¿Inglés requerido es C1+? → DESCARTAR
- ☐ ¿Es Solutions Engineer cara a cliente? → DESCARTAR
- ☐ ¿Sueldo mencionado <USD 1.500/mes? → DESCARTAR (excepción: empresa muy interesante)
- ☐ ¿Empresa hispana / async-first / con manager bilingüe? → APLICAR

Target: identificar 3-5 ofertas válidas.

## Aplicar (12 min, 3 min por aplicación)

Para cada oferta:
1. Crear registro en Airtable (Empresa, Rol, URL, Fuente, Tier, Idioma manager)
2. Elegir template apropiado (agency / hispanic-usa / startup)
3. Personalizar **mínimo {{COMPANY}} y {{SPECIFIC_HOOK}}** (no enviar genérico)
4. Adjuntar CV correspondiente (es o en según oferta)
5. Enviar (vía LinkedIn Easy Apply, formulario web, o email según corresponda)
6. Copiar la carta enviada a `cover-letters/sent/YYYY-MM-DD-{{empresa}}.md`
7. Marcar Airtable: Estado = "Aplicado", Fecha aplicación = hoy

## Cierre (5 min)
1. Revisar bandeja de entrada por respuestas a aplicaciones previas → procesar (responder, agendar, etc.)
2. Si hay aplicación con >14 días sin respuesta y sin follow-up → enviar 1 follow-up (UNO solo, suave)
3. Anotar número de aplicaciones del día en `metrics/weekly-checkins.md`

## Reglas durante la routine
- ❌ NO entrar a sitios de proyectos personales
- ❌ NO abrir editores de código de proyectos personales
- ❌ NO buscar "cosas para construir"
- ✅ Si surge idea → 30 segundos para anotarla en `backlog.md` y volver a la routine
```

- [ ] **Step 2: Commit**

```bash
git add metrics/daily-routine.md
git commit -m "docs: daily routine de aplicaciones (30 min/día)"
```

---

## SEMANA 2 EN ADELANTE — Ejecución de la routine

### Task 5.1: Ejecutar daily routine (lunes a viernes)

**Pasos diarios:**

- [ ] Cumplir `metrics/daily-routine.md` cada día hábil
- [ ] Apuntar al cap: 3-5 aplicaciones/día = 15-25/semana
- [ ] Si un día no podés hacer 30 min, hacé 10 (1 aplicación). NO acumular para el siguiente día.

### Task 5.2: Check-in semanal (viernes, 15 min)

**Files:**
- Update: `metrics/weekly-checkins.md`

**Pasos:**

- [ ] **Step 1: Crear archivo si no existe**

Contenido inicial:

```markdown
# Check-ins semanales

## Semana 1 (2026-04-16 a 2026-04-22)

**Setup completado:**
- [ ] CV español
- [ ] CV inglés
- [ ] LinkedIn optimizado + Open to Work
- [ ] Caso de estudio publicado
- [ ] Alta en 5 plataformas matching
- [ ] Suscripción a 5 job boards
- [ ] Airtable base creada
- [ ] 60 empresas cargadas en target

**Bloqueos / aprendizajes:**
- (anotar)

---

## Semana 2 (fechas)

**Aplicaciones:**
| Día | Cantidad | Notas |
|---|---|---|
| Lun | | |
| Mar | | |
| Mié | | |
| Jue | | |
| Vie | | |
| **Total** | | |

**Métricas acumuladas:**
- Aplicaciones totales: 0
- Respuestas: 0
- Entrevistas: 0
- Tasa respuesta: -

**Top fuente esta semana:** —

**Aprendizajes / ajustes:**
- (anotar)

---
```

- [ ] **Step 2: Cada viernes** completar la sección de la semana actual y abrir la siguiente.

- [ ] **Step 3: Commit semanal**

```bash
git add metrics/weekly-checkins.md
git commit -m "metrics: check-in semana N"
```

---

## SEMANA 6 — Trigger de revisión (decisión)

### Task 6.1: Análisis de métricas semana 6

**Files:**
- Update: `metrics/weekly-checkins.md` (nueva sección "Revisión semana 6")

**Pasos:**

- [ ] **Step 1: Calcular ratios**

Métricas a calcular:
- Total aplicaciones enviadas (sem 2-6): debería ser ~75-100
- Respuestas recibidas (cualquiera): target ≥3
- Tasa respuesta = respuestas / aplicaciones
- Entrevistas técnicas pasadas: target ≥1
- Top 3 fuentes por tasa de respuesta
- Top 3 tiers por tasa de respuesta

- [ ] **Step 2: Decidir según resultado**

| Resultado | Acción |
|---|---|
| Tasa respuesta ≥3% Y ≥1 entrevista técnica | **Continuar plan tal cual** — está funcionando |
| Tasa respuesta ≥3% Y 0 entrevistas técnicas | **Revisar entrevistas** — quizá inglés o caso de estudio fallan |
| Tasa respuesta <3% | **Pivotar** — ajustar CV, posicionamiento, o targets (ver Task 6.2) |

- [ ] **Step 3: Commit revisión**

```bash
git add metrics/weekly-checkins.md
git commit -m "metrics: revisión semana 6 con decisión"
```

---

### Task 6.2: Pivot si hace falta (ejecutar SOLO si Task 6.1 lo determina)

**Posibles pivots según síntoma:**

#### Pivot A — CV/posicionamiento no atrae

**Síntoma:** tasa respuesta <2%, principalmente "sin respuesta"

- [ ] **Step 1:** Revisar CV con un humano (mentor, amigo en HR/dev) o pedirle a Claude un review crítico
- [ ] **Step 2:** Probar variante de CV con énfasis distinto (ej: más "real estate proptech" si misionesarrienda es lo más fuerte)
- [ ] **Step 3:** Re-aplicar a 5 empresas con CV nuevo y comparar respuesta en 2 semanas

#### Pivot B — Llegan entrevistas pero rebotan

**Síntoma:** ≥3 entrevistas técnicas pero 0 ofertas

- [ ] **Step 1:** Pedir feedback explícito a recruiters que rechazan ("¿Qué necesitaría mejorar para encajar?")
- [ ] **Step 2:** Si feedback recurrente es inglés → intensificar conversation practice (Cambly daily 30 min)
- [ ] **Step 3:** Si feedback recurrente es seniority percibido → ajustar narrativa CV (más énfasis en autonomía y proyectos shipped)

#### Pivot C — Targets equivocados

**Síntoma:** baja respuesta + las pocas respuestas son de roles que no encajan

- [ ] **Step 1:** Investigar 20 nuevas empresas en tiers que dieron mejor ratio
- [ ] **Step 2:** Descartar tier completo si ningún registro respondió en 4 semanas
- [ ] **Step 3:** Reemplazar con 20 empresas nuevas en tier ganador

---

## SEMANAS 7-12 — Iteración + cierre

### Task 7.1: Continuar daily routine + check-ins semanales

- [ ] Mismo proceso que semanas 2-6, aplicando ajustes del pivot si los hubo

### Task 7.2: Manejo de entrevistas

**Cuando llega una entrevista:**

- [ ] **Step 1:** Crear evento en Google Calendar (vía MCP) con buffer de 15 min antes y después
- [ ] **Step 2:** Pre-entrevista (1h antes):
  - Releer la oferta
  - Releer tu propio caso de estudio de misionesarrienda
  - Tener abiertas las 3 webs (nexo-terra, misionesarrienda, elan) en pestañas para mostrar
  - Tener abierto el voice agent demo
  - Vaso de agua + auriculares + grabación habilitada (con permiso)
- [ ] **Step 3:** Post-entrevista (mismo día, 10 min):
  - Anotar en Airtable: preguntas hechas, qué respondiste mal, qué bien, sensación
  - Cambiar Estado a "Entrevista técnica completada"
  - Enviar thank-you note breve por email/LinkedIn
- [ ] **Step 4:** Si avanza a siguiente ronda → repetir. Si rechazan → pedir feedback.

### Task 7.3: Manejo de ofertas

**Cuando llega una oferta:**

- [ ] **Step 1:** No responder en caliente. Pedir 48h para revisar.
- [ ] **Step 2:** Validar contra "definición de done" del spec:
  - Pago ≥ USD 2.000/mes ✓
  - Modalidad remota ✓
  - Inglés requerido compatible B1/B2 ✓
- [ ] **Step 3:** Si todo ok → negociar (mínimo intentar +10% sobre oferta inicial)
- [ ] **Step 4:** Si la oferta es marginal pero ok → aceptar (definición de éxito está cumplida)
- [ ] **Step 5:** Una vez firmado → ejecutar Task 8.1

---

## CIERRE DEL PROYECTO

### Task 8.1: Aceptación + post-mortem

**Files:**
- Create: `metrics/learnings.md`

**Pasos:**

- [ ] **Step 1: Cambiar estado de búsqueda a "Cerrado" en Airtable**
- [ ] **Step 2: Pausar / archivar perfiles activos** (Howdy, etc. — opcional, podés dejarlos por si necesitás en el futuro)
- [ ] **Step 3: Escribir post-mortem**

Contenido `metrics/learnings.md`:

```markdown
# Post-Mortem — Búsqueda de empleo 2026

**Inicio:** 2026-04-16
**Cierre:** {{fecha}}
**Empresa contratante:** {{empresa}}
**Rol:** {{rol}}
**Salario final:** USD {{X}}/mes

## Métricas finales
- Total aplicaciones enviadas: {{N}}
- Total respuestas: {{N}}
- Total entrevistas: {{N}}
- Total ofertas: {{N}}
- Tiempo total: {{N}} semanas

## Qué funcionó
- (top 3 cosas)

## Qué no funcionó
- (top 3 cosas)

## Top fuente
- (cuál tier / cuál plataforma trajo el resultado final)

## Aprendizajes para próxima búsqueda
- (lo que harías distinto)
```

- [ ] **Step 4: Commit final**

```bash
git add metrics/learnings.md
git commit -m "metrics: post-mortem y cierre de búsqueda"
git tag v1-empleo-conseguido
```

- [ ] **Step 5: Reactivar `backlog.md`** — ahora sí podés volver a elan.casa y otros proyectos.

---

## Checklist global de progreso

**Setup (semana 1):**
- [ ] Task 1.1 — Estructura repo
- [ ] Task 1.2 — CV español
- [ ] Task 1.3 — CV inglés
- [ ] Task 1.4 — LinkedIn optimizado
- [ ] Task 1.5 — Caso de estudio
- [ ] Task 2.1 — Howdy
- [ ] Task 2.2 — Terminal
- [ ] Task 2.3 — Lemon
- [ ] Task 2.4 — Arc
- [ ] Task 2.5 — Pangea
- [ ] Task 2.6 — Job boards
- [ ] Task 3.1 — Airtable setup

**Lista (semana 2):**
- [ ] Task 4.1 — 60 empresas cargadas
- [ ] Task 4.2 — Templates cover letter
- [ ] Task 4.3 — Daily routine documentada

**Ejecución (semana 2-12):**
- [ ] Task 5.1 — Daily routine activa
- [ ] Task 5.2 — Check-ins semanales

**Revisión (semana 6):**
- [ ] Task 6.1 — Análisis métricas
- [ ] Task 6.2 — Pivot si necesario

**Cierre:**
- [ ] Task 7.x — Entrevistas + ofertas
- [ ] Task 8.1 — Post-mortem firmado
