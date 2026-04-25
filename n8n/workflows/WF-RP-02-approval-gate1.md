# WF-RP-02 — Storyboard Approval (Gate 1)

**Trigger:** WhatsApp Webhook — POST `/webhook/rp-approval-gate1`

This workflow fires when Carlos replies to the keyframe images.

---

## Prerequisite: active_approvals table in Supabase

Run in Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS active_approvals (
  phone TEXT PRIMARY KEY,
  reel_id UUID NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('gate1', 'gate2')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Nodes (in order)

### 1. Code Node — Parse Carlos's reply
```javascript
const body = $input.first().json.entry[0].changes[0].value.messages[0].text.body.trim().toUpperCase();
const isApproval = body === 'OK';
const regenMatch = body.match(/^REGEN (\d+)(.*)?$/);
return [{
  json: {
    action: isApproval ? 'approve' : regenMatch ? 'regen' : 'unknown',
    scene_index: regenMatch ? parseInt(regenMatch[1]) - 1 : null,
    regen_note: regenMatch?.[2]?.trim() ?? null,
    phone: '5491130875304',
  }
}];
```

### 2. Supabase Select — Get active reel_id
- Table: `active_approvals`
- Filter: `phone = {{ $json.phone }}`
- Returns: `reel_id`

### 3. IF Node — Branch on action

**Branch: approve**
1. Supabase Update → `reels` table → `status = 'SCENES_APPROVED'` where `id = {{ $json.reel_id }}`
2. HTTP Request → POST `{{ $env.AGENT_BASE_URL }}/render` with body `{ reel_id, storyboard, approved_scenes }` (storyboard from Supabase `reels.storyboard_json`)
3. WhatsApp Send → "✅ Escenas aprobadas. Generando videos, te aviso cuando estén listos (~2 min)"

**Branch: regen**
1. HTTP Request → POST `{{ $env.AGENT_BASE_URL }}/brief/regen-scene`
   Body: `{ reel_id: {{ $json.reel_id }}, scene_index: {{ $json.scene_index }}, regen_note: {{ $json.regen_note }} }`
2. WhatsApp Send Image → new image URL from response
3. WhatsApp Send → "Escena regenerada. Respondé OK si está bien o REGEN N para otro."

**Branch: unknown**
- WhatsApp Send → "No entendí. Respondé *OK* para aprobar o *REGEN N* para regenerar escena N."

---

## Note: regen-scene endpoint
The Agent SDK needs a `POST /brief/regen-scene` endpoint that accepts `{ reel_id, scene_index, regen_note }` and re-runs `generateAndJudge` for that single scene. Add to `routes/brief.ts`:

```typescript
briefRouter.post('/regen-scene', async (req, res) => {
  // Re-generate a single scene keyframe
  // Returns: { new_url: string }
});
```
This is a known gap in the current plan — implement when building WF-RP-02.
