const API="https://script.google.com/macros/s/AKfycbxYv4UOTDPWrr7Kdpu-oZdgQqGyGc8ZX-0OOBk6vFrwENvlBcjyDrCNBhyF3MxvS_8GsA/exec";
let motoca=null,online=false,pollTimer=null,lastOfferId=null,currentOffer=null,audioCtx=null,pendingPhotoBase64="",pendingPhotoMime="",waitRideId=null,paymentRideId=null,paymentMethod=null,photoToOpen="",waitIntervals={},chatRideId=null,chatTimer=null,chatLastCount=-1,chatUnreadByRide={},chatBusy=false,chatPendingRefresh=false,lastActiveStatuses={};
const $=id=>document.getElementById(id),val=id=>$(id).value.trim();
let balanceVisible=true,balanceRealValue=0;
function renderBalanceVisibility(){
  const saldoEl=$("saldo"),eye=$("balanceEye");
  if(!saldoEl||!eye)return;
  saldoEl.textContent=balanceVisible?money(balanceRealValue):"R$ ****";
  eye.innerHTML=balanceVisible?'<i class="fa-solid fa-eye"></i>':'<i class="fa-solid fa-eye-slash"></i>';
  eye.setAttribute("aria-label",balanceVisible?"Ocultar saldo":"Mostrar saldo");
}
function toggleBalanceVisibility(){
  balanceVisible=!balanceVisible;
  renderBalanceVisibility();
}
function loading(on,text="Carregando..."){$("loadingText").textContent=text;$("loading").classList.toggle("hidden",!on)}
async function api(action,data={}){try{const r=await fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,data})});return await r.json()}catch(e){return{ok:false,message:"Falha de conexão."}}}
document.addEventListener("DOMContentLoaded",async()=>{bind();await loadCities();initOfferSwipe();const s=localStorage.getItem("motocas_motoca");if(s){motoca=JSON.parse(s);validateSession()}});
function bind(){
$("loginForm").onsubmit=async e=>{e.preventDefault();loading(true,"Entrando...");const r=await api("loginMotoca",{email:val("loginEmail"),senha:val("loginSenha")});loading(false);if(!r.ok)return msg("loginMsg",r.message,true);motoca=r.user;localStorage.setItem("motocas_motoca",JSON.stringify(motoca));handleStatus()};
$("cadForm").onsubmit=async e=>{
  e.preventDefault();

  if(val("senha").length<6)return msg("cadMsg","A senha deve ter pelo menos 6 caracteres.",true);
  if(val("senha")!==val("senhaConfirm"))return msg("cadMsg","As senhas não coincidem.",true);

  loading(true,"Enviando cadastro...");
  const dados={
    nome:val("nome"),
    email:val("email"),
    cpf:val("cpf"),
    telefone:val("telefone"),
    cidade:val("cidade"),
    senha:val("senha"),
    cnh:val("cnh"),
    marca:val("marca"),
    modelo:val("modelo"),
    cor:val("cor"),
    placa:val("placa"),
    ano:val("ano")
  };

  const r=await api("cadastrarMotoca",dados);
  loading(false);

  if(!r.ok)return msg("cadMsg",r.message,true);

  motoca={
    id:r.id,
    nome:dados.nome,
    email:dados.email.toLowerCase(),
    telefone:dados.telefone.replace(/\D/g,""),
    cidade:dados.cidade,
    status:"PENDENTE",
    online:false,
    fotoUrl:"",
    fotoDataUrl:""
  };

  localStorage.setItem("motocas_motoca",JSON.stringify(motoca));

  $("auth").classList.add("hidden");
  $("welcomeName").textContent=motoca.nome;
  $("welcome").classList.remove("hidden");
};
$("photoInput").addEventListener("change",handlePhoto);
}
function continueAfterSignup(){
  if(!motoca)return;
  $("welcome").classList.add("hidden");
  showApproval();
}
function cadStep(n){
  [1,2,3].forEach(i=>{
    $("cadStep"+i).classList.toggle("hidden",i!==n);
    $("cadP"+i).classList.toggle("on",i<=n);
  });
}

function openSupportWhatsApp(){
  const url="https://wa.me/5589994029572?text="+encodeURIComponent("Olá! Preciso de suporte no Motocas App.");
  window.open(url,"_blank");
}

function requestAccountDeletion(){
  const nome=motoca&&motoca.nome||"";
  const email=motoca&&motoca.email||"";
  const msg=`Olá! Quero solicitar a exclusão definitiva da minha conta de Motoca no Motocas App.\n\nNome: ${nome}\nE-mail: ${email}`;
  const url="https://wa.me/5589994029572?text="+encodeURIComponent(msg);
  window.open(url,"_blank");
}

