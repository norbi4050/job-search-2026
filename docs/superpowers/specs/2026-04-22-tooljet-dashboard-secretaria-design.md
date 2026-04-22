# Tooljet Dashboard — Secretaria y Médicos (Consultorio Inteligente)

**Fecha**: 2026-04-22  
**Autor**: Carlos Norberto González Archilla  
**Proyecto**: Consultorio Inteligente (demo Nexo Terra)  
**Modelo de entrega**: Agencia (por cliente, self-hosted en EasyPanel del cliente)

---

## 1. Contexto

El sistema de reservas del Consultorio Inteligente tiene bot WhatsApp (WF02) y página de selección de turnos (WF08), pero no hay una interfaz interna para que la secretaria o los médicos vean la agenda en tiempo real, gestionen turnos ni atiendan escalaciones.

Este spec cubre el dashboard interno construido en Tooljet self-hosted.

---

## 2. Scope

**Incluye:**
- Instalación de Tooljet en EasyPanel del cliente (mismo servidor que n8n)
- PostgreSQL dedicado para datos internos de Tooljet
- Conexión directa Tooljet → Supabase REST API (service_key, server-side)
- Auth por usuario con roles: Secretaria y Médico
- Vista lista del día (turnos de hoy ordenados por hora)
- Vista calendario semanal
- Vista handoffs pendientes (solo Secretaria)
- Acciones: cancelar turno, marcar atendido, marcar no-show, crear turno manual, generar link WF08
- Nuevo workflow n8n WF-DASH con endpoints autenticados para acciones con efecto WhatsApp
- Tabla Supabase `dashboard_usuarios` para mapeo email → profesional_id

**No incluye:**
- App mobile nativa (Tooljet responsive cubre el caso del médico en celular)
- Historial de auditoría de cambios
- Reportes o analytics
- Gestión de horarios de profesionales (se hace directamente en Supabase por ahora)
- Integración con agenda externa (Google Calendar del médico)

---

## 3. Arquitectura

```
EasyPanel (por cliente)
├── n8n               (existente — WF01-WF10)
├── Tooljet           (nuevo — dashboard interno)
├── PostgreSQL        (nuevo — datos internos de Tooljet solamente)
└── Supabase cloud    (existente, externo — fuente de verdad)

Tooljet
├── Lee Supabase REST directamente (queries server-side, service_key nunca llega al browser)
├── Para acciones con efecto WhatsApp → POST a WF-DASH (n8n)
└── Auth nativo Tooljet (usuarios + grupos/roles)

WF-DASH (nuevo workflow n8n)
├── Header obligatorio: X-Dashboard-Key: <secret>
├── POST /cancelar-turno   → PATCH Supabase + sendCTAUrl WhatsApp paciente
├── POST /generar-link     → crea bookingToken en conversación → devuelve URL WF08
└── POST /crear-paciente   → INSERT consultorio_pacientes si paciente nuevo
```

---

## 4. Auth y Roles

**Grupos en Tooljet:**
- **Secretaria**: acceso completo — todas las vistas y todas las acciones
- **Médico**: acceso restringido — solo sus propios turnos, sin vista de handoffs, sin crear/cancelar (solo lectura de agenda)

**Mapeo email → profesional_id:**
Tabla nueva en Supabase: `dashboard_usuarios`

| Campo | Tipo | Descripción |
|---|---|---|
| `email` | text (PK) | Email del usuario en Tooljet |
| `profesional_id` | integer | FK → `consultorio_profesionales.id` |
| `rol` | text | `'secretaria'` o `'medico'` |

Al cargar la app, Tooljet hace una query por `globals.currentUser.email` y guarda `profesional_id` y `rol` en variables de sesión. El filtro de turnos del médico usa esa variable.

**URL de acceso:** `https://dashboard.<dominio-cliente>.com` con HTTPS via Let's Encrypt (EasyPanel lo maneja automático).

---

## 5. Vistas

### 5.1 Lista del día (pantalla principal)

- Tabla con turnos de hoy ordenados por hora ASC
- Columnas: Hora · Paciente · Profesional · Obra Social / Particular · Estado (badge color) · Acciones
- Filtro por profesional visible solo para Secretaria
- Auto-refresh silencioso cada 30 segundos
- Médico: tabla pre-filtrada por su `profesional_id`, sin selector de profesional

**Colores de estado:**
| Estado | Color |
|---|---|
| agendado | Azul |
| atendido | Verde |
| no_show | Naranja |
| cancelado | Gris |

### 5.2 Calendario semanal

- Componente calendario de Tooljet, vista semana
- Click en turno → panel lateral con detalle + botones de acción
- Navegación anterior / siguiente semana
- Médico: solo sus turnos

### 5.3 Handoffs pendientes (solo Secretaria)

- Badge en el menú con contador si `handoff_humano = true` en alguna conversación
- Tabla: Paciente · Teléfono · Tiempo esperando · Botón "Marcar atendido"
- "Marcar atendido" → PATCH `consultorio_conversaciones` → `handoff_humano: false`

### 5.4 Navegación

Barra lateral izquierda: **Hoy** · **Semana** · **Handoffs** (con badge, solo Secretaria).

---

## 6. Acciones

### 6.1 Cancelar turno

1. Botón "Cancelar" en fila o panel lateral
2. Modal de confirmación: nombre del paciente, fecha/hora, campo de motivo (opcional)
3. POST WF-DASH `/cancelar-turno` → `{ turno_id, motivo }`
4. n8n: PATCH `consultorio_turnos` estado → `cancelado` + `sendCTAUrl` WhatsApp al paciente
5. Respuesta: `{ ok: true, wa_sent: true/false }`
6. Si `wa_sent: false` → badge rojo en la fila "Notificación no enviada"

