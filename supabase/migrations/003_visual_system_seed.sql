-- supabase/migrations/003_visual_system_seed.sql

INSERT INTO elan_visual_system (key, value) VALUES
('palette', '{"primary":["#0a0a0f","#1a1a2e"],"accent":["#c8a96e","#e8d5b0"],"neutral":["#f5f5f0","#2a2a3e"]}'),
('lighting', '"warm ambient fill, soft directional rim from 45 degrees, architectural shadows, no harsh flash"'),
('lens_language', '{"establishing":"24mm wide, low angle, golden hour","product":"85mm macro, shallow DOF, neutral background","lifestyle":"35mm, eye level, natural light","detail":"100mm macro, extreme close-up, texture emphasis"}'),
('color_grading', '"muted warm tones, slight desaturation, lifted blacks, cinematic"'),
('negative_system', '"cartoon, CGI render, text in image, watermark, plastic look, oversaturated, cheap interior, visible cables, uncanny faces, low resolution, grain excess, lens flare cheap, science fiction, futuristic fantasy"')
ON CONFLICT (key) DO NOTHING;
