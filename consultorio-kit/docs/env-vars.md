# Variables de entorno — Por cliente
> Completar antes de deployar. Configurar en EasyPanel → el servicio n8n → Environment Variables.

---

## WhatsApp Cloud API (Meta)

| Variable | Dónde conseguirla | Ejemplo |
|---|---|---|
| `META_WHATSAPP_TOKEN` | Meta for Developers → App → WhatsApp → API Setup → Temporary/Permanent token | `EAABx...` |
| `WA_PHONE_NUMBER_ID` | Meta for Developers → App → WhatsApp → API Setup → Phone Number ID | `963190063548521` |
| `META_VERIFY_TOKEN` | Lo definís vos (cualquier string secreto) | `mi-token-secreto-2026` |

---

## Supabase

| Variable | Dónde conseguirla |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role (secret) |

---

## n8n

| Variable | Valor |
|---|---|
| `WEBHOOK_URL` | URL base del n8n del cliente (ej: `https://n8n.cliente.com`) |
| `N8N_DASHBOARD_KEY` | Lo definís vos (string secreto para proteger los webhooks del dashboard) |

---

## Vapi (solo si el cliente quiere atención telefónica con IA)

| Variable | Dónde conseguirla |
|---|---|
| `VAPI_SECRET_KEY` | dashboard.vapi.ai → Account → API Keys |

---

## Datos del consultorio / negocio

| Variable | Descripción | Ejemplo |
|---|---|---|
| `CONSULTORIO_NOMBRE` | Nombre del negocio | `Consultorio Médico Dr. López` |
| `CONSULTORIO_DIRECCION` | Dirección completa | `Av. Corrientes 1234, Piso 2, CABA` |
| `CONSULTORIO_TELEFONO` | Teléfono fijo o móvil | `(011) 4555-5678` |
| `CONSULTORIO_MAPS_LINK` | Link directo Google Maps | `https://maps.google.com/?q=...` |
| `CONSULTORIO_HORARIO` | Horario de atención | `Lun-Vie 9:00-18:00, Sab 9:00-13:00` |
| `CONSULTORIO_WA_NUMBER` | Número WhatsApp del bot (con 9 móvil) | `5491155556666` |
| `CONSULTORIO_PRECIO_PARTICULAR` | Precio consulta particular en pesos | `50000` |
| `CONSULTORIO_OBRAS_SOCIALES` | Lista separada por comas | `OSDE,Swiss Medical,IOMA,PAMI,Galeno` |
| `CONSULTORIO_GOOGLE_REVIEWS_URL` | Link reseñas Google (opcional) | `https://g.page/r/...` |
| `RECORDATORIOS_HABILITADOS` | Activar/desactivar recordatorios automáticos (opcional, default: activo) | `false` para desactivar |
| `CONSULTORIO_ADMIN_WA` | Número WhatsApp del médico/admin que recibe el reporte mensual (con 9 móvil) | `5491155556666` |
| `REPORTE_MENSUAL_HABILITADO` | Activar/desactivar reporte mensual automático (opcional, default: activo) | `false` para desactivar |

---

## Checklist post-configuración

- [ ] Variables cargadas en EasyPanel
- [ ] Webhook de Meta apuntando al WF01 del cliente
- [ ] Webhook verificado (GET con verify_token)
- [ ] Schema SQL ejecutado en Supabase
- [ ] Profesionales y horarios cargados en Supabase
- [ ] Templates de WhatsApp aprobados por Meta
- [ ] Test end-to-end con número de prueba
