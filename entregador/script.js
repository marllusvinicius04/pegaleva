
const APP_CACHE_VERSION="20260706-impecavel";
async function clearAppCache(){
  try{
    if("caches" in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
    if("serviceWorker" in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.update().catch(()=>{})));
    }
  }catch(e){}
}
function forceAppUpdate(){
  clearAppCache().finally(()=>{
    const url=new URL(window.location.href);
    url.searchParams.set("v",Date.now());
    window.location.replace(url.toString());
  });
}
clearAppCache();


const PIX_KEY="57293143000156";
const API_URL="https://script.google.com/macros/s/AKfycbx739xcgwZ0NTYdtj0pjFN0QAqyNh94PV96PxKRy90pOvKHOg1V0LFf-gjkrIsKaL1w/exec";

let openDeliveryDetails=JSON.parse(localStorage.getItem("pegaleva_open_delivery_details")||"[]"),
session=JSON.parse(localStorage.getItem("pegaleva_driver")||"null"),
chatDeliveryId="",
lastAvailableIds=JSON.parse(localStorage.getItem("pegaleva_seen_deliveries")||"[]"),
finalizedShown=JSON.parse(localStorage.getItem("pegaleva_finalized_driver")||"[]"),
showAllDriverDeliveries=false,
showAllHistory=false, saldoHidden=false, refusedDeliveries=JSON.parse(localStorage.getItem("pegaleva_refused_temp")||"{}"), currentModalDeliveryId="", modalQueue=[], pendingAvailableQueue=[], queueProcessing=false, refreshTimer=null, refreshBusy=false, deliveryAudioCtx=null, deliveryAudioUnlocked=false, fallbackBeepAudio=null;

if(session)openPanel();

const API_TIMEOUT_MS=22000;
const API_RETRY_DELAY_MS=1800;
let lastConnectionWarningAt=0;
let lastRefreshAt=0;
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function isTemporaryApiError(msg){
  msg=String(msg||"").toLowerCase();
  return msg.includes("tempo limite")||msg.includes("bloqueio")||msg.includes("lock")||msg.includes("manteve o bloqueio")||msg.includes("timeout")||msg.includes("failed to fetch")||msg.includes("networkerror")||msg.includes("falha de conexão");
}
async function api(action,data={},options={}){
  const retries=Number(options.retries??1);
  const timeoutMs=Number(options.timeoutMs??API_TIMEOUT_MS);
  let last={ok:false,error:"Conexão instável. Tentando novamente."};
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const r=await fetch(API_URL,{method:"POST",body:JSON.stringify({action,...data,_clientVersion:APP_CACHE_VERSION,_t:Date.now()}),signal:controller.signal,cache:"no-store"});
      clearTimeout(timer);
      const text=await r.text();
      let json={};
      try{json=JSON.parse(text)}catch(e){json={ok:false,error:"Resposta inválida do servidor."}}
      if(json&&json.ok)return json;
      last=json||last;
      if(!isTemporaryApiError(last.error)||attempt>=retries)break;
    }catch(err){
      clearTimeout(timer);
      last={ok:false,error:"Conexão instável com a planilha. Tentando novamente."};
      if(attempt>=retries)break;
    }
    await sleep(API_RETRY_DELAY_MS*(attempt+1));
  }
  return last;
}
function friendlyError(msg){
  msg=String(msg||"");
  if(isTemporaryApiError(msg))return "O sistema está sincronizando com a planilha. Aguarde alguns segundos e tente novamente.";
  return msg||"Não foi possível concluir agora. Tente novamente.";
}
function silentConnectionWarning(){
  const now=Date.now();
  if(now-lastConnectionWarningAt<60000)return;
  lastConnectionWarningAt=now;
  console.warn("PegaLeva:","consulta temporariamente ignorada para evitar bloqueio da planilha");
}
function primeiroNome(nome){
  const n=String(nome||"Entregador").trim().replace(/\s+/g," ");
  return n?n.split(" ")[0]:"Entregador";
}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function driverBalance(profile){
  const p=profile||{};
  const fields=["SaldoTotal","saldoTotal","Saldo","saldo","SaldoDisponivel","saldoDisponivel","valorDisponivel"];
  for(const field of fields){
    if(Object.prototype.hasOwnProperty.call(p,field)&&p[field]!==""&&p[field]!==null&&p[field]!==undefined){
      if(typeof p[field]==="number")return Number.isFinite(p[field])?p[field]:0;
      const raw=String(p[field]).trim();
      if(!raw)return 0;
      const normalized=raw.includes(",")
        ? raw.replace(/\./g,"").replace(",",".").replace(/[^0-9.-]/g,"")
        : raw.replace(/[^0-9.-]/g,"");
      const value=Number(normalized);
      return Number.isFinite(value)?value:0;
    }
  }
  return 0;
}
function onlyDigits(v){return String(v||"").replace(/\D/g,"")}
function cidadeRota(cidade){cidade=String(cidade||"").trim();if(cidade==="Uruçuí"||cidade==="Urucui"||cidade==="URUCUI")return "Uruçuí-PI";if(cidade==="Benedito Leite")return "Benedito Leite-MA";return cidade}
function limparEnderecoRota(endereco,cidade){let partes=String(endereco||"").split(",").map(p=>p.trim()).filter(Boolean);const rua=partes[0]||"";const numero=partes[1]||"0";const cid=cidadeRota(cidade||partes[partes.length-1]||"");return [rua,numero,cid].filter(Boolean).join(", ")}
function mapsUrlLimpo(d){const origem=limparEnderecoRota(d.EnderecoColeta,d.ColetaCidade||d.coletaCidade),destino=limparEnderecoRota(d.EnderecoDestino,d.DestinoCidade||d.destinoCidade);return "https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(origem)+"&destination="+encodeURIComponent(destino)}
function referenciaEntrega(d,tipo){return d["Referencia"+tipo]||d["referencia"+tipo]||d["Referência"+tipo]||d["referência"+tipo]||d["PontoReferencia"+tipo]||d["pontoReferencia"+tipo]||d["PontoReferência"+tipo]||d["pontoReferência"+tipo]||""}
function showLoader(t,mode){
  document.getElementById("loaderText").innerText=t||"Carregando...";
  const spin=document.getElementById("loaderSpinner");
  const bike=document.getElementById("loaderBike");
  if(spin)spin.style.display=mode==="bike"?"none":"block";
  if(bike)bike.style.display=mode==="bike"?"block":"none";
  document.getElementById("loader").classList.add("active");
}
function hideLoader(){
  document.getElementById("loader").classList.remove("active");
  const spin=document.getElementById("loaderSpinner");
  const bike=document.getElementById("loaderBike");
  if(spin)spin.style.display="block";
  if(bike)bike.style.display="none";
}

async function browserNotify(title,body){
try{
if("Notification" in window){
if(Notification.permission==="default"){try{await Notification.requestPermission();}catch(e){}}
if(Notification.permission==="granted"){
try{new Notification(title,{body,icon:"https://i.ibb.co/v40mdWxK/logopegaleva.jpg",badge:"https://i.ibb.co/v40mdWxK/logopegaleva.jpg",renotify:true,requireInteraction:true,silent:false});}catch(e){}
}}
if(navigator.serviceWorker){
navigator.serviceWorker.getRegistration().then(reg=>{
if(reg&&reg.showNotification){
reg.showNotification(title,{body,icon:"https://i.ibb.co/v40mdWxK/logopegaleva.jpg",badge:"https://i.ibb.co/v40mdWxK/logopegaleva.jpg",renotify:true,requireInteraction:true,silent:false,vibrate:[300,150,300,150,300]});
}
}).catch(()=>{});
}
if(navigator.vibrate)navigator.vibrate([300,150,300,150,300]);
}catch(e){}
}

function initDeliveryAudio(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(AudioCtx&&!deliveryAudioCtx)deliveryAudioCtx=new AudioCtx();
    if(deliveryAudioCtx&&deliveryAudioCtx.state==="suspended")deliveryAudioCtx.resume().catch(()=>{});
    if(!fallbackBeepAudio){
      fallbackBeepAudio=new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=");
      fallbackBeepAudio.preload="auto";
    }
    if(fallbackBeepAudio){fallbackBeepAudio.volume=0.01;fallbackBeepAudio.play().then(()=>{fallbackBeepAudio.pause();fallbackBeepAudio.currentTime=0;fallbackBeepAudio.volume=1;deliveryAudioUnlocked=true;}).catch(()=>{});}
    deliveryAudioUnlocked=true;
  }catch(e){}
}

