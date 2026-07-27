
const API_URL="https://script.google.com/macros/s/AKfycbyn3065wcnSaDbtTGkjf78a-E5xvuyTn_grtEbWaS3LO8ziPX_I8BmrCKb3NzE3Mk_Y/exec";
const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const state={driver:null,token:"",revision:"",trips:[],availableTrips:[],currentPaymentCode:"",currentPhotoCode:"",photoBase64:"",loading:false,balanceVisible:true,dashboardTimer:null,dashboardBusy:false,pendingWhatsapp:null,lastAvailableCount:0};
async function api(action,data={},options={}){
  if(!API_URL.startsWith("https://script.google.com/"))throw new Error("Cole a URL do Apps Script no HTML.");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),options.timeout||15000);
  const payload={action,...data};
  if(state.token)payload.token=state.token;
  try{
    const r=await fetch(API_URL,{
      method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload),signal:controller.signal,cache:"no-store"
    });
    if(!r.ok)throw new Error("Falha de conexão com o servidor.");
    const j=await r.json();
    if(!j.ok){
      if(/sessão expirada|não autorizado/i.test(j.error||"")){
        clearInterval(state.dashboardTimer);
        sessionStorage.removeItem("pl_driver");
        state.driver=null;state.token="";
        show("loginView");
      }
      throw new Error(j.error||"Erro.");
    }
    return j;
  }catch(e){
    if(e.name==="AbortError")throw new Error("A conexão demorou demais. Tente novamente.");
    if(!options.noRetry && /fetch|conexão|network/i.test(String(e.message))){
      await new Promise(r=>setTimeout(r,900));
      return api(action,data,{...options,noRetry:true});
    }
    throw e;
  }finally{clearTimeout(timeout)}
}
function show(id){["loginView","appView"].forEach(x=>$(x).classList.add("hide"));$(id).classList.remove("hide")}
function openL(id){$(id).classList.add("on")}function closeL(id){$(id).classList.remove("on")}
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("on");setTimeout(()=>$("toast").classList.remove("on"),2600)}
function showActionLoading(title,text){
  state.loading=true;
  actionLoadingTitle.textContent=title||"Processando...";
  actionLoadingText.textContent=text||"Aguarde enquanto atualizamos as informações.";
  actionLoading.classList.add("on");
}
function hideActionLoading(){state.loading=false;actionLoading.classList.remove("on")}
async function withActionLoading(title,text,task){
  showActionLoading(title,text);
  try{return await task()}finally{hideActionLoading()}
}
function motoboyWhatsappMessage(message){
  const driverName=String(state.driver&&state.driver.name||"Entregador").trim();
  const cleanMessage=String(message||"").trim();
  return `*Atendimento Motoboy: ${driverName}*\n\n${cleanMessage}`;
}
function wa(number,message){
  let n=String(number||"").replace(/\D/g,"");
  if(!n)return;
  if(!n.startsWith("55"))n="55"+n;
  const organizedMessage=motoboyWhatsappMessage(message);
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(organizedMessage)}`,"_blank")
}
function statusLabel(s){const m={"AGUARDANDO ENTREGADOR":"Aguardando entregador","ACEITA":"Corrida aceita","FINALIZANDO CORRIDA PRÓXIMA":"Finalizando corrida próxima","ESTOU INDO":"Estou indo","FINALIZADA":"Corrida finalizada"};return m[String(s||"").toUpperCase()]||s}
togglePassword.onclick=()=>{const visible=password.type==="text";password.type=visible?"password":"text";togglePassword.innerHTML=`<i class="fa-regular ${visible?"fa-eye":"fa-eye-slash"}"></i>`}
function rememberLoginCheckbox(){
  return $("saveLogin")||$("rememberLogin")||$("saveInfo")||
    loginForm.querySelector('input[type="checkbox"]');
}
loginForm.onsubmit=async e=>{
  e.preventDefault();loginError.textContent="";
  try{
    const j=await withActionLoading("Entrando no painel","Conferindo seu e-mail e sua senha.",()=>api("driverLogin",{email:email.value.trim().toLowerCase(),password:password.value}));
    const remember=!!rememberLoginCheckbox()?.checked;
    openApp(j.driver,j.token,remember)
  }catch(x){loginError.textContent=x.message}
}
function openApp(driver,token,remember=false){
state.driver=driver;state.token=token||state.token;state.revision="";
const savedSession=JSON.stringify({driver,token:state.token});
sessionStorage.setItem("pl_driver",savedSession);
if(remember)localStorage.setItem("pl_driver_saved",savedSession);
else if(!localStorage.getItem("pl_driver_saved"))localStorage.removeItem("pl_driver_saved");
const firstName=String(driver.name||"").trim().split(/\s+/)[0]||"Entregador";
welcomeName.textContent=`Olá, ${firstName}!`;driverInfo.textContent=`${driver.plate||"Sem placa"} • ${driver.whatsapp||""}`;withdrawEmail.value=driver.email||"";show("appView");dashboard();startDriverPolling()
}
async function dashboard(useLoading=false){
  if(state.dashboardBusy)return;
  state.dashboardBusy=true;
  const load=()=>api("driverDashboard",{sinceRevision:state.revision},{timeout:12000});
  try{
    const j=useLoading
      ?await withActionLoading("Atualizando entregas","Buscando saldos, corridas e pagamentos.",load)
      :await load();
    if(j.unchanged)return;
    state.revision=String(j.revision||state.revision||"");
    state.driver=j.driver;
    state.trips=j.trips||[];
    state.availableTrips=j.availableTrips||[];
    balance.textContent=state.balanceVisible?money.format(j.driver.balance||0):"R$ •••••";
    discountBadge.textContent=j.driver.autoDiscount?"Desconto automático ativo":"Saldo disponível";
    balanceInfo.textContent=j.driver.autoDiscount?`O saldo já considera o desconto automático de ${money.format(j.driver.fee||0)} por corrida.`:"Valor integral das corridas finalizadas.";
    tripCount.textContent=`${state.trips.filter(t=>!["FINALIZADA","CANCELADA PELO ENTREGADOR"].includes(String(t.status).toUpperCase())).length} corrida(s)`;
    renderTrips();renderHistory();renderAvailableTrips()
  }catch(x){toast(x.message)}
  finally{state.dashboardBusy=false}
}
function startDriverPolling(){
  clearInterval(state.dashboardTimer);
  state.dashboardTimer=setInterval(()=>{
    if(state.driver&&!document.hidden&&navigator.onLine)dashboard(false);
  },7000);
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.driver)dashboard(false)});
window.addEventListener("online",()=>{if(state.driver){toast("Conexão restabelecida.");dashboard(false)}});
window.addEventListener("offline",()=>toast("Você está sem internet. O painel atualizará ao reconectar."));
function renderTrips(){
  const active=state.trips
    .filter(t=>!["FINALIZADA","CANCELADA PELO ENTREGADOR"].includes(String(t.status).toUpperCase()))
    .sort((a,b)=>Number(a.acceptedMs||a.createdMs||0)-Number(b.acceptedMs||b.createdMs||0));

  tripCarousel.innerHTML=active.length?active.map(t=>{
    const paymentReady=!!t.paymentDefined;
    return `
