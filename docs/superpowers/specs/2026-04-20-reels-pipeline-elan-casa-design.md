# Design Spec: Reels Pipeline Elan.Casa
**Fecha:** 2026-04-20 | **Última revisión:** 2026-04-24
**Estado:** Aprobado por Carlos — listo para writing-plans
**Proyecto:** elan.casa — domótica (Shelly + Fibaro+) y energía solar (Enertik grid-tied) para hogares premium, Posadas, Misiones, Argentina.

---

## 1. Problema

Carlos y su hermano no pueden generar contenido para elan.casa porque:
- No saben qué publicar de forma consistente (ideación bloqueada).
- No quieren aparecer en cámara.
- No tienen tiempo ni equipo de community manager.
- elan.casa no lanzó todavía — necesitan una herramienta de salida al mercado.

**Resultado actual:** sin presencia real en redes sociales. Oportunidad perdida frente a un mercado que compra aspiracional (domótica premium + solar = content-driven).

**Objetivo:** pipeline 100% automatizado que va de **cero → video publicado en Instagram** sin que Carlos ni su hermano tengan que pensar, grabar, ni editar. Solo aprobar.

---

## 2. Propuesta de valor

> Un "director creativo IA" que produce y publica contenido al nivel de una agencia profesional para elan.casa, con calidad Apple/Tesla, sin caras, sin community manager. Carlos da una idea de una línea — o nada — y el sistema hace el resto.

**Métricas de éxito MVP:**
- 2 Reels/semana publicados en `@elan.casa`.
- 1 video de presentación (60-90s) para lanzamiento.
- Tiempo Carlos: ≤ 10 min/semana (solo aprobación de keyframes + video final).
- Calidad percibida: alguien externo no puede distinguirlos de contenido producido por agencia.

---

## 3. Principios de diseño

1. **Images-first.** Las imágenes son la verdad de referencia. El video se ancla a ellas, nunca al prompt libre.
2. **Guided generation.** Claude no inventa — ejecuta desde templates pre-definidos (Shot Library + Visual System + restricciones de productos reales).
3. **Productos reales únicamente.** Cada escena muestra solo lo que elan.casa puede entregar: Shelly, Fibaro+, Enertik. Sin invenciones.
4. **Dos gates humanos.** Carlos aprueba keyframes antes de gastar en video. Carlos aprueba el video antes de publicar.
5. **Resumible.** Si algo falla, el pipeline retoma desde el estado guardado. Cero trabajo perdido.
6. **Sin caras.** Todo el contenido es B-roll arquitectónico, macro de dispositivos, interiores premium, texto + voz. Nunca personas identificables.
7. **Calidad sobre velocidad.** USD 100-200 por video está dentro del presupuesto si el resultado es profesional.

---

## 4. Contenido — ¿qué se produce?

### Dos formatos

| Formato | Duración | Escenas | Estructura | Uso |
|---|---|---|---|---|
| `reel` | 30s | 6-8 | Temática libre | Instagram semanal automático |
| `presentacion` | 60-90s | 12-18 | Arco narrativo fijo (ver 4.2) | Lanzamiento + B2B + Instagram |

### Input mínimo — cómo Carlos activa el sistema (vía WhatsApp)

```
"solar"                  → Reel sobre Enertik/solar
"domótica living"        → Reel sobre Shelly/Fibaro+ en living
"presentacion"           → Video de presentación completo (60-90s)
[sin mensaje / silencio] → Claude elige el tema de la semana
```

### Parámetros del brief

```json
{
  "format": "reel | presentacion",
  "linea_negocio": "solar | domotica | ambas",
  "arco": "lifestyle | educativo | fomo | tecnico",
  "tema_libre": "texto opcional de Carlos"
}
```

### Arco narrativo `presentacion` (FOMO-driven, no negociable)

