# WF-RP-04 — Publisher (Gate 2)

**Trigger:** WhatsApp Webhook — POST `/webhook/rp-approval-gate2`

This workflow fires when Carlos replies to the final video approval message.

---

## Nodes (in order)

### 1. Code Node — Parse Carlos's reply
```javascript
const body = $input.first().json.entry[0].changes[0].value.messages[0].text.body.trim().toUpperCase();
return [{ json: { action: body === 'OK' ? 'publish' : 'reject', phone: '5491130875304' } }];
```

### 2. Supabase Select — Get active reel
- Table: `active_approvals`
- Filter: `phone = '5491130875304'` AND `stage = 'gate2'`
- Returns: `reel_id`

### 3. Supabase Select — Get reel details
- Table: `reels`
- Filter: `id = {{ $json.reel_id }}`
- Select: `assembled_url, caption, hashtags`

### 4. IF Node — Branch on action

---

#### Branch: publish (action === 'publish')

**Node 4a. HTTP Request — Create Instagram media container**
- Method: POST
- URL: `https://graph.facebook.com/v21.0/{{ $env.ELAN_IG_USER_ID }}/media`
- Body:
  ```json
  {
    "media_type": "REELS",
    "video_url": "{{ assembled_url }}",
    "caption": "{{ caption }} {{ hashtags }}",
    "access_token": "{{ $env.ELAN_INSTAGRAM_ACCESS_TOKEN }}"
  }
  ```
- Wait 30 seconds for IG to process the video container before publishing.

**Node 4b. HTTP Request — Publish media container**
- Method: POST
- URL: `https://graph.facebook.com/v21.0/{{ $env.ELAN_IG_USER_ID }}/media_publish`
- Body:
  ```json
  {
    "creation_id": "{{ $json.id }}",
    "access_token": "{{ $env.ELAN_INSTAGRAM_ACCESS_TOKEN }}"
  }
  ```

**Node 4c. Supabase Update — Mark as PUBLISHED**
- Table: `reels`
- Filter: `id = {{ reel_id }}`
- Data: `{ status: 'PUBLISHED', ig_post_id: "{{ published_creation_id }}", ig_post_url: "https://www.instagram.com/reel/{{ $json.id }}", updated_at: NOW() }`

**Node 4d. Supabase Delete — Clear approval state**
- Table: `active_approvals`
- Filter: `phone = '5491130875304'`

**Node 4e. WhatsApp Send — Confirm publication**
- To: `5491130875304`
- Message: `✅ Reel publicado en @elan.casa 🚀\nhttps://www.instagram.com/reel/{{ $json.id }}`

---

#### Branch: reject (action !== 'publish')

**Node 4f. Supabase Update — Mark as ERROR**
- Table: `reels`
- Filter: `id = {{ reel_id }}`
- Data: `{ status: 'ERROR', error_detail: 'rejected_at_gate2', updated_at: NOW() }`

**Node 4g. Supabase Delete — Clear approval state**
- Table: `active_approvals`
- Filter: `phone = '5491130875304'`

**Node 4h. WhatsApp Send — Confirm rejection**
- To: `5491130875304`
- Message: `❌ Reel descartado. El pipeline está listo para el próximo cuando quieras.`

---

## Required env vars in n8n
- `ELAN_IG_USER_ID` — elan.casa Instagram Business User ID
- `ELAN_INSTAGRAM_ACCESS_TOKEN` — Long-lived Instagram Graph API token
- `AGENT_BASE_URL` — Agent SDK URL

## Getting Instagram credentials
1. Create Meta Developer App at developers.facebook.com
2. Add Instagram Graph API product
3. Create Instagram Business account @elan.casa
4. Get User ID: `GET https://graph.facebook.com/v21.0/me?access_token={token}`
5. Generate long-lived token (60-day expiry) — set up cron refresh before expiry
