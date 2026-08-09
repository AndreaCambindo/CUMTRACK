const API_URL='https://script.google.com/macros/s/AKfycbzRi3g_Z0vXpULdv2mZk3wytbCe_YmapFsz_hnbKotswREJBCT_Sv87Xzi7CmyPnUSatQ/exec';
const LOCAL_KEY='cumtrack_local_backup_v2';
const CONFIG_KEY='cumtrack_config_backup_v2';
let quotes=[];
let config={commercials:[],intermediaries:[]};
let statusId=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const money=v=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(v)||0);
const cls=s=>String(s||'').toLowerCase().replaceAll(' ','').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function saveBackup(){localStorage.setItem(LOCAL_KEY,JSON.stringify(quotes));localStorage.setItem(CONFIG_KEY,JSON.stringify(config))}
function jsonp(action,params={}){return new Promise((resolve,reject)=>{
  const cb='cumtrack_cb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const s=document.createElement('script');
  const q=new URLSearchParams({action,callback:cb,...params});
  const timer=setTimeout(()=>{cleanup();reject(new Error('Tiempo de espera agotado'));},12000);
  function cleanup(){clearTimeout(timer);delete window[cb];s.remove()}
  window[cb]=data=>{cleanup();resolve(data)};
  s.onerror=()=>{cleanup();reject(new Error('No fue posible conectar con Google Apps Script'))};
  s.src=API_URL+'?'+q.toString();
  document.body.appendChild(s);
})}
async function syncAll(){
  try{
    const [cq,cc,ci]=await Promise.all([jsonp('getQuotes'),jsonp('getCommercials'),jsonp('getIntermediaries')]);
    if(cq.success) quotes=cq.data||[];
    if(cc.success) config.commercials=cc.data||[];
    if(ci.success) config.intermediaries=ci.data||[];
    saveBackup(); fillForm(); render(); return true;
  }catch(e){
    quotes=JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]');
    config=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{"commercials":[],"intermediaries":[]}');
    fillForm();render();toast('Sin conexión: mostrando copia local');return false;
  }
}
async function apiWrite(action,data){
  // GET + JSONP also works for writes and returns a real response.
  return jsonp(action,data);
}
function go(page){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(page).classList.add('active');document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));if(page==='new')fillForm();render()}
function render(){
 const td=today();
 $('sToday').textContent=quotes.filter(q=>q.fecha===td).length;
 $('sQuoted').textContent=quotes.filter(q=>q.estado==='Cotizada').length;
 $('sNegotiation').textContent=quotes.filter(q=>q.estado==='En negociación').length;
 $('sWon').textContent=quotes.filter(q=>q.estado==='Ganada').length;
 $('sPending').textContent=quotes.filter(q=>['Cotizada','En negociación'].includes(q.estado)).length;
 $('today').innerHTML=table(quotes.filter(q=>q.fecha===td));
 const q=($('search')?.value||'').toLowerCase(),f=$('filter')?.value||'';
 $('all').innerHTML=table(quotes.filter(x=>(!q||`${x.tomador} ${x.nit} ${x.entidad} ${x.comercial}`.toLowerCase().includes(q))&&(!f||x.estado===f)));
 renderConfig();
}
function table(rows){
 if(!rows.length)return '<div class="empty">No hay cotizaciones para mostrar.</div>';
 return `<div class="table-wrap"><table><thead><tr><th>Tomador</th><th>Comercial</th><th>Tipo</th><th>Valor asegurado</th><th>Prima sin IVA</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>`+
 rows.map(x=>`<tr><td><strong>${esc(x.tomador)}</strong><span class="sub">${esc(x.nit)} · ${esc(x.entidad)}</span></td><td>${esc(x.comercial)}</td><td>${esc(x.tipo)}</td><td>${money(x.valor)}</td><td>${money(x.prima)}</td><td><span class="status ${cls(x.estado)}">${esc(x.estado)}</span></td><td><div class="actions"><button class="icon" title="Enviar recordatorio por WhatsApp" onclick="whatsapp('${x.id}')">💬</button><button class="icon" title="Cambiar estado" onclick="openStatus('${x.id}')">↻</button></div></td></tr>`).join('')+
 '</tbody></table></div>';
}
function fillForm(){
 $('fecha').value=today();
 $('comercial').innerHTML='<option value="">Seleccionar...</option>'+config.commercials.map(c=>`<option>${esc(c.name)}</option>`).join('');
 $('intermediario').innerHTML='<option value="">Seleccionar...</option>'+config.intermediaries.map(i=>`<option>${esc(i)}</option>`).join('');
}
function resetForm(){ $('quoteForm').reset();$('fecha').value=today();fillForm() }
$('quoteForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const q={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),fecha:$('fecha').value,tomador:$('tomador').value.trim(),nit:$('nit').value.trim(),entidad:$('entidad').value.trim(),comercial:$('comercial').value,tipo:$('tipo').value,valor:$('valor').value,prima:$('prima').value,tasa:$('tasa').value.trim(),intermediario:$('intermediario').value,estado:$('estado').value,observaciones:$('observaciones').value.trim()};
 const btn=e.submitter;btn.disabled=true;btn.textContent='Guardando...';
 try{
   const r=await apiWrite('saveQuote',q);
   if(!r.success) throw new Error(r.error||'No se pudo guardar');
   resetForm();await syncAll();toast('Cotización guardada en Google Sheets');go('dashboard');
 }catch(err){toast('No se pudo guardar: '+err.message)}
 finally{btn.disabled=false;btn.textContent='Guardar cotización'}
});
function openStatus(id){const q=quotes.find(x=>x.id===id);if(!q)return;statusId=id;$('modalInfo').textContent=`${q.tomador} · ${q.nit}`;$('newStatus').value=q.estado;$('modal').classList.remove('hidden')}
function closeStatus(){$('modal').classList.add('hidden');statusId=null}
$('saveStatus').onclick=async()=>{const q=quotes.find(x=>x.id===statusId);if(!q)return;const st=$('newStatus').value;try{const r=await apiWrite('updateStatus',{id:q.id,estado:st});if(!r.success)throw new Error(r.error||'No se pudo actualizar');await syncAll();toast('Estado actualizado en Google Sheets')}catch(e){toast('No se pudo actualizar: '+e.message)}closeStatus()};
$('closeModal').onclick=closeStatus;$('cancelStatus').onclick=closeStatus;
function whatsapp(id){
 const q=quotes.find(x=>x.id===id),c=config.commercials.find(x=>x.name===q?.comercial);
 if(!q)return;if(!c?.phone){alert('Primero agrega el número de WhatsApp de este comercial en Configuración.');return}
 const msg=[`Hola ${q.comercial} 👋`,'','Te comparto el seguimiento de esta cotización:','',
 `1. Tomador: ${q.tomador}`,`2. NIT: ${q.nit}`,`3. Entidad contratante: ${q.entidad}`,`4. Tipo de póliza: ${q.tipo}`,`5. Valor asegurado: ${money(q.valor)}`,`6. Prima sin IVA: ${money(q.prima)}`,`7. Tasa CUM - RCE: ${q.tasa||'No registrada'}`,`8. Intermediario: ${q.intermediario||'No registrado'}`,`9. Estado: ${q.estado}`,`10. Observaciones: ${q.observaciones||'Sin observaciones'}`,'','Por favor validar seguimiento. Gracias!!'].join('\n');
 window.open('https://wa.me/'+String(c.phone).replace(/\D/g,'')+'?text='+encodeURIComponent(msg),'_blank');
}
function renderConfig(){
 $('comList').innerHTML=config.commercials.length?config.commercials.map((c,i)=>`<div class="item"><span><strong>${esc(c.name)}</strong><br><small>${esc(c.phone)}</small></span><button class="icon" onclick="removeCom(${i})">×</button></div>`).join(''):'<div class="empty">Los comerciales se administran desde Google Sheets.</div>';
 $('intList').innerHTML=config.intermediaries.length?config.intermediaries.map(x=>`<div class="item"><span>${esc(x)}</span></div>`).join(''):'<div class="empty">Los intermediarios se administran desde Google Sheets.</div>';
}
async function removeCom(){toast('Edita los comerciales directamente en Google Sheets.')}
async function removeInt(){toast('Edita los intermediarios directamente en Google Sheets.')}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
$('search').addEventListener('input',render);$('filter').addEventListener('change',render);
fillForm();render();syncAll();
