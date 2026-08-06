const API="https://script.google.com/macros/s/AKfycbxF99rKL26CceOlyBA9HJvP9KlH6SSZBQLKTZ22_xeHxZ8jAVcTioqo5EmEK0rX7r8OZg/exec";
let user=null,fare=null,step=1,pollTimer=null,lastStatus=null,activeRideId=null,audioCtx=null,pendingPhotoBase64="",pendingPhotoMime="",ratingRideId=null,ratingValue=0,currentDriverPhoto="",reportRideId=null,reportMotocaId=null,chatRideId=null,chatTimer=null,chatLastCount=-1,chatUnread=0,chatKnownCount=0,chatBusy=false,chatPendingRefresh=false,ratingCheckBusy=false;
let regioesCache=[],origemLat=null,origemLng=null,destinoLat=null,destinoLng=null,origemRegiao="",destinoRegiao="",regionMap=null,regionPickerType=null,regionMapReady=false;
const $=id=>document.getElementById(id),val=id=>$(id).value.trim();
function loading(on,text="Carregando..."){$("loadingText").textContent=text;$("loading").classList.toggle("hidden",!on)}
async function api(action,data={}){try{const r=await fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,data})});return await r.json()}catch(e){return{ok:false,message:"Falha de conexão."}}}
document.addEventListener("DOMContentLoaded",async()=>{
  applyMotocasMapAndSelectStyle();
  buildRegionPicker();
  ensureConfirmMapButtons();
  bind();
  renderStars();
  await loadCities();
  const s=localStorage.getItem("motocas_passageiro");
  if(s){user=JSON.parse(s);openApp()}
});
function bind(){
$("loginForm").onsubmit=async e=>{e.preventDefault();loading(true,"Entrando...");const r=await api("loginPassageiro",{email:val("loginEmail"),senha:val("loginSenha")});loading(false);if(!r.ok)return msg("loginMsg",r.message,true);user=r.user;localStorage.setItem("motocas_passageiro",JSON.stringify(user));openApp()};
$("cadForm").onsubmit=async e=>{
  e.preventDefault();
  if(val("senha").length<6)return msg("cadMsg","A senha deve ter pelo menos 6 caracteres.",true);

  loading(true,"Criando sua conta...");
  const dados={
    nome:val("nome"),
    email:val("email"),
    cpf:val("cpf"),
    telefone:val("telefone"),
    cidade:val("cidade"),
    senha:val("senha")
  };

  const r=await api("cadastrarPassageiro",dados);
  loading(false);

  if(!r.ok)return msg("cadMsg",r.message,true);

  user={
    id:r.id,
    nome:dados.nome,
    email:dados.email.toLowerCase(),
    telefone:dados.telefone.replace(/\D/g,""),
    cidade:dados.cidade,
    fotoUrl:"",
    fotoDataUrl:""
  };

  localStorage.setItem("motocas_passageiro",JSON.stringify(user));

  $("auth").classList.add("hidden");
  $("welcomeName").textContent=user.nome;
  $("welcome").classList.remove("hidden");
};
$("photoInput").addEventListener("change",handlePhoto);
}
async function accessAfterSignup(){
  if(!user)return;
  $("welcome").classList.add("hidden");
  await openApp();
}

function openSupportWhatsApp(){
  const url="https://wa.me/5589994029572?text="+encodeURIComponent("Olá! Preciso de suporte no Motocas App.");
  window.open(url,"_blank");
}

function requestAccountDeletion(){
  const nome=user&&user.nome||"";
  const email=user&&user.email||"";
  const msg=`Olá! Quero solicitar a exclusão definitiva da minha conta de Passageiro no Motocas App.\n\nNome: ${nome}\nE-mail: ${email}`;
  const url="https://wa.me/5589994029572?text="+encodeURIComponent(msg);
  window.open(url,"_blank");
}

function toggleMenu(force){
  const open=typeof force==="boolean"?force:!$("sideMenu").classList.contains("open");
  $("sideMenu").classList.toggle("open",open);
  $("drawerOverlay").classList.toggle("show",open);
}
function mode(m){["loginForm","cadForm","forgotForm"].forEach(x=>$(x).classList.add("hidden"));$("tabLogin").classList.toggle("active",m==="login");$("tabCad").classList.toggle("active",m==="cad");if(m==="login")$("loginForm").classList.remove("hidden");if(m==="cad")$("cadForm").classList.remove("hidden");if(m==="forgot")$("forgotForm").classList.remove("hidden")}
async function loadCities(){const r=await api("listarCidades");if(r.ok)$("cidade").innerHTML='<option value="">Selecione</option>'+r.cidades.map(c=>`<option>${esc(c)}</option>`).join("")}

