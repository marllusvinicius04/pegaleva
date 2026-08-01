// Pega & Leva Mobilidade Urbana
// IMPORTANTE: depois de publicar o novo Apps Script como Web App,
// cole a URL /exec abaixo.
const API_URL="https://script.google.com/macros/s/AKfycbzLd8po3vGojfYVnHFN7COQwKGiN_nt3yayYUYkB6SsYxLeiwMmU8f1vIsm2Gft3g3qpQ/exec";

const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const bairros=[
  "Fogoso","Malvinas","Vaquejada","Centro",
  "Aeroporto","Aeroporto I","Aeroporto II",
  "Novo Horizonte","Novo Horizonte I","Novo Horizonte II",
  "Areia","Esperança","Água Branca","Alto Bonito",
  "São Francisco","Babilônia","Canaã","Bela Vista",
  "Portal dos Cerrados","Cerrados Park","Vista Bela","Benedito Leite"
];

const state={
  user:null,
  token:"",
  revision:"",
  trips:[],
  tripStatusMap:{},
  dashboardTimer:null,
  dashboardBusy:false,
  firstDashboard:true,
  ratingTripCode:"",
  ratingValue:0,
  addressTarget:"",
  request:{
    origin:null,
    destination:null,
    originNeighborhood:"",
    destinationNeighborhood:"",
    freights:[],
    selectedFreight:null,
    code:""
  }
};

async function api(action,data={},options={}){
  if(!API_URL.startsWith("https://script.google.com/")){
    throw new Error("Configure a URL do novo Apps Script de Mobilidade no script.js.");
  }

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),options.timeout||30000);
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
        sessionStorage.removeItem("pl_mob_session");
        state.user=null;
        state.token="";
        show("loginView");
      }
      throw new Error(j.error||"Erro.");
    }

    return j;
  }catch(e){
    if(e.name==="AbortError"){
      throw new Error("A conexão demorou demais. Verifique sua internet e tente novamente.");
    }

    const nonRepeatable=["createTrip","cancelUserTrip","rateDriver","logout"].includes(String(action));
    if(
      !options.noRetry &&
      !nonRepeatable &&
      /fetch|conexão|network/i.test(String(e.message))
    ){
      await new Promise(r=>setTimeout(r,650));
      return api(action,data,{...options,noRetry:true});
    }

    throw e;
  }finally{
    clearTimeout(timeout);
  }
}

