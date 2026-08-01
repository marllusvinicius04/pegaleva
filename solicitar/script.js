
const API_URL="https://script.google.com/macros/s/AKfycbxPY3HHffu0PTEXiB7yzfZKbFhHEf9tHOKZgctTooPqN2S0FGLq6vpdmDCMxiigCYMy/exec";const ADMIN_WHATSAPP="5589994029572";const PARTNER_PLAN_URL="COLE_AQUI_O_LINK_DA_PAGINA_DO_PLANO";const $=id=>document.getElementById(id);const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});const bairros=["Fogoso","Malvinas","Vaquejada","Centro","Aeroporto","Aeroporto I","Aeroporto II","Novo Horizonte","Novo Horizonte I","Novo Horizonte II","Areia","Esperança","Água Branca","Alto Bonito","São Francisco","Babilônia","Canaã","Bela Vista","Portal dos Cerrados","Cerrados Park","Vista Bela","Benedito Leite"];const state={user:null,token:"",revision:"",trips:[],tripStatusMap:{},dashboardTimer:null,dashboardBusy:false,firstDashboard:true,ratingTripCode:"",ratingValue:0,request:{origin:null,destination:null,originNeighborhood:"",destinationNeighborhood:"",receiverName:"",receiverWhatsapp:"",contentType:"",returnTrip:false,freights:[],selectedFreight:null,code:""}};async function api(action,data={},options={}){
  if(!API_URL.startsWith("https://script.google.com/"))throw new Error("Cole a URL do Apps Script no HTML.");
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
        sessionStorage.removeItem("pl_session");
        state.user=null;state.token="";
        show("loginView");
      }
      throw new Error(j.error||"Erro.");
    }
    return j;
  }catch(e){
    if(e.name==="AbortError")throw new Error("A conexão demorou demais. Tente novamente.");
    const nonRepeatable=["createTrip","cancelUserTrip","rateDriver","logout"].includes(String(action));
    if(
      !options.noRetry &&
      !nonRepeatable &&
      /fetch|conexão|network/i.test(String(e.message))
    ){
      await new Promise(r=>setTimeout(r,700));
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
  if(s==="ACEITA")return "Calculando rota e disponibilizando entregador";
  if(s==="FINALIZANDO CORRIDA PRÓXIMA")return "Finalizando uma entrega na região";
  if(s==="ESTOU INDO")return "Entregador indo para a coleta";
  if(s==="COLETADO")return "Produto coletado e seguindo para o destino";
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


function tripWasRated(trip){
  if(!trip||!trip.code)return false;

  if(trip.rated===true)return true;

  const rating=Number(
    trip.rating!==undefined?trip.rating:
    trip.driverRating!==undefined?trip.driverRating:0
  );

  if(Number.isFinite(rating)&&rating>0)return true;

  return !!localStorage.getItem("pl_rated_trip_"+trip.code);
}


function safeClientDriverPhotoUrl(url){
  const value=String(url||"").trim();
  if(!value)return"";
  return value+(value.includes("?")?"&":"?")+"_="+Date.now();
}

function clientDriverAvatarImage(url,name,size=48){
  const safe=String(url||"").trim();
  if(!safe)return`<i class="fa-solid fa-user"></i>`;
  return `<img src="${safeClientDriverPhotoUrl(safe)}" alt="${String(name||"Entregador").replace(/"/g,"&quot;")}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:50%" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=&quot;fa-solid fa-user&quot;></i>'">`;
}

function ensureDriverRatingModal(){
  let modal=document.getElementById("driverRatingModal");
  if(modal)return modal;

  modal=document.createElement("div");
  modal.id="driverRatingModal";
  modal.style.cssText=`
    position:fixed;
    inset:0;
    z-index:1800;
    display:none;
    align-items:center;
    justify-content:center;
    padding:18px;
    background:rgba(15,23,42,.64);
  `;

  modal.innerHTML=`
    <div style="
      width:min(100%,430px);
      background:#fff;
      border-radius:26px;
      padding:26px 22px 22px;
      text-align:center;
      box-shadow:0 28px 70px rgba(15,23,42,.28);
    ">
      <div style="
        width:58px;height:58px;border-radius:50%;
        margin:0 auto 13px;
        display:grid;place-items:center;
        background:#dcfce7;color:#15803d;font-size:27px;
      ">
        <i class="fa-solid fa-circle-check"></i>
      </div>

      <h2 style="margin:0;color:#0f172a;font-size:25px">Viagem Finalizada!</h2>
      <p style="margin:7px 0 20px;color:#64748b;font-size:14px">
        Sua entrega foi concluída com sucesso.
      </p>

      <div id="driverRatingAvatar" style="
        width:78px;height:78px;border-radius:50%;
        margin:0 auto 10px;
        display:grid;place-items:center;
        background:linear-gradient(135deg,#0029ff,#0740b8);
        color:#fff;font-size:25px;font-weight:900;
        border:5px solid #eef2ff;
      ">M</div>

      <strong id="driverRatingName" style="display:block;font-size:18px;color:#172033">
        Entregador
      </strong>

      <span id="driverRatingPlate" style="
        display:inline-flex;
        align-items:center;
        gap:6px;
        margin-top:6px;
        padding:6px 10px;
        border-radius:999px;
        background:#f1f5f9;
        color:#475569;
        font-size:12px;
        font-weight:800;
      ">
        <i class="fa-solid fa-motorcycle"></i>
        Placa não informada
      </span>

      <div style="height:1px;background:#e2e8f0;margin:21px 0 18px"></div>

      <strong style="display:block;color:#0f172a;font-size:17px">Avalie o motoboy</strong>
      <small style="display:block;color:#64748b;margin-top:4px">
        Sua avaliação ajuda a reconhecer o desempenho do entregador.
      </small>

      <div id="driverRatingStars" style="
        display:flex;
        justify-content:center;
        gap:8px;
        margin:18px 0;
      ">
        ${[1,2,3,4,5].map(n=>`
          <button type="button" data-rating="${n}" style="
            border:0;background:transparent;padding:3px;
            font-size:34px;color:#cbd5e1;cursor:pointer;
          " aria-label="${n} estrela${n>1?"s":""}">
            <i class="fa-solid fa-star"></i>
          </button>
        `).join("")}
      </div>

      <button id="submitDriverRating" type="button" class="btn full" disabled
        style="background:#0029ff;color:#fff;font-weight:900">
        Enviar avaliação
      </button>

      <button id="closeDriverRating" type="button"
        style="margin-top:10px;border:0;background:transparent;color:#64748b;font-weight:700;cursor:pointer">
        Avaliar depois
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll("[data-rating]").forEach(btn=>{
    btn.onclick=()=>{
      state.ratingValue=Number(btn.dataset.rating||0);
      modal.querySelectorAll("[data-rating]").forEach(star=>{
        const active=Number(star.dataset.rating)<=state.ratingValue;
        star.style.color=active?"#f5b301":"#cbd5e1";
        star.style.transform=active?"scale(1.08)":"scale(1)";
      });
      modal.querySelector("#submitDriverRating").disabled=!state.ratingValue;
    };
  });

  modal.querySelector("#closeDriverRating").onclick=()=>closeDriverRatingModal();

  modal.querySelector("#submitDriverRating").onclick=async()=>{
    if(!state.ratingTripCode||!state.ratingValue)return;

    const button=modal.querySelector("#submitDriverRating");
    button.disabled=true;
    button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    try{
      await api("rateDriver",{
        code:state.ratingTripCode,
        rating:state.ratingValue
      },{timeout:15000});

      localStorage.setItem(
        "pl_rated_trip_"+state.ratingTripCode,
        String(state.ratingValue)
      );

      const ratedTrip=state.trips.find(
        t=>String(t.code)===String(state.ratingTripCode)
      );
      if(ratedTrip){
        ratedTrip.rating=state.ratingValue;
        ratedTrip.rated=true;
        ratedTrip.driverRating=state.ratingValue;
        ratedTrip.ratedAt=new Date().toISOString();
      }

      modal.querySelector("#driverRatingStars").style.display="none";
      modal.querySelector("#submitDriverRating").style.display="none";
      modal.querySelector("#driverRatingName").insertAdjacentHTML(
        "afterend",
        '<div id="ratingThankYou" style="margin-top:18px;padding:14px;border-radius:14px;background:#ecfdf5;color:#15803d;font-weight:900"><i class="fa-solid fa-circle-check"></i> Obrigado, avaliado!</div>'
      );
      modal.querySelector("#closeDriverRating").textContent="Fechar";
      state.revision="";
      setTimeout(()=>dashboard(true),100);
    }catch(e){
      toast(e.message||"Não foi possível enviar a avaliação.");
    }finally{
      button.disabled=false;
      button.textContent="Enviar avaliação";
    }
  };

  modal.onclick=e=>{
    if(e.target===modal)closeDriverRatingModal();
  };

  return modal;
}

function driverInitials(name){
  const parts=String(name||"Motoboy").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0]||"M")+(parts.length>1?(parts[parts.length-1]?.[0]||""):"");
}

function openDriverRatingModal(trip){
  if(!trip||!trip.code)return;

  if(tripWasRated(trip))return;

  const modal=ensureDriverRatingModal();
  const name=String(trip.driverName||"Motoboy Pega & Leva").trim();
  const plate=String(
    trip.driverPlate||trip.plate||trip.driverPlaca||"Placa não informada"
  ).trim();

  state.ratingTripCode=trip.code;
  state.ratingValue=0;

  const profilePhoto=String(trip.driverPhotoUrl||"").trim();
  const avatar=modal.querySelector("#driverRatingAvatar");

  if(profilePhoto){
    avatar.innerHTML=clientDriverAvatarImage(profilePhoto,name,78);
    avatar.style.padding="0";
    avatar.style.overflow="hidden";
  }else{
    avatar.textContent=driverInitials(name).toUpperCase();
    avatar.style.padding="";
    avatar.style.overflow="";
  }

  modal.querySelector("#driverRatingName").textContent=name;
  modal.querySelector("#driverRatingPlate").innerHTML=
    `<i class="fa-solid fa-motorcycle"></i> ${plate}`;

  modal.querySelector("#ratingThankYou")?.remove();
  modal.querySelector("#driverRatingStars").style.display="flex";
  modal.querySelectorAll("[data-rating]").forEach(star=>{
    star.style.color="#cbd5e1";
    star.style.transform="scale(1)";
  });

  const submit=modal.querySelector("#submitDriverRating");
  submit.style.display="";
  submit.disabled=true;
  submit.textContent="Enviar avaliação";
  modal.querySelector("#closeDriverRating").textContent="Avaliar depois";

  modal.style.display="flex";
  document.body.style.overflow="hidden";
}

function closeDriverRatingModal(){
  const modal=document.getElementById("driverRatingModal");
  if(modal)modal.style.display="none";
  document.body.style.overflow="";
  state.ratingValue=0;
}

function compareTripUpdates(newTrips){
  const next={};
  const newlyFinalized=[];

  newTrips.forEach(t=>{
    const key=`${String(t.status||"").toUpperCase()}|${String(t.paymentStatus||"").toUpperCase()}`;
    next[t.code]=key;

    const previous=state.tripStatusMap[t.code];

    if(!state.firstDashboard && previous && previous!==key){
      showStatusAlert(t);

      const previousStatus=String(previous).split("|")[0];
      const currentStatus=String(t.status||"").toUpperCase();

      if(
        previousStatus!=="FINALIZADA" &&
        currentStatus==="FINALIZADA" &&
        !tripWasRated(t)
      ){
        newlyFinalized.push(t);
      }
    }
  });

  // Se várias finalizaram enquanto o cliente não estava olhando,
  // mostra SOMENTE a última.
  if(newlyFinalized.length){
    const latest=newlyFinalized
      .slice()
      .sort((a,b)=>{
        const ta=new Date(a.finalizedAt||a.createdAt||0).getTime()||0;
        const tb=new Date(b.finalizedAt||b.createdAt||0).getTime()||0;
        return tb-ta;
      })[0];

    setTimeout(()=>openDriverRatingModal(latest),250);
  }

  state.tripStatusMap=next;
  state.firstDashboard=false;
}
function startDashboardPolling(){
  clearInterval(state.dashboardTimer);
  state.dashboardTimer=setInterval(()=>{
    if(state.user && !state.dashboardBusy && !document.hidden && navigator.onLine){
      dashboard(true);
    }
  },2000);
}
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden && state.user)dashboard(true);
});
window.addEventListener("online",()=>{if(state.user){toast("Conexão restabelecida.");dashboard(true)}});
window.addEventListener("offline",()=>toast("Você está sem internet. As informações serão atualizadas ao reconectar."));
async function dashboard(silent=false){
  if(state.dashboardBusy)return;
  state.dashboardBusy=true;
  try{
    const j=await api("dashboard",{sinceRevision:state.revision},{timeout:8000,noRetry:!!silent});
    if(j.unchanged)return;
    state.revision=String(j.revision||state.revision||"");
    const newTrips=j.trips||[];
    const wasFirstDashboard=state.firstDashboard;

    // O servidor é a fonte oficial: se a planilha já possui avaliação,
    // registra localmente também para nunca reabrir esse modal neste aparelho.
    newTrips.forEach(t=>{
      if(t&&t.code&&t.rated){
        localStorage.setItem(
          "pl_rated_trip_"+t.code,
          String(t.rating||1)
        );
      }
    });
    compareTripUpdates(newTrips);
    state.trips=newTrips;

    if(state.ratingTripCode){
      const currentRatingTrip=state.trips.find(
        t=>String(t.code)===String(state.ratingTripCode)
      );
      if(currentRatingTrip&&tripWasRated(currentRatingTrip)){
        const ratingModal=document.getElementById("driverRatingModal");
        if(ratingModal&&ratingModal.style.display==="flex"){
          closeDriverRatingModal();
        }
      }
    }

    if(wasFirstDashboard){
      const latestFinished=newTrips
        .filter(t=>
          String(t.status||"").toUpperCase()==="FINALIZADA" &&
          !tripWasRated(t)
        )
        .sort((a,b)=>{
          const ta=new Date(a.finalizedAt||a.createdAt||0).getTime()||0;
          const tb=new Date(b.finalizedAt||b.createdAt||0).getTime()||0;
          return tb-ta;
        })[0];

      if(latestFinished){
        setTimeout(()=>openDriverRatingModal(latestFinished),500);
      }
    }
    $("tripNotification").textContent=state.trips.filter(t=>String(t.status).toUpperCase()!=="FINALIZADA").length;
    $("invoiceBalance") && ($("invoiceBalance").textContent=money.format(j.user.invoiceBalance||0));
    $("invoiceModalBalance") && ($("invoiceModalBalance").textContent=money.format(j.user.invoiceBalance||0));
    $("invoiceText") && ($("invoiceText").textContent=`${j.pendingCount||0} entrega(s) pendente(s).`);
    hideInvoicePaymentUI();
    state.user=j.user||state.user;
    sessionStorage.setItem("pl_session",JSON.stringify({user:state.user,token:state.token}));
    renderBusinessArea(state.user,j.config||{});
    renderAccountPlan(state.user);
    if(document.querySelector("#tripsSheet.on"))trips();
  }catch(e){
    if(!silent)toast(e.message)
  }finally{
    state.dashboardBusy=false;
  }
}



function hideInvoicePaymentUI(){
  // Pagamento de fatura ativo novamente.
  // Mantém saldo, botão e modal de pagamento visíveis.
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
  const plan=normalizeAccountPlan(user&&user.plan);
  const deliveries=Math.max(0,Number(user&&(
    user.completedDeliveries!==undefined?user.completedDeliveries:user.deliveries
  )||0));

  const rawLimit=user&&user.deliveryLimit;
  const unlimited=["ILIMITADO","ILIMITADAS","∞",""].includes(
    String(rawLimit==null?"":rawLimit).trim().toUpperCase()
  );

  if(plan==="PARCEIRO"&&!unlimited&&Number.isFinite(Number(rawLimit))){
    return `${deliveries}/${Math.max(0,Number(rawLimit))}`;
  }

  return String(deliveries);
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
    </div>
  `;
}


function renderFreePlanOffer(user){
  const section=document.getElementById("businessSection");
  const catalogCard=document.getElementById("catalogOfferCard");
  if(!section||!catalogCard)return;

  let offer=document.getElementById("freePlanOfferCard");

  if(!offer){
    offer=document.createElement("div");
    offer.id="freePlanOfferCard";
    offer.style.marginBottom="16px";
    offer.style.padding="18px";
    offer.style.borderRadius="18px";
    offer.style.background="linear-gradient(135deg,#0646c8,#08358f)";
    offer.style.color="#fff";
    offer.style.boxShadow="0 12px 30px rgba(6,70,200,.22)";

    offer.innerHTML=`
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px">
        <div style="flex:1">
          <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.15);font-size:12px;font-weight:800;margin-bottom:12px">
            <i class="fa-solid fa-bolt"></i>
            OFERTA ESPECIAL
          </span>

          <h3 style="margin:0 0 8px;font-size:20px;line-height:1.25;color:#fff">
            Ofereça fretes mais acessíveis e econômicos!
          </h3>

          <p style="margin:0 0 14px;line-height:1.55;color:rgba(255,255,255,.88)">
            Assine mensalmente e tenha condições especiais para oferecer fretes mais vantajosos aos seus clientes.
          </p>

          <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:16px">
            <strong style="font-size:28px;line-height:1">R$ 59,90</strong>
            <span style="font-size:13px;color:rgba(255,255,255,.8)">por mês</span>
          </div>

          <button id="freePlanOfferMore" type="button" class="btn" style="background:#fff;color:#0646c8;font-weight:800">
            Ver mais
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>

        <span style="display:inline-flex;align-items:center;justify-content:center;min-width:48px;width:48px;height:48px;border-radius:15px;background:rgba(255,255,255,.16);font-size:21px">
          <i class="fa-solid fa-tags"></i>
        </span>
      </div>
    `;

    section.insertBefore(offer,catalogCard);

    offer.querySelector("#freePlanOfferMore").onclick=()=>{
      const link=String(PARTNER_PLAN_URL||"").trim();

      if(!link||link==="COLE_AQUI_O_LINK_DA_PAGINA_DO_PLANO"){
        return toast("Configure o link da página do plano no JavaScript.");
      }

      window.open(link,"_blank","noopener,noreferrer");
    };
  }

  const plan=normalizeAccountPlan(user&&user.plan);
  const isCompany=!!(user&&user.isCompany);
  offer.classList.toggle("hide",!isCompany||plan!=="GRATUITO");
}

function renderBusinessArea(user,config){
  const isCompany=!!(user&&user.isCompany);

  businessSection.classList.toggle("hide",!isCompany);
  marketingBanner.classList.add("hide");

  renderFreePlanOffer(user);

  if(typeof catalogOfferCard!=="undefined"&&catalogOfferCard){
    catalogOfferCard.classList.add("hide");
  }

  if(typeof catalogActiveCard!=="undefined"&&catalogActiveCard){
    catalogActiveCard.classList.add("hide");
  }

  if(isCompany)return;

  if(config&&config.bannerUrl){
    bannerImage.src=config.bannerUrl;
    marketingBanner.href=config.bannerLink||"#";
    marketingBanner.classList.remove("hide");
  }
}
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
$("welcomeName").textContent=`Olá, ${firstName}!`;$("welcomeCompany").textContent=`${u.city}`;$("profileName").textContent=u.name;$("profileCompany").textContent=u.company;$("profileAddress").textContent=`${u.street}, ${u.number} • ${u.city}`;show("appView");floatingTrips.style.display="block";hideInvoicePaymentUI();renderBusinessArea(u,{});renderAccountPlan(u);dashboard();startDashboardPolling();
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
};async function submit(){
  closeL("wizardSheet");
  openL("loadingModal");

  try{
    const j=await api("createTrip",{
      trip:{
        userId:state.user.id,
        origin:state.request.origin,
        destination:state.request.destination,
        originNeighborhood:state.request.originNeighborhood,
        destinationNeighborhood:state.request.destinationNeighborhood,
        receiverName:state.request.receiverName,
        receiverWhatsapp:state.request.receiverWhatsapp,
        contentType:state.request.contentType,
        returnTrip:state.request.returnTrip,
        freightType:state.request.selectedFreight.type
      }
    },{
      timeout:40000,
      noRetry:true
    });

    state.request.code=j.trip.code;

    closeL("loadingModal");

    if(typeof successCode!=="undefined"&&successCode){
      successCode.textContent=`Código do pedido: ${j.trip.code}`;
    }

    openL("successModal");
    playPositiveConfirmation();
    successNotify();

    state.revision="";
    setTimeout(()=>dashboard(true),100);

  }catch(x){
    closeL("loadingModal");

    const msg=String(x&&x.message||"");

    if(/conexão demorou demais/i.test(msg)){
      toast("A solicitação está demorando para confirmar. Verifique em Minhas entregas antes de tentar novamente.");
      state.revision="";
      setTimeout(()=>dashboard(true),300);
      return;
    }

    toast(msg||"Não foi possível solicitar a entrega.");
  }
}

function cleanMapAddress(a){
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

function ensureRequestSentModal(){
  let modal=document.getElementById("requestSentModal");
  if(modal)return modal;

  modal=document.createElement("div");
  modal.id="requestSentModal";
  modal.style.cssText=`
    position:fixed;
    inset:0;
    z-index:1900;
    display:none;
    align-items:center;
    justify-content:center;
    padding:18px;
    background:rgba(15,23,42,.62);
  `;

  modal.innerHTML=`
    <div style="
      width:min(100%,430px);
      background:#fff;
      border-radius:26px;
      padding:28px 22px 22px;
      text-align:center;
      box-shadow:0 28px 70px rgba(15,23,42,.28);
    ">
      <div style="
        width:62px;height:62px;border-radius:50%;
        margin:0 auto 14px;
        display:grid;place-items:center;
        background:#eafaf0;color:#16803d;
        font-size:28px;
      ">
        <i class="fa-solid fa-circle-check"></i>
      </div>

      <h2 style="margin:0;color:#0f172a;font-size:25px;line-height:1.2">
        Solicitação enviada!
      </h2>

      <p style="
        margin:10px auto 18px;
        color:#64748b;
        font-size:14px;
        line-height:1.55;
        max-width:360px;
      ">
        Nossos entregadores estão visualizando sua viagem.
        Em instantes, um deles poderá aceitar sua solicitação.
      </p>

      <div style="
        display:flex;
        justify-content:center;
        align-items:center;
        margin:4px 0 16px;
      ">
        ${[
          ["fa-user","#e8f0ff","#0646c8"],
          ["fa-motorcycle","#ecfdf5","#15803d"],
          ["fa-user","#fff7ed","#c2410c"],
          ["fa-user","#f3e8ff","#7e22ce"]
        ].map((item,index)=>`
          <span style="
            width:46px;
            height:46px;
            border-radius:50%;
            display:grid;
            place-items:center;
            margin-left:${index===0?0:-10}px;
            background:${item[1]};
            color:${item[2]};
            border:3px solid #fff;
            box-shadow:0 5px 15px rgba(15,23,42,.10);
            font-size:17px;
          ">
            <i class="fa-solid ${item[0]}"></i>
          </span>
        `).join("")}
      </div>

      <div style="
        display:inline-flex;
        align-items:center;
        gap:7px;
        padding:7px 11px;
        border-radius:999px;
        background:#eef3ff;
        color:#0646c8;
        font-size:12px;
        font-weight:900;
        margin-bottom:18px;
      ">
        <i class="fa-solid fa-eye"></i>
        Entregadores visualizando
      </div>

      <div style="
        padding:14px 15px;
        border-radius:15px;
        background:#f8fbff;
        border:1px solid #dbe7ff;
        color:#334155;
        text-align:left;
        font-size:13px;
        line-height:1.5;
        margin-bottom:18px;
      ">
        <strong style="display:block;color:#172033;margin-bottom:5px">
          <i class="fa-brands fa-whatsapp" style="color:#16a34a"></i>
          Importante
        </strong>
        Quando o entregador entrar em contato pelo WhatsApp, não esqueça de enviar sua
        <strong>localização atual de entrega</strong> para facilitar a retirada ou chegada ao destino.
      </div>

      <button id="requestSentViewTrips" type="button" class="btn full" style="
        margin-bottom:10px;
        background:#0029ff;
        color:#fff;
        font-weight:900;
      ">
        <i class="fa-solid fa-motorcycle"></i>
        Acompanhar em Minhas entregas
      </button>

      <button id="requestSentClose" type="button" style="
        width:100%;
        border:0;
        background:transparent;
        color:#64748b;
        font-weight:800;
        padding:10px;
        cursor:pointer;
      ">
        Fechar
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn=modal.querySelector("#requestSentClose");
  if(closeBtn)closeBtn.onclick=closeRequestSentModal;

  const viewTripsBtn=modal.querySelector("#requestSentViewTrips");
  if(viewTripsBtn){
    viewTripsBtn.onclick=()=>{
      closeRequestSentModal();
      trips();
      const sheet=document.getElementById("tripsSheet");
      if(sheet)sheet.classList.add("on");
    };
  }

  modal.onclick=e=>{
    if(e.target===modal)closeRequestSentModal();
  };

  return modal;
}

function openRequestSentModal(){
  const modal=ensureRequestSentModal();

  const success=document.getElementById("successModal");
  if(success)success.classList.remove("on");

  modal.style.display="flex";
  document.body.style.overflow="hidden";
  playPositiveConfirmation();

  // Atualiza "Minhas entregas" em segundo plano sem travar o modal.
  state.revision="";
  setTimeout(()=>dashboard(true),120);
}

function closeRequestSentModal(){
  const modal=document.getElementById("requestSentModal");
  if(modal)modal.style.display="none";
  document.body.style.overflow="";
}

function bindSendWhatsappAction(){
  const btn=document.getElementById("sendWhatsapp");
  if(!btn)return;

  btn.onclick=e=>{
    e?.preventDefault?.();

    // A corrida já foi criada pelo createTrip.
    // Apenas confirma a solicitação. Não abre WhatsApp administrativo.
    openRequestSentModal();
  };
}
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

function activeTripStep(status){
  const s=String(status||"").trim().toUpperCase();
  if(s==="AGUARDANDO ENTREGADOR")return 0;
  if(s==="ACEITA"||s==="FINALIZANDO CORRIDA PRÓXIMA")return 1;
  if(s==="ESTOU INDO")return 2;
  if(s==="COLETADO")return 3;
  return 0;
}
function animatedStatusDots(){
  return `<span class="moving-status-dots" aria-label="carregando"><i></i><i></i><i></i></span>`;
}
function ensureTripStatusStyles(){
  if(document.getElementById("tripStatusDynamicStyles"))return;
  const style=document.createElement("style");
  style.id="tripStatusDynamicStyles";
  style.textContent=`
    .moving-status-dots{display:inline-flex;align-items:center;gap:3px;margin-left:4px;vertical-align:middle}
    .moving-status-dots i{display:block;width:5px;height:5px;border-radius:50%;background:currentColor;animation:movingStatusDot 1.15s infinite ease-in-out}
    .moving-status-dots i:nth-child(2){animation-delay:.16s}
    .moving-status-dots i:nth-child(3){animation-delay:.32s}
    @keyframes movingStatusDot{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-4px);opacity:1}}
    .trip-finished-receiver{display:block;margin-top:6px;color:#0f7a43;font-size:.74rem;font-weight:800;line-height:1.4}
  `;
  document.head.appendChild(style);
}
function activeTripMessage(status){
  const s=String(status||"").trim().toUpperCase();
  if(s==="AGUARDANDO ENTREGADOR")return `Buscando um entregador próximo${animatedStatusDots()}`;
  if(s==="ACEITA")return `Calculando rota e disponibilizando entregador ao local${animatedStatusDots()}`;
  if(s==="FINALIZANDO CORRIDA PRÓXIMA")return "O entregador está finalizando uma entrega na região e já está indo fazer a retirada do produto";
  if(s==="ESTOU INDO")return "O entregador está indo até o local para fazer a coleta";
  if(s==="COLETADO")return "Produto coletado. O entregador está seguindo para o destino";
  return clientStatusLabel(status,"");
}
function finishedTripTime(t){
  return t.finalizedAt||t.finishedAt||t.completedAt||t.updatedAt||t.createdAt||"Horário não informado";
}
function trips(){
  ensureTripStatusStyles();
  const activeTrips=state.trips.filter(t=>String(t.status||"").trim().toUpperCase()!=="FINALIZADA");
  const finishedTrips=state.trips.filter(t=>String(t.status||"").trim().toUpperCase()==="FINALIZADA");
  const sheetTitle=document.querySelector("#tripsSheet .sheet-head h3");
  if(sheetTitle)sheetTitle.textContent="Minhas entregas";

  const activeHtml=activeTrips.length?`
    <section class="trips-section">
      <div class="trips-section-title">
        <span><i class="fa-solid fa-motorcycle"></i> Em andamento</span>
        <strong>${activeTrips.length}</strong>
      </div>
      ${activeTrips.map(t=>{
        const status=String(t.status||"").trim().toUpperCase();
        const waiting=status==="AGUARDANDO ENTREGADOR"&&!String(t.driverName||"").trim();
        const label=clientStatusLabel(t.status,t.paymentStatus);
        const cls=statusClass(t.status,t.paymentStatus);
        const currentStep=activeTripStep(t.status);
        const progress=Math.max(8,Math.min(100,(currentStep/3)*100));
        const driver=String(t.driverName||"").trim();

        return `<article class="trip-uber-card">
          <div class="trip-uber-top">
            <div>
              <small>ENTREGA ${t.code}</small>
              <h4>${activeTripMessage(t.status)}</h4>
            </div>
            <span class="trip-live-badge"><i class="fa-solid fa-circle"></i> AO VIVO</span>
          </div>

          <div class="trip-route">
            <div class="trip-route-point origin"><i class="fa-solid fa-store"></i></div>
            <div class="trip-route-line"><span style="width:${progress}%"></span></div>
            <div class="trip-route-bike" style="left:calc(${progress}% - 18px)"><i class="fa-solid fa-motorcycle"></i></div>
            <div class="trip-route-point destination"><i class="fa-solid fa-location-dot"></i></div>
          </div>

          <div class="trip-addresses">
            <div><small>COLETA</small><strong>${t.originNeighborhood||"Origem"}</strong></div>
            <i class="fa-solid fa-arrow-right"></i>
            <div class="destination"><small>ENTREGA</small><strong>${t.destinationNeighborhood||"Destino"}</strong></div>
          </div>

          <div class="trip-uber-info">
            <div class="trip-driver-avatar" style="overflow:hidden">
              ${driver&&t.driverPhotoUrl
                ?clientDriverAvatarImage(t.driverPhotoUrl,driver,48)
                :`<i class="fa-solid ${driver?"fa-user":"fa-magnifying-glass"}"></i>`
              }
            </div>
            <div class="trip-driver-data">
              <small>${driver?"ENTREGADOR":"PROCURANDO ENTREGADOR"}</small>
              <strong>${driver||"Aguardando aceite"}</strong>
              <span>${t.createdAt||""}</span>
            </div>
            <span class="trip-status ${cls}">${label}</span>
          </div>

          <div class="trip-steps">
            ${["Solicitada","Corrida aceita","Indo coletar","Produto coletado"].map((name,index)=>`<div class="trip-step ${index<currentStep?"done":index===currentStep?"current":""}"><span>${index<currentStep?'<i class="fa-solid fa-check"></i>':index+1}</span><small>${name}</small></div>`).join("")}
          </div>

          ${waiting?`<button class="btn trip-cancel-btn full" onclick="cancelUserTrip('${t.code}')"><i class="fa-solid fa-ban"></i> Cancelar entrega</button>`:""}
        </article>`;
      }).join("")}
    </section>`:"";

  const finishedHtml=finishedTrips.length?`
    <section class="trips-section finished-trips-section">
      <div class="trips-section-title finished">
        <span><i class="fa-solid fa-clock-rotate-left"></i> Histórico</span>
        <strong>${finishedTrips.length}</strong>
      </div>
      <div class="finished-trips-list">
        ${finishedTrips.map(t=>{
          const paid=String(t.paymentStatus||"").trim().toUpperCase()==="PAGO";
          const receiver=String(t.receiverName||t.recipientName||"O destinatário").trim();
          return `<article class="trip-finished-card">
            <div class="trip-finished-icon"><i class="fa-solid fa-circle-check"></i></div>
            <div class="trip-finished-content">
              <div class="trip-finished-top">
                <strong>Entrega ${t.code}</strong>
                <span class="trip-finished-badge">Finalizada</span>
              </div>
              <span class="trip-finished-route">${t.originNeighborhood||"Origem"} <i class="fa-solid fa-arrow-right"></i> ${t.destinationNeighborhood||"Destino"}</span>
              <small>${finishedTripTime(t)}</small>
              <span class="trip-finished-receiver"><i class="fa-solid fa-circle-check"></i> ${receiver} acabou de receber seu envio!</span>
            </div>
          </article>`;
        }).join("")}
      </div>
    </section>`:"";

  tripsList.innerHTML=activeHtml+finishedHtml||`<div class="trips-empty-state"><i class="fa-solid fa-motorcycle"></i><strong>Nenhuma entrega encontrada</strong><span>Suas entregas em andamento e finalizadas aparecerão aqui.</span></div>`;
}

async function cancelUserTrip(code){
  if(!confirm("Deseja cancelar esta entrega por falta de entregador? A solicitação será apagada."))return;
  try{
    const j=await api("cancelUserTrip",{code});
    toast("Entrega cancelada.");
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
  let remaining=15*60;

  const draw=()=>{
    if(typeof paymentCountdown!=="undefined"&&paymentCountdown){
      const min=Math.floor(remaining/60);
      const sec=remaining%60;
      paymentCountdown.textContent=`${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    }

    if(remaining<=0){
      clearInterval(paymentTimer);
      if(typeof confirmInvoicePayment!=="undefined"&&confirmInvoicePayment){
        confirmInvoicePayment.disabled=true;
      }
      return;
    }

    remaining--;
  };

  draw();
  paymentTimer=setInterval(draw,1000);
}