function applyMotocasMapAndSelectStyle(){
  if(document.getElementById("motocasMapSelectStyle"))return;

  const style=document.createElement("style");
  style.id="motocasMapSelectStyle";
  style.textContent=`
    #cityMap{
      width:calc(100% + 110px)!important;
      height:calc(100% + 110px)!important;
      min-height:360px!important;
      border:0!important;
      position:absolute!important;
      left:-55px!important;
      top:-55px!important;
      display:block!important;
      background:#e9ecef;
    }

    .map-area,.map-wrap,.map-container,.map-box,.city-map,.map-stage{
      overflow:hidden!important;
      position:relative!important;
    }

    #origemBairro,#destinoBairro{
      -webkit-appearance:none!important;
      appearance:none!important;
      width:100%!important;
      min-height:54px!important;
      border:1px solid #dbe1e4!important;
      border-radius:18px!important;
      padding:0 48px 0 46px!important;
      background:
        linear-gradient(45deg,transparent 50%,#001219 50%) calc(100% - 22px) 24px/6px 6px no-repeat,
        linear-gradient(135deg,#001219 50%,transparent 50%) calc(100% - 16px) 24px/6px 6px no-repeat,
        linear-gradient(#fff,#fff)!important;
      color:#001219!important;
      font-weight:800!important;
      font-size:12px!important;
      box-shadow:0 8px 24px rgba(0,18,25,.08)!important;
      outline:none!important;
    }

    #origemBairro:focus,#destinoBairro:focus{
      border-color:#ee9b00!important;
      box-shadow:0 0 0 4px rgba(238,155,0,.13),0 10px 28px rgba(0,18,25,.10)!important;
    }

    .motocas-select-wrap{position:relative!important;width:100%!important}
    .motocas-select-wrap::before{
      content:"\\f3c5";
      font-family:"Font Awesome 6 Free";
      font-weight:900;
      position:absolute;
      left:17px;
      top:50%;
      transform:translateY(-50%);
      z-index:2;
      pointer-events:none;
      color:#ee9b00;
      font-size:15px;
    }


    #origemBairro,#destinoBairro,.motocas-select-wrap{display:none!important}
    .confirm-map-btn{
      width:100%;min-height:52px;border:0;border-radius:17px;
      background:#001219;color:#fff;font-weight:900;font-size:11px;
      display:flex;align-items:center;justify-content:center;gap:9px;margin-top:10px;
      box-shadow:0 10px 25px rgba(0,18,25,.14);
    }
    .confirm-map-btn i{color:#ee9b00;font-size:15px}
    .confirm-map-btn.confirmed{background:#e9f8ef;color:#14864e;border:1px solid #c9ebd7}
    .confirm-map-btn.confirmed i{color:#14864e}

    .region-picker{
      position:fixed;inset:0;z-index:1200;background:#001219;
      display:flex;flex-direction:column;
    }
    .region-picker.hidden{display:none!important}
    .region-picker-top{
      padding:calc(12px + env(safe-area-inset-top)) 14px 12px;
      background:#001219;color:#fff;display:flex;align-items:center;gap:12px;
    }
    .region-picker-close{
      width:40px;height:40px;border:0;border-radius:50%;background:#ffffff14;color:#fff;font-size:17px;
    }
    .region-picker-title{font-size:13px;font-weight:900}
    .region-picker-sub{font-size:9px;color:#afbdc2;margin-top:2px}
    .region-map-wrap{position:relative;flex:1;min-height:320px;overflow:hidden;background:#e9ecef}
    #regionPickerMap{position:absolute;inset:0}
    .region-center-pin{
      position:absolute;left:50%;top:50%;z-index:800;transform:translate(-50%,-100%);
      pointer-events:none;filter:drop-shadow(0 5px 5px #0005);
    }
    .region-center-pin i{font-size:39px;color:#ee9b00;-webkit-text-stroke:2px #001219}
    .region-center-dot{
      position:absolute;left:50%;top:50%;z-index:799;width:10px;height:5px;border-radius:50%;
      background:#00121944;transform:translate(-50%,5px);pointer-events:none
    }
    .region-picker-bottom{
      background:#fff;padding:14px 14px calc(14px + env(safe-area-inset-bottom));
      border-radius:22px 22px 0 0;margin-top:-18px;z-index:900;box-shadow:0 -10px 30px #0002;
    }
    .region-picker-status{
      padding:10px 12px;border-radius:13px;background:#f4f6f7;font-size:10px;font-weight:800;margin-bottom:10px;
    }
    .region-picker-status.ok{background:#e9f8ef;color:#14864e}
    .region-picker-status.bad{background:#fff0f0;color:#c83c3c}
    .region-confirm-btn{
      width:100%;border:0;border-radius:16px;background:#ee9b00;color:#001219;
      min-height:52px;font-weight:900;font-size:11px;
    }
    .region-selected-note{
      display:none;margin-top:8px;padding:9px 11px;border-radius:12px;background:#e9f8ef;
      color:#14864e;font-size:9px;font-weight:800;
    }
    .region-selected-note.show{display:block}

    .leaflet-control-attribution{font-size:7px!important;opacity:.65}
    .leaflet-control-zoom{display:none!important}

    @media(max-width:640px){
      #cityMap{
        width:calc(100% + 150px)!important;
        height:calc(100% + 150px)!important;
        left:-75px!important;top:-75px!important;min-height:390px!important;
      }
      .region-picker-top{padding-left:12px;padding-right:12px}
      .region-picker-bottom{padding-left:12px;padding-right:12px}
    }
  `;
  document.head.appendChild(style);

  ["origemBairro","destinoBairro"].forEach(id=>{
    const el=$(id);
    if(!el||el.parentElement.classList.contains("motocas-select-wrap"))return;
    const wrap=document.createElement("div");
    wrap.className="motocas-select-wrap";
    el.parentNode.insertBefore(wrap,el);
    wrap.appendChild(el);

    const note=document.createElement("div");
    note.id=id+"PointNote";
    note.className="region-selected-note";
    note.innerHTML='<i class="fa-solid fa-location-dot"></i> Local confirmado no mapa';
    wrap.appendChild(note);
  });
}



function ensureConfirmMapButtons(){
  const configs=[
    {tipo:"origem",anchor:"origemReferencia",id:"confirmOriginMapBtn",texto:"CONFIRMAR REGIÃO DA ORIGEM"},
    {tipo:"destino",anchor:"destinoReferencia",id:"confirmDestMapBtn",texto:"CONFIRMAR REGIÃO DO DESTINO"}
  ];

  configs.forEach(c=>{
    if($(c.id))return;
    const anchor=$(c.anchor);
    if(!anchor)return;

    const btn=document.createElement("button");
    btn.type="button";
    btn.id=c.id;
    btn.className="confirm-map-btn";
    btn.innerHTML=`<i class="fa-solid fa-map-location-dot"></i> ${c.texto}`;
    btn.onclick=()=>openRegionPicker(c.tipo);

    anchor.insertAdjacentElement("afterend",btn);
  });
}