function toggleMenu(force){
  const open=typeof force==="boolean"?force:!$("sideMenu").classList.contains("open");
  $("sideMenu").classList.toggle("open",open);
  $("drawerOverlay").classList.toggle("show",open);
}
function mode(m){["loginForm","cadForm","forgotForm"].forEach(x=>$(x).classList.add("hidden"));$("tabLogin").classList.toggle("active",m==="login");$("tabCad").classList.toggle("active",m==="cad");if(m==="login")$("loginForm").classList.remove("hidden");if(m==="cad"){$("cadForm").classList.remove("hidden");cadStep(1);}if(m==="forgot")$("forgotForm").classList.remove("hidden")}
async function loadCities(){const r=await api("listarCidades");if(r.ok)$("cidade").innerHTML='<option value="">Selecione</option>'+r.cidades.map(c=>`<option>${esc(c)}</option>`).join("")}
async function validateSession(){const r=await api("statusMotoca",{motocaId:motoca.id});if(!r.ok)return logout();motoca.status=r.status;motoca.online=r.online;if(r.fotoDataUrl)motoca.fotoDataUrl=r.fotoDataUrl;localStorage.setItem("motocas_motoca",JSON.stringify(motoca));handleStatus()}
function handleStatus(){$("auth").classList.add("hidden");if(motoca.status!=="APROVADO")return showApproval();openApp()}
function showApproval(){$("auth").classList.add("hidden");$("app").classList.add("hidden");$("approval").classList.remove("hidden");$("approvalText").textContent=motoca.status==="BLOQUEADO"?"Sua conta está bloqueada.":motoca.status==="REPROVADO"?"Seu cadastro não foi aprovado.":"Recebemos seu cadastro. Nossa equipe está revisando seus dados."}
async function openApp(){$("approval").classList.add("hidden");$("app").classList.remove("hidden");$("first").textContent=motoca.nome.split(" ")[0];$("cityTop").textContent=motoca.cidade;$("drawerName").textContent=motoca.nome||"Motoca";$("drawerEmail").textContent=motoca.email||"";online=!!motoca.online;renderOnline();await loadBalance();await loadActiveRides();clearInterval(pollTimer);pollTimer=setInterval(async()=>{await loadActiveRides();if(online)await pollOffer()},3000)}
function ensureAudio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume()}
async function toggleOnline(){ensureAudio();loading(true,online?"Ficando offline...":"Ficando online...");const r=await api("definirOnlineMotoca",{motocaId:motoca.id,online:!online});loading(false);if(!r.ok)return alert(r.message);online=!online;motoca.online=online;localStorage.setItem("motocas_motoca",JSON.stringify(motoca));renderOnline();if(online)pollOffer();else $("offerPopup").classList.remove("show")}
function renderOnline(){$("rangeSwitch").classList.toggle("online",online);$("statusLabel").textContent=online?"ONLINE":"OFFLINE";$("statusLabel").style.color=online?"var(--ok)":"var(--danger)"}
async function loadBalance(){const r=await api("resumoGanhosMotoca",{motocaId:motoca.id});if(!r.ok)return;balanceRealValue=Number(r.saldo)||0;renderBalanceVisibility();$("corridasCount").textContent=`${r.quantidade} corridas`;$("statTrips").textContent=r.quantidade;$("statMoney").textContent=money(r.saldo);$("statRating").textContent=(Number(r.mediaAvaliacao)||0).toFixed(1);$("grossValue").textContent=money(r.bruto);$("feeValue").textContent=money(r.taxa);$("netValue").textContent=money(r.saldo);$("withdrawName").textContent=motoca.nome||"";$("withdrawEmail").textContent=motoca.email||"";$("withdrawAmount").textContent=money(r.saldo)}
async function pollOffer(){const r=await api("buscarCorridaDisponivel",{motocaId:motoca.id,cidade:motoca.cidade});if(!r.ok||!r.corrida)return $("offerPopup").classList.remove("show");const c=r.corrida;if(lastOfferId!==c.id){lastOfferId=c.id;currentOffer=c;playIncoming();$("offerBody").innerHTML=`<div class="route">${esc(c.origemBairro)} → ${esc(c.destinoBairro)}</div><p class="small">${esc(c.origemEndereco)}</p><div class="fare">${money(c.valor)}</div>`;$("offerPopup").classList.add("show");resetSwipe($("offerSwipe"))}}
function playIncoming(){
  try{
    ensureAudio();
    const pattern=[560,760,980,760,1080,820];
    pattern.forEach((freq,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+i*.16;
      o.type=i%2?"square":"sine";
      o.frequency.value=freq;
      g.gain.setValueAtTime(.001,t);
      g.gain.exponentialRampToValueAtTime(.28,t+.02);
      g.gain.exponentialRampToValueAtTime(.001,t+.13);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);o.stop(t+.15);
    });
    if(navigator.vibrate)navigator.vibrate([250,120,250,120,400]);
  }catch(e){}
  strongAlert("Nova corrida disponível","Uma nova viagem chegou para você.","incoming");
}

