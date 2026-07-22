const API_URL='https://script.google.com/macros/s/AKfycbz_QyJ1x8YR_0Z2O_kCG2yw-vXhBsqei_EW3P3gziZFZ7cZaQVII96oXydfWej0AU1c/exec';

let trackingCode="";
let selectedDeliveryId="";
let refreshTimer=null;
let loading=false;
let lastTrackingResponse=null;

async function api(action,data={}){
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    const response=await fetch(API_URL,{
      method:"POST",
      cache:"no-store",
      signal:controller.signal,
      body:JSON.stringify({action,...data,_t:Date.now()})
    });
    clearTimeout(timer);
    const text=await response.text();
    try{return JSON.parse(text)}
    catch(e){return {ok:false,error:"Resposta inválida do servidor."}}
  }catch(e){
    return {ok:false,error:"Falha de conexão. Tente novamente."};
  }
}

function money(v){
  return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function esc(v){
  return String(v??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#039;"
  }[m]));
}

function setLoading(on){
  loading=on;
  const btn=document.getElementById("trackButton");
  if(!btn)return;
  btn.disabled=on;
  btn.innerHTML=on
    ?'<span class="loader"></span> Buscando...'
    :'<i class="fa-solid fa-magnifying-glass-location"></i> Acessar entregas';
}

async function startTracking(){
  if(loading)return;

  const code=document.getElementById("trackingCode").value.trim().toUpperCase();
  if(!code)return showLoginError("Digite o Código ID da empresa ou usuário.");

  trackingCode=code;
  selectedDeliveryId="";
  localStorage.setItem("pegaleva_tracking_code",code);

  setLoading(true);
  const ok=await loadTracking(true);
  setLoading(false);

  if(ok)scheduleRefresh();
}

function showLoginError(msg){
  document.getElementById("loginError").innerHTML='<div class="error">'+esc(msg)+'</div>';
}

function scheduleRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(async()=>{
    await loadTracking(false);
    scheduleRefresh();
  },5000);
}