function updateMapConfirmButton(tipo){
  const btn=$(tipo==="origem"?"confirmOriginMapBtn":"confirmDestMapBtn");
  if(!btn)return;

  const regiao=tipo==="origem"?origemRegiao:destinoRegiao;
  const ok=tipo==="origem"
    ? origemLat!==null&&origemLng!==null
    : destinoLat!==null&&destinoLng!==null;

  btn.classList.toggle("confirmed",ok);

  if(ok){
    btn.innerHTML=`<i class="fa-solid fa-circle-check"></i> ${esc(regiao||"REGIÃO CONFIRMADA")}`;
  }else{
    btn.innerHTML=`<i class="fa-solid fa-map-location-dot"></i> ${
      tipo==="origem"?"CONFIRMAR REGIÃO DA ORIGEM":"CONFIRMAR REGIÃO DO DESTINO"
    }`;
  }
}

function buildRegionPicker(){
  if($("regionPicker"))return;

  const el=document.createElement("div");
  el.id="regionPicker";
  el.className="region-picker hidden";
  el.innerHTML=`
    <div class="region-picker-top">
      <button type="button" class="region-picker-close" onclick="closeRegionPicker()">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div>
        <div id="regionPickerTitle" class="region-picker-title">Escolha o local</div>
        <div id="regionPickerSub" class="region-picker-sub"></div>
      </div>
    </div>
    <div class="region-map-wrap">
      <div id="regionPickerMap"></div>
      <div class="region-center-pin"><i class="fa-solid fa-location-dot"></i></div>
      <div class="region-center-dot"></div>
    </div>
    <div class="region-picker-bottom">
      <div id="regionPickerStatus" class="region-picker-status">
        Mova o mapa para posicionar a tachinha.
      </div>
      <button type="button" class="region-confirm-btn" onclick="confirmRegionPoint()">
        <i class="fa-solid fa-check"></i> CONFIRMAR ESTE LOCAL
      </button>
    </div>
  `;
  document.body.appendChild(el);
}

function loadLeaflet(){
  return new Promise((resolve,reject)=>{
    if(window.L)return resolve();

    if(!document.getElementById("leafletCss")){
      const css=document.createElement("link");
      css.id="leafletCss";
      css.rel="stylesheet";
      css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }

    const existing=document.getElementById("leafletJs");
    if(existing){
      existing.addEventListener("load",()=>resolve(),{once:true});
      existing.addEventListener("error",()=>reject(new Error("Não foi possível carregar o mapa.")),{once:true});
      return;
    }

    const js=document.createElement("script");
    js.id="leafletJs";
    js.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload=()=>resolve();
    js.onerror=()=>reject(new Error("Não foi possível carregar o mapa."));
    document.head.appendChild(js);
  });
}

function getSelectedRegion(tipo){
  const nome=tipo==="origem"?val("origemBairro"):val("destinoBairro");
  return regioesCache.find(r=>r.regiao===nome)||null;
}

function pontoDentroDaRegiao(regiao,lat,lng){
  if(!regiao)return false;
  return lat<=Number(regiao.norteLat) &&
         lat>=Number(regiao.sulLat) &&
         lng<=Number(regiao.lesteLng) &&
         lng>=Number(regiao.oesteLng);
}

async function openRegionPicker(tipo){
  if(!user)return;

  const rua=tipo==="origem"?val("origemLogradouro"):val("destinoLogradouro");
  if(!rua)return alert(tipo==="origem"?"Informe a rua/avenida de origem primeiro.":"Informe a rua/avenida de destino primeiro.");

  regionPickerType=tipo;
  loading(true,"Abrindo mapa...");

  if(!regioesCache.length){
    const rr=await api("listarRegioes",{cidade:user.cidade});
    if(!rr.ok||!rr.regioes?.length){
      loading(false);
      return alert("As regiões desta cidade ainda não foram configuradas.");
    }
    regioesCache=rr.regioes;
  }

  try{
    await loadLeaflet();
  }catch(e){
    loading(false);
    return alert(e.message);
  }

  $("regionPickerTitle").textContent=tipo==="origem"?"Confirme sua região":"Confirme a região de destino";
  $("regionPickerSub").textContent=`${user.cidade} • posicione a tachinha aproximadamente no local`;
  $("regionPicker").classList.remove("hidden");

  setTimeout(async()=>{
    if(regionMap){
      regionMap.remove();
      regionMap=null;
    }

    regionMap=L.map("regionPickerMap",{
      zoomControl:false,
      attributionControl:true,
      preferCanvas:true,
      inertia:true,
      bounceAtZoomLimits:false,
      maxBoundsViscosity:1.0,
      minZoom:13
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,
      minZoom:13,
      attribution:'&copy; OpenStreetMap'
    }).addTo(regionMap);

    const norte=Math.max(...regioesCache.map(r=>Number(r.norteLat)));
    const sul=Math.min(...regioesCache.map(r=>Number(r.sulLat)));
    const leste=Math.max(...regioesCache.map(r=>Number(r.lesteLng)));
    const oeste=Math.min(...regioesCache.map(r=>Number(r.oesteLng)));

    const cityBounds=L.latLngBounds([sul,oeste],[norte,leste]);
    regionMap.setMaxBounds(cityBounds.pad(.03));
    regionMap.fitBounds(cityBounds,{padding:[22,22],maxZoom:14});

    const savedLat=tipo==="origem"?origemLat:destinoLat;
    const savedLng=tipo==="origem"?origemLng:destinoLng;

    if(savedLat!==null&&savedLng!==null){
      regionMap.setView([savedLat,savedLng],16);
    }else if(tipo==="origem"&&navigator.geolocation){
      // Tenta abrir já próximo de onde a pessoa está. Se falhar, mantém a cidade.
      navigator.geolocation.getCurrentPosition(
        pos=>{
          const lat=pos.coords.latitude,lng=pos.coords.longitude;
          if(lat<=norte&&lat>=sul&&lng<=leste&&lng>=oeste){
            regionMap.setView([lat,lng],16);
          }
        },
        ()=>{},
        {enableHighAccuracy:true,timeout:4500,maximumAge:60000}
      );
    }

    regionMap._motocasCityBounds={norte,sul,leste,oeste};
    regionMap.on("move",updateRegionPickerStatus);
    regionMap.on("moveend",updateRegionPickerStatus);

    updateRegionPickerStatus();
    loading(false);
  },80);
}

