# elan.casa Reels Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete AI video production pipeline that goes from a WhatsApp message to a published Instagram Reel for elan.casa, using gpt-image-1 for keyframes, HappyHorse-1.0 (Kling fallback) for video clips, and n8n + Claude Agent SDK for orchestration.

**Architecture:** A Node/TypeScript Agent SDK service (Express) handles all creative decisions — storyboard generation, keyframe creation via gpt-image-1 (start + end frame per scene), parallel video generation via fal.ai queue with webhooks, and ffmpeg assembly with xfade transitions. n8n acts as the shell: receiving WhatsApp input, persisting state in Supabase, calling the Agent SDK, delivering gate images/videos to Carlos via WhatsApp, and publishing to Instagram.

**Tech Stack:** Node.js 20, TypeScript 5, Express 4, `@anthropic-ai/sdk`, `openai`, `@fal-ai/client`, `@supabase/supabase-js`, `fluent-ffmpeg`, `axios`, `uuid`, Vitest, Docker, EasyPanel (existing)

**Supabase project:** `xorjkjaimeampfdiichs.supabase.co`

---

## File Structure

```
agent-sdk/                         ← New EasyPanel service
├── src/
│   ├── index.ts                   ← Express app + routes registration
│   ├── config.ts                  ← Env vars + validation
│   ├── supabase.ts                ← Supabase client + query helpers
│   ├── types/
│   │   └── index.ts               ← All TypeScript interfaces
│   ├── tools/
│   │   ├── generateKeyframe.ts    ← gpt-image-1 calls (start + end)
│   │   ├── judgeImage.ts          ← Claude VLM scoring
│   │   ├── generateVideo.ts       ← fal.ai queue submit (HappyHorse / Kling)
│   │   ├── validateVideo.ts       ← ffprobe checks
│   │   ├── generateVoiceover.ts   ← ElevenLabs TTS
│   │   ├── generateCaptions.ts    ← Whisper transcription
│   │   └── concatAndMix.ts        ← ffmpeg xfade assembly
│   ├── agent/
│   │   ├── storyboard.ts          ← Claude storyboard generation
│   │   ├── brief.ts               ← /brief endpoint logic
│   │   └── render.ts              ← /render endpoint logic
│   └── routes/
│       ├── brief.ts               ← POST /brief
│       ├── render.ts              ← POST /render
│       ├── webhook.ts             ← POST /webhook/fal (fal.ai callback)
│       └── health.ts              ← GET /health
├── tests/
│   ├── tools/
│   │   ├── judgeImage.test.ts
│   │   ├── generateKeyframe.test.ts
│   │   └── validateVideo.test.ts
│   └── agent/
│       ├── storyboard.test.ts
│       └── brief.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── Dockerfile

supabase/
└── migrations/
    ├── 001_reels_schema.sql       ← All tables
    ├── 002_shot_templates_seed.sql ← 15 shot templates
    └── 003_visual_system_seed.sql  ← elan.casa Visual System JSON

n8n/workflows/                     ← Export JSONs for import into n8n UI
    ├── WF-RP-01-content-planner.json
    ├── WF-RP-02-storyboard-gate1.json
    ├── WF-RP-03-video-render-gate2.json
    └── WF-RP-04-publisher.json
```

---

## PHASE 1 — Foundation & Keyframes (Weeks 1–2)

---

### Task 1: Supabase schema

**Files:**
- Create: `supabase/migrations/001_reels_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/001_reels_schema.sql

CREATE TABLE IF NOT EXISTS reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL DEFAULT 'elan.casa',
  format TEXT NOT NULL CHECK (format IN ('reel', 'presentacion')),
  linea_negocio TEXT NOT NULL CHECK (linea_negocio IN ('solar', 'domotica', 'ambas')),
  arco TEXT CHECK (arco IN ('lifestyle', 'educativo', 'fomo', 'tecnico')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT','IDEA_PROPOSED','STORYBOARD_READY','KEYFRAMES_RENDERING',
    'KEYFRAMES_READY','AWAITING_SCENE_APPROVAL','SCENES_APPROVED',
    'VIDEO_RENDERING','VIDEO_READY','ASSEMBLED',
    'AWAITING_FINAL_APPROVAL','PUBLISHED','ERROR'
  )),
  idea_titulo TEXT,
  idea_descripcion TEXT,
  storyboard_json JSONB,
  scenes_count INTEGER,
  keyframes_start_urls TEXT[],
  keyframes_end_urls TEXT[],
  keyframe_status TEXT[],
  video_clips_urls TEXT[],
  video_status TEXT[],
  assembled_url TEXT,
  caption TEXT,
  hashtags TEXT,
  ig_post_id TEXT,
  ig_post_url TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_stage TEXT,
  error_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_render_jobs (
  request_id TEXT PRIMARY KEY,
  reel_id UUID NOT NULL REFERENCES reels(id),
  scene_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','error')),
  result_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shot_templates (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  tecnologia TEXT NOT NULL,
  camera_motion TEXT NOT NULL,
  skeleton_prompt TEXT NOT NULL,
  skeleton_motion_prompt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS elan_visual_system (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS reference_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion TEXT NOT NULL,
  url TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Apply migration via Supabase MCP or SQL editor**

In Supabase dashboard → SQL Editor → paste and run `001_reels_schema.sql`.

Verify: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
Expected: `reels`, `video_render_jobs`, `shot_templates`, `elan_visual_system`, `reference_images`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_reels_schema.sql
git commit -m "feat(db): add reels pipeline schema"
```

---

### Task 2: Seed shot_templates + Visual System

**Files:**
- Create: `supabase/migrations/002_shot_templates_seed.sql`
- Create: `supabase/migrations/003_visual_system_seed.sql`

- [ ] **Step 1: Write shot_templates seed**

```sql
-- supabase/migrations/002_shot_templates_seed.sql

INSERT INTO shot_templates (id, nombre, descripcion, tecnologia, camera_motion, skeleton_prompt, skeleton_motion_prompt) VALUES
('establishing_home', 'Exterior premium nocturno', 'Exterior residencia premium al anochecer, luces encendiendo', 'Shelly', 'Slow dolly-in', 'Exterior facade of a luxury modern home in Posadas Argentina at dusk, warm interior lights visible through floor-to-ceiling windows, manicured garden, architectural lighting, premium materials, residential architecture', 'slow dolly-in toward entrance, 5 seconds, smooth easing'),
('shelly_device_macro', 'Shelly close-up', 'Dispositivo Shelly instalado en caja eléctrica', 'Shelly', 'Static + subtle push', 'Extreme close-up macro photograph of a Shelly smart device mounted inside an electrical panel, white casing with green LED indicator, precision engineering, dark background, product photography lighting', 'static shot with subtle 10% push toward subject, 5 seconds, smooth'),
('app_control_hands', 'App Shelly en smartphone', 'Manos controlando luces desde smartphone', 'Shelly', 'Static', 'Hands holding a smartphone displaying the Shelly app interface with room controls and dimmer sliders, luxurious interior background slightly blurred, warm lighting, lifestyle product photography', 'static shot, hands lightly moving across screen, 5 seconds'),
('lights_scene_living', 'Living con cambio de escena', 'Living cambiando escena de iluminación de oscuro a cálido', 'Shelly Dimmer', 'Static wide', 'Wide shot of a premium living room transitioning from dim to warm ambient lighting, polished concrete floor, dark wood furniture, floor-to-ceiling windows, architectural ceiling lights, luxury interior design Posadas', 'static wide shot, 5 seconds, no camera movement'),
('curtain_morning', 'Persianas abriéndose', 'Persianas motorizadas abriéndose al amanecer', 'Shelly 2.5', 'Static', 'Premium motorized roller blinds in a luxury bedroom starting to open, morning light filtering through, high-end materials, minimalist interior, polished concrete and dark wood, serene atmosphere', 'static shot, 5 seconds'),
('motion_lights_hall', 'Luces por sensor de movimiento', 'Luces de pasillo encendiéndose al detectar movimiento', 'Shelly Motion', 'Static', 'Modern hallway of a luxury home with motion-activated lights turning on, polished surfaces, architectural design, spotlights illuminating progressively, dark premium aesthetic', 'static shot, 5 seconds'),
('climate_smart', 'AC controlado remotamente', 'AC controlado desde celular, persona de espaldas', 'Shelly Plug + AC', 'Rack focus', 'Back view of a person holding smartphone in a premium living room, adjusting air conditioning remotely via app, large windows, luxury interior, comfortable lighting, no face visible', 'rack focus from phone screen to room, 5 seconds, smooth'),
('fibaro_keypad_macro', 'Keypad Fibaro+ premium', 'Close-up de keypad Fibaro+ en pared, diseño premium', 'Fibaro+', 'Static + subtle push', 'Close-up of a sleek Fibaro+ smart keypad mounted flush on a luxury wall, brushed metal finish, soft LED backlight, premium interior design, minimalist aesthetic, product photography', 'static with subtle 10% push toward keypad, 5 seconds, smooth'),
('fibaro_sensor_room', 'Sensor Fibaro+ en habitación', 'Sensor de movimiento Fibaro+ en esquina de habitación premium', 'Fibaro+', 'Slow push', 'Wide shot of a premium room corner showing a Fibaro+ motion sensor mounted discreetly on the wall, luxury interior, warm ambient lighting, architectural design, minimalist', 'slow push toward sensor, 5 seconds'),
('fibaro_app_tablet', 'App Fibaro Home Center', 'App Fibaro Home Center en tablet sobre mesa premium', 'Fibaro+', 'Static', 'iPad displaying Fibaro Home Center dashboard with room controls and automation scenes, placed on a luxury marble or wood surface, blurred premium interior background, lifestyle photography', 'static shot, 5 seconds'),
('solar_panels_roof', 'Paneles Enertik en techo', 'Paneles Enertik en techo, luz dorada, vista aérea', 'Enertik', 'Slow pan', 'Aerial view of Enertik solar panels installed on the roof of a modern luxury home in Posadas Argentina, golden hour light reflecting off panels, lush green surroundings, professional installation', 'slow lateral pan right to left, 5 seconds, smooth'),
('solar_inverter_macro', 'Inversor Enertik con datos', 'Inversor Enertik mostrando datos de producción en pantalla', 'Enertik', 'Static', 'Close-up of an Enertik solar inverter display showing real-time energy production data in kWh, installed in a clean utility room, professional installation, LED display glowing', 'static shot, 5 seconds'),
('energy_savings_graph', 'Gráfico de ahorro energético', 'Pantalla con gráfico de ahorro mensual en pesos argentinos', 'Enertik + Shelly', 'Zoom lento', 'Close-up of a smartphone or tablet screen showing a energy savings dashboard with bar charts in Argentine pesos, monthly comparison, clean UI design, professional data visualization, dark mode interface', 'slow zoom in toward screen center, 5 seconds'),
('solar_day_timelapse', 'Producción solar diaria', 'Paneles Enertik captando energía durante el día', 'Enertik', 'Static wide', 'Wide static shot of Enertik solar panels on a luxury home roof, clear blue sky Misiones, afternoon light, professional installation, green surroundings visible', 'static wide shot, 5 seconds'),
('home_overview_auto', 'Casa con múltiples automatizaciones', 'Exterior de casa con automatizaciones activándose', 'Shelly + Fibaro+', 'Dolly-out', 'Exterior wide shot of a premium modern home in Posadas at dusk, multiple lights automatically turning on, motorized gate, architectural exterior lighting, luxury residential, smart home', 'slow dolly-out revealing full facade, 5 seconds, smooth')
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Write Visual System seed**

```sql
-- supabase/migrations/003_visual_system_seed.sql

