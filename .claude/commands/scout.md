---
description: Scout diario de ofertas de empleo para Carlos (AI Automation Specialist)
---

Sos un agente de búsqueda de empleo. Ejecutá el scout diario completo siguiendo `docs/agent-scout-prompt-v2.md` exactamente, incluyendo todos los pasos:

1. Leer criterios (`docs/superpowers/specs/2026-04-16-plan-empleo-ai-automation-design.md`, `targets/*.md`, `metrics/daily-routine.md`)
2. Buscar en las 28 fuentes priorizadas (España y LatAm primero)
3. Filtrar (descartar fluent English C1+, USA-only sin LatAm, sueldos < USD 1500/mes, senior backend/frontend puro)
4. Rankear por probabilidad: 🥇 Español → 🥈 LATAM-preferred → 🥉 Inglés escrito async-first → 🏅 Global → 🎖️ Freelance
5. Verificar duplicados en Airtable contra reportes anteriores y guardar nuevas ofertas
6. Crear `metrics/daily-scout-YYYY-MM-DD.md` con resumen completo
7. **OUTPUT FINAL OBLIGATORIO** (esta es la parte clave):

Después de ejecutar todo lo anterior, presentar al usuario un mensaje en chat con este formato exacto, **con links directos para aplicar de cada oferta**, agrupados por urgencia:

```
## 🥇 Aplicar HOY (máxima prioridad)

### N. {Empresa} — {Rol} {🇪🇸 ESPAÑOL si aplica}
👉 **Aplicar:** {URL directo de aplicación}
- {país aceptado / restricción geo}
- Stack: {stack relevante}
- {tipo: full-time/freelance/contractor}
- **Cómo aplicar:** {instrucción concreta — ej: "responder thread con proyectos", "click Apply now", "mandar CV a email X"}
- ⚠️ {avisos: verificar activa, deadline, etc.}

## 🥈 Aplicar esta semana
[mismo formato]

## 🥉 Verificar primero
[mismo formato + nota de qué verificar]

## 🎖️ Freelance bonus (opcional)
[si hay ofertas freelance interesantes]

## Sugerencia táctica
[3-5 bullets concretos: "Hoy: aplicar a #1, #2, verificar #7. Mañana: ContentJet x2."]
```

**Reglas del output final:**
- Solo incluir ofertas con URL accionable real (no "buscá en X")
- Si una oferta no tiene URL directa de aplicación, marcarla con ⚠️ y dar instrucciones alternativas
- Las que apliquen "🇪🇸 ESPAÑOL" deben ir SIEMPRE primero, sin excepción
- Máximo 3-5 líneas por oferta — el usuario tiene que poder escanear rápido
- Cerrar con sugerencia táctica de orden de aplicación

Si el resultado del scout fue 0 ofertas válidas: presentar "Sin ofertas nuevas hoy — se revisaron N en M fuentes" + listar las 3 fuentes principales que no respondieron.

Después del output final, hacer commit con `scout: búsqueda diaria YYYY-MM-DD` y push.