function updateRegionPickerStatus(){
  if(!regionMap||!regionPickerType)return;

  const c=regionMap.getCenter();
  const regiao=regioesCache
    .filter(r=>
      c.lat<=Number(r.norteLat)&&
      c.lat>=Number(r.sulLat)&&
      c.lng<=Number(r.lesteLng)&&
      c.lng>=Number(r.oesteLng)
    )
    .sort((a,b)=>{
      const da=Math.pow(c.lat-Number(a.centroLat),2)+Math.pow(c.lng-Number(a.centroLng),2);
      const db=Math.pow(c.lat-Number(b.centroLat),2)+Math.pow(c.lng-Number(b.centroLng),2);
      return da-db;
    })[0]||null;

  regionMap._motocasDetectedRegion=regiao;

  const el=$("regionPickerStatus");
  el.classList.toggle("ok",!!regiao);
  el.classList.toggle("bad",!regiao);

  el.innerHTML=regiao
    ? `<i class="fa-solid fa-circle-check"></i> Região identificada: <strong>${esc(regiao.regiao)}</strong>`
    : `<i class="fa-solid fa-triangle-exclamation"></i> Posicione a tachinha dentro de uma região atendida de ${esc(user.cidade)}`;
}

function confirmRegionPoint(){
  if(!regionMap||!regionPickerType)return;

  const c=regionMap.getCenter();
  const regiao=regionMap._motocasDetectedRegion;

  if(!regiao){
    return alert("Posicione a tachinha dentro de uma região atendida da cidade.");
  }

  if(regionPickerType==="origem"){
    origemLat=Number(c.lat.toFixed(7));
    origemLng=Number(c.lng.toFixed(7));
    origemRegiao=regiao.regiao;
    if($("origemBairro"))$("origemBairro").value=origemRegiao;
  }else{
    destinoLat=Number(c.lat.toFixed(7));
    destinoLng=Number(c.lng.toFixed(7));
    destinoRegiao=regiao.regiao;
    if($("destinoBairro"))$("destinoBairro").value=destinoRegiao;
  }

  updateMapConfirmButton(regionPickerType);
  closeRegionPicker();
}

function closeRegionPicker(){
  $("regionPicker").classList.add("hidden");
  if(regionMap){
    regionMap.remove();
    regionMap=null;
  }
  regionPickerType=null;
}

function onRegionChanged(tipo){
  if(tipo==="origem"){
    origemLat=null;origemLng=null;
    const n=$("origemBairroPointNote");if(n)n.classList.remove("show");
  }else{
    destinoLat=null;destinoLng=null;
    const n=$("destinoBairroPointNote");if(n)n.classList.remove("show");
  }

  const id=tipo==="origem"?"origemBairro":"destinoBairro";
  if(val(id))openRegionPicker(tipo);
}

function loadCityMap(city){
  const mapa=$("cityMap");
  if(!mapa)return;

  const cidade=String(city||"Brasil").trim();
  const q=encodeURIComponent(cidade+", Brasil");

  /*
    O iframe fica maior que a área visível e é deslocado para fora das bordas.
    Assim aparecem apenas as ruas/mapa no centro e os elementos de interface
    que o provedor coloca nos cantos ficam fora da área visível.
  */
  mapa.src=`https://maps.google.com/maps?q=${q}&z=14&output=embed`;
  mapa.setAttribute("loading","lazy");
  mapa.setAttribute("referrerpolicy","no-referrer-when-downgrade");
}
async function openApp(){
  $("auth").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("cityTop").textContent=user.cidade;

  if($("mapCity")){
    $("mapCity").textContent="";
    $("mapCity").style.display="none";
  }

  loadCityMap(user.cidade);
  $("drawerName").textContent=user.nome||"Passageiro";
  $("drawerEmail").textContent=user.email||"";
  await loadNeighborhoods();
  await refreshRide();
  await checkRating();
  clearInterval(pollTimer);
  pollTimer=setInterval(()=>{refreshRide();pollPassengerChatBadge()},900);
}
async function loadNeighborhoods(){
  const r=await api("listarRegioes",{cidade:user.cidade});
  if(!r.ok)return alert(r.message);

  regioesCache=Array.isArray(r.regioes)?r.regioes:[];

  // Mantém os selects existentes escondidos apenas para compatibilidade com o HTML antigo.
  if($("origemBairro")){
    $("origemBairro").innerHTML='<option value=""></option>'+
      regioesCache.map(x=>`<option value="${esc(x.regiao)}">${esc(x.regiao)}</option>`).join("");
  }
  if($("destinoBairro")){
    $("destinoBairro").innerHTML='<option value=""></option>'+
      regioesCache.map(x=>`<option value="${esc(x.regiao)}">${esc(x.regiao)}</option>`).join("");
  }

  ensureConfirmMapButtons();
  updateMapConfirmButton("origem");
  updateMapConfirmButton("destino");
}
function nextStep(n){
  if(n>step&&!valid(step))return;
  step=n;

  ["step1","step2","step3","step4","step5"].forEach((x,i)=>{
    $(x).classList.toggle("hidden",i+1!==step);
  });

  ["p1","p2","p3","p4","p5"].forEach((x,i)=>{
    $(x).classList.toggle("on",i<step);
  });

  const t={
    1:"Informe sua origem",
    2:"Confirme sua região",
    3:"Informe seu destino",
    4:"Confirme a região de destino",
    5:"Confira e solicite"
  };

  $("sheetTitle").textContent=t[step];
  $("stepLabel").textContent=`ETAPA ${step} DE 5`;

  ensureConfirmMapButtons();

  if(step===2&&origemLat===null){
    setTimeout(()=>openRegionPicker("origem"),80);
  }
  if(step===4&&destinoLat===null){
    setTimeout(()=>openRegionPicker("destino"),80);
  }
  if(step===5)calculateFare();
}
function valid(s){
  if(s===1&&!val("origemLogradouro"))
    return alert("Informe a rua/avenida de origem."),false;

  if(s===2&&(origemLat===null||origemLng===null||!origemRegiao))
    return alert("Confirme a região da origem no mapa."),false;

  if(s===3&&!val("destinoLogradouro"))
    return alert("Informe a rua/avenida de destino."),false;

  if(s===4&&(destinoLat===null||destinoLng===null||!destinoRegiao))
    return alert("Confirme a região do destino no mapa."),false;

  return true;
}

