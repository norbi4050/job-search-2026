# Case Study — MisionesArrienda

## Construyendo un marketplace inmobiliario con desarrollo asistido por IA

**Proyecto:** misionesarrienda.com.ar
**Rol:** Founder & AI-Assisted Product Builder (sole builder)
**Período:** 2024 – 2026 (2 años, en producción)
**Cliente real:** inmobiliaria local de Misiones (Argentina)
**Escala:** 400+ propiedades activas en producción

---

## TL;DR

Construí end-to-end un marketplace inmobiliario regional, en producción, gestionando inventario real para una inmobiliaria local. Lo hice **solo**, usando desarrollo asistido por IA (Claude Code + Cursor) sobre stack moderno (Next.js, Supabase, Vercel). No soy programador tradicional — soy un **AI-augmented builder** que sabe llevar productos de cero a producción aprovechando las herramientas emergentes.

---

## El problema

En la provincia de Misiones (Argentina), el mercado inmobiliario regional tenía un problema clásico:

- Las inmobiliarias locales publicaban su inventario en redes sociales (Instagram, Facebook) y portales nacionales genéricos (donde competían con CABA y Córdoba y se diluían)
- Los compradores/inquilinos buscaban en grupos de WhatsApp y Marketplace, perdiendo horas filtrando ofertas no relacionadas
- No existía un portal **regional, especializado y curado** para Misiones específicamente

Una inmobiliaria local me planteó el dolor: "necesito un canal donde mi inventario se vea y se busque sin competir con todo el país".

---

## La solución

Un marketplace web especializado para Misiones, con foco en:

1. **Búsqueda y filtrado optimizados para el mercado local** (zonas, barrios, tipos de propiedad relevantes a la provincia)
2. **Gestión de inventario simple para la inmobiliaria** (alta, edición, baja de propiedades sin necesidad de soporte técnico)
3. **Performance y SEO regionales** para captar tráfico orgánico de búsquedas tipo "alquiler departamento Posadas" / "venta casa Oberá"
4. **Mantenimiento sostenible por una sola persona** (yo) sin equipo de desarrollo

---

## Arquitectura

```
┌─────────────────┐
│  Next.js + TS   │  ← Frontend SSR/ISR, SEO-friendly
│   (Vercel)      │
└────────┬────────┘
         │
         │  REST + Supabase Client
         │
┌────────▼────────┐
│   Supabase      │  ← Backend-as-a-Service
│ (PostgreSQL +   │     - Auth para admin de inmobiliaria
│  Storage +      │     - DB para propiedades, fotos, búsquedas
│  Auth + RLS)    │     - Storage para imágenes
└─────────────────┘
```

**Decisiones de arquitectura clave:**

- **Next.js sobre React puro:** SSR/ISR para SEO regional (Google Misiones tiene que indexar las propiedades)
- **Supabase sobre stack custom:** rapidez de desarrollo, RLS para multi-tenant futuro, storage incluido
- **Vercel:** deploy continuo desde Git, edge network global, costo bajo a esta escala
- **TypeScript:** previene clases enteras de bugs con un solo dev (nadie revisa mi PR)

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React · Next.js · TypeScript |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Hosting | Vercel |
| Tooling de desarrollo | Claude Code · Cursor |
| Versioning | Git + GitHub |

---

## Resultados

- ✅ **Plataforma en producción 24/7** desde 2024 (sin downtime significativo)
- ✅ **400+ propiedades** activas gestionadas por la inmobiliaria cliente
- ✅ **Sole maintenance** — un solo developer (yo) cubre desarrollo + ops + cliente
- ✅ **Iteración continua** basada en feedback directo del cliente operativo

---

## Aprendizajes clave

### 1. El AI-assisted development cambia quién puede shippear

Sin Claude Code y Cursor, este proyecto habría requerido:
- Un dev senior full-stack: $$$
- 4-6 meses de desarrollo
- Mantenimiento dependiente de esa persona

Con AI-assisted dev:
- 1 builder (yo) con entendimiento de producto y arquitectura
- Iteración mucho más rápida en código
- Mantenimiento sostenible solo, porque puedo entender y modificar cualquier parte con asistencia de IA

**No soy programador tradicional. Soy un builder que usa IA como compiler de intenciones.** Esto es un perfil profesional emergente y es lo que el mercado va a contratar masivamente en 2026-2027.

### 2. Supabase + Next.js es el dúo killer para builders solo

Para alguien que no quiere mantener infraestructura compleja, este stack te da:
- Auth, DB, Storage, RLS sin escribir backend manual
- SSR/ISR sin gestionar servers
- TypeScript end-to-end (Supabase genera los types desde el schema)

Recomendaría este stack para cualquier marketplace o SaaS regional/vertical hecho por 1-2 personas.

### 3. El cliente real fuerza decisiones honestas

Tener una inmobiliaria real usándolo todos los días impide caer en over-engineering:
- "¿Esta feature realmente la van a usar?" → no la construyo si la respuesta no es clara
- "¿Este flujo es entendible para alguien que no es técnico?" → testeo con el cliente antes de mergear
- "¿El admin lo puede operar sin llamarme?" → meta de UX prioritaria

---

## Qué haría diferente en una v2

- Tipos generados automáticamente desde Supabase desde el día 1 (lo agregué tarde)
- Cypress / Playwright para tests E2E del flujo de admin (ahora es manual)
- Métricas reales (PostHog / Plausible) desde el deploy inicial
- Un sistema de notificaciones más rico para el cliente (hoy es email simple)

---

## Conexión con Nexo-Terra

MisionesArrienda fue el proyecto que demostró internamente lo que **Nexo-Terra Automation** ofrece como servicio: construir productos shippables end-to-end usando IA + automatización moderna, sin necesidad de equipos grandes. Hoy aplicamos el mismo enfoque a clientes externos (voice agents, WhatsApp automation, workflow orchestration con n8n).

---

## Sobre mí

Carlos Norberto Gonzalez Archilla — AI Automation Specialist & Co-founder de Nexo-Terra Automation.

11+ años de experiencia en gestión operacional (restaurante 100 cubiertos en Buenos Aires, equipos de energía solar en Australia, franquicia educativa en Misiones-Paraguay), ahora enfocado full-time en construir soluciones con IA y automatización para PyMEs.

**Stack:** n8n · Vapi · Make.com · Claude · OpenAI · React/Next.js · Supabase
**Idiomas:** Español nativo · Inglés B2 (EF SET certified, 3 años en Australia)
**Disponible:** roles remotos full-time worldwide

📧 cgonzalezarchilla@gmail.com
💼 [LinkedIn](https://www.linkedin.com/in/carlos-norberto-gonzalez-archilla/)
🌐 [nexo-terra.com.ar](https://nexo-terra.com.ar)

---

*Última actualización: abril 2026*
