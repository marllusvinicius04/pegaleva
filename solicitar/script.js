
const API_URL="https://script.google.com/macros/s/AKfycbzG1FW8A_75lbydz7NiJoB1_EjWv56apl6iUk2l4Ox7ZUSZstdjjzx-JMaqoMpUd04L/exec";const ADMIN_WHATSAPP="5589994029572";const $=id=>document.getElementById(id);const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});const bairros=["Fogoso","Malvinas","Vaquejada","Centro","Aeroporto","Aeroporto I","Aeroporto II","Novo Horizonte","Novo Horizonte I","Novo Horizonte II","Areia","Esperança","Água Branca","Alto Bonito","São Francisco","Babilônia","Canaã","Bela Vista","Portal dos Cerrados","Cerrados Park","Vista Bela","Benedito Leite"];const state={user:null,token:"",revision:"",trips:[],tripStatusMap:{},dashboardTimer:null,firstDashboard:true,request:{origin:null,destination:null,originNeighborhood:"",destinationNeighborhood:"",receiverName:"",receiverWhatsapp:"",contentType:"",returnTrip:false,freights:[],selectedFreight:null,code:""}};async function api(action,data={},options={}){
  if(!API_URL.startsWith("https://script.google.com/"))throw new Error("Cole a URL do Apps Script no HTML.");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),options.timeout||15000);
  const payload={action,...data};
  if(state.token)payload.token=state.token;
  try{
    const r=await fetch(API_URL,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload),
      signal:controller.signal,
      cache:"no-store"
    });
    if(!r.ok)throw new Error("Falha de conexão com o servidor.");
    const j=await r.json();
    if(!j.ok){
      if(/sessão expirada|não autorizado/i.test(j.error||"")){
        clearInterval(state.dashboardTimer);
        sessionStorage.removeItem("pl_session");
        state.user=null;state.token="";
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
}function show(id){
  ["loginView","accountTypeView","registerView","appView"].forEach(x=>$(x).classList.add("hide"));
  $(id).classList.remove("hide");
  if(typeof floatingTrips!=="undefined" && floatingTrips){
    floatingTrips.style.display=id==="appView"?"block":"none";
  }
}function toast(m){$("toast").textContent=m;$("toast").classList.add("on");setTimeout(()=>$("toast").classList.remove("on"),2400)}
function formatWhatsappBR(value){
  const digits=String(value||"").replace(/\D/g,"").slice(0,11);
  if(digits.length<=2)return digits;
  if(digits.length<=3)return `${digits.slice(0,2)} ${digits.slice(2)}`;
  if(digits.length<=7)return `${digits.slice(0,2)} ${digits.slice(2,3)} ${digits.slice(3)}`;
  return `${digits.slice(0,2)} ${digits.slice(2,3)} ${digits.slice(3,7)}-${digits.slice(7,11)}`;
}
function bindWhatsappMask(input){
  if(!input)return;
  input.value=formatWhatsappBR(input.value);
  input.addEventListener("input",()=>{
    const pos=input.selectionStart;
    input.value=formatWhatsappBR(input.value);
    input.setSelectionRange(input.value.length,input.value.length);
  });
}
function playPositiveConfirmation(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return;
    const ctx=new AudioCtx();
    const now=ctx.currentTime;
    const notes=[
      {f:523.25,t:0,d:.14},
      {f:659.25,t:.13,d:.14},
      {f:783.99,t:.27,d:.24}
    ];
    notes.forEach(n=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type="sine";
      osc.frequency.setValueAtTime(n.f,now+n.t);
      gain.gain.setValueAtTime(.0001,now+n.t);
      gain.gain.exponentialRampToValueAtTime(.22,now+n.t+.02);
      gain.gain.exponentialRampToValueAtTime(.0001,now+n.t+n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now+n.t);
      osc.stop(now+n.t+n.d+.03);
    });
    setTimeout(()=>ctx.close().catch(()=>{}),900);
  }catch(e){}
}
function successNotify(){successToast.classList.add("on");setTimeout(()=>successToast.classList.remove("on"),4000)}
function setLoading(id,on){$(id)?.classList.toggle("on",!!on)}function openL(id){$(id).classList.add("on")}function closeL(id){$(id).classList.remove("on")}function addr(a){if(!a)return"Escolher localização";return a.mode==="whatsapp"?"Enviar localização atual":`${a.street}, ${a.number} • ${a.city}`}function labels(){$("originLabel").textContent=addr(state.request.origin);$("destinationLabel").textContent=addr(state.request.destination)}
function clientStatusLabel(status,paymentStatus){
  const s=String(status||"").toUpperCase();
  const p=String(paymentStatus||"").toUpperCase();
  if(s==="AGUARDANDO ENTREGADOR")return "Aguardando entregador";
  if(s==="ACEITA")return "Entregador aceitou a corrida";
  if(s==="COLETADO")return "Pedido coletado";
  if(s==="FINALIZANDO CORRIDA PRÓXIMA")return "Finalizando corrida próxima";
  if(s==="ESTOU INDO")return "Entregador a caminho";
  if(s==="FINALIZADA")return p==="PAGO"?"Entrega finalizada • Pago":"Entrega finalizada • Pagamento pendente";
  return status||"Status atualizado";
}
function clientStatusIcon(status,paymentStatus){
  const s=String(status||"").toUpperCase();
  if(s==="ACEITA")return "fa-user-check";
  if(s==="COLETADO")return "fa-box";
  if(s==="FINALIZANDO CORRIDA PRÓXIMA")return "fa-route";
  if(s==="ESTOU INDO")return "fa-motorcycle";
  if(s==="FINALIZADA")return String(paymentStatus||"").toUpperCase()==="PAGO"?"fa-circle-check":"fa-flag-checkered";
  return "fa-bell";
}
function statusClass(status,paymentStatus){
  const s=String(status||"").toUpperCase();
  if(s==="ACEITA")return "accepted";
  if(s==="COLETADO"||s==="FINALIZANDO CORRIDA PRÓXIMA")return "collected";
  if(s==="ESTOU INDO")return "going";
  if(s==="FINALIZADA")return String(paymentStatus||"").toUpperCase()==="PAGO"?"paid":"finished";
  return "";
}
let statusAlertTimer=null;
function showStatusAlert(trip){
  clearTimeout(statusAlertTimer);
  statusAlertTitle.textContent=`Pedido ${trip.code}`;
  statusAlertText.textContent=clientStatusLabel(trip.status,trip.paymentStatus);
  statusAlertIcon.innerHTML=`<i class="fa-solid ${clientStatusIcon(trip.status,trip.paymentStatus)}"></i>`;
  statusAlert.classList.add("on");
  statusAlertTimer=setTimeout(()=>statusAlert.classList.remove("on"),5000);

  if("Notification" in window && Notification.permission==="granted"){
    new Notification(`Pega&Leva • Pedido ${trip.code}`,{
      body:clientStatusLabel(trip.status,trip.paymentStatus)
    });
  }
}
function compareTripUpdates(newTrips){
  const next={};
  newTrips.forEach(t=>{
    const key=`${String(t.status||"").toUpperCase()}|${String(t.paymentStatus||"").toUpperCase()}`;
    next[t.code]=key;
    const previous=state.tripStatusMap[t.code];
    if(!state.firstDashboard && previous && previous!==key)showStatusAlert(t);
  });
  state.tripStatusMap=next;
  state.firstDashboard=false;
}
function startDashboardPolling(){
  clearInterval(state.dashboardTimer);
  state.dashboardTimer=setInterval(()=>{
    if(state.user && !document.hidden && navigator.onLine)dashboard(true);
  },7000);
}
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden && state.user)dashboard(true);
});
window.addEventListener("online",()=>{if(state.user){toast("Conexão restabelecida.");dashboard(true)}});
window.addEventListener("offline",()=>toast("Você está sem internet. As informações serão atualizadas ao reconectar."));
async function dashboard(silent=false){
  try{
    const j=await api("dashboard",{sinceRevision:state.revision},{timeout:12000});
    if(j.unchanged)return;
    state.revision=String(j.revision||state.revision||"");
    const newTrips=j.trips||[];
    compareTripUpdates(newTrips);
    state.trips=newTrips;
    $("tripNotification").textContent=state.trips.filter(t=>String(t.status).toUpperCase()!=="FINALIZADA").length;
    $("invoiceBalance").textContent=money.format(j.user.invoiceBalance||0);
    $("invoiceModalBalance").textContent=money.format(j.user.invoiceBalance||0);
    $("invoiceText").textContent=`${j.pendingCount||0} entrega(s) pendente(s).`;
    state.user=j.user||state.user;
    sessionStorage.setItem("pl_session",JSON.stringify({user:state.user,token:state.token}));
    renderBusinessArea(state.user,j.config||{});
    renderAccountPlan(state.user);
    if(document.querySelector("#tripsSheet.on"))trips();
  }catch(e){
    if(!silent)toast(e.message)
  }
}


