// ============================================================
// WF-02: BOT CONVERSACIONAL — Consultorio Inteligente
// Fase 1 + Fase 2 (cancelacion, reprogramacion, reminder handler)
// + Modelo hibrido: sentiment analysis + escalamiento graduado
// ============================================================

const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = $env.ANTHROPIC_API_KEY;
const WA_TOKEN = $env.META_WHATSAPP_TOKEN;
const PHONE_ID = $env.WA_PHONE_NUMBER_ID;

const GOOGLE_REVIEWS_URL = $env.CONSULTORIO_GOOGLE_REVIEWS_URL || '';

const TG_BOT_TOKEN = '8736535917:AAEgHkDacG5kPaKSGIJa4dR0XjJNhIkaX0U';
const TG_CHAT_ID = '6343825256';

async function alertTelegram(msg) {
  try {
    await helpers.httpRequest({
      method: 'POST',
      url: `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: `🚨 WF02 ERROR\n${msg}`, parse_mode: 'HTML' })
    });
  } catch(e) {}
}
async function notifyTelegram(msg) {
  try {
    await helpers.httpRequest({
      method: 'POST',
      url: `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'HTML' })
    });
  } catch(e) {}
}

const CONSULTORIO = {
  nombre: $env.CONSULTORIO_NOMBRE || 'Consultorio',
  direccion: $env.CONSULTORIO_DIRECCION || '',
  mapsLink: $env.CONSULTORIO_MAPS_LINK || '',
  horario: $env.CONSULTORIO_HORARIO || '',
  telefono: $env.CONSULTORIO_TELEFONO || '',
  obrasociales: ($env.CONSULTORIO_OBRAS_SOCIALES || '').split(',').map(s => s.trim()).filter(Boolean),
  precioParticular: parseInt($env.CONSULTORIO_PRECIO_PARTICULAR || '0', 10)
};
const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DIAS_VERIFICACION = 90;

async function supaGet(table, params) {
  try { return await helpers.httpRequest({ method: 'GET', url: `${SUPABASE_URL}/rest/v1/${table}`, qs: params || {}, headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }); }
  catch (e) { return []; }
}
async function supaInsert(table, data) {
  try { return await helpers.httpRequest({ method: 'POST', url: `${SUPABASE_URL}/rest/v1/${table}`, headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(data) }); }
  catch (e) { return []; }
}
async function supaUpdate(table, filters, data) {
  try { await helpers.httpRequest({ method: 'PATCH', url: `${SUPABASE_URL}/rest/v1/${table}`, qs: filters, headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }) }); }
  catch (e) {}
}
async function updateConv(phone, estado, contexto) {
  const d = { estado, updated_at: new Date().toISOString() };
  if (contexto !== undefined) d.contexto = contexto;
  await supaUpdate('consultorio_conversaciones', { telefono_wa: `eq.${phone}` }, d);
}

async function sendText(phone, text) {
  await helpers.httpRequest({ method: 'POST', url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } }) });
}
async function sendButtons(phone, text, buttons) {
  await helpers.httpRequest({ method: 'POST', url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: { type: 'button', body: { text }, action: { buttons: buttons.slice(0,3).map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.substring(0,20) } })) } } }) });
}
async function sendList(phone, text, buttonText, sections) {
  // WhatsApp Cloud API: máximo 10 rows TOTALES en toda la lista. Clamp defensivo.
  let total = 0;
  const clamped = [];
  for (const s of sections) {
    const remaining = 10 - total;
    if (remaining <= 0) break;
    const rows = (s.rows || []).slice(0, remaining).map(r => ({
      ...r,
      title: String(r.title || '').substring(0, 24),
      description: r.description ? String(r.description).substring(0, 72) : r.description
    }));
    if (rows.length > 0) {
      clamped.push({ title: String(s.title || '').substring(0, 24), rows });
      total += rows.length;
    }
  }
  await helpers.httpRequest({ method: 'POST', url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: { type: 'list', body: { text }, action: { button: buttonText.substring(0,20), sections: clamped } } }) });
}
async function sendCTAUrl(phone, text, buttonText, url) {
  await helpers.httpRequest({
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
    headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text },
        action: { name: 'cta_url', parameters: { display_text: buttonText.substring(0, 20), url } }
      }
    })
  });
}

async function triggerWaitlist(profId) {
  const waiters = await supaGet('consultorio_waitlist', { profesional_id: `eq.${profId}`, notificado: 'eq.false', select: 'id,paciente_id', order: 'created_at.asc', limit: '1' });
  if (!waiters?.length) return;
  const w = waiters[0];
  const wPac = await supaGet('consultorio_pacientes', { id: `eq.${w.paciente_id}`, select: 'nombre,telefono_wa' });
  const wProf = await supaGet('consultorio_profesionales', { id: `eq.${profId}`, select: 'nombre,especialidad' });
  if (!wPac?.[0]) return;
  await supaUpdate('consultorio_waitlist', { id: `eq.${w.id}` }, { notificado: true });
  const bToken = Date.now().toString(36) + Math.random().toString(36).substring(2);
  const N8N_BASE = $env.WEBHOOK_URL || $env.N8N_HOST || '';
  const bUrl = `${N8N_BASE}/webhook/consultorio-turnos?token=${bToken}`;
  await supaUpdate('consultorio_conversaciones', { telefono_wa: `eq.${wPac[0].telefono_wa}` }, { estado: 'esperando_booking_web', contexto: { pacienteId: w.paciente_id, pacienteNombre: wPac[0].nombre, profesionalId: profId, profesionalNombre: wProf?.[0]?.nombre||'', especialidad: wProf?.[0]?.especialidad||'', bookingToken: bToken } });
  await sendCTAUrl(wPac[0].telefono_wa,
    `¡Hola ${wPac[0].nombre.split(' ')[0]}! 🎉\n\nSe liberó un turno con ${wProf?.[0]?.nombre||'el profesional'} (${wProf?.[0]?.especialidad||''}).\n\n¡Apurate que se puede ocupar!\n\n📱 Si el botón no abre, entrá desde acá:\n${bUrl}`,
    'Ver turno libre',
    bUrl);
}

async function triggerAdelanto(slotFecha, profId, pacienteId) {
  const N8N_HOST = $env.N8N_HOST || $env.WEBHOOK_URL || '';
  if (!N8N_HOST || !slotFecha || !profId) return;
  try {
    await this.helpers.httpRequest({
      method: 'POST',
      url: `${N8N_HOST}/webhook/adelanto-buscar`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_fecha: slotFecha, profesional_id: profId, intento: 1, excluir_pacientes: pacienteId ? [pacienteId] : [] })
    });
  } catch(e) {}
}

async function askClaude(sys, msg) {
  try {
    const r = await helpers.httpRequest({ method: 'POST', url: 'https://api.anthropic.com/v1/messages', headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, temperature: 0.1, system: sys, messages: [{ role: 'user', content: msg }] }) });
    return (r?.content?.[0]?.text || '').trim();
  } catch (e) { return ''; }
}

async function classifyInput(texto, estadoActual) {
  try {
    const r = await askClaude(
      `Sos un clasificador para un sistema de turnos medicos. El paciente esta en el paso "${estadoActual}".\nAnaliza su mensaje y responde SOLO con JSON valido (sin markdown):\n{"intent":"turno|cancelar|consultar|recepcion|pregunta|otro","sentiment":"ok|confundido|frustrado","confidence":"alta|baja"}\n- intent: que quiere hacer (turno=sacar turno, cancelar=cancelar/cambiar, consultar=ver turnos, recepcion=hablar con humano, pregunta=pregunta general, otro=no se entiende)\n- sentiment: "ok" si esta tranquilo, "confundido" si no entiende el proceso, "frustrado" si esta molesto/enojado/impaciente\n- confidence: "alta" si entendes claro que quiere, "baja" si el mensaje es ambiguo o incoherente`,
      texto
    );
    try { return JSON.parse(r); } catch { return { intent: 'otro', sentiment: 'ok', confidence: 'baja' }; }
  } catch { return { intent: 'otro', sentiment: 'ok', confidence: 'baja' }; }
}

