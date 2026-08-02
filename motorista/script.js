
const API_URL="https://script.google.com/macros/s/AKfycbw7iwtvlegLD8jxTSYLOzUZrl-IZivNHij2IowTMcdRIV2RScsNZhao5wqwUtZMiYY8lw/exec";
const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const state={driver:null,token:"",revision:"",trips:[],availableTrips:[],currentPaymentCode:"",currentPhotoCode:"",photoBase64:"",loading:false,balanceVisible:true,dashboardTimer:null,dashboardBusy:false,pendingWhatsapp:null,lastAvailableCount:0,driverOnline:false,statusTimer:null,statusBusy:false,profileImageData:""};
async function api(action,data={},options={}){
  if(!API_URL.startsWith("https://script.google.com/"))throw new Error("Cole a URL do Apps Script no HTML.");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),options.timeout||30000);
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
        clearInterval(state.statusTimer);
        sessionStorage.removeItem("pl_mob_driver");
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
function motoristaWhatsappMessage(message){
  const driverName=String(state.driver&&state.driver.name||"Motorista").trim();
  const cleanMessage=String(message||"").trim();
  return `*Pega & Leva Mobilidade • Motorista: ${driverName}*\n\n${cleanMessage}`;
}
function wa(number,message){
  let n=String(number||"").replace(/\D/g,"");
  if(!n)return;
  if(!n.startsWith("55"))n="55"+n;
  const organizedMessage=motoristaWhatsappMessage(message);
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(organizedMessage)}`,"_blank")
}
function statusLabel(s){
  const m={
    "AGUARDANDO ENTREGADOR":"Aguardando motorista",
    "ACEITA":"Viagem aceita",
    "FINALIZANDO CORRIDA PRÓXIMA":"Finalizando viagem próxima",
    "ESTOU INDO":"Indo buscar o passageiro",
    "FINALIZADA":"Viagem finalizada"
  };
  return m[String(s||"").toUpperCase()]||s;
}
function escapeCardText(value){
  return String(value??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}
function firstTripValue(t,keys,fallback=""){
  for(const key of keys){
    const parts=String(key).split(".");
    let value=t;

    for(const part of parts){
      if(value==null)break;
      value=value[part];
    }

    if(value!==undefined&&value!==null&&String(value).trim()!==""){
      return value;
    }
  }

  return fallback;
}
function normalizedTrip(t){
  return {
    code:firstTripValue(t,["code","codigo","tripCode"],"Sem código"),
    value:Number(firstTripValue(t,["value","valor","price","preco","valorCorrida"],0))||0,
    passenger:firstTripValue(t,[
      "requesterName","userName","passengerName","nomeSolicitante",
      "requester.name","passenger.name"
    ],"Passageiro"),
    passengerWhatsapp:firstTripValue(t,[
      "requesterWhatsapp","whatsappSolicitante","passengerWhatsapp"
    ],""),
    origin:firstTripValue(t,[
      "origin","origem","pickupAddress","enderecoOrigem","origin.address","pickup.address"
    ],"Ponto de partida não informado"),
    originNeighborhood:firstTripValue(t,[
      "originNeighborhood","bairroOrigem","pickupNeighborhood","origin.neighborhood"
    ],"Bairro de partida não informado"),
    destination:firstTripValue(t,[
      "destination","destino","deliveryAddress","enderecoDestino","destination.address"
    ],"Destino não informado"),
    destinationNeighborhood:firstTripValue(t,[
      "destinationNeighborhood","bairroDestino","deliveryNeighborhood","destination.neighborhood"
    ],"Bairro de destino não informado"),
    estimatedMinutes:firstTripValue(t,[
      "estimatedMinutes","tempoEstimado","estimatedTime","minutes"
    ],"—"),
    tripType:firstTripValue(t,["tripType","freightType","tipoFrete"],"VIAGEM")
  };
}
function tripPeopleInfo(t){
  const data=normalizedTrip(t);

  return `
  <div style="margin:12px 0 14px;padding:12px;border-radius:13px;background:#f8fafc;border:1px solid #e2e8f0">
    <div style="display:flex;gap:9px;align-items:flex-start">
      <span style="width:36px;height:36px;min-width:36px;border-radius:50%;display:grid;place-items:center;background:#e8f0ff;color:#0646c8">
        <i class="fa-solid fa-user"></i>
      </span>
      <div style="min-width:0">
        <small style="display:block;font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em">Passageiro</small>
        <strong style="display:block;margin-top:2px;color:#172033;overflow-wrap:anywhere">${escapeCardText(data.passenger)}</strong>
      </div>
    </div>
  </div>`;
}
togglePassword.onclick=()=>{const visible=password.type==="text";password.type=visible?"password":"text";togglePassword.innerHTML=`<i class="fa-regular ${visible?"fa-eye":"fa-eye-slash"}"></i>`}
const QUICK_DRIVER_LOGIN_KEY="pl_mob_quick_driver_account";

function getQuickDriverAccount(){
  try{
    return JSON.parse(localStorage.getItem(QUICK_DRIVER_LOGIN_KEY)||"null");
  }catch(e){
    localStorage.removeItem(QUICK_DRIVER_LOGIN_KEY);
    return null;
  }
}

function saveQuickDriverAccount(driver,emailValue,passwordValue){
  const account={
    name:String(driver&&driver.name||"Motorista").trim(),
    email:String(emailValue||"").trim().toLowerCase(),
    password:String(passwordValue||"")
  };

  localStorage.setItem(QUICK_DRIVER_LOGIN_KEY,JSON.stringify(account));
  renderQuickDriverAccount();
}

function removeQuickDriverAccount(){
  localStorage.removeItem(QUICK_DRIVER_LOGIN_KEY);
  renderQuickDriverAccount();
}

function renderQuickDriverAccount(){
  const account=getQuickDriverAccount();
  const valid=!!(account&&account.email&&account.password);

  $("quickDriverLoginBox")?.classList.toggle("hide",!valid);

  if(!valid)return;

  $("quickDriverName").textContent=account.name||"Motorista";
  $("quickDriverEmail").textContent=account.email;
}

async function performDriverLogin(emailValue,passwordValue,quickLogin=false){
  loginError.textContent="";
  if($("quickDriverLoginError"))$("quickDriverLoginError").textContent="";

  try{
    if(quickLogin){
      $("quickDriverLoginLoading")?.classList.add("on");
    }

    const j=await withActionLoading(
      quickLogin?"Entrando rapidamente":"Entrando no painel",
      quickLogin
        ?"Abrindo sua conta salva."
        :"Conferindo seu e-mail e sua senha.",
      ()=>api("driverLogin",{
        email:String(emailValue||"").trim().toLowerCase(),
        password:String(passwordValue||"")
      })
    );

    if(!quickLogin){
      if($("saveLogin")?.checked){
        saveQuickDriverAccount(j.driver,emailValue,passwordValue);
      }else{
        removeQuickDriverAccount();
      }
    }

    openApp(j.driver,j.token);
  }catch(x){
    if(quickLogin){
      if($("quickDriverLoginError"))$("quickDriverLoginError").textContent=x.message;

      if(/senha|e-mail|email|credenciais|inválid/i.test(String(x.message||""))){
        removeQuickDriverAccount();
        toast("A conta salva não é mais válida. Entre novamente.");
      }
    }else{
      loginError.textContent=x.message;
    }
  }finally{
    $("quickDriverLoginLoading")?.classList.remove("on");
  }
}

loginForm.onsubmit=async e=>{
  e.preventDefault();

  await performDriverLogin(
    email.value.trim().toLowerCase(),
    password.value,
    false
  );
};




function getDriverPhotoRaw(){
  const d=state.driver||{};

  return String(
    d.photoUrl ||
    d.profilePhotoUrl ||
    d.fotoPerfilUrl ||
    d.FOTO_PERFIL_URL ||
    ""
  ).trim();
}

function extractDriveFileId(value){
  const text=String(value||"").trim();
  if(!text)return"";

  // Se vier só o ID salvo na planilha.
  if(/^[a-zA-Z0-9_-]{20,}$/.test(text) && !/^https?:/i.test(text)){
    return text;
  }

  const patterns=[
    /[?&]id=([a-zA-Z0-9_-]{20,})/i,
    /\/d\/([a-zA-Z0-9_-]{20,})/i,
    /\/thumbnail\?id=([a-zA-Z0-9_-]{20,})/i
  ];

  for(const pattern of patterns){
    const match=text.match(pattern);
    if(match&&match[1])return match[1];
  }

  return"";
}

function safeDriverPhotoUrl(url){
  const value=String(url||"").trim();
  if(!value)return"";

  if(value.startsWith("data:image/"))return value;

  const driveId=extractDriveFileId(value);
  if(driveId){
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1000`;
  }

  return value;
}