async function calculateFare(){
  if(origemLat===null||origemLng===null||destinoLat===null||destinoLng===null){
    return alert("Confirme origem e destino no mapa.");
  }

  loading(true,"Calculando...");
  const r=await api("calcularTarifa",{
    cidade:user.cidade,
    origemLat,
    origemLng,
    destinoLat,
    destinoLng
  });
  loading(false);

  if(!r.ok)return alert(r.message);

  fare=r.valor;
  origemRegiao=r.origemRegiao||origemRegiao;
  destinoRegiao=r.destinoRegiao||destinoRegiao;

  $("fareValue").textContent=money(fare);
}
async function requestRide(){
  ensureAudio();
  loading(true,"Solicitando...");

  const r=await api("criarCorrida",{
    passageiroId:user.id,
    passageiroNome:user.nome,
    passageiroTelefone:user.telefone,
    cidade:user.cidade,

    origemLat,
    origemLng,
    origemLogradouro:val("origemLogradouro"),
    origemNumero:val("origemNumero")||"0",
    origemReferencia:val("origemReferencia"),

    destinoLat,
    destinoLng,
    destinoLogradouro:val("destinoLogradouro"),
    destinoNumero:val("destinoNumero")||"0",
    destinoReferencia:val("destinoReferencia"),

    pagamento:val("pagamento")
  });

  loading(false);
  if(!r.ok)return alert(r.message);

  origemRegiao=r.origemRegiao||origemRegiao;
  destinoRegiao=r.destinoRegiao||destinoRegiao;
  activeRideId=r.corridaId;
  lastStatus="PENDENTE";

  $("stepContent").classList.add("hidden");
  $("searchState").classList.remove("hidden");
}
async function refreshRide(){
  if(!user)return;

  const r=await api("corridaAtivaPassageiro",{passageiroId:user.id});

  if(!r.ok||!r.corrida){
    if(lastStatus){
      lastStatus=null;
      activeRideId=null;
      resetSheet();
      checkRating();
    }
    return;
  }

  const c=r.corrida;
  activeRideId=c.id;

  if(c.status==="PENDENTE"){
    $("stepContent").classList.add("hidden");
    $("searchState").classList.remove("hidden");
    $("acceptedState").classList.add("hidden");
  }else{
    $("stepContent").classList.add("hidden");
    $("searchState").classList.add("hidden");
    $("acceptedState").classList.remove("hidden");

    if(lastStatus==="PENDENTE"&&c.status==="ACEITA")playAcceptedSound();

    $("driverName").textContent=c.motocaNome||"Seu Motoca";

    const marca=c.motocaMarca||c.motocaModelo||"";
    const modelo=(c.motocaMarca&&c.motocaModelo&&c.motocaModelo!==c.motocaMarca)
      ? c.motocaModelo
      : "";
    const cor=c.motocaCor||"";
    const placa=c.motocaPlaca||"";

    const dadosVeiculo=[marca,modelo,cor,placa].filter(Boolean);
    $("driverMoto").textContent=dadosVeiculo.length
      ? dadosVeiculo.join(" • ")
      : "Veículo não informado";

    const media=Number(c.motocaAvaliacaoMedia)||0;
    const qtd=Number(c.motocaAvaliacaoQuantidade)||0;
    $("driverRating").textContent=qtd>0
      ? `${media.toFixed(1)} (${qtd} ${qtd===1?"avaliação":"avaliações"})`
      : "Novo Motoca";

    currentDriverPhoto=c.motocaFotoDataUrl||"";
    $("driverAvatar").innerHTML=currentDriverPhoto
      ? `<img src="${currentDriverPhoto}">`
      : `<span>${esc((c.motocaNome||"M")[0])}</span>`;

    const st={
      ACEITA:"Corrida aceita",
      A_CAMINHO:"Motoca a caminho",
      CHEGOU:"Motoca chegou",
      EM_CORRIDA:"Em viagem",
      AGUARDANDO_PAGAMENTO:"Pagamento"
    };

    $("driverStatus").textContent=st[c.status]||c.status;
    $("rideSituation").textContent=st[c.status]||c.status;
    $("cancelAcceptedBtn").classList.toggle("hidden",c.status!=="ACEITA");
  }

  lastStatus=c.status;
}
function resetSheet(){
  $("stepContent").classList.remove("hidden");
  $("searchState").classList.add("hidden");
  $("acceptedState").classList.add("hidden");

  $("origemLogradouro").value="";
  $("origemNumero").value="";
  $("origemReferencia").value="";
  $("destinoLogradouro").value="";
  $("destinoNumero").value="";
  $("destinoReferencia").value="";

  origemLat=null;origemLng=null;origemRegiao="";
  destinoLat=null;destinoLng=null;destinoRegiao="";

  if($("origemBairro"))$("origemBairro").value="";
  if($("destinoBairro"))$("destinoBairro").value="";

  updateMapConfirmButton("origem");
  updateMapConfirmButton("destino");

  closeChat();
  step=1;
  nextStep(1);
}
async function cancelActiveRide(){if(!activeRideId)return;if(!confirm("Deseja cancelar esta corrida?"))return;loading(true,"Cancelando...");const r=await api("cancelarCorridaPassageiro",{corridaId:activeRideId,passageiroId:user.id});loading(false);if(!r.ok)return alert(r.message);lastStatus=null;activeRideId=null;resetSheet()}
function showView(v){["home","trips","profile"].forEach(x=>{$(x+"View").classList.toggle("active",x===v);$("nav"+cap(x)).classList.toggle("active",x===v)});if(v==="trips")loadTrips();if(v==="profile")loadProfile()}
function cap(s){return s[0].toUpperCase()+s.slice(1)}
async function loadTrips(){
  const r=await api("listarCorridasPassageiro",{passageiroId:user.id});
  $("tripsList").innerHTML=r.ok?r.corridas.map(c=>{
    const avaliada=Number(c.avaliacao)>0||isRatingDone(c.id);
    return `<div class="history-item"><strong>${esc(c.origemBairro)} → ${esc(c.destinoBairro)}</strong><br><small>${esc(c.status)} • ${money((Number(c.valor)||0)+(Number(c.esperaValor)||0))}</small>${c.status==="FINALIZADA"&&!avaliada?`<button class="btn btn-light" style="padding:10px" onclick="openRating(\'${c.id}\')">AVALIAR MOTOCA</button>`:Number(c.avaliacao)>0?`<div class="small" style="color:var(--s);margin-top:7px">${"★".repeat(Number(c.avaliacao))}</div>`:""}${c.motocaId?`<button class="btn btn-light" style="padding:10px" onclick="openReport(\'${c.id}\',\'${c.motocaId}\')">DENUNCIAR MOTOCA</button>`:""}</div>`;
  }).join(""):"Erro";
}
async function loadProfile(){const r=await api("obterPerfilPassageiro",{passageiroId:user.id});if(!r.ok)return alert(r.message);user={...user,...r.perfil};localStorage.setItem("motocas_passageiro",JSON.stringify(user));$("profileName").value=user.nome||"";$("profileEmail").value=user.email||"";$("profilePhone").value=formatPhone(user.telefone||"");renderProfilePhoto(user.fotoDataUrl)}
function renderProfilePhoto(src){$("profilePhoto").innerHTML=src?`<img src="${src}">`:`<i class="fa-solid fa-user"></i>`}
function handlePhoto(e){const f=e.target.files[0];if(!f)return;if(f.size>6*1024*1024)return alert("Escolha uma imagem de até 6 MB.");const rd=new FileReader();rd.onload=()=>{const img=new Image();img.onload=()=>{const max=600,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);pendingPhotoMime="image/jpeg";pendingPhotoBase64=c.toDataURL("image/jpeg",.78);renderProfilePhoto(pendingPhotoBase64)};img.src=rd.result};rd.readAsDataURL(f)}
async function saveProfile(){loading(true,"Salvando...");const r=await api("atualizarPerfilPassageiro",{passageiroId:user.id,nome:val("profileName"),email:val("profileEmail"),telefone:val("profilePhone"),fotoBase64:pendingPhotoBase64,fotoMime:pendingPhotoMime});loading(false);if(!r.ok)return msg("profileMsg",r.message,true);user={...user,...r.perfil};localStorage.setItem("motocas_passageiro",JSON.stringify(user));pendingPhotoBase64="";msg("profileMsg","Perfil atualizado.");renderProfilePhoto(user.fotoDataUrl)}
async function checkRating(){
  if(!user||ratingCheckBusy)return;
  ratingCheckBusy=true;
  try{
    const r=await api("corridaPendenteAvaliacao",{passageiroId:user.id});
    if(!r.ok||!r.corrida)return;

    const id=r.corrida.id;
    if(isRatingDone(id))return;

    // Não reabre o mesmo modal se ele já estiver aberto.
    if(ratingRideId===id&&!$("ratingModal").classList.contains("hidden"))return;
    openRating(id);
  }finally{
    ratingCheckBusy=false;
  }
}
function ratingDoneKey(id){return user&&user.id?`motocas_rating_done_${user.id}_${id}`:`motocas_rating_done_${id}`}
function isRatingDone(id){return !!localStorage.getItem(ratingDoneKey(id))}
function markRatingDone(id){if(id)localStorage.setItem(ratingDoneKey(id),"1")}

