// Pega & Leva Mobilidade Urbana
// IMPORTANTE: depois de publicar o novo Apps Script como Web App,
// cole a URL /exec abaixo.
const API_URL="https://script.google.com/macros/s/AKfycbyQZNA2fCp3msLO0S0ECAtoVPGSzFBK4ARQt49VGvmtrPwx_lIwWgqgCpvldLtq_icJOQ/exec";

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
    code:"",
    requestId:"",
    submitting:false
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
  if(appMapWrap)showAppMapBackground(id==="appView");
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
  if(a.formattedAddress)return a.formattedAddress;
  return [a.street,a.number,a.city].filter(Boolean).join(", ");
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
  if(s==="CANCELADA PELO USUARIO")return "Viagem cancelada";
  if(s==="CANCELADA PELO ENTREGADOR")return "Motorista cancelou a viagem";
  if(s==="CANCELADA")return "Viagem cancelada";
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
    renderMainActiveTrip();

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
  initAppBackgroundMap();
  renderMainActiveTrip();
  dashboard();
  startDashboardPolling();
}


// MAPA DE FUNDO + SELEÇÃO DE ORIGEM/DESTINO
let appMap=null;
let appMapWrap=null;
let leafletPromise=null;
let mapPickerMode=false;
let mapPickerTarget="";
let mapPickerPanel=null;
let mapPickerPin=null;

const URUCUI_CENTER={lat:-7.22944,lng:-44.55611};

function loadLeaflet(){
  if(window.L)return Promise.resolve(window.L);
  if(leafletPromise)return leafletPromise;

  leafletPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-pl-leaflet]')){
      const css=document.createElement("link");
      css.rel="stylesheet";
      css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      css.crossOrigin="";
      css.dataset.plLeaflet="1";
      document.head.appendChild(css);
    }

    const old=document.querySelector('script[data-pl-leaflet]');
    if(old){
      if(window.L)return resolve(window.L);
      old.addEventListener("load",()=>resolve(window.L),{once:true});
      old.addEventListener("error",()=>reject(new Error("Não foi possível carregar o mapa.")),{once:true});
      return;
    }

    const script=document.createElement("script");
    script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async=true;
    script.crossOrigin="";
    script.dataset.plLeaflet="1";
    script.onload=()=>resolve(window.L);
    script.onerror=()=>reject(new Error("Não foi possível carregar o mapa."));
    document.head.appendChild(script);
  });

  return leafletPromise;
}

function injectAppMapStyles(){
  if($("plMapBackgroundStyles"))return;

  const style=document.createElement("style");
  style.id="plMapBackgroundStyles";
  style.textContent=`
    #appView{
      position:relative !important;
      background:transparent !important;
      min-height:100vh;
      isolation:isolate;
    }

    #plAppMapBackground{
      position:fixed;
      inset:0;
      z-index:0;
      display:none;
      background:#dce5e9;
    }

    #plAppMapBackground .leaflet-container{
      width:100%;
      height:100%;
      background:#dce5e9;
    }

    #appView > *:not(#plAppMapBackground){
      position:relative;
      z-index:2;
    }

    #appView .card,
    #appView .request-card,
    #appView .panel,
    #appView header,
    #appView .header{
      backdrop-filter:blur(9px);
      -webkit-backdrop-filter:blur(9px);
    }

    body.pl-map-picking{
      overflow:hidden !important;
    }

    body.pl-map-picking #appView > *:not(#plAppMapBackground):not(#mapPickerOverlay){
      pointer-events:none !important;
      opacity:.12 !important;
    }

    body.pl-map-picking #plAppMapBackground{
      z-index:4000 !important;
      display:block !important;
    }

    body.pl-map-picking #mapPickerOverlay{
      z-index:4100 !important;
    }

    .pl-center-pin{
      position:fixed;
      left:50%;
      top:50%;
      transform:translate(-50%,-100%);
      z-index:4200;
      pointer-events:none;
      filter:drop-shadow(0 5px 5px rgba(15,23,42,.28));
      font-size:42px;
      color:#0646c8;
    }

    .pl-center-pin::after{
      content:"";
      position:absolute;
      left:50%;
      top:100%;
      width:12px;
      height:5px;
      transform:translate(-50%,-2px);
      border-radius:50%;
      background:rgba(15,23,42,.24);
      filter:blur(2px);
    }
  `;
  document.head.appendChild(style);
}