function normalizeAccountPlan(value){
  const plan=String(value||"GRATUITO").trim().toUpperCase();
  return ["GRATUITO","PARCEIRO","PREMIUM"].includes(plan)?plan:"GRATUITO";
}

function deliveriesAvailableText(user){
  const plan=normalizeAccountPlan(user&&user.plan);
  const available=user&&user.deliveriesAvailable;
  const remaining=user&&user.deliveries;

  if(available&&typeof available==="object"){
    if(available.label)return String(available.label);
    if(available.unlimited)return "Ilimitadas";
    if(Number.isFinite(Number(available.value)))return String(Math.max(0,Number(available.value)));
  }

  if(available!==undefined&&available!==null&&available!==""){
    const text=String(available).trim().toUpperCase();
    if(["ILIMITADO","ILIMITADAS","∞"].includes(text))return "Ilimitadas";
    if(Number.isFinite(Number(available)))return String(Math.max(0,Number(available)));
    return String(available);
  }

  if(remaining!==undefined&&remaining!==null&&remaining!==""){
    const text=String(remaining).trim().toUpperCase();
    if(["ILIMITADO","ILIMITADAS","∞"].includes(text))return "Ilimitadas";
    if(Number.isFinite(Number(remaining)))return String(Math.max(0,Number(remaining)));
  }

  return plan==="GRATUITO"?"Ilimitadas":"0";
}