function renderStars(){$("ratingStars").innerHTML=[1,2,3,4,5].map(i=>`<button id="star${i}" onclick="chooseRating(${i})"><i class="fa-solid fa-star"></i></button>`).join("")}
function openRating(id){
  if(!id||isRatingDone(id))return;
  ratingRideId=id;
  ratingValue=0;
  chooseRating(0);
  $("ratingModal").classList.remove("hidden");
}
function closeRating(){$("ratingModal").classList.add("hidden")}
function chooseRating(n){ratingValue=n;[1,2,3,4,5].forEach(i=>$("star"+i).classList.toggle("on",i<=n))}
async function submitRating(){
  if(!ratingValue)return alert("Escolha uma nota.");
  if(!ratingRideId)return;

  const rideId=ratingRideId;
  loading(true,"Enviando...");

  const r=await api("avaliarCorrida",{
    corridaId:rideId,
    passageiroId:user.id,
    nota:ratingValue
  });

  loading(false);

  if(!r.ok){
    // Se o servidor informar que já foi avaliada, também impede reaparecimento.
    const m=String(r.message||"").toLowerCase();
    if(m.includes("já foi avaliada")||m.includes("ja foi avaliada")){
      markRatingDone(rideId);
      closeRating();
      ratingRideId=null;
      if($("tripsView").classList.contains("active"))loadTrips();
      return;
    }
    return alert(r.message);
  }

  // Uma avaliação fica vinculada somente a ESTA viagem.
  markRatingDone(rideId);
  closeRating();
  ratingRideId=null;
  ratingValue=0;

  if($("tripsView").classList.contains("active"))loadTrips();
}

