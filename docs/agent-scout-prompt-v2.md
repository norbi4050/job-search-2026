# Agent Scout — Prompt v2 (mejorado 2026-05-03)

**Changelog vs v1:**
- 20+ fuentes nuevas (España, LatAm, AI-specific, newsletters, HN)
- Ranking de mayor a menor probabilidad de respuesta (español primero)
- Keywords en español además de inglés
- Detección de señales async-first
- Iteración sobre empresas target del plan
- Estimación de salario cuando no está explícito
- Template de cover letter sugerido en cada oferta
- Separación de frescura: últimas 48h / últimas 2 semanas / puede estar cerrada
- Campo "Idioma manager" más preciso (inferir por texto/empresa/país)

---

## PASO 1 — Leer criterios (sin cambios)

Leer antes de cada ejecución:
- `docs/superpowers/specs/2026-04-16-plan-empleo-ai-automation-design.md`
- `targets/tier-2-agencias-automation.md`
- `targets/tier-3-empresas-hispanas-usa.md`
- `targets/tier-4-startups-yc-ai.md`
- `metrics/daily-routine.md`

---

## PASO 2 — Buscar ofertas (FUENTES EXPANDIDAS)

### BLOQUE A — España y LatAm (buscar PRIMERO — mayor probabilidad)

**InfoJobs España** — `https://www.infojobs.net/ofertas-trabajo/n8n`
Keywords adicionales: `automatización IA`, `agente IA`, `integraciones`, `make.com`, `teletrabajo`

**Indeed España** — `https://es.indeed.com/q-n8n-empleos.html`
Keywords adicionales:
- `https://es.indeed.com/jobs?q=automatización+IA&l=teletrabajo`
- `https://es.indeed.com/jobs?q=agente+IA&l=teletrabajo`
- `https://es.indeed.com/jobs?q=make.com&l=teletrabajo`
- `https://es.indeed.com/jobs?q=integraciones+API+IA`

**Tecnoempleo** — `https://www.tecnoempleo.com/ofertas-trabajo/inteligencia-artificial-machine-learning`
Filtro: `teletrabajo 100%`

**Manfred / GetManfred** — `https://www.getmanfred.com/ofertas-empleo`
Keywords: `automatización`, `n8n`, `make`, `IA`, `agentes`

**Get on Board** — `https://getonboard.com/jobs?query=automation&remote=true`
Keywords adicionales: `AI automation`, `n8n`, `workflow`

**Glassdoor España** — `https://www.glassdoor.es/Empleo/espa%C3%B1a-n8n-empleos-SRCH_IL.0,6_IN219_KO7,10.htm`

**LinkedIn España** — buscar vía WebSearch:
`site:linkedin.com/jobs "n8n" OR "automatización IA" "teletrabajo" OR "remoto" España 2026`

**Torre.co** — `https://torre.co/jobs?q=AI+automation&remote=true`

**WeRemoto** — `https://www.weremoto.com/?search=automatizacion`
Keywords: `automatización`, `n8n`, `inteligencia artificial`

**Bumeran Argentina** — `https://www.bumeran.com.ar/empleos-busqueda-n8n.html`
Keywords adicionales: `automatización IA`, `integraciones`, `agentes IA`

**Computrabajo Argentina** — WebSearch: `site:computrabajo.com.ar "automatización" OR "n8n" OR "IA" teletrabajo`

---

### BLOQUE B — Job boards AI-specific (buscar segundo)

**Himalayas.app** — `https://himalayas.app/jobs/ai-in-automation`
Keywords adicionales:
- `https://himalayas.app/jobs?q=n8n`
- `https://himalayas.app/jobs?q=voice+AI`
- `https://himalayas.app/jobs?q=workflow+automation`
- `https://himalayas.app/jobs/countries/argentina/ai`

**Wellfound / AngelList** — `https://wellfound.com/role/r/automation-engineer`
Keywords: `n8n developer`, `AI automation engineer`, `workflow automation`

**YC Work at a Startup** — `https://www.workatastartup.com/jobs?q=automation`
Keywords: `AI automation`, `n8n`, `workflow`