<article class="trip-card active">
  <div class="trip-top">
    <div><div class="trip-code">${t.code}</div><span class="status">${statusLabel(t.status)}</span></div>
    <div style="display:flex;align-items:center;gap:8px">
      <div class="trip-price">${money.format(t.value)}</div>
      <button class="card-menu-btn" onclick="toggleTripCommands('${t.code}')" title="Comandos da corrida">
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>
  </div>
  <div class="route">
    <div class="route-line"><div class="dot"><i class="fa-solid fa-circle"></i></div><div class="dot" style="margin-top:30px"><i class="fa-solid fa-flag-checkered"></i></div></div>
    <div><strong>${t.originNeighborhood}</strong><span>${t.origin}</span><strong style="margin-top:18px">${t.destinationNeighborhood}</strong><span>${t.destination}</span></div>
  </div>
  <div class="meta">
    <span>${t.contentType}</span>
    <span>Retorno: ${t.returnTrip}</span>
    <span>Tempo estimado: ${t.estimatedMinutes} min</span>
    <span>Pagamento: ${paymentReady?t.paymentStatus:"Não informado"}</span>
  </div>
  <div class="card-command-menu" id="tripCommands-${t.code}">
    <button class="btn secondary" onclick="updateTrip('${t.code}','FINALIZANDO CORRIDA PRÓXIMA')"><i class="fa-solid fa-motorcycle"></i> Finalizando</button>
    <button class="btn primary" onclick="updateTrip('${t.code}','ESTOU INDO')"><i class="fa-solid fa-motorcycle"></i> Estou indo</button>
    <button class="btn success-btn" onclick="alertCustomer('${t.code}')"><i class="fa-brands fa-whatsapp"></i> Alertar cliente</button>
    <button class="btn danger-btn" onclick="reportLocationError('${t.code}')"><i class="fa-solid fa-triangle-exclamation"></i> Erro na localização</button>
  </div>
  <div class="controls">
    <button class="camera-btn" onclick="openPhoto('${t.code}')" title="Registrar foto"><i class="fa-solid fa-camera"></i></button>
    <button class="btn outline wide" onclick="openPayment('${t.code}',${Number(t.value)})"><i class="fa-solid fa-money-bill-wave"></i> Informar pagamento</button>
    ${paymentReady?`<button class="btn success-btn wide" onclick="finalizeTrip('${t.code}')"><i class="fa-solid fa-flag-checkered"></i> Finalizar corrida</button>`:""}
    <button class="btn danger-btn wide" onclick="cancelTrip('${t.code}')"><i class="fa-solid fa-ban"></i> Cancelar corrida</button>
  </div>
