
const API_URL="https://script.google.com/macros/s/AKfycbxoxiwiw8WRV-9i0yGGfUMA2ye8eBZ2t7UQx06-4KjKidEJFfNKcCvMUmgwcB74XH_d/exec";
const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const state={driver:null,token:"",revision:"",trips:[],availableTrips:[],currentPaymentCode:"",currentPhotoCode:"",photoBase64:"",loading:false,balanceVisible:true,dashboardTimer:null,dashboardBusy:false,pendingWhatsapp:null,lastAvailableCount:0,driverOnline:false};
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
function statusLabel(s){const m={"AGUARDANDO ENTREGADOR":"Aguardando entregador","ACEITA":"Calculando rota","FINALIZANDO CORRIDA PRÓXIMA":"Finalizando entrega na região","ESTOU INDO":"Indo para a coleta","COLETADO":"Produto coletado","FINALIZADA":"Entrega finalizada"};return m[String(s||"").toUpperCase()]||s}
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
    code:firstTripValue(t,["code","codigo","tripCode","pedidoCodigo"],"Sem código"),
    value:Number(firstTripValue(t,["value","valor","price","preco","deliveryValue","valorCorrida"],0))||0,

    sender:firstTripValue(t,[
      "requesterName","companyName","company","userName","senderName",
      "solicitanteNome","nomeSolicitante","empresaNome","nomeEmpresa",
      "requester.name","company.name","sender.name"
    ],"Solicitante não informado"),

    receiver:firstTripValue(t,[
      "receiverName","recipientName","recebedorNome","nomeRecebedor",
      "clientName","customerName","receiver.name","recipient.name"
    ],"Recebedor não informado"),

    origin:firstTripValue(t,[
      "origin","origem","pickupAddress","enderecoOrigem",
      "origin.address","pickup.address"
    ],"Local de retirada não informado"),

    originNeighborhood:firstTripValue(t,[
      "originNeighborhood","bairroOrigem","pickupNeighborhood",
      "origin.neighborhood","pickup.neighborhood"
    ],"Bairro de retirada não informado"),

    destination:firstTripValue(t,[
      "destination","destino","deliveryAddress","enderecoDestino",
      "destination.address","delivery.address"
    ],"Local de entrega não informado"),

    destinationNeighborhood:firstTripValue(t,[
      "destinationNeighborhood","bairroDestino","deliveryNeighborhood",
      "destination.neighborhood","delivery.neighborhood"
    ],"Bairro de entrega não informado"),

    contentType:firstTripValue(t,[
      "contentType","tipoConteudo","conteudo","itemType"
    ],"Conteúdo não informado"),

    returnTrip:firstTripValue(t,[
      "returnTrip","retorno","temRetorno"
    ],"Não informado"),

    estimatedMinutes:firstTripValue(t,[
      "estimatedMinutes","tempoEstimado","estimatedTime","minutes"
    ],"—")
  };
}
function tripPeopleInfo(t){
  const data=normalizedTrip(t);

  return `
  <div style="margin:12px 0 14px;padding:12px;border-radius:13px;background:#f8fafc;border:1px solid #e2e8f0">
    <div style="display:flex;gap:9px;align-items:flex-start">
      <span style="width:32px;height:32px;min-width:32px;border-radius:9px;display:grid;place-items:center;background:#e8f0ff;color:#0646c8">
        <i class="fa-solid fa-store"></i>
      </span>
      <div style="min-width:0">
        <small style="display:block;font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em">Quem está enviando</small>
        <strong style="display:block;margin-top:2px;color:#172033;overflow-wrap:anywhere">${escapeCardText(data.sender)}</strong>
      </div>
    </div>

    <div style="height:1px;background:#e2e8f0;margin:10px 0"></div>

    <div style="display:flex;gap:9px;align-items:flex-start">
      <span style="width:32px;height:32px;min-width:32px;border-radius:9px;display:grid;place-items:center;background:#eafaf0;color:#16803d">
        <i class="fa-solid fa-user"></i>
      </span>
      <div style="min-width:0">
        <small style="display:block;font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em">Quem vai receber</small>
        <strong style="display:block;margin-top:2px;color:#172033;overflow-wrap:anywhere">${escapeCardText(data.receiver)}</strong>
      </div>
    </div>
  </div>`;
}
togglePassword.onclick=()=>{const visible=password.type==="text";password.type=visible?"password":"text";togglePassword.innerHTML=`<i class="fa-regular ${visible?"fa-eye":"fa-eye-slash"}"></i>`}
const QUICK_DRIVER_LOGIN_KEY="pl_quick_driver_account";

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
    name:String(driver&&driver.name||"Entregador").trim(),
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

  $("quickDriverName").textContent=account.name||"Entregador";
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