function completedDeliveriesText(user){
  const directValues=[
    user&&user.completedDeliveries,
    user&&user.deliveriesCompleted,
    user&&user.completed,
    user&&user.totalCompletedDeliveries
  ];

  for(const value of directValues){
    if(value!==undefined&&value!==null&&value!==""&&Number.isFinite(Number(value))){
      return String(Math.max(0,Number(value)));
    }
  }

  const limit=user&&user.deliveryLimit;
  const remaining=user&&user.deliveries;

  const unlimitedLimit=["ILIMITADO","ILIMITADAS","∞"].includes(String(limit||"").trim().toUpperCase());
  const unlimitedRemaining=["ILIMITADO","ILIMITADAS","∞"].includes(String(remaining||"").trim().toUpperCase());

  if(!unlimitedLimit&&!unlimitedRemaining&&Number.isFinite(Number(limit))&&Number.isFinite(Number(remaining))){
    return String(Math.max(0,Number(limit)-Number(remaining)));
  }

  const finalizedLoaded=(state.trips||[]).filter(
    trip=>String(trip&&trip.status||"").toUpperCase()==="FINALIZADA"
  ).length;

  return String(finalizedLoaded);
}

function renderAccountPlan(user){
  if(!user)return;

  const profileSheetBox=document.querySelector("#profileSheet .sheet-box");
  if(!profileSheetBox)return;

  let card=document.getElementById("accountPlanCard");
  if(!card){
    card=document.createElement("div");
    card.id="accountPlanCard";
    card.style.marginTop="16px";
    card.style.padding="16px";
    card.style.border="1px solid #dbe7ff";
    card.style.borderRadius="16px";
    card.style.background="#f8fbff";

    const deleteArea=document.getElementById("deleteAccountBtn")?.parentElement;
    if(deleteArea)profileSheetBox.insertBefore(card,deleteArea);
    else profileSheetBox.appendChild(card);
  }

  const plan=normalizeAccountPlan(user.plan);
  const monthlyFee=money.format(Number(user.monthlyFee||0));
  const completed=completedDeliveriesText(user);
  const available=deliveriesAvailableText(user);

  card.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px">
      <div>
        <small style="display:block;color:#64748b;margin-bottom:4px">Plano contratado</small>
        <strong style="font-size:18px;color:#0646c8">${plan}</strong>
      </div>
      <span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:#e8f0ff;color:#0646c8">
        <i class="fa-solid fa-crown"></i>
      </span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="padding:12px;border-radius:12px;background:#fff">
        <small style="display:block;color:#64748b;margin-bottom:4px">Mensalidade</small>
        <strong>${monthlyFee}</strong>
      </div>

      <div style="padding:12px;border-radius:12px;background:#fff">
        <small style="display:block;color:#64748b;margin-bottom:4px">Entregas realizadas</small>
        <strong>${completed}</strong>
      </div>

      <div style="grid-column:1/-1;padding:12px;border-radius:12px;background:#fff">
        <small style="display:block;color:#64748b;margin-bottom:4px">Entregas disponíveis</small>
        <strong>${available}</strong>
      </div>
    </div>
  `;
}

function renderBusinessArea(user,config){
  const isCompany=!!(user&&user.isCompany);
  const catalogLink=String(user&&user.catalogLink||"").trim();
  businessSection.classList.toggle("hide",!isCompany);
  marketingBanner.classList.add("hide");

  if(isCompany){
    const active=!!catalogLink;
    catalogOfferCard.classList.toggle("hide",active);
    catalogActiveCard.classList.toggle("hide",!active);
    if(active){
      catalogLinkInput.value=catalogLink;
      openCatalogLink.href=catalogLink;
    }
    return;
  }

  if(config&&config.bannerUrl){
    bannerImage.src=config.bannerUrl;
    marketingBanner.href=config.bannerLink||"#";
    marketingBanner.classList.remove("hide");
  }
}
catalogLearnMore.onclick=()=>openL("catalogInfoModal");
catalogContactBtn.onclick=()=>{
  const name=String(state.user&&state.user.name||"").trim();
  const message=`Olá! Sou ${name} e tenho interesse no catálogo com integração de fretes por R$ 49,90 por mês. Gostaria de saber como ativar.`;
  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`,"_blank");
};
copyCatalogLink.onclick=async()=>{
  const link=String(catalogLinkInput.value||"").trim();
  if(!link)return toast("Link do catálogo ainda não informado.");
  try{
    await navigator.clipboard.writeText(link);
    toast("Link do catálogo copiado.");
  }catch(e){
    catalogLinkInput.select();
    document.execCommand("copy");
    toast("Link do catálogo copiado.");
  }
};
function openApp(u,token){state.user=u;state.token=token||state.token;state.revision="";state.firstDashboard=true;state.tripStatusMap={};sessionStorage.setItem("pl_session",JSON.stringify({user:u,token:state.token}));const firstName=String(u.name||"").trim().split(/\s+/)[0]||"";
$("welcomeName").textContent=`Olá, ${firstName}!`;$("welcomeCompany").textContent=`${u.city}`;$("profileName").textContent=u.name;$("profileCompany").textContent=u.company;$("profileAddress").textContent=`${u.street}, ${u.number} • ${u.city}`;show("appView");floatingTrips.style.display="block";renderBusinessArea(u,{});renderAccountPlan(u);dashboard();startDashboardPolling();
  if("Notification" in window && Notification.permission==="default"){
    setTimeout(()=>Notification.requestPermission().catch(()=>{}),1500);
  }
}
let registerAccountType="PESSOAL";
$("openRegister").onclick=()=>show("accountTypeView");
$("backFromAccountType").onclick=()=>show("loginView");
$("choosePersonalAccount").onclick=()=>startRegistration("PESSOAL");
$("chooseCompanyAccount").onclick=()=>startRegistration("EMPRESA");
function startRegistration(type){
  registerAccountType=type;
  registerStep=0;
  $("registerForm").reset();
  renderRegisterStep();
  show("registerView");
}
$("backLogin").onclick=()=>show("loginView");

