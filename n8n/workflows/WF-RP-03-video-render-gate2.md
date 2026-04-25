# WF-RP-03 — Video Render + Gate 2

**Trigger:** Webhook — POST `/webhook/rp-video-done`

This webhook is called by the Agent SDK (`routes/webhook.ts`) when ALL video clips for a reel have been processed by fal.ai (all `video_render_jobs` for a `reel_id` have status `done` or `error`).

---

## Nodes (in order)

### 1. Supabase Select — Get storyboard
- Table: `reels`
- Filter: `id = {{ $json.reel_id }}`
- Select: `id, storyboard_json, idea_titulo`

### 2. HTTP Request — POST /render/assemble
- Method: POST
- URL: `{{ $env.AGENT_BASE_URL }}/render/assemble`
- Body:
  ```json
  {
    "reel_id": "{{ $json.reel_id }}",
    "storyboard": "{{ $('Supabase Select').item.json.storyboard_json }}"
  }
  ```
- Timeout: 600000ms (10 min — assembly + voiceover + upload takes time)
- Expected response: `{ reel_id, video_url }`

### 3. Supabase Select — Get assembled video details
- Table: `reels`
- Filter: `id = {{ $json.reel_id }}`
- Select: `assembled_url, caption, hashtags, idea_titulo`

### 4. Supabase Update — Store active gate2 approval
- Table: `active_approvals`
- Operation: Upsert
- Data: `{ phone: "5491130875304", reel_id: "{{ $json.reel_id }}", stage: "gate2" }`

### 5. WhatsApp Send Video — Gate 2 review
- To: `5491130875304`
- Video URL: `{{ $('Supabase Select').item.json.assembled_url }}`
- Caption:
  ```
  🎬 *Video listo para aprobar*

  Título: {{ $('Supabase Select').item.json.idea_titulo }}

  Respondé *OK* para publicar o *RECHAZAR* para descartar.
  ```

---

## Notes
- If `done < total` (some clips errored), the assembly will skip errored scenes. Consider sending a warning: "⚠️ {{ $json.errored }} escena(s) fallaron — el video puede tener menos escenas."
- The `assembled_url` is a Supabase Storage public URL. WhatsApp may need a direct MP4 URL — ensure the bucket is public.
