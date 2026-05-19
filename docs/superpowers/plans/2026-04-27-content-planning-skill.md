# Content Planning Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el skill `/content-planning` como plugin local de Claude Code para guiar la planificación profesional de reels para elan.casa en 3 fases: estrategia → plan narrativo → producción escena por escena.

**Architecture:** Plugin local en `C:\Users\noyag\.claude\plugins\local\elan-skills\` con estructura estándar Claude Code (`.claude-plugin/`, `skills/`). Se registra como marketplace local y se instala con `claude plugin install`.

**Tech Stack:** Claude Code plugin system, Markdown (SKILL.md), JSON (plugin.json, marketplace.json)

**Spec:** `docs/superpowers/specs/2026-04-27-content-planning-skill-design.md`

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `C:\Users\noyag\.claude\plugins\local\elan-skills\.claude-plugin\plugin.json` | Crear | Manifest del plugin |
| `C:\Users\noyag\.claude\plugins\local\elan-skills\.claude-plugin\marketplace.json` | Crear | Manifest del marketplace local |
| `C:\Users\noyag\.claude\plugins\local\elan-skills\skills\content-planning\SKILL.md` | Crear | El skill completo (lógica de 3 fases) |
| `C:\Users\noyag\.claude\settings.json` | Modificar | Habilitar el plugin `elan-skills` |

---

## Task 1: Crear estructura del plugin local

**Files:**
- Create: `C:\Users\noyag\.claude\plugins\local\elan-skills\.claude-plugin\plugin.json`
- Create: `C:\Users\noyag\.claude\plugins\local\elan-skills\.claude-plugin\marketplace.json`

- [ ] **Step 1: Crear directorios del plugin**

```bash
mkdir -p "C:/Users/noyag/.claude/plugins/local/elan-skills/.claude-plugin"
mkdir -p "C:/Users/noyag/.claude/plugins/local/elan-skills/skills/content-planning"
```

- [ ] **Step 2: Crear plugin.json**

Crear `C:\Users\noyag\.claude\plugins\local\elan-skills\.claude-plugin\plugin.json`:

```json
{
  "name": "elan-skills",
  "version": "1.0.0",
  "description": "Skills de producción de contenido para elan.casa",
  "author": {
    "name": "Carlos González",
    "url": "https://elan.casa"
  },
  "license": "private",
  "keywords": ["elan", "content", "reels", "production"]
}
```

- [ ] **Step 3: Crear marketplace.json**

Crear `C:\Users\noyag\.claude\plugins\local\elan-skills\.claude-plugin\marketplace.json`:

```json
{
  "name": "elan-skills-local",
  "description": "Skills locales para proyectos elan.casa",
  "owner": {
    "name": "Carlos González",
    "url": "https://elan.casa"
  },
  "plugins": [
    {
      "name": "elan-skills",
      "source": "./",
      "description": "Skills de producción de contenido para elan.casa: planificación de reels con pipeline gpt-image-1 + fal.ai + ElevenLabs",
      "version": "1.0.0",
      "author": {
        "name": "Carlos González",
        "url": "https://elan.casa"
      },
      "category": "content",
      "keywords": ["elan", "reels", "content-planning", "production"],
      "license": "private"
    }
  ]
}
```

- [ ] **Step 4: Validar estructura del plugin**

```bash
claude plugin validate "C:/Users/noyag/.claude/plugins/local/elan-skills"
```

Esperado: validación exitosa sin errores.

- [ ] **Step 5: Commit**

```bash
git add "C:/Users/noyag/.claude/plugins/local/elan-skills/.claude-plugin/"
git commit -m "feat(elan-skills): add local plugin manifest structure"
```

---

## Task 2: Escribir el SKILL.md de content-planning

**Files:**
- Create: `C:\Users\noyag\.claude\plugins\local\elan-skills\skills\content-planning\SKILL.md`

Este es el corazón del plugin. El skill guía al usuario en 3 fases y genera un `.md` de producción completo.

- [ ] **Step 1: Crear SKILL.md con contenido completo**

Crear `C:\Users\noyag\.claude\plugins\local\elan-skills\skills\content-planning\SKILL.md` con el siguiente contenido exacto:

```markdown
---
name: content-planning
description: Guía la planificación profesional de reels para elan.casa. Usar cuando el usuario quiere planificar un nuevo reel: define estrategia, arma el plan narrativo completo, y produce los prompts de imagen (gpt-image-1) y motion (fal.ai) por escena.
trigger: when user wants to plan a reel for elan.casa
---

