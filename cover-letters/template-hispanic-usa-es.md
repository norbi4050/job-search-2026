# Template — Empresa hispana USA / LatAm con clientes USA (Español)

**Cuándo usar:** empresas con team manager hispano (Jeeves, Belvo, Tapi, Rappi, MercadoLibre, Pomelo, etc.) o agencias LatAm que pagan en USD.

**Reglas:**
- Reemplazar `{{...}}` con datos específicos
- NO enviar sin personalizar al menos `{{COMPANY}}` y `{{ENGANCHE}}`
- Adjuntar `cv-es.pdf` (o `cv-en.pdf` si la oferta está en inglés)
- Copiar versión enviada a `cover-letters/sent/YYYY-MM-DD-{{empresa}}.md`

---

## Versión email / LinkedIn DM

```
Asunto: Aplicación AI Automation Engineer — n8n · Vapi · Claude

Hola {{NOMBRE_HIRING_MANAGER or "equipo"}},

Soy Carlos, AI Automation Specialist desde Argentina (UTC-3). Vi que {{COMPANY}} {{ENGANCHE — "está creciendo en X" / "publicó búsqueda para Y" / "recién lanzó Z"}} y creo que mi perfil les puede sumar valor concreto.

Lo que aporto:
• n8n: workflows en producción hoy (captura y calificación de leads, integraciones CRM, multi-agent orchestration)
• Vapi voice agents en producción (Vapi + ElevenLabs + Twilio + Claude)
• Plataforma WhatsApp multi-bot con NLP routing
• 11+ años de gestión operacional antes de IA — entiendo el proceso de negocio detrás del workflow

Referencias rápidas:
→ Caso de estudio: {{LINK al case study publicado}}
→ Agencia: nexo-terra.com.ar
→ Marketplace solo (400+ propiedades): misionesarrienda.com.ar

Idiomas: español nativo · inglés intermedio (B2 — escritura fluida, conversación funcional). Disponible full-time remoto, zona horaria UTC-3 (compatible con USA).

CV adjunto. Quedo atento a vuestro feedback.

Saludos,
Carlos Norberto Gonzalez Archilla
linkedin.com/in/carlos-norberto-gonzalez-archilla
cgonzalezarchilla@gmail.com
```

## Versión formulario web corta

```
Carlos Norberto Gonzalez Archilla — AI Automation Specialist desde Argentina.

Co-founder de Nexo-Terra Automation, construyendo soluciones end-to-end para PyMEs con n8n, Vapi voice AI, Claude y OpenAI.

Shippeado recientemente: voice agent 24/7 con calificación automática de leads y CRM routing (Vapi+ElevenLabs+Twilio+Claude); plataforma WhatsApp multi-bot con NLP routing; orquestación multi-agente en n8n con self-healing; misionesarrienda.com.ar (marketplace 400+ propiedades, sole builder).

Background: 11+ años en gestión operacional (restaurante, solar Australia, franquicia educativa). Inglés B2 certificado, 3 años en Australia. Remote full-time, inicio inmediato.
```

---

## Variables a personalizar

- [ ] `{{NOMBRE_HIRING_MANAGER}}` — buscar en LinkedIn
- [ ] `{{COMPANY}}` — nombre exacto
- [ ] `{{ENGANCHE}}` — UNA cosa concreta y reciente
- [ ] `{{LINK al case study}}` — URL del case study publicado

**Tiempo de personalización: máximo 3 minutos.**
