-- ============================================================
-- Consultorio Inteligente — Schema Supabase
-- Ejecutar en: Supabase → SQL Editor → New Query → Run
-- ============================================================

-- Pacientes
CREATE TABLE IF NOT EXISTS consultorio_pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT,
  telefono_wa TEXT UNIQUE NOT NULL,
  dni TEXT,
  obra_social TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversaciones (estado del bot por paciente)
CREATE TABLE IF NOT EXISTS consultorio_conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono_wa TEXT UNIQUE NOT NULL,
  estado TEXT DEFAULT 'inicio',
  contexto JSONB DEFAULT '{}',
  handoff_humano BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profesionales / prestadores de servicio
CREATE TABLE IF NOT EXISTS consultorio_profesionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  especialidad TEXT NOT NULL,
  consultorio TEXT,
  duracion_turno_min INTEGER DEFAULT 30,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Horarios por profesional
CREATE TABLE IF NOT EXISTS consultorio_horarios_profesional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_id UUID REFERENCES consultorio_profesionales(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 1=Lun...6=Sab
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL
);

-- Turnos
CREATE TABLE IF NOT EXISTS consultorio_turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES consultorio_pacientes(id) ON DELETE SET NULL,
  profesional_id UUID REFERENCES consultorio_profesionales(id) ON DELETE SET NULL,
  fecha_hora TIMESTAMPTZ NOT NULL,
  estado TEXT DEFAULT 'agendado', -- agendado, confirmado, cancelado, completado
  tipo_pago TEXT, -- obra_social, particular, etc.
  obra_social TEXT,
  booking_token TEXT UNIQUE,
  recordatorio_enviado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lista de espera
CREATE TABLE IF NOT EXISTS consultorio_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES consultorio_pacientes(id) ON DELETE CASCADE,
  profesional_id UUID REFERENCES consultorio_profesionales(id) ON DELETE CASCADE,
  especialidad TEXT,
  fecha_solicitada DATE,
  estado TEXT DEFAULT 'activo', -- activo, notificado, cancelado
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback post-consulta
CREATE TABLE IF NOT EXISTS consultorio_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES consultorio_pacientes(id) ON DELETE SET NULL,
  turno_id UUID REFERENCES consultorio_turnos(id) ON DELETE SET NULL,
  puntaje INTEGER CHECK (puntaje BETWEEN 1 AND 5),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_conversaciones_telefono ON consultorio_conversaciones(telefono_wa);
CREATE INDEX IF NOT EXISTS idx_pacientes_telefono ON consultorio_pacientes(telefono_wa);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON consultorio_turnos(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_turnos_profesional ON consultorio_turnos(profesional_id);
CREATE INDEX IF NOT EXISTS idx_turnos_estado ON consultorio_turnos(estado);
CREATE INDEX IF NOT EXISTS idx_turnos_token ON consultorio_turnos(booking_token);

-- ============================================================
-- Sistema de Adelanto de Turnos (v2026-05-13)
-- ============================================================

-- Columna opt-out en turnos (DEFAULT TRUE = opt-in)
ALTER TABLE consultorio_turnos
  ADD COLUMN IF NOT EXISTS quiere_adelanto BOOLEAN DEFAULT TRUE;

-- Historial de ofertas de adelanto
CREATE TABLE IF NOT EXISTS consultorio_adelanto_ofertas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_fecha      TIMESTAMPTZ NOT NULL,
  profesional_id  UUID REFERENCES consultorio_profesionales(id),
  turno_origen_id UUID REFERENCES consultorio_turnos(id),
  intento         INTEGER DEFAULT 1,
  estado          TEXT DEFAULT 'pendiente', -- pendiente, aceptado, rechazado, expirado, cancelado
  oferta_at       TIMESTAMPTZ DEFAULT NOW(),
  expira_at       TIMESTAMPTZ,
  respuesta_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adelanto_estado ON consultorio_adelanto_ofertas(estado);
CREATE INDEX IF NOT EXISTS idx_adelanto_expira  ON consultorio_adelanto_ofertas(expira_at);
CREATE INDEX IF NOT EXISTS idx_adelanto_slot    ON consultorio_adelanto_ofertas(slot_fecha, profesional_id);

-- ============================================================
-- Dashboard Profesional (v2026-05-14)
-- ============================================================

-- Mensajes para tab "Conversaciones en vivo"
CREATE TABLE IF NOT EXISTS consultorio_mensajes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono_wa TEXT NOT NULL,
  direccion   TEXT NOT NULL CHECK (direccion IN ('entrada', 'salida')),
  contenido   TEXT NOT NULL,
  estado_bot  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_telefono
  ON consultorio_mensajes(telefono_wa, created_at DESC);

-- RLS — permite lectura a usuarios autenticados del dashboard
ALTER TABLE consultorio_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultorio_adelanto_ofertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_read_turnos" ON consultorio_turnos FOR SELECT TO authenticated USING (true);
CREATE POLICY "dashboard_read_pacientes" ON consultorio_pacientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "dashboard_update_pacientes" ON consultorio_pacientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dashboard_read_profesionales" ON consultorio_profesionales FOR SELECT TO authenticated USING (true);
CREATE POLICY "dashboard_read_conversaciones" ON consultorio_conversaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "dashboard_read_mensajes" ON consultorio_mensajes FOR SELECT TO authenticated USING (true);
CREATE POLICY "dashboard_read_adelanto" ON consultorio_adelanto_ofertas FOR SELECT TO authenticated USING (true);

-- Realtime para las tablas que el dashboard escucha en vivo
ALTER PUBLICATION supabase_realtime ADD TABLE consultorio_turnos;
ALTER PUBLICATION supabase_realtime ADD TABLE consultorio_conversaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE consultorio_mensajes;