```
1. PROBLEMA        (2 escenas) — "Tu casa consume más de lo que creés. Tu vida podría ser más simple."
2. QUÉ PASARÍA SI  (3 escenas) — interiores premium con automatización, sin revelar marca todavía
3. SOLUCIÓN        (5 escenas) — Shelly/Fibaro+ en acción + paneles Enertik, texto overlay de beneficio
4. BENEFICIOS      (3 escenas) — ahorro en factura, confort, control desde celular
5. FOMO            (2 escenas) — "Los que decidieron antes ya están viviendo así."
6. CTA             (1 escena)  — logo elan.casa + "Habite el futuro" + contacto
```

### Tipos de Reels semanales (cadencia alternada)

| Tipo | Línea | Ejemplo |
|---|---|---|
| Lifestyle B-roll | Domótica | "Llegás a casa. Las luces ya te esperan." |
| Beneficio económico | Solar | "Tu factura bajó un 70%. Sin baterías, sin complicaciones." |
| Feature específico | Domótica | "Persianas que se abren solas con el sol." |
| Educativo | Solar | "¿Cómo funciona un panel solar? 30 segundos." |
| FOMO | Ambas | "Esto ya está en tu barrio." |

**Cadencia MVP:** 2 Reels/semana (martes y viernes 10AM AR). Claude balancea líneas automáticamente.

---

## 5. Arquitectura del sistema

### 5.1 Visión general

