# Setup Checklist — Nuevo Cliente
> Seguir en orden. Tiempo estimado: 45-60 minutos.

---

## Paso 1 — Supabase (10 min)

- [ ] Crear cuenta Supabase a nombre del cliente (email del cliente)
- [ ] Crear nuevo proyecto (región: South America - São Paulo)
- [ ] SQL Editor → pegar contenido de `supabase/schema.sql` → Run
- [ ] Cargar profesionales en `consultorio_profesionales`
- [ ] Cargar horarios en `consultorio_horarios_profesional`
- [ ] Copiar: Project URL → `SUPABASE_URL`
- [ ] Copiar: service_role key → `SUPABASE_SERVICE_KEY`

---

## Paso 2 — Hosting n8n (10 min)

- [ ] Crear instancia EasyPanel / Hostinger con n8n
- [ ] Configurar variables de infraestructura en EasyPanel → Environment:
  - [ ] `META_WHATSAPP_TOKEN` — token permanente de Meta
  - [ ] `WA_PHONE_NUMBER_ID` — Phone Number ID de Meta
  - [ ] `META_VERIFY_TOKEN` — string secreto para verificar webhook
  - [ ] `SUPABASE_URL` — del paso anterior
  - [ ] `SUPABASE_SERVICE_KEY` — del paso anterior
  - [ ] `WEBHOOK_URL` — URL base del n8n del cliente
  - [ ] `N8N_DASHBOARD_KEY` — string secreto para proteger webhooks del dashboard
- [ ] Configurar variables del consultorio en EasyPanel → Environment:
  - [ ] `CONSULTORIO_NOMBRE` — ej: `Consultorio Médico Dr. López`
  - [ ] `CONSULTORIO_DIRECCION` — ej: `Av. Corrientes 1234, Piso 2, CABA`
  - [ ] `CONSULTORIO_TELEFONO` — ej: `(011) 4555-5678`
  - [ ] `CONSULTORIO_MAPS_LINK` — link Google Maps directo
  - [ ] `CONSULTORIO_HORARIO` — ej: `Lun-Vie 9:00-18:00, Sab 9:00-13:00`
  - [ ] `CONSULTORIO_WA_NUMBER` — número WhatsApp con 9 móvil: `549XXXXXXXXXX`
  - [ ] `CONSULTORIO_PRECIO_PARTICULAR` — solo el número, ej: `50000`
  - [ ] `CONSULTORIO_OBRAS_SOCIALES` — separadas por coma: `OSDE,IOMA,PAMI,Galeno`
  - [ ] `CONSULTORIO_GOOGLE_REVIEWS_URL` — link reseñas Google (opcional)
  - [ ] `CONSULTORIO_ADMIN_WA` — número WhatsApp médico/admin con 9 móvil: `549XXXXXXXXXX`
- [ ] Reiniciar n8n después de cargar las variables
- [ ] Verificar que n8n levanta correctamente

---

## Paso 3 — Importar workflows n8n (10 min)

- [ ] Importar `WF01-gateway-whatsapp.json`
- [ ] Importar `WF02-bot-conversacional.json`
- [ ] Importar `WF03-recordatorios.json`
- [ ] Importar `WF04-checkin-web.json`
- [ ] Importar `WF05-handoff-telegram.json`
- [ ] Importar `WF06-post-consulta.json`
- [ ] Importar `WF07-waitlist-inteligente.json`
- [ ] Importar `WF08-selector-turnos-web.json`
- [ ] Importar `WF09-vapi-tool-calls.json` (solo si tiene Vapi)
- [ ] Importar `WF10-cron-cierre-handoff.json`
- [ ] Importar `WF-REMINDER-recordatorios.json`
- [ ] Importar `WF-DASH-1-cancelar-turno.json`
- [ ] Importar `WF-DASH-2-generar-link.json`
- [ ] Importar `WF-DASH-3-crear-paciente.json`
- [ ] Importar `WF-DASH-4-reset-conversacion.json`
- [ ] Importar `WF-MONTHLY-REPORT.json`
- [ ] Actualizar bloque CONSULTORIO en WF09 con datos del cliente
- [ ] Activar todos los workflows

---

## Paso 4 — WhatsApp Business (10 min)

- [ ] Crear cuenta Meta Business Manager del cliente
- [ ] Agregar número de WhatsApp Business
- [ ] Crear app en Meta for Developers → WhatsApp
- [ ] Configurar webhook → URL del WF01 + verify_token
- [ ] Verificar webhook (debe responder 200 al GET de Meta)
- [ ] Copiar Phone Number ID → variable `WA_PHONE_NUMBER_ID`
- [ ] Generar token permanente → variable `META_WHATSAPP_TOKEN`