function strongAlert(title,text,type="info"){
  const el=$("systemAlert");
  if(!el)return;
  $("systemAlertTitle").innerHTML=`<i class="fa-solid ${type==="finish"?"fa-circle-check":"fa-bell"}"></i>${esc(title)}`;
  $("systemAlertText").textContent=text||"";
  el.classList.add("show");

  if(type==="finish"){
    try{
      ensureAudio();
      [660,880,1040].forEach((f,i)=>{
        const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+i*.17;
        o.frequency.value=f;
        g.gain.setValueAtTime(.001,t);
        g.gain.exponentialRampToValueAtTime(.2,t+.02);
        g.gain.exponentialRampToValueAtTime(.001,t+.15);
        o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+.17);
      });
      if(navigator.vibrate)navigator.vibrate([180,80,180]);
    }catch(e){}
  }

  clearTimeout(strongAlert._t);
  strongAlert._t=setTimeout(()=>el.classList.remove("show"),4500);
}

function rideStateKey(){
  return motoca&&motoca.id?`motocas_ride_state_${motoca.id}`:"motocas_ride_state";
}
function saveRideState(state){
  if(!state){localStorage.removeItem(rideStateKey());return}
  localStorage.setItem(rideStateKey(),JSON.stringify(state));
}
function getRideState(){
  try{return JSON.parse(localStorage.getItem(rideStateKey())||"null")}catch(e){return null}
}
function restoreRideState(rides){
  const st=getRideState();
  if(!st||!Array.isArray(rides))return;
  const ride=rides.find(c=>c.id===st.rideId);
  if(!ride){saveRideState(null);return}

  if(st.stage==="PAYMENT"&&(ride.status==="EM_CORRIDA"||ride.status==="AGUARDANDO_PAGAMENTO")){
    setTimeout(()=>openPayment(ride.id,true),180);
  }
  if(st.stage==="PAYMENT_CONFIRM"&&ride.status==="AGUARDANDO_PAGAMENTO"){
    paymentRideId=ride.id;
    paymentMethod=st.method||"PIX";
    setTimeout(async()=>{
      await openPayment(ride.id,true);
      $("confirmPaymentText").textContent=paymentMethod==="PIX"?"Confirma que recebeu o pagamento via Pix?":"Confirma que recebeu o pagamento em espécie?";
      $("confirmPaymentModal").classList.remove("hidden");
    },180);
  }
}