INSERT INTO elan_visual_system (key, value) VALUES
('palette', '{"primary":["#0a0a0f","#1a1a2e"],"accent":["#c8a96e","#e8d5b0"],"neutral":["#f5f5f0","#2a2a3e"]}'),
('lighting', '"warm ambient fill, soft directional rim from 45 degrees, architectural shadows, no harsh flash"'),
('lens_language', '{"establishing":"24mm wide, low angle, golden hour","product":"85mm macro, shallow DOF, neutral background","lifestyle":"35mm, eye level, natural light","detail":"100mm macro, extreme close-up, texture emphasis"}'),
('color_grading', '"muted warm tones, slight desaturation, lifted blacks, cinematic"'),
('negative_system', '"cartoon, CGI render, text in image, watermark, plastic look, oversaturated, cheap interior, visible cables, uncanny faces, low resolution, grain excess, lens flare cheap, science fiction, futuristic fantasy"')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 3: Apply both seeds in Supabase SQL Editor**

Run `002_shot_templates_seed.sql`, then `003_visual_system_seed.sql`.

Verify:
```sql
SELECT COUNT(*) FROM shot_templates; -- expect 15
SELECT COUNT(*) FROM elan_visual_system; -- expect 5
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_shot_templates_seed.sql supabase/migrations/003_visual_system_seed.sql
git commit -m "feat(db): seed shot_templates and visual system"
```

---

### Task 3: Agent SDK project setup

**Files:**
- Create: `agent-sdk/package.json`
- Create: `agent-sdk/tsconfig.json`
- Create: `agent-sdk/vitest.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "elan-agent-sdk",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.36.0",
    "@fal-ai/client": "^1.3.0",
    "@supabase/supabase-js": "^2.46.0",
    "axios": "^1.7.0",
    "express": "^4.21.0",
    "fluent-ffmpeg": "^2.1.3",
    "openai": "^4.77.0",
    "uuid": "^11.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/fluent-ffmpeg": "^2.1.27",
    "@types/node": "^22.0.0",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

- [ ] **Step 4: Install dependencies**

```bash
cd agent-sdk && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add agent-sdk/package.json agent-sdk/tsconfig.json agent-sdk/vitest.config.ts
git commit -m "feat(agent-sdk): project scaffold"
```

---

### Task 4: TypeScript types

**Files:**
- Create: `agent-sdk/src/types/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent-sdk/tests/types.test.ts
import { describe, it, expect } from 'vitest';
import type { Storyboard, Brief, BriefResponse, VLMScore } from '../src/types/index.js';

