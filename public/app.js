const $ = s => document.querySelector(s);
const service = $('#service'), date = $('#date'), time = $('#time'), msg = $('#msg');

async function loadServices(){
  const data = await fetch('/api/services').then(r=>r.json());
  for(const [k,v] of Object.entries(data)){
    const o=document.createElement('option');o.value=k;o.textContent=`${v.name} — ${v.duration} min`;service.appendChild(o);
  }
}
async function loadSlots() {
  time.innerHTML = '<option value="">Carregando...</option>';

  if (!service.value || !date.value) {
    time.innerHTML = '<option value="">Selecione serviço e data</option>';
    return;
  }

  try {
    const url = `/api/availability?date=${encodeURIComponent(date.value)}&service=${encodeURIComponent(service.value)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Erro ${response.status}`);
    }

    const data = await response.json();

    time.innerHTML = '<option value="">Selecione um horário</option>';

    if (!data.slots || data.slots.length === 0) {
      time.innerHTML = '<option value="">Sem horários disponíveis</option>';
      return;
    }

    data.slots.forEach(slot => {
      const option = document.createElement('option');
      option.value = slot;
      option.textContent = slot;
      time.appendChild(option);
    });
  } catch (error) {
    console.error(error);
    time.innerHTML = '<option value="">Erro ao carregar horários</option>';
  }
}
service.onchange=loadSlots;date.onchange=loadSlots;

$('#form').onsubmit=async e=>{
  e.preventDefault();msg.textContent='Salvando...';msg.className='';
  const body={name:$('#name').value,phone:$('#phone').value,service:service.value,date:date.value,time:time.value};
  const r=await fetch('/api/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json();
  if(!r.ok){msg.textContent=data.error||'Erro ao agendar';msg.className='err';return}
  const [y,m,d]=data.date.split('-');
  msg.innerHTML=`✅ <b>Agendamento confirmado!</b><br>${data.service}<br>${d}/${m}/${y} às ${data.time}`;
  msg.className='ok';
  e.target.reset(); time.innerHTML='<option value="">Selecione serviço e data</option>';
};
loadServices();