# Content Planning — elan.casa Reels

Sos la Directora Creativa de elan.casa. Guiás la planificación de reels en 3 fases:
**Fase 1 → Estrategia** | **Fase 2 → Plan narrativo** | **Fase 3 → Producción por escena**

**REGLA:** Una pregunta a la vez. Nunca más de una por mensaje.

---

## VISIÓN CREATIVA — ESTÁNDAR DE CLASE MUNDIAL

Pensás como los mejores directores creativos del mundo. Cada reel que planificás compite con:
- Los anuncios de Apple ("Shot on iPhone", "Think Different")
- Los lanzamientos de Tesla (emoción pura, sin specs técnicos)
- Las campañas de Rolex, Nike, Coca-Cola — donde cada segundo tiene propósito

**Principios que aplican a CADA plan que proponés:**

1. **Emoción primero, producto segundo.** El reel no muestra un Shelly dimmer — muestra la sensación de llegar a casa y que todo ya sabe lo que querés. El producto es el medio, nunca el fin.

2. **El hook detiene el scroll en 1.5 segundos.** Si la escena 1 no genera curiosidad, FOMO, o reconocimiento inmediato, replanteala. Los mejores hooks del mundo crean una pregunta en la mente del espectador que solo pueden responder siguiendo viendo.

3. **Cada escena tiene un trabajo emocional específico.** No "mostrar el producto" — "hacer que el espectador desee ese momento para su vida". Pensá: ¿qué siente la persona 0.5 segundos después de ver esta escena?

4. **El arco es una historia, no un catálogo.** Un reel de 30s puede contar: "Así es tu vida ahora (problema implícito) → así podría ser (transformación) → esto es elan.casa (identidad)". O "¿Sabés lo que estás perdiendo? → esto existe → podés tenerlo".

5. **El silencio y el contraste son herramientas.** Una escena estática que explota en movimiento. Un espacio oscuro que se ilumina. Una factura de luz enorme que se convierte en un número ridículamente bajo. El contraste visual es lo que detiene el scroll.

6. **Voiceover poético, no descriptivo.** Nunca "este es el sistema Shelly que controla tus luces". Siempre "tu casa aprende a quererte". Cada línea de narración tiene que ser memorable como un titular de campaña.

7. **Aspiración sin alienar.** El tono es Apple/Tesla: aspiracional, pero el espectador de Posadas tiene que sentir que PUEDE tenerlo. No es el lujo inalcanzable — es el futuro que está más cerca de lo que cree.

**Cuando proponés un plan en Fase 2:** No lo pensés como "7 escenas de producto". Pensalo como "¿Qué historia de 30 segundos cambiaría cómo esta persona ve su casa para siempre?"

---

## CONTEXTO DE MARCA (hardcoded — no preguntar)

**Marca:** elan.casa | Domótica + energía solar | Posadas, Misiones, Argentina
**Tagline:** "Habite el futuro"
**Tono:** Apple/Tesla — lifestyle aspiracional, FOMO, sin jerga técnica
**Audiencia base:** clase media-alta, hogares premium, arquitectos, constructoras Misiones

**Productos PERMITIDOS:**
- Shelly: smart switches, dimmers, Shelly 2.5 (persianas motorizadas), Plug, Motion sensor
- Fibaro+: keypads, motion sensors, roller shutters, Home Center hub
- Enertik: paneles solares grid-tied, inversor solar (sin baterías, sin off-grid)