describe('types', () => {
  it('Storyboard shape is correct', () => {
    const s: Storyboard = {
      reel_id: 'uuid-1',
      brand: 'elan.casa',
      format: 'reel',
      linea_negocio: 'solar',
      arco: 'fomo',
      titulo: 'Test',
      duracion_total_s: 30,
      voz_narracion: 'Texto de prueba.',
      caption_instagram: 'Caption #test',
      hashtags: '#test',
      scenes: [],
    };
    expect(s.brand).toBe('elan.casa');
    expect(s.format).toBe('reel');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd agent-sdk && npm test -- tests/types.test.ts
```

Expected: error `Cannot find module '../src/types/index.js'`

- [ ] **Step 3: Write the types**

```typescript
// agent-sdk/src/types/index.ts

export type Format = 'reel' | 'presentacion';
export type LineaNegocio = 'solar' | 'domotica' | 'ambas';
export type Arco = 'lifestyle' | 'educativo' | 'fomo' | 'tecnico';
export type Transition = 'hard_cut' | 'crossfade_300ms';
export type ReelStatus =
  | 'DRAFT' | 'IDEA_PROPOSED' | 'STORYBOARD_READY'
  | 'KEYFRAMES_RENDERING' | 'KEYFRAMES_READY'
  | 'AWAITING_SCENE_APPROVAL' | 'SCENES_APPROVED'
  | 'VIDEO_RENDERING' | 'VIDEO_READY' | 'ASSEMBLED'
  | 'AWAITING_FINAL_APPROVAL' | 'PUBLISHED' | 'ERROR';

export interface Scene {
  id: number;
  shot_template_id: string;
  espacio_fisico: string;
  duracion_s: number;
  subject: string;
  motion_prompt: string;
  prompt_strength: number;
  transition_next: Transition;
  seed?: number;
  keyframe_start_url?: string;
  keyframe_end_url?: string;
  video_clip_url?: string;
}

export interface Storyboard {
  reel_id: string;
  brand: 'elan.casa';
  format: Format;
  linea_negocio: LineaNegocio;
  arco: Arco;
  titulo: string;
  duracion_total_s: number;
  voz_narracion: string;
  caption_instagram: string;
  hashtags: string;
  scenes: Scene[];
}

export interface Brief {
  format: Format;
  linea_negocio: LineaNegocio;
  arco?: Arco;
  tema_libre?: string;
}

export interface BriefResponse {
  reel_id: string;
  storyboard: Storyboard;
  keyframes_start_urls: string[];
  keyframes_end_urls: string[];
}

export interface RenderRequest {
  reel_id: string;
  storyboard: Storyboard;
  approved_scenes: ApprovedScene[];
}

export interface ApprovedScene {
  scene_id: number;
  start_url: string;
  end_url: string;
}

export interface RenderResponse {
  reel_id: string;
  video_url: string;
  duration_s: number;
  scenes_validated: number;
}

export interface VLMScore {
  score: number;
  reasoning: string;
  pass: boolean;
}

export interface ShotTemplate {
  id: string;
  nombre: string;
  descripcion: string;
  tecnologia: string;
  camera_motion: string;
  skeleton_prompt: string;
  skeleton_motion_prompt: string;
}

export interface VideoJob {
  request_id: string;
  reel_id: string;
  scene_index: number;
  status: 'pending' | 'done' | 'error';
  result_url?: string;
  error?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd agent-sdk && npm test -- tests/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent-sdk/src/types/index.ts agent-sdk/tests/types.test.ts
git commit -m "feat(agent-sdk): TypeScript type definitions"
```

---

### Task 5: Config and Supabase client

**Files:**
- Create: `agent-sdk/src/config.ts`
- Create: `agent-sdk/src/supabase.ts`

- [ ] **Step 1: Write config.ts**

```typescript
// agent-sdk/src/config.ts

export const config = {
  openaiKey: process.env.OPENAI_API_KEY!,
  anthropicKey: process.env.ANTHROPIC_API_KEY!,
  falKey: process.env.FAL_KEY!,
  elevenLabsKey: process.env.ELEVENLABS_API_KEY!,
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? '9oPKasc15pfAbMr7N6Gs',
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
  useHappyHorse: process.env.USE_HAPPYHORSE === 'true',
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL!, // e.g. https://nexo-terra-n8n.6fwciw.easypanel.host
  port: Number(process.env.PORT ?? 3000),
  agentBaseUrl: process.env.AGENT_BASE_URL!, // this service's public URL for fal.ai callbacks
};

export function validateConfig(): void {
  const required = [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'FAL_KEY',
    'ELEVENLABS_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY',
    'WEBHOOK_BASE_URL', 'AGENT_BASE_URL',
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
```

- [ ] **Step 2: Write supabase.ts**

```typescript
// agent-sdk/src/supabase.ts

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { ShotTemplate, ReelStatus } from './types/index.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseKey);

export async function getShotTemplate(id: string): Promise<ShotTemplate> {
  const { data, error } = await supabase
    .from('shot_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) throw new Error(`Shot template not found: ${id}`);
  return data as ShotTemplate;
}

export async function getVisualSystem(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('elan_visual_system')
    .select('key, value');
  if (error || !data) throw new Error('Visual system not found in Supabase');
  return Object.fromEntries(data.map(row => [row.key, row.value]));
}

export async function updateReelStatus(
  reelId: string,
  status: ReelStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('reels')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', reelId);
  if (error) throw new Error(`Failed to update reel ${reelId}: ${error.message}`);
}

export async function upsertVideoJob(params: {
  request_id: string;
  reel_id: string;
  scene_index: number;
  status: 'pending' | 'done' | 'error';
  result_url?: string;
  error?: string;
}): Promise<void> {
  const { error } = await supabase.from('video_render_jobs').upsert({
    ...params,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to upsert video job: ${error.message}`);
}

export async function getPendingVideoJobs(reelId: string): Promise<{ scene_index: number; result_url: string }[]> {
  const { data, error } = await supabase
    .from('video_render_jobs')
    .select('scene_index, result_url, status')
    .eq('reel_id', reelId)
    .eq('status', 'done');
  if (error) throw new Error(`Failed to get video jobs: ${error.message}`);
  return (data ?? []) as { scene_index: number; result_url: string }[];
}
```

- [ ] **Step 3: Commit**

```bash
git add agent-sdk/src/config.ts agent-sdk/src/supabase.ts
git commit -m "feat(agent-sdk): config and Supabase client"
```

---

### Task 6: generateKeyframe tool (gpt-image-1)

**Files:**
- Create: `agent-sdk/src/tools/generateKeyframe.ts`
- Create: `agent-sdk/tests/tools/generateKeyframe.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent-sdk/tests/tools/generateKeyframe.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/supabase.js', () => ({
  getShotTemplate: vi.fn().mockResolvedValue({
    id: 'establishing_home',
    skeleton_prompt: 'Exterior facade of a luxury modern home',
    skeleton_motion_prompt: 'slow dolly-in, 5 seconds',
  }),
  getVisualSystem: vi.fn().mockResolvedValue({
    lighting: 'warm ambient fill',
    color_grading: 'muted warm tones',
    lens_language: { establishing: '24mm wide, low angle' },
    negative_system: 'cartoon, CGI render',
  }),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    images: {
      generate: vi.fn().mockResolvedValue({ data: [{ url: 'https://example.com/image.jpg' }] }),
      edit: vi.fn().mockResolvedValue({ data: [{ url: 'https://example.com/edited.jpg' }] }),
    },
  })),
}));

describe('generateKeyframe', () => {
  it('calls OpenAI images.generate for start frame without reference', async () => {
    const { generateKeyframe } = await import('../../src/tools/generateKeyframe.js');
    const url = await generateKeyframe({
      scene: {
        id: 1, shot_template_id: 'establishing_home', espacio_fisico: 'exterior',
        duracion_s: 5, subject: 'residencia premium', motion_prompt: 'slow dolly-in',
        prompt_strength: 0.9, transition_next: 'hard_cut',
      },
      role: 'start',
    });
    expect(url).toBe('https://example.com/image.jpg');
  });

  it('calls images.edit when referenceImageUrl is provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }));
    const { generateKeyframe } = await import('../../src/tools/generateKeyframe.js');
    const url = await generateKeyframe({
      scene: {
        id: 2, shot_template_id: 'establishing_home', espacio_fisico: 'living',
        duracion_s: 5, subject: 'living room', motion_prompt: 'static',
        prompt_strength: 0.9, transition_next: 'crossfade_300ms',
      },
      role: 'end',
      referenceImageUrl: 'https://example.com/ref.jpg',
    });
    expect(url).toBe('https://example.com/edited.jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd agent-sdk && npm test -- tests/tools/generateKeyframe.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Write generateKeyframe.ts**

```typescript
// agent-sdk/src/tools/generateKeyframe.ts

import OpenAI from 'openai';
import { config } from '../config.js';
import { getShotTemplate, getVisualSystem } from '../supabase.js';
import type { Scene, ShotTemplate } from '../types/index.js';

const openai = new OpenAI({ apiKey: config.openaiKey });

export async function generateKeyframe(params: {
  scene: Scene;
  role: 'start' | 'end';
  referenceImageUrl?: string;
}): Promise<string> {
  const { scene, role, referenceImageUrl } = params;
  const [template, vs] = await Promise.all([
    getShotTemplate(scene.shot_template_id),
    getVisualSystem(),
  ]);

  const prompt = buildPrompt(scene, template, vs, role);

  if (referenceImageUrl) {
    const refResponse = await fetch(referenceImageUrl);
    const refBuffer = await refResponse.arrayBuffer();
    const refFile = new File([refBuffer], 'reference.jpg', { type: 'image/jpeg' });
    const editResponse = await openai.images.edit({
      model: 'gpt-image-1',
      image: refFile,
      prompt: `Maintain exact same architectural space, materials, and lighting from this reference image. ${prompt}`,
      size: '1024x1792',
    });
    return editResponse.data[0].url!;
  }

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1792',
    quality: 'high',
    n: 1,
  });
  return response.data[0].url!;
}

function buildPrompt(scene: Scene, template: ShotTemplate, vs: Record<string, unknown>, role: 'start' | 'end'): string {
  const lensMap = vs.lens_language as Record<string, string>;
  const lens = getLens(template.id, lensMap);
  const rolePrefix = role === 'end'
    ? 'Show the final resting state of this scene. '
    : 'Show the initial state of this scene. ';

  return [
    rolePrefix + template.skeleton_prompt,
    `Subject: ${scene.subject}`,
    `Lighting: ${vs.lighting as string}`,
    `Color grading: ${vs.color_grading as string}`,
    `Lens: ${lens}`,
    `Materials: polished concrete, dark wood, tempered glass, brushed steel`,
    `Portrait orientation 9:16, 1080x1920px`,
    `NEGATIVE: ${vs.negative_system as string}`,
  ].join('. ');
}

function getLens(templateId: string, lensMap: Record<string, string>): string {
  if (['shelly_device_macro','fibaro_keypad_macro','solar_inverter_macro','energy_savings_graph','fibaro_sensor_room'].includes(templateId)) return lensMap.detail;
  if (['establishing_home','solar_panels_roof','home_overview_auto','solar_day_timelapse'].includes(templateId)) return lensMap.establishing;
  if (['app_control_hands','climate_smart','fibaro_app_tablet'].includes(templateId)) return lensMap.lifestyle;
  return lensMap.product;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd agent-sdk && npm test -- tests/tools/generateKeyframe.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent-sdk/src/tools/generateKeyframe.ts agent-sdk/tests/tools/generateKeyframe.test.ts
git commit -m "feat(agent-sdk): generateKeyframe tool with gpt-image-1"
```

---

### Task 7: judgeImage tool (Claude VLM)

**Files:**
- Create: `agent-sdk/src/tools/judgeImage.ts`
- Create: `agent-sdk/tests/tools/judgeImage.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent-sdk/tests/tools/judgeImage.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"score":8,"reasoning":"professional quality","pass":true}' }],
      }),
    },
  })),
}));

describe('judgeImage', () => {
  it('returns parsed VLMScore from Claude response', async () => {
    const { judgeImage } = await import('../../src/tools/judgeImage.js');
    const result = await judgeImage({
      imageUrl: 'https://example.com/img.jpg',
      sceneBrief: 'establishing_home: exterior residencia premium',
    });
    expect(result.score).toBe(8);
    expect(result.pass).toBe(true);
    expect(result.reasoning).toBe('professional quality');
  });

  it('returns pass: false when score < 7', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    (Anthropic as any).mockImplementation(() => ({
      messages: { create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"score":5,"reasoning":"amateurish","pass":false}' }],
      })},
    }));
    const { judgeImage } = await import('../../src/tools/judgeImage.js');
    const result = await judgeImage({ imageUrl: 'https://example.com/img.jpg', sceneBrief: 'test' });
    expect(result.pass).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd agent-sdk && npm test -- tests/tools/judgeImage.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write judgeImage.ts**

```typescript
// agent-sdk/src/tools/judgeImage.ts

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { VLMScore } from '../types/index.js';

const anthropic = new Anthropic({ apiKey: config.anthropicKey });

const JUDGE_SYSTEM = `You are a creative director evaluating AI-generated keyframes for elan.casa Instagram Reels. elan.casa sells Shelly and Fibaro+ smart home devices and Enertik solar panels to premium homeowners in Posadas, Argentina. Target aesthetic: Apple/Lutron/Bang&Olufsen.

