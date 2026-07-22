const API_URL='https://script.google.com/macros/s/AKfycbxmcVMZvlt2wxVHqDok_aYYd8jg9yNE6EbNE_bz39QeXuIfzwKXp5_53oFaprRhbvTA/exec';
let trackingCode="",refreshTimer=null,loading=false;

async function api(action,data={}){
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    const r=await fetch(API_URL,{method:"POST",cache:"no-store",signal:controller.signal,body:JSON.stringify({action,...data,_t:Date.now()})});
    clearTimeout(timer);
    const text=await r.text();
    try{return JSON.parse(text)}catch(e){return {ok:false,error:"Resposta inválida do servidor."}}
  }catch(e){return {ok:false,error:"Falha de conexão. Tente novamente."}}
}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function setLoading(on){
  loading=on;
  const btn=document.getElementById("trackButton");
  btn.disabled=on;
  btn.innerHTML=on?'<span class="loader"></span> Buscando...':'<i class="fa-solid fa-magnifying-glass-location"></i> Rastrear';
}
async function startTracking(){
  if(loading)return;
  const code=document.getElementById("trackingCode").value.trim();
  if(!code)return showLoginError("Digite o código do cliente, da empresa ou o Código CT.");
  trackingCode=code;
  localStorage.setItem("pegaleva_tracking_code",code);
  setLoading(true);
  const ok=await loadTracking(true);
  setLoading(false);
  if(ok)scheduleRefresh();
}
function showLoginError(msg){document.getElementById("loginError").innerHTML='<div class="error">'+esc(msg)+'</div>'}
function scheduleRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(async()=>{await loadTracking(false);scheduleRefresh()},5000);
}
async function loadTracking(first){
  const res=await api("getTrackingPanel",{codigo:trackingCode});
  if(!res.ok){
    if(first)showLoginError(res.error||"Código não encontrado.");
    document.getElementById("refreshNote").innerText="Não foi possível atualizar agora. Tentando novamente...";
    return false;
  }
  document.getElementById("loginCard").classList.add("hidden");
  document.getElementById("trackingPanel").classList.remove("hidden");
  renderTracking(res);
  return true;
}
function statusClass(status){
  const s=String(status||"").toLowerCase();
  if(s.includes("finalizada"))return "done";
  if(s.includes("cancelada"))return "bad";
  if(s.includes("dificuldade"))return "warn";
  return "";
}
function renderTracking(res){
  const d=res.entregaAtual;
  document.getElementById("clientName").innerText=res.cliente?.nome||"Cliente";
  if(!d){
    document.getElementById("statusLabel").innerText="Nenhuma entrega localizada";
    document.getElementById("currentTitle").innerText="Sem entrega ativa";
    document.getElementById("currentMessage").innerText="Ainda não há entrega vinculada a este código.";
    document.getElementById("estimateText").innerText="--";
    document.getElementById("historyList").innerHTML='<p style="color:var(--muted)">Nenhum histórico encontrado.</p>';
    return;
  }
  const pill=document.getElementById("statusPill");
  pill.className="status-pill "+statusClass(d.status);
  document.getElementById("statusLabel").innerText=d.statusLabel||d.status;
  document.getElementById("recordCode").innerText=(d.tipoRegistro==="CORRIDA"?"Corrida ":"Entrega ")+(d.codigoCT||d.id||"");
  document.getElementById("estimateText").innerText=d.estimativaTexto||"Até 20 min";
  document.getElementById("driverName").innerText=d.entregador?.nome||"Aguardando entregador";
  document.getElementById("driverPlate").innerText=d.entregador?.placa?("Placa: "+d.entregador.placa):"O entregador aparecerá aqui";
  document.getElementById("currentTitle").innerText=d.statusLabel||"Situação da entrega";
  document.getElementById("currentMessage").innerText=d.statusMessage||"A entrega está em andamento.";
  document.getElementById("pickupText").innerText=[d.coleta?.endereco,d.coleta?.bairro].filter(Boolean).join(" • ")||"Local de coleta não informado";
  document.getElementById("destinationText").innerText=[d.destino?.endereco,d.destino?.bairro,d.destino?.nome].filter(Boolean).join(" • ")||"Local de destino não informado";

  const step=Math.max(0,Number(d.step||0));
  document.querySelectorAll(".step").forEach(el=>{
    const n=Number(el.dataset.step);
    el.classList.toggle("done",n<step);
    el.classList.toggle("active",n===step);
  });
  document.getElementById("timelineProgress").style.width=Math.min(86,Math.max(0,step*21.5))+"%";
  document.getElementById("refreshNote").innerText="Atualizado agora • atualização automática a cada 5 segundos.";

  document.getElementById("historyList").innerHTML=(res.entregas||[]).map(item=>`
    <div class="history-item">
      <div><strong>${esc(item.statusLabel||item.status)}</strong><small>${esc(item.tipoRegistro==="CORRIDA"?(item.codigoCT||item.id):item.id)} • ${esc(item.atualizadoEm||item.criadoEm)}</small></div>
      <b>${money(item.valor)}</b>
    </div>`).join("")||'<p style="color:var(--muted)">Nenhum histórico encontrado.</p>';
}
function changeCode(){
  clearTimeout(refreshTimer);
  document.getElementById("trackingPanel").classList.add("hidden");
  document.getElementById("loginCard").classList.remove("hidden");
  document.getElementById("loginError").innerHTML="";
  document.getElementById("trackingCode").focus();
}
document.getElementById("trackingCode").addEventListener("keydown",e=>{if(e.key==="Enter")startTracking()});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&trackingCode)loadTracking(false)});
const saved=localStorage.getItem("pegaleva_tracking_code");
if(saved){document.getElementById("trackingCode").value=saved;trackingCode=saved;setTimeout(startTracking,250)}
