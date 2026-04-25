# WF-RP-01 — Content Planner

**Trigger:** Two parallel triggers:
1. **Cron Trigger** — Every Monday at 9:00AM Argentina time (UTC-3). Cron: `0 12 * * 1`
2. **WhatsApp Webhook** — POST `/webhook/rp-whatsapp-in`. Receives WhatsApp Cloud API messages.

---

## Nodes (in order)

### 1. Filter Node (after WhatsApp Webhook only)
**IF node:** Check `{{ $json.entry[0].changes[0].value.messages[0].text.body }}` matches regex `^(solar|domótica|domotica|presentacion|reel).*` (case insensitive).
- Match → pass through with message body
- No match AND from cron → pass through with `{ format: "reel", linea_negocio: "ambas" }`
- No match AND from WhatsApp → send reply "No entendí. Mandame: solar, domótica, presentacion"

### 2. Set Node — Build Brief
Extract the brief from the message or cron default:
```json
{
  "format": "{{ $json.body?.includes('presentacion') ? 'presentacion' : 'reel' }}",
  "linea_negocio": "{{ $json.body?.includes('solar') ? 'solar' : $json.body?.includes('domotica') || $json.body?.includes('domótica') ? 'domotica' : 'ambas' }}",
  "tema_libre": "{{ $json.body ?? '' }}"
}
```

### 3. HTTP Request — POST /brief
- Method: POST
- URL: `{{ $env.AGENT_BASE_URL }}/brief`
- Body: `{{ $json }}` (the brief object)
- Timeout: 300000ms (5 min — keyframe generation takes time)
- Auth: none (internal service)

### 4. Supabase Insert — Log execution
- Operation: Insert
- Table: `workflow_logs` (create if needed: `id SERIAL PK, workflow_name TEXT, status TEXT, metadata JSONB, created_at TIMESTAMPTZ DEFAULT NOW()`)
- Data: `{ workflow_name: "WF-RP-01", status: "brief_sent", metadata: { reel_id: "{{ $json.reel_id }}" } }`

### 5. WhatsApp Send — Notify Carlos
- To: `5491130875304` (Carlos's number)
- Message: `✅ *elan.casa* — Storyboard listo!\n\nTítulo: {{ $json.storyboard.titulo }}\nEscenas: {{ $json.storyboard.scenes_count }}\n\nTe mando las imágenes ahora para que apruebes.`

### 6. Supabase Insert — Store active approval
- Table: `active_approvals`
- Data: `{ phone: "5491130875304", reel_id: "{{ $json.reel_id }}", stage: "gate1" }`
- (Create table if not exists — see Task 12)

### 7. Code Node — Split keyframe URLs into items
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

### 8. WhatsApp Send Image (loop — runs once per item from node 7)
- Send each image as media message
- Caption: `Escena {{ $json.scene_index + 1 }}: {{ $json.scene_titulo }}`

### 9. WhatsApp Send — Instructions
- Message: `Respondé con:\n✅ *OK* para aprobar todas\n❌ *REGEN N* para regenerar escena N (ej: REGEN 3)`

---

## Activation
Toggle workflow to Active after building. Test by sending "solar" to the elan.casa WhatsApp Business number.

## Required env vars in n8n
- `AGENT_BASE_URL` — URL of the Agent SDK EasyPanel service