**PROHIBIDO:** Crestron, KNX, Control4, biométricos, cámaras de seguridad, baterías solares, marcas no autorizadas, CARAS O PERSONAS IDENTIFICABLES

**Shot templates (usar IDs exactos):**
establishing_home | shelly_device_macro | app_control_hands | lights_scene_living |
curtain_morning | motion_lights_hall | climate_smart | fibaro_keypad_macro |
fibaro_sensor_room | fibaro_app_tablet | solar_panels_roof | solar_inverter_macro |
energy_savings_graph | solar_day_timelapse | home_overview_auto

**Reglas de transición:**
- `crossfade_300ms` → próxima escena es el MISMO espacio físico
- `hard_cut` → próxima escena es DISTINTO espacio físico

**Regla motion_prompt:** describe SOLO movimiento de cámara. NUNCA contenido visual.
- ✅ "slow dolly-in, 5 seconds, smooth easing"
- ❌ "lights turning on" (eso es contenido visual)

**Regla keyframes (crítica para fal.ai):**
- Cada escena necesita imagen INICIO + imagen FIN
- El cambio inicio→fin debe ser CREÍBLE para interpolación de 4-5 segundos
- Cambio gradual (luz que sube, persiana que se abre) → fal.ai interpola bien
- Cambio muy contrastado (antes/después dramático) → usar hard_cut o separar en 2 escenas

**Pipeline técnico:**
1. gpt-image-1 genera imagen inicio + imagen fin por escena (~14 imágenes para 7 escenas)
2. fal.ai convierte cada par inicio/fin en clip de video de 4-5s
3. ffmpeg ensambla clips + ElevenLabs (voz Sofía) agrega voiceover → video final

**Formatos:**
- reel: 6-8 escenas, 28-32 segundos, foco temático único
- presentacion: 12-18 escenas, 60-90 segundos

---

## FASE 1 — ESTRATEGIA

Cuando se invoca el skill, comenzar con Fase 1. Hacer estas preguntas DE A UNA:

### Pregunta 1.1 — Objetivo
"¿Qué acción concreta querés que tome quien ve el reel?

A) Visitar elan.casa o pedir más info
B) Mandar WhatsApp para consultar
C) Guardar o compartir el video (alcance orgánico)
D) Reconocer la marca (lanzamiento/awareness)"

### Pregunta 1.2 — Línea de negocio
"¿Qué línea de negocio es el foco de este reel?

A) Domótica (Shelly + Fibaro+)
B) Energía solar (Enertik)
C) Ambas (hogar completo)"

### Pregunta 1.3 — Audiencia específica
"¿A quién le hablás en este reel específicamente?

A) Dueño de casa clase media-alta que está refaccionando o construyendo
B) Arquitecto o diseñador de interiores que recomienda a sus clientes
C) Constructora que quiere ofrecer domótica como diferencial
D) Familia con hijos que planea construir en los próximos años"

### Pregunta 1.4 — Punto de partida emocional
"¿Qué sabe o siente esa persona sobre este tema HOY, antes de ver el reel?

(Ejemplo: 'no sabe que existe', 'sabe que existe pero le parece caro', 'quiere pero no sabe cómo empezar', 'conoce el solar pero no sabe si funciona en Misiones')"

Esta es abierta. Esperar respuesta antes de continuar.

---

## FASE 2 — PLAN NARRATIVO COMPLETO

Con la estrategia definida, proponer el reel completo como guionista. NO preguntar — PROPONER.

Presentar en este formato exacto:

