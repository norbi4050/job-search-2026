// Extraer mensaje de WhatsApp Cloud API payload
const body = $input.first().json?.body || $input.first().json;
const entry = body?.entry?.[0];
const changes = entry?.changes?.[0];
const value = changes?.value;

// Filtrar status updates (delivered, read, etc.)
if (!value?.messages || value.messages.length === 0) {
  return [{ json: { skip: true, reason: 'status_update' } }];
}

const msg = value.messages[0];
const contact = value.contacts?.[0];
const msgType = msg.type;

let textoMensaje = '';
let interactiveId = '';
let interactiveType = '';

switch (msgType) {
  case 'text':
    textoMensaje = msg.text?.body || '';
    break;
  case 'interactive':
    if (msg.interactive?.button_reply) {
      textoMensaje = msg.interactive.button_reply.title || '';
      interactiveId = msg.interactive.button_reply.id || '';
      interactiveType = 'button_reply';
    } else if (msg.interactive?.list_reply) {
      textoMensaje = msg.interactive.list_reply.title || '';
      interactiveId = msg.interactive.list_reply.id || '';
      interactiveType = 'list_reply';
    }
    break;
  case 'button':
    textoMensaje = msg.button?.text || '';
    break;
  case 'audio':
  case 'image':
  case 'video':
  case 'document':
    textoMensaje = '__MEDIA__';
    break;
  default:
    textoMensaje = '__DESCONOCIDO__';
}

// Normalizar telefono argentino
let phone = msg.from;
if (!phone) return [{ json: { skip: true, reason: 'no_phone' } }];
if (phone.startsWith('54') && !phone.startsWith('549') && phone.length === 12) {
  phone = '549' + phone.substring(2);
}

return [{ json: {
  messageId: msg.id,
  timestamp: msg.timestamp,
  phone: phone,
  contactName: contact?.profile?.name || 'Desconocido',
  msgType: msgType,
  textoMensaje: textoMensaje,
  interactiveId: interactiveId,
  interactiveType: interactiveType,
  skip: false
} }];