function currentDriverPhotoUrl(){
  const d=state.driver||{};

  // Primeiro tenta o ID da imagem, que é a forma mais confiável.
  const photoId=String(
    d.photoId ||
    d.profilePhotoId ||
    d.fotoPerfilId ||
    d.FOTO_PERFIL_ID ||
    ""
  ).trim();

  if(photoId){
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(photoId)}&sz=w1000`;
  }

  return safeDriverPhotoUrl(getDriverPhotoRaw());
}

function bindAvatarFallback(root=document){
  root.querySelectorAll("img[data-driver-avatar]").forEach(img=>{
    const wrapper=img.parentElement;
    const fallback=wrapper&&wrapper.querySelector("[data-driver-avatar-fallback]");

    img.onload=()=>{
      img.style.opacity="1";
      if(fallback)fallback.style.visibility="hidden";
    };

    img.onerror=()=>{
      img.remove();
      if(fallback){
        fallback.style.visibility="visible";
        fallback.style.display="grid";
      }
    };

    if(img.complete){
      if(img.naturalWidth>0){
        img.style.opacity="1";
        if(fallback)fallback.style.visibility="hidden";
      }else{
        img.onerror();
      }
    }
  });
}

function driverFirstName(){
  return String(state.driver&&state.driver.name||"Motorista").trim().split(/\s+/)[0]||"Motorista";
}

function driverAvatarHTML(size=46){
  const url=currentDriverPhotoUrl();
  const initials=String(
    (state.driver&&state.driver.name)||"Motorista"
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0,2)
    .map(p=>p.charAt(0).toUpperCase())
    .join("") || "E";

  return `
    <span class="driver-avatar-shell" style="
      position:relative;
      width:${size}px;
      height:${size}px;
      min-width:${size}px;
      border-radius:50%;
      overflow:hidden;
      display:grid;
      place-items:center;
      background:#e8f0ff;
      color:#0646c8;
      border:1px solid rgba(6,70,200,.12);
    ">
      <span
        data-driver-avatar-fallback
        style="
          position:absolute;
          inset:0;
          display:grid;
          place-items:center;
          background:#e8f0ff;
          color:#0646c8;
          font-size:${Math.max(12,Math.round(size*.34))}px;
          font-weight:950;
          line-height:1;
          z-index:1;
        "
      >${escapeCardText(initials)}</span>

      ${url?`
        <img
          data-driver-avatar
          data-size="${size}"
          src="${escapeCardText(url)}"
          alt="Foto de perfil"
          loading="eager"
          style="
            position:absolute;
            inset:0;
            width:100%;
            height:100%;
            border-radius:50%;
            object-fit:cover;
            display:block;
            opacity:0;
            z-index:2;
            transition:opacity .15s ease;
          "
        >
      `:""}
    </span>
  `;
}

function renderDriverProfileButton(){
  const btn=document.getElementById("logoutBtn");
  if(!btn)return;

  // O botão original de sair vira o avatar de perfil.
  btn.title="Abrir meu perfil";
  btn.setAttribute("aria-label","Abrir meu perfil");
  btn.style.width="40px";
  btn.style.height="40px";
  btn.style.minWidth="40px";
  btn.style.padding="0";
  btn.style.borderRadius="50%";
  btn.style.overflow="hidden";
  btn.style.display="inline-grid";
  btn.style.placeItems="center";
  btn.style.background="transparent";
  btn.style.border="0";
  btn.style.boxShadow="none";
  btn.style.color="#0646c8";
  btn.innerHTML=driverAvatarHTML(40);
  bindAvatarFallback(btn);
  btn.onclick=openDriverProfileMenu;
}

function ensureDriverProfileMenu(){
  let overlay=document.getElementById("driverProfileOverlay");
  if(overlay)return overlay;

  overlay=document.createElement("div");
  overlay.id="driverProfileOverlay";
  overlay.style.cssText=`
    position:fixed;inset:0;z-index:1900;display:none;
    background:rgba(15,23,42,.48);
  `;

  overlay.innerHTML=`
    <aside id="driverProfileMenu" style="
      position:absolute;right:0;top:0;height:100%;width:min(88vw,360px);
      background:#fff;box-shadow:-18px 0 48px rgba(15,23,42,.18);
      padding:22px 18px;overflow:auto;transform:translateX(0);
    ">
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button id="closeDriverProfileMenu" type="button" style="
          width:38px;height:38px;border:0;border-radius:50%;
          background:#f1f5f9;color:#334155;cursor:pointer
        "><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div id="driverProfileMenuHeader"></div>

      <div style="height:1px;background:#e2e8f0;margin:20px 0"></div>

      <div style="display:grid;gap:8px">
        <button type="button" data-profile-action="balance" class="driver-profile-menu-item"></button>
        <button type="button" data-profile-action="trips" class="driver-profile-menu-item"></button>
        <button type="button" data-profile-action="score" class="driver-profile-menu-item"></button>
        <button type="button" data-profile-action="withdraw" class="driver-profile-menu-item"></button>
        <button type="button" data-profile-action="edit" class="driver-profile-menu-item"></button>
      </div>

      <button id="driverProfileLogout" type="button" style="
        width:100%;margin-top:22px;padding:13px 14px;border:1px solid #fecaca;
        border-radius:14px;background:#fff;color:#dc2626;font-weight:800;
        display:flex;align-items:center;gap:11px;cursor:pointer
      ">
        <i class="fa-solid fa-arrow-right-from-bracket"></i>
        Sair da conta
      </button>
    </aside>
  `;

  document.body.appendChild(overlay);

  const style=document.createElement("style");
  style.textContent=`
    .driver-profile-menu-item{
      width:100%;padding:13px 14px;border:1px solid #e2e8f0;border-radius:14px;
      background:#fff;color:#172033;display:flex;align-items:center;gap:12px;
      text-align:left;cursor:pointer;font-weight:800;
    }
    .driver-profile-menu-item:hover{background:#f8fafc}
    .driver-profile-menu-item .menu-icon{
      width:36px;height:36px;border-radius:11px;background:#eef3ff;color:#0646c8;
      display:grid;place-items:center;flex:0 0 auto;
    }
    .driver-profile-menu-item .menu-copy{min-width:0;flex:1}
    .driver-profile-menu-item small{display:block;margin-top:2px;color:#64748b;font-weight:600}
  `;
  document.head.appendChild(style);

  overlay.querySelector("#closeDriverProfileMenu").onclick=closeDriverProfileMenu;
  overlay.onclick=e=>{if(e.target===overlay)closeDriverProfileMenu()};

  overlay.querySelector('[data-profile-action="balance"]').onclick=()=>{
    closeDriverProfileMenu();
    const el=document.getElementById("balance");
    if(el)el.scrollIntoView({behavior:"smooth",block:"center"});
  };

  overlay.querySelector('[data-profile-action="trips"]').onclick=()=>{
    closeDriverProfileMenu();
    const el=document.getElementById("tripCarousel");
    if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
  };

  overlay.querySelector('[data-profile-action="score"]').onclick=()=>{
    closeDriverProfileMenu();
    openDriverScoreSheet();
  };

  overlay.querySelector('[data-profile-action="withdraw"]').onclick=()=>{
    closeDriverProfileMenu();
    withdrawValue.value=String(state.driver&&state.driver.balance||0).replace(".",",");
    openL("withdrawSheet");
  };

  overlay.querySelector('[data-profile-action="edit"]').onclick=()=>{
    closeDriverProfileMenu();
    openDriverEditProfile();
  };

  overlay.querySelector("#driverProfileLogout").onclick=performDriverLogout;

  return overlay;
}

function renderDriverProfileMenu(){
  const overlay=ensureDriverProfileMenu();
  const d=state.driver||{};
  const header=overlay.querySelector("#driverProfileMenuHeader");

  header.innerHTML=`
    <div style="display:flex;align-items:center;gap:13px">
      <div>${driverAvatarHTML(62)}</div>
      <div style="min-width:0">
        <strong style="display:block;font-size:20px;color:#0f172a">${escapeCardText(driverFirstName())}</strong>
        <span style="display:block;margin-top:3px;color:#64748b;font-size:13px">
          <i class="fa-solid fa-motorcycle"></i>
          ${escapeCardText(d.plate||"Sem placa")}
        </span>
      </div>
    </div>
  `;

  bindAvatarFallback(header);

  const items={
    balance:[
      "fa-wallet",
      "Meu saldo",
      state.balanceVisible?money.format(Number(d.balance||0)):"Saldo oculto"
    ],
    trips:[
      "fa-motorcycle",
      "Minhas viagems",
      `${state.trips.filter(t=>String(t.status||"").toUpperCase()!=="FINALIZADA").length} ativa(s)`
    ],
    score:[
      "fa-star",
      "Meu Score",
      `${Number(d.score||0)} pontos • ${String(d.level||"BRONZE")}`
    ],
    withdraw:[
      "fa-money-bill-transfer",
      "Sacar pagamento",
      "Solicitar retirada do saldo"
    ],
    edit:[
      "fa-user-pen",
      "Editar perfil",
      "Nome, telefone, e-mail e foto"
    ]
  };

  Object.entries(items).forEach(([key,data])=>{
    const btn=overlay.querySelector(`[data-profile-action="${key}"]`);
    if(!btn)return;
    btn.innerHTML=`
      <span class="menu-icon"><i class="fa-solid ${data[0]}"></i></span>
      <span class="menu-copy">${data[1]}<small>${data[2]}</small></span>
      <i class="fa-solid fa-chevron-right" style="color:#94a3b8"></i>
    `;
  });
}

function openDriverProfileMenu(){
  renderDriverProfileMenu();
  const overlay=document.getElementById("driverProfileOverlay");
  overlay.style.display="block";
  document.body.style.overflow="hidden";
}

function closeDriverProfileMenu(){
  const overlay=document.getElementById("driverProfileOverlay");
  if(overlay)overlay.style.display="none";
  document.body.style.overflow="";
}

function ensureDriverEditProfile(){
  let modal=document.getElementById("driverEditProfileModal");
  if(modal)return modal;

  modal=document.createElement("div");
  modal.id="driverEditProfileModal";
  modal.style.cssText=`
    position:fixed;inset:0;z-index:1950;display:none;align-items:flex-end;
    justify-content:center;background:rgba(15,23,42,.58);padding:12px;
  `;

  modal.innerHTML=`
    <div style="
      width:min(100%,560px);max-height:92vh;overflow:auto;background:#fff;
      border-radius:26px 26px 18px 18px;padding:22px;box-shadow:0 -18px 50px rgba(15,23,42,.24)
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <small style="color:#64748b">Minha conta</small>
          <h3 style="margin:2px 0 0;color:#0f172a">Editar perfil</h3>
        </div>
        <button id="closeDriverEditProfile" type="button" style="
          width:40px;height:40px;border:0;border-radius:50%;background:#f1f5f9;cursor:pointer
        "><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div style="text-align:center;margin-bottom:20px">
        <div id="driverEditProfileAvatar" style="display:inline-block"></div>
        <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:12px">
          <label style="
            padding:10px 12px;border-radius:12px;background:#eef3ff;color:#0646c8;
            font-weight:800;cursor:pointer
          ">
            <i class="fa-solid fa-image"></i> Escolher foto
            <input id="driverProfileGalleryInput" type="file" accept="image/*" style="display:none">
          </label>
          <label style="
            padding:10px 12px;border-radius:12px;background:#eef3ff;color:#0646c8;
            font-weight:800;cursor:pointer
          ">
            <i class="fa-solid fa-camera"></i> Tirar selfie
            <input id="driverProfileCameraInput" type="file" accept="image/*" capture="user" style="display:none">
          </label>
        </div>
        <small style="display:block;color:#64748b;margin-top:8px">Foto de até 6 MB.</small>
      </div>

      <div style="display:grid;gap:13px">
        <label style="display:grid;gap:6px">
          <span style="font-size:12px;font-weight:800;color:#475569">Nome</span>
          <input id="driverEditName" type="text" maxlength="120" style="padding:13px;border:1px solid #cbd5e1;border-radius:12px;font:inherit">
        </label>
        <label style="display:grid;gap:6px">
          <span style="font-size:12px;font-weight:800;color:#475569">Telefone</span>
          <input id="driverEditPhone" type="tel" inputmode="numeric" maxlength="15" style="padding:13px;border:1px solid #cbd5e1;border-radius:12px;font:inherit">
        </label>
        <label style="display:grid;gap:6px">
          <span style="font-size:12px;font-weight:800;color:#475569">E-mail</span>
          <input id="driverEditEmail" type="email" maxlength="160" style="padding:13px;border:1px solid #cbd5e1;border-radius:12px;font:inherit">
        </label>
      </div>

      <button id="saveDriverProfile" type="button" class="btn primary full" style="margin-top:18px">
        <i class="fa-solid fa-floppy-disk"></i> Salvar alterações
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#closeDriverEditProfile").onclick=closeDriverEditProfile;
  modal.onclick=e=>{if(e.target===modal)closeDriverEditProfile()};

  const readImage=input=>{
    const file=input.files&&input.files[0];
    if(!file)return;
    if(file.size>6*1024*1024){
      input.value="";
      return toast("Use uma foto de até 6 MB.");
    }

    const reader=new FileReader();
    reader.onload=()=>{
      state.profileImageData=String(reader.result||"");
      renderDriverEditProfileAvatar();
    };
    reader.readAsDataURL(file);
  };

  modal.querySelector("#driverProfileGalleryInput").onchange=e=>readImage(e.target);
  modal.querySelector("#driverProfileCameraInput").onchange=e=>readImage(e.target);
  modal.querySelector("#saveDriverProfile").onclick=saveDriverProfile;

  return modal;
}

function renderDriverEditProfileAvatar(){
  const modal=ensureDriverEditProfile();
  const box=modal.querySelector("#driverEditProfileAvatar");
  const preview=String(state.profileImageData||"").trim();
  const current=currentDriverPhotoUrl();
  const src=preview||current;

  box.innerHTML=src
    ?`<img data-driver-avatar data-size="96" src="${src.startsWith("data:")?src:safeDriverPhotoUrl(src)}" alt="Foto de perfil" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:5px solid #eef2ff">`
    :`<span style="width:96px;height:96px;border-radius:50%;display:grid;place-items:center;background:#eef3ff;color:#0646c8;font-size:38px;border:5px solid #f8fafc"><i class="fa-solid fa-user"></i></span>`;
  bindAvatarFallback(box);
}

function openDriverEditProfile(){
  const modal=ensureDriverEditProfile();
  const d=state.driver||{};

  state.profileImageData="";
  modal.querySelector("#driverEditName").value=d.name||"";
  modal.querySelector("#driverEditPhone").value=d.whatsapp||"";
  modal.querySelector("#driverEditEmail").value=d.email||"";
  modal.querySelector("#driverProfileGalleryInput").value="";
  modal.querySelector("#driverProfileCameraInput").value="";

  renderDriverEditProfileAvatar();
  modal.style.display="flex";
  document.body.style.overflow="hidden";
}

function closeDriverEditProfile(){
  const modal=document.getElementById("driverEditProfileModal");
  if(modal)modal.style.display="none";
  state.profileImageData="";
  document.body.style.overflow="";
}

async function saveDriverProfile(){
  const modal=ensureDriverEditProfile();
  const btn=modal.querySelector("#saveDriverProfile");

  const name=modal.querySelector("#driverEditName").value.trim();
  const whatsapp=modal.querySelector("#driverEditPhone").value.replace(/\D/g,"");
  const emailValue=modal.querySelector("#driverEditEmail").value.trim().toLowerCase();

  if(!name)return toast("Informe seu nome.");
  if(!whatsapp)return toast("Informe seu telefone.");
  if(!emailValue)return toast("Informe seu e-mail.");

  btn.disabled=true;
  btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  try{
    const j=await api("driverUpdateProfile",{
      profile:{
        name,
        whatsapp,
        email:emailValue,
        imageData:state.profileImageData||""
      }
    },{timeout:20000});

    if(j&&j.driver){
      state.driver=j.driver;

      // Compatibilidade com diferentes nomes de campo retornados pelo backend.
      if(!state.driver.photoUrl){
        state.driver.photoUrl=
          state.driver.profilePhotoUrl ||
          state.driver.fotoPerfilUrl ||
          state.driver.FOTO_PERFIL_URL ||
          "";
      }
    }

    sessionStorage.setItem(
      "pl_mob_driver",
      JSON.stringify({driver:state.driver,token:state.token})
    );

    const firstName=driverFirstName();
    welcomeName.textContent=`Olá, ${firstName}!`;
    driverInfo.textContent=`${state.driver.plate||"Sem placa"} • ${state.driver.whatsapp||""}`;
    withdrawEmail.value=state.driver.email||"";

    renderDriverProfileButton();
    renderDriverProfileMenu();
    renderDriverScoreSheet();

    closeDriverEditProfile();
    toast("Perfil atualizado!");
    state.revision="";
    setTimeout(()=>dashboard(false),100);
  }catch(e){
    toast(e.message||"Não foi possível atualizar o perfil.");
  }finally{
    btn.disabled=false;
    btn.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Salvar alterações';
  }
}

async function performDriverLogout(){
  closeDriverProfileMenu();
  try{await api("logout",{}, {timeout:5000,noRetry:true})}catch(e){}

  clearInterval(state.dashboardTimer);
  clearInterval(state.statusTimer);
  sessionStorage.removeItem("pl_mob_driver");

  state.driver=null;
  state.token="";
  state.revision="";
  password.value="";
  show("loginView");
  renderQuickDriverAccount();
}


const DRIVER_AVAILABILITY_KEY="pl_mob_driver_online_status";

function ensureDriverStatusButton(){
  let btn=document.getElementById("driverStatusBtn");
  if(btn)return btn;

  const refresh=document.getElementById("refreshBtn");
  if(!refresh||!refresh.parentElement)return null;

  btn=document.createElement("button");
  btn.id="driverStatusBtn";
  btn.type="button";
  btn.title="Alterar disponibilidade";
  btn.setAttribute("aria-label","Alterar disponibilidade");

  btn.style.cssText=`
    height:38px;
    padding:0 12px;
    border:1px solid #cbd5e1;
    border-radius:12px;
    background:#e2e8f0;
    color:#475569;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:6px;
    font-size:12px;
    font-weight:900;
    cursor:pointer;
    white-space:nowrap;
    transition:background .18s ease,color .18s ease,border-color .18s ease;
  `;

  refresh.parentElement.insertBefore(btn,refresh);
  btn.onclick=toggleDriverOnlineStatus;
  return btn;
}

function renderDriverOnlineStatus(){
  const btn=ensureDriverStatusButton();
  if(!btn)return;

  const online=!!state.driverOnline;
  btn.innerHTML=online
    ?'<i class="fa-solid fa-motorcycle"></i><span>ON</span>'
    :'<i class="fa-solid fa-motorcycle"></i><span>OFF</span>';

  btn.style.background=online?"#16a34a":"#e2e8f0";
  btn.style.borderColor=online?"#16a34a":"#cbd5e1";
  btn.style.color=online?"#ffffff":"#475569";
}


function driverHasActiveTripLocal(){
  return state.trips.some(t=>{
    const status=String(t&&t.status||"").trim().toUpperCase();
    return ![
      "FINALIZADA",
      "CANCELADA PELO ENTREGADOR",
      "CANCELADA"
    ].includes(status);
  });
}

async function toggleDriverOnlineStatus(){
  const btn=ensureDriverStatusButton();
  if(!btn||btn.disabled)return;

  const previous=!!state.driverOnline;
  const next=!previous;

  if(!next && driverHasActiveTripLocal()){
    toast("Você possui uma viagem ativa. Finalize ou cancele a viagem antes de ficar OFF.");
    state.driverOnline=true;
    renderDriverOnlineStatus();
    return;
  }

  btn.disabled=true;
  btn.style.opacity=".75";
  btn.style.cursor="wait";
  btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i><span>Carregando...</span>';

  try{
    const j=await api("driverSetOnlineStatus",{
      status:next?"ONLINE":"OFFLINE"
    },{timeout:12000});

    const serverStatus=String(
      j&&j.driver&&j.driver.status || (next?"ONLINE":"OFFLINE")
    ).toUpperCase();

    if(j&&j.driver)state.driver=j.driver;
    state.driverOnline=serverStatus==="ONLINE";

    localStorage.setItem(
      DRIVER_AVAILABILITY_KEY,
      String(state.driverOnline)
    );

    renderDriverOnlineStatus();
    renderDriverProfileButton();

    try{
      sessionStorage.setItem(
        "pl_mob_driver",
        JSON.stringify({driver:state.driver,token:state.token})
      );
    }catch(e){}

    if(state.driverOnline){
      toast("Você está ON e disponível.");
      state.revision="";
      setTimeout(()=>dashboard(false),50);
    }else{
      if(typeof closeRequestsDrawer==="function")closeRequestsDrawer();
      if(typeof requestBadge!=="undefined"&&requestBadge){
        requestBadge.classList.add("hide");
      }
      toast("Você está OFF.");
    }
  }catch(e){
    state.driverOnline=previous;
    renderDriverOnlineStatus();
    toast(e.message||"Não foi possível alterar seu status.");
    state.revision="";
    setTimeout(()=>dashboard(false),100);
  }finally{
    btn.disabled=false;
    btn.style.opacity="1";
    btn.style.cursor="pointer";
    renderDriverOnlineStatus();
  }
}




async function syncDriverOnlineStatus(){
  if(!state.driver||!state.token||state.statusBusy||document.hidden||!navigator.onLine)return;

  state.statusBusy=true;
  try{
    const j=await api("driverStatus",{},{
      timeout:8000,
      noRetry:true
    });

    const serverOnline=
      String(j&&j.status||"OFFLINE").toUpperCase()==="ONLINE" ||
      !!(j&&j.hasActiveTrip);

    const changed=serverOnline!==state.driverOnline;

    state.driverOnline=serverOnline;

    if(state.driver){
      state.driver.status=serverOnline?"ONLINE":"OFFLINE";
      if(j&&j.score!==undefined)state.driver.score=j.score;
      if(j&&j.level)state.driver.level=j.level;
    }

    localStorage.setItem(
      DRIVER_AVAILABILITY_KEY,
      String(serverOnline)
    );

    renderDriverOnlineStatus();

    if(changed&&serverOnline){
      state.revision="";
      dashboard(false);
    }

    if(changed&&!serverOnline){
      if(typeof closeRequestsDrawer==="function")closeRequestsDrawer();
      if(typeof requestBadge!=="undefined"&&requestBadge){
        requestBadge.classList.add("hide");
      }
    }
  }catch(e){
    // Sincronização silenciosa: não trava a interface e não exibe erro repetitivo.
  }finally{
    state.statusBusy=false;
  }
}

function startDriverStatusSync(){
  clearInterval(state.statusTimer);

  // Confere rapidamente ao entrar.
  setTimeout(()=>syncDriverOnlineStatus(),500);

  // Consulta leve só do STATUS, sem carregar dashboard completo.
  state.statusTimer=setInterval(()=>{
    if(!state.statusBusy)syncDriverOnlineStatus();
  },2000);
}

function keepDriverTopNavSingleRow(){
  const clickable=[...document.querySelectorAll("button,a,[role='button']")];
  const saque=clickable.find(el=>String(el.textContent||"").trim().toLowerCase().includes("saque"));
  const historico=clickable.find(el=>{
    const txt=String(el.textContent||"").trim().toLowerCase();
    return txt.includes("histórico")||txt.includes("historico");
  });

  if(!saque||!historico||!saque.parentElement||saque.parentElement!==historico.parentElement)return;

  const nav=saque.parentElement;

  // Mantém os 4 itens da navegação em uma única fila.
  nav.style.display="flex";
  nav.style.flexDirection="row";
  nav.style.flexWrap="nowrap";
  nav.style.alignItems="center";
  nav.style.justifyContent="space-between";
  nav.style.gap="4px";
  nav.style.width="100%";

  [...nav.children].forEach(item=>{
    item.style.flex="1 1 0";
    item.style.minWidth="0";
  });

  // Compacta apenas o necessário em telas menores para Histórico não cair.
  if(window.innerWidth<=520){
    [...nav.children].forEach(item=>{
      item.style.paddingLeft="5px";
      item.style.paddingRight="5px";
      item.style.fontSize="11px";
      item.style.whiteSpace="nowrap";
    });
  }
}

function ensureDriverScoreNav(){
  if(document.getElementById("driverScoreNavBtn"))return;

  /* Procura os itens existentes "Saque" e "Histórico" sem alterar nenhum deles. */
  const clickable=[...document.querySelectorAll("button,a,[role='button']")];
  const saque=clickable.find(el=>String(el.textContent||"").trim().toLowerCase().includes("saque"));
  const historico=clickable.find(el=>{
    const txt=String(el.textContent||"").trim().toLowerCase();
    return txt.includes("histórico")||txt.includes("historico");
  });

  if(!saque||!historico||!saque.parentElement||saque.parentElement!==historico.parentElement)return;

  const score=document.createElement(saque.tagName.toLowerCase()==="a"?"a":"button");
  score.id="driverScoreNavBtn";
  if(score.tagName==="BUTTON")score.type="button";
  if(score.tagName==="A")score.href="#";

  /* Herda as classes do botão Saque para manter exatamente o padrão visual da nav. */
  score.className=saque.className;
  score.innerHTML='<i class="fa-solid fa-star"></i><span>Score</span>';
  score.title="Score do motorista";

  saque.parentElement.insertBefore(score,historico);
  keepDriverTopNavSingleRow();

  score.addEventListener("click",e=>{
    e.preventDefault();
    openDriverScoreSheet();
  });
}

function driverLevelStyle(level){
  level=String(level||"BRONZE").toUpperCase();
  const styles={
    BRONZE:{icon:"fa-medal",label:"Bronze",bg:"#fff7ed",color:"#9a4f16",ring:"#b86b32"},
    PRATA:{icon:"fa-medal",label:"Prata",bg:"#f1f5f9",color:"#64748b",ring:"#94a3b8"},
    OURO:{icon:"fa-trophy",label:"Ouro",bg:"#fffbeb",color:"#b77900",ring:"#eab308"},
    DIAMANTE:{icon:"fa-gem",label:"Diamante",bg:"#eff6ff",color:"#075bd8",ring:"#0ea5e9"}
  };
  return styles[level]||styles.BRONZE;
}

function ensureDriverScoreSheet(){
  let sheet=document.getElementById("driverScoreSheet");
  if(sheet)return sheet;

  sheet=document.createElement("div");
  sheet.id="driverScoreSheet";
  sheet.style.cssText=`
    position:fixed;
    inset:0;
    z-index:1000;
    display:none;
    align-items:flex-end;
    justify-content:center;
    background:rgba(15,23,42,.52);
    padding:12px;
  `;

  sheet.innerHTML=`
    <div id="driverScoreContent" style="
      width:min(100%,600px);
      max-height:92vh;
      overflow:auto;
      background:#fff;
      border-radius:26px 26px 18px 18px;
      padding:22px;
      box-shadow:0 -16px 48px rgba(15,23,42,.24);
    "></div>
  `;

  document.body.appendChild(sheet);
  sheet.addEventListener("click",e=>{
    if(e.target===sheet)closeDriverScoreSheet();
  });
  return sheet;
}

function renderDriverScoreSheet(){
  const sheet=document.getElementById("driverScoreSheet");
  if(!sheet)return;

  const content=sheet.querySelector("#driverScoreContent");
  if(!content)return;

  const d=state.driver||{};
  const score=Math.max(0,Number(d.score||0));
  const reviews=Math.max(0,Number(d.reviews||0));
  const rating=Math.max(0,Number(d.averageRating||0));
  const level=String(d.level||"BRONZE").toUpperCase();
  const style=driverLevelStyle(level);
  const progress=Math.max(0,Math.min(100,Number(d.levelProgress||0)));
  const scoreToNext=Math.max(0,Number(d.scoreToNext||0));
  const next=String(d.nextLevel||"").toUpperCase();
  const online=String(d.status||"OFFLINE").toUpperCase()==="ONLINE";
  const shift=String(d.shift||"MANHA,TARDE,NOITE")
    .replace(/MANHA/g,"Manhã")
    .replace(/TARDE/g,"Tarde")
    .replace(/NOITE/g,"Noite")
    .replace(/,/g," • ");

  content.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="
          width:46px;height:46px;border-radius:15px;
          display:inline-flex;align-items:center;justify-content:center;
          background:${style.bg};color:${style.color};font-size:20px;
        ">
          <i class="fa-solid ${style.icon}"></i>
        </span>
        <div>
          <small style="display:block;color:#64748b;margin-bottom:2px">Desempenho do motorista</small>
          <strong style="font-size:21px;color:#0f172a">Seu Score</strong>
        </div>
      </div>

      <button id="closeDriverScoreSheet" type="button" style="
        width:40px;height:40px;border:0;border-radius:50%;
        background:#f1f5f9;color:#334155;cursor:pointer;font-size:18px;
      " aria-label="Fechar">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div style="
      padding:22px;border-radius:22px;
      background:linear-gradient(145deg,#07133b,#0029ff);
      color:#fff;margin-bottom:16px;position:relative;overflow:hidden;
    ">
      <div style="display:flex;justify-content:space-between;gap:18px;align-items:center">
        <div>
          <span style="
            display:inline-flex;align-items:center;gap:7px;
            padding:7px 11px;border-radius:999px;
            background:rgba(255,255,255,.14);font-size:12px;font-weight:900;
          ">
            <i class="fa-solid ${style.icon}"></i> NÍVEL ${style.label.toUpperCase()}
          </span>
          <div style="font-size:44px;font-weight:950;line-height:1;margin-top:15px">${score}</div>
          <small style="color:rgba(255,255,255,.78)">pontos de Score</small>
        </div>

        <div style="
          width:112px;height:112px;border-radius:50%;
          background:conic-gradient(#ffffff ${progress}%,rgba(255,255,255,.18) 0);
          display:grid;place-items:center;
        ">
          <div style="
            width:88px;height:88px;border-radius:50%;
            background:#0629bd;display:grid;place-items:center;text-align:center;
          ">
            <div>
              <strong style="display:block;font-size:22px">${progress}%</strong>
              <small style="font-size:10px;color:rgba(255,255,255,.75)">PROGRESSO</small>
            </div>
          </div>
        </div>
      </div>

      ${next?`
      <div style="margin-top:18px">
        <div style="height:8px;border-radius:999px;background:rgba(255,255,255,.18);overflow:hidden">
          <div style="width:${progress}%;height:100%;background:#fff;border-radius:999px"></div>
        </div>
        <small style="display:block;margin-top:7px;color:rgba(255,255,255,.82)">
          Faltam <strong>${scoreToNext} pontos</strong> para o nível ${next}.
        </small>
      </div>`:`
      <div style="margin-top:18px;font-weight:800">
        Você está no nível máximo. Continue mantendo seu desempenho.
      </div>`}
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:16px">
      <div style="padding:14px 10px;border:1px solid #e2e8f0;border-radius:16px;text-align:center;background:#f8fafc">
        <i class="fa-solid fa-star" style="color:#f59e0b"></i>
        <strong style="display:block;font-size:19px;margin-top:5px">${rating?rating.toFixed(1):"—"}</strong>
        <small style="color:#64748b">Média</small>
      </div>
      <div style="padding:14px 10px;border:1px solid #e2e8f0;border-radius:16px;text-align:center;background:#f8fafc">
        <i class="fa-solid fa-comment-dots" style="color:#0029ff"></i>
        <strong style="display:block;font-size:19px;margin-top:5px">${reviews}</strong>
        <small style="color:#64748b">Avaliações</small>
      </div>
      <div style="padding:14px 10px;border:1px solid #e2e8f0;border-radius:16px;text-align:center;background:#f8fafc">
        <i class="fa-solid fa-motorcycle" style="color:${online?"#16a34a":"#64748b"}"></i>
        <strong style="display:block;font-size:14px;margin-top:6px;color:${online?"#16a34a":"#64748b"}">${online?"ONLINE":"OFFLINE"}</strong>
        <small style="color:#64748b">Status</small>
      </div>
    </div>

    <div style="padding:15px;border:1px solid #dbe7ff;border-radius:16px;background:#f8fbff;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:9px">
        <i class="fa-solid fa-clock" style="color:#0029ff"></i>
        <div>
          <small style="display:block;color:#64748b">Seu turno de mobilidade</small>
          <strong style="color:#172033">${shift}</strong>
        </div>
      </div>
    </div>

    <div style="padding:18px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:14px">
        <span style="width:36px;height:36px;border-radius:11px;background:#e8f0ff;color:#0029ff;display:grid;place-items:center">
          <i class="fa-solid fa-arrow-trend-up"></i>
        </span>
        <div>
          <strong style="display:block;color:#0f172a">Como aumentar seu Nível/Score?</strong>
          <small style="color:#64748b">Boas ações aumentam sua pontuação.</small>
        </div>
      </div>

      <div style="display:grid;gap:10px">
        <div style="display:flex;gap:10px"><span style="color:#16a34a"><i class="fa-solid fa-circle-check"></i></span><span>Entre todos os dias e fique <strong>online no seu turno</strong>.</span></div>
        <div style="display:flex;gap:10px"><span style="color:#16a34a"><i class="fa-solid fa-circle-check"></i></span><span>Aceite viagems disponíveis <strong>dentro do seu turno</strong>.</span></div>
        <div style="display:flex;gap:10px"><span style="color:#16a34a"><i class="fa-solid fa-bolt"></i></span><span>Aceitar novas viagems rapidamente pode render mais Score.</span></div>
        <div style="display:flex;gap:10px"><span style="color:#16a34a"><i class="fa-solid fa-star"></i></span><span>Boas avaliações ajudam você a subir de nível.</span></div>
        <div style="display:flex;gap:10px"><span style="color:#dc2626"><i class="fa-solid fa-circle-minus"></i></span><span>Cancelar sem justificativa reduz seu Score.</span></div>
        <div style="display:flex;gap:10px"><span style="color:#dc2626"><i class="fa-solid fa-circle-minus"></i></span><span>Ficar online e ignorar viagems disponíveis também pode reduzir sua pontuação.</span></div>
      </div>
    </div>

    <div style="margin-top:14px;padding:14px;border-radius:15px;background:#fff7ed;border:1px solid #fed7aa;color:#9a4f16">
      <strong><i class="fa-solid fa-gift"></i> Bônus de nível</strong>
      <p style="margin:5px 0 0;font-size:13px;line-height:1.45">
        Conforme seu nível aumenta, você pode receber mais oportunidades de corridas e bônus maiores em viagems selecionadas. Os bônus não aparecem em todas as viagens.
      </p>
    </div>
  `;

  content.querySelector("#closeDriverScoreSheet").onclick=closeDriverScoreSheet;
}

function openDriverScoreSheet(){
  const sheet=ensureDriverScoreSheet();
  renderDriverScoreSheet();
  sheet.style.display="flex";
  document.body.style.overflow="hidden";
}

function closeDriverScoreSheet(){
  const sheet=document.getElementById("driverScoreSheet");
  if(sheet)sheet.style.display="none";
  document.body.style.overflow="";
}

function openApp(driver,token){
  state.driver=driver;
  state.token=token||state.token;
  state.revision="";

  // Mantém apenas a sessão atual. A conta rápida é salva separadamente.
  sessionStorage.setItem(
    "pl_mob_driver",
    JSON.stringify({driver,token:state.token})
  );

  const firstName=String(driver.name||"").trim().split(/\s+/)[0]||"Motorista";
  welcomeName.textContent=`Olá, ${firstName}!`;
  driverInfo.textContent=`${driver.plate||"Sem placa"} • ${driver.whatsapp||""}`;
  withdrawEmail.value=driver.email||"";
  show("appView");
  state.driverOnline=String(driver.status||"OFFLINE").toUpperCase()==="ONLINE";
  localStorage.setItem(DRIVER_AVAILABILITY_KEY,String(state.driverOnline));
  renderDriverOnlineStatus();
  renderDriverProfileButton();
  ensureDriverScoreNav();

  // Mostra ON/OFF imediatamente e sincroniza com a planilha em segundo plano.
  startDriverStatusSync();
  dashboard();
  startDriverPolling();
}
async function dashboard(useLoading=false){
  if(state.dashboardBusy)return;
  state.dashboardBusy=true;
  const load=()=>api("driverDashboard",{sinceRevision:state.revision},{timeout:8000,noRetry:true});
  try{
    const j=useLoading
      ?await withActionLoading("Atualizando viagems","Buscando saldos, corridas e pagamentos.",load)
      :await load();
    if(j.unchanged)return;
    state.revision=String(j.revision||state.revision||"");
    if(j.driver){
      state.driver=j.driver;

      if(!state.driver.photoUrl){
        state.driver.photoUrl=
          state.driver.profilePhotoUrl ||
          state.driver.fotoPerfilUrl ||
          state.driver.FOTO_PERFIL_URL ||
          "";
      }
      state.driverOnline=String(j.driver.status||"OFFLINE").toUpperCase()==="ONLINE";
      localStorage.setItem(DRIVER_AVAILABILITY_KEY,String(state.driverOnline));
      renderDriverOnlineStatus();
      renderDriverProfileButton();
    }
    state.trips=j.trips||[];
    state.availableTrips=j.availableTrips||[];
    balance.textContent=state.balanceVisible?money.format(j.driver.balance||0):"R$ •••••";
    discountBadge.textContent=`Taxa da plataforma: ${Number(j.driver.feePercent||20)}%`;
    balanceInfo.textContent=state.driver&&state.driver.autoDiscount===false
      ?"Você recebe o valor integral das corridas."
      :"Seu saldo mostra o valor líquido das corridas após a taxa da plataforma. Bônus, quando houver, é somado separadamente.";
    tripCount.textContent=`${state.trips.filter(t=>!["FINALIZADA","CANCELADA PELO ENTREGADOR"].includes(String(t.status).toUpperCase())).length} viagem(ns)`;
    renderDriverOnlineStatus();
    renderDriverScoreSheet();
    renderTrips();renderHistory();renderAvailableTrips()
  }catch(x){
    const msg=String(x&&x.message||"");
    if(useLoading || !/demorou demais/i.test(msg)){
      toast(msg);
    }
  }
  finally{state.dashboardBusy=false}
}
function startDriverPolling(){
  clearInterval(state.dashboardTimer);
  state.dashboardTimer=setInterval(()=>{
    if(
      state.driver &&
      state.driverOnline &&
      !state.dashboardBusy &&
      !document.hidden &&
      navigator.onLine
    ){
      dashboard(false);
    }
  },2000);
}
document.addEventListener("visibilitychange",()=>{
  if(document.hidden||!state.driver)return;
  syncDriverOnlineStatus();
  if(state.driverOnline)dashboard(false);
});
window.addEventListener("online",()=>{if(state.driver){toast("Conexão restabelecida.");dashboard(false)}});
window.addEventListener("offline",()=>toast("Você está sem internet. O painel atualizará ao reconectar."));

function driverBaseNetValue(t){
  const gross=Math.max(0,Number(t&&t.value||0));

  // Se o desconto automático estiver INATIVO, recebe o valor cheio.
  if(state.driver&&state.driver.autoDiscount===false){
    return gross;
  }

  const feePercent=Math.max(
    0,
    Math.min(100,Number(state.driver&&state.driver.feePercent||20))
  );

  return Math.max(0,Math.round((gross*(1-feePercent/100))*100)/100);
}

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
      <div style="text-align:right">
        <div class="trip-price">${money.format(driverBaseNetValue(t))}</div>
        ${Number(t.bonus||0)>0?`<small style="display:block;color:#16a34a;font-weight:900">+ bônus ${money.format(t.bonus)}</small>`:""}
      </div>
      <button class="card-menu-btn" onclick="toggleTripCommands('${t.code}')" title="Comandos da corrida">
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>
  </div>
  ${tripPeopleInfo(t)}
  <div class="route">
    <div class="route-line"><div class="dot"><i class="fa-solid fa-circle"></i></div><div class="dot" style="margin-top:30px"><i class="fa-solid fa-flag-checkered"></i></div></div>
    <div><strong>${t.originNeighborhood}</strong><span>${t.origin}</span><strong style="margin-top:18px">${t.destinationNeighborhood}</strong><span>${t.destination}</span></div>
  </div>
  <div class="meta">
    <span><i class="fa-solid fa-user"></i> Passageiro</span>
    <span>${t.tripType||"VIAGEM"}</span>
    <span>Pagamento: ${paymentReady?t.paymentStatus:"Não informado"}</span>
  </div>
  <div class="card-command-menu" id="tripCommands-${t.code}">
    <button class="btn secondary" onclick="updateTrip('${t.code}','FINALIZANDO CORRIDA PRÓXIMA')"><i class="fa-solid fa-motorcycle"></i> Finalizando viagem próxima</button>
    <button class="btn primary" onclick="updateTrip('${t.code}','ESTOU INDO')"><i class="fa-solid fa-motorcycle"></i> Estou indo buscar passageiro</button>
    <button class="btn success-btn" onclick="alertCustomer('${t.code}')"><i class="fa-brands fa-whatsapp"></i> Avisar passageiro</button>
    <button class="btn danger-btn" onclick="reportLocationError('${t.code}')"><i class="fa-solid fa-triangle-exclamation"></i> Erro na localização</button>
  </div>
  <div class="controls">
    <button class="btn outline wide" onclick="openPayment('${t.code}',${Number(t.value)})"><i class="fa-solid fa-money-bill-wave"></i> Informar pagamento</button>
    ${paymentReady?`<button class="btn success-btn wide" onclick="finalizeTrip('${t.code}')"><i class="fa-solid fa-flag-checkered"></i> Finalizar corrida</button>`:""}
    <button class="btn danger-btn wide" onclick="cancelTrip('${t.code}')"><i class="fa-solid fa-ban"></i> Cancelar corrida</button>
  </div>
</article>`}).join(""):`<div class="empty">Nenhuma viagem ativa. Veja as novas solicitações no botão da moto ou use o botão +.</div>`;

  requestAnimationFrame(()=>{tripCarousel.scrollLeft=0});
}
function renderHistory(){
  const done=state.trips.filter(t=>String(t.status).toUpperCase()==="FINALIZADA");
  historyList.innerHTML=done.length?done.map(t=>`
    <div class="trip-card" style="margin-bottom:10px">
      <div class="trip-top">
        <div class="trip-code">${t.code}</div>
        <div style="text-align:right">
          <div class="trip-price">${money.format(driverBaseNetValue(t))}</div>
          ${Number(t.bonus||0)>0?`<small style="display:block;color:#16a34a;font-weight:900">+ bônus ${money.format(t.bonus)}</small>`:""}
        </div>
      </div>
      ${tripPeopleInfo(t)}
      <p class="muted">${t.originNeighborhood} → ${t.destinationNeighborhood}</p>
      <span class="status">${t.paymentStatus}</span>
    </div>
  `).join(""):`<div class="empty">Nenhuma viagem finalizada.</div>`;
}
manualAddTripBtn.onclick=()=>{tripCodeInput.value="";openL("addTripSheet")}
newRequestsBtn.onclick=()=>{openRequestsDrawer()}
closeRequestsBtn.onclick=()=>closeRequestsDrawer()
requestsDrawer.onclick=e=>{if(e.target===requestsDrawer)closeRequestsDrawer()}
async function openRequestsDrawer(){
  if(!state.driverOnline){
    toast("Você está OFF. Ative o status ON para receber novas corridas.");
    return;
  }

  requestsDrawer.classList.add("on");

  try{
    state.revision="";
    await dashboard(false);
    renderAvailableTrips();
  }catch(e){
    toast(e.message||"Não foi possível carregar as corridas.");
  }
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
  if(!state.driverOnline){
    state.lastAvailableCount=0;
    requestBadge.textContent="0";
    requestBadge.classList.add("hide");
    requestsList.innerHTML='<div class="empty">Você está OFF. Ative o botão 🏍 ON no topo para receber novas solicitações.</div>';
    return;
  }

  const available=[...state.availableTrips].sort(
    (a,b)=>Number(a.createdMs||a.createdAtMs||0)-Number(b.createdMs||b.createdAtMs||0)
  );

  if(state.lastAvailableCount!==0 && available.length>state.lastAvailableCount){
    playNewTripSound();
  }

  state.lastAvailableCount=available.length;
  requestBadge.textContent=available.length>99?"99+":String(available.length);
  requestBadge.classList.toggle("hide",available.length===0);

  requestsList.innerHTML=available.length?available.map(t=>{
    const data=normalizedTrip(t);

    return `
    <article class="request-card">
      <div class="trip-top">
        <div>
          <div class="trip-code">${escapeCardText(data.code)}</div>
          <span class="request-new">Nova viagem</span>
        </div>
        <div style="text-align:right">
          <div class="trip-price">${money.format(driverBaseNetValue({...t,value:data.value}))}</div>
          <small style="display:block;color:#64748b;font-size:10px">valor líquido para você</small>
          ${Number(t.bonus||0)>0?`<span style="display:inline-block;margin-top:4px;padding:4px 7px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:10px;font-weight:900">+ BÔNUS ${money.format(t.bonus)}</span>`:""}
        </div>
      </div>

      ${tripPeopleInfo(t)}

      <div class="route">
        <div class="route-line">
          <div class="dot"><i class="fa-solid fa-circle"></i></div>
          <div class="dot" style="margin-top:30px"><i class="fa-solid fa-flag-checkered"></i></div>
        </div>

        <div>
          <strong>${escapeCardText(data.originNeighborhood)}</strong>
          <span>${escapeCardText(data.origin)}</span>

          <strong style="margin-top:18px">${escapeCardText(data.destinationNeighborhood)}</strong>
          <span>${escapeCardText(data.destination)}</span>
        </div>
      </div>

      <div class="meta">
        <span><i class="fa-solid fa-user"></i> Passageiro</span>
        <span>${escapeCardText(data.tripType)}</span>
      </div>

      <button class="btn primary full" onclick="acceptAvailableTrip('${escapeCardText(data.code)}')">
        <i class="fa-solid fa-check"></i> Aceitar corrida
      </button>
    </article>`;
  }).join(""):`<div class="empty">Nenhuma nova viagem disponível neste momento.</div>`;
}

function applyAcceptedTripImmediately(j,code){
  if(!j||!j.trip)return;

  const trip=j.trip;

  state.availableTrips=state.availableTrips.filter(
    t=>String(t.code)!==String(code)
  );

  const exists=state.trips.some(
    t=>String(t.code)===String(trip.code)
  );

  if(!exists)state.trips.unshift(trip);

  renderAvailableTrips();
  renderTrips();

  if(typeof requestBadge!=="undefined"&&requestBadge){
    const count=state.availableTrips.length;
    requestBadge.textContent=String(count);
    requestBadge.classList.toggle("hide",count<=0);
  }
}

function patchTripImmediately(code,patch){
  const trip=state.trips.find(t=>String(t.code)===String(code));
  if(!trip)return;
  Object.assign(trip,patch||{});
  renderTrips();
  renderHistory();
}

async function acceptAvailableTrip(code){
  try{
    const j=await withActionLoading(
      "Aceitando viagem",
      "Confirmando a disponibilidade.",
      ()=>api("driverAcceptTrip",{driverId:state.driver.id,code},{timeout:10000})
    );

    applyAcceptedTripImmediately(j,code);
    playAcceptSound();

    closeRequestsDrawer();
    openL("acceptedModal");
    setTimeout(()=>closeL("acceptedModal"),1400);

    if(j.notifyWhatsapp&&j.phone&&confirm("Deseja avisar o cliente pelo WhatsApp que a corrida foi aceita?")){
      wa(j.phone,j.message);
    }

    state.revision="";
    setTimeout(()=>dashboard(false),120);
  }catch(x){
    toast(x.message);
    state.revision="";
    setTimeout(()=>dashboard(false),150);
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
  if(!code)return toast("Informe o código do viagem.");

  acceptTripBtn.disabled=true;

  try{
    const j=await withActionLoading(
      "Aceitando viagem",
      "Confirmando o código.",
      ()=>api("driverAcceptTrip",{driverId:state.driver.id,code},{timeout:10000})
    );

    applyAcceptedTripImmediately(j,code);
    closeL("addTripSheet");
    playAcceptSound();

    openL("acceptedModal");
    setTimeout(()=>closeL("acceptedModal"),1400);

    if(j.notifyWhatsapp&&j.phone&&confirm("Deseja avisar o cliente pelo WhatsApp que a corrida foi aceita?")){
      wa(j.phone,j.message);
    }

    state.revision="";
    setTimeout(()=>dashboard(false),120);
  }catch(x){
    toast(x.message);
  }finally{
    acceptTripBtn.disabled=false;
  }
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

function customerStatusMessage(status,trip){
  const s=String(status||"").trim().toUpperCase();
  const code=String(trip&&trip.code||"").trim();
  const prefix=code?`Viagem ${code}: `:"";

  if(s==="FINALIZANDO CORRIDA PRÓXIMA"){
    return `${prefix}o motorista está finalizando uma viagem próxima e em seguida seguirá até seu ponto de partida.`;
  }
  if(s==="ESTOU INDO"){
    return `${prefix}o motorista está indo buscar você. Fique atento ao WhatsApp e, se necessário, envie sua localização atual.`;
  }
  return "";
}
async function updateTrip(code,status){
  try{
    const tripBeforeUpdate=state.trips.find(t=>String(t.code)===String(code));

    const j=await withActionLoading(
      "Atualizando situação",
      `${statusLabel(status)}.`,
      ()=>api("driverUpdateStatus",{driverId:state.driver.id,code,status},{timeout:9000})
    );

    patchTripImmediately(code,{status});
    toast(statusLabel(status));
    playUpdateSound();

    const normalizedStatus=String(status||"").toUpperCase();
    const requesterPhone=String(tripBeforeUpdate&&tripBeforeUpdate.requesterWhatsapp||"").trim();
    const notificationPhone=["FINALIZANDO CORRIDA PRÓXIMA","ESTOU INDO"].includes(normalizedStatus)
      ?requesterPhone
      :String(j.phone||"").trim();

    if(j.notifyWhatsapp&&notificationPhone){
      askWhatsappNotification(
        notificationPhone,
        customerStatusMessage(normalizedStatus,tripBeforeUpdate)||j.message
      );
    }

    state.revision="";
    setTimeout(()=>dashboard(false),100);
  }catch(x){
    toast(x.message);
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
    patchTripImmediately(state.currentPaymentCode,{
      paymentStatus,
      paymentDefined:true
    });
    setTimeout(()=>closeL("paymentSheet"),650);
    state.revision="";
    setTimeout(()=>dashboard(false),100)
  }catch(x){toast(x.message)}
  finally{paidBtn.disabled=pendingBtn.disabled=false}
}
async function finalizeTrip(code){
  if(!confirm("Confirma que a viagem foi concluída e deseja finalizar esta corrida?"))return;

  const tripBeforeFinalize=state.trips.find(
    t=>String(t.code)===String(code)
  );

  try{
    const j=await withActionLoading(
      "Finalizando viagem",
      "Calculando seu ganho e atualizando o saldo.",
      ()=>api("driverFinalizeTrip",{driverId:state.driver.id,code})
    );

    toast("Viagem finalizada com sucesso.");

    // Ao finalizar, avisa sempre quem SOLICITOU a viagem.
    const requesterPhone=String(
      tripBeforeFinalize&&tripBeforeFinalize.requesterWhatsapp||""
    ).trim();

    const finalPhone=requesterPhone||String(j.phone||"").trim();

    if(
      j.notifyWhatsapp&&
      finalPhone&&
      confirm("Deseja avisar o solicitante pelo WhatsApp que a corrida foi finalizada?")
    ){
      const receiverName=String(
        tripBeforeFinalize&&(
          tripBeforeFinalize.receiverName||
          tripBeforeFinalize.recipientName
        )||"O destinatário"
      ).trim();
      const finalMessage=`Viagem finalizada! Obrigado por viajar com a Pega & Leva Mobilidade. 💙🏍️`;
      wa(finalPhone,finalMessage);
    }

    patchTripImmediately(code,{
      status:"FINALIZADA",
      driverValue:j.valorLiquido!==undefined?j.valorLiquido:undefined,
      bonus:j.bonus!==undefined?j.bonus:(tripBeforeFinalize&&tripBeforeFinalize.bonus||0)
    });

    if(state.driver&&j.saldoTotal!==undefined){
      state.driver.balance=Number(j.saldoTotal||0);
      balance.textContent=state.balanceVisible?money.format(state.driver.balance):"R$ •••••";
    }

    state.revision="";
    setTimeout(()=>dashboard(false),100);
  }catch(x){
    toast(x.message)
  }
}

function chooseCancellationReason(){
  return new Promise(resolve=>{
    let modal=document.getElementById("cancelReasonModal");

    if(!modal){
      modal=document.createElement("div");
      modal.id="cancelReasonModal";
      modal.style.cssText=`
        position:fixed;inset:0;z-index:1200;background:rgba(15,23,42,.55);
        display:none;align-items:flex-end;justify-content:center;padding:16px;
      `;

      modal.innerHTML=`
        <div style="width:min(100%,520px);background:#fff;border-radius:22px;padding:22px;box-shadow:0 -12px 45px rgba(15,23,42,.22)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px">
            <div>
              <small style="color:#64748b">Cancelamento</small>
              <h3 style="margin:2px 0 0;color:#0f172a">Qual o motivo?</h3>
            </div>
            <button id="cancelReasonClose" type="button" style="width:38px;height:38px;border:0;border-radius:50%;background:#f1f5f9;cursor:pointer">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div id="cancelReasonOptions" style="display:grid;gap:9px">
            ${[
              "Problema com a moto",
              "Problema de saúde ou emergência",
              "Endereço ou rota com problema",
              "Não consegui contato com o cliente",
              "Estabelecimento fechado",
              "Problema com a passageiro",
              "Outro"
            ].map(x=>`
              <button type="button" data-reason="${x}" style="
                width:100%;padding:13px 14px;border:1px solid #e2e8f0;border-radius:13px;
                background:#fff;color:#0f172a;text-align:left;font-weight:700;cursor:pointer
              ">${x}</button>
            `).join("")}
          </div>

          <div id="cancelReasonOtherWrap" style="display:none;margin-top:12px">
            <textarea id="cancelReasonOther" rows="3" maxlength="250"
              placeholder="Descreva o motivo..."
              style="width:100%;resize:none;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font:inherit;outline:none"></textarea>
            <button id="cancelReasonOtherConfirm" type="button" style="
              width:100%;margin-top:9px;padding:13px;border:0;border-radius:12px;
              background:#0029ff;color:#fff;font-weight:800;cursor:pointer
            ">Confirmar motivo</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.style.display="flex";
    document.body.style.overflow="hidden";

    const finish=value=>{
      modal.style.display="none";
      document.body.style.overflow="";
      resolve(value);
    };

    modal.querySelector("#cancelReasonClose").onclick=()=>finish(null);

    modal.querySelectorAll("[data-reason]").forEach(btn=>{
      btn.onclick=()=>{
        const reason=btn.dataset.reason;
        if(reason==="Outro"){
          modal.querySelector("#cancelReasonOptions").style.display="none";
          modal.querySelector("#cancelReasonOtherWrap").style.display="block";
          modal.querySelector("#cancelReasonOther").focus();
          return;
        }
        finish(reason);
      };
    });

    modal.querySelector("#cancelReasonOtherConfirm").onclick=()=>{
      const value=modal.querySelector("#cancelReasonOther").value.trim();
      if(!value)return toast("Informe o motivo do cancelamento.");
      finish("Outro: "+value);
    };

    modal.onclick=e=>{
      if(e.target===modal)finish(null);
    };
  });
}

async function cancelTrip(code){
  if(!confirm("Deseja cancelar esta corrida? Ela ficará disponível para outro motorista."))return;

  const justification=String(prompt(
    "Informe o motivo do cancelamento. Cancelar sem justificativa reduz mais o seu Score:",
    ""
  )||"").trim();

  try{
    const j=await withActionLoading(
      "Cancelando corrida",
      "Removendo a corrida do seu painel e liberando a viagem para outro motorista.",
      ()=>api("driverCancelTrip",{driverId:state.driver.id,code,justification})
    );
    toast(j.scorePenalty<=-10
      ?"Corrida cancelada. Seu Score foi reduzido por falta de justificativa."
      :"Viagem cancelada e liberada."
    );
    state.revision="";
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
historyNav.onclick=()=>openL("historySheet");refreshBtn.onclick=()=>dashboard(true);renderDriverProfileButton();
function toggleTripCommands(code){
  const menu=$("tripCommands-"+code);
  if(menu)menu.classList.toggle("on");
}
function alertCustomer(code){
  const trip=state.trips.find(t=>String(t.code)===String(code));
  if(!trip)return toast("Viagem não encontrada.");

  const phone=String(trip.requesterWhatsapp||"").trim();
  if(!phone)return toast("WhatsApp do passageiro não informado.");

  const driverName=String(state.driver&&state.driver.name||"Motorista").trim();
  const message=`Olá! Sou ${driverName}, motorista da Pega & Leva. Estou atendendo sua viagem ${trip.code}. Se necessário, envie sua localização atual pelo WhatsApp para facilitar nosso encontro.`;
  wa(phone,message);
}
function reportLocationError(code){
  const trip=state.trips.find(t=>String(t.code)===String(code));
  if(!trip)return toast("Viagem não encontrada.");

  const phone=String(trip.requesterWhatsapp||"").trim();
  if(!phone)return toast("WhatsApp do passageiro não informado.");

  const driverName=String(state.driver&&state.driver.name||"Motorista").trim();
  const message=`⚠️ Olá! Sou ${driverName}, motorista da Pega & Leva. Estou com dificuldade para localizar seu ponto de partida na viagem ${trip.code}. Pode me enviar sua localização atual pelo WhatsApp?`;
  wa(phone,message);
}
floatingWazeBtn.onclick=()=>{
  const activeTrip=state.trips.find(t=>!["FINALIZADA","CANCELADA PELO ENTREGADOR"].includes(String(t.status).toUpperCase()));
  if(!activeTrip){
    toast("Nenhuma viagem ativa para abrir no Waze.");
    return;
  }
  openWaze();
}

function openWaze(){
  window.open("https://waze.com","_blank");
}


document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeL(b.dataset.close));
document.querySelectorAll(".sheet,.modal").forEach(x=>x.onclick=e=>{if(e.target===x)closeL(x.id)});
renderQuickDriverAccount();

$("quickDriverAccount").onclick=async()=>{
  const account=getQuickDriverAccount();

  if(!account||!account.email||!account.password){
    removeQuickDriverAccount();
    return;
  }

  await performDriverLogin(
    account.email,
    account.password,
    true
  );
};

$("removeQuickDriverLogin").onclick=()=>{
  if(confirm("Deseja remover esta conta salva deste aparelho?")){
    removeQuickDriverAccount();
    toast("Conta salva removida.");
  }
};

let saved=null;

try{
  saved=JSON.parse(
    sessionStorage.getItem("pl_mob_driver")||
    "null"
  );
}catch(e){
  sessionStorage.removeItem("pl_mob_driver");
}

if(saved?.driver&&saved?.token){
  openApp(saved.driver,saved.token);
}
window.addEventListener("resize",keepDriverTopNavSingleRow);