let registerStep=0;
function renderRegisterStep(){
  document.querySelectorAll(".register-step").forEach((el,i)=>el.classList.toggle("on",i===registerStep));
  document.querySelectorAll("#registerProgress span").forEach((el,i)=>el.classList.toggle("on",i<=registerStep));
  $("registerBack").classList.toggle("hide",registerStep===0);
  $("registerNext").classList.toggle("hide",registerStep===2);
  $("registerSubmit").classList.toggle("hide",registerStep!==2);
}
function currentRegisterFieldsValid(){
  const step=document.querySelector(`.register-step[data-register-step="${registerStep}"]`);
  const fields=[...step.querySelectorAll("input,select")];
  for(const field of fields){
    if(!field.checkValidity()){field.reportValidity();field.focus();return false}
  }
  return true;
}
$("registerNext").onclick=()=>{
  if(!currentRegisterFieldsValid())return;
  setLoading("registerStepLoading",true);
  $("registerNext").disabled=true;
  setTimeout(()=>{registerStep++;renderRegisterStep();setLoading("registerStepLoading",false);$("registerNext").disabled=false},550)
};
$("registerBack").onclick=()=>{if(registerStep>0){registerStep--;renderRegisterStep()}};

document.querySelectorAll("[data-toggle-password]").forEach(btn=>{
  btn.onclick=()=>{
    const input=$(btn.dataset.togglePassword);
    const visible=input.type==="text";
    input.type=visible?"password":"text";
    btn.innerHTML=`<i class="fa-regular ${visible?"fa-eye":"fa-eye-slash"}"></i>`;
    input.focus();
  };
});

const QUICK_LOGIN_KEY="pl_quick_login_account";

function getQuickLoginAccount(){
  try{
    return JSON.parse(localStorage.getItem(QUICK_LOGIN_KEY)||"null");
  }catch(e){
    localStorage.removeItem(QUICK_LOGIN_KEY);
    return null;
  }
}

function saveQuickLoginAccount(user,email,password){
  const account={
    name:String(user&&user.name||"Conta salva").trim(),
    email:String(email||"").trim().toLowerCase(),
    password:String(password||"")
  };
  localStorage.setItem(QUICK_LOGIN_KEY,JSON.stringify(account));
  renderQuickLoginAccount();
}

function removeQuickLoginAccount(){
  localStorage.removeItem(QUICK_LOGIN_KEY);
  localStorage.removeItem("pl_saved_email");
  renderQuickLoginAccount();
}

function renderQuickLoginAccount(){
  const account=getQuickLoginAccount();
  const valid=!!(account&&account.email&&account.password);
  $("quickLoginBox")?.classList.toggle("hide",!valid);
  if(!valid)return;
  $("quickLoginName").textContent=account.name||"Conta salva";
  $("quickLoginEmail").textContent=account.email;
}

async function performLogin(email,password,quick=false){
  loginError.textContent="";
  quickLoginError.textContent="";

  try{
    if(quick)setLoading("quickLoginLoading",true);
    else setLoading("loginLoading",true);

    const j=await api("login",{email,password});

    if(!quick){
      if($("rememberLogin").checked){
        saveQuickLoginAccount(j.user,email,password);
      }else{
        removeQuickLoginAccount();
      }
    }

    openApp(j.user,j.token);
  }catch(x){
    if(quick){
      quickLoginError.textContent=x.message;
      if(/senha inválidos|e-mail ou senha/i.test(x.message||"")){
        removeQuickLoginAccount();
        toast("Os dados salvos não são mais válidos. Entre novamente.");
      }
    }else{
      loginError.textContent=x.message;
    }
  }finally{
    setLoading("quickLoginLoading",false);
    setLoading("loginLoading",false);
  }
}

renderQuickLoginAccount();

$("quickLoginAccount").onclick=async()=>{
  const account=getQuickLoginAccount();
  if(!account||!account.email||!account.password){
    removeQuickLoginAccount();
    return;
  }
  await performLogin(account.email,account.password,true);
};