const DRIVER_AVAILABILITY_KEY="pl_driver_online_status";

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

async function toggleDriverOnlineStatus(){
  const btn=ensureDriverStatusButton();
  if(!btn||btn.disabled)return;

  const previous=!!state.driverOnline;
  const next=!previous;

  btn.disabled=true;
  btn.style.opacity=".75";
  btn.style.cursor="wait";
  btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i><span>Carregando...</span>';

  try{
    const j=await api("driverSetOnlineStatus",{
      status:next?"ONLINE":"OFFLINE"
    });

    // O servidor/planilha é a fonte oficial do status.
    const serverStatus=String(
      j&&j.driver&&j.driver.status || (next?"ONLINE":"OFFLINE")
    ).toUpperCase();

    state.driver=j&&j.driver?j.driver:state.driver;
    state.driverOnline=String(driver.status||"OFFLINE").toUpperCase()==="ONLINE";
  renderDriverOnlineStatus();

    // Força novo dashboard porque a mudança de status altera a revisão no Apps Script.
    state.revision="";
    await dashboard(false);

    if(state.driverOnline){
      renderAvailableTrips();
      toast("Você está ON e disponível para receber corridas.");
    }else{
      if(typeof closeRequestsDrawer==="function")closeRequestsDrawer();
      if(typeof requestBadge!=="undefined"&&requestBadge){
        requestBadge.classList.add("hide");
      }
      toast("Você está OFF.");
    }

    // Atualiza a sessão salva para o status persistir visualmente também.
    try{
      sessionStorage.setItem(
        "pl_driver",
        JSON.stringify({driver:state.driver,token:state.token})
      );
    }catch(e){}

  }catch(e){
    state.driverOnline=previous;
    renderDriverOnlineStatus();
    toast(e.message||"Não foi possível alterar seu status.");
  }finally{
    btn.disabled=false;
    btn.style.opacity="1";
    btn.style.cursor="pointer";
    renderDriverOnlineStatus();
  }
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
  score.title="Score do entregador";

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
          <small style="display:block;color:#64748b;margin-bottom:2px">Desempenho do entregador</small>
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
          <small style="display:block;color:#64748b">Seu turno</small>
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
        <div style="display:flex;gap:10px"><span style="color:#16a34a"><i class="fa-solid fa-circle-check"></i></span><span>Aceite entregas disponíveis <strong>dentro do seu turno</strong>.</span></div>
        <div style="display:flex;gap:10px"><span style="color:#16a34a"><i class="fa-solid fa-bolt"></i></span><span>Aceitar novas entregas rapidamente pode render mais Score.</span></div>
        <div style="display:flex;gap:10px"><span style="color:#16a34a"><i class="fa-solid fa-star"></i></span><span>Boas avaliações ajudam você a subir de nível.</span></div>
        <div style="display:flex;gap:10px"><span style="color:#dc2626"><i class="fa-solid fa-circle-minus"></i></span><span>Cancelar sem justificativa reduz seu Score.</span></div>
        <div style="display:flex;gap:10px"><span style="color:#dc2626"><i class="fa-solid fa-circle-minus"></i></span><span>Ficar online e ignorar entregas disponíveis também pode reduzir sua pontuação.</span></div>
      </div>
    </div>

    <div style="margin-top:14px;padding:14px;border-radius:15px;background:#fff7ed;border:1px solid #fed7aa;color:#9a4f16">
      <strong><i class="fa-solid fa-gift"></i> Bônus de nível</strong>
      <p style="margin:5px 0 0;font-size:13px;line-height:1.45">
        Conforme seu nível aumenta, você pode receber mais oportunidades de corridas e bônus maiores em entregas selecionadas. Os bônus não aparecem em todas as viagens.
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
    "pl_driver",
    JSON.stringify({driver,token:state.token})
  );

  const firstName=String(driver.name||"").trim().split(/\s+/)[0]||"Entregador";
  welcomeName.textContent=`Olá, ${firstName}!`;
  driverInfo.textContent=`${driver.plate||"Sem placa"} • ${driver.whatsapp||""}`;
  withdrawEmail.value=driver.email||"";
  show("appView");
  state.driverOnline=String(driver.status||"OFFLINE").toUpperCase()==="ONLINE";
  renderDriverOnlineStatus();
  ensureDriverScoreNav();
  dashboard();
  startDriverPolling();
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
    state.driverOnline=String(j.driver&&j.driver.status||"OFFLINE").toUpperCase()==="ONLINE";
    state.trips=j.trips||[];
    state.availableTrips=j.availableTrips||[];
    balance.textContent=state.balanceVisible?money.format(j.driver.balance||0):"R$ •••••";
    discountBadge.textContent=`Taxa da plataforma: ${Number(j.driver.feePercent||20)}%`;
    balanceInfo.textContent="O valor recebido pelo entregador considera o desconto de 20% da plataforma. Bônus, quando houver, é somado ao seu ganho.";
    tripCount.textContent=`${state.trips.filter(t=>!["FINALIZADA","CANCELADA PELO ENTREGADOR"].includes(String(t.status).toUpperCase())).length} corrida(s)`;
    renderDriverOnlineStatus();
    renderDriverScoreSheet();
    renderTrips();renderHistory();renderAvailableTrips()
  }catch(x){toast(x.message)}
  finally{state.dashboardBusy=false}
}
function startDriverPolling(){
  clearInterval(state.dashboardTimer);
  state.dashboardTimer=setInterval(()=>{
    if(state.driver&&state.driverOnline&&!document.hidden&&navigator.onLine)dashboard(false);
  },7000);
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.driver&&state.driverOnline)dashboard(false)});
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
      <div style="text-align:right">
        <div class="trip-price">${money.format(t.driverValue!==undefined?t.driverValue:t.value)}</div>
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
    <span>${t.contentType}</span>
    <span>Retorno: ${t.returnTrip}</span>
    <span>Tempo estimado: ${t.estimatedMinutes} min</span>
    <span>Pagamento: ${paymentReady?t.paymentStatus:"Não informado"}</span>
  </div>
  <div class="card-command-menu" id="tripCommands-${t.code}">
    <button class="btn secondary" onclick="updateTrip('${t.code}','FINALIZANDO CORRIDA PRÓXIMA')"><i class="fa-solid fa-motorcycle"></i> Finalizando entrega próxima</button>
    <button class="btn primary" onclick="updateTrip('${t.code}','ESTOU INDO')"><i class="fa-solid fa-motorcycle"></i> Estou indo para coleta</button>
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
function renderHistory(){
  const done=state.trips.filter(t=>String(t.status).toUpperCase()==="FINALIZADA");
  historyList.innerHTML=done.length?done.map(t=>`
    <div class="trip-card" style="margin-bottom:10px">
      <div class="trip-top">
        <div class="trip-code">${t.code}</div>
        <div style="text-align:right">
          <div class="trip-price">${money.format(t.driverValue!==undefined?t.driverValue:t.value)}</div>
          ${Number(t.bonus||0)>0?`<small style="display:block;color:#16a34a;font-weight:900">+ bônus ${money.format(t.bonus)}</small>`:""}
        </div>
      </div>
      ${tripPeopleInfo(t)}
      <p class="muted">${t.originNeighborhood} → ${t.destinationNeighborhood}</p>
      <span class="status">${t.paymentStatus}</span>
      ${t.photoUrl?`<p><a href="${t.photoUrl}" target="_blank">Ver comprovante da entrega</a></p>`:""}
    </div>
  `).join(""):`<div class="empty">Nenhuma corrida finalizada.</div>`;
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
          <span class="request-new">Nova solicitação</span>
        </div>
        <div style="text-align:right">
          <div class="trip-price">${money.format(Number(t.driverValue!==undefined?t.driverValue:data.value))}</div>
          <small style="display:block;color:#64748b;font-size:10px">você recebe</small>
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
        <span>${escapeCardText(data.contentType)}</span>
        <span>Retorno: ${escapeCardText(data.returnTrip)}</span>
        <span>Tempo estimado: ${escapeCardText(data.estimatedMinutes)} min</span>
      </div>

      <button class="btn primary full" onclick="acceptAvailableTrip('${escapeCardText(data.code)}')">
        <i class="fa-solid fa-check"></i> Aceitar corrida
      </button>
    </article>`;
  }).join(""):`<div class="empty">Nenhuma nova solicitação disponível neste momento.</div>`;
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

function customerStatusMessage(status,trip){
  const s=String(status||"").trim().toUpperCase();
  const code=String(trip&&trip.code||"").trim();
  const prefix=code?`Pedido ${code}: `:"";
  if(s==="FINALIZANDO CORRIDA PRÓXIMA"){
    return `${prefix}o entregador está finalizando uma entrega na região e já está indo fazer a retirada do produto.`;
  }
  if(s==="ESTOU INDO"){
    return `${prefix}o entregador está indo até o local para fazer a coleta.`;
  }
  if(s==="COLETADO"){
    return `${prefix}o produto foi coletado e está seguindo para o destino.`;
  }
  return "";
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
      askWhatsappNotification(notificationPhone,customerStatusMessage(normalizedStatus,tripBeforeUpdate)||j.message);
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
      const receiverName=String(
        tripBeforeFinalize&&(
          tripBeforeFinalize.receiverName||
          tripBeforeFinalize.recipientName
        )||"O destinatário"
      ).trim();
      const finalMessage=`Entrega finalizada! ${receiverName} acabou de receber seu envio.`;
      wa(finalPhone,finalMessage);
    }

    await dashboard()
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
              "Problema com a mercadoria",
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
  if(!confirm("Deseja cancelar esta corrida? Ela ficará disponível para outro entregador."))return;

  const justification=String(prompt(
    "Informe o motivo do cancelamento. Cancelar sem justificativa reduz mais o seu Score:",
    ""
  )||"").trim();

  try{
    const j=await withActionLoading(
      "Cancelando corrida",
      "Removendo a corrida do seu painel e liberando para outro entregador.",
      ()=>api("driverCancelTrip",{driverId:state.driver.id,code,justification})
    );
    toast(j.scorePenalty<=-10
      ?"Corrida cancelada. Seu Score foi reduzido por falta de justificativa."
      :"Corrida cancelada e liberada."
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
historyNav.onclick=()=>openL("historySheet");refreshBtn.onclick=()=>dashboard(true);logoutBtn.onclick=async()=>{
  try{await api("logout",{}, {timeout:5000,noRetry:true})}catch(e){}

  clearInterval(state.dashboardTimer);
  sessionStorage.removeItem("pl_driver");

  state.driver=null;
  state.token="";
  state.revision="";

  password.value="";
  show("loginView");
  renderQuickDriverAccount();
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
    sessionStorage.getItem("pl_driver")||
    "null"
  );
}catch(e){
  sessionStorage.removeItem("pl_driver");
}

if(saved?.driver&&saved?.token){
  openApp(saved.driver,saved.token);
}
window.addEventListener("resize",keepDriverTopNavSingleRow);