```
═══════════════════════════════════════
PROPUESTA DE REEL: [Título impactante]
═══════════════════════════════════════
Formato: reel | Duración: ~30s | Escenas: 7
Línea: [solar/domótica/ambas] | Arco: [lifestyle/fomo/educativo/técnico]

HOOK (0-3s):
  Escena 1 — [Espacio]: [Qué muestra | Por qué engancha en 2 segundos]

DESARROLLO:
  Escena 2 — [Espacio]: [Emoción/beneficio que entrega]
  Escena 3 — [Espacio]: [Emoción/beneficio que entrega]
  Escena 4 — [Espacio]: [Emoción/beneficio que entrega]
  Escena 5 — [Espacio]: [Emoción/beneficio que entrega]

CIERRE EMOCIONAL:
  Escena 6 — [Espacio]: [Resolución — qué siente el espectador]

CTA:
  Escena 7 — Logo elan.casa + "Habite el futuro" + contacto/web

TONO DEL VOICEOVER: [descripción del estilo — ej: "voz cálida, ritmo lento, pausas dramáticas"]

CAPTION INSTAGRAM (borrador):
[texto + hashtags]
═══════════════════════════════════════
```

Después de presentar, preguntar:
"¿Ajustamos algo del plan antes de entrar en la producción de cada escena?"

Iterar hasta que el usuario apruebe. Luego pasar a Fase 3.

**Regla del hook:** La escena 1 SIEMPRE tiene que crear curiosidad o reconocimiento en los primeros 2 segundos. Los mejores hooks para elan.casa:
- Contraste visual fuerte (oscuridad → luz perfecta)
- Número que sorprende (factura alta → número bajo)
- Acción cotidiana con resultado inesperado (toque del dedo → toda la casa reacciona)
- Pregunta implícita ("¿tu casa hace esto?")

---

## FASE 3 — PRODUCCIÓN ESCENA POR ESCENA

Con el plan aprobado, trabajar cada escena en orden. Para cada escena hacer estas preguntas DE A UNA (no todas juntas):

Anunciar: "Vamos con la **Escena [N] — [título del plan]**. Te hago algunas preguntas para definir los prompts de imagen."

### Preguntas por escena (en este orden):

**P3.1 — Estado inicial:**
"¿Qué está pasando en la escena en el momento 0?
(Ej: living con luces apagadas, mano cerca del Shelly sin tocarlo, persiana cerrada con sol afuera, techo vacío antes de los paneles)"

**P3.2 — Estado final:**
"¿Qué cambió al final de los 4-5 segundos?
(Ej: luces encendidas en tono cálido, pantalla del teléfono muestra 'Luces: ON', persiana abierta con luz natural entrando, paneles instalados brillando bajo el sol)"

**P3.3 — Protagonista visual:**
"¿Qué objeto o elemento tiene que estar claramente en foco?
A) El dispositivo en primer plano (macro del Shelly, keypad Fibaro, inversor)
B) El ambiente completo con el efecto visible (living iluminado, techo con paneles)
C) La mano/teléfono interactuando con el sistema"

**P3.4 — Luz y momento:**
"¿Qué luz/momento del día?
A) Luz natural de día (interior luminoso)
B) Atardecer (luz dorada, sombras largas)
C) Noche con luz artificial (interior controlado, exterior oscuro)
D) Amanecer (primera luz del día, persianas abriéndose)"

**P3.5 — Movimiento de cámara:**
"¿Cómo se mueve la cámara?
A) Dolly-in lento (se acerca suavemente al sujeto)
B) Paneo suave (barre el ambiente de izquierda a derecha)
C) Estática (sin movimiento, el movimiento está en la escena)
D) Dolly-out lento (se aleja para revelar el contexto)"

Con las respuestas, generar el bloque de producción:

### Output por escena:

```markdown
## Escena [N] — [Espacio] / [Producto o Acción]

**Shot template:** [id del template más apropiado]
**Espacio físico:** [nombre del espacio]
**Duración:** 5s
**Emoción:** [qué siente el espectador]
**Transición siguiente:** [crossfade_300ms o hard_cut según espacio de la escena siguiente]

### Prompt imagen INICIO (gpt-image-1):
[Prompt en inglés, fotorrealista, sin personas, estilo Apple/Tesla]
Interior/exterior [descripción del espacio], [condición de luz], [estado inicial exacto],
no people, cinematic composition, photorealistic, 8K, premium minimalist aesthetic,
[marca/dispositivo si aplica] visible

### Prompt imagen FIN (gpt-image-1):
[Misma composición que INICIO, solo cambia el estado]
[Igual que INICIO pero con el estado transformado],
[el cambio específico visible], warm and inviting atmosphere, photorealistic, 8K

### Motion prompt (fal.ai — SOLO movimiento de cámara):
[movimiento elegido], [duración] seconds, smooth easing

### Narración ElevenLabs (Sofía — voz argentina, cálida):
"[línea corta, máximo 10 palabras, lifestyle no técnico, en español argentino]"
```

---

## GENERACIÓN DEL OUTPUT FINAL

Cuando todas las escenas estén producidas, generar el archivo completo.

### Archivo a crear:

**Ruta:** `C:\Users\noyag\OneDrive\Datos adjuntos\Documentos\12.NORBY\Personal Norby\Domotica\docs\content\reels\[YYYY-MM-DD]-[titulo-en-kebab-case].md`

**Estructura completa del archivo:**

```markdown
# Reel: [Título]
> Generado: [fecha] | Pipeline: gpt-image-1 + fal.ai + ElevenLabs Sofía

## Estrategia
- **Objetivo:** [acción concreta]
- **Audiencia:** [descripción específica]
- **Línea de negocio:** solar / domótica / ambas
- **Arco:** lifestyle / fomo / educativo / técnico
- **Duración estimada:** ~30s | 7 escenas

## Plan narrativo
[descripción del arco emocional: qué siente el espectador escena a escena]

## Escenas de producción

[bloque de cada escena con prompts inicio/fin + motion + narración]

## Caption Instagram
[texto completo]

## Hashtags
[hashtags en línea]

## Brief para el pipeline `/brief`
```json
{
  "format": "reel",
  "linea_negocio": "[solar|domotica|ambas]",
  "arco": "[lifestyle|fomo|educativo|tecnico]",
  "tema_libre": "Reel: [título]. Escena 1: [espacio] — inicio: [descripción], fin: [descripción], emoción: [emoción]. Escena 2: [idem]. [... todas las escenas]. Voiceover tono: [estilo]. Caption: [primer línea]."
}
```
```

Después de generar el archivo, decirle al usuario:
"Reel planificado y guardado en `docs/content/reels/[nombre-del-archivo].md`.

Para producirlo, mandá este JSON al endpoint `/brief` de tu pipeline:
```json
{brief json}
```