// ============================================================
// DEMO MODE — Knowledge base y FAQ handler
// ============================================================
const DEMO_KNOWLEDGE_BASE = `
SOBRE EL SISTEMA CONSULTORIO INTELIGENTE:
Plataforma de gestión de turnos médicos con IA: WhatsApp + voz (Sofía) + dashboard web.
Cada cliente tiene su propia instancia independiente. No es SaaS compartido — los datos son del consultorio.

OBJETIVO PRINCIPAL — AGENDA SIEMPRE LLENA:
El sistema mantiene la agenda siempre ocupada. Cuando un paciente cancela o no confirma, el turno se ofrece automáticamente a pacientes en lista de espera. El objetivo es eliminar los huecos en la agenda.

CANCELACIÓN DE TURNOS POR EL PACIENTE:
El paciente puede cancelar su turno desde WhatsApp en cualquier momento. La forma es configurable: botón, mensaje libre, o requiriendo confirmación. Al liberarse un turno, el sistema notifica a la lista de espera automáticamente.

MÉTRICAS Y NO-SHOWS:
El sistema registra cuántos turnos se confirmaron, cuántos se cancelaron y cuántos fueron no-shows. Esto permite medir el impacto real y actuar sobre los turnos en riesgo. El objetivo es reducir los no-shows al mínimo.

RECORDATORIOS AUTOMÁTICOS:
El sistema envía recordatorios antes del turno. Si el paciente no confirma, se pueden configurar alertas adicionales o reasignación automática a lista de espera.

POST-CONSULTA Y RESEÑAS:
Al finalizar el turno, el sistema envía automáticamente un mensaje preguntando cómo le fue, con un link directo a Google para dejar una reseña. Construye reputación online del consultorio sin esfuerzo.

IDENTIFICACIÓN DE PACIENTES — FLEXIBLE:
La demo usa DNI como método de identificación, pero cada consultorio elige: DNI, nombre y apellido, teléfono, o número de historia clínica. Si el consultorio ya tiene una base de datos, el sistema se conecta a ella — no crea registros duplicados.

DIFERENCIA CON WHATSAPP BUSINESS NORMAL:
WhatsApp Business permite responder manualmente o con respuestas automáticas básicas. Consultorio Inteligente entiende lenguaje natural: el paciente escribe como quiere y el sistema interpreta, decide y actúa. No son botones fijos — es IA conversacional conectada a la agenda real.

OBRAS SOCIALES Y COBERTURA:
Completamente configurable. El médico define qué obras sociales acepta, cuáles requieren autorización previa y cuáles no trabaja. La demo tiene una configuración de ejemplo.

PERSONALIZACIÓN DEL FLUJO:
Esta es una demo con un flujo estándar. Para cada consultorio se hace auditoría completa y se diseña el flujo a medida: especialidades, profesionales, horarios, mensajes, validaciones.

INTEGRACIÓN CON SISTEMAS EXISTENTES:
Se integra con sistemas de gestión clínica (HIS) que tengan API o exportación de datos. En la auditoría inicial se releva el stack tecnológico actual. El sistema trabaja junto al software existente, no lo reemplaza.

WHATSAPP Y NÚMERO DE TELÉFONO:
El consultorio usa su propio número de WhatsApp Business existente, o se crea uno nuevo.

HANDOFF A PERSONAL HUMANO:
Cuando un paciente quiere hablar con una persona, el sistema hace el handoff automático al administrativo o médico vía WhatsApp o Telegram en tiempo real.

PRECIO:
El precio varía según cantidad de profesionales, especialidades y módulos requeridos. Para una propuesta personalizada: nexo-terra.com.ar.

SEGURIDAD Y PRIVACIDAD:
Los datos se alojan en servidores propios del consultorio (no compartidos). Cada cliente tiene su entorno completamente aislado.
`;

async function answerFAQ(texto) {
  const sys = `Sos Sofía, asistente de ventas del sistema Consultorio Inteligente.
Un potencial cliente (médico o administrativo) te está probando en una DEMO y tiene una pregunta sobre el sistema.
Respondé de forma directa, breve (máximo 3 líneas) y clara.
Usá este conocimiento como base de respuesta:

${DEMO_KNOWLEDGE_BASE}

Si la pregunta no está cubierta, decí que pueden consultar en nexo-terra.com.ar o contactar a Carlos directamente.
Al final de tu respuesta, agregá siempre una línea invitando a continuar con la demo.`;
  const r = await askClaude(sys, texto);
  return r || 'Buena pregunta. Para esa info te recomiendo contactar a Carlos en nexo-terra.com.ar. ¿Seguimos con la demo?';
}
// ============================================================

async function sendHandoffWithContext(phone, ctx, estado, motivo) {
  await supaUpdate('consultorio_conversaciones', { telefono_wa: `eq.${phone}` }, { handoff_humano: true });
  const resumen = [
    '📋 *Handoff automatico*',
    `📱 Tel: ${phone}`,
    ctx.pacienteNombre ? `👤 Paciente: ${ctx.pacienteNombre}` : '👤 Paciente no identificado',
    ctx.dni ? `🆔 DNI: ${ctx.dni}` : '',
    `📍 Estaba en: ${estado}`,
    `💬 Motivo: ${motivo}`,
    ctx.retry_count ? `🔄 Intentos fallidos: ${ctx.retry_count}` : '',
  ].filter(Boolean).join('\n');
  ctx.handoffResumen = resumen;
  await updateConv(phone, estado, ctx);
  await sendButtons(phone,
    `Listo, te conecté con nuestra secretaria.\n\nEscribí tu consulta por acá y te va a responder en unos minutos.\n\nSi preferís, también podés llamar al ${CONSULTORIO.telefono}.`,
    [{ id: 'handoff_llamar', title: 'Prefiero llamar' }]
  );
  return [{ json: { action: 'handoff_escalation', phone, resumen } }];
}

function argDate(d) { return new Date(d.getTime() - 3*60*60*1000); }
function fmtFecha(d) { return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth()+1}`; }
function fmtFechaLarga(d) { return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; }

async function getSlots(profId) {
  const profs = await supaGet('consultorio_profesionales', { id: `eq.${profId}`, select: 'duracion_turno_min,nombre,especialidad,consultorio' });
  const prof = profs?.[0]; if (!prof) return { slots: [], prof: null };
  const horarios = await supaGet('consultorio_horarios_profesional', { profesional_id: `eq.${profId}`, select: 'dia_semana,hora_inicio,hora_fin' });
  if (!horarios?.length) return { slots: [], prof };
  const dur = prof.duracion_turno_min || 15;
  const nowArg = argDate(new Date());
  const turnos = await supaGet('consultorio_turnos', { profesional_id: `eq.${profId}`, select: 'fecha_hora', estado: 'not.in.(cancelado,auto_cancelado)' });
  const taken = new Set();
  if (turnos) for (const t of turnos) { const a = argDate(new Date(t.fecha_hora)); taken.add(`${a.getUTCFullYear()}-${String(a.getUTCMonth()+1).padStart(2,'0')}-${String(a.getUTCDate()).padStart(2,'0')}T${String(a.getUTCHours()).padStart(2,'0')}:${String(a.getUTCMinutes()).padStart(2,'0')}`); }
  const slots = [];
  for (let d = 0; d < 14; d++) {
    const date = new Date(nowArg.getTime() + d*24*60*60*1000);
    let jsDay = date.getUTCDay(); let dbDay = jsDay === 0 ? 7 : jsDay;
    const scheds = horarios.filter(h => h.dia_semana === dbDay); if (!scheds.length) continue;
    for (const sc of scheds) {
      const [sh,sm] = sc.hora_inicio.split(':').map(Number); const [eh,em] = sc.hora_fin.split(':').map(Number);
      let h=sh, m=sm;
      while (h*60+m+dur <= eh*60+em) {
        if (d===0) { const now=nowArg.getUTCHours()*60+nowArg.getUTCMinutes(); if (h*60+m<=now) { m+=dur; if(m>=60){h++;m-=60;} continue; } }
        const ts = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        const ds = `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
        if (!taken.has(`${ds}T${ts}`)) { slots.push({ date: ds, time: ts, dateF: fmtFecha(date), iso: `${ds}T${ts}:00-03:00` }); }
        m+=dur; if(m>=60){h++;m-=60;}
      }
    }
  }
  return { slots, prof };
}

async function mostrarResumenConfirmacion(phone, ctx) {
  const osLinea = ctx.obraSocial ? ctx.obraSocial : 'Particular';
  const resumenBody = [
    'Antes de elegir el horario, revisá tus datos:',
    '',
    `👤 Nombre: ${ctx.pacienteNombre}`,
    `🆔 DNI: ${ctx.dni}`,
    `🏥 Obra social: ${osLinea}`,
    `👨‍⚕️ Profesional: ${ctx.profesionalNombre} (${ctx.especialidad})`,
    '',
    '¿Está todo bien?'
  ].join('\n');

  const rowsCorregir = [];
  if (!ctx.esRecurrente) rowsCorregir.push({ id: 'edit_nombre', title: 'Cambiar nombre' });
  rowsCorregir.push({ id: 'edit_os', title: 'Cambiar obra social' });
  rowsCorregir.push({ id: 'edit_especialidad', title: 'Cambiar especialidad' });
  rowsCorregir.push({ id: 'edit_profesional', title: 'Cambiar profesional' });

  await sendList(phone, resumenBody, 'Ver opciones', [
    { title: 'Confirmar', rows: [{ id: 'confirmar_datos_ok', title: '✅ Sí, todo bien' }] },
    { title: 'Corregir', rows: rowsCorregir }
  ]);
}

