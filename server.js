const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'appointments.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

const services = {
  "1": { name: "Corte degradê ou social", duration: 30 },
  "2": { name: "Corte navalhado", duration: 30 },
  "3": { name: "Barba", duration: 30 },
  "4": { name: "Corte e Barba", duration: 60 },
  "5": { name: "Corte pai e filho", duration: 60 },
  "6": { name: "2 cortes + 1 barba", duration: 90 },
  "7": { name: "Corte raspado 1 máquina", duration: 30 },
  "8": { name: "Corte raspado shaver ou lâmina", duration: 30 },
  "9": { name: "Corte feminino", duration: 60 }
};

const sessions = new Map();

function readAppointments() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function writeAppointments(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function localDateOnly(input) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseBRDate(text) {
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec((text || '').trim());
  if (!m) return null;
  let year = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (year < 100) year += 2000;
  const d = new Date(year, Number(m[2]) - 1, Number(m[1]), 12, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return `${year}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
}

function minutes(hhmm) {
  const [h,m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function hhmm(mins) {
  return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
}

function windowsFor(dateStr) {
  const d = localDateOnly(dateStr);
  if (!d) return [];
  const dow = d.getDay();
  if (dow === 0) return [];
  if (dow === 6) return [[8*60, 12*60]];
  return [[9*60, 12*60], [14*60, 17*60], [18*60, 20*60]];
}

function slotsFor(dateStr, duration) {
  const appts = readAppointments().filter(a => a.date === dateStr && a.status !== 'cancelled');
  const out = [];
  for (const [start,end] of windowsFor(dateStr)) {
    for (let t = start; t + duration <= end; t += 30) {
      const collision = appts.some(a => {
        const aStart = minutes(a.time);
        const aEnd = aStart + a.duration;
        return t < aEnd && (t + duration) > aStart;
      });
      if (!collision) out.push(hhmm(t));
    }
  }
  return out;
}

function createAppointment({name, phone, serviceKey, date, time, source='web'}) {
  const service = services[serviceKey];
  if (!service) throw new Error('Serviço inválido');
  if (!slotsFor(date, service.duration).includes(time)) throw new Error('Horário indisponível');
  const items = readAppointments();
  const appt = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
    name, phone, service: service.name, serviceKey,
    duration: service.duration, date, time, source,
    status: 'confirmed', createdAt: new Date().toISOString()
  };
  items.push(appt);
  writeAppointments(items);
  return appt;
}

app.get('/api/services', (_, res) => res.json(services));

app.get('/api/availability', (req, res) => {
  const { date, service } = req.query;
  if (!services[service]) return res.status(400).json({error:'Serviço inválido'});
  res.json({date, service: services[service], slots: slotsFor(date, services[service].duration)});
});

app.get('/api/appointments', (req, res) => {
  const user = req.get('x-admin-user');
  const pass = req.get('x-admin-password');
  if (user !== (process.env.ADMIN_USER || 'Glacsantos') || pass !== (process.env.ADMIN_PASSWORD || 'troque-esta-senha')) {
    return res.status(401).json({error:'Não autorizado'});
  }
  const items = readAppointments().sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  res.json(items);
});

app.post('/api/appointments', (req, res) => {
  try {
    const { name, phone, service, date, time } = req.body;
    if (!name || !phone || !service || !date || !time) return res.status(400).json({error:'Preencha todos os campos'});
    const appt = createAppointment({name, phone, serviceKey: service, date, time, source:'web'});
    res.status(201).json(appt);
  } catch (e) {
    res.status(409).json({error:e.message});
  }
});

app.patch('/api/appointments/:id/cancel', (req,res) => {
  const user = req.get('x-admin-user');
  const pass = req.get('x-admin-password');
  if (user !== (process.env.ADMIN_USER || 'Glacsantos') || pass !== (process.env.ADMIN_PASSWORD || 'troque-esta-senha')) {
    return res.status(401).json({error:'Não autorizado'});
  }
  const items = readAppointments();
  const item = items.find(a => a.id === req.params.id);
  if (!item) return res.status(404).json({error:'Agendamento não encontrado'});
  item.status = 'cancelled';
  writeAppointments(items);
  res.json(item);
});

// Verificação do webhook da Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

async function sendWhatsAppText(to, body) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || 'v23.0';
  if (!token || !phoneId) {
    console.log(`[WhatsApp simulado] Para ${to}: ${body}`);
    return;
  }
  const resp = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: 'POST',
    headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    })
  });
  if (!resp.ok) console.error('Erro WhatsApp:', await resp.text());
}

function serviceMenu() {
  return Object.entries(services).map(([k,v]) => `${k} - ${v.name} (${v.duration} min)`).join('\n');
}

async function handleWhatsApp(from, text, profileName='Cliente') {
  const t = (text || '').trim();
  let s = sessions.get(from);

  if (!s || /^(oi|olá|ola|menu|agendar)$/i.test(t)) {
    s = { step:'service', name: profileName };
    sessions.set(from, s);
    await sendWhatsAppText(from, `Olá, ${profileName}! 👋\nBem-vindo ao Glauco Barbeiro.\n\nEscolha o serviço digitando o número:\n${serviceMenu()}`);
    return;
  }

  if (s.step === 'service') {
    if (!services[t]) return sendWhatsAppText(from, `Opção inválida. Digite um número de 1 a 9:\n${serviceMenu()}`);
    s.serviceKey = t; s.step = 'date';
    return sendWhatsAppText(from, `Você escolheu: ${services[t].name}.\nDigite a data desejada no formato DD/MM.`);
  }

  if (s.step === 'date') {
    const date = parseBRDate(t);
    if (!date) return sendWhatsAppText(from, 'Data inválida. Digite no formato DD/MM, por exemplo 15/08.');
    const slots = slotsFor(date, services[s.serviceKey].duration);
    if (!slots.length) return sendWhatsAppText(from, 'Não há horários disponíveis nessa data. Digite outra data no formato DD/MM.');
    s.date = date; s.step = 'time';
    return sendWhatsAppText(from, `Horários disponíveis:\n${slots.join('  |  ')}\n\nDigite o horário desejado, por exemplo 09:30.`);
  }

  if (s.step === 'time') {
    const valid = slotsFor(s.date, services[s.serviceKey].duration);
    if (!valid.includes(t)) return sendWhatsAppText(from, `Horário indisponível. Escolha um destes:\n${valid.join('  |  ')}`);
    try {
      const appt = createAppointment({
        name: s.name, phone: from, serviceKey: s.serviceKey,
        date: s.date, time: t, source: 'whatsapp'
      });
      sessions.delete(from);
      const [y,m,d] = appt.date.split('-');
      return sendWhatsAppText(from, `✅ Agendamento confirmado!\n\n${appt.service}\n📅 ${d}/${m}/${y}\n🕒 ${appt.time}\n\nGlauco Barbeiro`);
    } catch (e) {
      return sendWhatsAppText(from, `Esse horário acabou de ficar indisponível. Digite outro horário.`);
    }
  }
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contacts = value.contacts || [];
        for (const msg of value.messages || []) {
          if (msg.type !== 'text') continue;
          const contact = contacts.find(c => c.wa_id === msg.from);
          const name = contact?.profile?.name || 'Cliente';
          await handleWhatsApp(msg.from, msg.text?.body || '', name);
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
});

app.get('/health', (_,res) => res.json({ok:true, app:'Glauco Barbeiro', version:'16.1'}));

app.listen(PORT, () => console.log(`Glauco Barbeiro V16.1 rodando na porta ${PORT}`));