Score 0-10:
- 10: Indistinguishable from Apple/Lutron professional marketing photography
- 8-9: Professional quality, publishable
- 7: Acceptable with minor issues — PASS threshold
- 5-6: Amateurish but recognizable
- 0-4: Reject (CGI look, wrong products, cheap interior, text in image, faces visible, wrong orientation)

Respond with JSON only, no markdown: {"score":N,"reasoning":"...","pass":true|false}`;

export async function judgeImage(params: {
  imageUrl: string;
  sceneBrief: string;
}): Promise<VLMScore> {
  const { imageUrl, sceneBrief } = params;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: JUDGE_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: imageUrl } },
        { type: 'text', text: `Scene brief: ${sceneBrief}\n\nScore this image.` },
      ],
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`judgeImage: Claude returned non-JSON: ${text}`);

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    score: Number(parsed.score ?? 0),
    reasoning: String(parsed.reasoning ?? ''),
    pass: Boolean(parsed.pass ?? false),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd agent-sdk && npm test -- tests/tools/judgeImage.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent-sdk/src/tools/judgeImage.ts agent-sdk/tests/tools/judgeImage.test.ts
git commit -m "feat(agent-sdk): judgeImage VLM tool"
```

---

### Task 8: Storyboard generator (Claude LLM)

**Files:**
- Create: `agent-sdk/src/agent/storyboard.ts`
- Create: `agent-sdk/tests/agent/storyboard.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent-sdk/tests/agent/storyboard.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { Storyboard, Brief } from '../../src/types/index.js';

const mockStoryboard: Storyboard = {
  reel_id: 'test-uuid',
  brand: 'elan.casa',
  format: 'reel',
  linea_negocio: 'solar',
  arco: 'educativo',
  titulo: 'Tus paneles trabajan mientras dormís',
  duracion_total_s: 30,
  voz_narracion: 'Texto de prueba',
  caption_instagram: 'Caption de prueba',
  hashtags: '#solar',
  scenes: [{
    id: 1, shot_template_id: 'solar_panels_roof', espacio_fisico: 'exterior_techo',
    duracion_s: 5, subject: 'paneles Enertik', motion_prompt: 'slow pan, 5 seconds',
    prompt_strength: 0.9, transition_next: 'hard_cut',
  }],
};

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockStoryboard) }],
      }),
    },
  })),
}));

describe('generateStoryboard', () => {
  it('returns a valid Storyboard from Claude', async () => {
    const { generateStoryboard } = await import('../../src/agent/storyboard.js');
    const brief: Brief = { format: 'reel', linea_negocio: 'solar', arco: 'educativo' };
    const result = await generateStoryboard('test-uuid', brief);
    expect(result.brand).toBe('elan.casa');
    expect(result.format).toBe('reel');
    expect(result.scenes.length).toBeGreaterThan(0);
  });

  it('throws when Claude returns invalid JSON', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    (Anthropic as any).mockImplementation(() => ({
      messages: { create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'not json' }],
      })},
    }));
    const { generateStoryboard } = await import('../../src/agent/storyboard.js');
    await expect(generateStoryboard('id', { format: 'reel', linea_negocio: 'solar' }))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd agent-sdk && npm test -- tests/agent/storyboard.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write storyboard.ts**

```typescript
// agent-sdk/src/agent/storyboard.ts

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { Brief, Storyboard } from '../types/index.js';

const anthropic = new Anthropic({ apiKey: config.anthropicKey });

const CREATIVE_DIRECTOR_SYSTEM = `You are the Creative Director AI for elan.casa, a premium smart home and solar energy company in Posadas, Misiones, Argentina. Generate professional storyboards for Instagram content.

ALLOWED PRODUCTS ONLY:
- Shelly: smart switches, dimmers, Shelly 2.5 (motorized blinds), Shelly Plug, Shelly Motion sensor
- Fibaro+: keypads, motion sensors, roller shutters, Home Center hub
- Enertik: grid-tied solar panels, solar inverter (no batteries, no off-grid)

PROHIBITED: Crestron, KNX, Control4, biometric access control, security cameras, solar batteries, brands elan.casa does not carry, faces, identifiable people.

TONE: Apple/Tesla aesthetic. FOMO-driven. Tagline "Habite el futuro". Lifestyle language, no tech jargon.

SHOT TEMPLATES (use these IDs exactly): establishing_home, shelly_device_macro, app_control_hands, lights_scene_living, curtain_morning, motion_lights_hall, climate_smart, fibaro_keypad_macro, fibaro_sensor_room, fibaro_app_tablet, solar_panels_roof, solar_inverter_macro, energy_savings_graph, solar_day_timelapse, home_overview_auto

MOTION PROMPT RULE: motion_prompt describes camera movement and timing ONLY. Never describe visual content (that is the keyframe's job). Good: "slow dolly-in, 5 seconds, smooth easing". Bad: "lights turning on" (visual content).

TRANSITION RULE: transition_next = "crossfade_300ms" when next scene is same espacio_fisico; "hard_cut" when different espacio_fisico.

FORMAT RULES:
- "reel": 6-8 scenes, total 28-32 seconds, single thematic focus
- "presentacion": 12-18 scenes, total 60-90 seconds, follow this arc:
  Scenes 1-2 PROBLEMA: lifestyle pain ("tu casa consume más de lo que creés")
  Scenes 3-5 QUÉ PASARÍA SI: aspirational reveal without naming products yet
  Scenes 6-10 SOLUCIÓN: products in action with benefit text overlays
  Scenes 11-13 BENEFICIOS: savings in pesos, comfort, remote control
  Scenes 14-15 FOMO: "los que decidieron antes ya están viviendo así"
  Scene 16-18 CTA: elan.casa logo, "Habite el futuro", contact info

Respond with valid JSON only. No explanation. No markdown fences. Match this schema exactly:
{
  "reel_id": "string",
  "brand": "elan.casa",
  "format": "reel|presentacion",
  "linea_negocio": "solar|domotica|ambas",
  "arco": "lifestyle|educativo|fomo|tecnico",
  "titulo": "string",
  "duracion_total_s": number,
  "voz_narracion": "string (full voiceover script in Argentine Spanish)",
  "caption_instagram": "string (max 2200 chars)",
  "hashtags": "string",
  "scenes": [{
    "id": number,
    "shot_template_id": "string (from allowed list)",
    "espacio_fisico": "string (e.g. exterior, living_room, cocina, techo)",
    "duracion_s": number (4-6),
    "subject": "string",
    "motion_prompt": "string (camera movement only)",
    "prompt_strength": 0.9,
    "transition_next": "hard_cut|crossfade_300ms",
    "seed": number
  }]
}`;

export async function generateStoryboard(reelId: string, brief: Brief): Promise<Storyboard> {
  const userMessage = `Generate a storyboard for elan.casa.
Format: ${brief.format}
Línea de negocio: ${brief.linea_negocio}
Arco: ${brief.arco ?? 'choose best for format'}
Additional idea: ${brief.tema_libre ?? 'none — choose best topic, avoid repetition'}
Reel ID to use: ${reelId}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: CREATIVE_DIRECTOR_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Storyboard: Claude returned non-JSON: ${text.slice(0, 200)}`);

  const storyboard = JSON.parse(jsonMatch[0]) as Storyboard;
  storyboard.reel_id = reelId; // enforce correct ID
  return storyboard;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd agent-sdk && npm test -- tests/agent/storyboard.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent-sdk/src/agent/storyboard.ts agent-sdk/tests/agent/storyboard.test.ts
git commit -m "feat(agent-sdk): Claude storyboard generator"
```

---

### Task 9: /brief endpoint

**Files:**
- Create: `agent-sdk/src/agent/brief.ts`
- Create: `agent-sdk/src/routes/brief.ts`
- Create: `agent-sdk/tests/agent/brief.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent-sdk/tests/agent/brief.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { Brief, Storyboard } from '../../src/types/index.js';

const mockStoryboard: Storyboard = {
  reel_id: 'mock-reel-id',
  brand: 'elan.casa', format: 'reel', linea_negocio: 'solar', arco: 'educativo',
  titulo: 'Test', duracion_total_s: 30, voz_narracion: 'Voz', caption_instagram: 'Cap', hashtags: '#test',
  scenes: [{ id: 1, shot_template_id: 'solar_panels_roof', espacio_fisico: 'techo', duracion_s: 5,
    subject: 'paneles', motion_prompt: 'slow pan, 5s', prompt_strength: 0.9, transition_next: 'hard_cut' }],
};

vi.mock('../../src/agent/storyboard.js', () => ({ generateStoryboard: vi.fn().mockResolvedValue(mockStoryboard) }));
vi.mock('../../src/tools/generateKeyframe.js', () => ({ generateKeyframe: vi.fn().mockResolvedValue('https://img.url/1.jpg') }));
vi.mock('../../src/tools/judgeImage.js', () => ({ judgeImage: vi.fn().mockResolvedValue({ score: 8, reasoning: 'great', pass: true }) }));
vi.mock('../../src/supabase.js', () => ({
  supabase: { from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({}), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }) }) },
  updateReelStatus: vi.fn().mockResolvedValue(undefined),
}));