async function persistirPacienteOS(phone, ctx) {
  if (ctx.pacienteId) {
    await supaUpdate('consultorio_pacientes',
      { id: `eq.${ctx.pacienteId}` },
      { nombre: ctx.pacienteNombre, obra_social: ctx.obraSocial });
    return ctx.pacienteId;
  }
  const np = await supaInsert('consultorio_pacientes',
    { dni: ctx.dni, nombre: ctx.pacienteNombre, telefono_wa: phone, obra_social: ctx.obraSocial });
  return np?.[0]?.id;
}

async function mostrarMenuPrincipal(phone) {
  await sendList(phone, '¿Qué necesitás?', 'Ver opciones', [
    { title: 'Turnos', rows: [
      { id: 'menu_turno', title: 'Sacar turno' },
      { id: 'menu_cancelar', title: 'Cancelar o reprogramar' },
      { id: 'menu_consultar', title: 'Ver mi próximo turno' }
    ]},
    { title: 'Mi cuenta', rows: [
      { id: 'menu_actualizar', title: 'Actualizar mis datos' }
    ]}
  ]);
}

async function mostrarOpcionesActualizar(phone, ctx) {
  const osActual = ctx.obraSocial
    ? `🏥 Obra social: ${ctx.obraSocial}`
    : `🏥 Particular (sin obra social)`;
  await sendButtons(phone,
    `¿Qué querés actualizar?\n\n${osActual}`,
    [{ id: 'actualizar_os', title: 'Cambiar obra social' },
     { id: 'actualizar_volver', title: 'Volver al menú' }]);
}

async function mostrarEsps(ph) {
  const profs = await supaGet('consultorio_profesionales', { activo: 'eq.true', select: 'especialidad', order: 'especialidad.asc' });
  const esps = [...new Set(profs.map(p => p.especialidad))];
  if (esps.length <= 3) { await sendButtons(ph, '¿Qué especialidad necesitás?', esps.map((e,i) => ({ id: `esp_${i}`, title: e }))); }
  else { await sendList(ph, '¿Qué especialidad necesitás?', 'Ver especialidades', [{ title: 'Especialidades', rows: esps.map((e,i) => ({ id: `esp_${i}`, title: e })) }]); }
  return esps;
}

async function mostrarDias(ph, ctx) {
  const { slots } = await getSlots(ctx.profesionalId);
  if (!slots.length) {
    await sendButtons(ph, `No hay turnos disponibles con ${ctx.profesionalNombre} en los próximos 14 días.`, [{ id: 'waitlist_si', title: 'Avisame si se libera' }, { id: 'otra_esp', title: 'Otro profesional' }]);
    ctx.sinDisponibilidad = true; await updateConv(ph, 'sin_disponibilidad', ctx); return;
  }
  const bookingToken = Date.now().toString(36) + Math.random().toString(36).substring(2);
  ctx.bookingToken = bookingToken;
  await updateConv(ph, 'esperando_booking_web', ctx);
  const N8N_BASE = $env.WEBHOOK_URL || $env.N8N_HOST || '';
  const bookingUrl = `${N8N_BASE}/webhook/consultorio-turnos?token=${bookingToken}`;
  await sendCTAUrl(ph,
    `📅 Turno con ${ctx.profesionalNombre} (${ctx.especialidad})\n\nTocá el botón para ver los horarios disponibles.\n\n📱 Si el botón no abre, entrá desde acá:\n${bookingUrl}`,
    'Elegir horario',
    bookingUrl);
}

const data = $input.first().json;
const phone = data.phone;
const texto = (data.textoMensaje || '').trim();
const btnId = data.interactiveId || '';
let estado = data.convEstado || 'inicio';
let ctx = data.convContexto || {};

// Race condition guard: re-fetch state and claim lock before processing
const freshConv = await supaGet('consultorio_conversaciones', { telefono_wa: `eq.${phone}`, select: 'estado,contexto,updated_at' });
const freshState = freshConv?.[0];
if (freshState?.estado === 'procesando') {
  const age = Date.now() - new Date(freshState.updated_at).getTime();
  if (age < 10000) {
    return [{ json: { action: 'skipped_race', phone } }];
  }
  // Lock > 10s = ejecución anterior crasheó. Resetear a inicio para no heredar 'procesando' como estado real.
  estado = 'inicio';
  ctx = {};
} else if (freshState) {
  // Siempre usar el estado más fresco de Supabase (WF01 puede pasar datos desactualizados)
  estado = freshState.estado || estado;
  ctx = freshState.contexto || ctx;
}
if (freshState) {
  await supaUpdate('consultorio_conversaciones', { telefono_wa: `eq.${phone}` }, { estado: 'procesando' });
}

if (ctx.last_failed_state && ctx.last_failed_state !== estado) {
  ctx.retry_count = 0;
  ctx.last_failed_state = undefined;
}

