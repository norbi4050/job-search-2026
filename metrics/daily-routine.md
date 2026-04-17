# Daily Routine — Aplicaciones (30 min/día, lunes a viernes)

**Tiempo total: 30 minutos. Si terminás antes, terminás antes.**
**Si tarda más, parar — algo está sobre-pensado.**

---

## Setup (3 min)

1. Abrir Airtable base "Job Search 2026" → vista "Activas" (chequear si llegaron respuestas)
2. Abrir Gmail (carpeta etiquetada "Job Search")
3. Abrir LinkedIn (notificaciones)

---

## Buscar nuevas ofertas (10 min)

Revisar en este orden:

1. **Email job alerts** (3 min)
   - LinkedIn Jobs daily
   - WeWorkRemotely weekly
   - RemoteOK alerts
   - Terminal / Howdy / Arc notifications

2. **Comunidades** (3 min)
   - n8n community: https://community.n8n.io/c/jobs/
   - Vapi Discord canal #jobs
   - Make community

3. **Búsqueda directa LinkedIn Jobs** (4 min)
   - Keywords: `"n8n"` OR `"Vapi"` OR `"AI Automation"` OR `"workflow automation"`
   - Filtros: Remote · Argentina + Latin America + Spain + United States
   - Date posted: Past 24 hours

### Filtrado al vuelo (descartar antes de aplicar)

Para cada oferta encontrada, chequear:

- ❌ **¿Inglés requerido es C1+ "fluent" "native-level"?** → DESCARTAR
- ❌ **¿Es Solutions Engineer / Sales Engineer cara a cliente USA puro?** → DESCARTAR
- ❌ **¿Sueldo mencionado <USD 1.500/mes?** → DESCARTAR (excepción: empresa muy interesante o contrato corto)
- ❌ **¿Pide >5 años de exp como dev backend/frontend tradicional?** → DESCARTAR
- ✅ **¿Empresa hispana / async-first / con manager bilingüe / o no menciona inglés C1?** → APLICAR

**Target diario: identificar 3-5 ofertas válidas.** Si hay menos, no fuerces.

---

## Aplicar (12 min, ~3 min por aplicación)

Para cada oferta válida:

1. **Crear registro en Airtable** (vista "Esta semana")
   - Empresa, Rol, URL, Tier, Fuente, Idioma manager
2. **Elegir template** apropiado:
   - Agencia gringa → `cover-letters/template-agency-en.md`
   - Empresa hispana / LatAm → `cover-letters/template-hispanic-usa-es.md`
   - Startup YC tech-forward → `cover-letters/template-startup-en.md`
3. **Personalizar mínimo:** `{{COMPANY}}` y `{{SPECIFIC_HOOK or ENGANCHE}}`
   - Si te toma >2 min personalizar → la oferta no encaja, descartá
4. **Adjuntar CV correspondiente:** `cv-es.pdf` o `cv-en.pdf` (según oferta)
5. **Enviar** (LinkedIn Easy Apply / formulario web / email)
6. **Guardar copia enviada** en `cover-letters/sent/YYYY-MM-DD-{{empresa}}.md`
7. **Actualizar Airtable:** Estado = "Aplicado", Fecha aplicación = hoy

---

## Cierre (5 min)

1. **Revisar bandeja de entrada** por respuestas a aplicaciones previas
   - Responder lo que sea urgente (entrevistas: agendar)
   - Marcar email como leído / archivar

2. **Follow-ups pendientes** (vista "Pendientes follow-up" en Airtable)
   - Si hay aplicación >14 días sin respuesta y sin follow-up enviado:
     - Enviar UN follow-up suave (template corto: "Hi {{name}}, just following up on my application from {{date}} for {{role}}. Happy to share more if useful. — Carlos")
     - Marcar checkbox `Follow-up enviado` + fecha
   - **Solo UN follow-up. Nunca dos. No se insiste.**

3. **Anotar números del día** en `metrics/weekly-checkins.md`:
   - Aplicaciones enviadas hoy
   - Respuestas recibidas hoy

---

## Reglas durante la routine

- ❌ **NO** entrar a sitios de proyectos personales (nexo-terra.com.ar, misionesarrienda, elan.casa)
- ❌ **NO** abrir editores de código de proyectos personales
- ❌ **NO** buscar "cosas para construir" o "cosas para mejorar"
- ✅ **SI** surge una idea durante la routine → 30 segundos para anotarla en `backlog.md` con fecha → volver a la routine inmediatamente
- ✅ **SI** llega una respuesta importante (entrevista) → atender SOLO si es urgente, sino terminar la routine primero

---

## Si un día no podés hacer 30 min

- Hacé 10 min (mínimo viable: 1 aplicación)
- **NO acumular para el siguiente día** — eso solo crea ansiedad
- Marcar el día como "10 min" en weekly-checkins, no como "0"

## Si un día estás sin energía

- Saltá el día completamente
- Anotar "skip" en weekly-checkins con motivo (cansancio, otro tema)
- **Máximo 2 skips por semana.** Si sucede más, revisar plan en check-in semanal.
