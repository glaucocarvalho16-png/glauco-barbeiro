const $ = s => document.querySelector(s);
let creds={};
async function load(){
  creds={user:$('#user').value,pass:$('#pass').value};
  const r=await fetch('/api/appointments',{headers:{'x-admin-user':creds.user,'x-admin-password':creds.pass}});
  const msg=$('#adminmsg'), box=$('#appointments');
  if(!r.ok){msg.textContent='Usuário ou senha inválidos.';msg.className='err';box.innerHTML='';return}
  msg.textContent='Agenda carregada.';msg.className='ok';
  const items=await r.json();
  box.innerHTML=items.length?'':'<p class="muted">Nenhum agendamento.</p>';
  items.forEach(a=>{
    const [y,m,d]=a.date.split('-');
    const el=document.createElement('div');el.className='appt';
    el.innerHTML=`<strong>${d}/${m}/${y} • ${a.time}</strong><br>${a.name} — ${a.service}<br><span class="muted">${a.phone} • ${a.source} • ${a.status}</span>${a.status!=='cancelled'?`<br><button class="cancel" data-id="${a.id}">Cancelar</button>`:''}`;
    box.appendChild(el);
  });
  document.querySelectorAll('.cancel').forEach(b=>b.onclick=async()=>{
    await fetch('/api/appointments/'+b.dataset.id+'/cancel',{method:'PATCH',headers:{'x-admin-user':creds.user,'x-admin-password':creds.pass}});
    load();
  });
}
$('#load').onclick=load;