</article>`}).join(""):`<div class="empty">Nenhuma corrida ativa. Veja as novas solicitações no botão da moto ou use o botão +.</div>`;

  requestAnimationFrame(()=>{tripCarousel.scrollLeft=0});
}
function renderHistory(){const done=state.trips.filter(t=>String(t.status).toUpperCase()==="FINALIZADA");historyList.innerHTML=done.length?done.map(t=>`<div class="trip-card" style="margin-bottom:10px"><div class="trip-top"><div class="trip-code">${t.code}</div><div class="trip-price">${money.format(t.value)}</div></div><p class="muted">${t.originNeighborhood} → ${t.destinationNeighborhood}</p><span class="status">${t.paymentStatus}</span>${t.photoUrl?`<p><a href="${t.photoUrl}" target="_blank">Ver comprovante da entrega</a></p>`:""}</div>`).join(""):`<div class="empty">Nenhuma corrida finalizada.</div>`}
manualAddTripBtn.onclick=()=>{tripCodeInput.value="";openL("addTripSheet")}
newRequestsBtn.onclick=()=>{openRequestsDrawer()}
closeRequestsBtn.onclick=()=>closeRequestsDrawer()
requestsDrawer.onclick=e=>{if(e.target===requestsDrawer)closeRequestsDrawer()}
function openRequestsDrawer(){
  requestsDrawer.classList.add("on");
  dashboard(false);
}
function closeRequestsDrawer(){requestsDrawer.classList.remove("on")}

function playNewTripSound(){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const now=ctx.currentTime;
    [1046,1318,1567,2093].forEach((f,i)=>{
      const o=ctx.createOscillator();
      const g=ctx.createGain();
      o.type="square";
      o.frequency.value=f;
      o.connect(g);g.connect(ctx.destination);
      const s=now+i*0.18;
      g.gain.setValueAtTime(0.0001,s);
      g.gain.exponentialRampToValueAtTime(0.6,s+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001,s+0.16);
      o.start(s);o.stop(s+0.17);
    });
  }catch(e){}
}

function renderAvailableTrips(){
  const available=[...state.availableTrips].sort((a,b)=>Number(a.createdMs||0)-Number(b.createdMs||0));
  if(state.lastAvailableCount!==0 && available.length>state.lastAvailableCount){
    playNewTripSound();
  }
  state.lastAvailableCount=available.length;
  requestBadge.textContent=available.length>99?"99+":String(available.length);
  requestBadge.classList.toggle("hide",available.length===0);
  requestsList.innerHTML=available.length?available.map(t=>`
    <article class="request-card">
      <div class="trip-top">
        <div><div class="trip-code">${t.code}</div><span class="request-new">Nova solicitação</span></div>
        <div class="trip-price">${money.format(t.value)}</div>
      </div>
      <div class="route">
        <div class="route-line"><div class="dot"><i class="fa-solid fa-circle"></i></div><div class="dot" style="margin-top:30px"><i class="fa-solid fa-flag-checkered"></i></div></div>
        <div><strong>${t.originNeighborhood}</strong><span>${t.origin}</span><strong style="margin-top:18px">${t.destinationNeighborhood}</strong><span>${t.destination}</span></div>
      </div>
      <div class="meta">
        <span>${t.contentType}</span>
        <span>Retorno: ${t.returnTrip}</span>
        <span>${t.estimatedMinutes} min</span>
      </div>
      <button class="btn primary full" onclick="acceptAvailableTrip('${t.code}')"><i class="fa-solid fa-check"></i> Aceitar corrida</button>
    </article>
  `).join(""):`<div class="empty">Nenhuma nova solicitação disponível neste momento.</div>`;
}
async function acceptAvailableTrip(code){
  try{
    const j=await withActionLoading("Aceitando corrida","Confirmando a disponibilidade e adicionando ao seu carrossel.",()=>api("driverAcceptTrip",{driverId:state.driver.id,code}));
    playAcceptSound();
    if(j.notifyWhatsapp&&j.phone&&confirm("Deseja avisar o cliente pelo WhatsApp que a corrida foi aceita?"))wa(j.phone,j.message);
    closeRequestsDrawer();
    openL("acceptedModal");
    setTimeout(()=>closeL("acceptedModal"),2000);
    await dashboard()
  }catch(x){
    toast(x.message);
    await dashboard()
  }
}
function normalizeTripCode(value){
  return String(value||"")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g,"");
}
function formatTripCode(value){
  const clean=normalizeTripCode(value);
  if(clean.length<=3)return clean;
  if(clean.length<=6)return `${clean.slice(0,3)}-${clean.slice(3)}`;
  return `${clean.slice(0,3)}-${clean.slice(3,6)}-${clean.slice(6,7)}`;
}
tripCodeInput.addEventListener("input",()=>{
  const start=tripCodeInput.selectionStart;
  tripCodeInput.value=formatTripCode(tripCodeInput.value);
  tripCodeInput.setSelectionRange(tripCodeInput.value.length,tripCodeInput.value.length);
});

acceptTripBtn.onclick=async()=>{
  const code=normalizeTripCode(tripCodeInput.value);
  if(!code)return toast("Informe o código do pedido.");
  acceptTripBtn.disabled=true;
  try{
    const j=await withActionLoading("Aceitando corrida","Confirmando o código e vinculando a entrega ao seu perfil.",()=>api("driverAcceptTrip",{driverId:state.driver.id,code}));
    closeL("addTripSheet");playAcceptSound();
    if(j.notifyWhatsapp&&j.phone&&confirm("Deseja avisar o cliente pelo WhatsApp que a corrida foi aceita?"))wa(j.phone,j.message);openL("acceptedModal");
    setTimeout(()=>closeL("acceptedModal"),2000);
    await dashboard()
  }catch(x){toast(x.message)}
  finally{acceptTripBtn.disabled=false}
}
function playAcceptSound(){try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(740,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(1040,ctx.currentTime+.18);g.gain.setValueAtTime(.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.35);o.start();o.stop(ctx.currentTime+.35)}catch(e){}}
function playUpdateSound(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return;
    const ctx=new AudioCtx();
    const now=ctx.currentTime;
    [
      {frequency:523.25,start:0,duration:.12},
      {frequency:659.25,start:.12,duration:.12},
      {frequency:783.99,start:.24,duration:.22}
    ].forEach(note=>{
      const oscillator=ctx.createOscillator();
      const gain=ctx.createGain();
      oscillator.type="sine";
      oscillator.frequency.setValueAtTime(note.frequency,now+note.start);
      gain.gain.setValueAtTime(.0001,now+note.start);
      gain.gain.exponentialRampToValueAtTime(.18,now+note.start+.02);
      gain.gain.exponentialRampToValueAtTime(.0001,now+note.start+note.duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now+note.start);
      oscillator.stop(now+note.start+note.duration+.03);
    });
    setTimeout(()=>ctx.close().catch(()=>{}),900);
  }catch(e){}
}
function askWhatsappNotification(phone,message){
  state.pendingWhatsapp={phone:phone||"",message:message||""};
  whatsappConfirmText.textContent="Deseja alertar o cliente via WhatsApp?";
  openL("whatsappConfirmModal");
}
whatsappYesBtn.onclick=()=>{
  const pending=state.pendingWhatsapp;
  closeL("whatsappConfirmModal");
  state.pendingWhatsapp=null;
  if(pending&&pending.phone)wa(pending.phone,pending.message);
}
whatsappNoBtn.onclick=()=>{
  closeL("whatsappConfirmModal");
  state.pendingWhatsapp=null;
}

async function updateTrip(code,status){
  try{
    const tripBeforeUpdate=state.trips.find(t=>String(t.code)===String(code));
    const j=await withActionLoading(
      "Atualizando situação",
      `${statusLabel(status)}. Salvando a alteração na corrida.`,
      ()=>api("driverUpdateStatus",{driverId:state.driver.id,code,status})
    );
    toast(statusLabel(status));
    playUpdateSound();
    await dashboard();

    // FINALIZANDO e ESTOU INDO avisam sempre o SOLICITANTE da entrega.
    const normalizedStatus=String(status||"").toUpperCase();
    const requesterPhone=String(tripBeforeUpdate&&tripBeforeUpdate.requesterWhatsapp||"").trim();
    const notificationPhone=["FINALIZANDO CORRIDA PRÓXIMA","ESTOU INDO"].includes(normalizedStatus)
      ?requesterPhone
      :String(j.phone||"").trim();

    if(j.notifyWhatsapp&&notificationPhone){
      askWhatsappNotification(notificationPhone,j.message);
    }
  }catch(x){
    toast(x.message)
  }
}
function openPayment(code,value){
  state.currentPaymentCode=code;
  paymentValue.textContent=money.format(value);
  paymentChoiceInfo.classList.add("hide");
  paymentChoiceInfo.textContent="";
  openL("paymentSheet")
}
paidBtn.onclick=()=>setPaymentStatus("PAGO");
pendingBtn.onclick=()=>setPaymentStatus("PENDENTE");

async function setPaymentStatus(paymentStatus){
  try{
    paidBtn.disabled=pendingBtn.disabled=true;
    const j=await withActionLoading(
      paymentStatus==="PAGO"?"Confirmando pagamento":"Registrando pagamento pendente",
      "Salvando a situação do pagamento sem finalizar a corrida.",
      ()=>api("driverSetPaymentStatus",{driverId:state.driver.id,code:state.currentPaymentCode,paymentStatus})
    );
    paymentChoiceInfo.textContent=paymentStatus==="PAGO"
      ?"Pagamento realizado registrado. Agora você pode finalizar a corrida."
      :"Pagamento pendente registrado. Agora você pode finalizar a corrida.";
    paymentChoiceInfo.classList.remove("hide");
    setTimeout(()=>closeL("paymentSheet"),900);
    await dashboard()
  }catch(x){toast(x.message)}
  finally{paidBtn.disabled=pendingBtn.disabled=false}
}
async function finalizeTrip(code){
  if(!confirm("Confirma que a entrega foi concluída e deseja finalizar esta corrida?"))return;

  const tripBeforeFinalize=state.trips.find(
    t=>String(t.code)===String(code)
  );

  try{
    const j=await withActionLoading(
      "Finalizando corrida",
      "Calculando o ganho e atualizando o saldo do entregador.",
      ()=>api("driverFinalizeTrip",{driverId:state.driver.id,code})
    );

    toast("Corrida finalizada com sucesso.");

    // Ao finalizar, avisa sempre quem SOLICITOU a entrega.
    const requesterPhone=String(
      tripBeforeFinalize&&tripBeforeFinalize.requesterWhatsapp||""
    ).trim();

    const finalPhone=requesterPhone||String(j.phone||"").trim();

    if(
      j.notifyWhatsapp&&
      finalPhone&&
      confirm("Deseja avisar o solicitante pelo WhatsApp que a corrida foi finalizada?")
    ){
      wa(finalPhone,j.message);
    }

    await dashboard()
  }catch(x){
    toast(x.message)
  }
}
async function cancelTrip(code){
  if(!confirm("Deseja cancelar esta corrida? Ela ficará disponível para outro entregador."))return;
  try{
    await withActionLoading("Cancelando corrida","Removendo a corrida do seu painel e liberando para outro entregador.",()=>api("driverCancelTrip",{driverId:state.driver.id,code}));
    toast("Corrida cancelada e liberada.");
    await dashboard()
  }catch(x){toast(x.message)}
}
withdrawBtn.onclick=withdrawNav.onclick=()=>{withdrawValue.value=String(state.driver.balance||0).replace(".",",");openL("withdrawSheet")}
submitWithdraw.onclick=async()=>{
  const value=Number(withdrawValue.value.replace(/\./g,"").replace(",","."));
  if(!value||value<=0)return toast("Informe um valor válido.");
  try{
    await withActionLoading("Solicitando saque","Registrando seus dados de pagamento.",()=>api("requestWithdrawal",{driverId:state.driver.id,value,email:withdrawEmail.value.trim(),pixKey:withdrawPix.value.trim()}));
    closeL("withdrawSheet");toast("Solicitação de saque registrada.")
  }catch(x){toast(x.message)}
}
toggleBalance.onclick=()=>{
  state.balanceVisible=!state.balanceVisible;
  toggleBalance.innerHTML=state.balanceVisible
    ?'<i class="fa-regular fa-eye"></i>'
    :'<i class="fa-regular fa-eye-slash"></i>';
  balance.textContent=state.balanceVisible?money.format(state.driver.balance||0):"R$ •••••";
}
historyNav.onclick=()=>openL("historySheet");refreshBtn.onclick=()=>dashboard(true);logoutBtn.onclick=async()=>{
  try{await api("logout",{}, {timeout:5000,noRetry:true})}catch(e){}
  clearInterval(state.dashboardTimer);
  sessionStorage.removeItem("pl_driver");
  localStorage.removeItem("pl_driver_saved");
  state.driver=null;state.token="";state.revision="";show("loginView")
}
function toggleTripCommands(code){
  const menu=$("tripCommands-"+code);
  if(menu)menu.classList.toggle("on");
}
function alertCustomer(code){
  const trip=state.trips.find(t=>String(t.code)===String(code));
  if(!trip){
    toast("Corrida não encontrada.");
    return;
  }
  const company=String(trip.requesterName||"Empresa").trim();
  const phone=String(trip.receiverWhatsapp||"").trim();
  if(!phone){
    toast("WhatsAppRecebedor não informado na aba CORRIDAS.");
    return;
  }
  const message=`Pedido de ${company} chegou em seu endereço. Onde você se encontra?`;
  wa(phone,message);
}
function reportLocationError(code){
  const trip=state.trips.find(t=>String(t.code)===String(code));
  if(!trip){
    toast("Corrida não encontrada.");
    return;
  }
  const phone=String(trip.requesterWhatsapp||"").trim();
  if(!phone){
    toast("WhatsAppSolicitante não informado na aba CORRIDAS.");
    return;
  }
  const driverName=String(state.driver&&state.driver.name||"Entregador").trim();
  const message=`⚠️ Erro na localização do pedido ${trip.code}.\n\nO entregador ${driverName} informou que existe um erro na localização enviada e o cliente não se encontra no local. Por favor, confirme e envie a localização correta.`;
  wa(phone,message);
}
floatingWazeBtn.onclick=()=>{
  const activeTrip=state.trips.find(t=>!["FINALIZADA","CANCELADA PELO ENTREGADOR"].includes(String(t.status).toUpperCase()));
  if(!activeTrip){
    toast("Nenhuma corrida ativa para abrir no Waze.");
    return;
  }
  openWaze();
}

function openWaze(){
  window.open("https://waze.com","_blank");
}

function openPhoto(code){state.currentPhotoCode=code;state.photoBase64="";photoInput.value="";photoPreview.classList.add("hide");openL("photoSheet")}
photoInput.onchange=()=>{const file=photoInput.files[0];if(!file)return;if(file.size>6*1024*1024){photoInput.value="";return toast("Use uma foto de até 6 MB.");}const reader=new FileReader();reader.onload=()=>{state.photoBase64=reader.result;photoPreview.src=reader.result;photoPreview.classList.remove("hide")};reader.readAsDataURL(file)}
uploadPhotoBtn.onclick=async()=>{
  if(!state.photoBase64)return toast("Selecione uma foto.");
  uploadPhotoBtn.disabled=true;
  try{
    await withActionLoading("Salvando comprovante","Enviando a foto e registrando o link na planilha.",()=>api("uploadDeliveryPhoto",{driverId:state.driver.id,code:state.currentPhotoCode,imageData:state.photoBase64}));
    closeL("photoSheet");toast("Comprovante salvo.");await dashboard()
  }catch(x){toast(x.message)}
  finally{uploadPhotoBtn.disabled=false}
}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeL(b.dataset.close));
document.querySelectorAll(".sheet,.modal").forEach(x=>x.onclick=e=>{if(e.target===x)closeL(x.id)});
let saved=null;
try{
  saved=JSON.parse(
    sessionStorage.getItem("pl_driver")||
    localStorage.getItem("pl_driver_saved")||
    "null"
  );
}catch(e){
  sessionStorage.removeItem("pl_driver");
  localStorage.removeItem("pl_driver_saved");
}
if(saved?.driver&&saved?.token){
  const remembered=!!localStorage.getItem("pl_driver_saved");
  if($("saveLogin"))$("saveLogin").checked=remembered;
  openApp(saved.driver,saved.token,remembered);
}