---

## Paso 5 — Templates WhatsApp (variable — 1-3 días para aprobación)

- [ ] Crear template `turno_booking` (categoría: Utilidad)
- [ ] Crear template `turno_recordatorio` (categoría: Utilidad)
- [ ] Crear template `turno_cancelacion` (categoría: Utilidad)
- [ ] Crear template `reporte_mensual` (categoría: Utilidad)
- [ ] Esperar aprobación de Meta
- [ ] Verificar que los templates llegan con número formato `549XXXXXXXXXX`

---

## Paso 6 — Tooljet Dashboard (10 min)

- [ ] Importar app secretaria desde `tooljet/secretaria-app.json`
- [ ] Actualizar componente `supabaseKey` con el service_role del cliente
- [ ] Actualizar URLs de Supabase en los queries RunJS
- [ ] Probar que carga datos reales
- [ ] Importar app médicos desde `tooljet/medico-app.json` (si aplica)

---

## Paso 7 — Test end-to-end (10 min)

- [ ] Enviar "Hola" al número del cliente desde número de prueba
- [ ] Completar flujo de agendado hasta confirmación
- [ ] Verificar que el turno aparece en Tooljet
- [ ] Verificar que el template de booking llega correctamente
- [ ] Probar cancelación desde Tooljet
- [ ] Probar reset de conversación (si está implementado)

---

## Post-setup

- [ ] Configurar Uptime Robot para el webhook de n8n
- [ ] Verificar canal de alertas Telegram activo
- [ ] Entregar accesos al cliente (Supabase, Tooljet, n8n)
- [ ] Capacitación secretaria (30 min): dashboard + cómo manejar handoffs

---

## Dashboard Web Profesional (reemplaza Tooljet)

### Pre-requisitos Supabase
- [ ] Ejecutar SQL de `consultorio_mensajes` + RLS + Realtime (ver `supabase/schema.sql`)
- [ ] Crear usuario dueño en Supabase Auth → Authentication → Users → Invite
  - Email: `admin@<consultorio>.com`
  - Luego en SQL Editor: `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"role": "dueno"}'::jsonb WHERE email = 'admin@<consultorio>.com';`
- [ ] Crear usuario secretaria con `{"role": "secretaria"}`
- [ ] (Opcional) Crear usuario médico con `{"role": "medico", "profesional_id": "<UUID del profesional>"}`

### Deploy en EasyPanel
- [ ] Crear servicio App → From Source → apuntar a `consultorio-kit/dashboard/` (Dockerfile incluido)
- [ ] Configurar env vars (ver `dashboard/.env.example`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `N8N_WEBHOOK_BASE`
  - `N8N_DASHBOARD_KEY`
  - `NEXT_PUBLIC_CONSULTORIO_NOMBRE`
  - `CONSULTORIO_VALOR_CONSULTA` (en ARS, para cálculo ROI)
  - `CONSULTORIO_COSTO_MENSUAL` (en ARS, para cálculo ROI)
- [ ] Asignar dominio y puerto 3000
- [ ] Deploy → verificar build exitoso

### Post-deploy: verificar tabs
- [ ] Login como dueño → todos los tabs accesibles
- [ ] Login como secretaria → Hoy, Semana, Atenciones, Pacientes (sin En vivo ni Analytics)
- [ ] Login como médico → solo Hoy y Semana filtrados por sus turnos
- [ ] Tab Atenciones: enviar mensaje de prueba desde la UI → verificar que llega por WhatsApp

### n8n: WF-DASH-4 Responder Handoff
- [ ] Importar `consultorio-kit/n8n/WF-DASH-4-responder-handoff.json` en n8n
- [ ] Crear credencial "Dashboard Header Auth" con el valor de `N8N_DASHBOARD_KEY`
- [ ] Activar WF-DASH-4

### Tab En vivo (requiere parche WF01/WF02)
- [ ] WF01 nodo "3. Extraer Mensaje": agregar INSERT a `consultorio_mensajes` (ver plan `docs/superpowers/plans/2026-05-14-dashboard-profesional.md` Task 7)
- [ ] WF02 función `sendText`: agregar INSERT a `consultorio_mensajes` (idem)
- [ ] Verificar: enviar mensaje al bot → aparece en tiempo real en el tab En vivo