**AI Jobs Net** — `https://aijobs.net/jobs/?q=automation&location=remote`

**Built In Remote** — `https://builtin.com/jobs/remote/dev-engineering`
Keywords: `AI automation`, `workflow`, `integration engineer`

---

### BLOQUE C — Job boards remote-first generales

**WeWorkRemotely** (vía WebSearch/mirrors si 403):
- `site:weworkremotely.com automation OR n8n OR "AI engineer" OR "workflow"`
- Mirrors: ManagementPedia, BeBee, JobBoardSearch

**RemoteOK** — `https://remoteok.com/remote-automation-jobs`

**Working Nomads** — `https://www.workingnomads.com/remote-automation-jobs`

**Remotive** — `https://remotive.com/remote-jobs/software-dev` + `https://remotive.com/remote-jobs/automation`

**JustRemote** — `https://justremote.co/remote-developer-jobs`

**Remote.co** — `https://remote.co/remote-jobs/developer/`

**EuropeRemotely** — `https://europeremotely.com/jobs`
(Para empresas europeas que contratan fuera de EU, verificar)

---

### BLOQUE D — Comunidades y foros (buscar tercero)

**n8n Community Jobs** — `https://community.n8n.io/c/jobs/`
Buscar posts de últimas 48h. Incluir tanto "hiring" como ofertas en español.

**Make Community** — `https://www.make.com/en/help/apps` (+ buscar "#jobs" en su foro/Discord si accesible)

**Vapi Discord #jobs** — (requiere cuenta Discord de Carlos, no automatizable)

**Reddit** — vía WebSearch:
- `site:reddit.com r/n8n hiring 2026`
- `site:reddit.com r/forhire "n8n" OR "AI automation" remote`
- `site:reddit.com r/Argentina_Tech empleo remoto IA`

**Twitter / X** — vía WebSearch:
- `site:x.com "hiring" "n8n" remote 2026`
- `site:x.com "we're hiring" "AI automation" remote worldwide`
- `site:x.com "looking for" "n8n developer" OR "automation engineer"`

**HN Who is Hiring (mes actual)** — `https://news.ycombinator.com/item?id=XXXXX`
Buscar el thread más reciente y filtrar por: n8n, automation, workflow, voice AI, integration

---

### BLOQUE E — Career pages de empresas target (iterar lista)

Para cada empresa de los archivos `targets/`, si no fue investigada aún (campo `Investigado = ☐`):
Buscar: `"{empresa}" "careers" OR "jobs" AI automation OR n8n OR workflow 2026`

**Prioridades para esta semana:**
- Plain Concepts (España): `https://apply.workable.com/plainconcepts/`
- NaNLABS (Argentina): `https://www.nan-labs.com/careers/`
- Hexacta (Argentina): `https://hexacta.com/careers/`
- BairesDev: `https://www.bairesdev.com/careers/`
- Globant: `https://careers.globant.com/`
- Encora: `https://www.encora.com/careers`
- Pomelo (Argentina): `https://pomelo.la/careers`
- Jeeves: `https://tryjeeves.com/careers`

**Para detectar rol correcto en career pages:**
- Buscar: "automation", "AI", "integration", "implementation", "workflow", "n8n"
- Descartar: "senior backend", "senior frontend" puro sin IA/automation

---

### BLOQUE F — Newsletters y curators de empleo AI

**Ben's Bites Jobs** — `https://bensbites.pallet.com/`

**TLDR Newsletter Jobs** — vía WebSearch: `tldr.tech jobs AI automation 2026`

**Pragmatic Engineer Jobs** — `https://pragmaticengineer.com/job`

**Read.cv** — `https://read.cv/explore`

---

## PASO 3 — Filtros (MEJORADOS)

### Filtros de descarte (sin cambios):
- ❌ "fluent English" / "C1+" / "native English speaker" explícito
- ❌ "Senior Backend Developer" / "Senior Frontend Developer" puro (sin AI/automation)
- ❌ Sueldo explícito < USD 1500/mes
- ❌ Presencia on-site fuera de Argentina
- ❌ Restricción geográfica a país específico donde Argentina NO está incluida (ej: "USA only", "Ireland only")