try {

const hw = ['recepcion','recepción','hablar con alguien','persona','humano','secretaria'];
const _demoStates = ['inicio', 'esperando_dni', 'esperando_nombre', 'esperando_obra_social', 'demo_faq_mode'];
if (hw.some(w => texto.toLowerCase().includes(w)) && !_demoStates.includes(estado)) {
  return await sendHandoffWithContext(phone, ctx, estado, 'Paciente pidio hablar con recepcion');
}

if (texto === '__MEDIA__') { await sendText(phone, 'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribís por favor?'); return [{ json: { action: 'media_rejected', phone } }]; }

if (btnId === 'fb_turno' || btnId === 'fb_cancelar') {
  ctx.retry_count = 0;
  ctx.last_failed_state = undefined;
  if (!ctx.pacienteId) {
    await updateConv(phone, 'esperando_dni', ctx);
    await sendText(phone, 'Para empezar, pasame tu número de DNI (sin puntos).');
    return [{ json: { action: 'fallback_recovery_dni', phone } }];
  }
  if (btnId === 'fb_turno') {
    await updateConv(phone, 'esperando_especialidad', ctx);
    await mostrarEsps(phone);
    return [{ json: { action: 'fallback_recovery_turno', phone } }];
  }
  await updateConv(phone, 'menu_principal', ctx);
  await mostrarMenuPrincipal(phone);
  return [{ json: { action: 'fallback_recovery_menu', phone } }];
}
if (btnId === 'fb_recepcion') {
  return await sendHandoffWithContext(phone, ctx, estado, 'Paciente pidio recepcion desde fallback');
}
if (btnId === 'handoff_llamar') {
  await sendText(phone, `Llamanos al ${CONSULTORIO.telefono}.\nHorario: ${CONSULTORIO.horario}\n\n¡Te esperamos!`);
  return [{ json: { action: 'handoff_llamar', phone } }];
}

// --- CTA HANDLER (demo mode) ---
if (texto.toLowerCase().includes('quiero saber mas') || texto.toLowerCase().includes('quiero saber más')) {
  await sendText(phone, `¡Perfecto! 🙌 Carlos te va a contactar a la brevedad.\n\nMientras tanto, podés ver más info en *nexo-terra.com.ar*`);
  await notifyTelegram(`🎯 PROSPECTO INTERESADO\nNúmero: ${phone}\nEscribió: "QUIERO SABER MÁS" en la demo`);
  await updateConv(phone, estado, ctx);
  return [{ json: { action: 'cta_triggered', phone } }];
}
// --- FIN CTA HANDLER ---

// --- FAQ HANDLER (demo mode) ---
const clasificacionFAQ = await classifyInput(texto, estado);
if (clasificacionFAQ.intent === 'pregunta') {
  const respFAQ = await answerFAQ(texto);
  await sendText(phone, respFAQ);
  await updateConv(phone, estado, ctx);
  return [{ json: { action: 'faq_answered', phone, intent: 'pregunta' } }];
}
// --- FIN FAQ HANDLER ---

// --- DEMO FAQ MODE (post-showcase) ---
if (estado === 'demo_faq_mode') {
  const _lastUpdate = freshState?.updated_at ? new Date(freshState.updated_at).getTime() : 0;
  if ((Date.now() - _lastUpdate) > 5 * 60 * 1000) {
    // Pasaron más de 5 min sin respuesta → reiniciar demo
    await sendText(phone, `¡Hola! Soy *Sofía* 👋, la asistente del sistema *Consultorio Inteligente*.

🔵 *Estás experimentando una DEMO del sistema.*

Te voy a guiar por el flujo completo tal como lo vería un paciente real.

💬 En cualquier momento podés hacerme una pregunta sobre el sistema y te respondo.

Para arrancar, ingresá cualquier número de 7 u 8 dígitos _(en producción el paciente ingresaría su DNI, o el método que use tu clínica: nombre, historia clínica, etc.)_`);
    await updateConv(phone, 'esperando_dni', {});
    return [{ json: { action: 'demo_timeout_reset', phone } }];
  }
  if (clasificacionFAQ.intent !== 'pregunta') {
    const oc = (ctx.faq_oc_count || 0) + 1;
    ctx.faq_oc_count = oc;
    if (oc >= 2) {
      await sendText(phone, `Tu mensaje no parece relacionado con el sistema 🤔\n\n¿Tenés alguna pregunta sobre el *Consultorio Inteligente*? O si preferís que Carlos te contacte directamente, escribí *QUIERO SABER MÁS*.`);
      await notifyTelegram(`🤔 Demo OOC x${oc}\nNúmero: ${phone}\nMensaje: "${texto.slice(0, 100)}"`);
    } else {
      await sendText(phone, `No entendí bien tu mensaje 😅\n\n¿Tenés alguna pregunta sobre el sistema? Escribila y te respondo. O escribí *QUIERO SABER MÁS* para que Carlos te contacte.`);
    }
    await updateConv(phone, 'demo_faq_mode', ctx);
    return [{ json: { action: 'faq_ooc_demo', phone, oc } }];
  }
  ctx.faq_oc_count = 0;
  const respFAQ = await answerFAQ(texto);
  await sendText(phone, respFAQ);
  await updateConv(phone, 'demo_faq_mode', ctx);
  return [{ json: { action: 'faq_post_showcase', phone } }];
}
// --- FIN DEMO FAQ MODE ---

if (estado === 'inicio') {
  if (ctx.from_vapi && ctx.nombre_sugerido) {
    const primerNombre = ctx.nombre_sugerido.split(' ')[0];
    await updateConv(phone, 'esperando_dni', ctx);
    await sendText(phone, `¡Hola ${primerNombre}! 😊 Para confirmar y agendar tu turno, pasame tu DNI (sin puntos).`);
    return [{ json: { action: 'welcome_vapi', phone } }];
  }
  await sendText(phone, `¡Hola! Soy *Sofía* 👋, la asistente del sistema *Consultorio Inteligente*.\n\n🔵 *Estás experimentando una DEMO del sistema.*\n\nTe voy a guiar por el flujo completo tal como lo vería un paciente real.\n\n💬 En cualquier momento podés hacerme una pregunta sobre el sistema y te respondo.\n\nPara arrancar, ingresá cualquier número de 7 u 8 dígitos _(en producción el paciente ingresaría su DNI, o el método que use tu clínica: nombre, historia clínica, etc.)_`);
  await updateConv(phone, 'esperando_dni', {});
  return [{ json: { action: 'welcome_sent', phone } }];
}

if (estado === 'esperando_dni') {
  // Si el mensaje no tiene dígitos suficientes, no es un intento de DNI → FAQ
  const _digitCount = (texto.match(/\d/g) || []).length;
  if (_digitCount < 6) {
    const respFAQ = await answerFAQ(texto);
    await sendText(phone, respFAQ);
    await updateConv(phone, 'esperando_dni', ctx);
    return [{ json: { action: 'faq_at_esperando_dni', phone } }];
  }
  const dniR = await askClaude('Extraé el número de DNI del mensaje. Respondé SOLO con los dígitos sin puntos. Si no hay DNI válido (7-8 dígitos), respondé ERROR.', texto);
  const dni = dniR.replace(/\D/g, '');
  if (!dni || dni.length < 7 || dni.length > 8 || dniR.includes('ERROR')) {
    ctx.retry_count = (ctx.retry_count || 0) + 1;
    ctx.last_failed_state = estado;
    await updateConv(phone, estado, ctx);
    if (ctx.retry_count >= 2) {
      return await sendHandoffWithContext(phone, ctx, estado, 'No puede ingresar DNI valido');
    }
    await sendText(phone, 'No parece un DNI válido. Escribilo solo con números, sin puntos (ej: 35892411).');
    return [{ json: { action: 'invalid_dni', phone } }];
  }
  ctx.retry_count = 0;
  const pacs = await supaGet('consultorio_pacientes', { dni: `eq.${dni}`, select: '*' });
  if (pacs?.length > 0) {
    const p = pacs[0];
    ctx = { ...ctx, pacienteId: p.id, pacienteNombre: p.nombre, dni, obraSocial: p.obra_social, esRecurrente: true, retry_count: 0 };

    const ultTurno = await supaGet('consultorio_turnos',
      { paciente_id: `eq.${p.id}`, select: 'fecha_hora',
        order: 'fecha_hora.desc', limit: '1' });
    const diasDesdeUltimo = ultTurno?.[0]
      ? Math.floor((Date.now() - new Date(ultTurno[0].fecha_hora).getTime()) / (1000*60*60*24))
      : 999;

    if (diasDesdeUltimo > DIAS_VERIFICACION) {
      await updateConv(phone, 'verificar_datos', ctx);
      const tiempo = diasDesdeUltimo > 365
        ? 'hace más de un año'
        : `hace ${Math.floor(diasDesdeUltimo/30)} meses`;
      const osLinea = p.obra_social
        ? `🏥 Obra social: ${p.obra_social}`
        : '🏥 Particular (sin obra social)';
      await sendButtons(phone,
        `¡Hola ${p.nombre.split(' ')[0]}! 👋\n\nVeo que no nos vemos ${tiempo}. Antes de seguir, ¿tus datos siguen iguales?\n\n${osLinea}`,
        [{ id: 'verif_ok', title: 'Sí, todo igual' },
         { id: 'verif_actualizar', title: 'Actualizar' }]);
    } else {
      if (ctx.from_vapi && ctx.especialidad_sugerida) {
        ctx.from_vapi = false;
        ctx.especialidad = ctx.especialidad_sugerida;
        await updateConv(phone, 'esperando_profesional', ctx);
        const pe = await supaGet('consultorio_profesionales',
          { especialidad: `eq.${ctx.especialidad}`, activo: 'eq.true', select: 'id,nombre,consultorio', order: 'nombre.asc' });
        if (pe?.length === 1) {
          ctx.profesionalId = pe[0].id; ctx.profesionalNombre = pe[0].nombre; ctx.consultorio = pe[0].consultorio;
          ctx.edicion = false;
          await updateConv(phone, 'confirmar_datos', ctx);
          await mostrarResumenConfirmacion(phone, ctx);
        } else if (pe?.length > 1) {
          await sendList(phone, `En ${ctx.especialidad} tenemos:`, 'Ver profesionales',
            [{ title: ctx.especialidad, rows: pe.map(pr => ({ id: `prof_${pr.id}`, title: pr.nombre, description: pr.consultorio || '' })) }]);
        } else {
          await updateConv(phone, 'menu_principal', ctx);
          await mostrarMenuPrincipal(phone);
        }
      } else {
        await updateConv(phone, 'menu_principal', ctx);
        await sendText(phone, `¡Hola ${p.nombre.split(' ')[0]}! Qué bueno verte de nuevo.`);
        await mostrarMenuPrincipal(phone);
      }
    }
  } else {
    const nombreSugerido = ctx.nombre_sugerido || '';
    ctx = { ...ctx, dni, retry_count: 0 };
    if (nombreSugerido) {
      ctx.pacienteNombre = nombreSugerido;
      ctx.from_vapi = false;
      await updateConv(phone, 'esperando_obra_social', ctx);
      await sendText(phone, `Perfecto, te registro como *${nombreSugerido}*. 😊`);
      await sendButtons(phone, '¿Tenés obra social?', [{ id: 'os_si', title: 'Sí' }, { id: 'os_no', title: 'No, particular' }]);
    } else {
      await updateConv(phone, 'esperando_nombre', ctx);
      await sendText(phone, 'Parece que es tu primera vez con nosotros. 😊\nTe pido unos datos para crearte la ficha.\n\n¿Cuál es tu nombre completo?');
    }
  }
  return [{ json: { action: 'dni_ok', phone, dni } }];
}

if (estado === 'esperando_nombre') {
  if (texto.length < 3) {
    ctx.retry_count = (ctx.retry_count || 0) + 1;
    ctx.last_failed_state = estado;
    await updateConv(phone, estado, ctx);
    if (ctx.retry_count >= 2) {
      return await sendHandoffWithContext(phone, ctx, estado, 'No puede ingresar nombre');
    }
    await sendText(phone, 'Necesito tu nombre completo. ¿Me lo pasás?');
    return [{ json: { action: 'name_short', phone } }];
  }
  ctx.pacienteNombre = texto; ctx.retry_count = 0;
  if (ctx.edicion) {
    ctx.edicion = false;
    if (ctx.pacienteId) {
      await supaUpdate('consultorio_pacientes', { id: `eq.${ctx.pacienteId}` }, { nombre: ctx.pacienteNombre });
    }
    await updateConv(phone, 'confirmar_datos', ctx);
    await mostrarResumenConfirmacion(phone, ctx);
    return [{ json: { action: 'name_edited', phone } }];
  }
  await updateConv(phone, 'esperando_obra_social', ctx);
  await sendButtons(phone, `Perfecto, ${texto.split(' ')[0]}. ¿Tenés obra social o prepaga?`, [{ id: 'os_si', title: 'Sí, tengo' }, { id: 'os_no', title: 'No, particular' }]);
  return [{ json: { action: 'name_ok', phone } }];
}

if (estado === 'esperando_obra_social') {
  if (btnId === 'os_no' || texto.toLowerCase().includes('particular') || texto.toLowerCase() === 'no') {
    ctx.obraSocial = null; ctx.retry_count = 0;
    ctx.pacienteId = await persistirPacienteOS(phone, ctx);
    if (ctx.edicion && ctx.modoActualizacion) {
      ctx.edicion = false; ctx.modoActualizacion = false;
      await sendText(phone, `✅ Listo, actualicé tus datos: ahora figurás como *Particular*.`);
      await updateConv(phone, 'menu_principal', ctx);
      await mostrarMenuPrincipal(phone);
      return [{ json: { action: 'actualizacion_particular_done', phone } }];
    }
    if (ctx.edicion) {
      ctx.edicion = false;
      await updateConv(phone, 'confirmar_datos', ctx);
      await mostrarResumenConfirmacion(phone, ctx);
      return [{ json: { action: 'os_edited_particular', phone } }];
    }
    await updateConv(phone, 'esperando_especialidad', ctx);
    await sendText(phone, `Sin problema. La consulta particular es $${CONSULTORIO.precioParticular.toLocaleString('es-AR')}. Se abona en recepción.\n\nAhora vamos a buscar tu turno.`);
    await mostrarEsps(phone);
    return [{ json: { action: 'particular_ok', phone } }];
  }
  if (btnId === 'os_si') {
    ctx.pregOS = false; ctx.retry_count = 0; await updateConv(phone, 'esperando_obra_social', ctx);
    // WhatsApp Cloud API: máximo 10 rows totales en listas. Mostramos 9 OS + "Otra".
    const osMostradas = CONSULTORIO.obrasociales.slice(0, 9);
    const rows = osMostradas.map((os, i) => ({ id: `os_idx_${i}`, title: os }));
    rows.push({ id: 'os_otra', title: 'Otra', description: 'Escribí el nombre' });
    await sendList(phone, '¿Cuál es tu obra social o prepaga?\n\nSi no ves la tuya, tocá "Otra".', 'Ver obras sociales', [
      { title: 'Obras sociales', rows }
    ]);
    return [{ json: { action: 'asking_os_list', phone } }];
  }
  if (btnId && btnId.startsWith('os_idx_')) {
    const idx = parseInt(btnId.replace('os_idx_', ''), 10);
    const osElegida = CONSULTORIO.obrasociales[idx];
    if (osElegida) {
      ctx.obraSocial = osElegida; ctx.pregOS = undefined; ctx.retry_count = 0;
      ctx.pacienteId = await persistirPacienteOS(phone, ctx);
      if (ctx.edicion && ctx.modoActualizacion) {
        ctx.edicion = false; ctx.modoActualizacion = false;
        await sendText(phone, `✅ Listo, actualicé tu obra social a *${ctx.obraSocial}*.`);
        await updateConv(phone, 'menu_principal', ctx);
        await mostrarMenuPrincipal(phone);
        return [{ json: { action: 'actualizacion_os_idx_done', phone, os: ctx.obraSocial } }];
      }
      if (ctx.edicion) {
        ctx.edicion = false;
        await updateConv(phone, 'confirmar_datos', ctx);
        await mostrarResumenConfirmacion(phone, ctx);
        return [{ json: { action: 'os_idx_edited', phone, os: ctx.obraSocial } }];
      }
      await updateConv(phone, 'esperando_especialidad', ctx);
      await sendText(phone, `Perfecto, ${ctx.obraSocial}. ¡Todo listo!\nAhora vamos a buscar tu turno.`);
      await mostrarEsps(phone);
      return [{ json: { action: 'os_ok', phone, os: ctx.obraSocial } }];
    }
  }
  if (btnId === 'os_otra') {
    ctx.pregOS = true; await updateConv(phone, 'esperando_obra_social', ctx);
    await sendText(phone, 'Escribí el nombre de tu obra social.');
    return [{ json: { action: 'asking_os_text', phone } }];
  }
  if (ctx.pregOS || (!btnId && texto.length > 1)) {
    const osR = await askClaude(`Identificá la obra social mencionada. Opciones: ${CONSULTORIO.obrasociales.join(', ')}. Respondé SOLO el nombre exacto si hay match, o NO_MATCH.`, texto);
    if (osR.includes('NO_MATCH')) {
      await sendButtons(phone, `No atendemos esa OS. Atendemos:\n${CONSULTORIO.obrasociales.join(', ')}\n\n¿Querés como particular? ($${CONSULTORIO.precioParticular.toLocaleString('es-AR')})`, [{ id: 'os_no', title: 'Sí, particular' }, { id: 'os_si', title: 'Otra OS' }]);
      return [{ json: { action: 'os_nomatch', phone } }];
    }
    ctx.obraSocial = osR.trim(); ctx.pregOS = undefined; ctx.retry_count = 0;
    ctx.pacienteId = await persistirPacienteOS(phone, ctx);
    if (ctx.edicion && ctx.modoActualizacion) {
      ctx.edicion = false; ctx.modoActualizacion = false;
      await sendText(phone, `✅ Listo, actualicé tu obra social a *${ctx.obraSocial}*.`);
      await updateConv(phone, 'menu_principal', ctx);
      await mostrarMenuPrincipal(phone);
      return [{ json: { action: 'actualizacion_os_texto_done', phone, os: ctx.obraSocial } }];
    }
    if (ctx.edicion) {
      ctx.edicion = false;
      await updateConv(phone, 'confirmar_datos', ctx);
      await mostrarResumenConfirmacion(phone, ctx);
      return [{ json: { action: 'os_edited_ok', phone, os: ctx.obraSocial } }];
    }
    await updateConv(phone, 'esperando_especialidad', ctx);
    await sendText(phone, `Perfecto, ${ctx.obraSocial}. ¡Todo listo!\nAhora vamos a buscar tu turno.`);
    await mostrarEsps(phone);
    return [{ json: { action: 'os_ok', phone, os: ctx.obraSocial } }];
  }
  await sendButtons(phone, '¿Tenés obra social?', [{ id: 'os_si', title: 'Sí' }, { id: 'os_no', title: 'No, particular' }]);
  return [{ json: { action: 'os_retry', phone } }];
}

if (estado === 'esperando_especialidad') {
  const profs = await supaGet('consultorio_profesionales', { activo: 'eq.true', select: 'id,nombre,especialidad,consultorio', order: 'especialidad.asc' });
  const esps = [...new Set(profs.map(p => p.especialidad))];
  let sel = '';
  if (btnId?.startsWith('esp_')) { sel = esps[parseInt(btnId.split('_')[1])] || ''; }
  else { sel = esps.find(e => texto.toLowerCase().includes(e.toLowerCase().substring(0,5))) || ''; }
  if (!sel) {
    ctx.retry_count = (ctx.retry_count || 0) + 1;
    ctx.last_failed_state = estado;
    await updateConv(phone, estado, ctx);
    if (ctx.retry_count >= 2) {
      return await sendHandoffWithContext(phone, ctx, estado, 'No puede elegir especialidad');
    }
    await sendText(phone, 'No entendí. Tocá una opción de la lista:');
    await mostrarEsps(phone);
    return [{ json: { action: 'esp_retry', phone } }];
  }
  ctx.retry_count = 0;
  const pe = profs.filter(p => p.especialidad === sel); ctx.especialidad = sel;
  if (pe.length === 1) {
    ctx.profesionalId = pe[0].id; ctx.profesionalNombre = pe[0].nombre; ctx.consultorio = pe[0].consultorio;
    ctx.edicion = false;
    await updateConv(phone, 'confirmar_datos', ctx);
    await mostrarResumenConfirmacion(phone, ctx);
  } else {
    await updateConv(phone, 'esperando_profesional', ctx);
    await sendList(phone, `En ${sel} tenemos:`, 'Ver profesionales', [{ title: sel, rows: pe.map(p => ({ id: `prof_${p.id}`, title: p.nombre, description: p.consultorio || '' })) }]);
  }
  return [{ json: { action: 'esp_ok', phone, esp: sel } }];
}

if (estado === 'esperando_profesional') {
  let pid = btnId?.startsWith('prof_') ? btnId.replace('prof_','') : '';
  if (!pid) { const ps = await supaGet('consultorio_profesionales',{especialidad:`eq.${ctx.especialidad}`,activo:'eq.true',select:'id,nombre'}); const m=ps.find(p=>texto.toLowerCase().includes(p.nombre.split(' ').pop().toLowerCase())); pid=m?.id||''; }
  if (!pid) {
    ctx.retry_count = (ctx.retry_count || 0) + 1;
    ctx.last_failed_state = estado;
    await updateConv(phone, estado, ctx);
    if (ctx.retry_count >= 2) {
      return await sendHandoffWithContext(phone, ctx, estado, 'No puede elegir profesional');
    }
    await sendText(phone, 'No entendí. Elegí un profesional de la lista.');
    return [{ json: { action: 'prof_retry', phone } }];
  }
  ctx.retry_count = 0;
  const pd = await supaGet('consultorio_profesionales',{id:`eq.${pid}`,select:'nombre,consultorio'});
  ctx.profesionalId=pid; ctx.profesionalNombre=pd?.[0]?.nombre||''; ctx.consultorio=pd?.[0]?.consultorio||'';
  ctx.edicion = false;
  await updateConv(phone, 'confirmar_datos', ctx);
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'prof_ok', phone } }];
}