function initOfferSwipe(){makeSwipe($("offerSwipe"),async()=>{if(!currentOffer)return;loading(true,"Aceitando...");const r=await api("aceitarCorrida",{corridaId:currentOffer.id,motocaId:motoca.id});loading(false);if(!r.ok)return alert(r.message);$("offerPopup").classList.remove("show");lastOfferId=null;currentOffer=null;loadActiveRides()},async()=>{if(!currentOffer)return;await api("recusarCorrida",{corridaId:currentOffer.id,motocaId:motoca.id});$("offerPopup").classList.remove("show");lastOfferId=null;currentOffer=null})}
async function loadActiveRides(){
  const r=await api("listarCorridasAtivasMotoca",{motocaId:motoca.id});
  if(!r.ok)return;

  const box=$("activeCarousel");
  const currentIds=new Set(r.corridas.map(c=>c.id));

  Object.keys(lastActiveStatuses).forEach(id=>{
    if(!currentIds.has(id)&&lastActiveStatuses[id]){
      strongAlert("Viagem finalizada","Corrida concluída com sucesso.","finish");
    }
  });

  if(!r.corridas.length){
    box.innerHTML='<div class="small">Nenhuma corrida aceita.</div>';
    lastActiveStatuses={};
    saveRideState(null);
    return;
  }

  box.innerHTML=r.corridas.map((c,i)=>rideCard(c,i)).join("");
  r.corridas.forEach(c=>lastActiveStatuses[c.id]=c.status);

  startWaitDisplays(r.corridas);
  pollMotocaChatBadges(r.corridas);
  restoreRideState(r.corridas);
}
function rideCard(c,i){const photo=c.passageiroFotoDataUrl?`<img src="${c.passageiroFotoDataUrl}">`:`<span>${esc((c.passageiroNome||"P")[0])}</span>`;const origin=mapsLink(c.origemNumero,c.origemLogradouro,c.cidade),dest=mapsLink(c.destinoNumero,c.destinoLogradouro,c.cidade);let action="";if(c.status==="ACEITA")action=`<button class="btn" onclick="setRideStatus('${c.id}','A_CAMINHO')">ESTOU A CAMINHO</button>`;if(c.status==="A_CAMINHO")action=`<button class="btn" onclick="setRideStatus('${c.id}','CHEGOU')">AVISAR QUE CHEGUEI</button>`;if(c.status==="CHEGOU")action=`<button class="btn" onclick="setRideStatus('${c.id}','EM_CORRIDA')"><i class="fa-solid fa-motorcycle"></i> INICIAR CORRIDA</button>`;if(c.status==="EM_CORRIDA")action=`<button class="ride-action-btn payment" onclick="openPayment(\'${c.id}\')"><i class="fa-solid fa-wallet"></i> IR PARA PAGAMENTO</button>`;if(c.status==="AGUARDANDO_PAGAMENTO"&&c.pagamentoStatus==="CONFIRMADO")action=`<button class="ride-action-btn finish" onclick="finalizeRide(\'${c.id}\')"><i class="fa-solid fa-circle-check"></i> FINALIZAR VIAGEM</button>`;else if(c.status==="AGUARDANDO_PAGAMENTO")action=`<button class="ride-action-btn payment" onclick="openPayment(\'${c.id}\')"><i class="fa-solid fa-wallet"></i> ABRIR PAGAMENTO</button>`;return `<article class="card ride-card"><div class="status">CORRIDA ${i+1} • ${esc(c.status)}</div><div class="person"><div class="avatar" onclick="openPhoto('${encodeURIComponent(c.passageiroFotoDataUrl||"")}')">${photo}</div><div><strong>${esc(c.passageiroNome)}</strong><div class="small">${esc(formatPhone(c.passageiroTelefone||""))}</div></div></div><div style="background:#f6f8f9;border-radius:16px;padding:12px;margin-top:10px">
<div class="small">PICKUP</div>
<strong>${esc(c.origemBairro)} → ${esc(c.destinoBairro)}</strong>
<div class="small" style="margin-top:7px"><strong>Origem:</strong> ${esc(c.origemLogradouro)} ${esc(c.origemNumero||"0")}</div>
${c.origemReferencia?`<div class="small"><i class="fa-solid fa-map-pin" style="color:var(--s)"></i> Referência: ${esc(c.origemReferencia)}</div>`:""}
<div class="small" style="margin-top:6px"><strong>Destino:</strong> ${esc(c.destinoLogradouro)} ${esc(c.destinoNumero||"0")}</div>
${c.destinoReferencia?`<div class="small"><i class="fa-solid fa-map-pin" style="color:var(--s)"></i> Referência: ${esc(c.destinoReferencia)}</div>`:""}
</div>
<div class="map-actions">
<a class="map-link" target="_blank" href="${origin}"><i class="fa-solid fa-map-location-dot"></i> ORIGEM</a>
<a class="map-link" target="_blank" href="${dest}"><i class="fa-solid fa-location-arrow"></i> DESTINO</a>
<a class="map-link" target="_blank" href="${whatsLink(c.passageiroTelefone)}"><i class="fa-brands fa-whatsapp"></i> WHATSAPP</a>
</div><div class="fare">${money(c.ganhoMotoca||c.valor)}</div><small class="small">Ganho líquido atual</small>${c.status==="EM_CORRIDA"||c.status==="AGUARDANDO_PAGAMENTO"?`<div class="wait-card"><div class="wait-row"><span class="small">Espera</span><span id="waitTime_${c.id}" class="wait-time">${formatDuration(c.esperaSegundos||0)}</span></div><div class="wait-row"><span class="small">Adicional</span><span id="waitMoney_${c.id}" class="wait-money">${money(c.esperaValorAtual||0)}</span></div>${c.status==="EM_CORRIDA"?(c.esperaAtiva?`<button class="btn btn-light" onclick="stopWait('${c.id}')"><i class="fa-solid fa-stopwatch"></i> PARAR ESPERA</button>`:`<button class="btn btn-light" onclick="askStartWait('${c.id}')"><i class="fa-solid fa-stopwatch"></i> ATIVAR ESPERA</button>`):""}</div>`:""}${action}<button class="ride-chat-btn" onclick="openChat(\'${c.id}\')"><i class="fa-solid fa-comments"></i> CHAT COM PASSAGEIRO <span id="chatBadge_${c.id}" class="ride-chat-badge">0</span></button></article>`}