### Filtros de aceptación (mejorados):
- ✅ Menciona: n8n, Vapi, Make, Zapier, voice AI, workflow automation, AI automation, integration engineer, implementation specialist, RPA, low-code, no-code
- ✅ Empresa española/LatAm (posible idioma español) → PRIORIDAD MÁXIMA
- ✅ Empresa acepta Argentina, LATAM, South America, o worldwide explícitamente
- ✅ Empresa async-first (ver señales abajo)
- ✅ Oferta en español → muy probable que no requiera C1 inglés hablado
- ✅ Agencia de automatización que contrata operadores técnicos
- ✅ Zona horaria "CET ±4h" o "ET ±5h" o "Americas" → Buenos Aires (UTC-3) califica

### Señales de async-first (bonus positivo):
- "async communication", "asynchronous", "written communication"
- "documentation-first", "GitLab-style"
- "no meetings policy", "we don't do standups"
- "work when you want", "flexible hours"
- "overlap X hours" (4h o menos de overlap requerido)

---

## PASO 4 — Clasificación y ranking (NUEVO)

Para cada oferta que pasa filtros, asignar:

### Ranking de probabilidad de respuesta (de mayor a menor):

**🥇 Nivel 1 — Español nativo (80%+ prob. respuesta)**
- Empresa española con oferta en español
- Manager hispano confirmado
- Empresa LatAm con cultura en español
- _Acción: aplicar primero, usar template español_

**🥈 Nivel 2 — Bilingüe / LATAM-preferred (50-65% prob.)**
- Empresa que acepta Argentina o LatAm-only/preferred
- Empresa con founders LatAm aunque en inglés
- Plataforma de matching LatAm-USA
- _Acción: aplicar en día 1, usar template bilingüe o inglés según oferta_

**🥉 Nivel 3 — Inglés escrito OK / async-first (25-40% prob.)**
- Empresa anglófona pero async-first
- No requiere inglés hablado / no menciona C1
- "Show work" en vez de entrevistas verbales
- Zona horaria compatible (CET ±4h / ET ±5h)
- _Acción: aplicar en día 1-2, usar template inglés + mostrar portfolio_

**🏅 Nivel 4 — Inglés working proficiency, geografía abierta (15-25% prob.)**
- Empresa global, worldwide remote, no C1 explícito
- Startup AI con stack específico que Carlos domina
- _Acción: aplicar con template estándar_

**🎖️ Nivel 5 — Freelance/proyecto puntual (10-15% prob.)**
- No full-time, pero genera ingreso y portfolio
- _Acción: evaluar si no compromete tiempo para aplicaciones full-time_

### Campos para inferir idioma manager:
- Oferta en español → Español ✅
- Empresa con HQ en España/LatAm → Español ✅
- Empresa con founders con apellidos hispanos + "we work in Spanish" → Bilingüe
- Solo si empresa anglosajona sin indicación → Inglés

### Inferir salario cuando no está explícito:
Buscar: `"{empresa}" salary glassdoor OR levels.fyi` o buscar `"{rol}" LATAM salary 2026`
Si no hay datos → escribir "No especificado / estimado USD X-Y según mercado"

---

## PASO 5 — Guardar en Airtable (mejorado)

Tabla: `Applications` en base `Job Search 2026`

Campos por registro:
- **Empresa:** nombre exacto
- **Rol:** título exacto de la oferta
- **URL oferta:** link directo
- **Fuente:** plataforma de origen
- **Tier:** según criterio (T2/T3/T4/T5/Otro)
- **Estado:** "Encontrada por agente"
- **Idioma manager:** inferir (Español / Inglés / Bilingüe / Desconocido)
- **Fecha encontrada:** fecha del scout
- **Notas:** incluir:
  - 1-2 líneas por qué matchea
  - Nivel de probabilidad (🥇/🥈/🥉/🏅/🎖️)
  - Template sugerido para cover letter
  - Si es async-first → mencionar
  - Salario estimado si lo encontraste
  - Señales de frescura: "publicada hace X días" o "⚠️ puede estar cerrada"

