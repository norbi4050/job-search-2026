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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_render_jobs_reel_id ON video_render_jobs(reel_id);
CREATE INDEX IF NOT EXISTS idx_reels_status ON reels(status);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_reels_updated_at
  BEFORE UPDATE ON reels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_video_render_jobs_updated_at
  BEFORE UPDATE ON video_render_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