function openChat(rideId){
  if(!rideId)return;
  chatRideId=rideId;
  chatLastCount=-1;
  $("chatDrawer").classList.add("open");
  $("chatOverlay").classList.add("show");
  markMotocaChatSeen(rideId);
  loadChat(true);
  clearInterval(chatTimer);
  chatTimer=setInterval(()=>{if(!chatBusy)loadChat(false)},800);
}

function closeChat(){
  if(chatRideId)markMotocaChatSeen(chatRideId);
  clearInterval(chatTimer);
  chatTimer=null;
  chatRideId=null;
  chatBusy=false;
  chatPendingRefresh=false;
  if($("chatDrawer"))$("chatDrawer").classList.remove("open");
  if($("chatOverlay"))$("chatOverlay").classList.remove("show");
}

async function loadChat(forceScroll=false){
  if(!chatRideId||!motoca)return false;

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
      participanteTipo:"MOTOCA",
      participanteId:motoca.id
    });

    if(!r.ok)return false;

    
    if(!forceScroll&&chatLastCount===r.mensagens.length)return true;
    chatLastCount=r.mensagens.length;

    const box=$("chatMessages");
    box.innerHTML=r.mensagens.map(m=>{
      const mine=m.remetenteTipo==="MOTOCA";
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
  if(!chatRideId||!motoca)return;
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
      remetenteTipo:"MOTOCA",
      remetenteId:motoca.id,
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


function appendOptimisticChat(text){
  const box=$("chatMessages");
  if(!box)return;
  const div=document.createElement("div");
  div.className="chat-msg me";
  div.innerHTML=`${esc(text)}<small>agora</small>`;
  box.appendChild(div);
  box.scrollTop=box.scrollHeight;
}

function updateMotocaChatBadge(rideId,count){
  chatUnreadByRide[rideId]=count;
  const b=$("chatBadge_"+rideId);
  if(!b)return;
  b.textContent=count>9?"9+":String(count);
  b.classList.toggle("show",count>0);
}

async function pollMotocaChatBadges(rides){
  if(!motoca||!Array.isArray(rides))return;
  for(const c of rides){
    if(chatRideId===c.id)continue;
    const r=await api("listarChatCorrida",{
      corridaId:c.id,
      participanteTipo:"MOTOCA",
      participanteId:motoca.id
    });
    if(!r.ok)continue;
    const otherCount=r.mensagens.filter(m=>m.remetenteTipo==="PASSAGEIRO").length;
    const key="motocas_chat_seen_mot_"+c.id;
    const seen=Number(localStorage.getItem(key)||0);
    updateMotocaChatBadge(c.id,Math.max(0,otherCount-seen));
  }
}

function markMotocaChatSeen(rideId){
  if(!rideId||!motoca)return;
  api("listarChatCorrida",{
    corridaId:rideId,
    participanteTipo:"MOTOCA",
    participanteId:motoca.id
  }).then(r=>{
    if(!r.ok)return;
    const otherCount=r.mensagens.filter(m=>m.remetenteTipo==="PASSAGEIRO").length;
    localStorage.setItem("motocas_chat_seen_mot_"+rideId,String(otherCount));
    updateMotocaChatBadge(rideId,0);
  });
}


async function sendChatPhoto(input){
  const file=input.files&&input.files[0];
  if(!file||!chatRideId||!motoca)return;
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
      remetenteTipo:"MOTOCA",
      remetenteId:motoca.id,
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

function mapsLink(numero,logradouro,cidade){
  const q=[numero||"0",logradouro,cidade].filter(Boolean).join(" ");
  return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(q);
}
function whatsLink(phone){let p=String(phone||"").replace(/\D/g,"");if(p.startsWith("55")&&p.length>11)p=p.slice(2);if(p.length<10)return "#";p="55"+p;const text="Olá, cheguei no local de origem. Onde você está? Sou o motorista do Motocas App.";return "https://wa.me/"+p+"?text="+encodeURIComponent(text)}
function formatPhone(phone){let p=String(phone||"").replace(/\D/g,"");if(p.startsWith("55")&&p.length>11)p=p.slice(2);if(p.length===11)return `${p.slice(0,2)} ${p.slice(2,3)} ${p.slice(3,7)}-${p.slice(7)}`;if(p.length===10)return `${p.slice(0,2)} ${p.slice(2,6)}-${p.slice(6)}`;return p}
function maskPhone(el){let p=el.value.replace(/\D/g,"");if(p.startsWith("55")&&p.length>11)p=p.slice(2);p=p.slice(0,11);if(p.length>7)el.value=`${p.slice(0,2)} ${p.slice(2,3)} ${p.slice(3,7)}-${p.slice(7)}`;else if(p.length>3)el.value=`${p.slice(0,2)} ${p.slice(2,3)} ${p.slice(3)}`;else if(p.length>2)el.value=`${p.slice(0,2)} ${p.slice(2)}`;else el.value=p}
function startWaitDisplays(rides){
  const ativos=new Set(rides.filter(c=>c.esperaAtiva).map(c=>c.id));
  Object.keys(waitIntervals).forEach(id=>{
    if(!ativos.has(id)){clearInterval(waitIntervals[id]);delete waitIntervals[id]}
  });
  rides.forEach(c=>{
    updateWaitEl(c);
    if(!c.esperaAtiva||waitIntervals[c.id])return;
    waitIntervals[c.id]=setInterval(()=>{
      const t=$("waitTime_"+c.id);
      if(!t){clearInterval(waitIntervals[c.id]);delete waitIntervals[c.id];return}
      c.esperaSegundos=(Number(c.esperaSegundos)||0)+1;
      const segundosBloco=Math.max(60,Number(c.esperaSegundosBloco)||300);
      c.esperaValorAtual=Math.floor(c.esperaSegundos/segundosBloco)*(Number(c.esperaValorBloco)||0.78);
      updateWaitEl(c);
    },1000);
  });
}
function updateWaitEl(c){const t=$("waitTime_"+c.id),m=$("waitMoney_"+c.id);if(t)t.textContent=formatDuration(c.esperaSegundos||0);if(m)m.textContent=money(c.esperaValorAtual||0)}
function formatDuration(sec){sec=Math.floor(Number(sec)||0);const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h>0?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
async function askStartWait(id){
  waitRideId=id;
  const r=await api("resumoEspera",{corridaId:id});
  const taxa=r.ok?money(r.valorPorBloco):"R$ 0,78";
  const minutos=r.ok?Number(r.minutosPorBloco)||5:5;
  $("waitConfirmText").innerHTML=`Use apenas quando houver espera extra ou tempo adicional relacionado à corrida. Será acrescentado <strong>${taxa} a cada ${minutos} ${minutos===1?"minuto completo":"minutos completos"}</strong> enquanto estiver ativo.`;
  $("waitConfirmModal").classList.remove("hidden");
}
function closeWaitConfirm(){$("waitConfirmModal").classList.add("hidden");waitRideId=null}
async function confirmStartWait(){if(!waitRideId)return;loading(true,"Ativando espera...");const r=await api("iniciarEspera",{corridaId:waitRideId,motocaId:motoca.id});loading(false);if(!r.ok)return alert(r.message);closeWaitConfirm();loadActiveRides()}
async function stopWait(id){if(waitIntervals[id]){clearInterval(waitIntervals[id]);delete waitIntervals[id]}loading(true,"Parando espera...");const r=await api("pararEspera",{corridaId:id,motocaId:motoca.id});loading(false);if(!r.ok)return alert(r.message);loadActiveRides()}
async function setRideStatus(id,status){loading(true,"Atualizando...");const r=await api("atualizarStatusCorrida",{corridaId:id,motocaId:motoca.id,status});loading(false);if(!r.ok)return alert(r.message);loadActiveRides()}
async function openPayment(id,restoring=false){
  const lista=await api("listarCorridasAtivasMotoca",{motocaId:motoca.id});
  const c=lista.ok?lista.corridas.find(x=>x.id===id):null;

  if(c&&c.status==="AGUARDANDO_PAGAMENTO"&&c.pagamentoStatus==="CONFIRMADO"){
    saveRideState({rideId:id,stage:"READY_TO_FINISH"});
    if(!restoring)strongAlert("Pagamento confirmado","Agora finalize a viagem.","finish");
    return;
  }

  loading(true,"Preparando pagamento...");
  const r=await api("prepararPagamento",{corridaId:id,motocaId:motoca.id});
  loading(false);
  if(!r.ok)return alert(r.message);

  paymentRideId=id;
  saveRideState({rideId:id,stage:"PAYMENT"});
  $("paymentTotal").textContent=money(r.total);
  $("paymentModal").classList.remove("hidden");
  renderPixQr(r.total);
}
function renderPixQr(amount){$("qrcode").innerHTML="";const payload=pixPayload("57293143000156","MARLLUS VINICIUS","URUCUI",Number(amount)||0);new QRCode($("qrcode"),{text:payload,width:190,height:190})}
function confirmPaymentChoice(method){
  paymentMethod=method;
  saveRideState({rideId:paymentRideId,stage:"PAYMENT_CONFIRM",method});
  $("confirmPaymentText").textContent=method==="PIX"?"Confirma que recebeu o pagamento via Pix?":"Confirma que recebeu o pagamento em espécie?";
  $("confirmPaymentModal").classList.remove("hidden");
}
function closeConfirmPayment(){$("confirmPaymentModal").classList.add("hidden")}
async function confirmPaymentNow(){
  loading(true,"Confirmando pagamento...");
  const r=await api("confirmarPagamentoCorrida",{corridaId:paymentRideId,motocaId:motoca.id,metodo:paymentMethod});
  loading(false);
  if(!r.ok)return alert(r.message);

  $("confirmPaymentModal").classList.add("hidden");
  $("paymentModal").classList.add("hidden");
  saveRideState({rideId:paymentRideId,stage:"READY_TO_FINISH"});
  await loadActiveRides();
  strongAlert("Pagamento confirmado","Pagamento recebido. Finalize a viagem no botão verde.","finish");
}
async function finalizeRide(id){
  if(!confirm("Confirmar finalização desta viagem?"))return;
  loading(true,"Finalizando...");
  const r=await api("finalizarCorrida",{corridaId:id,motocaId:motoca.id});
  loading(false);
  if(!r.ok)return alert(r.message);

  saveRideState(null);
  closeChat();
  await loadBalance();
  await loadActiveRides();
  strongAlert("Viagem finalizada","Corrida concluída e saldo atualizado.","finish");
}
function pixPayload(key,name,city,amount){const f=(id,val)=>id+String(val.length).padStart(2,"0")+val;const merchant=f("00","BR.GOV.BCB.PIX")+f("01",key);let p=f("00","01")+f("26",merchant)+f("52","0000")+f("53","986")+f("54",amount.toFixed(2))+f("58","BR")+f("59",name.substring(0,25).toUpperCase())+f("60",city.substring(0,15).toUpperCase())+f("62",f("05","MOTOCAS"))+"6304";return p+crc16(p)}
function crc16(str){let crc=0xFFFF;for(let i=0;i<str.length;i++){crc^=str.charCodeAt(i)<<8;for(let j=0;j<8;j++)crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xFFFF}return crc.toString(16).toUpperCase().padStart(4,"0")}
function makeSwipe(el,onRight,onLeft,rightOnly=false){if(!el)return;const knob=el.querySelector(".swipe-knob");let start=0,dx=0,down=false;const reset=()=>{knob.style.transition=".2s";knob.style.left="50%";knob.style.transform="translateX(-50%)";setTimeout(()=>knob.style.transition="",220)};el.onpointerdown=e=>{down=true;start=e.clientX;el.setPointerCapture(e.pointerId)};el.onpointermove=e=>{if(!down)return;dx=e.clientX-start;const lim=el.clientWidth/2-knob.clientWidth/2-8;if(rightOnly)dx=Math.max(0,dx);dx=Math.max(-lim,Math.min(lim,dx));knob.style.left=`calc(50% + ${dx}px)`};el.onpointerup=async e=>{if(!down)return;down=false;const threshold=el.clientWidth*.28;if(dx>threshold&&onRight){await onRight()}else if(dx<-threshold&&onLeft&&!rightOnly){await onLeft()}reset();dx=0}}
function resetSwipe(el){if(!el)return;const k=el.querySelector(".swipe-knob");k.style.left="50%";k.style.transform="translateX(-50%)"}
function showView(v){["home","trips","earnings","profile"].forEach(x=>{$(x+"View").classList.toggle("active",x===v);$("nav"+cap(x)).classList.toggle("active",x===v)});if(v==="trips")loadTrips();if(v==="earnings"){loadBalance();loadWithdrawals();}if(v==="profile")loadProfile()}
function cap(s){return s[0].toUpperCase()+s.slice(1)}
async function loadTrips(){const r=await api("listarCorridasMotoca",{motocaId:motoca.id});$("tripsList").innerHTML=r.ok?r.corridas.map(c=>`<div class="card"><strong>${esc(c.origemBairro)} → ${esc(c.destinoBairro)}</strong><br><small>${esc(c.status)} • ${money((Number(c.valor)||0)+(Number(c.esperaValor)||0))}</small><br><small>Seu ganho: ${money(c.ganhoMotoca||0)}</small></div>`).join(""):"Erro"}
async function requestWithdraw(){loading(true,"Solicitando saque...");const r=await api("solicitarSaque",{motocaId:motoca.id,chavePix:val("withdrawPix")});loading(false);if(!r.ok)return msg("withdrawMsg",r.message,true);msg("withdrawMsg",r.message);await loadWithdrawals();await loadBalance()}
async function loadWithdrawals(){const r=await api("listarSaquesMotoca",{motocaId:motoca.id});if(!r.ok)return;$("withdrawList").innerHTML=r.saques.map(s=>`<div class="card" style="padding:12px"><strong>${money(s.valor)}</strong><br><small class="small">${esc(s.status)} • ${esc(s.solicitadoEm)}</small></div>`).join("")}
async function loadProfile(){const r=await api("obterPerfilMotoca",{motocaId:motoca.id});if(!r.ok)return alert(r.message);motoca={...motoca,...r.perfil};localStorage.setItem("motocas_motoca",JSON.stringify(motoca));$("profileName").value=motoca.nome||"";$("profileEmail").value=motoca.email||"";$("profilePhone").value=formatPhone(motoca.telefone||"");renderProfilePhoto(motoca.fotoDataUrl)}
function renderProfilePhoto(src){$("profilePhoto").innerHTML=src?`<img src="${src}">`:`<i class="fa-solid fa-user"></i>`}
function handlePhoto(e){const f=e.target.files[0];if(!f)return;if(f.size>6*1024*1024)return alert("Escolha uma imagem de até 6 MB.");const rd=new FileReader();rd.onload=()=>{const img=new Image();img.onload=()=>{const max=600,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);pendingPhotoMime="image/jpeg";pendingPhotoBase64=c.toDataURL("image/jpeg",.78);renderProfilePhoto(pendingPhotoBase64)};img.src=rd.result};rd.readAsDataURL(f)}
async function saveProfile(){loading(true,"Salvando...");const r=await api("atualizarPerfilMotoca",{motocaId:motoca.id,email:val("profileEmail"),telefone:val("profilePhone"),fotoBase64:pendingPhotoBase64,fotoMime:pendingPhotoMime});loading(false);if(!r.ok)return msg("profileMsg",r.message,true);motoca={...motoca,...r.perfil};localStorage.setItem("motocas_motoca",JSON.stringify(motoca));pendingPhotoBase64="";renderProfilePhoto(motoca.fotoDataUrl);msg("profileMsg","Perfil atualizado.")}
function openPhoto(encoded){const src=decodeURIComponent(encoded||"");if(!src)return;$("fullPhoto").src=src;$("photoModal").classList.remove("hidden")}
function closePhoto(){$("photoModal").classList.add("hidden")}
async function sendReset(){loading(true,"Enviando...");const r=await api("solicitarResetSenha",{tipo:"MOTOCA",email:val("forgotEmail")});loading(false);if(!r.ok)return msg("forgotMsg",r.message,true);$("reset2").classList.remove("hidden");msg("forgotMsg","Código enviado.")}
async function confirmReset(){loading(true,"Redefinindo...");const r=await api("confirmarResetSenha",{tipo:"MOTOCA",email:val("forgotEmail"),codigo:val("resetCode"),novaSenha:val("newPass")});loading(false);if(!r.ok)return msg("forgotMsg",r.message,true);msg("forgotMsg","Senha redefinida.");setTimeout(()=>mode("login"),800)}
function logout(){
  localStorage.removeItem("motocas_motoca");
  sessionStorage.removeItem("motocas_motoca");
  clearInterval(pollTimer);
  pollTimer=null;

  Object.keys(waitIntervals||{}).forEach(id=>clearInterval(waitIntervals[id]));
  waitIntervals={};

  motoca=null;
  online=false;
  lastOfferId=null;
  currentOffer=null;
  paymentRideId=null;
  waitRideId=null;

  if($("offerPopup"))$("offerPopup").classList.remove("show");
  if($("app"))$("app").classList.add("hidden");
  if($("welcome"))$("welcome").classList.add("hidden");
  if($("approval"))$("approval").classList.add("hidden");
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
