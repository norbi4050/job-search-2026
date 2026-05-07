// ============================================================
// WF-MONTHLY-REPORT: Reporte mensual de métricas
// Corre el día 1 de cada mes a las 9:00 ART (12:00 UTC).
// Envía template reporte_mensual al admin/médico del consultorio.
// ============================================================

const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const WA_TOKEN = $env.META_WHATSAPP_TOKEN;
const PHONE_ID = $env.WA_PHONE_NUMBER_ID;
const ADMIN_PHONE = $env.CONSULTORIO_ADMIN_WA;
const CONSULTORIO_NOMBRE = $env.CONSULTORIO_NOMBRE || 'Consultorio';
const TG_BOT_TOKEN = '8736535917:AAEgHkDacG5kPaKSGIJa4dR0XjJNhIkaX0U';
const TG_CHAT_ID = '6343825256';
const OFFSET_ART = -3 * 60 * 60 * 1000;

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

async function supaFetch(path) {
  return await helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/${path}`,
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
}

async function alertTelegram(msg) {
  try {
    await helpers.httpRequest({
      method: 'POST',
      url: `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'HTML' })
    });
  } catch(e) {}
}

function formatPhone(phone) {
  if (!phone) return '';
  let p = phone.replace(/[^0-9]/g, '');
  if (p.startsWith('54') && p.length >= 12) return p;
  if (p.startsWith('9') && p.length >= 10) return '54' + p;
  if (p.length === 10) return '549' + p;
  return p;
}

// Retorna { start, end, month, year } en UTC para un mes N meses atrás (ART)
function getMonthRange(monthsAgo) {
  const now = new Date();
  const nowART = new Date(now.getTime() + OFFSET_ART);
  const d = new Date(nowART.getFullYear(), nowART.getMonth() - monthsAgo, 1);
  // 00:00 ART = 03:00 UTC
  const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 3, 0, 0));
  const end   = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1, 3, 0, 0));
  return { start: start.toISOString(), end: end.toISOString(), month: d.getMonth(), year: d.getFullYear() };
}

function calcMetrics(turnos) {
  const total         = turnos.length;
  const completados   = turnos.filter(t => t.estado === 'completado').length;
  const cancelados    = turnos.filter(t => t.estado === 'cancelado').length;
  const recordatorios = turnos.filter(t => t.recordatorio_enviado === true).length;
  // Para mes ya cerrado todos los turnos son pasados — agendado/confirmado = no-show
  const noShowEstimado = turnos.filter(t => ['agendado','confirmado'].includes(t.estado)).length;
  const turnosPasados  = completados + cancelados + noShowEstimado;
  const tasaNoShow     = turnosPasados > 0 ? Math.round((noShowEstimado / turnosPasados) * 100) : 0;
  return { total, completados, cancelados, recordatorios, noShowEstimado, tasaNoShow };
}

// Guard: permite deshabilitar desde EasyPanel sin tocar código
if ($env.REPORTE_MENSUAL_HABILITADO === 'false') {
  return [{ json: { action: 'disabled', reason: 'REPORTE_MENSUAL_HABILITADO=false' } }];
}

if (!ADMIN_PHONE) {
  await alertTelegram('⚠️ WF-MONTHLY-REPORT: CONSULTORIO_ADMIN_WA no configurado — reporte no enviado');
  return [{ json: { action: 'error', reason: 'CONSULTORIO_ADMIN_WA not set' } }];
}

const mesAnterior    = getMonthRange(1);
const mesAntAnterior = getMonthRange(2);

const [turnosMes, turnosMesAnt] = await Promise.all([
  supaFetch(`consultorio_turnos?fecha_hora=gte.${mesAnterior.start}&fecha_hora=lt.${mesAnterior.end}&select=id,fecha_hora,estado,recordatorio_enviado`),
  supaFetch(`consultorio_turnos?fecha_hora=gte.${mesAntAnterior.start}&fecha_hora=lt.${mesAntAnterior.end}&select=id,fecha_hora,estado,recordatorio_enviado`)
]);

const metricas    = calcMetrics(turnosMes    || []);
const metricasAnt = calcMetrics(turnosMesAnt || []);

const mesLabel = `${MESES_ES[mesAnterior.month]} ${mesAnterior.year}`;

// Comparativa vs mes anterior
let comparativaMsg = '➡️ Sin datos del mes anterior para comparar.';
if ((turnosMesAnt || []).length > 0) {
  const delta = metricasAnt.tasaNoShow - metricas.tasaNoShow;
  if (delta > 0) {
    comparativaMsg = `📈 Mejora: -${delta} puntos vs mes anterior ✅`;
  } else if (delta < 0) {
    comparativaMsg = `📉 Sube: +${Math.abs(delta)} puntos vs mes anterior ⚠️`;
  } else {
    comparativaMsg = `➡️ Estable vs mes anterior.`;
  }
}

// {{6}} = ausencias + comparativa en una sola variable
const ausenciaStr = `${metricas.noShowEstimado} (${metricas.tasaNoShow}%) — ${comparativaMsg}`;

// Enviar template reporte_mensual (6 variables)
const params = [
  CONSULTORIO_NOMBRE,
  mesLabel,
  String(metricas.total),
  String(metricas.completados),
  String(metricas.recordatorios),
  ausenciaStr
];

const resp = await helpers.httpRequest({
  method: 'POST',
  url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
  headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: formatPhone(ADMIN_PHONE),
    type: 'template',
    template: {
      name: 'reporte_mensual',
      language: { code: 'es_AR' },
      components: [{
        type: 'body',
        parameters: params.map(t => ({ type: 'text', text: String(t) }))
      }]
    }
  })
});

if (!resp?.messages?.length) {
  await alertTelegram(`⚠️ WF-MONTHLY-REPORT fallo\nError: ${JSON.stringify(resp)}`);
  return [{ json: { action: 'error', response: resp } }];
}

await alertTelegram(`📊 WF-MONTHLY-REPORT: Reporte ${mesLabel} enviado a ${ADMIN_PHONE} ✅`);

return [{ json: { action: 'report_sent', mes: mesLabel, metricas } }];