```
┌─────────────────────────────── n8n (shell) ──────────────────────────────┐
│                                                                           │
│  WhatsApp de Carlos ──► [Content Planner] ──► WhatsApp a Carlos          │
│  ("solar" / "presentacion"      (WF-RP-01)     "Planifiqué 3 ideas"      │
│  / silencio → cron lunes)                                                 │
│                                                                           │
│  Carlos aprueba idea ──► [Storyboard + Keyframes] ──► WhatsApp imágenes  │
│  (WhatsApp reply)              (WF-RP-02)              GATE 1             │
│                                                                           │
│  Carlos aprueba imgs ──► [Video Render] ──► WhatsApp video preview        │
│  (WhatsApp reply)              (WF-RP-03)              GATE 2             │
│                                                                           │
│  Carlos aprueba video ──► [Publish to Instagram] ──► Notificación        │
│  (WhatsApp reply)              (WF-RP-04)                                 │
│                                                                           │
│                    ↕ HTTP (POST /brief / POST /render)                   │
│  ┌──────────────── Claude Agent SDK (cerebro) ──────────────────────┐    │
│  │  tools: generate_keyframe · judge_image · generate_video         │    │
│  │         validate_video · concat_and_mix                          │    │
│  │  loop de calidad con retries hasta VLM ≥ 7/10                   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Flujos n8n (4 workflows nuevos)

| ID | Nombre | Trigger | Responsabilidad |
|---|---|---|---|
| WF-RP-01 | Content Planner | WhatsApp mensaje + Cron lunes 9AM | Lee Brand Bible + historial → Claude genera 3 propuestas → WhatsApp |
| WF-RP-02 | Storyboard & Keyframes | Webhook (aprobación WA) | Llama Agent SDK → obtiene storyboard + keyframes → envía imágenes por WhatsApp para GATE 1 |
| WF-RP-03 | Video Render | Webhook (aprobación WA) | Llama Agent SDK → genera todos los clips en paralelo → ensambla → envía preview para GATE 2 |
| WF-RP-04 | Publisher | Webhook (aprobación WA) | Publica en IG Graph API v21.0 → log Supabase → notificación WhatsApp |

### 5.3 Claude Agent SDK service

Servicio Node/TypeScript desplegado en EasyPanel. Expone:
- `POST /brief` → recibe brief JSON, devuelve `{storyboard, keyframes_start_urls[], keyframes_end_urls[]}`
- `POST /render` → recibe keyframes aprobados, devuelve `{video_url, duration, scenes_validated}`

Internamente usa tools:

- `generate_keyframe(scene, visual_system, shot_template, reference_images, role)` → gpt-image-1 (OpenAI API). `role` = `start | end`. Para escenas en el mismo espacio físico, pasa el keyframe start anterior como `reference_image` para consistencia visual.
- `judge_image(image_url, scene_brief, visual_system)` → Claude vision, rubric 10 puntos, umbral ≥ 7/10. Máx 2 candidatos por escena (no 3 — reduce costo sin pérdida de calidad).
- `generate_video(start_frame_url, end_frame_url, motion_prompt, prompt_strength)` → fal.ai HappyHorse-1.0 (webhook mode). `prompt_strength: 0.9`. Motion prompt describe SOLO movimiento de cámara y timing — nunca contenido visual.
- `validate_video(video_url)` → ffprobe: duración, aspecto 9:16, blackdetect
- `concat_and_mix(clips[], voiceover_url, captions[], transition_map[])` → ffmpeg con xfade 0.3s entre escenas del mismo espacio; hard cut entre espacios distintos.

**Generación paralela:** todos los clips de video se generan en paralelo vía fal.ai queue. El Agent SDK hace un `Promise.all()` sobre los `generate_video` de cada escena. Tiempo total: ~90s independientemente del número de escenas.

---

## 6. Sistema de Guía (4 capas de calidad)

### 6.1 Visual System — `elan_visual_system` (Supabase)

```json
{
  "palette": {
    "primary": ["#0a0a0f", "#1a1a2e"],
    "accent": ["#c8a96e", "#e8d5b0"],
    "neutral": ["#f5f5f0", "#2a2a3e"]
  },
  "lighting": "warm ambient fill, soft directional rim from 45°, architectural shadows, no harsh flash",
  "lens_language": {
    "establishing": "24mm wide, low angle, golden hour",
    "product": "85mm macro, shallow DOF, neutral background",
    "lifestyle": "35mm, eye level, natural light",
    "detail": "100mm macro, extreme close-up, texture emphasis"
  },
  "color_grading": "muted warm tones, slight desaturation, lifted blacks, cinematic",
  "negative_system": "cartoon, CGI render, text in image, watermark, plastic look, oversaturated, cheap interior, visible cables, uncanny faces, low resolution, grain excess, lens flare cheap, science fiction, futuristic fantasy"
}
```

### 6.2 Style Bible — el hogar inteligente como protagonista

Sin personajes humanos identificables. El hogar premium de Posadas/Misiones es el protagonista.
- Paleta de materiales: concreto pulido, madera oscura, vidrio templado, acero cepillado.
- Iluminación: cálida indirecta + destellos tech (LED azul/blanco fríos en contraste).
- Escala humana implícita: manos interactuando con dispositivos, nunca cara.
- Marcas reales visibles cuando sea posible: logo Shelly, forma característica del sensor Fibaro, panel Enertik.

### 6.3 Shot Library — `shot_templates` (Supabase) — solo productos reales

| ID | Descripción | Tecnología | Camera motion |
|---|---|---|---|
| `establishing_home` | Exterior residencia premium al anochecer, luces encendiendo | Shelly | Slow dolly-in |
| `shelly_device_macro` | Close-up de dispositivo Shelly instalado en caja eléctrica | Shelly | Static + subtle push |
| `app_control_hands` | Manos usando app Shelly en smartphone | Shelly app | Static |
| `lights_scene_living` | Living cambiando escena de iluminación (oscuro → cálido) | Shelly Dimmer | Static wide |
| `curtain_morning` | Persianas motorizadas abriéndose al amanecer | Shelly 2.5 | Static |
| `motion_lights_hall` | Luces de pasillo encendiéndose solas al detectar movimiento | Shelly Motion | Static |
| `climate_smart` | AC controlado desde celular, persona de espaldas | Shelly Plug + AC | Rack focus |
| `fibaro_keypad_macro` | Close-up de keypad Fibaro+ en pared, diseño premium | Fibaro+ | Static + subtle push |
| `fibaro_sensor_room` | Sensor de movimiento Fibaro+ en esquina de habitación | Fibaro+ | Slow push |
| `fibaro_app_tablet` | App Fibaro Home Center en tablet sobre mesa premium | Fibaro+ | Static |
| `solar_panels_roof` | Paneles Enertik en techo, luz dorada, vista aérea | Enertik | Slow pan |
| `solar_inverter_macro` | Inversor Enertik mostrando datos de producción en pantalla | Enertik | Static |
| `energy_savings_graph` | Pantalla con gráfico de ahorro mensual en pesos argentinos | Enertik + Shelly | Zoom lento |
| `solar_day_timelapse` | Sol moviéndose sobre paneles, producción en tiempo real | Enertik | Static wide |
| `home_overview_auto` | Exterior de casa con múltiples automatizaciones activándose | Shelly + Fibaro+ | Dolly-out |

### 6.4 Reference Library — `reference_images` (Supabase Storage)

Imágenes curadas por Carlos que representan el nivel estético objetivo:
- Apple HomeKit marketing stills
- Lutron Caseta premium homes
- Bang & Olufsen room shots
- Arquitectura de interiores de lujo de Posadas/Buenos Aires

### 6.5 Restricciones del Creative Director (system prompt del Content Planner)

> "Solo podés generar escenas de automatizaciones realizables con dispositivos **Shelly**, **Fibaro+** y paneles solares **Enertik** grid-tied (sin baterías). **Prohibido** generar contenido de: sistemas centralizados tipo Crestron/KNX/Control4, control de acceso biométrico/facial, cámaras de seguridad, baterías solares, domótica de marcas que elan.casa no representa, hogares de fantasy o ciencia ficción. Si el prompt del usuario implica algo fuera de este alcance, ajustá la escena al equivalente real más cercano."

---

## 7. Máquina de estados

```
DRAFT
  → IDEA_PROPOSED         (Content Planner generó 3 ideas, esperando selección)
  → STORYBOARD_READY      (Claude generó storyboard JSON + asignó shot templates)
  → KEYFRAMES_RENDERING   (generando start + end frames en paralelo)
  → KEYFRAMES_READY       (imágenes generadas y pasaron VLM judge ≥ 7/10)
  → AWAITING_SCENE_APPROVAL   ◄── GATE 1: Carlos ve keyframe_start por escena vía WhatsApp
  → SCENES_APPROVED
  → VIDEO_RENDERING       (todos los clips en paralelo vía fal.ai HappyHorse, webhook)
  → VIDEO_READY           (clips validados con ffprobe)
  → ASSEMBLED             (ffmpeg xfade concat + voiceover ElevenLabs + captions Whisper)
  → AWAITING_FINAL_APPROVAL   ◄── GATE 2: Carlos ve el MP4 final
  → PUBLISHED
  → ERROR                 (con campo error_stage y retry_count)