function openChat(rideId){
  if(!rideId)return;
  markPassengerChatSeen();
  chatRideId=rideId;
  chatLastCount=-1;
  $("chatDrawer").classList.add("open");
  $("chatOverlay").classList.add("show");
  chatUnread=0;
  updatePassengerChatBadge();
  loadChat(true);
  clearInterval(chatTimer);
  chatTimer=setInterval(()=>{if(!chatBusy)loadChat(false)},800);
}

function closeChat(){
  markPassengerChatSeen();
  clearInterval(chatTimer);
  chatTimer=null;
  chatRideId=null;
  chatBusy=false;
  chatPendingRefresh=false;
  if($("chatDrawer"))$("chatDrawer").classList.remove("open");
  if($("chatOverlay"))$("chatOverlay").classList.remove("show");
}

async function loadChat(forceScroll=false){
  if(!chatRideId||!user)return false;

  // Nunca lê enquanto outra operação do chat está gravando/lendo.
  if(chatBusy){
    chatPendingRefresh=true;
    return false;
  }

  chatBusy=true;
  $("chatReceiveLoading").classList.add("show");

  try{
    const r=await api("listarChatCorrida",{
      corridaId:chatRideId,
      participanteTipo:"PASSAGEIRO",
      participanteId:user.id
    });

    if(!r.ok)return false;

    chatKnownCount=r.mensagens.length;
    if(!forceScroll&&chatLastCount===r.mensagens.length)return true;
    chatLastCount=r.mensagens.length;

    const box=$("chatMessages");
    box.innerHTML=r.mensagens.map(m=>{
      const mine=m.remetenteTipo==="PASSAGEIRO";
      const photo=m.tipo==="FOTO"&&m.imagemDataUrl
        ? `<img class="chat-photo" src="${m.imagemDataUrl}" onclick="openChatPhoto(this.src)" alt="Foto enviada">`
        : "";
      return `<div class="chat-msg ${mine?"me":"other"}">${esc(m.mensagem||"")}${photo}<small>${esc(String(m.criadoEm||"").slice(11,16))}</small></div>`;
    }).join("");
    box.scrollTop=box.scrollHeight;
    return true;
  }finally{
    $("chatReceiveLoading").classList.remove("show");
    chatBusy=false;

    if(chatPendingRefresh){
      chatPendingRefresh=false;
      setTimeout(()=>loadChat(false),60);
    }
  }
}

async function sendChatMessage(){
  if(!chatRideId||!user)return;
  const text=val("chatInput");
  if(!text)return;

  // Se uma leitura estiver terminando, aguarda alguns milissegundos.
  if(chatBusy){
    setTimeout(sendChatMessage,80);
    return;
  }

  chatBusy=true;
  $("chatSendLoading").classList.add("show");
  $("chatInput").disabled=true;

  try{
    const r=await api("enviarMensagemChat",{
      corridaId:chatRideId,
      remetenteTipo:"PASSAGEIRO",
      remetenteId:user.id,
      mensagem:text,
      tipo:"TEXTO"
    });

    if(!r.ok)throw new Error(r.message);

    $("chatInput").value="";

    // Libera exclusivamente para a leitura de confirmação.
    chatBusy=false;
    const apareceu=await loadChat(true);
    if(!apareceu)throw new Error("Mensagem enviada, mas ainda não foi possível atualizar o chat.");
  }catch(e){
    alert(e.message||"Não foi possível enviar a mensagem.");
  }finally{
    chatBusy=false;
    $("chatSendLoading").classList.remove("show");
    $("chatInput").disabled=false;
    $("chatInput").focus();

    if(chatPendingRefresh){
      chatPendingRefresh=false;
      setTimeout(()=>loadChat(false),60);
    }
  }
}




function appendOptimisticChat(text,type){
  const box=$("chatMessages");
  if(!box)return;
  const div=document.createElement("div");
  div.className="chat-msg me";
  div.innerHTML=`${esc(text)}<small>agora</small>`;
  box.appendChild(div);
  box.scrollTop=box.scrollHeight;
}

function updatePassengerChatBadge(){
  const b=$("chatPassengerBadge");
  if(!b)return;
  b.textContent=chatUnread>9?"9+":String(chatUnread);
  b.classList.toggle("show",chatUnread>0);
}

async function pollPassengerChatBadge(){
  if(!activeRideId||!user||chatRideId)return;
  const r=await api("listarChatCorrida",{
    corridaId:activeRideId,
    participanteTipo:"PASSAGEIRO",
    participanteId:user.id
  });
  if(!r.ok)return;
  const otherCount=r.mensagens.filter(m=>m.remetenteTipo==="MOTOCA").length;
  const key="motocas_chat_seen_pass_"+activeRideId;
  const seen=Number(localStorage.getItem(key)||0);
  chatUnread=Math.max(0,otherCount-seen);
  updatePassengerChatBadge();
}

function markPassengerChatSeen(){
  if(!activeRideId||!user)return;
  api("listarChatCorrida",{
    corridaId:activeRideId,
    participanteTipo:"PASSAGEIRO",
    participanteId:user.id
  }).then(r=>{
    if(!r.ok)return;
    const otherCount=r.mensagens.filter(m=>m.remetenteTipo==="MOTOCA").length;
    localStorage.setItem("motocas_chat_seen_pass_"+activeRideId,String(otherCount));
    chatUnread=0;
    updatePassengerChatBadge();
  });
}