["touchstart","pointerdown","click","keydown"].forEach(ev=>{
  document.addEventListener(ev,initDeliveryAudio,{once:false,passive:true});
});

function playDeliveryAlert(){
  try{
    initDeliveryAudio();
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return;
    const ctx=deliveryAudioCtx||new AudioCtx();
    deliveryAudioCtx=ctx;
    const startSound=()=>{
      const master=ctx.createGain();
      const compressor=ctx.createDynamicsCompressor();
      master.gain.setValueAtTime(0.95,ctx.currentTime);
      compressor.threshold.setValueAtTime(-24,ctx.currentTime);
      compressor.knee.setValueAtTime(30,ctx.currentTime);
      compressor.ratio.setValueAtTime(12,ctx.currentTime);
      compressor.attack.setValueAtTime(0.003,ctx.currentTime);
      compressor.release.setValueAtTime(0.25,ctx.currentTime);
      master.connect(compressor);
      compressor.connect(ctx.destination);

      const playTone=(freq,start,duration,type)=>{
        const osc=ctx.createOscillator();
        const gain=ctx.createGain();
        osc.type=type||"square";
        osc.frequency.setValueAtTime(freq,ctx.currentTime+start);
        gain.gain.setValueAtTime(0.001,ctx.currentTime+start);
        gain.gain.exponentialRampToValueAtTime(0.95,ctx.currentTime+start+0.015);
        gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+start+duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(ctx.currentTime+start);
        osc.stop(ctx.currentTime+start+duration+0.04);
      };

      const pattern=[0,0.42,0.84,1.26];
      pattern.forEach(t=>{
        playTone(980,t,0.16,"square");
        playTone(1320,t+0.18,0.18,"sawtooth");
      });
      setTimeout(()=>{try{master.disconnect();compressor.disconnect()}catch(e){}},2300);
    };
    if(ctx.state==="suspended"){
      ctx.resume().then(startSound).catch(()=>{
        if(navigator.vibrate)navigator.vibrate([260,90,260,90,260,90,260]);
      });
    }else startSound();
    if(navigator.vibrate)navigator.vibrate([260,90,260,90,260,90,260]);
  }catch(e){try{if(navigator.vibrate)navigator.vibrate([260,90,260,90,260])}catch(x){}}
}

async function loginDriver(){
  const codigo=document.getElementById("driverCode").value.trim();
  if(!codigo)return alert("Digite seu código.");
  showLoader("Entrando...");
  const res=await api("loginDriver",{codigo});
  hideLoader();
  if(!res.ok)return alert(friendlyError(res.error||"Código inválido."));
  session=res;
  localStorage.setItem("pegaleva_driver",JSON.stringify(session));
  openPanel();
}

function openPanel(){
  initDeliveryAudio();
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("appScreen").classList.add("active");
  renderDriverHeader();
  initAvailableHandle();
  startAutoRefresh();
  browserNotify("PegaLeva","Notificações ativadas para novas entregas.");
}

function startAutoRefresh(){
  if(refreshTimer)clearTimeout(refreshTimer);
  refreshPanel();
  scheduleAutoRefresh();
}

function scheduleAutoRefresh(){
  if(refreshTimer)clearTimeout(refreshTimer);
  refreshTimer=setTimeout(async()=>{
    if(document.visibilityState!=="hidden")await refreshPanel();
    scheduleAutoRefresh();
  },5000);
}

document.addEventListener("visibilitychange",()=>{
  if(!session)return;
  scheduleAutoRefresh();
  if(document.visibilityState!=="hidden")refreshPanel();
});
window.addEventListener("focus",()=>{if(session&&Date.now()-lastRefreshAt>3500)refreshPanel()});
window.addEventListener("pageshow",()=>{if(session&&Date.now()-lastRefreshAt>3500)refreshPanel()});

function renderDriverHeader(){
  const p=session.profile;
  const fullName=p.Nome||"Entregador";
  const name=primeiroNome(fullName);
  const plate="Placa: "+(p.PlacaMoto||"-");
  document.getElementById("driverName").innerText=name;
  document.getElementById("driverPlate").innerText=plate;
  const sideName=document.getElementById("sideDriverName");
  const sidePlate=document.getElementById("sideDriverPlate");
  if(sideName)sideName.innerText=fullName;
  if(sidePlate)sidePlate.innerText=plate;
  renderSaldoText();
  document.getElementById("btnOn").classList.toggle("active",String(p.Ativo).toLowerCase()==="ativo");
  document.getElementById("btnOff").classList.toggle("active",String(p.Ativo).toLowerCase()!=="ativo");
}


function renderSaldoText(){
  const p=session&&session.profile?session.profile:{};
  const val=money(driverBalance(p));
  const el=document.getElementById("saldoText");
  const btn=document.getElementById("toggleSaldoBtn");
  const side=document.getElementById("sideSaldoText");
  const withdraw=document.getElementById("withdrawAvailable");
  if(el)el.innerText=saldoHidden?"R$ ****":val;
  if(btn)btn.innerHTML=saldoHidden?'<i class="fa-solid fa-eye-slash"></i>':'<i class="fa-solid fa-eye"></i>';
  if(side)side.innerText=val;
  if(withdraw)withdraw.innerText=val;
}
function toggleSaldoVisibility(){
  saldoHidden=!saldoHidden;
  renderSaldoText();
}

async function manualRefreshPanel(){
  if(!session)return;
  refreshBusy=false;
  lastRefreshAt=0;
  await refreshPanel();
}
async function forceInvisibleRefresh(){
  if(!session)return;
  showLoader("Atualizando...");
  try{
    refreshBusy=false;
    lastRefreshAt=0;
    await refreshPanel();
    renderDriverHeader();
    initSwipeButtons(document);
    initAvailableHandle();
  }catch(e){}finally{
    hideLoader();
  }
}

async function refreshPanel(){
  if(!session||refreshBusy)return;
  if(Date.now()-lastRefreshAt<2500)return;
  lastRefreshAt=Date.now();
  refreshBusy=true;
  try{
  const res=await api("getDriverPanel",{codigo:session.profile.CodigoAcesso},{retries:1,timeoutMs:20000});
  if(!res.ok){silentConnectionWarning();return;}

  session={ok:true,type:"entregador",profile:res.profile,saques:res.saques||[]};
  localStorage.setItem("pegaleva_driver",JSON.stringify(session));

  renderDriverHeader();
  renderWithdrawBadge();
  window.lastAvailableDeliveries=res.entregasDisponiveis||[];renderAvailable(res.entregasDisponiveis||[]);
  renderMine(res.minhasEntregas||[]);
  window.lastHistory=res.profile.Historico||"";
  renderDriverHeader();

  if(!localStorage.getItem("pegaleva_finalized_driver_initialized")){
    finalizedShown=(res.minhasEntregas||[]).filter(d=>d.Status==="Entrega finalizada").map(d=>d.ID);
    localStorage.setItem("pegaleva_finalized_driver",JSON.stringify(finalizedShown));
    localStorage.setItem("pegaleva_finalized_driver_initialized","1");
  }

  const finalized=(res.minhasEntregas||[]).find(d=>d.Status==="Entrega finalizada"&&!finalizedShown.includes(d.ID));
  if(finalized){
    finalizedShown.push(finalized.ID);
    localStorage.setItem("pegaleva_finalized_driver",JSON.stringify(finalizedShown));
    showStatus("Entrega finalizada com sucesso","Saldo atualizado e entrega registrada.");
  }

  detectNewDelivery(res.entregasDisponiveis||[]);
  }finally{
    refreshBusy=false;
  }
}