$("removeQuickLogin").onclick=()=>{
  if(confirm("Deseja remover esta conta salva deste aparelho?")){
    removeQuickLoginAccount();
    toast("Conta salva removida.");
  }
};$("registerForm").onsubmit=async e=>{
  e.preventDefault();
  if(!currentRegisterFieldsValid())return;

  $("registerSubmit").disabled=true;
  $("registerBack").disabled=true;
  $("registerMotoLoading").classList.add("on");

  try{
    const j=await api("register",{user:{
      name:regName.value.trim(),
      email:regEmail.value.trim().toLowerCase(),
      password:regPassword.value,
      whatsapp:regWhatsapp.value.replace(/\D/g,""),
      document:regDoc.value.trim(),
      street:regStreet.value.trim(),
      number:regNumber.value.trim(),
      reference:regReference.value.trim(),
      city:regCity.value,
      accountType:registerAccountType
    }});

    setTimeout(()=>{
      $("registerMotoLoading").classList.remove("on");
      $("registerSubmit").disabled=false;
      $("registerBack").disabled=false;
      openApp(j.user,j.token);
    },1400);

  }catch(x){
    $("registerMotoLoading").classList.remove("on");
    $("registerSubmit").disabled=false;
    $("registerBack").disabled=false;
    toast(x.message);
  }
};$("loginForm").onsubmit=async e=>{
  e.preventDefault();
  const email=loginEmail.value.trim().toLowerCase();
  const password=loginPassword.value;
  await performLogin(email,password,false);
};$("logoutBtn").onclick=async()=>{
  try{await api("logout",{}, {timeout:5000,noRetry:true})}catch(e){}
  clearInterval(state.dashboardTimer);
  sessionStorage.removeItem("pl_session");
  state.user=null;
  state.token="";
  state.revision="";
  loginPassword.value="";
  show("loginView");
  renderQuickLoginAccount();
};function choices(type){choiceTitle.textContent=type==="origin"?"Local de origem":"Local de destino";const a=type==="origin"?[["Usar minha localização de cadastro","registered"],["Alterar localização","manual"]]:[["Enviar localização atual","whatsapp"],["Informar localização de destino","manual"]];choiceOptions.innerHTML=a.map(x=>`<button class="pick" data-type="${type}" data-mode="${x[1]}">${x[0]}</button>`).join("");choiceOptions.querySelectorAll("button").forEach(b=>b.onclick=()=>choose(b.dataset.type,b.dataset.mode));openL("choiceSheet")}originTrigger.onclick=()=>choices("origin");destinationTrigger.onclick=()=>choices("destination");function choose(type,mode){closeL("choiceSheet");if(mode==="registered"){state.request.origin={mode,street:state.user.street,number:state.user.number,reference:state.user.reference,city:state.user.city};labels();return}if(mode==="whatsapp"){state.request.destination={mode,street:"Localização via WhatsApp",number:"-",reference:"Localização atual",city:state.user.city};labels();openL("whatsappInfo");return}addressForm(type)}function addressForm(type){wizardTitle.textContent=type==="origin"?"Alterar origem":"Informar destino";steps.innerHTML="<span class='on'></span>";wizardContent.innerHTML=`<div class="field"><label>Logradouro (rua, avenida ou alameda)</label><input id="aStreet"></div><div class="grid2"><div class="field"><label>Número</label><input id="aNumber"></div><div class="field"><label>Cidade</label><select id="aCity"><option>Uruçuí</option><option>Benedito Leite</option></select></div></div><div class="field"><label>Ponto de referência obrigatório</label><input id="aRef"></div>`;backStep.classList.add("hide");nextStep.textContent="Salvar localização";nextStep.onclick=()=>{const a={mode:"manual",street:aStreet.value.trim(),number:aNumber.value.trim(),reference:aRef.value.trim(),city:aCity.value};if(!a.street||!a.number||!a.reference)return toast("Preencha todos os dados.");state.request[type]=a;labels();closeL("wizardSheet");resetButtons()};openL("wizardSheet")}function resetButtons(){backStep.classList.remove("hide");nextStep.textContent="Continuar";nextStep.onclick=nextWizard}let step=0;function startWizard(){if(!state.request.origin||!state.request.destination)return toast("Escolha origem e destino.");step=0;render();openL("wizardSheet")}continueRequest.onclick=startWizard;function progress(){steps.innerHTML=Array.from({length:6},(_,i)=>`<span class="${i<=step?"on":""}"></span>`).join("")}function render(){$("wizardMotoLoading")?.classList.remove("on");resetButtons();progress();backStep.style.visibility=step===0?"hidden":"visible";if(step===0){wizardTitle.textContent="Bairros da entrega";wizardContent.innerHTML=`<div class="field"><label>Bairro de origem</label><select id="bO"><option value="">Selecione</option>${bairros.map(b=>`<option>${b}</option>`).join("")}</select></div><div class="field"><label>Bairro de destino</label><select id="bD"><option value="">Selecione</option>${bairros.map(b=>`<option>${b}</option>`).join("")}</select></div>`}if(step===1){
  wizardTitle.textContent="Quem vai receber?";
  wizardContent.innerHTML=`<div class="field"><label>Nome</label><input id="rName" value="${state.request.receiverName}"></div>
  <div class="field"><label>DDD + WhatsApp</label><div class="wizard-input-icon"><i class="fa-brands fa-whatsapp"></i><input id="rWa" inputmode="numeric" autocomplete="tel" placeholder="89 9 XXXX-XXXX" value="${formatWhatsappBR(state.request.receiverWhatsapp)}" maxlength="14"></div></div>`;
  bindWhatsappMask($("rWa"));
}if(step===2){
  wizardTitle.textContent="Conteúdo";
  const t=[
    {name:"Comidas",icon:"fa-utensils",desc:"Refeições e lanches"},
    {name:"Bebidas",icon:"fa-bottle-water",desc:"Copos, garrafas e bebidas"},
    {name:"Frios e gelados",icon:"fa-snowflake",desc:"Produtos refrigerados"},
    {name:"Sorvetes",icon:"fa-ice-cream",desc:"Sorvetes e sobremesas"},
    {name:"Documentos",icon:"fa-file-lines",desc:"Papéis e documentos"},
    {name:"Outros",icon:"fa-box",desc:"Outros tipos de objetos"}
  ];
  wizardContent.innerHTML=`<div class="option-list">${t.map(x=>`<button class="pick content-option" data-content="${x.name}"><span class="option-icon"><i class="fa-solid ${x.icon}"></i></span><span><strong>${x.name}</strong><small>${x.desc}</small></span></button>`).join("")}</div><div id="alertFood"></div>`;
  document.querySelectorAll("[data-content]").forEach(b=>b.onclick=()=>{
    state.request.contentType=b.dataset.content;
    document.querySelectorAll("[data-content]").forEach(x=>x.classList.toggle("active",x===b));
    alertFood.innerHTML=["Comidas","Bebidas","Frios e gelados","Sorvetes"].includes(state.request.contentType)?`<div class="notice"><b>Atenção:</b> tampe, lacre e embale bem os produtos. Certifique-se de que não possam abrir, derramar ou virar dentro da bag.</div>`:"";
  })
}if(step===3){
  wizardTitle.textContent="Adicionar retorno?";
  wizardContent.innerHTML=`<div class="option-list">
    <button class="pick return-option active" data-ret="false"><span class="option-icon"><i class="fa-solid fa-motorcycle"></i></span><span><strong>Não adicionar retorno</strong><small>Somente realizar a entrega</small></span></button>
    <button class="pick return-option" data-ret="true"><span class="option-icon"><i class="fa-solid fa-house"></i></span><span><strong>Adicionar retorno</strong><small>O entregador volta ao estabelecimento</small></span></button>
  </div><div class="notice"><b>Retorno:</b> o entregador leva maquininha ou troco e devolve ao estabelecimento.</div>`;
  document.querySelectorAll("[data-ret]").forEach(b=>b.onclick=()=>{
    state.request.returnTrip=b.dataset.ret==="true";
    document.querySelectorAll("[data-ret]").forEach(x=>x.classList.toggle("active",x===b))
  })
}if(step===4){wizardTitle.textContent="Calculando frete";wizardContent.innerHTML=`<div class="loading"><div class="road"><i class="fa-solid fa-motorcycle bike"></i></div><p>Calculando opções...</p></div>`;nextStep.classList.add("hide");calc()}if(step===5){wizardTitle.textContent="Escolha o frete";nextStep.classList.remove("hide");nextStep.textContent="Solicitar entrega";wizardContent.innerHTML=state.request.freights.map(f=>`<div class="freight" data-f="${f.type}"><div><strong>${f.label}</strong><strong>${money.format(f.value)}</strong></div><span class="freight-badge">${f.type==="ECONOMICO"?"Melhor preço":"Entrega Padrão"}</span></div>`).join("");document.querySelectorAll("[data-f]").forEach(x=>x.onclick=()=>{state.request.selectedFreight=state.request.freights.find(f=>f.type===x.dataset.f);document.querySelectorAll("[data-f]").forEach(y=>y.classList.toggle("selected",y===x))})}}async function calc(){try{const j=await api("calculateFreight",{originNeighborhood:state.request.originNeighborhood,destinationNeighborhood:state.request.destinationNeighborhood,returnTrip:state.request.returnTrip});state.request.freights=j.freights;state.request.selectedFreight=j.freights[0];setTimeout(()=>{step=5;render()},1000)}catch(x){toast(x.message);step=3;render()}}function valid(){if(step===0){state.request.originNeighborhood=bO.value;state.request.destinationNeighborhood=bD.value;return bO.value&&bD.value}if(step===1){state.request.receiverName=rName.value.trim();state.request.receiverWhatsapp=rWa.value.replace(/\D/g,"");return state.request.receiverName&&state.request.receiverWhatsapp.length>=10}if(step===2)return state.request.contentType;if(step===5)return state.request.selectedFreight;return true}function nextWizard(){
  if(!valid())return toast("Complete esta etapa.");
  if(step===5)return submit();

  $("wizardMotoLoading").classList.add("on");
  $("nextStep").disabled=true;
  $("backStep").disabled=true;

  setTimeout(()=>{
    step++;
    render();
    $("wizardMotoLoading").classList.remove("on");
    $("nextStep").disabled=false;
    $("backStep").disabled=false;
  },650);
}nextStep.onclick=nextWizard;backStep.onclick=()=>{
  if(step>0){
    $("wizardMotoLoading").classList.add("on");
    $("nextStep").disabled=true;
    $("backStep").disabled=true;
    setTimeout(()=>{
      step--;
      render();
      $("wizardMotoLoading").classList.remove("on");
      $("nextStep").disabled=false;
      $("backStep").disabled=false;
    },450);
  }
};async function submit(){closeL("wizardSheet");openL("loadingModal");try{const j=await api("createTrip",{trip:{userId:state.user.id,origin:state.request.origin,destination:state.request.destination,originNeighborhood:state.request.originNeighborhood,destinationNeighborhood:state.request.destinationNeighborhood,receiverName:state.request.receiverName,receiverWhatsapp:state.request.receiverWhatsapp,contentType:state.request.contentType,returnTrip:state.request.returnTrip,freightType:state.request.selectedFreight.type}});state.request.code=j.trip.code;setTimeout(()=>{closeL("loadingModal");successCode.textContent=`Código do pedido: ${j.trip.code}`;openL("successModal");playPositiveConfirmation();successNotify();dashboard()},10000)}catch(x){closeL("loadingModal");toast(x.message)}}function cleanMapAddress(a){
  if(!a || a.mode==="whatsapp") return "";
  return [a.street,a.number,a.city].filter(Boolean).join(", ");
}
function mapLink(a){
  const q=cleanMapAddress(a);
  return q?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`:"";
}
function noteAddress(title,a,neighborhood){
  if(a?.mode==="whatsapp"){
    return `*${title}:* localização atual será enviada pelo solicitante\n*Bairro:* ${neighborhood}`;
  }
  const address=[a?.street,a?.number,a?.city].filter(Boolean).join(", ");
  const reference=a?.reference?`\n*Referência:* ${a.reference}`:"";
  const route=mapLink(a)?`\n*Mapa:* ${mapLink(a)}`:"";
  return `*${title}:* ${address}\n*Bairro:* ${neighborhood}${reference}${route}`;
}
function receiverWhatsappLink(number){
  let digits=String(number||"").replace(/\D/g,"");
  if(!digits.startsWith("55")) digits="55"+digits;
  const message="Olá, aqui é do app de Delivery Pega&Leva: Chegamos em sua residência!";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
sendWhatsapp.onclick=()=>{
  const r=state.request,u=state.user,f=r.selectedFreight;
  const note=[
    "*PEGA&LEVA DELIVERY*",
    `*PEDIDO ${r.code}*`,
    "",
    `*Solicitante:* ${u.name}`,
    `*Código do cliente:* ${u.travelCode}`,
    `*WhatsApp:* ${u.whatsapp}`,
    "",
    "*COLETA*",
    noteAddress("Endereço",r.origin,r.originNeighborhood),
    "",
    "*ENTREGA*",
    noteAddress("Endereço",r.destination,r.destinationNeighborhood),
    "",
    `*Recebedor:* ${r.receiverName}`,
    `*WhatsApp do recebedor:* ${r.receiverWhatsapp}`,
    `*Avisar chegada:* ${receiverWhatsappLink(r.receiverWhatsapp)}`,
    "",
    `*Conteúdo:* ${r.contentType}`,
    `*Retorno:* ${r.returnTrip?"Sim":"Não"}`,
    `*Frete:* ${f.type==="NORMAL"?"Normal":"Econômico"}`,
    `*Valor:* ${money.format(f.value)}`,
    "",
    "_Solicitação enviada pelo painel Pega&Leva._"
  ].join("\n");
  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(note)}`,"_blank");
};
function simulatorNeighborhoodOptions(city){
  if(city==="Benedito Leite") return ["Benedito Leite"];
  return bairros.filter(b=>b!=="Benedito Leite");
}
function fillSimulatorNeighborhoods(){
  const originOptions=simulatorNeighborhoodOptions(simOriginCity.value);
  const destinationOptions=simulatorNeighborhoodOptions(simDestinationCity.value);
  simOriginNeighborhood.innerHTML=originOptions.map(b=>`<option>${b}</option>`).join("");
  simDestinationNeighborhood.innerHTML=destinationOptions.map(b=>`<option>${b}</option>`).join("");
}
simOriginCity.onchange=fillSimulatorNeighborhoods;
simDestinationCity.onchange=fillSimulatorNeighborhoods;
fillSimulatorNeighborhoods();