### 6.2 Marcar atendido / no-show

- Botones directos, sin modal
- PATCH Supabase desde Tooljet: `estado: 'atendido'` o `estado: 'no_show'`
- Sin efecto WhatsApp

### 6.3 Crear turno manual — formulario directo

Botón "Nuevo turno" en encabezado. Formulario en dos pasos:

**Paso 1 — Paciente:**
- Campo teléfono → query `consultorio_pacientes` por `telefono_wa`
- Si existe: autocompleta nombre, obra social
- Si no existe: campos para crear (nombre completo, teléfono, obra social opcional) → POST WF-DASH `/crear-paciente`

**Paso 2 — Turno:**
- Dropdown profesional
- Date picker + selector de hora → valida contra `consultorio_horarios_profesional` y verifica slot libre en `consultorio_turnos`
- Tipo de pago (obra social / particular)
- Confirmar → INSERT `consultorio_turnos`

### 6.4 Crear turno manual — generar link WF08

Botón alternativo "Generar link" en el mismo modal de nuevo turno.
- Campos: teléfono del paciente + profesional
- POST WF-DASH `/generar-link` → crea/actualiza `consultorio_conversaciones` con `bookingToken` en contexto
- Tooljet muestra la URL con botón "Copiar"
- La secretaria la manda manualmente al paciente por WhatsApp

---

## 7. WF-DASH — Diseño del workflow n8n

**Trigger:** 3 webhooks distintos en el mismo workflow n8n, cada uno con su path.  
**Autenticación:** Primer nodo de cada rama valida header `X-Dashboard-Key` contra variable de entorno `DASHBOARD_SECRET`. Si falla → responde 401 y termina.

### `/cancelar-turno`
```
body: { action: "cancelar-turno", turno_id, motivo? }
→ PATCH consultorio_turnos { estado: "cancelado" } WHERE id = turno_id
→ GET paciente + turno para construir mensaje
→ sendCTAUrl(telefono_wa, mensaje_cancelacion, "Ver disponibilidad", url_wf08)
→ responde { ok: true, wa_sent: true/false }
```

### `/generar-link`
```
body: { action: "generar-link", telefono_wa, profesional_id }
→ GET consultorio_conversaciones WHERE telefono_wa
→ Si no existe: INSERT conversación con estado "inicio" y contexto vacío
→ PATCH contexto: { bookingToken: uuid(), profesionalId: profesional_id }
→ responde { ok: true, url: "https://<host>/webhook/consultorio-turnos?token=<token>" }
```

### `/crear-paciente`
```
body: { action: "crear-paciente", nombre, telefono_wa, obra_social? }
→ INSERT consultorio_pacientes
→ responde { ok: true, paciente_id }
```

---

## 8. Timezones

- Supabase almacena timestamps en UTC
- Tooljet usa la función JS `new Date(ts).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })` en todas las columnas de fecha
- El date picker del formulario manual convierte la selección local a ISO UTC antes de insertar

---

## 9. Riesgos y mitigaciones

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Tooljet sin PostgreSQL propio | 🔴 Crítico | Agregar servicio PostgreSQL en EasyPanel antes de instalar Tooljet |
| WF-DASH sin auth | 🔴 Crítico | Validar `X-Dashboard-Key` en el primer nodo del workflow; 401 si falla |
| bookingToken para paciente sin conversación | 🔴 Crítico | WF-DASH `/generar-link` crea conversación dummy si no existe |
| Filtro médico mal mapeado | 🔴 Crítico | Testear con usuario médico antes de dar acceso a producción |
| Sin real-time nativo | 🟡 Medio | Auto-refresh 30s en todas las tablas |
| Timezone incorrecta | 🟡 Medio | Conversión explícita en todas las columnas de fecha |
| Slot duplicado en turno manual | 🟡 Medio | Query de verificación antes del INSERT |
| Paciente nuevo no encontrado | 🟡 Medio | Flujo de creación inline en el formulario |
| Versión Tooljet sin pinear | 🟢 Bajo | Fijar imagen Docker: `tooljet/tooljet:EE-LTS` o versión específica estable |
| WhatsApp falla en cancelación | 🟢 Bajo | Loguear y mostrar badge "notificación no enviada" en la fila |

---

## 10. Nuevos objetos en Supabase

### Tabla `dashboard_usuarios`
```sql
CREATE TABLE dashboard_usuarios (
  email       TEXT PRIMARY KEY,
  profesional_id INTEGER REFERENCES consultorio_profesionales(id),
  rol         TEXT NOT NULL CHECK (rol IN ('secretaria', 'medico'))
);
```

### Columna `estado` extendida en `consultorio_turnos`
Agregar valores `'atendido'` y `'no_show'` al CHECK constraint si no existen.

---

## 11. Orden de implementación sugerido

1. Infraestructura: PostgreSQL + Tooljet en EasyPanel, dominio custom
2. Supabase: crear `dashboard_usuarios`, verificar columnas de estado
3. n8n: crear WF-DASH con los 3 endpoints
4. Tooljet: datasources (Supabase + WF-DASH webhook)
5. Tooljet: auth — crear usuarios, grupos, mapeo email→profesional_id
6. Tooljet: Vista "Hoy" (lista del día)
7. Tooljet: Vista "Semana" (calendario)
8. Tooljet: Vista "Handoffs"
9. Tooljet: Modal "Nuevo turno" (formulario + generar link)
10. Testing con rol Secretaria y rol Médico
11. Dominio custom + revisión final