function nextTransferText(baseDate){
  const d=baseDate?new Date(String(baseDate).replace(" ","T")):new Date();
  if(isNaN(d.getTime()))return "Próxima transferência: quarta ou sábado";
  const day=d.getDay();
  let add=0,label="";
  if(day===6){add=4;label="quarta-feira"}
  else if(day===3){add=3;label="sábado"}
  else{
    const toWed=(3-day+7)%7||7;
    const toSat=(6-day+7)%7||7;
    add=Math.min(toWed,toSat);
    label=toWed<=toSat?"quarta-feira":"sábado";
  }
  const n=new Date(d);n.setDate(d.getDate()+add);
  return "Próxima transferência: "+label+" ("+n.toLocaleDateString("pt-BR")+")";
}
function renderWithdrawBadge(){
  const list=(session&&session.saques)||[];
  const pending=list.filter(s=>String(s.Status||"").toLowerCase()!=="pago");
  const b=document.getElementById("withdrawBadge");
  if(!b)return;
  b.style.display=pending.length?"inline-flex":"none";
  b.innerText=pending.length;
}
function renderWithdrawHistory(){
  const box=document.getElementById("paymentsHistoryBox")||document.getElementById("withdrawHistoryBox");
  if(!box)return;
  const list=((session&&session.saques)||[]).slice().reverse();
  box.innerHTML='<h3 style="margin-top:10px">Histórico de saques</h3>'+(list.length?list.map(s=>{
    const pago=String(s.Status||"").toLowerCase()==="pago";
    const cls=pago?"green":"yellow";
    const status=pago?"Pago":"Em progresso de transferência";
    return `<div class="delivery" style="${pago?'':'background:#fffbeb;border-color:#fde68a'}"><div class="delivery-head"><b>${money(s.ValorSolicitado||0)}</b><span class="badge ${cls}">${status}</span></div><p class="info"><b>PIX:</b> ${s.ChavePix||"-"}<br><b>Destinatário:</b> ${s.NomeDestinatario||"-"}<br><b>Solicitado em:</b> ${s.CriadoEm||"-"}<br>${pago?'<b>Pago em:</b> '+(s.PagoEm||"-"):nextTransferText(s.CriadoEm)}</p></div>`;
  }).join(""):'<p class="muted" style="margin-top:8px">Nenhum saque solicitado ainda.</p>');
}
function openWithdrawModal(){
  const saldo=driverBalance(session&&session.profile?session.profile:{});
  document.getElementById("withdrawAvailable").innerText=money(saldo);
  document.getElementById("withdrawTransparentNote").innerText="Será transferido via PIX o pagamento do valor total "+money(saldo)+" já descontado da taxa de sistema/serviço de R$1,98 de cada entrega. Saque disponível somente a partir de R$50,00. Pagamentos são feitos quarta e sábado em horário comercial.";
  document.getElementById("withdrawPix").value="";
  document.getElementById("withdrawName").value="";
  document.getElementById("withdrawModal").classList.add("active");
}
function closeWithdrawModal(){document.getElementById("withdrawModal").classList.remove("active")}
async function requestWithdraw(){
  const saldo=driverBalance(session&&session.profile?session.profile:{});
  const pix=document.getElementById("withdrawPix").value.trim();
  const nome=document.getElementById("withdrawName").value.trim();
  if(saldo<50)return showStatus("Saque indisponível","O saque mínimo é de R$50,00.");
  if(!pix||!nome)return showStatus("Dados incompletos","Informe a chave PIX e o nome do destinatário.");
  showLoader("Enviando solicitação...");
  const res=await api("requestDriverWithdraw",{codigo:session.profile.CodigoAcesso,pix,nomeDestinatario:nome});
  hideLoader();
  if(!res.ok)return showStatus("Não foi possível solicitar agora",friendlyError(res.error||"Tente novamente."));
  closeWithdrawModal();
  showStatus("Saque solicitado","Sua solicitação foi enviada com o valor total do saldo já descontado da taxa de sistema/serviço de R$1,98 por entrega. Pagamentos são feitos quarta e sábado em horário comercial.");
  refreshPanel();
}

function isClosedDelivery(status){return ["Entrega finalizada","Cancelada","Cancelada Geral"].includes(String(status||""))}

function updateAvailableCount(total){
  const c=document.getElementById("availableCount");
  const h=document.getElementById("availableHandle");
  const has=Number(total||0)>0;
  if(c){
    c.innerText=total||0;
    c.classList.toggle("active",has);
  }
  if(h)h.classList.toggle("has-deliveries",has);
}
function openAvailableDrawer(){
  const d=document.getElementById("availableDrawer");
  const b=document.getElementById("availableBackdrop");
  if(d)d.classList.add("active");
  if(b)b.classList.add("active");
}
function closeAvailableDrawer(){
  const d=document.getElementById("availableDrawer");
  const b=document.getElementById("availableBackdrop");
  if(d)d.classList.remove("active");
  if(b)b.classList.remove("active");
  const h=document.getElementById("availableHandle");
  if(h)h.style.transform="translateY(-50%)";
}
function initAvailableHandle(){
  const h=document.getElementById("availableHandle");
  if(!h||h.dataset.ready==="1")return;
  h.dataset.ready="1";
  let startX=0, dragging=false, moved=false;
  const point=e=>{
    const t=e.touches&&e.touches[0]||e.changedTouches&&e.changedTouches[0]||e;
    return {x:t.clientX||0,y:t.clientY||0};
  };
  const reset=()=>{
    dragging=false;
    h.classList.remove("dragging");
    h.style.transform="translateY(-50%)";
  };
  const start=e=>{
    const p=point(e);
    startX=p.x;
    dragging=true;
    moved=false;
    h.classList.add("dragging");
  };
  const move=e=>{
    if(!dragging)return;
    const p=point(e);
    const dx=Math.min(0,p.x-startX);
    if(Math.abs(dx)>6)moved=true;
    h.style.transform=`translate(${dx}px,-50%)`;
    if(dx<-72){
      openAvailableDrawer();
      reset();
    }
    if(e.cancelable)e.preventDefault();
  };
  const end=()=>{
    if(!dragging)return;
    if(!moved)openAvailableDrawer();
    reset();
  };
  h.addEventListener("mousedown",start);
  window.addEventListener("mousemove",move,{passive:false});
  window.addEventListener("mouseup",end);
  h.addEventListener("touchstart",start,{passive:true});
  h.addEventListener("touchmove",move,{passive:false});
  h.addEventListener("touchend",end);
  h.addEventListener("touchcancel",reset);
}

function renderAvailable(list){
  const now=Date.now();
  Object.keys(refusedDeliveries).forEach(id=>{
    if(now-refusedDeliveries[id]>=20000) delete refusedDeliveries[id];
  });
  localStorage.setItem("pegaleva_refused_temp",JSON.stringify(refusedDeliveries));
  const raw=(list||[]).filter(d=>!isClosedDelivery(d.Status));
  const ordered=raw.filter(d=>!refusedDeliveries[d.ID]);
  window.lastAvailableDeliveries=ordered;

  document.getElementById("availableBox").innerHTML=ordered.length
    ? ordered.map(d=>deliveryHtml(d,true,false)).join("")
    : '<p class="muted" style="margin-top:12px">(0) Sem pedidos, fique atento!</p>';
  updateAvailableCount(ordered.length);
  initAvailableHandle();
  initSwipeButtons(document.getElementById("availableBox"));
}
function renderMine(list){
  list=(list||[]).filter(d=>!isClosedDelivery(d.Status));
  if(!list.length){
    document.getElementById("myBox").innerHTML='<p class="muted">(0) Sem pedidos, fique atento!</p>';
    window.lastDriverDeliveries=[];
    return;
  }

  document.getElementById("myBox").innerHTML=list.map(d=>deliveryHtml(d,false,false)).join("");
  window.lastDriverDeliveries=list;
}

function renderHistory(hist){
  if(!hist.trim()){
    document.getElementById("historyBox").innerHTML='<p class="muted">Nenhuma entrega finalizada ainda.</p>';
    return;
  }

  const items=hist.trim().split("\n").reverse();
  const visible=showAllHistory?items:items.slice(0,3);

  document.getElementById("historyBox").innerHTML=
    visible.map(h=>`<p class="muted">${h}</p>`).join("")+
    (items.length>3?`<button class="btn light" onclick="showAllHistory=!showAllHistory;renderHistory(window.lastHistory||'')">${showAllHistory?"Ver menos":"Ver todos"}</button>`:"");

  window.lastHistory=hist;
}

