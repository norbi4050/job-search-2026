# Content Planning Skill — Design Spec

**Fecha:** 2026-04-27
**Proyecto:** elan.casa — Reels Pipeline
**Skill name:** `content-planning`
**Trigger:** cuando el usuario quiere planificar un nuevo reel para elan.casa

---

## Propósito

Skill de Claude Code que actúa como **directora creativa profesional** especializada en reels para elan.casa. Guía al usuario (sin experiencia en producción) desde una idea vaga hasta un brief de producción completo listo para ejecutar en el pipeline n8n + gpt-image-1 + fal.ai + ElevenLabs.

La skill cubre el gap entre "tengo una idea de reel" y "brief con dirección creativa precisa que el pipeline puede ejecutar".

---

## Contexto técnico del pipeline

El pipeline existente funciona así:

1. **gpt-image-1** genera 2 imágenes por escena (keyframe inicio + keyframe fin) → ~14 imágenes para un reel de 7 escenas
2. **n8n** llama a `/render` → **fal.ai** convierte cada par inicio/fin en un video clip de 4-5s
3. **ffmpeg** ensambla los clips + **ElevenLabs** (voz Sofía) agrega el voiceover → video final

**Implicación para el diseño:** el par inicio/fin de cada escena tiene que mostrar un cambio visual concreto y creíble. Si las imágenes son casi iguales, fal.ai genera un clip estático. Si cambian demasiado, la interpolación falla.

### Brief que acepta el pipeline (`/brief` endpoint)

```typescript
interface Brief {
  format: 'reel' | 'presentacion';
  linea_negocio: 'solar' | 'domotica' | 'ambas';
  arco?: 'lifestyle' | 'educativo' | 'fomo' | 'tecnico';
  tema_libre?: string;  // ← aquí va la dirección creativa detallada
}
```

### Productos permitidos
- **Shelly:** switches, dimmers, Shelly 2.5 (persianas motorizadas), Plug, Motion sensor
- **Fibaro+:** keypads, motion sensors, roller shutters, Home Center hub
- **Enertik:** paneles solares grid-tied, inversor solar (sin baterías, sin off-grid)

### Shot templates disponibles
`establishing_home`, `shelly_device_macro`, `app_control_hands`, `lights_scene_living`, `curtain_morning`, `motion_lights_hall`, `climate_smart`, `fibaro_keypad_macro`, `fibaro_sensor_room`, `fibaro_app_tablet`, `solar_panels_roof`, `solar_inverter_macro`, `energy_savings_graph`, `solar_day_timelapse`, `home_overview_auto`

### Restricciones del pipeline
- Sin caras ni personas identificables
- Sin marcas no autorizadas (Crestron, KNX, Control4, etc.)
- Sin cámaras de seguridad, baterías solares, off-grid
- Tono: Apple/Tesla — lifestyle aspiracional, no jerga técnica
- Tagline: "Habite el futuro"

---

## Flujo de la skill (3 fases)

```
Fase 1: Estrategia
  → 3-4 preguntas de una a la vez
  → Define objetivo, audiencia, línea de negocio, tono
  → Output: contexto estratégico del reel

Fase 2: Plan narrativo completo
  → La skill propone el reel completo (arco, escenas en orden, hook, CTA)
  → Usuario revisa y aprueba o ajusta
  → Output: estructura narrativa aprobada (N escenas, qué cuenta cada una)

Fase 3: Producción escena por escena
  → Para cada escena: 5-7 preguntas profesionales de producción
  → Genera prompts inicio + fin + motion + narración
  → Output: bloque de producción completo por escena

Output final: archivo .md + brief JSON para el pipeline
```

---

## Fase 1 — Estrategia

La skill lee automáticamente el contexto base de elan.casa (brand guidelines, tono, productos) y pregunta:

1. **Objetivo del reel** — ¿Qué acción querés que tome quien lo ve? (ej: visitar elan.casa, mandar WhatsApp, guardar el video, reconocer la marca)
2. **Línea de negocio** — ¿Solar, domótica, o ambas?
3. **Audiencia específica** — ¿A quién le hablás en este reel? (ej: dueño de casa clase media-alta, arquitecto, constructora, familia con hijos)
4. **Punto de partida emocional** — ¿Qué siente el espectador antes de ver el reel que querés cambiar? (ej: "no sé que es la domótica", "sé que existe pero me parece caro", "me interesa el solar pero no sé si funciona en Misiones")

---

## Fase 2 — Plan narrativo completo

Con la estrategia definida, la skill actúa como guionista y propone:

### Estructura que presenta la skill:

```
REEL: [Título propuesto]
Duración total: ~30s | Escenas: 7 | Arco: [lifestyle/fomo/educativo/técnico]

Hook (0-3s):     Escena 1 — [qué muestra, por qué engancha]
Desarrollo:      Escena 2 — [emoción/beneficio]
                 Escena 3 — [emoción/beneficio]
                 Escena 4 — [emoción/beneficio]
                 Escena 5 — [emoción/beneficio]
Cierre:          Escena 6 — [resolución emocional]
CTA:             Escena 7 — [acción concreta: logo + tagline + contacto]

Voiceover (tono general): [descripción del estilo narrativo]
Caption Instagram: [borrador]
```

El usuario aprueba, pide cambios, o ajusta escenas. La skill itera hasta tener el plan aprobado.