async function loadTracking(first){
  const res=await api("getTrackingPanel",{codigoId:trackingCode});

  if(!res.ok){
    if(first)showLoginError(res.error||"Código ID não encontrado.");
    const note=document.getElementById("refreshNote");
    if(note)note.innerText="Não foi possível atualizar agora. Tentando novamente...";
    return false;
  }

  lastTrackingResponse=res;

  document.getElementById("loginCard").classList.add("hidden");
  document.getElementById("trackingPanel").classList.remove("hidden");

  const list=res.entregas||[];
  if(selectedDeliveryId&&!list.some(item=>String(item.id)===String(selectedDeliveryId))){
    selectedDeliveryId="";
  }

  if(!selectedDeliveryId&&list.length){
    selectedDeliveryId=String(list[0].id);
  }

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

function currentDelivery(res){
  const list=res.entregas||[];
  if(selectedDeliveryId){
    const found=list.find(item=>String(item.id)===String(selectedDeliveryId));
    if(found)return found;
  }
  return list[0]||res.placeholder||res.entregaAtual||null;
}

function selectDelivery(id){
  selectedDeliveryId=String(id||"");
  if(lastTrackingResponse)renderTracking(lastTrackingResponse);
  document.getElementById("trackingDetailCard")?.scrollIntoView({
    behavior:"smooth",
    block:"start"
  });
}

function renderTracking(res){
  const d=currentDelivery(res);
  const list=res.entregas||[];

  document.getElementById("clientName").innerText=res.cliente?.nome||"Cliente";
  document.getElementById("clientCodeLabel").innerText="Código ID: "+(res.codigoId||"---");

  renderDeliveryList(list,res.aguardandoCriacao);

  if(!d)return;

  const pill=document.getElementById("statusPill");
  pill.className="status-pill "+statusClass(d.status);

  document.getElementById("statusLabel").innerText=d.statusLabel||d.status;
  document.getElementById("recordCode").innerText=d.tipoRegistro==="AGUARDANDO"
    ?"Aguardando o entregador criar a corrida"
    :"Corrida "+(d.codigoCT||d.id||"");

  document.getElementById("estimateText").innerText=d.estimativaTexto||"Em andamento";
  document.getElementById("driverName").innerText=d.entregador?.nome||"Entregador PegaLeva";
  document.getElementById("driverPlate").innerText=d.entregador?.placa
    ?("Placa: "+d.entregador.placa)
    :"Os dados do entregador aparecerão quando a corrida for criada.";

  document.getElementById("currentTitle").innerText=d.statusLabel||"Situação da entrega";
  document.getElementById("currentMessage").innerText=d.statusMessage||"A entrega está em andamento.";

  const pickup=[d.coleta?.endereco,d.coleta?.bairro].filter(Boolean).join(" • ");
  const destination=[d.destino?.endereco,d.destino?.bairro,d.destino?.nome].filter(Boolean).join(" • ");

  document.getElementById("pickupText").innerText=pickup||(
    d.tipoRegistro==="AGUARDANDO"
      ?"O local aparecerá quando o entregador criar a corrida."
      :"Local de coleta ainda não informado."
  );

  document.getElementById("destinationText").innerText=destination||(
    d.tipoRegistro==="AGUARDANDO"
      ?"O destino aparecerá quando o entregador criar a corrida."
      :"Destino ainda não informado."
  );

  const valueBox=document.getElementById("selectedValue");
  valueBox.innerText=d.tipoRegistro==="AGUARDANDO"?"Aguardando valor":money(d.valor);

  const step=Math.max(0,Number(d.step||0));
  document.querySelectorAll(".step").forEach(el=>{
    const n=Number(el.dataset.step);
    el.classList.toggle("done",n<step);
    el.classList.toggle("active",n===step);
  });

  document.getElementById("timelineProgress").style.width=
    Math.min(86,Math.max(0,step*21.5))+"%";

  document.getElementById("refreshNote").innerText=
    "Atualizado agora • atualização automática a cada 5 segundos.";
}

function renderDeliveryList(list,waiting){
  const box=document.getElementById("deliveryList");

  if(!list.length){
    box.innerHTML=`
      <div class="waiting-card">
        <div class="waiting-icon"><i class="fa-solid fa-motorcycle"></i></div>
        <div>
          <strong>Entregador a caminho do estabelecimento</strong>
          <p>O entregador está finalizando uma entrega e já está indo até seu estabelecimento.</p>
          <small>A corrida aparecerá aqui quando ele informar seu Código ID e o valor.</small>
        </div>
      </div>`;
    return;
  }

  box.innerHTML=list.map((item,index)=>{
    const active=String(item.id)===String(selectedDeliveryId);
    return `
      <button type="button" class="delivery-choice ${active?"active":""}" onclick="selectDelivery('${esc(item.id)}')">
        <span class="delivery-choice-index">${index+1}</span>
        <span class="delivery-choice-copy">
          <strong>${money(item.valor)}</strong>
          <small>${esc(item.statusLabel||item.status)} • ${esc(item.criadoEm||"")}</small>
        </span>
        <span class="delivery-choice-arrow"><i class="fa-solid fa-chevron-right"></i></span>
      </button>`;
  }).join("");
}

function changeCode(){
  clearTimeout(refreshTimer);
  selectedDeliveryId="";
  lastTrackingResponse=null;
  document.getElementById("trackingPanel").classList.add("hidden");
  document.getElementById("loginCard").classList.remove("hidden");
  document.getElementById("loginError").innerHTML="";
  document.getElementById("trackingCode").focus();
}

document.getElementById("trackingCode").addEventListener("keydown",e=>{
  if(e.key==="Enter")startTracking();
});

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&trackingCode)loadTracking(false);
});

const saved=localStorage.getItem("pegaleva_tracking_code");
if(saved){
  document.getElementById("trackingCode").value=saved;
  trackingCode=saved;
  setTimeout(startTracking,250);
}