```

Tabla Supabase `reels`:
```sql
id, brand, format, linea_negocio, arco, status,
idea_titulo, idea_descripcion,
storyboard_json, scenes_count,
keyframes_start_urls[], keyframes_end_urls[], keyframe_status[],
video_clips_urls[], video_status[],
assembled_url, caption, hashtags,
ig_post_id, ig_post_url,
retry_count, error_stage, error_detail,
created_at, updated_at
```

---

## 8. Storyboard JSON — contrato entre n8n y Agent SDK

```json
{
  "reel_id": "uuid",
  "brand": "elan.casa",
  "format": "presentacion",
  "linea_negocio": "ambas",
  "arco": "fomo",
  "titulo": "Tu casa ya sabe que llegás",
  "duracion_total_s": 75,
  "voz_narracion": "Imaginá llegar a casa y que todo ya esté listo. Luces, temperatura, música. Sin tocar nada. Eso es lo que hacemos en elan.casa.",
  "caption_instagram": "Tu hogar debería conocerte.\n\n#domótica #solarelan #habitaelfuturo #smarthome #Misiones",
  "scenes": [
    {
      "id": 1,
      "shot_template_id": "establishing_home",
      "espacio_fisico": "exterior",
      "duracion_s": 5,
      "subject": "exterior residencia premium, Posadas, anochecer",
      "motion_prompt": "slow dolly-in toward entrance, 5 seconds, smooth easing",
      "prompt_strength": 0.9,
      "transition_next": "hard_cut",
      "seed": 42
    }
  ]
}
```

**Regla de `motion_prompt`:** describe únicamente movimiento de cámara y timing. Nunca contenido visual — eso ya está en el keyframe.

**Regla de `transition_next`:** `crossfade_300ms` si la siguiente escena es el mismo `espacio_fisico`; `hard_cut` si es un espacio distinto.

---

## 9. Validaciones por etapa

| Etapa | Check | Acción si falla |
|---|---|---|
| Post-storyboard | JSON válido, escenas según formato (6-8 reel / 12-18 presentacion), duración total correcta | Regen storyboard |
| Post-keyframe | 1080×1920, VLM score ≥ 7/10, sin NSFW, sin texto embebido, producto real identificable | Regen keyframe (máx 2 intentos) |
| Pre-i2v | URL accesible (HEAD 200), tamaño < 10MB, MIME image/* | Error → notificar |
| Post-video clip | ffprobe: aspect 9:16, duración ±0.3s del target, blackdetect < 5% | Regen clip (máx 2 intentos) |
| Post-ensamble | LUFS entre -16 y -14, duración total dentro del rango del formato, resolución 1080×1920 | Notificar Carlos |
| Pre-publish | Caption ≤ 2200 chars, hashtags ≤ 30 | Auto-truncar |

---

## 10. Stack tecnológico

| Componente | Servicio | Notas |
|---|---|---|
| Orquestación | n8n (EasyPanel existente) | 4 workflows nuevos |
| Cerebro creativo | Claude Agent SDK (Node/TS, nuevo contenedor EasyPanel) | Expone `/brief` y `/render` |
| LLM | Claude Sonnet 4.6 | Storyboard, judge, captions, Creative Director |
| Generación imágenes | gpt-image-1 (OpenAI API) + Flux 1.1 Pro Ultra (fal.ai) | gpt-image-1 para keyframes start/end con style ref; Flux para establishing shots complejos |
| Video i2v | HappyHorse-1.0 vía fal.ai | `image_urls: [start, end]`, `prompt_strength: 0.9`, `duration: 5s`. Fallback: Kling 1.6 |
| TTS | ElevenLabs Sofía (`9oPKasc15pfAbMr7N6Gs`) | Voz en español argentino |
| Captions | Whisper (transcripción del audio real) | Word-level timestamps |
| Concat/mux | ffmpeg (en contenedor Agent SDK) | `xfade` 0.3s intra-espacio, hard cut inter-espacio, burn-in SRT |
| Estado | Supabase (`xorjkjaimeampfdiichs`) | Tablas: `reels`, `shot_templates`, `elan_visual_system`, `reference_images` |
| Notificaciones / Gate | WhatsApp Business Cloud API | Cuenta propia de elan.casa (o Nexo Terra como puente — a confirmar) |
| Publicación | Instagram Graph API v21.0 | Cuenta Instagram Business de elan.casa (a crear — `ig_user_id` pendiente) |
| Domótica real | Shelly (WiFi) + Fibaro+ (Z-Wave/Matter) | Solo estas marcas en el contenido |
| Solar real | Enertik grid-tied | Sin baterías — solo conexión a red eléctrica |

---

## 11. Manejo de errores y resiliencia

- **fal.ai webhook (no polling):** n8n registra `request_id` en Supabase; fal.ai hace POST al webhook de n8n cuando termina el clip. Sin timeout artificial.
- **Generación paralela:** `Promise.all()` sobre todos los clips. Si un clip falla, los demás continúan. El clip fallido se regen individualmente.
- **Retries automáticos:** keyframe hasta 2 intentos; video clip hasta 2 intentos. Si supera, estado `ERROR` + WhatsApp a Carlos.
- **Resumible:** cada estado guardado en Supabase. Si n8n se reinicia, el workflow retoma desde el último estado válido sin regenerar.
- **Fallback video:** si HappyHorse no disponible, usar Kling 1.6 vía fal.ai con mismo contrato de parámetros.

---

## 12. Secuencia de lanzamiento al mercado (GTM)

### Fase 0 — Producción del video de presentación (antes del lanzamiento público)

El pipeline produce `format: presentacion`, `linea_negocio: ambas`. Carlos aprueba keyframes y video final.
Output: MP4 60-90s con arco FOMO completo de elan.casa.

### Fase 1 — Lanzamiento B2B (semana 1)

Carlos y su hermano envían el video de presentación por **WhatsApp directo** a contactos de estudios de arquitectura y constructoras en Misiones. Mensaje personal, no masivo. Objetivo: plantar la semilla, no vender.

Segmentos B2B objetivo:
- Estudios de arquitectura (especificadores — recomiendan a sus clientes)
- Constructoras (instaladores en múltiples proyectos)

### Fase 2 — Lanzamiento Instagram (semana 1-2)

Apertura de cuenta `@elan.casa`. Primer post: video de presentación.
Arranque inmediato del pipeline automático de Reels semanales.

Cadencia de contenido:
```
Semana 1:  Video presentación (lanzamiento)
Semana 2:  Reel domótica — lifestyle FOMO
Semana 3:  Reel solar — beneficio económico (educativo)
Semana 4:  Reel domótica — feature Fibaro+ (técnico)
Semana 5:  Reel solar — instalación Enertik (aspiracional)
[Claude balancea líneas y arcos automáticamente]
```

### Fase 3 — Tracción orgánica (mes 2+)

Arquitectos que recibieron el video en Fase 1 siguen viendo Reels en Instagram. Canal trabaja solo. Cuando aparece un lead, el video de presentación ya existe para compartir.

Canales por segmento:
| Segmento | Canal | Contenido |
|---|---|---|
| Estudios de arquitectura | WhatsApp directo | Video presentación + Reels destacados |
| Constructoras | WhatsApp directo (segunda ola) | Mismo material |
| Consumidor final | Instagram orgánico | Reels semanales automatizados |

---

## 13. MVP — lo que se construye primero

**Fase 1 (semanas 1-3):** Pipeline funcional mínimo
1. Tablas Supabase + Visual System inicial + Shot Library (15 templates).
2. WF-RP-01: Content Planner (acepta WhatsApp input + cron fallback).
3. Agent SDK `/brief`: storyboard JSON + keyframe_start por escena (sin VLM judge todavía).
4. WF-RP-02: envía keyframes a Carlos por WhatsApp, recibe aprobación (GATE 1).
5. Agent SDK `/render`: clips en paralelo con Kling fallback (mientras HappyHorse no está).
6. WF-RP-04: publicación en Instagram.
7. **Producir video de presentación como primer output real del sistema.**

**Fase 2 (semanas 4-5):** Calidad y automatización
1. VLM judge (auto-select mejor keyframe de 2 candidatos).
2. Start + end frame para HappyHorse (cuando API disponible).
3. Validaciones ffprobe por clip.
4. ElevenLabs + Whisper captions.
5. ffmpeg xfade concat.
6. Switch a HappyHorse cuando API disponible.

**Fase 3 (semanas 6+):** Pulido
1. Reference Library cargada por Carlos.
2. Métricas: engagement por formato y línea de negocio.
3. Publicación automática sin gate si confianza ≥ 9/10.

---

## 14. Lo que NO está en scope

- Multi-tenant (otras marcas además de elan.casa).
- TikTok / YouTube Shorts publishing (solo Instagram MVP).
- Faces / talking head content.
- Edición retroactiva de videos publicados.
- Analytics dashboard (solo logs en Supabase).
- Productos de domótica fuera de Shelly y Fibaro+.
- Instalaciones solares con baterías o off-grid.