**Verificar duplicados antes de crear:**
- Buscar por URL y por Empresa+Rol
- Si ya existe con Estado "Aplicado" o posterior → NO crear duplicado, solo notar en resumen

---

## PASO 6 — Resumen diario `metrics/daily-scout-YYYY-MM-DD.md` (mejorado)

Estructura:
```
# Daily Scout — YYYY-MM-DD

**Hora ejecución:** HH:MM UTC
**Fuentes revisadas:** lista completa
**Total revisadas:** N
**Total que pasaron filtros:** M
**Airtable:** ✅/❌ actualizado

## 🥇 Nivel 1 — Español / LatAm (mayor probabilidad)
[lista ofertas con ⭐ si son especialmente buenas]

## 🥈 Nivel 2 — Bilingüe / LATAM-preferred

## 🥉 Nivel 3 — Inglés escrito OK / async-first

## 🏅 Nivel 4 — Global, inglés working

## 🎖️ Nivel 5 — Freelance/proyecto

## Fuentes sin resultados o con errores

## Ofertas descartadas (con motivo)

## Acciones prioritarias para Carlos hoy
1. [oferta #1 — link]
2. [oferta #2 — link]
```

Luego: `git add`, `git commit -m "scout: búsqueda diaria YYYY-MM-DD"`, `git push`

---

## PASO 7 — Output final accionable al usuario (OBLIGATORIO)

Después de cargar Airtable y crear el daily-scout y commitear, **terminar SIEMPRE el turno con un mensaje al usuario en formato de "lista accionable con links directos"**. Este es el output que el usuario realmente consume — los archivos son backup.

### Formato exacto del mensaje final:

```
## 🥇 Aplicar HOY (máxima prioridad)

### N. {Empresa} — {Rol} {🇪🇸 ESPAÑOL si aplica}
👉 **Aplicar:** {URL directo}
- {país aceptado / restricción geo}
- Stack: {stack relevante}
- {tipo: full-time / contractor / freelance}
- **Cómo aplicar:** {instrucción concreta}
- ⚠️ {alerta si corresponde: verificar activa, deadline, etc.}

## 🥈 Aplicar esta semana
[mismo formato]

## 🥉 Verificar primero, después aplicar
[mismo formato + qué verificar]

## 🎖️ Freelance bonus (opcional)
[solo si aplica]

## Sugerencia táctica
- **Hoy:** aplicar a #1, #2, verificar #N
- **Mañana/jueves:** #3, #4
- **Esta semana:** total X aplicaciones
```

### Reglas estrictas del output final:

1. **Ofertas con 🇪🇸 ESPAÑOL primero, SIEMPRE.** No hay excepción.
2. **Solo ofertas con URL directa de aplicación.** Si no hay URL, marcar con ⚠️ + dar instrucción alternativa (email, LinkedIn DM, etc.).
3. **Máximo 4-5 líneas por oferta.** Carlos debe poder escanear en <30 segundos.
4. **No repetir ofertas que ya están en Airtable con Estado "Aplicado" o posterior.** Solo las nuevas + las pendientes de aplicar.
5. **Si 0 ofertas nuevas:** decir "Sin ofertas nuevas hoy — se revisaron N en M fuentes" + listar fuentes principales que no respondieron.
6. **Cerrar siempre con sugerencia táctica** de orden de aplicación esta semana.

### Ejemplo de output bueno:

> ## 🥇 Aplicar HOY
>
> ### 1. Consultoriadeventas — Technical Lead AI Platform 🇪🇸 ESPAÑOL
> 👉 **Aplicar:** https://community.n8n.io/t/...283632
> - Empresa española, sin restricción geo
> - Stack: N8N + Ollama + voice (whisper/TTS) + WhatsApp
> - Part-time + retainer mensual
> - **Cómo aplicar:** responder thread con proyectos + propuesta tarifa
> - ⚠️ Verificar si sigue activa (publicada hace 30 días)

---

## MEJORAS PENDIENTES (backlog para v3)