**Regla del hook:** La escena 1 tiene que generar curiosidad o reconocimiento en los primeros 2 segundos. La skill propone siempre un hook con cambio visual fuerte (ej: casa a oscuras → iluminación perfecta, factura de luz alta → número bajo).

---

## Fase 3 — Producción escena por escena

Con el plan narrativo aprobado, la skill trabaja cada escena en orden. Para cada una hace estas preguntas:

### Preguntas de producción por escena

1. **Estado inicial** — "¿Qué está pasando al empezar la escena?" (ej: living con luz apagada, persiana cerrada con sol afuera, mano acercándose al Shelly)
2. **Estado final** — "¿Qué cambió en esos 4-5 segundos?" (ej: luz cálida encendida, persiana subida con luz entrando, pantalla mostrando 'Luces: ON')
3. **Cambio visual** — ¿El cambio es gradual (luz que sube lento) o contrastado (antes/después)?
   - Gradual → fal.ai interpola bien → `crossfade_300ms` si mismo espacio
   - Muy contrastado → mejor separar en 2 escenas o usar `hard_cut`
4. **Protagonista** — ¿Qué objeto es el foco? ¿Primer plano del dispositivo o ambiente completo?
5. **Luz y momento** — ¿Luz natural de día, atardecer, noche con luz artificial, luz dramática interior?
6. **Emoción de la escena** — ¿Qué siente el espectador? (confort, control, ahorro, modernidad, FOMO, sorpresa)
7. **Movimiento de cámara** — ¿La cámara avanza (dolly-in), retrocede, hace paneo suave, queda estática?

### Output por escena

```markdown
## Escena N — [Espacio] / [Producto/Acción]

**Shot template:** lights_scene_living
**Espacio físico:** living_room
**Duración:** 5s
**Emoción:** confort, control del ambiente
**Transición siguiente:** crossfade_300ms

### Prompt imagen INICIO (gpt-image-1):
Interior living room Argentina upper-middle class home, warm evening light,
Shelly dimmer installed elegantly on white wall, lights OFF, ambient darkness,
no people, cinematic composition, photorealistic, 8K, Apple aesthetic

### Prompt imagen FIN (gpt-image-1):
[misma composición] lights ON, warm amber glow, cozy atmosphere,
soft shadows, sense of comfort and control, photorealistic, 8K

### Motion prompt (fal.ai):
slow dolly-in toward dimmer, 5 seconds, smooth easing, no shake

### Narración ElevenLabs (Sofía):
"Con un toque, tu casa te entiende."
```

---

## Output final

### Archivo `.md`

**Ruta:** `C:\Users\noyag\OneDrive\Datos adjuntos\Documentos\12.NORBY\Personal Norby\Domotica\docs\content\reels\YYYY-MM-DD-<titulo>.md`

**Estructura del archivo:**

```markdown
# Reel: [Título]

## Estrategia
- Objetivo: [acción concreta]
- Audiencia: [quién específico]
- Línea de negocio: solar/domótica/ambas
- Arco: lifestyle/fomo/educativo/técnico
- Duración: ~30s | Escenas: 7

## Plan narrativo
[descripción del arco y flujo emocional]

## Escenas
[bloque por escena con prompts inicio/fin + motion + narración]

## Caption Instagram
[texto completo con hashtags]

## Brief para el pipeline
```json
{
  "format": "reel",
  "linea_negocio": "domotica",
  "arco": "lifestyle",
  "tema_libre": "[dirección creativa detallada de todas las escenas]"
}
```
```

### Brief JSON para el pipeline

El `tema_libre` del brief incluye la dirección creativa detallada de cada escena para que el Claude del pipeline (`storyboard.ts`) genere el storyboard alineado con lo que se planificó.

---

## Comportamiento de la skill

- **Una pregunta a la vez** — nunca bombardear con múltiples preguntas juntas
- **Propone, no interroga** — en Fase 2 la skill propone el plan completo y el usuario reacciona
- **Tono profesional pero accesible** — Carlos no tiene experiencia en producción; explicar el "por qué" de cada pregunta en una línea
- **Conoce el pipeline** — entiende que cada escena genera 2 imágenes para fal.ai y hace preguntas pensando en eso
- **Conoce la marca** — no necesita que le expliquen elan.casa, brand guidelines, productos o tono en cada sesión
- **Genera prompts en inglés** — gpt-image-1 funciona mejor con prompts en inglés

---

## Contexto base de la skill (hardcoded)

La skill incluye internamente:
- Productos permitidos y prohibidos
- Shot templates disponibles
- Reglas de transición (crossfade_300ms mismo espacio, hard_cut distinto espacio)
- Tono Apple/Tesla, tagline "Habite el futuro"
- Restricción: sin personas, sin marcas no autorizadas
- Reglas de motion_prompt: solo movimiento de cámara, nunca contenido visual
- Regla de keyframes: el cambio inicio→fin debe ser creíble para interpolación de 4-5s

---

## Archivos de referencia

- Brand guidelines: `docs/00-BRAND/brand-guidelines.md`
- Pipeline types: `agent-sdk/src/types/index.ts`
- Storyboard generator: `agent-sdk/src/agent/storyboard.ts`
- Spec pipeline: `docs/superpowers/specs/2026-04-20-reels-pipeline-elan-casa-design.md`