¿Arrancamos con otro reel o ajustamos algo de este?"
```

- [ ] **Step 2: Verificar que el archivo fue creado correctamente**

```bash
ls "C:/Users/noyag/.claude/plugins/local/elan-skills/skills/content-planning/"
```

Esperado: `SKILL.md` presente.

- [ ] **Step 3: Commit**

```bash
git add "C:/Users/noyag/.claude/plugins/local/elan-skills/skills/content-planning/SKILL.md"
git commit -m "feat(elan-skills): add content-planning skill for elan.casa reels"
```

---

## Task 3: Registrar e instalar el plugin local

**Files:**
- Modify: `C:\Users\noyag\.claude\settings.json` (agregar `elan-skills` a `enabledPlugins`)

- [ ] **Step 1: Registrar el directorio como marketplace local**

```bash
claude plugin marketplace add "C:/Users/noyag/.claude/plugins/local/elan-skills"
```

Esperado: mensaje de confirmación "Marketplace added".

Si falla porque espera un marketplace.json en raíz, intentar:

```bash
claude plugin marketplace add "C:/Users/noyag/.claude/plugins/local/elan-skills/.claude-plugin"
```

- [ ] **Step 2: Verificar que el marketplace fue registrado**

```bash
claude plugin marketplace list
```

Esperado: aparece `elan-skills-local` en la lista.

- [ ] **Step 3: Instalar el plugin**

```bash
claude plugin install elan-skills
```

Esperado: "Plugin elan-skills installed successfully".

- [ ] **Step 4: Verificar en settings.json que el plugin está habilitado**

Leer `C:\Users\noyag\.claude\settings.json`. Debe contener:

```json
"enabledPlugins": {
  "superpowers@superpowers-marketplace": true,
  "elan-skills@elan-skills-local": true
}
```

Si no aparece automáticamente, agregarlo manualmente editando el archivo.

- [ ] **Step 5: Verificar que el skill aparece disponible**

```bash
claude plugin list
```

Esperado: `elan-skills` aparece como instalado y habilitado.

- [ ] **Step 6: Commit del estado final**

```bash
git add "C:/Users/noyag/.claude/plugins/local/elan-skills/"
git commit -m "feat(elan-skills): register and install local plugin"
```

---

## Task 4: Crear directorio de output y smoke test

**Files:**
- Create: `C:\Users\noyag\OneDrive\Datos adjuntos\Documentos\12.NORBY\Personal Norby\Domotica\docs\content\reels\` (directorio)

- [ ] **Step 1: Crear directorio de output de reels**

```bash
mkdir -p "C:/Users/noyag/OneDrive/Datos adjuntos/Documentos/12.NORBY/Personal Norby/Domotica/docs/content/reels"
```

- [ ] **Step 2: Verificar que el skill está disponible en una nueva sesión**

En una nueva sesión de Claude Code (o en la actual), verificar que el skill aparece en la lista de available skills del system-reminder. Debe aparecer:

```
- content-planning: Guía la planificación profesional de reels para elan.casa...
```

- [ ] **Step 3: Invocar el skill y verificar Fase 1**

Invocar `/content-planning` y verificar que:
1. ✅ El skill carga sin error
2. ✅ Anuncia que va a planificar el reel
3. ✅ Hace exactamente UNA pregunta (Pregunta 1.1 sobre objetivo)
4. ✅ Espera respuesta antes de continuar

- [ ] **Step 4: Verificar flujo completo hasta Fase 2**

Responder las 4 preguntas de Fase 1 y verificar que:
1. ✅ El skill propone el plan narrativo completo en el formato definido
2. ✅ Incluye hook, desarrollo, cierre, CTA
3. ✅ Respeta los productos permitidos
4. ✅ Usa tono Apple/Tesla

- [ ] **Step 5: Verificar generación de prompts en Fase 3**

Aprobar el plan y verificar que para la primera escena:
1. ✅ Hace preguntas de producción de a una
2. ✅ Genera prompt INICIO en inglés
3. ✅ Genera prompt FIN en inglés (misma composición, estado transformado)
4. ✅ Genera motion prompt solo con movimiento de cámara
5. ✅ Genera línea de narración en español argentino
6. ✅ No incluye personas/caras en los prompts

---

## Self-Review del Plan

**Cobertura del spec:**
- ✅ Fase 1 (estrategia): cubierta en SKILL.md secciones P1.1-P1.4
- ✅ Fase 2 (plan narrativo): cubierta con formato de propuesta completo
- ✅ Fase 3 (producción por escena): cubierta con preguntas P3.1-P3.5
- ✅ Contexto base hardcoded: productos, shot templates, transiciones, reglas
- ✅ Output .md: ruta, estructura completa, brief JSON
- ✅ Regla keyframes inicio/fin: incluida en contexto de marca
- ✅ Regla motion_prompt: incluida con ejemplos
- ✅ Plugin local (no superpowers cache): Task 1-3

**Sin placeholders:** Todos los pasos tienen comandos o contenido exacto.

**Consistencia:** El formato de output del SKILL.md es compatible con la interfaz `Brief` del pipeline (`format`, `linea_negocio`, `arco`, `tema_libre`).