function show(id){
  ["loginView","registerView","appView"].forEach(x=>$(x)?.classList.add("hide"));
  $(id)?.classList.remove("hide");
  if($("floatingTrips"))$("floatingTrips").style.display=id==="appView"?"block":"none";
}
function openL(id){$(id)?.classList.add("on")}
function closeL(id){$(id)?.classList.remove("on")}
function setLoading(id,on){$(id)?.classList.toggle("on",!!on)}
function toast(msg){
  const el=$("toast");
  if(!el)return;
  el.textContent=msg;
  el.classList.add("on");
  setTimeout(()=>el.classList.remove("on"),2600);
}
function playPositiveConfirmation(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return;
    const ctx=new Ctx(),now=ctx.currentTime;
    [523.25,659.25,783.99].forEach((f,i)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.frequency.value=f;o.connect(g);g.connect(ctx.destination);
      const t=now+i*.13;
      g.gain.setValueAtTime(.0001,t);
      g.gain.exponentialRampToValueAtTime(.18,t+.02);
      g.gain.exponentialRampToValueAtTime(.0001,t+.18);
      o.start(t);o.stop(t+.2);
    });
    setTimeout(()=>ctx.close().catch(()=>{}),800);
  }catch(e){}
}
function successNotify(){
  const el=$("successToast");
  if(!el)return;
  el.classList.add("on");
  setTimeout(()=>el.classList.remove("on"),3500);
}
function formatWhatsappBR(value){
  const d=String(value||"").replace(/\D/g,"").slice(0,11);
  if(d.length<=2)return d;
  if(d.length<=3)return `${d.slice(0,2)} ${d.slice(2)}`;
  if(d.length<=7)return `${d.slice(0,2)} ${d.slice(2,3)} ${d.slice(3)}`;
  return `${d.slice(0,2)} ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7,11)}`;
}
function bindWhatsappMask(input){
  if(!input)return;
  input.oninput=()=>{input.value=formatWhatsappBR(input.value)};
}
function esc(v){
  return String(v??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function addr(a){
  if(!a)return "Escolher local";
  return `${a.street}, ${a.number} • ${a.city}`;
}
function labels(){
  $("originLabel").textContent=state.request.origin
    ?addr(state.request.origin)
    :"Escolha onde o motorista vai buscar você";
  $("destinationLabel").textContent=state.request.destination
    ?addr(state.request.destination)
    :"Escolha para onde você vai";
}

function clientStatusLabel(status,paymentStatus){
  const s=String(status||"").toUpperCase();
  if(s==="AGUARDANDO ENTREGADOR")return "Procurando motorista";
  if(s==="ACEITA")return "Motorista aceitou sua viagem";
  if(s==="FINALIZANDO CORRIDA PRÓXIMA")return "Motorista finalizando uma corrida próxima";
  if(s==="ESTOU INDO")return "Motorista indo até você";
  if(s==="FINALIZADA")return "Viagem finalizada";
  return status||"Status atualizado";
}
function clientStatusIcon(status){
  const s=String(status||"").toUpperCase();
  if(s==="ACEITA")return "fa-user-check";
  if(s==="FINALIZANDO CORRIDA PRÓXIMA")return "fa-route";
  if(s==="ESTOU INDO")return "fa-motorcycle";
  if(s==="FINALIZADA")return "fa-circle-check";
  return "fa-location-crosshairs";
}
let statusAlertTimer=null;
function showStatusAlert(trip){
  clearTimeout(statusAlertTimer);
  $("statusAlertTitle").textContent=`Viagem ${trip.code}`;
  $("statusAlertText").textContent=clientStatusLabel(trip.status,trip.paymentStatus);
  $("statusAlertIcon").innerHTML=`<i class="fa-solid ${clientStatusIcon(trip.status)}"></i>`;
  $("statusAlert").classList.add("on");
  statusAlertTimer=setTimeout(()=>$("statusAlert").classList.remove("on"),5000);
}

function tripWasRated(trip){
  if(!trip||!trip.code)return false;
  if(trip.rated===true)return true;
  if(Number(trip.rating||0)>0)return true;
  return !!localStorage.getItem("pl_mob_rated_"+trip.code);
}

function driverInitials(name){
  const p=String(name||"Motorista").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0]||"M")+(p.length>1?(p[p.length-1]?.[0]||""):"")).toUpperCase();
}

function driverAvatar(url,name,size=56){
  const clean=String(url||"").trim();
  if(clean){
    const bust=clean+(clean.includes("?")?"&":"?")+"_="+Date.now();
    return `<img src="${esc(bust)}" alt="${esc(name||"Motorista")}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover" onerror="this.outerHTML='<span style=&quot;width:${size}px;height:${size}px;border-radius:50%;display:grid;place-items:center;background:#e8f0ff;color:#0646c8;font-weight:900&quot;>${driverInitials(name)}</span>'">`;
  }
  return `<span style="width:${size}px;height:${size}px;border-radius:50%;display:grid;place-items:center;background:#e8f0ff;color:#0646c8;font-weight:900">${driverInitials(name)}</span>`;
}