function swipeActionHtml(id){
  const safe=String(id||"").replace(/'/g,"&#039;");
  return `<div class="swipe-delivery" data-delivery-id="${safe}">
    <span class="swipe-side left"><i class="fa-solid fa-angles-left"></i> Recusar</span>
    <div class="swipe-knob"><i class="fa-solid fa-arrows-left-right"></i> Deslize</div>
    <span class="swipe-side right">Aceitar <i class="fa-solid fa-angles-right"></i></span>
  </div>`;
}

function initSwipeButtons(root){
  (root||document).querySelectorAll(".swipe-delivery:not([data-ready='1'])").forEach(el=>{
    el.dataset.ready="1";
    const knob=el.querySelector(".swipe-knob");
    let startX=0,startY=0,dragging=false,limit=0,lastDx=0,locked=false;
    const getPoint=e=>{
      const t=e.touches&&e.touches[0]||e.changedTouches&&e.changedTouches[0]||e;
      return {x:t.clientX||0,y:t.clientY||0};
    };
    const reset=()=>{
      knob.style.transform="translateX(-50%)";
      el.classList.remove("accepting","refusing");
      document.body.classList.remove("swiping-delivery");
      dragging=false;locked=false;lastDx=0;
    };
    const moveTo=x=>{
      const dx=Math.max(-limit,Math.min(limit,x-startX));
      lastDx=dx;
      knob.style.transform=`translate3d(calc(-50% + ${dx}px),0,0)`;
      el.classList.toggle("accepting",dx>limit*.55);
      el.classList.toggle("refusing",dx<-limit*.55);
      return dx;
    };
    const finish=dx=>{
      const id=el.dataset.deliveryId;
      document.body.classList.remove("swiping-delivery");
      if(dx>limit*.55){acceptDelivery(id);reset();return}
      if(dx<-limit*.55){refuseDelivery(id);reset();return}
      reset();
    };
    const start=e=>{
      const p=getPoint(e);
      dragging=true;locked=false;startX=p.x;startY=p.y;lastDx=0;
      limit=Math.max(90,el.clientWidth/2-45);
    };
    const move=e=>{
      if(!dragging)return;
      const p=getPoint(e),dx=p.x-startX,dy=p.y-startY;
      if(!locked){
        if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
        locked=Math.abs(dx)>Math.abs(dy);
        if(locked)document.body.classList.add("swiping-delivery");
      }
      if(!locked)return;
      e.preventDefault();
      e.stopPropagation();
      moveTo(p.x);
    };
    const end=e=>{
      if(!dragging)return;
      if(!locked){reset();return}
      e.preventDefault&&e.preventDefault();
      finish(lastDx);
    };
    el.addEventListener("mousedown",start);
    window.addEventListener("mousemove",move,{passive:false});
    window.addEventListener("mouseup",end,{passive:false});
    window.addEventListener("mouseleave",()=>{if(dragging)reset()});
    el.addEventListener("touchstart",start,{passive:true});
    el.addEventListener("touchmove",move,{passive:false});
    el.addEventListener("touchend",end,{passive:false});
    el.addEventListener("touchcancel",reset,{passive:true});
  });
}

function toggleDeliveryDetails(id){
  id=String(id||"");
  const box=document.getElementById("details-"+id);
  if(!box)return;
  const isOpen=box.classList.contains("open");
  if(isOpen){
    box.classList.remove("open");
    openDeliveryDetails=openDeliveryDetails.filter(x=>String(x)!==id);
  }else{
    box.classList.add("open");
    if(!openDeliveryDetails.some(x=>String(x)===id))openDeliveryDetails.push(id);
  }
  localStorage.setItem("pegaleva_open_delivery_details",JSON.stringify(openDeliveryDetails));
  const btn=box.previousElementSibling;
  if(btn)btn.innerHTML=box.classList.contains("open")?'<i class="fa-solid fa-circle-info"></i> Ocultar dados':'<i class="fa-solid fa-circle-info"></i> Ver dados';
}


function deliveryConfirmationHtml(d){
  const raw=String(d.ConfirmacaoEntrega||d.Confirmacao||"").trim();
  if(!raw)return "";
  return `<p class="info"><b>Confirmação:</b> ${raw}</p>`;
}

function confirmButtonHtml(id){
  const safe=String(id||"").replace(/'/g,"&#039;");
  return `<button class="btn light delivery-confirm-btn" onclick="openDeliveryConfirmation('${safe}')" title="Confirmar entrega"><i class="fa-solid fa-circle-check"></i></button>`;
}

async function openDeliveryConfirmation(id){
  const cpf=prompt("Digite o CPF de quem recebeu para confirmar a entrega:");
  if(cpf===null)return;
  const cleanCpf=onlyDigits(cpf);
  if(cleanCpf.length!==11)return showStatus("CPF inválido","Digite um CPF com 11 números para confirmar a entrega.");
  showLoader("Confirmando entrega...");
  try{
    const res=await api("confirmDeliveryCpf",{deliveryId:id,codigo:session.profile.CodigoAcesso,cpf:cleanCpf},{retries:1,timeoutMs:30000});
    hideLoader();
    if(!res.ok)return showStatus("Não foi possível confirmar",friendlyError(res.error||"Tente novamente."));
    showStatus("Entrega confirmada","O CPF foi registrado na coluna ConfirmacaoEntrega da aba entregas.");
    refreshPanel();
  }catch(e){
    hideLoader();
    showStatus("Não foi possível confirmar",friendlyError(e&&e.message?e.message:"Tente novamente."));
  }
}


function deliveryHtml(d,available,modalOnly){
  const waDest=onlyDigits(d.WhatsAppDestino),
        waSend=onlyDigits(d.WhatsAppSolicitante),
        msg=encodeURIComponent("Olá, sou entregador do Pega e Leva. Estou na sua residência!"),
        waDestUrl=waDest?`https://wa.me/55${waDest}?text=${msg}`:"#",
        waSendUrl=waSend?`https://wa.me/55${waSend}`:"#",
        statusAtual=String(d.Status||"").trim().toLowerCase(),
        finalized=statusAtual==="entrega finalizada",
        canceled=statusAtual==="cancelada",
        collected=statusAtual==="coletado"||statusAtual==="coletada"||statusAtual==="coleta",
        going=statusAtual==="estou a caminho",
        refColeta=referenciaEntrega(d,"Coleta"),
        refDestino=referenciaEntrega(d,"Destino");

  const deliverySafeId=String(d.ID||"").replace(/[^a-zA-Z0-9_-]/g,"_");
  const deliveryIsOpen=openDeliveryDetails.some(x=>String(x)===String(d.ID))||openDeliveryDetails.some(x=>String(x)===deliverySafeId);

  let actionHtml="";

  if(available&&!modalOnly){
    actionHtml=swipeActionHtml(d.ID);
  } else if(!available&&!modalOnly&&!finalized&&!canceled){
    if(collected){
      actionHtml=`<div class="delivery-actions-pro">
        <button class="btn light" onclick="openChatModal('${d.ID}')"><i class="fa-solid fa-message"></i> Mensagem${Number(d.EntregadorNaoLidas||0)>0?` <span class="chat-badge">${d.EntregadorNaoLidas}</span>`:""}</button>
        <button class="btn light" onclick="openPaymentModal('${d.ID}')"><i class="fa-solid fa-qrcode"></i> Pagar</button>
        <button class="btn green wide" onclick="finalizeDeliveryChecked('${d.ID}')"><i class="fa-solid fa-circle-check"></i> Entrega finalizada</button>
        <a class="btn route wide" href="${mapsUrlLimpo(d)}" target="_blank"><i class="fa-solid fa-map-location-dot"></i> Abrir rota online</a>
      </div>`;
    } else {
      actionHtml=`<div class="delivery-actions-pro">
        <button class="btn green" onclick="updateStatus('${d.ID}','Finalizando uma entrega')"><i class="fa-solid fa-flag-checkered"></i> Finalizando uma entrega</button>
        <button class="btn" onclick="updateStatus('${d.ID}','Estou a caminho')"><i class="fa-solid fa-route"></i> Estou indo</button>
        <button class="btn wide" onclick="updateStatus('${d.ID}','Coletado')"><i class="fa-solid fa-box"></i> Coleta</button>
        <button class="btn green wide" onclick="finalizeDeliveryChecked('${d.ID}')"><i class="fa-solid fa-circle-check"></i> Entrega finalizada</button>
        <button class="btn red wide" onclick="cancelDelivery('${d.ID}')"><i class="fa-solid fa-ban"></i> Cancelar</button>
        <button class="btn light" onclick="openChatModal('${d.ID}')"><i class="fa-solid fa-message"></i> Mensagem${Number(d.EntregadorNaoLidas||0)>0?` <span class="chat-badge">${d.EntregadorNaoLidas}</span>`:""}</button>
        <button class="btn light" onclick="openPaymentModal('${d.ID}')"><i class="fa-solid fa-qrcode"></i> Pagar</button>
        <a class="btn route wide" href="${mapsUrlLimpo(d)}" target="_blank"><i class="fa-solid fa-map-location-dot"></i> Abrir rota online</a>
      </div>`;
    }
  }

  return `<div class="delivery pro-card">
    <div class="delivery-top-pro">
      <div class="delivery-user-pro">
        <span class="user-circle"><i class="fa-solid fa-user"></i></span>
        <div><strong>${d.NomeSolicitante||"Solicitante"}</strong><p class="muted">${d.Conteudo||"Entrega"} • ${d.Volumes||1} volume(s)</p></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${confirmButtonHtml(d.ID)}
        <div class="delivery-price-pro">${money(d.Valor)}</div>
      </div>
    </div>
    <div class="delivery-route-pro">
      <div class="route-point-pro pickup">
        <div class="route-label-pro">Pick up • ${d.BairroColeta||"Coleta"}</div>
        <div class="route-address-pro">${d.EnderecoColeta}</div>
        ${refColeta?`<p class="info"><b>Referência:</b> ${refColeta}</p>`:""}
      </div>
      <div class="route-point-pro dest">
        <div class="route-label-pro">Entrega • ${d.BairroDestino||"Destino"}</div>
        <div class="route-address-pro">${d.EnderecoDestino}</div>
        ${refDestino?`<p class="info"><b>Referência:</b> ${refDestino}</p>`:""}
      </div>
    </div>
    <button class="delivery-details-toggle" onclick="toggleDeliveryDetails('${deliverySafeId}')"><i class="fa-solid fa-circle-info"></i> ${deliveryIsOpen?"Ocultar dados":"Ver dados"}</button>
    <div class="delivery-meta-pro delivery-extra-details ${deliveryIsOpen?"open":""}" id="details-${deliverySafeId}">
      <p class="info"><b>Quem envia:</b> ${d.NomeSolicitante||""} ${!modalOnly?`• <a href="${waSendUrl}" target="_blank">${d.WhatsAppSolicitante||"WhatsApp"}</a>`:""}</p>
      <p class="info"><b>Quem recebe:</b> ${d.NomeDestino||""} ${!modalOnly?`• <a href="${waDestUrl}" target="_blank">${d.WhatsAppDestino||"WhatsApp"}</a>`:""}</p>
      <p class="info"><b>Status:</b> <span class="badge ${finalized?"green":canceled?"red":"yellow"}">${d.Status}</span> <b>Pagamento:</b> ${d.StatusPagamento||"Aguardando confirmação"}</p>
      ${deliveryConfirmationHtml(d)}
      ${going?`<div class="route-mini">5MIN CHEGANDO...</div>`:""}
      ${collected?`<div class="route-mini">entrega em rota <i class="fa-solid fa-motorcycle"></i></div>`:""}
    </div>
    ${actionHtml}
    ${finalized?`<p class="info"><span class="badge green">Entrega finalizada e registrada</span></p>`:""}
    ${canceled?`<p class="info"><span class="badge red">Entrega cancelada</span></p>`:""}
  </div>`;
}


function processAvailableQueue(){
  if(queueProcessing)return;
  queueProcessing=true;
  const step=()=>{
    if(!pendingAvailableQueue.length){
      queueProcessing=false;
      return;
    }
    const next=pendingAvailableQueue.shift();
    refusedDeliveries[next.ID]=Date.now();
    renderAvailable(window.lastAvailableDeliveries||[]);
    setTimeout(step,2000);
  };
  step();
}
function detectNewDelivery(list){
  list=(list||[]).filter(d=>!refusedDeliveries[d.ID]);
  if(!list.length)return;
  const active=String(session.profile.Ativo||"").toLowerCase()==="ativo";
  if(!active)return;

  const newOnes=list.filter(d=>!lastAvailableIds.includes(d.ID));
  lastAvailableIds=list.map(d=>d.ID);
  localStorage.setItem("pegaleva_seen_deliveries",JSON.stringify(lastAvailableIds));

  if(newOnes.length){
    modalQueue=modalQueue.concat(newOnes.filter(d=>!modalQueue.some(q=>q.ID===d.ID)));
    playDeliveryAlert();
    browserNotify("Nova entrega disponível",newOnes.length===1?`${newOnes[0].BairroColeta} para ${newOnes[0].BairroDestino}`:`${newOnes.length} novas entregas disponíveis`);
    if(!document.getElementById("bottomOfferBar").classList.contains("active"))showNextModalDelivery();
  }
}

function showNextModalDelivery(){
  const next=modalQueue.shift();
  if(!next){closeModal();return}
  showNewModal(next);
}

function bottomDeliveryHtml(d){
  return `<div class="bottom-offer-top">
    <div>
      <div class="bottom-route"><i class="fa-solid fa-location-dot"></i> ${d.BairroColeta} <i class="fa-solid fa-arrow-right"></i> ${d.BairroDestino}</div>
      <div class="bottom-user"><span class="user-circle"><i class="fa-solid fa-user"></i></span><span>${d.NomeSolicitante||d.NomeDestino||"Responsável pela entrega"}</span></div>
    </div>
    <div class="bottom-price">${money(d.Valor)}</div>
  </div>
  ${swipeActionHtml(d.ID)}`;
}

function showNewModal(d){
  currentModalDeliveryId=d.ID;
  document.getElementById("bottomOfferBody").innerHTML=bottomDeliveryHtml(d);
  initSwipeButtons(document.getElementById("bottomOfferBar"));
  document.getElementById("bottomOfferBar").classList.add("active");
}

function refuseDelivery(id){
  if(id){
    refusedDeliveries[id]=Date.now();
    localStorage.setItem("pegaleva_refused_temp",JSON.stringify(refusedDeliveries));
  }
  closeModal();
  renderAvailable(window.lastAvailableDeliveries||[]);
  showNextModalDelivery();
}

function refuseModalDelivery(){
  if(currentModalDeliveryId){
    refuseDelivery(currentModalDeliveryId);
  }else{
    closeModal();
  }
}

function closeModal(){document.getElementById("bottomOfferBar").classList.remove("active");currentModalDeliveryId=""}

async function acceptDelivery(id){
  pendingAvailableQueue.push({ID:id});
  processAvailableQueue();
  if(refusedDeliveries[id]){delete refusedDeliveries[id];localStorage.setItem("pegaleva_refused_temp",JSON.stringify(refusedDeliveries));}
  modalQueue=modalQueue.filter(d=>String(d.ID)!==String(id));
  closeModal();
  showLoader("Aceitando entrega...","bike");
  const res=await api("acceptDelivery",{deliveryId:id,codigoEntregador:session.profile.CodigoAcesso});
  hideLoader();
  if(!res.ok){alert(friendlyError(res.error||"Não foi possível aceitar."));refreshPanel();showNextModalDelivery();return}
  await refreshPanel();
  showNextModalDelivery();
}


let currentPaymentDeliveryId="";
function openPaymentModal(id){
  const d=(window.lastDriverDeliveries||[]).find(x=>x.ID===id)||(window.lastAvailableDeliveries||[]).find(x=>x.ID===id);
  if(!d)return alert("Entrega não encontrada no painel.");
  currentPaymentDeliveryId=id;
  const qrUrl="https://i.ibb.co/Nd0HHzGc/Whats-App-Image-2026-07-02-at-22-17-59.jpg";
  document.getElementById("paymentBody").innerHTML=`<div class="delivery">
    <p class="info"><b>ID:</b> ${d.ID}</p>
    <p class="info"><b>Rota:</b> ${d.BairroColeta} → ${d.BairroDestino}</p>
    <p class="info"><b>Cliente:</b> ${d.NomeSolicitante||""}</p>
    <p class="info"><b>Valor para pagar:</b> ${money(d.Valor)}</p>
    <p class="info"><b>Status atual:</b> ${d.StatusPagamento||"Aguardando confirmação"}</p>
    <div class="pix-box">
      <b>QR CODE PIX</b>
      <img src="${qrUrl}" alt="QR Code PIX">
      <p class="info"><b>Chave PIX:</b> ${PIX_KEY}</p>
      <p class="info"><b>Banco:</b> MERCADO PAGO LTDA</p>
      <p class="info"><b>Recebedor:</b> 57.293.143 Marllus Vinicius Silva Araujo</p>
      <p class="pay-note">Confira o pagamento antes de registrar como realizado com sucesso.</p>
    </div>
  </div>`;
  document.getElementById("paymentModal").classList.add("active");
}
function closePaymentModal(){document.getElementById("paymentModal").classList.remove("active");currentPaymentDeliveryId=""}

async function registerPayment(status){
  if(!currentPaymentDeliveryId)return;
  const paidId=currentPaymentDeliveryId;
  showLoader("Registrando pagamento...");
  const res=await api("registerPaymentStatus",{deliveryId:paidId,status});
  hideLoader();
  if(!res.ok)return alert(friendlyError(res.error||"Erro ao registrar pagamento."));
  (window.lastDriverDeliveries||[]).forEach(d=>{if(d.ID===paidId)d.StatusPagamento=status});
  closePaymentModal();
  showStatus(status==="Pago"?"Pagamento registrado com sucesso":"Pagamento pendente","Agora a opção Entrega finalizada está liberada para essa entrega.");
  refreshPanel();
}

function paymentWasChosen(d){
  return ["Pago","Pendente"].includes(String(d&&d.StatusPagamento||"").trim());
}
function finalizeDeliveryChecked(id){
  const d=(window.lastDriverDeliveries||[]).find(x=>x.ID===id);
  if(!paymentWasChosen(d)){
    showStatus("Pagamento obrigatório","Antes de finalizar, escolha uma das opções dentro de Pagar agora.");
    openPaymentModal(id);
    return;
  }
  updateStatus(id,"Entrega finalizada");
}

async function updateStatus(id,status){
  showLoader("Atualizando...");
  const res=await api("updateDeliveryStatus",{
    deliveryId:id,
    status,
    codigoEntregador:session.profile.CodigoAcesso
  });
  hideLoader();

  if(!res.ok)return alert(friendlyError(res.error||"Erro ao atualizar."));

  if(res.profile){
    session.profile=res.profile;
    localStorage.setItem("pegaleva_driver",JSON.stringify(session));
    renderDriverHeader();
  }

  if(status==="Entrega finalizada")
    showStatus("Entrega finalizada com sucesso","Saldo atualizado e entrega registrada no histórico.");

  lastRefreshAt=0;
  refreshBusy=false;

  await refreshPanel();
  renderDriverHeader();
}

async function cancelDelivery(id){
  showLoader("Cancelando...");
  const res=await api("cancelDelivery",{deliveryId:id});
  hideLoader();
  if(!res.ok)return alert(friendlyError(res.error||"Erro ao cancelar."));
  showStatus("Entrega devolvida","A entrega voltou para novas entregas disponíveis e procurará outro entregador.");
  refreshPanel();
}

async function toggleActive(active){
  showLoader(active?"Ativando...":"Desativando...");
  const res=await api("toggleDriver",{codigo:session.profile.CodigoAcesso,ativo:active});
  hideLoader();
  if(!res.ok)return alert(friendlyError(res.error||"Erro ao alterar status."));
  session.profile.Ativo=res.ativo;
  localStorage.setItem("pegaleva_driver",JSON.stringify(session));
  refreshPanel();
}


async function openChatModal(id){
  chatDeliveryId=id;
  document.getElementById("chatInput").value="";
  document.getElementById("chatMessages").innerHTML='<p class="muted">Carregando mensagens...</p>';
  document.getElementById("chatModal").classList.add("active");
  await loadChatMessages(true);
}
function closeChatModal(){chatDeliveryId="";document.getElementById("chatModal").classList.remove("active");refreshPanel()}
async function loadChatMessages(markRead){
  if(!chatDeliveryId||!session)return;
  const res=await api("getMessages",{deliveryId:chatDeliveryId,viewer:"entregador",markRead:!!markRead});
  const box=document.getElementById("chatMessages");
  if(!res.ok){box.innerHTML='<p class="muted">Erro ao carregar mensagens.</p>';return}
  const msgs=res.messages||[];
  box.innerHTML=msgs.length?msgs.map(m=>`<div class="chat-msg ${m.RemetenteTipo==="entregador"?"me":"other"}">${m.Mensagem||""}<small>${m.CriadoEm||""}</small></div>`).join(""):'<p class="muted">Nenhuma mensagem ainda.</p>';
  box.scrollTop=box.scrollHeight;
}
async function sendChatMessage(){
  const input=document.getElementById("chatInput"), texto=input.value.trim();
  if(!chatDeliveryId||!texto)return;
  input.value="";
  const res=await api("sendMessage",{deliveryId:chatDeliveryId,from:"entregador",mensagem:texto});
  if(!res.ok)return alert(friendlyError(res.error||"Erro ao enviar mensagem."));
  loadChatMessages(true);
  refreshPanel();
}



function cancelDriverRegistration(){
  const p=session&&session.profile?session.profile:{};
  const nome=p.Nome||"ENTREGADOR";
  const cod=p.CodigoAcesso||p.Codigo||"";
  const msg=`Olá, eu "${nome}", cadastrado sob o código "${cod}", informo que não desejo mais ser entregador da PegaLeva. Solicito o cancelamento do meu cadastro de entregador.`;
  const url="https://wa.me/5589994372011?text="+encodeURIComponent(msg);
  window.open(url,"_blank");
}

function openSideMenu(){
  renderDriverHeader();
  document.getElementById("sideMenuBackdrop").classList.add("active");
  document.getElementById("sideMenu").classList.add("active");
}
function closeSideMenu(){
  document.getElementById("sideMenuBackdrop").classList.remove("active");
  document.getElementById("sideMenu").classList.remove("active");
}
function openPaymentsModal(){
  closeSideMenu();
  renderWithdrawHistory();
  document.getElementById("paymentsModal").classList.add("active");
}
function closePaymentsModal(){document.getElementById("paymentsModal").classList.remove("active")}
function openDriverHistoryModal(){
  closeSideMenu();
  renderDriverHistoryList(window.lastHistory||"");
  document.getElementById("driverHistoryModal").classList.add("active");
}
function closeDriverHistoryModal(){document.getElementById("driverHistoryModal").classList.remove("active")}
function parseHistoryLine(h){
  const txt=String(h||"").trim();
  const date=(txt.match(/^\[(.*?)\]/)||[])[1]||"";
  const val=(txt.match(/R\$\s*[\d.,]+/)||[])[0]||"";
  let body=txt.replace(/^\[.*?\]\s*/,"").replace(/\s*-\s*R\$\s*[\d.,]+.*$/,"");
  body=body.replace(/^[^-]+-\s*/,"");
  const parts=body.split("→").map(x=>x.trim()).filter(Boolean);
  return {date, from:parts[0]||body||"Origem", to:parts[1]||"Destino", value:val||"-", raw:txt};
}
function renderDriverHistoryList(hist){
  const box=document.getElementById("driverHistoryListBox");
  if(!box)return;
  const items=String(hist||"").trim().split("\n").filter(Boolean).reverse();
  if(!items.length){
    box.innerHTML='<p class="muted" style="margin-top:10px">Nenhuma corrida registrada ainda.</p>';
    return;
  }
  box.innerHTML=items.map(h=>{
    const it=parseHistoryLine(h);
    return `<div class="history-item">
      <div class="route"><i class="fa-solid fa-location-dot"></i> Pickup: ${it.from}<br><i class="fa-solid fa-flag-checkered"></i> Entrega: ${it.to}</div>
      <div class="meta">${it.date?`<b>Data:</b> ${it.date}<br>`:""}<b>Valor:</b> <span class="value">${it.value}</span></div>
    </div>`;
  }).join("");
}

function showStatus(title,text){
  document.getElementById("statusTitle").innerText=title;
  document.getElementById("statusText").innerText=text;
  document.getElementById("statusModal").classList.add("active");
}

function closeStatusModal(){document.getElementById("statusModal").classList.remove("active")}

function logout(){
closeSideMenu&&closeSideMenu();
showLoader("Saindo...");
setTimeout(()=>{
if(refreshTimer) clearTimeout(refreshTimer);
localStorage.removeItem("pegaleva_driver");
clearAppCache&&clearAppCache();
session=null;
hideLoader();
document.getElementById("appScreen").classList.remove("active");
document.getElementById("loginScreen").classList.add("active");
document.getElementById("driverCode").value="";
},2000);
}


/* =========================================================
   Reforços inteligentes de estabilidade do entregador
   Mantém a lógica original e apenas evita travamentos comuns.
========================================================= */
(function(){
  const get = id => document.getElementById(id);
  const safeText = (id, value) => {
    const el = get(id);
    if(el) el.innerText = value == null ? "" : String(value);
  };
  const safeHtml = (id, value) => {
    const el = get(id);
    if(el) el.innerHTML = value == null ? "" : String(value);
  };
  const safeClassAdd = (id, cls) => {
    const el = get(id);
    if(el) el.classList.add(cls);
  };
  const safeClassRemove = (id, ...cls) => {
    const el = get(id);
    if(el) el.classList.remove(...cls);
  };
  const safeDisplay = (id, value) => {
    const el = get(id);
    if(el) el.style.display = value;
  };
  const safeValue = (id, fallback="") => {
    const el = get(id);
    return el && el.value !== undefined ? el.value : fallback;
  };
  const safeSetValue = (id, value) => {
    const el = get(id);
    if(el) el.value = value == null ? "" : String(value);
  };
  const safeJsonParse = (value, fallback) => {
    try{
      const parsed = JSON.parse(value);
      return parsed == null ? fallback : parsed;
    }catch(e){
      return fallback;
    }
  };

  function safeErrorMessage(msg){
    try{
      return friendlyError ? friendlyError(msg) : (msg || "Não foi possível concluir agora.");
    }catch(e){
      return msg || "Não foi possível concluir agora.";
    }
  }

  const originalShowLoader = typeof showLoader === "function" ? showLoader : null;
  showLoader = function(t, mode){
    try{
      safeText("loaderText", t || "Carregando...");
      const spin = get("loaderSpinner");
      const bike = get("loaderBike");
      if(spin) spin.style.display = mode === "bike" ? "none" : "block";
      if(bike) bike.style.display = mode === "bike" ? "block" : "none";
      safeClassAdd("loader","active");
    }catch(e){
      if(originalShowLoader) try{ originalShowLoader(t, mode); }catch(err){}
    }
  };

  const originalHideLoader = typeof hideLoader === "function" ? hideLoader : null;
  hideLoader = function(){
    try{
      safeClassRemove("loader","active");
      safeDisplay("loaderSpinner","block");
      safeDisplay("loaderBike","none");
    }catch(e){
      if(originalHideLoader) try{ originalHideLoader(); }catch(err){}
    }
  };

  const originalApi = typeof api === "function" ? api : null;
  api = async function(action, data={}, options={}){
    if(originalApi){
      try{
        return await originalApi(action, data, options);
      }catch(e){
        return {ok:false,error:"Falha de conexão com o servidor. Tente novamente."};
      }
    }
    return {ok:false,error:"API não encontrada."};
  };

  const originalRenderDriverHeader = typeof renderDriverHeader === "function" ? renderDriverHeader : null;
  renderDriverHeader = function(){
    try{
      if(!session || !session.profile) return;
      const p=session.profile;
      const fullName=p.Nome||"Entregador";
      const name=primeiroNome(fullName);
      const plate="Placa: "+(p.PlacaMoto||"-");
      safeText("driverName", name);
      safeText("driverPlate", plate);
      safeText("sideDriverName", fullName);
      safeText("sideDriverPlate", plate);
      renderSaldoText();
      const btnOn=get("btnOn"), btnOff=get("btnOff");
      if(btnOn)btnOn.classList.toggle("active",String(p.Ativo).toLowerCase()==="ativo");
      if(btnOff)btnOff.classList.toggle("active",String(p.Ativo).toLowerCase()!=="ativo");
    }catch(e){
      if(originalRenderDriverHeader) try{ originalRenderDriverHeader(); }catch(err){}
    }
  };

  const originalRenderSaldoText = typeof renderSaldoText === "function" ? renderSaldoText : null;
  renderSaldoText = function(){
    try{
      const p=session&&session.profile?session.profile:{};
      const val=money(driverBalance(p));
      safeText("saldoText", saldoHidden ? "R$ ****" : val);
      const btn=get("toggleSaldoBtn");
      if(btn)btn.innerHTML=saldoHidden?'<i class="fa-solid fa-eye-slash"></i>':'<i class="fa-solid fa-eye"></i>';
      safeText("sideSaldoText", val);
      safeText("withdrawAvailable", val);
    }catch(e){
      if(originalRenderSaldoText) try{ originalRenderSaldoText(); }catch(err){}
    }
  };

  const originalRefreshPanel = typeof refreshPanel === "function" ? refreshPanel : null;
  refreshPanel = async function(){
    try{
      if(!session || refreshBusy) return;
      if(originalRefreshPanel) return await originalRefreshPanel();
    }catch(e){
      refreshBusy=false;
      silentConnectionWarning();
    }
  };

  const originalRenderAvailable = typeof renderAvailable === "function" ? renderAvailable : null;
  renderAvailable = function(list){
    try{
      const box=get("availableBox");
      if(!box) return;
      return originalRenderAvailable ? originalRenderAvailable(list || []) : undefined;
    }catch(e){
      safeHtml("availableBox",'<p class="muted" style="margin-top:12px">(0) Sem pedidos, fique atento!</p>');
      updateAvailableCount(0);
    }
  };

  const originalRenderMine = typeof renderMine === "function" ? renderMine : null;
  renderMine = function(list){
    try{
      const box=get("myBox");
      if(!box) return;
      return originalRenderMine ? originalRenderMine(list || []) : undefined;
    }catch(e){
      safeHtml("myBox",'<p class="muted">(0) Sem pedidos, fique atento!</p>');
      window.lastDriverDeliveries=[];
    }
  };

  const originalOpenWithdrawModal = typeof openWithdrawModal === "function" ? openWithdrawModal : null;
  openWithdrawModal = function(){
    try{
      const saldo=driverBalance(session&&session.profile?session.profile:{});
      safeText("withdrawAvailable", money(saldo));
      safeText("withdrawTransparentNote","Será transferido via PIX o pagamento do valor total "+money(saldo)+" já descontado da taxa de sistema/serviço de R$1,98 de cada entrega. Saque disponível somente a partir de R$50,00. Pagamentos são feitos quarta e sábado em horário comercial.");
      safeSetValue("withdrawPix","");
      safeSetValue("withdrawName","");
      safeClassAdd("withdrawModal","active");
    }catch(e){
      if(originalOpenWithdrawModal) try{ originalOpenWithdrawModal(); }catch(err){}
    }
  };

  const originalRequestWithdraw = typeof requestWithdraw === "function" ? requestWithdraw : null;
  requestWithdraw = async function(){
    try{
      const saldo=driverBalance(session&&session.profile?session.profile:{});
      const pix=String(safeValue("withdrawPix","")).trim();
      const nome=String(safeValue("withdrawName","")).trim();
      if(saldo<50)return showStatus("Saque indisponível","O saque mínimo é de R$50,00.");
      if(!pix||!nome)return showStatus("Dados incompletos","Informe a chave PIX e o nome do destinatário.");
      showLoader("Enviando solicitação...");
      const res=await api("requestDriverWithdraw",{codigo:session.profile.CodigoAcesso,pix,nomeDestinatario:nome},{retries:1,timeoutMs:30000});
      hideLoader();
      if(!res.ok)return showStatus("Não foi possível solicitar agora",safeErrorMessage(res.error||"Tente novamente."));
      closeWithdrawModal();
      showStatus("Saque solicitado","Sua solicitação foi enviada com o valor total do saldo já descontado da taxa de sistema/serviço de R$1,98 por entrega. Pagamentos são feitos quarta e sábado em horário comercial.");
      refreshPanel();
    }catch(e){
      hideLoader();
      if(originalRequestWithdraw) try{ return await originalRequestWithdraw(); }catch(err){}
      showStatus("Erro","Não foi possível solicitar o saque agora.");
    }
  };

  const originalAcceptDelivery = typeof acceptDelivery === "function" ? acceptDelivery : null;
  const acceptingSet = new Set();
  acceptDelivery = async function(id){
    id=String(id||"");
    if(!id || acceptingSet.has(id)) return;
    acceptingSet.add(id);
    try{
      if(originalAcceptDelivery) return await originalAcceptDelivery(id);
    }finally{
      acceptingSet.delete(id);
    }
  };

  const originalUpdateStatus = typeof updateStatus === "function" ? updateStatus : null;
  const updatingStatusSet = new Set();
  updateStatus = async function(id,status){
    id=String(id||"");
    const key=id+"_"+String(status||"");
    if(!id || updatingStatusSet.has(key)) return;
    updatingStatusSet.add(key);
    try{
      if(originalUpdateStatus) return await originalUpdateStatus(id,status);
    }catch(e){
      hideLoader();
      alert(safeErrorMessage(e&&e.message?e.message:"Erro ao atualizar."));
    }finally{
      updatingStatusSet.delete(key);
    }
  };

  const originalRegisterPayment = typeof registerPayment === "function" ? registerPayment : null;
  let paymentBusy=false;
  registerPayment = async function(status){
    if(paymentBusy) return;
    paymentBusy=true;
    try{
      if(originalRegisterPayment) return await originalRegisterPayment(status);
    }finally{
      paymentBusy=false;
    }
  };

  const originalSendChatMessage = typeof sendChatMessage === "function" ? sendChatMessage : null;
  let chatBusy=false;
  sendChatMessage = async function(){
    if(chatBusy) return;
    chatBusy=true;
    try{
      if(originalSendChatMessage) return await originalSendChatMessage();
    }finally{
      chatBusy=false;
    }
  };

  const originalShowStatus = typeof showStatus === "function" ? showStatus : null;
  showStatus = function(title,text){
    try{
      safeText("statusTitle", title || "Status");
      safeText("statusText", text || "");
      safeClassAdd("statusModal","active");
    }catch(e){
      if(originalShowStatus) try{ originalShowStatus(title,text); }catch(err){}
    }
  };

  closeStatusModal = function(){ safeClassRemove("statusModal","active"); };
  closePaymentModal = function(){ safeClassRemove("paymentModal","active"); currentPaymentDeliveryId=""; };
  closePaymentsModal = function(){ safeClassRemove("paymentsModal","active"); };
  closeDriverHistoryModal = function(){ safeClassRemove("driverHistoryModal","active"); };
  closeWithdrawModal = function(){ safeClassRemove("withdrawModal","active"); };

  const originalOpenSideMenu = typeof openSideMenu === "function" ? openSideMenu : null;
  openSideMenu = function(){
    try{
      renderDriverHeader();
      safeClassAdd("sideMenuBackdrop","active");
      safeClassAdd("sideMenu","active");
    }catch(e){
      if(originalOpenSideMenu) try{ originalOpenSideMenu(); }catch(err){}
    }
  };
  closeSideMenu = function(){
    safeClassRemove("sideMenuBackdrop","active");
    safeClassRemove("sideMenu","active");
  };

  const originalLogout = typeof logout === "function" ? logout : null;
  logout = function(){
    try{
      closeSideMenu();
      showLoader("Saindo...");
      setTimeout(()=>{
        if(refreshTimer) clearTimeout(refreshTimer);
        localStorage.removeItem("pegaleva_driver");
        try{ clearAppCache&&clearAppCache(); }catch(e){}
        session=null;
        hideLoader();
        safeClassRemove("appScreen","active");
        safeClassAdd("loginScreen","active");
        safeSetValue("driverCode","");
      },1200);
    }catch(e){
      if(originalLogout) try{ originalLogout(); }catch(err){}
    }
  };

  window.addEventListener("online",()=>{ if(session) refreshPanel(); });
  window.addEventListener("error",()=>{ try{ hideLoader(); }catch(e){} });
  window.addEventListener("unhandledrejection",()=>{ try{ hideLoader(); }catch(e){} });

  try{
    openDeliveryDetails = Array.isArray(openDeliveryDetails) ? openDeliveryDetails : safeJsonParse(localStorage.getItem("pegaleva_open_delivery_details"),[]);
    lastAvailableIds = Array.isArray(lastAvailableIds) ? lastAvailableIds : safeJsonParse(localStorage.getItem("pegaleva_seen_deliveries"),[]);
    finalizedShown = Array.isArray(finalizedShown) ? finalizedShown : safeJsonParse(localStorage.getItem("pegaleva_finalized_driver"),[]);
    refusedDeliveries = refusedDeliveries && typeof refusedDeliveries === "object" ? refusedDeliveries : safeJsonParse(localStorage.getItem("pegaleva_refused_temp"),{});
  }catch(e){}
})();




/* ===== Melhoria de resposta do som de nova entrega ===== */
(function(){
  if (typeof notificationAudio !== "undefined" && notificationAudio) {
    try { notificationAudio.preload = "auto"; } catch(e){}
  }

  if (typeof playNotificationSound === "function") {
    const _oldPlay = playNotificationSound;
    playNotificationSound = function(){
      try{
        if (typeof notificationAudio !== "undefined" && notificationAudio){
          notificationAudio.currentTime = 0;
        }
      }catch(e){}
      return _oldPlay.apply(this, arguments);
    };
  }

  if (typeof refreshPanel === "function") {
    const _refreshPanel = refreshPanel;
    refreshPanel = async function(){
      const before = Array.isArray(window.lastAvailableIds) ? [...window.lastAvailableIds] : [];
      const result = await _refreshPanel.apply(this, arguments);
      try{
        if(Array.isArray(window.lastAvailableIds) && before.length < window.lastAvailableIds.length){
          if(typeof playNotificationSound==="function"){
            playNotificationSound();
          }
        }
      }catch(e){}
      return result;
    };
  }
})();


/* =========================================================
   Alerta persistente de entregas disponíveis
   Toca também para entregas já existentes ao abrir o painel
   e repete a cada 5 segundos até aceitar ou recusar.
========================================================= */
(function(){
  let persistentDeliveryAlertTimer = null;
  let persistentDeliveryAlertIds = [];

  function normalizeAvailableDeliveries(list){
    try{
      return (list||[])
        .filter(d=>d && d.ID)
        .filter(d=>!isClosedDelivery(d.Status))
        .filter(d=>!refusedDeliveries[d.ID]);
    }catch(e){
      return [];
    }
  }

  function currentVisibleAvailableDeliveries(){
    return normalizeAvailableDeliveries(window.lastAvailableDeliveries||[]);
  }

  function stopPersistentDeliveryAlert(){
    if(persistentDeliveryAlertTimer){
      clearInterval(persistentDeliveryAlertTimer);
      persistentDeliveryAlertTimer = null;
    }
    persistentDeliveryAlertIds = [];
  }

  function shouldKeepAlerting(){
    const available = currentVisibleAvailableDeliveries();
    const active = session && session.profile && String(session.profile.Ativo||"").toLowerCase()==="ativo";
    if(!active || !available.length)return false;
    const ids = available.map(d=>String(d.ID));
    return persistentDeliveryAlertIds.some(id=>ids.includes(String(id)));
  }

  function startPersistentDeliveryAlert(list){
    const available = normalizeAvailableDeliveries(list);
    const active = session && session.profile && String(session.profile.Ativo||"").toLowerCase()==="ativo";
    if(!active || !available.length){
      stopPersistentDeliveryAlert();
      return;
    }

    persistentDeliveryAlertIds = available.map(d=>String(d.ID));

    try{ playDeliveryAlert(); }catch(e){}
    try{
      browserNotify(
        "Entrega disponível",
        available.length===1
          ? `${available[0].BairroColeta||"Coleta"} para ${available[0].BairroDestino||"Destino"}`
          : `${available.length} entregas disponíveis`
      );
    }catch(e){}

    if(persistentDeliveryAlertTimer)return;

    persistentDeliveryAlertTimer = setInterval(()=>{
      if(!shouldKeepAlerting()){
        stopPersistentDeliveryAlert();
        return;
      }
      try{ playDeliveryAlert(); }catch(e){}
    },5000);
  }

  const originalDetectNewDeliveryPersistent = typeof detectNewDelivery === "function" ? detectNewDelivery : null;
  detectNewDelivery = function(list){
    const available = normalizeAvailableDeliveries(list);
    const active = session && session.profile && String(session.profile.Ativo||"").toLowerCase()==="ativo";

    if(!active || !available.length){
      stopPersistentDeliveryAlert();
      if(originalDetectNewDeliveryPersistent) return originalDetectNewDeliveryPersistent(list);
      return;
    }

    const newOnes = available.filter(d=>!lastAvailableIds.includes(d.ID));
    const hasModalActive = document.getElementById("bottomOfferBar") && document.getElementById("bottomOfferBar").classList.contains("active");

    lastAvailableIds = available.map(d=>d.ID);
    localStorage.setItem("pegaleva_seen_deliveries",JSON.stringify(lastAvailableIds));

    if(newOnes.length){
      modalQueue = modalQueue.concat(newOnes.filter(d=>!modalQueue.some(q=>q.ID===d.ID)));
      if(!hasModalActive)showNextModalDelivery();
      startPersistentDeliveryAlert(available);
      return;
    }

    if(!persistentDeliveryAlertTimer && available.length){
      modalQueue = modalQueue.concat(available.filter(d=>!modalQueue.some(q=>q.ID===d.ID)));
      if(!hasModalActive)showNextModalDelivery();
      startPersistentDeliveryAlert(available);
    }
  };

  const originalAcceptDeliveryPersistent = typeof acceptDelivery === "function" ? acceptDelivery : null;
  acceptDelivery = async function(id){
    stopPersistentDeliveryAlert();
    if(originalAcceptDeliveryPersistent) return await originalAcceptDeliveryPersistent(id);
  };

  const originalRefuseDeliveryPersistent = typeof refuseDelivery === "function" ? refuseDelivery : null;
  refuseDelivery = function(id){
    stopPersistentDeliveryAlert();
    if(originalRefuseDeliveryPersistent) return originalRefuseDeliveryPersistent(id);
  };

  const originalCloseModalPersistent = typeof closeModal === "function" ? closeModal : null;
  closeModal = function(){
    if(!currentVisibleAvailableDeliveries().length)stopPersistentDeliveryAlert();
    if(originalCloseModalPersistent)return originalCloseModalPersistent();
  };

  window.addEventListener("beforeunload",stopPersistentDeliveryAlert);
})();