navSimulator.onclick=()=>{
  simulationResults.innerHTML="";
  openL("simulatorSheet");
};

calculateSimulation.onclick=async()=>{
  simulationResults.innerHTML="";
  simulationLoading.classList.add("on");
  calculateSimulation.disabled=true;

  try{
    const j=await api("calculateFreight",{
      originNeighborhood:simOriginNeighborhood.value,
      destinationNeighborhood:simDestinationNeighborhood.value,
      returnTrip:false
    });

    setTimeout(()=>{
      simulationLoading.classList.remove("on");
      calculateSimulation.disabled=false;
      simulationResults.innerHTML=j.freights.map(f=>`
        <div class="sim-result ${f.type==="NORMAL"?"normal":"economic"}">
          <div class="sim-result-top">
            <strong>${f.type==="NORMAL"?"Frete normal":"Frete econômico"}</strong>
            <span class="price">${money.format(f.value)}</span>
          </div>
          <small>${f.type==="NORMAL"?"Entrega Padrão":"Melhor preço"}</small>
        </div>
      `).join("");
    },700);
  }catch(x){
    simulationLoading.classList.remove("on");
    calculateSimulation.disabled=false;
    toast(x.message);
  }
};

function trips(){
  tripsList.innerHTML=state.trips.length?state.trips.map(t=>{
    const active=String(t.status).toUpperCase()!=="FINALIZADA";
    const waiting=String(t.status).toUpperCase()==="AGUARDANDO ENTREGADOR"&&!String(t.driverName||"").trim();
    const label=clientStatusLabel(t.status,t.paymentStatus);
    const cls=statusClass(t.status,t.paymentStatus);
    return `<div class="trip ${active?"trip-current":""}">
      <strong>${t.code} • ${t.originNeighborhood} → ${t.destinationNeighborhood}</strong>
      <span>${t.createdAt} • ${money.format(t.value)}</span>
      <span class="trip-status ${cls}">${label}</span>
      ${t.driverName?`<span><i class="fa-solid fa-motorcycle"></i> ${t.driverName}</span>`:""}
      ${waiting?`<button class="btn trip-cancel-btn full" onclick="cancelUserTrip('${t.code}')"><i class="fa-solid fa-ban"></i> Cancelar</button>`:""}
    </div>`;
  }).join(""):"Nenhuma entrega.";
}
async function cancelUserTrip(code){
  if(!confirm("Deseja cancelar esta entrega por falta de entregador? O valor será removido da sua fatura e a corrida será apagada."))return;
  try{
    const j=await api("cancelUserTrip",{code});
    toast(`Entrega cancelada. ${money.format(j.refundedValue||0)} removidos da fatura.`);
    state.revision="";
    await dashboard();
    renderAccountPlan(state.user);
    trips();
  }catch(e){
    toast(e.message);
    await dashboard(true);
    trips();
  }
}
viewTrips.onclick=()=>{trips();openL("tripsSheet")};floatingTrips.onclick=viewTrips.onclick;navTrips.onclick=viewTrips.onclick;
let paymentTimer=null;
function startPaymentCountdown(){
  clearInterval(paymentTimer);
  let seconds=50;
  confirmInvoicePayment.classList.add("hide");
  paymentWaitingText.textContent="Aguarde o tempo de processamento do pagamento.";
  paymentCountdown.textContent="00:50";
  paymentTimer=setInterval(()=>{
    seconds--;
    paymentCountdown.textContent=`00:${String(seconds).padStart(2,"0")}`;
    if(seconds<=0){
      clearInterval(paymentTimer);
      paymentCountdown.textContent="Tempo concluído";
      paymentWaitingText.textContent="Se o pagamento já foi realizado, confirme abaixo.";
      confirmInvoicePayment.classList.remove("hide");
    }
  },1000);
}
payInvoice.onclick=()=>{openL("invoiceSheet");startPaymentCountdown()};
navInvoice.onclick=payInvoice.onclick;
confirmInvoicePayment.onclick=()=>{
  const value=invoiceModalBalance.textContent;
  const msg=`Olá, sou ${state.user.name}, código ${state.user.travelCode}, e informo que realizei o pagamento das viagens pendentes no valor de ${value}. Segue a confirmação para conferência.`;
  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`,"_blank");
};
profileBtn.onclick=()=>{
  const profileSheetBox=document.querySelector("#profileSheet .sheet-box");
  renderAccountPlan(state.user);

  if(profileSheetBox && !document.getElementById("deleteAccountBtn")){
    const deleteAccountArea=document.createElement("div");

    deleteAccountArea.style.marginTop="18px";
    deleteAccountArea.style.paddingTop="16px";
    deleteAccountArea.style.borderTop="1px solid #e2e8f0";

    deleteAccountArea.innerHTML=`
      <button
        id="deleteAccountBtn"
        type="button"
        class="btn full"
        style="background:#dc2626;color:#fff"
      >
        <i class="fa-solid fa-trash"></i>
        Excluir minha conta
      </button>

      <small
        style="display:block;margin-top:8px;color:#64748b;text-align:center;line-height:1.45"
      >
        Solicite a exclusão definitiva da sua conta e dos seus dados pessoais.
      </small>
    `;

    profileSheetBox.appendChild(deleteAccountArea);

    document.getElementById("deleteAccountBtn").onclick=()=>{
      window.open(
        "https://pegaelevadelivery.com.br/excluirconta/",
        "_blank",
        "noopener,noreferrer"
      );
    };
  }

  openL("profileSheet");
};document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeL(b.dataset.close));document.querySelectorAll(".sheet,.modal").forEach(x=>x.onclick=e=>{if(e.target===x)closeL(x.id)});floatingTrips.style.display="none";
const saved=JSON.parse(sessionStorage.getItem("pl_session")||"null");
if(saved?.user&&saved?.token)openApp(saved.user,saved.token);