function ensureAppBackgroundMap(){
  injectAppMapStyles();

  if(appMapWrap)return appMapWrap;

  appMapWrap=document.createElement("div");
  appMapWrap.id="plAppMapBackground";
  appMapWrap.innerHTML='<div id="plAppMapCanvas"></div>';

  const app=$("appView");
  app?.prepend(appMapWrap);

  return appMapWrap;
}

async function initAppBackgroundMap(){
  ensureAppBackgroundMap();

  if(appMap){
    appMapWrap.style.display="block";
    setTimeout(()=>appMap.invalidateSize(),100);
    return;
  }

  try{
    await loadLeaflet();

    appMap=L.map("plAppMapCanvas",{
      center:[URUCUI_CENTER.lat,URUCUI_CENTER.lng],
      zoom:15,
      zoomControl:false,
      attributionControl:true,
      dragging:true,
      touchZoom:true,
      doubleClickZoom:true,
      scrollWheelZoom:false
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,
      attribution:'&copy; OpenStreetMap contributors'
    }).addTo(appMap);

    // Controle de zoom discreto no canto inferior direito.
    L.control.zoom({position:"bottomright"}).addTo(appMap);

    appMapWrap.style.display="block";
    setTimeout(()=>appMap.invalidateSize(),150);
  }catch(e){
    console.error("Falha ao carregar mapa:",e);
  }
}

function showAppMapBackground(showMap){
  ensureAppBackgroundMap();
  if(appMapWrap)appMapWrap.style.display=showMap?"block":"none";
  if(showMap&&appMap)setTimeout(()=>appMap.invalidateSize(),80);
}