function ensureRatingModal(){
  let modal=$("driverRatingModal");
  if(modal)return modal;

  modal=document.createElement("div");
  modal.id="driverRatingModal";
  modal.style.cssText="position:fixed;inset:0;z-index:1800;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.64)";
  modal.innerHTML=`
    <div style="width:min(100%,420px);background:#fff;border-radius:26px;padding:26px 22px;text-align:center">
      <div style="width:58px;height:58px;border-radius:50%;margin:0 auto 12px;display:grid;place-items:center;background:#dcfce7;color:#15803d;font-size:26px">
        <i class="fa-solid fa-circle-check"></i>
      </div>
      <h2 style="margin:0;color:#0f172a">Viagem finalizada!</h2>
      <p style="color:#64748b">Como foi sua experiência com o motorista?</p>
      <div id="ratingAvatar" style="display:flex;justify-content:center;margin:16px 0 8px"></div>
      <strong id="ratingDriverName" style="display:block;font-size:18px"></strong>
      <span id="ratingDriverPlate" style="display:inline-flex;margin-top:6px;padding:6px 10px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:800"></span>
      <strong style="display:block;margin-top:20px">Avalie o motorista</strong>
      <div id="ratingStars" style="display:flex;justify-content:center;gap:7px;margin:18px 0">
        ${[1,2,3,4,5].map(n=>`<button type="button" data-rating="${n}" style="border:0;background:transparent;font-size:34px;color:#cbd5e1;cursor:pointer"><i class="fa-solid fa-star"></i></button>`).join("")}
      </div>
      <button id="submitRating" class="btn primary full" type="button" disabled>Enviar avaliação</button>
      <button id="closeRating" type="button" style="margin-top:10px;border:0;background:transparent;color:#64748b;font-weight:800;cursor:pointer">Avaliar depois</button>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelectorAll("[data-rating]").forEach(btn=>{
    btn.onclick=()=>{
      state.ratingValue=Number(btn.dataset.rating);
      modal.querySelectorAll("[data-rating]").forEach(star=>{
        star.style.color=Number(star.dataset.rating)<=state.ratingValue?"#f5b301":"#cbd5e1";
      });
      $("submitRating").disabled=false;
    };
  });

  $("closeRating").onclick=closeRatingModal;
  $("submitRating").onclick=submitRating;

  return modal;
}
function openRatingModal(trip){
  if(!trip||tripWasRated(trip))return;
  const modal=ensureRatingModal();
  state.ratingTripCode=trip.code;
  state.ratingValue=0;
  $("ratingAvatar").innerHTML=driverAvatar(trip.driverPhotoUrl,trip.driverName,78);
  $("ratingDriverName").textContent=trip.driverName||"Motorista Pega & Leva";
  $("ratingDriverPlate").innerHTML=`<i class="fa-solid fa-motorcycle" style="margin-right:6px"></i>${esc(trip.driverPlate||"Placa não informada")}`;
  $("ratingStars").style.display="flex";
  $("submitRating").style.display="";
  $("submitRating").disabled=true;
  $("closeRating").textContent="Avaliar depois";
  modal.querySelector("#ratingThankYou")?.remove();
  modal.querySelectorAll("[data-rating]").forEach(star=>star.style.color="#cbd5e1");
  modal.style.display="flex";
  document.body.style.overflow="hidden";
}
function closeRatingModal(){
  const modal=$("driverRatingModal");
  if(modal)modal.style.display="none";
  document.body.style.overflow="";
}
async function submitRating(){
  if(!state.ratingTripCode||!state.ratingValue)return;
  const btn=$("submitRating");
  btn.disabled=true;
  btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
  try{
    await api("rateDriver",{code:state.ratingTripCode,rating:state.ratingValue},{timeout:20000,noRetry:true});
    localStorage.setItem("pl_mob_rated_"+state.ratingTripCode,String(state.ratingValue));
    const trip=state.trips.find(t=>String(t.code)===String(state.ratingTripCode));
    if(trip){trip.rated=true;trip.rating=state.ratingValue}
    $("ratingStars").style.display="none";
    btn.style.display="none";
    $("ratingDriverName").insertAdjacentHTML("afterend",'<div id="ratingThankYou" style="margin-top:16px;padding:13px;border-radius:14px;background:#ecfdf5;color:#15803d;font-weight:900"><i class="fa-solid fa-circle-check"></i> Obrigado, avaliado!</div>');
    $("closeRating").textContent="Fechar";
    state.revision="";
    setTimeout(()=>dashboard(true),100);
  }catch(e){
    toast(e.message||"Não foi possível avaliar.");
  }finally{
    btn.disabled=false;
    btn.textContent="Enviar avaliação";
  }
}

function compareTripUpdates(newTrips){
  const next={},finished=[];
  newTrips.forEach(t=>{
    const key=String(t.status||"").toUpperCase();
    next[t.code]=key;
    const previous=state.tripStatusMap[t.code];

    if(!state.firstDashboard&&previous&&previous!==key){
      showStatusAlert(t);
      if(previous!=="FINALIZADA"&&key==="FINALIZADA"&&!tripWasRated(t))finished.push(t);
    }
  });

  if(finished.length){
    const latest=finished.slice().sort((a,b)=>{
      return (new Date(b.finalizedAt||b.createdAt||0).getTime()||0)-
             (new Date(a.finalizedAt||a.createdAt||0).getTime()||0);
    })[0];
    setTimeout(()=>openRatingModal(latest),300);
  }

  state.tripStatusMap=next;
  state.firstDashboard=false;
}

async function dashboard(silent=false){
  if(state.dashboardBusy||!state.user)return;
  state.dashboardBusy=true;

  try{
    const j=await api("dashboard",{sinceRevision:state.revision},{timeout:10000,noRetry:true});
    if(j.unchanged)return;

    state.revision=String(j.revision||state.revision||"");
    const newTrips=j.trips||[];
    const first=state.firstDashboard;

    newTrips.forEach(t=>{
      if(t.rated)localStorage.setItem("pl_mob_rated_"+t.code,String(t.rating||1));
    });

    compareTripUpdates(newTrips);
    state.trips=newTrips;
    state.user=j.user||state.user;

    $("tripNotification").textContent=String(
      state.trips.filter(t=>String(t.status||"").toUpperCase()!=="FINALIZADA").length
    );

    sessionStorage.setItem("pl_mob_session",JSON.stringify({user:state.user,token:state.token}));

    if(document.querySelector("#tripsSheet.on"))renderTrips();

    if(first){
      const latest=newTrips
        .filter(t=>String(t.status||"").toUpperCase()==="FINALIZADA"&&!tripWasRated(t))
        .sort((a,b)=>(new Date(b.finalizedAt||b.createdAt||0).getTime()||0)-(new Date(a.finalizedAt||a.createdAt||0).getTime()||0))[0];
      if(latest)setTimeout(()=>openRatingModal(latest),500);
    }
  }catch(e){
    if(!silent)toast(e.message);
  }finally{
    state.dashboardBusy=false;
  }
}
function startDashboardPolling(){
  clearInterval(state.dashboardTimer);
  state.dashboardTimer=setInterval(()=>{
    if(state.user&&!state.dashboardBusy&&!document.hidden&&navigator.onLine)dashboard(true);
  },2500);
}

function openApp(user,token){
  state.user=user;
  state.token=token||state.token;
  state.revision="";
  state.firstDashboard=true;
  state.tripStatusMap={};

  sessionStorage.setItem("pl_mob_session",JSON.stringify({user,token:state.token}));

  const firstName=String(user.name||"").trim().split(/\s+/)[0]||"";
  $("welcomeName").textContent=`Olá, ${firstName}!`;
  $("welcomeCity").textContent=user.city||"";
  $("profileName").textContent=user.name||"";
  $("profileEmail").textContent=user.email||"";
  $("profileAddress").textContent=[user.street,user.number,user.city].filter(Boolean).join(", ");

  show("appView");
  labels();
  dashboard();
  startDashboardPolling();
}

// LOGIN / CADASTRO
const QUICK_LOGIN_KEY="pl_mob_quick_account";
function getQuickLoginAccount(){
  try{return JSON.parse(localStorage.getItem(QUICK_LOGIN_KEY)||"null")}
  catch(e){localStorage.removeItem(QUICK_LOGIN_KEY);return null}
}
function renderQuickLoginAccount(){
  const a=getQuickLoginAccount(),valid=!!(a&&a.email&&a.password);
  $("quickLoginBox").classList.toggle("hide",!valid);
  if(!valid)return;
  $("quickLoginName").textContent=a.name||"Conta salva";
  $("quickLoginEmail").textContent=a.email;
}
async function performLogin(email,password,quick=false){
  $("loginError").textContent="";
  $("quickLoginError").textContent="";
  setLoading(quick?"quickLoginLoading":"loginLoading",true);

  try{
    const j=await api("login",{email,password});
    if(!quick){
      if($("rememberLogin").checked){
        localStorage.setItem(QUICK_LOGIN_KEY,JSON.stringify({
          name:j.user.name||"Conta salva",
          email:String(email).trim().toLowerCase(),
          password:String(password)
        }));
      }else{
        localStorage.removeItem(QUICK_LOGIN_KEY);
      }
    }
    renderQuickLoginAccount();
    openApp(j.user,j.token);
  }catch(e){
    (quick?$("quickLoginError"):$("loginError")).textContent=e.message;
  }finally{
    setLoading(quick?"quickLoginLoading":"loginLoading",false);
  }
}
$("loginForm").onsubmit=async e=>{
  e.preventDefault();
  await performLogin($("loginEmail").value.trim().toLowerCase(),$("loginPassword").value,false);
};
$("quickLoginAccount").onclick=async()=>{
  const a=getQuickLoginAccount();
  if(a)await performLogin(a.email,a.password,true);
};
$("removeQuickLogin").onclick=()=>{
  localStorage.removeItem(QUICK_LOGIN_KEY);
  renderQuickLoginAccount();
};
$("openRegister").onclick=()=>{registerStep=0;$("registerForm").reset();renderRegisterStep();show("registerView")};
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
  for(const f of fields){
    if(!f.checkValidity()){f.reportValidity();f.focus();return false}
  }
  return true;
}
$("registerNext").onclick=()=>{
  if(!currentRegisterFieldsValid())return;
  setLoading("registerStepLoading",true);
  $("registerNext").disabled=true;
  setTimeout(()=>{
    registerStep++;
    renderRegisterStep();
    setLoading("registerStepLoading",false);
    $("registerNext").disabled=false;
  },300);
};
$("registerBack").onclick=()=>{if(registerStep>0){registerStep--;renderRegisterStep()}};
$("registerForm").onsubmit=async e=>{
  e.preventDefault();
  if(!currentRegisterFieldsValid())return;
  setLoading("registerMotoLoading",true);

  try{
    const j=await api("register",{user:{
      name:$("regName").value.trim(),
      email:$("regEmail").value.trim().toLowerCase(),
      password:$("regPassword").value,
      whatsapp:$("regWhatsapp").value.replace(/\D/g,""),
      document:$("regDoc").value.replace(/\D/g,""),
      street:$("regStreet").value.trim(),
      number:$("regNumber").value.trim(),
      reference:$("regReference").value.trim(),
      city:$("regCity").value
    }},{timeout:30000,noRetry:true});

    openApp(j.user,j.token);
    toast("Conta criada com sucesso!");
  }catch(e){
    toast(e.message);
  }finally{
    setLoading("registerMotoLoading",false);
  }
};

document.querySelectorAll("[data-toggle-password]").forEach(btn=>{
  btn.onclick=()=>{
    const input=$(btn.dataset.togglePassword);
    const visible=input.type==="text";
    input.type=visible?"password":"text";
    btn.innerHTML=`<i class="fa-regular ${visible?"fa-eye":"fa-eye-slash"}"></i>`;
  };
});
bindWhatsappMask($("regWhatsapp"));

// LOCALIZAÇÕES
function openLocationChoice(type){
  state.addressTarget=type;
  $("choiceTitle").textContent=type==="origin"?"Onde o motorista busca você?":"Para onde você vai?";

  const options=type==="origin"
    ?[
      ["Usar meu endereço cadastrado","registered","fa-house"],
      ["Informar outro local","manual","fa-location-dot"]
    ]
    :[
      ["Informar destino","manual","fa-flag-checkered"]
    ];

  $("choiceOptions").innerHTML=options.map(x=>`
    <button class="pick" data-mode="${x[1]}">
      <i class="fa-solid ${x[2]}"></i> ${x[0]}
    </button>`).join("");

  $("choiceOptions").querySelectorAll("[data-mode]").forEach(btn=>{
    btn.onclick=()=>chooseLocation(type,btn.dataset.mode);
  });

  openL("choiceSheet");
}
function chooseLocation(type,mode){
  closeL("choiceSheet");

  if(mode==="registered"){
    state.request.origin={
      street:state.user.street,
      number:state.user.number,
      reference:state.user.reference,
      city:state.user.city
    };
    labels();
    return;
  }

  state.addressTarget=type;
  $("addressTitle").textContent=type==="origin"?"Informar ponto de partida":"Informar destino";
  $("addressForm").reset();
  openL("addressSheet");
}
$("originTrigger").onclick=()=>openLocationChoice("origin");
$("destinationTrigger").onclick=()=>openLocationChoice("destination");
$("addressForm").onsubmit=e=>{
  e.preventDefault();

  const data={
    street:$("addressStreet").value.trim(),
    number:$("addressNumber").value.trim(),
    reference:$("addressReference").value.trim(),
    city:$("addressCity").value
  };

  if(!data.street||!data.number||!data.reference)return toast("Preencha todos os dados.");

  state.request[state.addressTarget]=data;
  labels();
  closeL("addressSheet");
};

// SOLICITAÇÃO DE VIAGEM
let wizardStep=0;
function wizardProgress(){
  $("steps").innerHTML=Array.from({length:3},(_,i)=>`<span class="${i<=wizardStep?"on":""}"></span>`).join("");
}
function startWizard(){
  if(!state.request.origin||!state.request.destination){
    return toast("Escolha o ponto de partida e o destino.");
  }
  wizardStep=0;
  renderWizard();
  openL("wizardSheet");
}
$("continueRequest").onclick=startWizard;

function cityNeighborhoodOptions(city){
  if(city==="Benedito Leite")return ["Benedito Leite"];
  return bairros.filter(b=>b!=="Benedito Leite");
}
function renderWizard(){
  $("wizardMotoLoading").classList.remove("on");
  wizardProgress();
  $("backStep").style.visibility=wizardStep===0?"hidden":"visible";

  if(wizardStep===0){
    $("wizardTitle").textContent="Confirme os bairros";
    const o=cityNeighborhoodOptions(state.request.origin.city);
    const d=cityNeighborhoodOptions(state.request.destination.city);

    $("wizardContent").innerHTML=`
      <div class="field">
        <label>Bairro de partida</label>
        <select id="mobOriginNeighborhood">
          <option value="">Selecione</option>
          ${o.map(b=>`<option>${b}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Bairro de destino</label>
        <select id="mobDestinationNeighborhood">
          <option value="">Selecione</option>
          ${d.map(b=>`<option>${b}</option>`).join("")}
        </select>
      </div>`;
    $("nextStep").textContent="Calcular valores";
    $("nextStep").disabled=false;
  }

  if(wizardStep===1){
    $("wizardTitle").textContent="Calculando viagem";
    $("wizardContent").innerHTML=`
      <div class="loading">
        <div class="road"><i class="fa-solid fa-motorcycle bike"></i></div>
        <p>Buscando as opções disponíveis...</p>
      </div>`;
    $("nextStep").disabled=true;
    calculateRideOptions();
  }

  if(wizardStep===2){
    $("wizardTitle").textContent="Escolha sua opção";
    $("nextStep").textContent="Solicitar viagem";
    $("nextStep").disabled=false;

    $("wizardContent").innerHTML=state.request.freights.map(f=>`
      <button type="button" class="freight ${state.request.selectedFreight?.type===f.type?"selected":""}" data-trip-type="${esc(f.type)}" style="width:100%;text-align:left">
        <div>
          <strong>${esc(f.label)}</strong>
          <strong>${money.format(Number(f.value||0))}</strong>
        </div>
        <span class="freight-badge">${f.type==="ECONOMICO"?"Mais econômico":"Viagem padrão"}</span>
      </button>`).join("");

    document.querySelectorAll("[data-trip-type]").forEach(btn=>{
      btn.onclick=()=>{
        state.request.selectedFreight=state.request.freights.find(f=>f.type===btn.dataset.tripType);
        renderWizard();
      };
    });
  }
}
async function calculateRideOptions(){
  try{
    const j=await api("calculateFreight",{
      originNeighborhood:state.request.originNeighborhood,
      destinationNeighborhood:state.request.destinationNeighborhood
    },{timeout:15000});

    state.request.freights=j.freights||[];
    state.request.selectedFreight=state.request.freights[0]||null;
    wizardStep=2;
    renderWizard();
  }catch(e){
    toast(e.message);
    wizardStep=0;
    renderWizard();
  }
}
$("nextStep").onclick=async()=>{
  if(wizardStep===0){
    const o=$("mobOriginNeighborhood")?.value;
    const d=$("mobDestinationNeighborhood")?.value;
    if(!o||!d)return toast("Selecione os dois bairros.");
    state.request.originNeighborhood=o;
    state.request.destinationNeighborhood=d;
    wizardStep=1;
    renderWizard();
    return;
  }

  if(wizardStep===2){
    if(!state.request.selectedFreight)return toast("Escolha uma opção de viagem.");
    await submitRide();
  }
};
$("backStep").onclick=()=>{
  if(wizardStep<=0)return;
  wizardStep=0;
  renderWizard();
};

async function submitRide(){
  closeL("wizardSheet");
  openL("loadingModal");

  try{
    const j=await api("createTrip",{trip:{
      origin:state.request.origin,
      destination:state.request.destination,
      originNeighborhood:state.request.originNeighborhood,
      destinationNeighborhood:state.request.destinationNeighborhood,
      contentType:"PASSAGEIRO",
      freightType:state.request.selectedFreight.type
    }},{timeout:40000,noRetry:true});

    state.request.code=j.trip.code;
    closeL("loadingModal");
    $("successCode").textContent=`Código da viagem: ${j.trip.code}`;
    openL("successModal");
    playPositiveConfirmation();
    successNotify();

    state.revision="";
    setTimeout(()=>dashboard(true),100);
  }catch(e){
    closeL("loadingModal");

    if(/conexão demorou demais/i.test(String(e.message))){
      toast("A viagem pode ter sido registrada. Confira em Minhas viagens antes de solicitar novamente.");
      state.revision="";
      setTimeout(()=>dashboard(true),250);
      return;
    }

    toast(e.message||"Não foi possível solicitar a viagem.");
  }
}
$("successViewTrips").onclick=()=>{
  closeL("successModal");
  renderTrips();
  openL("tripsSheet");
};

// SIMULADOR
function fillSimulatorNeighborhoods(){
  const o=cityNeighborhoodOptions($("simOriginCity").value);
  const d=cityNeighborhoodOptions($("simDestinationCity").value);
  $("simOriginNeighborhood").innerHTML=o.map(b=>`<option>${b}</option>`).join("");
  $("simDestinationNeighborhood").innerHTML=d.map(b=>`<option>${b}</option>`).join("");
}
$("simOriginCity").onchange=fillSimulatorNeighborhoods;
$("simDestinationCity").onchange=fillSimulatorNeighborhoods;
fillSimulatorNeighborhoods();

$("navSimulator").onclick=()=>{
  $("simulationResults").innerHTML="";
  openL("simulatorSheet");
};
$("calculateSimulation").onclick=async()=>{
  $("simulationResults").innerHTML="";
  setLoading("simulationLoading",true);
  $("calculateSimulation").disabled=true;

  try{
    const j=await api("calculateFreight",{
      originNeighborhood:$("simOriginNeighborhood").value,
      destinationNeighborhood:$("simDestinationNeighborhood").value
    });

    $("simulationResults").innerHTML=(j.freights||[]).map(f=>`
      <div class="sim-result ${f.type==="ECONOMICO"?"economic":"normal"}">
        <div class="sim-result-top">
          <strong>${esc(f.label)}</strong>
          <span class="price">${money.format(Number(f.value||0))}</span>
        </div>
        <small>${f.type==="ECONOMICO"?"Opção mais econômica":"Viagem padrão"}</small>
      </div>`).join("");
  }catch(e){
    toast(e.message);
  }finally{
    setLoading("simulationLoading",false);
    $("calculateSimulation").disabled=false;
  }
};

// MINHAS VIAGENS
function tripStatusDescription(t){
  const s=String(t.status||"").toUpperCase();

  if(s==="AGUARDANDO ENTREGADOR"){
    return `<strong>Procurando motorista</strong><span>Motoristas próximos podem visualizar e aceitar sua viagem.</span>`;
  }
  if(s==="ACEITA"){
    return `<strong>${esc(t.driverName||"Motorista")} aceitou</strong><span>O motorista assumiu sua viagem e está preparando a rota.</span>`;
  }
  if(s==="FINALIZANDO CORRIDA PRÓXIMA"){
    return `<strong>Motorista finalizando corrida próxima</strong><span>Assim que concluir, seguirá até seu ponto de partida.</span>`;
  }
  if(s==="ESTOU INDO"){
    return `<strong>Motorista indo até você</strong><span>Fique atento ao WhatsApp para facilitar o encontro.</span>`;
  }
  if(s==="FINALIZADA"){
    return `<strong>Viagem finalizada</strong><span>Obrigado por viajar com a Pega & Leva.</span>`;
  }

  return `<strong>${esc(t.status||"Atualizando")}</strong>`;
}

function renderTrips(){
  const trips=state.trips||[];

  $("tripsList").innerHTML=trips.length?trips.map(t=>{
    const active=String(t.status||"").toUpperCase()!=="FINALIZADA";
    const hasDriver=!!String(t.driverName||"").trim();

    return `
      <article class="trip" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div>
            <small style="color:#64748b">VIAGEM</small>
            <strong style="display:block">${esc(t.code)}</strong>
          </div>
          <strong style="color:#0646c8">${money.format(Number(t.value||0))}</strong>
        </div>

        <div style="margin-top:10px">
          <small>${esc(t.originNeighborhood||"")} → ${esc(t.destinationNeighborhood||"")}</small>
        </div>

        <div style="margin-top:12px;padding:12px;border-radius:13px;background:#f8fafc">
          ${tripStatusDescription(t)}
        </div>

        ${hasDriver?`
          <div style="display:flex;align-items:center;gap:11px;margin-top:12px;padding:10px;border:1px solid #e2e8f0;border-radius:14px">
            ${driverAvatar(t.driverPhotoUrl,t.driverName,48)}
            <div>
              <strong style="display:block">${esc(t.driverName)}</strong>
              <small style="color:#64748b"><i class="fa-solid fa-motorcycle"></i> ${esc(t.driverPlate||"Placa não informada")}</small>
            </div>
          </div>`:""}

        ${active&&!hasDriver?`
          <button class="btn secondary full" style="margin-top:12px" onclick="cancelRide('${esc(t.code)}')">
            <i class="fa-solid fa-xmark"></i> Cancelar solicitação
          </button>`:""}

        ${!active&&!tripWasRated(t)?`
          <button class="btn primary full" style="margin-top:12px" onclick="openRatingByCode('${esc(t.code)}')">
            <i class="fa-solid fa-star"></i> Avaliar motorista
          </button>`:""}
      </article>`;
  }).join(""):'<div class="empty">Você ainda não possui viagens.</div>';
}
function openRatingByCode(code){
  const trip=state.trips.find(t=>String(t.code)===String(code));
  if(trip)openRatingModal(trip);
}
async function cancelRide(code){
  if(!confirm("Cancelar esta solicitação de viagem?"))return;

  try{
    await api("cancelUserTrip",{code},{timeout:15000,noRetry:true});
    toast("Solicitação cancelada.");
    state.revision="";
    await dashboard();
    renderTrips();
  }catch(e){
    toast(e.message);
  }
}

$("navTrips").onclick=()=>{renderTrips();openL("tripsSheet")};
$("viewTrips").onclick=()=>{renderTrips();openL("tripsSheet")};
$("floatingTrips").onclick=()=>{renderTrips();openL("tripsSheet")};

// PERFIL / SAIR
$("profileBtn").onclick=()=>openL("profileSheet");
$("logoutBtn").onclick=async()=>{
  try{await api("logout",{}, {timeout:5000,noRetry:true})}catch(e){}
  clearInterval(state.dashboardTimer);
  sessionStorage.removeItem("pl_mob_session");
  state.user=null;
  state.token="";
  state.trips=[];
  show("loginView");
};

// EVENTOS GERAIS
document.querySelectorAll("[data-close]").forEach(btn=>{
  btn.onclick=()=>closeL(btn.dataset.close);
});
document.querySelectorAll(".sheet,.modal").forEach(el=>{
  el.onclick=e=>{if(e.target===el)closeL(el.id)};
});
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden&&state.user)dashboard(true);
});
window.addEventListener("online",()=>{
  if(state.user){toast("Conexão restabelecida.");dashboard(true)}
});
window.addEventListener("offline",()=>toast("Você está sem internet."));

renderQuickLoginAccount();

let saved=null;
try{saved=JSON.parse(sessionStorage.getItem("pl_mob_session")||"null")}
catch(e){sessionStorage.removeItem("pl_mob_session")}

if(saved?.user&&saved?.token){
  openApp(saved.user,saved.token);
}else{
  show("loginView");
}
