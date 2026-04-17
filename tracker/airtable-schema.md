# Airtable Schema — Job Search 2026

**Base name:** `Job Search 2026`
**Crear vía:** MCP Airtable de Claude Code, o manualmente en airtable.com

---

## Tabla 1 — `Applications`

| Campo | Tipo | Opciones / Notas |
|---|---|---|
| Empresa | Single line text | — |
| Rol | Single line text | título exacto de la oferta |
| Tier | Single select | T1-Plataforma · T2-Agencia · T3-Hispana USA · T4-Startup YC · T5-Job Board · Otro |
| Fuente | Single select | LinkedIn · Howdy · Terminal · Lemon · Arc · Pangea · WeWorkRemotely · n8n community · Make community · Vapi Discord · RemoteOK · Email directo · Otro |
| URL oferta | URL | — |
| Fecha aplicación | Date | format ISO |
| Estado | Single select | Aplicado · Visto · Respuesta inicial · Entrevista screening · Entrevista técnica · Oferta · Rechazado · Sin respuesta (>14d) · Cerrado |
| Idioma manager | Single select | Español · Inglés · Bilingüe · Desconocido |
| Salario min (USD) | Number | mensual |
| Salario max (USD) | Number | mensual |
| Modalidad | Single select | Remote · Hybrid · On-site · No especificado |
| Notas | Long text | observaciones, links a personas relevantes |
| Follow-up enviado | Checkbox | — |
| Fecha follow-up | Date | — |
| Empresa relacionada | Link to "Empresas Target" | opcional, si la empresa estaba en target list |

## Tabla 2 — `Empresas Target`

| Campo | Tipo | Opciones |
|---|---|---|
| Empresa | Single line text | — |
| Tier | Single select | mismo que Applications |
| Sitio web | URL | — |
| Por qué encaja | Long text | 1-2 líneas |
| Estado búsqueda | Single select | Sin investigar · Investigado · Aplicado · Sin oferta activa · Descartado |
| Idioma manager | Single select | Español · Inglés · Bilingüe · Desconocido |
| Aplicaciones relacionadas | Link to Applications | — |
| Fecha última revisión | Date | cuándo chequeaste si tienen ofertas |

---

## Vistas a crear en `Applications`

### Vista 1: "Esta semana"
- Filter: `Fecha aplicación` is within → "Past 7 days"
- Sort: `Fecha aplicación` descending

### Vista 2: "Pendientes follow-up"
- Filter:
  - `Estado` IS one of [Aplicado, Sin respuesta (>14d)]
  - `Fecha aplicación` is more than → "14 days ago"
  - `Follow-up enviado` is unchecked
- Sort: `Fecha aplicación` ascending

### Vista 3: "Activas"
- Filter: `Estado` IS one of [Respuesta inicial, Entrevista screening, Entrevista técnica, Oferta]
- Sort: `Fecha aplicación` descending
- **Esta es la vista MÁS importante de revisar diariamente.**

### Vista 4: "Embudo"
- Group by: `Estado`
- Sort: `Fecha aplicación` descending
- Sirve para ver visualmente dónde está cada aplicación.

### Vista 5: "Por tier"
- Group by: `Tier`
- Útil para ver dónde está funcionando mejor el outreach.

---

## Vistas a crear en `Empresas Target`

### Vista 1: "Sin investigar"
- Filter: `Estado búsqueda` = "Sin investigar"
- Sort: `Tier` ascending

### Vista 2: "Por tier"
- Group by: `Tier`

---

## Comando para crear vía MCP Airtable

Cuando estés listo para crear la base, decirme en chat:

> "Creá la base 'Job Search 2026' en Airtable con el schema definido en `tracker/airtable-schema.md`"

Y yo uso el MCP de Airtable para crearla con todas las tablas, campos y vistas.

---

## Reglas de uso

- **Cada aplicación se carga en Airtable ANTES de enviar la cover letter** (te fuerza a revisar fit del idioma y rol)
- **Cada respuesta se actualiza el mismo día** (estado + notas)
- **Follow-up automático a los 14 días** si no hubo respuesta — enviar UN solo follow-up suave, marcar checkbox
- **Si llega oferta** → revisar checklist de "definición de done" del spec antes de aceptar