describe('runBrief', () => {
  it('returns reel_id, storyboard, and keyframe URLs', async () => {
    const { runBrief } = await import('../../src/agent/brief.js');
    const brief: Brief = { format: 'reel', linea_negocio: 'solar' };
    const result = await runBrief(brief);
    expect(result.reel_id).toBeDefined();
    expect(result.storyboard.brand).toBe('elan.casa');
    expect(result.keyframes_start_urls).toHaveLength(1);
    expect(result.keyframes_end_urls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd agent-sdk && npm test -- tests/agent/brief.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write brief.ts (agent logic)**

```typescript
// agent-sdk/src/agent/brief.ts

import { v4 as uuid } from 'uuid';
import { generateStoryboard } from './storyboard.js';
import { generateKeyframe } from '../tools/generateKeyframe.js';
import { judgeImage } from '../tools/judgeImage.js';
import { supabase, updateReelStatus } from '../supabase.js';
import type { Brief, BriefResponse, Scene } from '../types/index.js';

export async function runBrief(brief: Brief): Promise<BriefResponse> {
  const reelId = uuid();

  // 1. Generate storyboard
  const storyboard = await generateStoryboard(reelId, brief);

  // 2. Persist reel record
  const { error } = await supabase.from('reels').insert({
    id: reelId,
    brand: 'elan.casa',
    format: brief.format,
    linea_negocio: brief.linea_negocio,
    arco: brief.arco ?? 'lifestyle',
    status: 'KEYFRAMES_RENDERING',
    idea_titulo: storyboard.titulo,
    storyboard_json: storyboard,
    scenes_count: storyboard.scenes.length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to insert reel: ${error.message}`);

  // 3. Generate keyframes scene by scene (sequential per space for consistency)
  const spaceCache: Record<string, string> = {}; // espacio_fisico → last approved start URL
  const startUrls: string[] = [];
  const endUrls: string[] = [];

  for (const scene of storyboard.scenes) {
    const referenceUrl = spaceCache[scene.espacio_fisico];

    const [startUrl, endUrl] = await Promise.all([
      generateAndJudge(scene, 'start', referenceUrl),
      generateAndJudge(scene, 'end', referenceUrl),
    ]);

    startUrls.push(startUrl);
    endUrls.push(endUrl);
    spaceCache[scene.espacio_fisico] = startUrl;
  }

  // 4. Update reel to AWAITING_SCENE_APPROVAL
  await updateReelStatus(reelId, 'AWAITING_SCENE_APPROVAL', {
    keyframes_start_urls: startUrls,
    keyframes_end_urls: endUrls,
    keyframe_status: startUrls.map(() => 'ready'),
  });

  return { reel_id: reelId, storyboard, keyframes_start_urls: startUrls, keyframes_end_urls: endUrls };
}

async function generateAndJudge(scene: Scene, role: 'start' | 'end', referenceUrl?: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = await generateKeyframe({ scene, role, referenceImageUrl: referenceUrl });
    const score = await judgeImage({ imageUrl: url, sceneBrief: `${scene.shot_template_id}: ${scene.subject}` });
    if (score.pass || attempt === 1) return url; // return best available on last attempt
  }
  throw new Error('unreachable');
}
```

- [ ] **Step 4: Write routes/brief.ts**

```typescript
// agent-sdk/src/routes/brief.ts

import { Router } from 'express';
import { runBrief } from '../agent/brief.js';
import type { Brief } from '../types/index.js';

export const briefRouter = Router();

briefRouter.post('/', async (req, res) => {
  try {
    const brief = req.body as Brief;
    if (!brief.format || !brief.linea_negocio) {
      res.status(400).json({ error: 'format and linea_negocio are required' });
      return;
    }
    const result = await runBrief(brief);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd agent-sdk && npm test -- tests/agent/brief.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent-sdk/src/agent/brief.ts agent-sdk/src/routes/brief.ts agent-sdk/tests/agent/brief.test.ts
git commit -m "feat(agent-sdk): /brief endpoint with storyboard + keyframe generation"
```

---

### Task 10: Express server (index.ts + health route)

**Files:**
- Create: `agent-sdk/src/routes/health.ts`
- Create: `agent-sdk/src/index.ts`

- [ ] **Step 1: Write health.ts**

```typescript
// agent-sdk/src/routes/health.ts
import { Router } from 'express';
export const healthRouter = Router();
healthRouter.get('/', (_req, res) => res.json({ ok: true, service: 'elan-agent-sdk' }));
```

- [ ] **Step 2: Write index.ts**

```typescript
// agent-sdk/src/index.ts

import express from 'express';
import { validateConfig, config } from './config.js';
import { healthRouter } from './routes/health.js';
import { briefRouter } from './routes/brief.js';

validateConfig();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/health', healthRouter);
app.use('/brief', briefRouter);
// /render and /webhook routes added in Phase 2

app.listen(config.port, () => {
  console.log(`elan Agent SDK running on port ${config.port}`);
});
```

- [ ] **Step 3: Create .env.example**

```bash
# agent-sdk/.env.example
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
FAL_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=9oPKasc15pfAbMr7N6Gs
SUPABASE_URL=https://xorjkjaimeampfdiichs.supabase.co
SUPABASE_SERVICE_KEY=...
USE_HAPPYHORSE=false
WEBHOOK_BASE_URL=https://nexo-terra-n8n.6fwciw.easypanel.host
AGENT_BASE_URL=https://elan-agent-sdk.6fwciw.easypanel.host
PORT=3000
```

- [ ] **Step 4: Smoke test locally**

```bash
cd agent-sdk && cp .env.example .env
# Fill in real values in .env
npm run dev
# In another terminal:
curl http://localhost:3000/health
```

Expected: `{"ok":true,"service":"elan-agent-sdk"}`

- [ ] **Step 5: Commit**

```bash
git add agent-sdk/src/routes/health.ts agent-sdk/src/index.ts agent-sdk/.env.example
git commit -m "feat(agent-sdk): Express server with health and brief routes"
```

---

### Task 11: n8n WF-RP-01 — Content Planner

**Files:**
- Create: `n8n/workflows/WF-RP-01-content-planner.md` (node-by-node spec for manual build in n8n UI)

This workflow has no code to test — build it manually in n8n UI following this spec.

- [ ] **Step 1: Build workflow in n8n UI**

**Trigger nodes (two in parallel):**
- **Cron Trigger**: Every Monday at 9:00AM Argentina (UTC-3). Schedule: `0 12 * * 1`
- **WhatsApp Webhook**: POST `/webhook/rp-whatsapp-in`. Receives WhatsApp Cloud API messages.

**Filter node (after WhatsApp Webhook):**
- IF node: `{{ $json.entry[0].changes[0].value.messages[0].text.body }}` matches regex `^(solar|domótica|domotica|presentacion|reel).*` (case insensitive)
- If no match AND it's from cron: pass through with `{ format: "reel", linea_negocio: "ambas" }`

**Set node — Build Brief:**
```json
{
  "format": "{{ $json.body?.includes('presentacion') ? 'presentacion' : 'reel' }}",
  "linea_negocio": "{{ $json.body?.includes('solar') ? 'solar' : $json.body?.includes('domotica') || $json.body?.includes('domótica') ? 'domotica' : 'ambas' }}",
  "tema_libre": "{{ $json.body ?? '' }}"
}
```

**HTTP Request node — Call Agent SDK /brief:**
- Method: POST
- URL: `{{ $env.AGENT_BASE_URL }}/brief`
- Body: `{{ $json }}` (the brief object)
- Timeout: 300000ms (5 min — keyframe generation takes time)

**Supabase node — Log:**
- Operation: Insert → `workflow_logs`
- Data: `{ workflow_name: "WF-RP-01", status: "brief_sent", metadata: { reel_id: "{{ $json.reel_id }}" } }`

**WhatsApp Send node — Notify Carlos:**
- To: `5491130875304`
- Message: `✅ *elan.casa* — Storyboard listo!\n\nTítulo: {{ $json.storyboard.titulo }}\nEscenas: {{ $json.storyboard.scenes_count }}\n\nTe mando las imágenes ahora para que apruebes.`

- [ ] **Step 2: Store reel_id for next workflow**

After the HTTP Request node returns `{ reel_id, storyboard, keyframes_start_urls }`, send each `keyframes_start_urls[i]` as a separate WhatsApp image message to Carlos (one per scene). Add a node that loops over the array.

**Loop node (Code node):**
```javascript
const { reel_id, storyboard, keyframes_start_urls } = $input.first().json;
return keyframes_start_urls.map((url, i) => ({
  json: {
    reel_id,
    scene_index: i,
    scene_titulo: storyboard.scenes[i]?.shot_template_id,
    image_url: url,
  }
}));
```

**WhatsApp Send Image node (after loop):**
- Send each image as a media message with caption: `Escena {{ $json.scene_index + 1 }}: {{ $json.scene_titulo }}`

**Final WhatsApp node:**
- Message: `Respondé con:\n✅ *OK* para aprobar todas\n❌ *REGEN N* para regenerar escena N`

- [ ] **Step 3: Activate workflow in n8n**

Toggle workflow to Active. Test with message "solar" to the WhatsApp number.

- [ ] **Step 4: Commit the spec**

```bash
git add n8n/workflows/WF-RP-01-content-planner.md
git commit -m "docs(n8n): WF-RP-01 Content Planner node spec"
```

---

### Task 12: n8n WF-RP-02 — Storyboard Approval (Gate 1)

This workflow fires when Carlos replies to the keyframe images.

- [ ] **Step 1: Build workflow in n8n UI**

**Trigger:** WhatsApp Webhook `/webhook/rp-approval-gate1`

**Code node — Parse Carlos's reply:**
```javascript
const body = $input.first().json.entry[0].changes[0].value.messages[0].text.body.trim().toUpperCase();
// body examples: "OK", "REGEN 2", "REGEN 3 más luminoso"
const isApproval = body === 'OK';
const regenMatch = body.match(/^REGEN (\d+)(.*)?$/);
return [{
  json: {
    action: isApproval ? 'approve' : regenMatch ? 'regen' : 'unknown',
    scene_index: regenMatch ? parseInt(regenMatch[1]) - 1 : null,
    regen_note: regenMatch?.[2]?.trim() ?? null,
  }
}];
```

**IF node:** branch on `action`
- `approve` → Supabase update reel status to `SCENES_APPROVED` → trigger WF-RP-03
- `regen` → call `POST /brief/regen-scene` on Agent SDK (pass reel_id + scene_index + regen_note) → send new image → wait for next reply
- `unknown` → WhatsApp: `No entendí. Respondé OK o REGEN N.`

**Note:** The `reel_id` must be tracked across messages. Store it in a Supabase `active_approvals` table keyed by Carlos's phone number, or pass it via WhatsApp message metadata. Simplest approach: store `{ phone: "5491130875304", reel_id: "...", stage: "gate1" }` in Supabase after WF-RP-01 completes, retrieve it here.

- [ ] **Step 2: Add active_approvals table to Supabase**

```sql
-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS active_approvals (
  phone TEXT PRIMARY KEY,
  reel_id UUID NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('gate1', 'gate2')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 3: Commit**

```bash
git add n8n/workflows/WF-RP-02-approval-gate1.md
git commit -m "docs(n8n): WF-RP-02 Gate 1 approval workflow spec"
```

---

## PHASE 2 — Video Generation & Assembly (Week 3)

---

### Task 13: generateVideo tool (fal.ai webhook)

**Files:**
- Create: `agent-sdk/src/tools/generateVideo.ts`
- Create: `agent-sdk/src/routes/webhook.ts`

- [ ] **Step 1: Write generateVideo.ts**

```typescript
// agent-sdk/src/tools/generateVideo.ts

import * as fal from '@fal-ai/client';
import { config } from '../config.js';
import { upsertVideoJob } from '../supabase.js';

fal.config({ credentials: config.falKey });

const HAPPYHORSE_MODEL = 'fal-ai/happyhorse/image-to-video';
const KLING_MODEL = 'fal-ai/kling-video/v1.6/standard/image-to-video';

export async function generateVideo(params: {
  reelId: string;
  sceneIndex: number;
  startFrameUrl: string;
  endFrameUrl: string;
  motionPrompt: string;
  durationS: number;
}): Promise<string> { // returns fal.ai request_id
  const { reelId, sceneIndex, startFrameUrl, endFrameUrl, motionPrompt, durationS } = params;
  const webhookUrl = `${config.agentBaseUrl}/webhook/fal?reel_id=${reelId}&scene_index=${sceneIndex}`;
  const useHappyHorse = config.useHappyHorse;

  const modelId = useHappyHorse ? HAPPYHORSE_MODEL : KLING_MODEL;
  const input = useHappyHorse
    ? { image_urls: [startFrameUrl, endFrameUrl], prompt: motionPrompt, prompt_strength: 0.9, duration: durationS, aspect_ratio: '9:16' }
    : { image_url: startFrameUrl, prompt: motionPrompt, duration: String(durationS), aspect_ratio: '9:16' };

  const { request_id } = await fal.queue.submit(modelId, { input, webhookUrl });

  await upsertVideoJob({ request_id, reel_id: reelId, scene_index: sceneIndex, status: 'pending' });

  return request_id;
}
```

- [ ] **Step 2: Write routes/webhook.ts (fal.ai callback)**

```typescript
// agent-sdk/src/routes/webhook.ts

import { Router } from 'express';
import { upsertVideoJob, supabase } from '../supabase.js';

export const webhookRouter = Router();

// fal.ai POSTs here when a video clip is done
webhookRouter.post('/fal', async (req, res) => {
  res.sendStatus(200); // ack immediately
  try {
    const { reel_id, scene_index } = req.query as { reel_id: string; scene_index: string };
    const payload = req.body;

    const isError = payload.status === 'ERROR' || !payload.output?.video?.url;

    await upsertVideoJob({
      request_id: payload.request_id ?? 'unknown',
      reel_id,
      scene_index: Number(scene_index),
      status: isError ? 'error' : 'done',
      result_url: payload.output?.video?.url,
      error: isError ? JSON.stringify(payload.error ?? 'no output') : undefined,
    });

    // Check if all scenes for this reel are done
    const { data: jobs } = await supabase
      .from('video_render_jobs')
      .select('status, result_url')
      .eq('reel_id', reel_id);

    const total = jobs?.length ?? 0;
    const done = jobs?.filter(j => j.status === 'done').length ?? 0;
    const errored = jobs?.filter(j => j.status === 'error').length ?? 0;

    if (done + errored === total && total > 0) {
      // All clips resolved — notify n8n
      const n8nWebhookUrl = `${process.env.WEBHOOK_BASE_URL}/webhook/rp-video-done`;
      await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reel_id, done, errored, total }),
      });
    }
  } catch (err) {
    console.error('webhook/fal error:', err);
  }
});
```

- [ ] **Step 3: Register webhook route in index.ts**

```typescript
// Add to agent-sdk/src/index.ts after briefRouter line:
import { webhookRouter } from './routes/webhook.js';
app.use('/webhook', webhookRouter);
```

- [ ] **Step 4: Commit**

```bash
git add agent-sdk/src/tools/generateVideo.ts agent-sdk/src/routes/webhook.ts agent-sdk/src/index.ts
git commit -m "feat(agent-sdk): generateVideo tool + fal.ai webhook handler"
```

---

### Task 14: validateVideo tool (ffprobe)

**Files:**
- Create: `agent-sdk/src/tools/validateVideo.ts`
- Create: `agent-sdk/tests/tools/validateVideo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent-sdk/tests/tools/validateVideo.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('fluent-ffmpeg', () => ({
  default: vi.fn().mockReturnValue({
    ffprobe: vi.fn().mockImplementation((_url: string, cb: Function) => {
      cb(null, {
        streams: [{ codec_type: 'video', width: 1080, height: 1920, r_frame_rate: '30/1' }],
        format: { duration: '5.0' },
      });
    }),
  }),
}));

describe('validateVideo', () => {
  it('passes a valid 9:16 5-second video', async () => {
    const { validateVideo } = await import('../../src/tools/validateVideo.js');
    const result = await validateVideo({ videoUrl: 'https://example.com/clip.mp4', expectedDurationS: 5 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd agent-sdk && npm test -- tests/tools/validateVideo.test.ts
```

- [ ] **Step 3: Write validateVideo.ts**

```typescript
// agent-sdk/src/tools/validateVideo.ts

import ffmpeg from 'fluent-ffmpeg';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  duration_s?: number;
}

export async function validateVideo(params: {
  videoUrl: string;
  expectedDurationS: number;
}): Promise<ValidationResult> {
  const { videoUrl, expectedDurationS } = params;

  return new Promise((resolve) => {
    ffmpeg(videoUrl).ffprobe((err, data) => {
      if (err) {
        resolve({ valid: false, errors: [`ffprobe error: ${err.message}`] });
        return;
      }

      const errors: string[] = [];
      const videoStream = data.streams.find(s => s.codec_type === 'video');

      if (!videoStream) {
        errors.push('No video stream found');
      } else {
        const { width, height } = videoStream;
        if (width !== 1080 || height !== 1920) {
          errors.push(`Wrong resolution: ${width}x${height}, expected 1080x1920`);
        }
      }

      const duration = parseFloat(data.format.duration ?? '0');
      if (Math.abs(duration - expectedDurationS) > 0.5) {
        errors.push(`Duration ${duration.toFixed(1)}s differs from expected ${expectedDurationS}s by > 0.5s`);
      }

      resolve({ valid: errors.length === 0, errors, duration_s: duration });
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd agent-sdk && npm test -- tests/tools/validateVideo.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent-sdk/src/tools/validateVideo.ts agent-sdk/tests/tools/validateVideo.test.ts
git commit -m "feat(agent-sdk): validateVideo with ffprobe"
```

---

### Task 15: ElevenLabs voiceover + Whisper captions

**Files:**
- Create: `agent-sdk/src/tools/generateVoiceover.ts`
- Create: `agent-sdk/src/tools/generateCaptions.ts`

- [ ] **Step 1: Write generateVoiceover.ts**

```typescript
// agent-sdk/src/tools/generateVoiceover.ts

import axios from 'axios';
import { config } from '../config.js';

export async function generateVoiceover(params: {
  text: string;
  outputPath: string; // local tmp path
}): Promise<string> {
  const { text, outputPath } = params;

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}`,
    {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
    },
    {
      headers: {
        'xi-api-key': config.elevenLabsKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
    }
  );

  const { writeFile } = await import('fs/promises');
  await writeFile(outputPath, Buffer.from(response.data));
  return outputPath;
}
```

- [ ] **Step 2: Write generateCaptions.ts**

```typescript
// agent-sdk/src/tools/generateCaptions.ts

import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { config } from '../config.js';

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export async function generateCaptions(params: {
  audioPath: string;
}): Promise<{ srtContent: string; words: WordTimestamp[] }> {
  const { audioPath } = params;

  const form = new FormData();
  form.append('file', createReadStream(audioPath), { filename: 'voiceover.mp3' });
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('language', 'es');

  const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${config.openaiKey}` },
  });

  const words: WordTimestamp[] = response.data.words ?? [];
  const srtContent = wordsToSrt(words);

  return { srtContent, words };
}

function wordsToSrt(words: WordTimestamp[]): string {
  // Group into ~5-word chunks
  const chunks: WordTimestamp[][] = [];
  let current: WordTimestamp[] = [];
  for (const w of words) {
    current.push(w);
    if (current.length >= 5) { chunks.push(current); current = []; }
  }
  if (current.length) chunks.push(current);

  return chunks.map((chunk, i) => {
    const start = formatSrtTime(chunk[0].start);
    const end = formatSrtTime(chunk[chunk.length - 1].end);
    const text = chunk.map(w => w.word).join(' ');
    return `${i + 1}\n${start} --> ${end}\n${text}`;
  }).join('\n\n');
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}
```

- [ ] **Step 3: Commit**

```bash
git add agent-sdk/src/tools/generateVoiceover.ts agent-sdk/src/tools/generateCaptions.ts
git commit -m "feat(agent-sdk): ElevenLabs voiceover + Whisper captions tools"
```

---

### Task 16: concatAndMix tool (ffmpeg xfade)

**Files:**
- Create: `agent-sdk/src/tools/concatAndMix.ts`

- [ ] **Step 1: Write concatAndMix.ts**

```typescript
// agent-sdk/src/tools/concatAndMix.ts

import ffmpeg from 'fluent-ffmpeg';
import { writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Scene } from '../types/index.js';

export async function concatAndMix(params: {
  clipPaths: string[];        // local paths to video clips in scene order
  scenes: Scene[];            // needed for transition_next
  voiceoverPath: string;      // local path to ElevenLabs MP3
  srtPath: string;            // local path to SRT captions
  outputPath: string;         // local path for final MP4
}): Promise<string> {
  const { clipPaths, scenes, voiceoverPath, srtPath, outputPath } = params;

  // Build ffmpeg complex filter for xfade transitions
  // For each pair of clips: if transition_next === 'crossfade_300ms', apply xfade
  // Otherwise hard cut (no filter needed, just concat)

  const crossfadeDuration = 0.3;
  let filterComplex = '';
  let currentLabel = '[0:v]';
  const inputs = clipPaths.map((p, i) => ({ path: p, index: i }));

  // Simple approach: use concat demuxer for hard cuts + xfade filter for crossfades
  const concatListPath = join(tmpdir(), `concat-${Date.now()}.txt`);
  const concatList = clipPaths.map(p => `file '${p}'`).join('\n');
  await writeFile(concatListPath, concatList);

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    // Input: all video clips
    clipPaths.forEach(p => cmd.input(p));
    // Input: voiceover audio
    cmd.input(voiceoverPath);

    const videoInputCount = clipPaths.length;

    // Build filter_complex for video concat with optional crossfades
    let filterParts: string[] = [];
    let prevLabel = `[0:v]`;

    for (let i = 1; i < clipPaths.length; i++) {
      const transition = scenes[i - 1]?.transition_next;
      const nextLabel = `[v${i}]`;
      if (transition === 'crossfade_300ms') {
        filterParts.push(`${prevLabel}[${i}:v]xfade=fade:duration=${crossfadeDuration}:offset=${scenes.slice(0, i).reduce((acc, s) => acc + s.duracion_s, 0) - crossfadeDuration}${nextLabel}`);
      } else {
        filterParts.push(`${prevLabel}[${i}:v]concat=n=2:v=1:a=0${nextLabel}`);
      }
      prevLabel = nextLabel;
    }

    const finalVideoLabel = clipPaths.length === 1 ? '[0:v]' : prevLabel;

    // Add voiceover and captions
    filterParts.push(`${finalVideoLabel}[${videoInputCount}:a]amerge=inputs=1[aout]`);

    cmd
      .complexFilter(filterParts.join('; '))
      .map(finalVideoLabel.replace('[','').replace(']',''))
      .map('[aout]')
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        `-vf subtitles=${srtPath}:force_style='FontSize=22,Alignment=2,MarginV=40,PrimaryColour=&HFFFFFF&'`,
        '-movflags faststart',
        '-crf 18',
        '-preset fast',
      ])
      .output(outputPath)
      .on('end', async () => {
        await rm(concatListPath, { force: true });
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(new Error(`ffmpeg concat error: ${err.message}`));
      })
      .run();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add agent-sdk/src/tools/concatAndMix.ts
git commit -m "feat(agent-sdk): concatAndMix with ffmpeg xfade transitions"
```

---

### Task 17: /render endpoint

**Files:**
- Create: `agent-sdk/src/agent/render.ts`
- Create: `agent-sdk/src/routes/render.ts`

- [ ] **Step 1: Write render.ts (agent logic)**

```typescript
// agent-sdk/src/agent/render.ts

import { tmpdir } from 'os';
import { join } from 'path';
import { rm, mkdir } from 'fs/promises';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { generateVideo } from '../tools/generateVideo.js';
import { validateVideo } from '../tools/validateVideo.js';
import { generateVoiceover } from '../tools/generateVoiceover.js';
import { generateCaptions } from '../tools/generateCaptions.js';
import { concatAndMix } from '../tools/concatAndMix.js';
import { supabase, updateReelStatus, getPendingVideoJobs } from '../supabase.js';
import type { RenderRequest, RenderResponse } from '../types/index.js';

export async function runRender(request: RenderRequest): Promise<RenderResponse> {
  const { reel_id, storyboard, approved_scenes } = request;
  const workDir = join(tmpdir(), `reel-${reel_id}`);
  await mkdir(workDir, { recursive: true });

  try {
    await updateReelStatus(reel_id, 'VIDEO_RENDERING');

    // 1. Submit all video clip generations in parallel
    const jobPromises = approved_scenes.map((scene, i) =>
      generateVideo({
        reelId: reel_id,
        sceneIndex: i,
        startFrameUrl: scene.start_url,
        endFrameUrl: scene.end_url,
        motionPrompt: storyboard.scenes[scene.scene_id - 1]?.motion_prompt ?? 'static shot, 5 seconds',
        durationS: storyboard.scenes[scene.scene_id - 1]?.duracion_s ?? 5,
      })
    );
    await Promise.all(jobPromises);

    // 2. Wait for fal.ai webhooks to mark all jobs as done
    // (The webhook handler in routes/webhook.ts will notify n8n when all are complete)
    // n8n will call POST /render/assemble once all jobs are done

    return {
      reel_id,
      video_url: 'pending_webhook',
      duration_s: storyboard.duracion_total_s,
      scenes_validated: approved_scenes.length,
    };
  } catch (err) {
    await updateReelStatus(reel_id, 'ERROR', { error_stage: 'VIDEO_RENDERING', error_detail: String(err) });
    throw err;
  }
}

export async function runAssemble(reelId: string, storyboard: RenderRequest['storyboard']): Promise<string> {
  const workDir = join(tmpdir(), `reel-${reelId}`);
  await mkdir(workDir, { recursive: true });

  try {
    await updateReelStatus(reelId, 'VIDEO_READY');

    // 1. Get all clip URLs from Supabase (populated by webhook handler)
    const jobs = await getPendingVideoJobs(reelId);
    const sortedJobs = jobs.sort((a, b) => a.scene_index - b.scene_index);

    // 2. Download all clips to local tmp
    const clipPaths: string[] = [];
    for (const job of sortedJobs) {
      const localPath = join(workDir, `clip-${job.scene_index}.mp4`);
      await downloadFile(job.result_url, localPath);
      clipPaths.push(localPath);
    }

    // 3. Generate voiceover
    const voiceoverPath = join(workDir, 'voiceover.mp3');
    await generateVoiceover({ text: storyboard.voz_narracion, outputPath: voiceoverPath });

    // 4. Generate captions
    const { srtContent } = await generateCaptions({ audioPath: voiceoverPath });
    const srtPath = join(workDir, 'captions.srt');
    const { writeFile } = await import('fs/promises');
    await writeFile(srtPath, srtContent);

    // 5. Concat + mix
    const outputPath = join(workDir, 'final.mp4');
    await concatAndMix({
      clipPaths,
      scenes: storyboard.scenes,
      voiceoverPath,
      srtPath,
      outputPath,
    });

    // 6. Upload final video to Supabase Storage
    const { readFile } = await import('fs/promises');
    const videoBuffer = await readFile(outputPath);
    const storageKey = `reels/${reelId}/final.mp4`;

    const { error } = await supabase.storage
      .from('reels-videos')
      .upload(storageKey, videoBuffer, { contentType: 'video/mp4', upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const { data: urlData } = supabase.storage.from('reels-videos').getPublicUrl(storageKey);
    const publicUrl = urlData.publicUrl;

    await updateReelStatus(reelId, 'AWAITING_FINAL_APPROVAL', {
      assembled_url: publicUrl,
      caption: storyboard.caption_instagram,
      hashtags: storyboard.hashtags,
    });

    return publicUrl;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  return new Promise((resolve, reject) => {
    const writer = createWriteStream(dest);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}
```

- [ ] **Step 2: Write routes/render.ts**

```typescript
// agent-sdk/src/routes/render.ts

import { Router } from 'express';
import { runRender, runAssemble } from '../agent/render.js';
import type { RenderRequest } from '../types/index.js';

export const renderRouter = Router();

renderRouter.post('/', async (req, res) => {
  try {
    const request = req.body as RenderRequest;
    const result = await runRender(request);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

renderRouter.post('/assemble', async (req, res) => {
  try {
    const { reel_id, storyboard } = req.body;
    const videoUrl = await runAssemble(reel_id, storyboard);
    res.json({ reel_id, video_url: videoUrl });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

- [ ] **Step 3: Register render route in index.ts**

```typescript
// Add to agent-sdk/src/index.ts:
import { renderRouter } from './routes/render.js';
app.use('/render', renderRouter);
```

- [ ] **Step 4: Commit**

```bash
git add agent-sdk/src/agent/render.ts agent-sdk/src/routes/render.ts agent-sdk/src/index.ts
git commit -m "feat(agent-sdk): /render endpoint with video generation and assembly"
```

---

### Task 18: n8n WF-RP-03 and WF-RP-04

- [ ] **Step 1: Build WF-RP-03 (Video Render + Gate 2) in n8n UI**

**Trigger:** Webhook `/webhook/rp-video-done` — called by Agent SDK webhook handler when all clips resolve.

**HTTP Request node — POST /render/assemble:**
- URL: `{{ $env.AGENT_BASE_URL }}/render/assemble`
- Body: `{ reel_id: "{{ $json.reel_id }}", storyboard: "{{ $json.storyboard }}" }`
- Note: n8n must have stored the storyboard after WF-RP-01. Store it in Supabase `reels.storyboard_json` and retrieve it here with a Supabase node.

**WhatsApp Send Video node:**
- Send video from `assembled_url` to Carlos: `5491130875304`
- Caption: `🎬 *Video listo para aprobar*\n\nTítulo: {{ $json.titulo }}\n\nRespondé *OK* para publicar o *RECHAZAR* para descartar.`

- [ ] **Step 2: Build WF-RP-04 (Publisher) in n8n UI**

**Trigger:** WhatsApp Webhook `/webhook/rp-approval-gate2`

**Parse reply** (Code node):
```javascript
const body = $input.first().json.entry[0].changes[0].value.messages[0].text.body.trim().toUpperCase();
return [{ json: { action: body === 'OK' ? 'publish' : 'reject' } }];
```

**IF approve → Instagram publish:**
1. Supabase node: get `assembled_url`, `caption`, `hashtags` from `reels` where `status = 'AWAITING_FINAL_APPROVAL'` and phone matches
2. HTTP Request — Create IG media container:
   - POST `https://graph.facebook.com/v21.0/{{ $env.ELAN_IG_USER_ID }}/media`
   - Body: `{ media_type: "REELS", video_url: "{{ assembled_url }}", caption: "{{ caption }} {{ hashtags }}", access_token: "{{ $env.ELAN_INSTAGRAM_ACCESS_TOKEN }}" }`
3. HTTP Request — Publish container:
   - POST `https://graph.facebook.com/v21.0/{{ $env.ELAN_IG_USER_ID }}/media_publish`
   - Body: `{ creation_id: "{{ $json.id }}", access_token: "{{ $env.ELAN_INSTAGRAM_ACCESS_TOKEN }}" }`
4. Supabase update: `status = 'PUBLISHED'`, `ig_post_id = "{{ published_id }}"`
5. WhatsApp notify: `✅ Reel publicado en @elan.casa`

**IF reject:**
1. Supabase update: `status = 'ERROR'`, `error_detail = 'rejected_at_gate2'`
2. WhatsApp notify: `❌ Reel descartado. El pipeline está listo para el próximo.`

- [ ] **Step 3: Commit workflow specs**

```bash
git add n8n/workflows/WF-RP-03-video-render-gate2.md n8n/workflows/WF-RP-04-publisher.md
git commit -m "docs(n8n): WF-RP-03 and WF-RP-04 workflow specs"
```

---

## PHASE 3 — Deploy & First Video

---

### Task 19: Dockerfile + EasyPanel deploy

**Files:**
- Create: `agent-sdk/Dockerfile`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
# agent-sdk/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Deploy in EasyPanel**

1. In EasyPanel → New App → GitHub → select `Norberto-Documentos` repo → subfolder `agent-sdk`
2. Set all env vars from `.env.example` with real values
3. Set `AGENT_BASE_URL` to the EasyPanel public URL for this service
4. Deploy and wait for health check: `GET /health` → `{"ok":true}`

- [ ] **Step 3: Configure n8n env vars**

In n8n EasyPanel service, add:
- `AGENT_BASE_URL`: URL of the Agent SDK service
- `ELAN_IG_USER_ID`: elan.casa Instagram Business User ID (get after creating the account)
- `ELAN_INSTAGRAM_ACCESS_TOKEN`: elan.casa IG token

- [ ] **Step 4: Create Supabase Storage bucket**

In Supabase dashboard → Storage → New Bucket → `reels-videos` → Public.

- [ ] **Step 5: Commit**

```bash
git add agent-sdk/Dockerfile
git commit -m "feat(agent-sdk): Dockerfile with ffmpeg"
```

---

### Task 20: End-to-end smoke test — produce the brand video

This is the first real run. Follow these steps manually:

- [ ] **Step 1: Trigger the brand video via WhatsApp**

Send to the elan.casa WhatsApp Business number:
```
presentacion
```

Expected: Carlos receives WhatsApp confirmation "Storyboard listo!" within ~5 minutes.

- [ ] **Step 2: Review and approve keyframes (Gate 1)**

Carlos receives 12-18 images via WhatsApp. Review each. Reply:
```
OK
```
(or `REGEN N` to regenerate specific scene)

- [ ] **Step 3: Wait for video clips**

All clips generate in parallel (~90s). Carlos receives the assembled video via WhatsApp.

- [ ] **Step 4: Approve or reject (Gate 2)**

Reply `OK` to publish. The brand video is published to `@elan.casa` on Instagram.

- [ ] **Step 5: Verify in Instagram**

Confirm the post appears in `@elan.casa`. Log the `ig_post_id` in Supabase.

---

## Pre-requisites checklist (before starting implementation)

- [ ] Create Instagram Business account `@elan.casa` → get `ig_user_id` and `access_token`
- [ ] Decide: use Nexo Terra WhatsApp Business as notification channel (Carlos's number) or create new elan.casa WA Business account
- [ ] Configure WhatsApp Cloud API webhook URL in Meta Developer Console pointing to n8n
- [ ] Set `USE_HAPPYHORSE=false` initially (Kling fallback). Switch to `true` once HappyHorse API launches (~2026-04-30)
- [ ] Get FAL_KEY from fal.ai dashboard
- [ ] Create `reels-videos` bucket in Supabase Storage

---

## Self-Review

**Spec coverage:**
- ✅ gpt-image-1 for keyframes (Tasks 6, 9)
- ✅ start + end frame per scene (Task 6, 13)
- ✅ VLM judge 2 candidates (Task 7, 9)
- ✅ HappyHorse / Kling fallback via fal.ai queue + webhook (Task 13)
- ✅ prompt_strength: 0.9 (Task 13)
- ✅ Motion-only prompts enforced in Creative Director system prompt (Task 8)
- ✅ Parallel video generation (Task 13, 17)
- ✅ ffmpeg xfade transitions (Task 16)
- ✅ ElevenLabs voiceover (Task 15)
- ✅ Whisper captions (Task 15)
- ✅ Supabase state machine (Task 1, 5, 9, 17)
- ✅ Two gates via WhatsApp (Tasks 11, 12, 18)
- ✅ Instagram publishing (Task 18)
- ✅ Shot Library 15 templates (Task 2)
- ✅ Visual System (Task 2)
- ✅ Creative Director constraints: Shelly/Fibaro+/Enertik only (Task 8)
- ✅ Two formats: reel + presentacion with FOMO arc (Task 8)
- ✅ Brand video as first pipeline output (Task 20)
- ✅ Docker + EasyPanel deploy (Task 19)

**Potential gaps:**
- The `regen-scene` endpoint (called when Carlos replies `REGEN N`) is not fully specified. Add a `POST /brief/regen-scene` route in `routes/brief.ts` that re-runs `generateAndJudge` for a single scene and returns the new URL. n8n calls it and re-sends the image to Carlos.
- Supabase Storage CORS policy may need configuration for video streaming. Enable public access in bucket settings.