function ensureMapPickerOverlay(){
  if(mapPickerPanel)return mapPickerPanel;

  mapPickerPanel=document.createElement("div");
  mapPickerPanel.id="mapPickerOverlay";
  mapPickerPanel.style.cssText="position:fixed;inset:0;z-index:4100;display:none;pointer-events:none";

  mapPickerPanel.innerHTML=`
    <div style="
      position:absolute;top:max(14px,env(safe-area-inset-top));left:14px;right:14px;
      display:flex;align-items:center;gap:10px;pointer-events:auto
    ">
      <button id="cancelMapPicker" type="button" style="
        width:44px;height:44px;border:0;border-radius:50%;background:#fff;color:#0f172a;
        box-shadow:0 5px 18px rgba(15,23,42,.18);font-size:18px;cursor:pointer
      ">
        <i class="fa-solid fa-arrow-left"></i>
      </button>

      <div style="
        flex:1;background:rgba(255,255,255,.96);border-radius:16px;padding:10px 12px;
        box-shadow:0 5px 18px rgba(15,23,42,.16)
      ">
        <strong id="mapPickerTitle" style="display:block;color:#0f172a;font-size:14px">
          Escolha no mapa
        </strong>
        <small style="display:block;color:#64748b;margin-top:2px">
          Arraste o mapa e deixe o pino exatamente no local.
        </small>
      </div>
    </div>

    <div id="mapPickerPin" class="pl-center-pin">
      <i class="fa-solid fa-location-dot"></i>
    </div>

    <div style="
      position:absolute;left:14px;right:14px;bottom:max(16px,env(safe-area-inset-bottom));
      pointer-events:auto
    ">
      <div style="
        background:rgba(255,255,255,.96);border-radius:18px;padding:12px;
        box-shadow:0 8px 28px rgba(15,23,42,.20)
      ">
        <div id="mapPickerCoordinates" style="
          text-align:center;color:#64748b;font-size:11px;margin-bottom:8px
        ">Centralize o pino no endereço</div>

        <button id="confirmMapPicker" class="btn primary full" type="button">
          <i class="fa-solid fa-location-crosshairs"></i> Confirmar este local
        </button>

        <div style="text-align:center;color:#64748b;font-size:9px;margin-top:7px">
          Mapa © OpenStreetMap contributors
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(mapPickerPanel);

  $("cancelMapPicker").onclick=closeMapPicker;
  $("confirmMapPicker").onclick=confirmMapLocation;

  return mapPickerPanel;
}

function updateMapPickerCoordinates(){
  if(!mapPickerMode||!appMap)return;
  const c=appMap.getCenter();
  const el=$("mapPickerCoordinates");
  if(el)el.textContent=`${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
}

async function openMapPicker(type){
  mapPickerTarget=type;
  mapPickerMode=true;

  await initAppBackgroundMap();
  ensureMapPickerOverlay();

  const current=state.request[type];
  if(Number.isFinite(current?.lat)&&Number.isFinite(current?.lng)){
    appMap.setView([current.lat,current.lng],17,{animate:false});
  }else{
    appMap.setView([URUCUI_CENTER.lat,URUCUI_CENTER.lng],15,{animate:false});
  }

  $("mapPickerTitle").textContent=
    type==="origin"
      ?"Onde você está?"
      :"Onde você quer ir?";

  mapPickerPanel.style.display="block";
  document.body.classList.add("pl-map-picking");

  appMap.dragging.enable();
  appMap.touchZoom.enable();
  appMap.doubleClickZoom.enable();

  appMap.off("move",updateMapPickerCoordinates);
  appMap.on("move",updateMapPickerCoordinates);

  setTimeout(()=>{
    appMap.invalidateSize();
    updateMapPickerCoordinates();
  },100);
}

function closeMapPicker(){
  mapPickerMode=false;
  mapPickerTarget="";
  document.body.classList.remove("pl-map-picking");
  if(mapPickerPanel)mapPickerPanel.style.display="none";
}

async function confirmMapLocation(){
  if(!appMap||!mapPickerTarget)return;

  const btn=$("confirmMapPicker");
  const center=appMap.getCenter();
  const target=mapPickerTarget;

  btn.disabled=true;
  const previous=btn.innerHTML;
  btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Identificando rua...';

  try{
    const result=await api("reverseGeocode",{
      lat:center.lat,
      lon:center.lng
    },{timeout:15000,noRetry:true});

    const address=result?.address||{};
    const street=String(address.road||address.street||address.pedestrian||address.place||"").trim();

    state.addressTarget=target;
    closeMapPicker();

    openMapAddressDetails(target,{
      lat:center.lat,
      lng:center.lng,
      street:street,
      city:String(address.city||address.town||address.village||"Uruçuí").trim()||"Uruçuí",
      neighborhood:String(address.neighbourhood||address.suburb||address.quarter||"").trim(),
      postalCode:String(address.postcode||"").trim(),
      displayName:String(result?.displayName||"").trim()
    });
  }catch(e){
    toast(e.message||"Não foi possível identificar a rua. Tente novamente.");
  }finally{
    btn.disabled=false;
    btn.innerHTML=previous;
  }
}

let mapAddressDetailsModal=null;

function ensureMapAddressDetailsModal(){
  if(mapAddressDetailsModal)return mapAddressDetailsModal;

  mapAddressDetailsModal=document.createElement("div");
  mapAddressDetailsModal.id="mapAddressDetailsModal";
  mapAddressDetailsModal.style.cssText="position:fixed;inset:0;z-index:4300;display:none;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.50);padding:12px";

  mapAddressDetailsModal.innerHTML=`
    <div style="
      width:min(100%,520px);background:#fff;border-radius:24px 24px 18px 18px;
      padding:18px;box-shadow:0 -10px 35px rgba(15,23,42,.18)
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px">
        <div>
          <small style="display:block;color:#64748b;font-weight:900">LOCAL SELECIONADO</small>
          <strong id="mapAddressDetailsTitle" style="display:block;margin-top:2px;color:#0f172a;font-size:18px">
            Complete o endereço
          </strong>
        </div>
        <button id="closeMapAddressDetails" type="button" style="
          width:38px;height:38px;border:0;border-radius:50%;background:#f1f5f9;cursor:pointer
        ">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <form id="mapAddressDetailsForm">
        <div class="field">
          <label>Logradouro / Rua</label>
          <input id="pickedStreet" type="text" maxlength="180" required placeholder="Rua identificada no mapa">
        </div>

        <div class="field">
          <label>Bairro</label>
          <select id="pickedNeighborhood" required>
            <option value="">Selecione o bairro</option>
            ${bairros.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <label>Número</label>
          <input id="pickedNumber" type="text" maxlength="30" required placeholder="Ex.: 120 ou S/N">
        </div>

        <div class="field">
          <label>Ponto de referência</label>
          <input id="pickedReference" type="text" maxlength="180" required placeholder="Ex.: Próximo ao mercado">
        </div>

        <button class="btn primary full" type="submit">
          <i class="fa-solid fa-circle-check"></i> Confirmar endereço
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(mapAddressDetailsModal);

  $("closeMapAddressDetails").onclick=()=>{mapAddressDetailsModal.style.display="none"};
  mapAddressDetailsModal.onclick=e=>{
    if(e.target===mapAddressDetailsModal)mapAddressDetailsModal.style.display="none";
  };

  $("mapAddressDetailsForm").onsubmit=e=>{
    e.preventDefault();

    const pending=mapAddressDetailsModal._pending||{};
    const street=$("pickedStreet").value.trim();
    const neighborhood=$("pickedNeighborhood").value;
    const number=$("pickedNumber").value.trim();
    const reference=$("pickedReference").value.trim();

    if(!street||!neighborhood||!number||!reference){
      return toast("Preencha rua, bairro, número e ponto de referência.");
    }

    const city=neighborhood==="Benedito Leite"?"Benedito Leite":"Uruçuí";

    const data={
      street,
      neighborhood,
      number,
      reference,
      city,
      lat:pending.lat,
      lng:pending.lng,
      postalCode:pending.postalCode||"",
      formattedAddress:`${street}, ${number} • ${neighborhood} • ${city}`
    };

    const target=mapAddressDetailsModal._target;
    state.request[target]=data;

    if(target==="origin")state.request.originNeighborhood=neighborhood;
    if(target==="destination")state.request.destinationNeighborhood=neighborhood;

    state.request.requestId="";
    labels();
    mapAddressDetailsModal.style.display="none";

    if(target==="origin"){
      toast("Origem confirmada. Agora escolha o destino.");
      setTimeout(()=>openMapPicker("destination"),180);
    }else{
      toast("Destino confirmado. Buscando ofertas...");
      setTimeout(()=>startWizard(),180);
    }
  };

  return mapAddressDetailsModal;
}

function openMapAddressDetails(type,data){
  const modal=ensureMapAddressDetailsModal();
  modal._target=type;
  modal._pending=data||{};

  $("mapAddressDetailsTitle").textContent=
    type==="origin"?"Complete sua origem":"Complete seu destino";

  $("pickedStreet").value=data?.street||"";
  $("pickedNumber").value="";
  $("pickedReference").value="";

  const detected=String(data?.neighborhood||"").toLowerCase();
  const match=bairros.find(b=>String(b).toLowerCase()===detected);
  $("pickedNeighborhood").value=match||"";

  modal.style.display="flex";
  document.body.style.overflow="hidden";

  setTimeout(()=>{
    if(!$("pickedStreet").value)$("pickedStreet").focus();
    else $("pickedNeighborhood").focus();
  },100);
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

// LOCALIZAÇÕES PELO MAPA
$("originTrigger").onclick=()=>openMapPicker("origin");
$("destinationTrigger").onclick=()=>openMapPicker("destination");

// SOLICITAÇÃO DE VIAGEM
let wizardStep=0;

function wizardProgress(){
  $("steps").innerHTML=Array.from({length:2},(_,i)=>`<span class="${i<=wizardStep?"on":""}"></span>`).join("");
}

function startWizard(){
  if(!state.request.origin||!state.request.destination){
    return toast("Informe a origem e o destino.");
  }
  if(!state.request.originNeighborhood||!state.request.destinationNeighborhood){
    return toast("Confirme o bairro da origem e do destino.");
  }

  wizardStep=0;
  renderWizard();
  openL("wizardSheet");
  calculateRideOptions();
}
$("continueRequest").onclick=()=>{
  if(!state.request.origin)return openMapPicker("origin");
  if(!state.request.destination)return openMapPicker("destination");
  startWizard();
};

function renderWizard(){
  $("wizardMotoLoading").classList.remove("on");
  wizardProgress();
  $("backStep").style.visibility=wizardStep===0?"hidden":"visible";

  if(wizardStep===0){
    $("wizardTitle").textContent="Buscando ofertas para sua viagem";
    $("wizardContent").innerHTML=`
      <div class="loading">
        <div class="road"><i class="fa-solid fa-motorcycle bike"></i></div>
        <p>Encontrando os melhores valores para sua viagem...</p>
      </div>`;
    $("nextStep").textContent="Aguarde...";
    $("nextStep").disabled=true;
  }

  if(wizardStep===1){
    $("wizardTitle").textContent="Ofertas para sua viagem";
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

    if(!state.request.freights.length){
      throw new Error("Nenhuma opção disponível para esses bairros.");
    }

    wizardStep=1;
    renderWizard();
  }catch(e){
    closeL("wizardSheet");
    toast(e.message||"Não foi possível calcular a viagem.");
  }
}

$("nextStep").onclick=async()=>{
  if(wizardStep!==1)return;
  if(!state.request.selectedFreight)return toast("Escolha uma opção de viagem.");
  await submitRide();
};

$("backStep").onclick=()=>{
  if(wizardStep===1){
    closeL("wizardSheet");
  }
};

function newRequestId(){
  try{
    if(window.crypto?.randomUUID)return window.crypto.randomUUID();
  }catch(e){}
  return "REQ-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,12);
}

function buildTripPayload(){
  if(!state.request.requestId)state.request.requestId=newRequestId();
  return {
    requestId:state.request.requestId,
    origin:state.request.origin,
    destination:state.request.destination,
    originNeighborhood:state.request.originNeighborhood,
    destinationNeighborhood:state.request.destinationNeighborhood,
    contentType:"PASSAGEIRO",
    freightType:state.request.selectedFreight.type
  };
}

async function submitRide(){
  if(state.request.submitting)return;
  state.request.submitting=true;
  closeL("wizardSheet");
  openL("loadingModal");

  const tripPayload=buildTripPayload();

  try{
    let j;
    try{
      j=await api("createTrip",{trip:tripPayload},{timeout:40000,noRetry:true});
    }catch(firstError){
      if(/conexão demorou demais|falha de conexão|fetch|network/i.test(String(firstError.message||firstError))){
        await new Promise(r=>setTimeout(r,900));
        j=await api("createTrip",{trip:tripPayload},{timeout:25000,noRetry:true});
      }else{
        throw firstError;
      }
    }

    if(!j?.trip?.code)throw new Error("Servidor não confirmou o código da viagem.");

    state.request.code=j.trip.code;
    state.request.requestId="";
    closeL("loadingModal");

    const provisional={
      ...j.trip,
      createdAt:new Date().toISOString(),
      status:j.trip.status||"AGUARDANDO ENTREGADOR",
      driverName:"",
      driverPlate:"",
      driverVehicle:"Moto",
      driverPhotoUrl:""
    };

    state.trips=[
      provisional,
      ...state.trips.filter(t=>String(t.code)!==String(provisional.code))
    ];

    renderMainActiveTrip();
    playPositiveConfirmation();
    toast("Viagem solicitada. Estamos buscando um motoca para você!");

    state.revision="";
    setTimeout(()=>dashboard(true),150);
  }catch(e){
    closeL("loadingModal");

    if(/conexão demorou demais|falha de conexão|fetch|network/i.test(String(e.message||e))){
      toast("Conferindo se a viagem foi criada...");
      state.revision="";
      setTimeout(()=>dashboard(true),250);
      return;
    }

    state.request.requestId="";
    toast(e.message||"Não foi possível solicitar a viagem.");
  }finally{
    state.request.submitting=false;
  }
}


// ACOMPANHAMENTO DA CORRIDA NA TELA PRINCIPAL
let mainRideTracker=null;

function isClientTripTerminal(status){
  const s=String(status||"").toUpperCase();
  return ["FINALIZADA","CANCELADA","CANCELADA PELO USUARIO","CANCELADA PELO ENTREGADOR"].includes(s);
}

function currentMainTrip(){
  return (state.trips||[])
    .filter(t=>!isClientTripTerminal(t.status))
    .sort((a,b)=>(new Date(b.createdAt||0).getTime()||0)-(new Date(a.createdAt||0).getTime()||0))[0]||null;
}

function ensureMainRideTracker(){
  if(mainRideTracker)return mainRideTracker;

  const style=document.createElement("style");
  style.textContent=`
    @keyframes plRideMove{0%{transform:translateX(-16px)}50%{transform:translateX(16px)}100%{transform:translateX(-16px)}}
    @keyframes plRidePulse{0%,100%{opacity:.45;transform:scale(.96)}50%{opacity:1;transform:scale(1.04)}}
  `;
  document.head.appendChild(style);

  mainRideTracker=document.createElement("div");
  mainRideTracker.id="mainRideTracker";
  mainRideTracker.style.display="none";

  const anchor=$("continueRequest");
  anchor?.parentNode?.insertBefore(mainRideTracker,anchor);

  return mainRideTracker;
}

function setRequestControlsVisible(visible){
  ["originTrigger","destinationTrigger","continueRequest"].forEach(id=>{
    const el=$(id);
    if(el)el.style.display=visible?"":"none";
  });
}

function clientEtaText(status){
  const s=String(status||"").toUpperCase();
  if(s==="ACEITA")return "10–15 min";
  if(s==="FINALIZANDO CORRIDA PRÓXIMA")return "15–25 min";
  if(s==="ESTOU INDO")return "5–10 min";
  return "Atualizando...";
}

function renderMainActiveTrip(){
  const tracker=ensureMainRideTracker();
  if(!tracker)return;

  const trip=currentMainTrip();

  if(!trip){
    tracker.style.display="none";
    tracker.innerHTML="";
    setRequestControlsVisible(true);
    return;
  }

  setRequestControlsVisible(false);
  tracker.style.display="block";

  const status=String(trip.status||"").toUpperCase();
  const hasDriver=!!String(trip.driverName||"").trim();

  if(!hasDriver||status==="AGUARDANDO ENTREGADOR"){
    tracker.innerHTML=`
      <section style="
        margin:10px 0;
        padding:11px 12px;
        border-radius:16px;
        background:#fff;
        border:1px solid #e2e8f0;
        box-shadow:0 5px 16px rgba(15,23,42,.06)
      ">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="
            width:42px;height:42px;border-radius:13px;background:#eef4ff;color:#0646c8;
            display:grid;place-items:center;flex:0 0 42px;overflow:hidden
          ">
            <i class="fa-solid fa-motorcycle" style="font-size:20px;animation:plRideMove 1.15s ease-in-out infinite"></i>
          </div>

          <div style="min-width:0;flex:1">
            <strong style="display:block;color:#0f172a;font-size:14px;line-height:1.25">
              Buscando um motoca pra você...
            </strong>
            <small style="display:block;color:#64748b;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${esc(trip.originNeighborhood||state.request.originNeighborhood)} → ${esc(trip.destinationNeighborhood||state.request.destinationNeighborhood)}
            </small>
          </div>

          <button type="button" data-main-cancel="${esc(trip.code)}" style="
            border:0;background:#fef2f2;color:#b91c1c;border-radius:11px;
            padding:8px 10px;font-weight:800;cursor:pointer;white-space:nowrap
          ">
            Cancelar
          </button>
        </div>
      </section>`;
  }else{
    tracker.innerHTML=`
      <section style="
        margin:10px 0;
        padding:11px 12px;
        border-radius:16px;
        background:#fff;
        border:1px solid #e2e8f0;
        box-shadow:0 5px 16px rgba(15,23,42,.06)
      ">
        <div style="display:flex;align-items:center;gap:10px">
          ${driverAvatar(trip.driverPhotoUrl,trip.driverName,46)}

          <div style="min-width:0;flex:1">
            <div style="display:flex;align-items:center;gap:6px;min-width:0">
              <strong style="color:#0f172a;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${esc(trip.driverName)}
              </strong>
              <span style="
                flex:0 0 auto;padding:3px 6px;border-radius:999px;
                background:#ecfdf5;color:#15803d;font-size:9px;font-weight:900
              ">ACEITOU</span>
            </div>

            <small style="display:block;color:#475569;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              <i class="fa-solid fa-motorcycle"></i>
              ${esc(trip.driverVehicle||"Moto")} • ${esc(trip.driverPlate||"Placa não informada")}
            </small>

            <small style="display:block;color:#0646c8;margin-top:3px;font-weight:800">
              ${esc(clientStatusLabel(trip.status,trip.paymentStatus))} • ${esc(clientEtaText(trip.status))}
            </small>
          </div>

          <button type="button" data-main-cancel="${esc(trip.code)}" style="
            border:0;background:#fef2f2;color:#b91c1c;border-radius:11px;
            padding:8px 10px;font-weight:800;cursor:pointer;white-space:nowrap
          ">
            Cancelar
          </button>
        </div>
      </section>`;
  }

  tracker.querySelector("[data-main-cancel]")?.addEventListener("click",async e=>{
    await cancelRide(e.currentTarget.dataset.mainCancel);
  });
}


function cityNeighborhoodOptions(city){
  if(city==="Benedito Leite")return ["Benedito Leite"];
  return bairros.filter(b=>b!=="Benedito Leite");
}

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

function openSimulatorFromAccount(){
  $("simulationResults").innerHTML="";
  fillSimulatorNeighborhoods();
  openL("simulatorSheet");
}
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
  if(s==="CANCELADA PELO USUARIO"||s==="CANCELADA"){
    return `<strong>Viagem cancelada</strong><span>A solicitação foi encerrada.</span>`;
  }
  if(s==="CANCELADA PELO ENTREGADOR"){
    return `<strong>Motorista cancelou</strong><span>A corrida foi encerrada.</span>`;
  }

  return `<strong>${esc(t.status||"Atualizando")}</strong>`;
}

function renderTrips(){
  const trips=state.trips||[];

  $("tripsList").innerHTML=trips.length?trips.map(t=>{
    const active=!isClientTripTerminal(t.status);
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

        ${active?`
          <button class="btn secondary full" style="margin-top:12px" onclick="cancelRide('${esc(t.code)}')">
            <i class="fa-solid fa-xmark"></i> Cancelar viagem
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
  if(!confirm("Cancelar esta viagem?"))return;

  try{
    await api("cancelUserTrip",{code},{timeout:15000,noRetry:true});
    toast("Viagem cancelada.");
    state.revision="";
    await dashboard();
    renderMainActiveTrip();
    if(document.querySelector("#tripsSheet.on"))renderTrips();
  }catch(e){
    toast(e.message);
  }
}

function openTripsFromAccount(){
  renderTrips();
  openL("tripsSheet");
}
$("floatingTrips").onclick=openTripsFromAccount;

// PERFIL / SAIR
$("profileBtn").onclick=()=>openL("profileSheet");

$("accountHomeBtn").onclick=()=>{
  closeL("profileSheet");
  window.scrollTo({top:0,behavior:"smooth"});
};

$("accountSimulatorBtn").onclick=()=>{
  closeL("profileSheet");
  openSimulatorFromAccount();
};

$("accountTripsBtn").onclick=()=>{
  closeL("profileSheet");
  openTripsFromAccount();
};

$("accountLogoutBtn").onclick=async()=>{
  closeL("profileSheet");
  await performUserLogout();
};
async function performUserLogout(){
  try{await api("logout",{}, {timeout:5000,noRetry:true})}catch(e){}
  clearInterval(state.dashboardTimer);
  sessionStorage.removeItem("pl_mob_session");
  state.user=null;
  state.token="";
  state.trips=[];
  state.request.code="";
  closeMapPicker();
  show("loginView");
}


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