if(typeof payInvoice!=="undefined"&&payInvoice){
  payInvoice.style.display="";
  payInvoice.onclick=()=>{
    if(typeof invoiceModalBalance!=="undefined"&&invoiceModalBalance && state.user){
      invoiceModalBalance.textContent=money.format(Number(state.user.invoiceBalance||0));
    }
    if(typeof invoicePaymentModal!=="undefined"&&invoicePaymentModal){
      openL("invoicePaymentModal");
    }else if(typeof invoiceSheet!=="undefined"&&invoiceSheet){
      openL("invoiceSheet");
    }
    if(typeof confirmInvoicePayment!=="undefined"&&confirmInvoicePayment){
      confirmInvoicePayment.disabled=false;
    }
    startPaymentCountdown();
  };
}

if(typeof navInvoice!=="undefined"&&navInvoice){
  navInvoice.style.display="";
  navInvoice.onclick=()=>{
    if(typeof invoiceSheet!=="undefined"&&invoiceSheet){
      openL("invoiceSheet");
    }
  };
}

if(typeof confirmInvoicePayment!=="undefined"&&confirmInvoicePayment){
  confirmInvoicePayment.onclick=()=>{
    toast("Pagamento enviado para conferência.");
    if(typeof invoicePaymentModal!=="undefined"&&invoicePaymentModal){
      closeL("invoicePaymentModal");
    }
  };
}
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

function configureLocationWhatsappButton(){
  const btn=document.getElementById("sendWhatsapp");
  if(!btn)return;

  btn.innerHTML=`
    <i class="fa-solid fa-circle-check"></i>
    Confirmar solicitação
  `;
  btn.title="Confirmar que sua solicitação foi enviada";

  bindSendWhatsappAction();
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",configureLocationWhatsappButton,{once:true});
}else{
  configureLocationWhatsappButton();
}