async function sendChatPhoto(input){
  const file=input.files&&input.files[0];
  if(!file||!chatRideId||!user)return;
  if(file.size>6*1024*1024){input.value="";return alert("Escolha uma foto de até 6 MB.");}

  if(chatBusy){
    setTimeout(()=>sendChatPhoto(input),80);
    return;
  }

  chatBusy=true;
  $("chatSendLoading").classList.add("show");

  try{
    const foto=await compressChatPhoto(file);
    const r=await api("enviarMensagemChat",{
      corridaId:chatRideId,
      remetenteTipo:"PASSAGEIRO",
      remetenteId:user.id,
      mensagem:"Foto",
      tipo:"FOTO",
      fotoBase64:foto.base64,
      fotoMime:"image/jpeg"
    });
    if(!r.ok)throw new Error(r.message);

    chatBusy=false;
    const apareceu=await loadChat(true);
    if(!apareceu)throw new Error("Foto enviada, mas ainda não foi possível atualizar o chat.");
  }catch(e){
    alert(e.message||"Não foi possível enviar a foto.");
  }finally{
    chatBusy=false;
    $("chatSendLoading").classList.remove("show");
    input.value="";

    if(chatPendingRefresh){
      chatPendingRefresh=false;
      setTimeout(()=>loadChat(false),60);
    }
  }
}

function compressChatPhoto(file){
  return new Promise((resolve,reject)=>{
    const rd=new FileReader();
    rd.onerror=()=>reject(new Error("Não foi possível ler a foto."));
    rd.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("Foto inválida."));
      img.onload=()=>{
        const max=900,scale=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement("canvas");
        c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);
        resolve({base64:c.toDataURL("image/jpeg",.78)});
      };
      img.src=rd.result;
    };
    rd.readAsDataURL(file);
  });
}

function openChatPhoto(src){
  $("fullPhoto").src=src;
  $("photoModal").classList.remove("hidden");
}

function openReport(rideId,motocaId){reportRideId=rideId;reportMotocaId=motocaId;$("reportType").value="";$("reportText").value="";$("reportModal").classList.remove("hidden")}
function closeReport(){$("reportModal").classList.add("hidden")}
async function submitReport(){if(!val("reportType"))return alert("Selecione o motivo.");loading(true,"Enviando denúncia...");const r=await api("denunciarCorrida",{corridaId:reportRideId,passageiroId:user.id,motocaId:reportMotocaId,tipo:val("reportType"),descricao:val("reportText")});loading(false);if(!r.ok)return alert(r.message);closeReport();alert("Denúncia enviada.")}
function openDriverPhoto(){if(!currentDriverPhoto)return;$("fullPhoto").src=currentDriverPhoto;$("photoModal").classList.remove("hidden")}
function closePhoto(){$("photoModal").classList.add("hidden")}
function ensureAudio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume()}
function playAcceptedSound(){try{ensureAudio();[523,659,784].forEach((f,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+i*.14;o.frequency.value=f;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.16,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+.14)})}catch(e){}}
async function sendReset(){loading(true,"Enviando...");const r=await api("solicitarResetSenha",{tipo:"PASSAGEIRO",email:val("forgotEmail")});loading(false);if(!r.ok)return msg("forgotMsg",r.message,true);$("reset2").classList.remove("hidden");msg("forgotMsg","Código enviado.")}
async function confirmReset(){loading(true,"Redefinindo...");const r=await api("confirmarResetSenha",{tipo:"PASSAGEIRO",email:val("forgotEmail"),codigo:val("resetCode"),novaSenha:val("newPass")});loading(false);if(!r.ok)return msg("forgotMsg",r.message,true);msg("forgotMsg","Senha redefinida.");setTimeout(()=>mode("login"),800)}
function formatPhone(phone){let p=String(phone||"").replace(/\D/g,"");if(p.startsWith("55")&&p.length>11)p=p.slice(2);if(p.length===11)return `${p.slice(0,2)} ${p.slice(2,3)} ${p.slice(3,7)}-${p.slice(7)}`;if(p.length===10)return `${p.slice(0,2)} ${p.slice(2,6)}-${p.slice(6)}`;return p}
function maskPhone(el){let p=el.value.replace(/\D/g,"");if(p.startsWith("55")&&p.length>11)p=p.slice(2);p=p.slice(0,11);if(p.length>7)el.value=`${p.slice(0,2)} ${p.slice(2,3)} ${p.slice(3,7)}-${p.slice(7)}`;else if(p.length>3)el.value=`${p.slice(0,2)} ${p.slice(2,3)} ${p.slice(3)}`;else if(p.length>2)el.value=`${p.slice(0,2)} ${p.slice(2)}`;else el.value=p}
function logout(){
  localStorage.removeItem("motocas_passageiro");
  sessionStorage.removeItem("motocas_passageiro");
  clearInterval(pollTimer);
  pollTimer=null;

  user=null;
  activeRideId=null;
  lastStatus=null;

  if($("app"))$("app").classList.add("hidden");
  if($("welcome"))$("welcome").classList.add("hidden");
  if($("sideMenu"))$("sideMenu").classList.remove("open");
  if($("drawerOverlay"))$("drawerOverlay").classList.remove("show");

  $("loginEmail").value="";
  $("loginSenha").value="";
  $("loginMsg").textContent="";

  $("auth").classList.remove("hidden");
  mode("login");
  window.scrollTo(0,0);
  history.replaceState(null,"",location.pathname+location.search);
}
function msg(id,t,e=false){$(id).textContent=t;$(id).className="msg "+(e?"err":"ok")}function money(n){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0)}function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