- [ ] Automatizar scraping de Vapi Discord via API si Carlos agrega token
- [ ] Agregar fuente: Pangea.app matching para LatAm
- [ ] Agregar fuente: Howdy.com job listings
- [ ] Agregar fuente: Listado semanal de Superhuman AI newsletter
- [ ] Buscar en Twitter/X directamente si se agrega API key
- [ ] Agregar benchmark salarial automático por rol usando Glassdoor/levels.fyi
- [ ] Detectar si empresa target tiene "Open to Work" signal en LinkedIn

---

## LISTA COMPLETA DE FUENTES (referencia rápida)

| # | Fuente | URL | Prioridad | Idioma |
|---|---|---|---|---|
| 1 | InfoJobs España | https://www.infojobs.net/ofertas-trabajo/n8n | 🥇 Alta | ES |
| 2 | Indeed España | https://es.indeed.com/q-n8n-empleos.html | 🥇 Alta | ES |
| 3 | Tecnoempleo | https://www.tecnoempleo.com/ofertas-trabajo/inteligencia-artificial-machine-learning | 🥇 Alta | ES |
| 4 | Manfred | https://www.getmanfred.com/ofertas-empleo | 🥇 Alta | ES |
| 5 | Get on Board | https://getonboard.com/jobs?query=automation&remote=true | 🥈 Media-alta | ES/EN |
| 6 | Torre.co | https://torre.co/jobs?q=AI+automation&remote=true | 🥈 Media-alta | ES/EN |
| 7 | WeRemoto | https://www.weremoto.com/?search=automatizacion | 🥈 Media-alta | ES |
| 8 | Bumeran AR | https://www.bumeran.com.ar/empleos-busqueda-n8n.html | 🥈 Media | ES |
| 9 | Glassdoor España | https://www.glassdoor.es/Empleo/espa%C3%B1a-n8n-empleos-SRCH_IL.0,6_IN219_KO7,10.htm | 🥈 Media | ES/EN |
| 10 | Himalayas.app | https://himalayas.app/jobs/ai-in-automation | 🥉 Media | EN |
| 11 | n8n Community | https://community.n8n.io/c/jobs/ | 🥉 Media | EN/ES |
| 12 | Wellfound | https://wellfound.com/role/r/automation-engineer | 🥉 Media | EN |
| 13 | YC Work at Startup | https://www.workatastartup.com/jobs?q=automation | 🏅 Media | EN |
| 14 | WeWorkRemotely | https://weworkremotely.com (vía search) | 🥉 Media | EN |
| 15 | Remotive | https://remotive.com/remote-jobs/software-dev | 🥉 Media | EN |
| 16 | Working Nomads | https://www.workingnomads.com/remote-automation-jobs | 🥉 Media | EN |
| 17 | Remote.co | https://remote.co/remote-jobs/developer/ | 🏅 Baja | EN |
| 18 | JustRemote | https://justremote.co/remote-developer-jobs | 🏅 Baja | EN |
| 19 | EuropeRemotely | https://europeremotely.com/jobs | 🏅 Media (EU) | EN |
| 20 | RemoteOK | https://remoteok.com/remote-automation-jobs | 🏅 Baja | EN |
| 21 | AI Jobs Net | https://aijobs.net/jobs/?q=automation&location=remote | 🏅 Baja | EN |
| 22 | Built In Remote | https://builtin.com/jobs/remote/dev-engineering | 🏅 Baja | EN |
| 23 | Ben's Bites Jobs | https://bensbites.pallet.com/ | 🏅 Baja | EN |
| 24 | HN Who is Hiring | https://news.ycombinator.com (thread mensual) | 🏅 Baja | EN |
| 25 | Reddit r/n8n | WebSearch site:reddit.com r/n8n | 🎖️ Baja | EN |
| 26 | Twitter/X | WebSearch site:x.com "hiring n8n" | 🎖️ Variable | EN/ES |
| 27 | Career pages T2/T3 | Iterar targets/*.md | Variable | ES/EN |
| 28 | LinkedIn España | WebSearch site:linkedin.com/jobs España n8n | 🥇 Alta | ES/EN |