if (estado === 'sin_disponibilidad') {
  if (btnId==='waitlist_si') { await supaInsert('consultorio_waitlist',{paciente_id:ctx.pacienteId,profesional_id:ctx.profesionalId}); await sendText(phone,`Te anoté en la lista de espera con ${ctx.profesionalNombre}. Apenas se libere un turno, te aviso. 👍`); await updateConv(phone,'inicio',{}); }
  else if (btnId==='otra_esp') { await updateConv(phone,'esperando_especialidad',ctx); await mostrarEsps(phone); }
  return [{ json: { action: 'sin_disp', phone } }];
}

if (estado === 'esperando_booking_web') {
  const N8N_BASE = $env.WEBHOOK_URL || $env.N8N_HOST || '';
  const bookingUrl = `${N8N_BASE}/webhook/consultorio-turnos?token=${ctx.bookingToken}`;
  await sendText(phone, `Elegí tu turno desde el link:\n\n👉 ${bookingUrl}\n\nSi tenés algún problema, escribí \"recepción\" para hablar con una persona.`);
  return [{ json: { action: 'booking_web_reminder', phone } }];
}

if (estado === 'menu_principal') {
  if (btnId==='menu_turno') { ctx.retry_count = 0; await updateConv(phone,'esperando_especialidad',ctx); await mostrarEsps(phone); return [{ json: { action: 'menu_turno', phone } }]; }
  if (btnId==='menu_consultar') {
    const ts = await supaGet('consultorio_turnos', { paciente_id:`eq.${ctx.pacienteId}`, estado:'in.(agendado,confirmado)', select:'fecha_hora,estado,profesional_id', order:'fecha_hora.asc', limit:'3' });
    if (!ts?.length) { await sendButtons(phone,'No tenés turnos agendados. ¿Querés sacar uno?',[{id:'menu_turno',title:'Sí, sacar turno'},{id:'menu_chau',title:'No, gracias'}]); }
    else {
      let msg = 'Tus próximos turnos:\n\n';
      for (const t of ts) { const d=argDate(new Date(t.fecha_hora)); const pf=await supaGet('consultorio_profesionales',{id:`eq.${t.profesional_id}`,select:'nombre,especialidad'}); msg += `📅 ${fmtFechaLarga(d)}, ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} hs\n👨\u200d\u2695\ufe0f ${pf?.[0]?.nombre||'?'} \u2014 ${pf?.[0]?.especialidad||'?'}\n\n`; }
      await sendButtons(phone,msg,[{id:'menu_turno',title:'Sacar otro turno'},{id:'menu_chau',title:'Nada más'}]);
    }
    return [{ json: { action: 'consultar', phone } }];
  }
  if (btnId==='menu_cancelar') {
    const tAct = await supaGet('consultorio_turnos', { paciente_id:`eq.${ctx.pacienteId}`, estado:'in.(agendado,confirmado)', select:'id,fecha_hora,profesional_id', order:'fecha_hora.asc' });
    if (!tAct?.length) {
      await sendButtons(phone, 'No tenés turnos agendados para cancelar. ¿Querés sacar uno?', [{id:'menu_turno',title:'Sí, sacar turno'},{id:'menu_chau',title:'No, gracias'}]);
      return [{ json: { action: 'no_turnos_cancel', phone } }];
    }
    if (tAct.length === 1) {
      const t = tAct[0]; const d = argDate(new Date(t.fecha_hora));
      const pf = await supaGet('consultorio_profesionales',{id:`eq.${t.profesional_id}`,select:'nombre,especialidad'});
      ctx.turnoACancelar = { id: t.id, profId: t.profesional_id, fechaHoraISO: t.fecha_hora, profNombre: pf?.[0]?.nombre||'', especialidad: pf?.[0]?.especialidad||'', fecha: fmtFechaLarga(d), hora: `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}` };
      await updateConv(phone, 'elegir_accion_turno', ctx);
      await sendButtons(phone, `Tu turno:\n\n📅 ${ctx.turnoACancelar.fecha}, ${ctx.turnoACancelar.hora} hs\n👨\u200d\u2695\ufe0f ${ctx.turnoACancelar.profNombre} \u2014 ${ctx.turnoACancelar.especialidad}\n\n¿Qué querés hacer?`, [{id:'accion_cancelar',title:'Cancelar'},{id:'accion_reprogramar',title:'Reprogramar'},{id:'accion_volver',title:'Volver'}]);
    } else {
      const rows = [];
      for (const t of tAct.slice(0,10)) {
        const d = argDate(new Date(t.fecha_hora));
        const pf = await supaGet('consultorio_profesionales',{id:`eq.${t.profesional_id}`,select:'nombre,especialidad'});
        rows.push({ id: `turno_${t.id}`, title: `${fmtFecha(d)} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`, description: pf?.[0]?.nombre||'' });
      }
      ctx.turnosActivos = tAct.map(t => ({ id: t.id, profId: t.profesional_id, fecha_hora: t.fecha_hora }));
      await updateConv(phone, 'elegir_turno_cancelar', ctx);
      await sendList(phone, 'Tenés estos turnos agendados. ¿Cuál querés cancelar o cambiar?', 'Ver turnos', [{ title: 'Turnos activos', rows }]);
    }
    return [{ json: { action: 'menu_cancelar', phone } }];
  }
  if (btnId==='menu_chau') { await sendText(phone,'¡Perfecto! Cuando necesites algo, escribime. 👋'); await updateConv(phone,'inicio',{}); return [{ json: { action: 'bye', phone } }]; }
  if (btnId === 'menu_actualizar') {
    ctx.retry_count = 0;
    await updateConv(phone, 'actualizar_datos', ctx);
    await mostrarOpcionesActualizar(phone, ctx);
    return [{ json: { action: 'menu_actualizar', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No puede navegar menu principal');
  }
  await sendText(phone, 'No entendí. Elegí una opción del menú:');
  await mostrarMenuPrincipal(phone);
  return [{ json: { action: 'menu_resent', phone } }];
}

if (estado === 'elegir_turno_cancelar') {
  let turnoId = ''; if (btnId?.startsWith('turno_')) { turnoId = btnId.replace('turno_',''); }
  if (!turnoId) {
    ctx.retry_count = (ctx.retry_count || 0) + 1;
    ctx.last_failed_state = estado;
    await updateConv(phone, estado, ctx);
    if (ctx.retry_count >= 2) {
      return await sendHandoffWithContext(phone, ctx, estado, 'No puede elegir turno a cancelar');
    }
    await sendText(phone, 'Elegí un turno de la lista.');
    return [{ json: { action: 'turno_cancel_retry', phone } }];
  }
  ctx.retry_count = 0;
  const tInfo = (ctx.turnosActivos||[]).find(t => t.id === turnoId);
  if (!tInfo) { await sendText(phone, 'No encontré ese turno.'); return [{ json: { action: 'turno_not_found', phone } }]; }
  const d = argDate(new Date(tInfo.fecha_hora));
  const pf = await supaGet('consultorio_profesionales',{id:`eq.${tInfo.profId}`,select:'nombre,especialidad'});
  ctx.turnoACancelar = { id: turnoId, profId: tInfo.profId, fechaHoraISO: tInfo.fecha_hora, profNombre: pf?.[0]?.nombre||'', especialidad: pf?.[0]?.especialidad||'', fecha: fmtFechaLarga(d), hora: `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}` };
  await updateConv(phone, 'elegir_accion_turno', ctx);
  await sendButtons(phone, `Turno seleccionado:\n\n📅 ${ctx.turnoACancelar.fecha}, ${ctx.turnoACancelar.hora} hs\n👨\u200d\u2695\ufe0f ${ctx.turnoACancelar.profNombre} \u2014 ${ctx.turnoACancelar.especialidad}\n\n¿Qué querés hacer?`, [{id:'accion_cancelar',title:'Cancelar'},{id:'accion_reprogramar',title:'Reprogramar'},{id:'accion_volver',title:'Volver'}]);
  return [{ json: { action: 'turno_selected', phone } }];
}

if (estado === 'elegir_accion_turno') {
  if (btnId === 'accion_cancelar') {
    await updateConv(phone, 'confirmar_cancelacion', ctx);
    await sendButtons(phone, `¿Confirmás que querés cancelar este turno?\n\n📅 ${ctx.turnoACancelar.fecha}, ${ctx.turnoACancelar.hora} hs\n👨\u200d\u2695\ufe0f ${ctx.turnoACancelar.profNombre}`, [{id:'cancel_si',title:'Sí, cancelar'},{id:'cancel_no',title:'No, me arrepentí'}]);
    return [{ json: { action: 'confirm_cancel_shown', phone } }];
  }
  if (btnId === 'accion_reprogramar') {
    await supaUpdate('consultorio_turnos', {id:`eq.${ctx.turnoACancelar.id}`}, {estado:'cancelado'});
    await triggerAdelanto(ctx.turnoACancelar.fechaHoraISO, ctx.turnoACancelar.profId, ctx.pacienteId);
    await sendText(phone, `Turno cancelado. Ahora elegí un nuevo horario con ${ctx.turnoACancelar.profNombre}:`);
    ctx.profesionalId = ctx.turnoACancelar.profId;
    ctx.profesionalNombre = ctx.turnoACancelar.profNombre;
    ctx.especialidad = ctx.turnoACancelar.especialidad;
    ctx.turnoACancelar = undefined;
    await mostrarDias(phone, ctx);
    return [{ json: { action: 'reprogramar_started', phone } }];
  }
  if (btnId === 'accion_volver') {
    await updateConv(phone, 'menu_principal', ctx);
    await mostrarMenuPrincipal(phone);
    return [{ json: { action: 'volver_menu', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No puede elegir accion sobre turno');
  }
  await sendButtons(phone, '¿Qué querés hacer con el turno? Tocá un botón:', [{id:'accion_cancelar',title:'Cancelar'},{id:'accion_reprogramar',title:'Reprogramar'},{id:'accion_volver',title:'Volver'}]);
  return [{ json: { action: 'accion_retry', phone } }];
}

if (estado === 'confirmar_cancelacion') {
  if (btnId === 'cancel_si') {
    await supaUpdate('consultorio_turnos', {id:`eq.${ctx.turnoACancelar.id}`}, {estado:'cancelado'});
    await sendText(phone, `\u2705 Turno cancelado.\n\n📅 ${ctx.turnoACancelar.fecha}, ${ctx.turnoACancelar.hora} hs\n👨\u200d\u2695\ufe0f ${ctx.turnoACancelar.profNombre}\n\nCuando quieras sacar otro turno, escribime. 👋`);
    await triggerAdelanto(ctx.turnoACancelar.fechaHoraISO, ctx.turnoACancelar.profId, ctx.pacienteId);
    ctx.turnoACancelar = undefined;
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'turno_cancelled', phone } }];
  }
  if (btnId === 'cancel_no') {
    await updateConv(phone, 'menu_principal', ctx);
    await sendText(phone, 'Perfecto, no se canceló nada.');
    await mostrarMenuPrincipal(phone);
    return [{ json: { action: 'cancel_aborted', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No puede confirmar cancelacion');
  }
  await sendButtons(phone, '¿Cancelar el turno? Tocá un botón:', [{id:'cancel_si',title:'Sí, cancelar'},{id:'cancel_no',title:'No, me arrepentí'}]);
  return [{ json: { action: 'cancel_confirm_retry', phone } }];
}

if (estado === 'respuesta_reminder') {
  const tId = ctx.turnoId;
  if (btnId === 'rem_confirmar') {
    await supaUpdate('consultorio_turnos', {id:`eq.${tId}`}, {estado:'confirmado'});
    await sendText(phone, '¡Genial, quedás confirmado! Mañana a la mañana te mando la dirección y el link para hacer check-in rápido. Nos vemos! 👋');
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'reminder_confirmed', phone } }];
  }
  if (btnId === 'rem_reprogramar') {
    await supaUpdate('consultorio_turnos', {id:`eq.${tId}`}, {estado:'cancelado'});
    if (ctx.profesionalId) {
      try { const _tf=await supaGet('consultorio_turnos',{id:`eq.${tId}`,select:'fecha_hora,paciente_id'}); if(_tf?.[0]) await triggerAdelanto(_tf[0].fecha_hora, ctx.profesionalId, _tf[0].paciente_id); } catch(e) {}
    }
    await sendText(phone, 'Sin problema, turno cancelado. Vamos a buscar otro horario:');
    ctx.turnoId = undefined;
    await mostrarDias(phone, ctx);
    return [{ json: { action: 'reminder_reschedule', phone } }];
  }
  if (btnId === 'rem_cancelar') {
    await supaUpdate('consultorio_turnos', {id:`eq.${tId}`}, {estado:'cancelado'});
    if (ctx.profesionalId) {
      try { const _tf2=await supaGet('consultorio_turnos',{id:`eq.${tId}`,select:'fecha_hora,paciente_id'}); if(_tf2?.[0]) await triggerAdelanto(_tf2[0].fecha_hora, ctx.profesionalId, _tf2[0].paciente_id); } catch(e) {}
    }
    await sendText(phone, '\u2705 Turno cancelado. Cuando quieras sacar otro, escribime. 👋')
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'reminder_cancelled', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No puede responder al reminder');
  }
  await sendButtons(phone, `Tenés turno mañana con ${ctx.profesionalNombre}. ¿Confirmás? Tocá un botón:`, [{id:'rem_confirmar',title:'Sí, confirmo'},{id:'rem_reprogramar',title:'Reprogramar'},{id:'rem_cancelar',title:'Cancelar'}]);
  return [{ json: { action: 'reminder_resent', phone } }];
}

// ── ESTADO: esperando_calificacion (Post-consulta — Fase 3) ──
if (estado === 'esperando_calificacion') {
  let calif = 0;
  if (btnId?.startsWith('calif_')) { calif = parseInt(btnId.split('_')[1]) || 0; }
  else { const n = parseInt(texto); if (n >= 1 && n <= 5) calif = n; }

  if (!calif) {
    ctx.retry_count = (ctx.retry_count || 0) + 1;
    ctx.last_failed_state = estado;
    await updateConv(phone, estado, ctx);
    if (ctx.retry_count >= 2) {
      return await sendHandoffWithContext(phone, ctx, estado, 'No puede calificar la consulta');
    }
    await sendText(phone, 'Por favor elegí una opción del 1 al 5.');
    return [{ json: { action: 'calif_retry', phone } }];
  }

  ctx.retry_count = 0;
  await supaInsert('consultorio_feedback', { turno_id: ctx.turno_feedback_id, calificacion: calif });

  if (calif >= 4) {
    await sendText(phone, `¡Nos alegra que hayas tenido una buena experiencia! 😊\n\n¿Nos ayudás con una reseña en Google?\n👉 ${GOOGLE_REVIEWS_URL}`);
    await sendButtons(phone, `¿Necesitás agendar un control con ${ctx.profesionalNombre}?`, [{ id: 'fb_seguimiento_si', title: 'Sí, agendar' }, { id: 'fb_seguimiento_no', title: 'No, gracias' }]);
    await updateConv(phone, 'esperando_seguimiento', ctx);
    return [{ json: { action: 'calif_alta', phone, calif } }];
  }

  if (calif === 3) {
    await sendButtons(phone, `Gracias por tu opinión. ¿Necesitás agendar un control con ${ctx.profesionalNombre}?`, [{ id: 'fb_seguimiento_si', title: 'Sí, agendar' }, { id: 'fb_seguimiento_no', title: 'No, gracias' }]);
    await updateConv(phone, 'esperando_seguimiento', ctx);
    return [{ json: { action: 'calif_media', phone, calif } }];
  }

  await sendText(phone, 'Lamentamos que no haya sido una buena experiencia. ¿Querés contarnos qué pasó?');
  await updateConv(phone, 'esperando_comentario_neg', ctx);
  return [{ json: { action: 'calif_baja', phone, calif } }];
}

// ── ESTADO: esperando_comentario_neg ──
if (estado === 'esperando_comentario_neg') {
  const comentario = texto || '(sin comentario)';
  await supaUpdate('consultorio_feedback', { turno_id: `eq.${ctx.turno_feedback_id}` }, { comentario });
  await sendText(phone, 'Gracias, lo vamos a revisar. Si necesitás algo más, escribime. 👋');
  await updateConv(phone, 'inicio', {});
  return [{ json: { action: 'comentario_neg_guardado', phone } }];
}

// ── ESTADO: esperando_seguimiento ──
if (estado === 'esperando_seguimiento') {
  if (btnId === 'fb_seguimiento_si') {
    const bookingToken = Date.now().toString(36) + Math.random().toString(36).substring(2);
    ctx.bookingToken = bookingToken;
    const N8N_BASE = $env.WEBHOOK_URL || $env.N8N_HOST || '';
    const bookingUrl = `${N8N_BASE}/webhook/consultorio-turnos?token=${bookingToken}`;
    await updateConv(phone, 'esperando_booking_web', { ...ctx, turno_feedback_id: undefined });
    await sendCTAUrl(phone,
      `📅 Turno de control con ${ctx.profesionalNombre}\n\nTocá el botón para elegir horario.\n\n📱 Si el botón no abre, entrá desde acá:\n${bookingUrl}`,
      'Agendar control',
      bookingUrl);
    return [{ json: { action: 'seguimiento_si', phone } }];
  }
  if (btnId === 'fb_seguimiento_no' || texto.toLowerCase().includes('no')) {
    await sendText(phone, '¡Perfecto! Que estés bien. Si necesitás algo, escribime. 👋');
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'seguimiento_no', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    await sendText(phone, '¡Perfecto! Que estés bien. Si necesitás algo, escribime. 👋');
    await updateConv(phone, 'inicio', {});
    return [{ json: { action: 'seguimiento_timeout', phone } }];
  }
  await sendButtons(phone, `¿Querés agendar un control con ${ctx.profesionalNombre}?`, [{ id: 'fb_seguimiento_si', title: 'Sí, agendar' }, { id: 'fb_seguimiento_no', title: 'No, gracias' }]);
  return [{ json: { action: 'seguimiento_retry', phone } }];
}

if (estado === 'confirmar_datos') {
  if (btnId === 'confirmar_datos_ok') {
    ctx.retry_count = 0;
    await updateConv(phone, 'elegir_dia', ctx);
    await mostrarDias(phone, ctx);
    return [{ json: { action: 'datos_confirmados', phone } }];
  }
  if (btnId === 'edit_nombre') {
    ctx.retry_count = 0;
    await updateConv(phone, 'esperando_nombre', { ...ctx, edicion: true });
    await sendText(phone, '¿Cuál es tu nombre completo?');
    return [{ json: { action: 'edit_nombre', phone } }];
  }
  if (btnId === 'edit_os') {
    ctx.retry_count = 0;
    await updateConv(phone, 'esperando_obra_social', { ...ctx, edicion: true, pregOS: undefined });
    await sendButtons(phone, '¿Tenés obra social o prepaga?',
      [{ id: 'os_si', title: 'Sí, tengo' }, { id: 'os_no', title: 'No, particular' }]);
    return [{ json: { action: 'edit_os', phone } }];
  }
  if (btnId === 'edit_especialidad') {
    ctx.retry_count = 0;
    await updateConv(phone, 'esperando_especialidad', { ...ctx, edicion: true });
    await mostrarEsps(phone);
    return [{ json: { action: 'edit_especialidad', phone } }];
  }
  if (btnId === 'edit_profesional') {
    ctx.retry_count = 0;
    await updateConv(phone, 'esperando_profesional', { ...ctx, edicion: true });
    const pe = await supaGet('consultorio_profesionales',
      { especialidad: `eq.${ctx.especialidad}`, activo: 'eq.true',
        select: 'id,nombre,consultorio', order: 'nombre.asc' });
    await sendList(phone, `En ${ctx.especialidad} tenemos:`, 'Ver profesionales',
      [{ title: ctx.especialidad, rows: pe.map(p => ({ id: `prof_${p.id}`, title: p.nombre, description: p.consultorio || '' })) }]);
    return [{ json: { action: 'edit_profesional', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No puede confirmar datos');
  }
  await mostrarResumenConfirmacion(phone, ctx);
  return [{ json: { action: 'confirmar_datos_retry', phone } }];
}

if (estado === 'actualizar_datos') {
  if (btnId === 'actualizar_os') {
    ctx.retry_count = 0;
    await updateConv(phone, 'esperando_obra_social',
      { ...ctx, edicion: true, modoActualizacion: true, pregOS: undefined });
    await sendButtons(phone, '¿Tenés obra social o prepaga?',
      [{ id: 'os_si', title: 'Sí, tengo' },
       { id: 'os_no', title: 'No, particular' }]);
    return [{ json: { action: 'actualizar_os_start', phone } }];
  }
  if (btnId === 'actualizar_volver') {
    ctx.retry_count = 0;
    await updateConv(phone, 'menu_principal', ctx);
    await mostrarMenuPrincipal(phone);
    return [{ json: { action: 'actualizar_volver_menu', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No puede actualizar datos');
  }
  await mostrarOpcionesActualizar(phone, ctx);
  return [{ json: { action: 'actualizar_retry', phone } }];
}

if (estado === 'verificar_datos') {
  if (btnId === 'verif_ok') {
    ctx.retry_count = 0;
    await updateConv(phone, 'menu_principal', ctx);
    await mostrarMenuPrincipal(phone);
    return [{ json: { action: 'datos_verificados_ok', phone } }];
  }
  if (btnId === 'verif_actualizar') {
    ctx.retry_count = 0;
    await updateConv(phone, 'actualizar_datos', ctx);
    await mostrarOpcionesActualizar(phone, ctx);
    return [{ json: { action: 'ir_actualizar_desde_verif', phone } }];
  }
  ctx.retry_count = (ctx.retry_count || 0) + 1;
  ctx.last_failed_state = estado;
  await updateConv(phone, estado, ctx);
  if (ctx.retry_count >= 2) {
    return await sendHandoffWithContext(phone, ctx, estado, 'No responde a verificacion de datos');
  }
  await sendButtons(phone, '¿Tus datos siguen iguales?',
    [{ id: 'verif_ok', title: 'Sí, todo igual' },
     { id: 'verif_actualizar', title: 'Actualizar' }]);
  return [{ json: { action: 'verif_retry', phone } }];
}

const classification = await classifyInput(texto, estado);
ctx.retry_count = (ctx.retry_count || 0) + 1;
ctx.last_failed_state = estado;

if (classification.sentiment === 'frustrado') {
  return await sendHandoffWithContext(phone, ctx, estado, 'Paciente frustrado');
}

if (ctx.retry_count >= 2) {
  return await sendHandoffWithContext(phone, ctx, estado, `${ctx.retry_count} intentos sin entender`);
}

if (classification.confidence === 'alta') {
  ctx.retry_count = 0;
  if (classification.intent === 'recepcion') {
    return await sendHandoffWithContext(phone, ctx, estado, 'Paciente pidio recepcion (detectado por IA)');
  }
  if (classification.intent === 'turno' && ctx.pacienteId) {
    await updateConv(phone, 'esperando_especialidad', ctx);
    await mostrarEsps(phone);
    return [{ json: { action: 'fallback_redirect_turno', phone } }];
  }
  if (classification.intent === 'cancelar' && ctx.pacienteId) {
    await updateConv(phone, 'menu_principal', ctx);
    await mostrarMenuPrincipal(phone);
    return [{ json: { action: 'fallback_redirect_menu', phone } }];
  }
}

await updateConv(phone, estado, ctx);
await sendButtons(phone,
  'Perdón, no te entendí. ¿Qué necesitás?',
  [
    { id: 'fb_turno', title: 'Sacar turno' },
    { id: 'fb_cancelar', title: 'Cancelar/Cambiar' },
    { id: 'fb_recepcion', title: 'Hablar con alguien' }
  ]
);
return [{ json: { action: 'fallback_graduated', phone, retry: ctx.retry_count, classification } }];

} catch (error) {
  const is24hExpired = error.message && error.message.includes('131047');

  if (is24hExpired) {
    // Sesión de 24hs expirada — resetear silenciosamente, no intentar responder (también fallaría)
    try { await supaUpdate('consultorio_conversaciones', { telefono_wa: `eq.${phone}` }, { estado: 'inicio', contexto: {} }); } catch(e) {}
    try {
      await helpers.httpRequest({
        method: 'POST',
        url: `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: `ℹ️ Sesión 24hs expirada\nPhone: ${phone}\nEstado previo: ${estado||'?'}\nConversación reseteada.` })
      });
    } catch(e) {}
    return [{ json: { action: 'session_expired', phone } }];
  }

  // Error técnico: NO marcar handoff_humano (no hay humano real atendiendo).
  // Resetear estado para que el paciente pueda reintentar desde el principio.
  await alertTelegram(`Phone: ${phone}\nEstado: ${estado||'?'}\nError: ${error.message}`);
  try {
    await supaUpdate('consultorio_conversaciones', { telefono_wa: `eq.${phone}` }, { estado: 'inicio', contexto: {} });
    await sendText(phone, `Perdón, tuve un problema técnico. 😔\n\nEscribí "hola" para empezar de nuevo, o llamanos al ${CONSULTORIO.telefono} si seguís con dificultades.`);
  } catch(e) {
    try { await sendText(phone, `Perdón, tuve un problema técnico. Llamanos al ${CONSULTORIO.telefono} para que te ayudemos.`); } catch(e2) {}
  }
  return [{ json: { action: 'error', phone, error: error.message } }];
}
