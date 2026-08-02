const API_URL="https://script.google.com/macros/s/AKfycbzLd8po3vGojfYVnHFN7COQwKGiN_nt3yayYUYkB6SsYxLeiwMmU8f1vIsm2Gft3g3qpQ/exec";
const ADMIN_PASSWORD="ADMMINDEUS1";

const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});

const state={
  token:sessionStorage.getItem("pl_mob_admin_token")||"",
  revision:"",
  data:null,
  timer:null,
  busy:false,
  loadingCount:0,
  dailySummary:null
};

const DRIVER_FEE_PERCENT=20;

function n(v){return Number(v||0)||0}
function esc(v){
  return String(v??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}
function normalizeStatus(v){return String(v||"").trim().toUpperCase()}
function statusLabel(status){
  const s=normalizeStatus(status);
  const map={
    "AGUARDANDO ENTREGADOR":"Aguardando motorista",
    "ACEITA":"Aceita",
    "FINALIZANDO CORRIDA PRÓXIMA":"Em fila",
    "ESTOU INDO":"A caminho",
    "FINALIZADA":"Finalizada"
  };
  return map[s]||status||"—";
}
function statusBadge(status){
  const s=normalizeStatus(status);
  if(s==="FINALIZADA")return "ok";
  if(s==="ACEITA"||s==="ESTOU INDO")return "blue";
  if(s==="AGUARDANDO ENTREGADOR")return "warn";
  return "";
}
function paymentBadge(status){
  return normalizeStatus(status)==="PAGO"?"ok":"warn";
}
function shiftText(value){
  return String(value||"MANHA,TARDE,NOITE")
    .replace(/MANHA/g,"Manhã")
    .replace(/TARDE/g,"Tarde")
    .replace(/NOITE/g,"Noite")
    .replace(/,/g," • ");
}

async function api(action,data={},options={}){
  if(!API_URL.startsWith("https://script.google.com/macros/s/")||!API_URL.endsWith("/exec")){
    throw new Error("A URL do Apps Script está inválida. Use a URL publicada terminando em /exec.");
  }

  const ctrl=new AbortController();
  const timeoutMs=Number(options.timeout||45000);
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);

  try{
    const response=await fetch(API_URL,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({
        action:String(action||""),
        token:state.token||"",
        ...data
      }),
      signal:ctrl.signal,
      cache:"no-store",
      redirect:"follow"
    });

    const raw=await response.text();

    if(!response.ok){
      throw new Error(`Servidor respondeu ${response.status}.`);
    }

    let result;
    try{
      result=JSON.parse(raw);
    }catch(parseError){
      const clean=String(raw||"").replace(/\s+/g," ").slice(0,180);
      if(/<!doctype|<html/i.test(clean)){
        throw new Error("A implantação do Apps Script não retornou a API. Publique como Web App e permita acesso pela URL /exec.");
      }
      throw new Error("Resposta inválida do Apps Script.");
    }

    if(!result||result.ok!==true){
      const message=String(result&&result.error||"Erro no servidor.");

      if(/sessão expirada|não autorizado|token/i.test(message)){
        finishLogout();
      }

      throw new Error(message);
    }

    return result;

  }catch(e){
    if(e.name==="AbortError"){
      throw new Error("O Apps Script demorou para responder. Aguarde alguns segundos e tente novamente.");
    }

    const nonRepeatable=[
      "adminLogin",
      "adminRegisterUser",
      "adminRegisterDriver",
      "adminCompleteWithdrawal",
      "logout"
    ].includes(String(action));

    if(
      !options.noRetry &&
      !nonRepeatable &&
      navigator.onLine &&
      /fetch|network|conexão|failed to fetch/i.test(String(e.message||""))
    ){
      await new Promise(r=>setTimeout(r,900));
      return api(action,data,{...options,noRetry:true});
    }

    throw e;
  }finally{
    clearTimeout(timer);
  }
}
function showLoading(title="Carregando...",text="Aguarde enquanto processamos as informações."){
  state.loadingCount++;
  $("loadingTitle").textContent=title;
  $("loadingText").textContent=text;
  $("globalLoading").classList.add("on");
}
function hideLoading(){
  state.loadingCount=Math.max(0,state.loadingCount-1);
  if(state.loadingCount===0)$("globalLoading").classList.remove("on");
}
async function withLoading(title,text,task){
  showLoading(title,text);
  try{return await task()}finally{hideLoading()}
}
function toastMsg(message){
  const el=$("toast");
  el.textContent=message;
  el.classList.add("on");
  setTimeout(()=>el.classList.remove("on"),2800);
}
function setSyncing(on){
  $("liveStatus").classList.toggle("syncing",!!on);
  $("liveStatus").textContent=on?"Sincronizando...":"Atualização automática";
}
function loadingButton(btn,text){
  const old=btn.innerHTML;
  btn.disabled=true;
  btn.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> ${text}`;
  return()=>{
    btn.disabled=false;
    btn.innerHTML=old;
  };
}
function showApp(){
  $("loginView").classList.add("hide");
  $("appView").classList.remove("hide");
  clearInterval(state.timer);
  state.timer=null;
  state.revision="";
  state.data=null;
  startSync();
}
function finishLogout(){
  clearInterval(state.timer);
  state.timer=null;
  state.token="";
  state.revision="";
  state.data=null;
  state.busy=false;
  sessionStorage.removeItem("pl_mob_admin_token");
  $("appView").classList.add("hide");
  $("loginView").classList.remove("hide");
  $("adminPassword").value="";
  $("globalLoading").classList.remove("on");
}
function todayISO(){
  const d=new Date();
  const z=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
}
function parseDateBR(value){
  const text=String(value||"");
  const m=text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m?`${m[3]}-${m[2]}-${m[1]}`:"";
}

function requestedWithdrawalsForDriver(driverId){
  return (state.data?.withdrawals||[])
    .filter(w=>String(w.driverId)===String(driverId)&&normalizeStatus(w.status)==="SOLICITADO")
    .reduce((sum,w)=>sum+n(w.value),0);
}
function driverFinanceInfo(driver){
  const balance=Math.max(0,n(driver?.balance));
  const requested=Math.max(0,requestedWithdrawalsForDriver(driver?.id));
  return{
    balance,
    requested,
    remaining:Math.max(0,balance-requested),
    valid:requested<=balance,
    feePercent:driver?.autoDiscount===false?0:DRIVER_FEE_PERCENT,
    bonusTotal:Math.max(0,n(driver?.bonusTotal))
  };
}
function withdrawalValidation(w){
  const driver=(state.data?.drivers||[]).find(d=>String(d.id)===String(w.driverId));
  const requested=Math.max(0,n(w?.value));
  const balance=Math.max(0,n(driver?.balance));
  const allRequested=requestedWithdrawalsForDriver(w?.driverId);
  const valid=!!driver&&requested>0&&requested<=balance&&allRequested<=balance;

  return{
    driver,
    requested,
    balance,
    allRequested,
    valid,
    after:Math.max(0,balance-requested),
    reason:!driver
      ?"Motorista não localizado"
      :requested<=0
        ?"Valor inválido"
        :requested>balance
          ?"Maior que o saldo"
          :allRequested>balance
            ?"Saques superam o saldo"
            :"Solicitação válida"
  };
}
function findDriverByTrip(trip){
  const name=String(trip?.driver||"").trim().toLowerCase();
  if(!name)return null;
  return (state.data?.drivers||[]).find(d=>String(d.name||"").trim().toLowerCase()===name)||null;
}
function driverBasePayout(value,driver){
  const gross=Math.max(0,n(value));
  const fee=driver?.autoDiscount===false?0:DRIVER_FEE_PERCENT;
  return Math.max(0,gross*(1-fee/100));
}

function renderFinanceCards(targetId){
  const target=$(targetId);
  if(!target||!state.data)return;

  const m=state.data.metrics||{};
  const vault=n(m.bonusVault);
  const used=n(m.bonusUsed);
  const remaining=n(m.bonusRemaining);
  const balances=n(m.driverBalances);
  const withdrawals=n(m.requestedWithdrawals);

  target.innerHTML=`
    <div class="finance-card">
      <span class="finance-icon"><i class="fa-solid fa-wallet"></i></span>
      <div><small>Saldo motoristas</small><strong>${money.format(balances)}</strong><p>Saldo disponível nas contas dos motoristas.</p></div>
    </div>
    <div class="finance-card">
      <span class="finance-icon orange"><i class="fa-solid fa-money-bill-transfer"></i></span>
      <div><small>Saques solicitados</small><strong>${money.format(withdrawals)}</strong><p>Valores aguardando pagamento.</p></div>
    </div>
    <div class="finance-card">
      <span class="finance-icon purple"><i class="fa-solid fa-vault"></i></span>
      <div><small>Cofre de bônus</small><strong>${money.format(vault)}</strong><p>Orçamento configurado para incentivos.</p></div>
    </div>
    <div class="finance-card">
      <span class="finance-icon green"><i class="fa-solid fa-fire"></i></span>
      <div><small>Bônus usados</small><strong>${money.format(used)}</strong><p>Restam ${money.format(remaining)} no cofre.</p></div>
    </div>`;
}

function renderOverview(){
  const d=state.data||{};
  const m=d.metrics||{};

  $("mSales").textContent=money.format(n(m.salesToday));
  $("mPaidToday").textContent=money.format(n(m.paidToday));
  $("mUsers").textContent=n(m.users);
  $("mDrivers").textContent=n(m.drivers);
  $("mOpen").textContent=n(m.openTrips);
  $("mDriverBalance").textContent=money.format(n(m.driverBalances));
  $("mWithdrawals").textContent=money.format(n(m.requestedWithdrawals));
  $("mTrips").textContent=n(m.trips);

  renderFinanceCards("financeSummary");
  renderFinanceCards("financePanelCards");

  const recent=(d.trips||[]).slice(0,6);
  $("overviewTrips").innerHTML=recent.length?recent.map(t=>`
    <div class="overview-row">
      <span class="overview-route-icon"><i class="fa-solid fa-route"></i></span>
      <div class="overview-copy">
        <strong>${esc(t.requester||"Usuário")}</strong>
        <small>${esc(t.origin||"—")} → ${esc(t.destination||"—")}</small>
        <div class="overview-badges">
          <span class="badge ${statusBadge(t.status)}">${esc(statusLabel(t.status))}</span>
          <span class="badge ${paymentBadge(t.paymentStatus)}">${esc(t.paymentStatus||"PENDENTE")}</span>
        </div>
      </div>
      <div class="overview-value">
        <strong>${money.format(n(t.value))}</strong>
        <small>${esc(t.tripType||"VIAGEM")}</small>
      </div>
    </div>`).join(""):'<div class="empty">Nenhuma viagem registrada.</div>';

  const online=(d.drivers||[]).filter(x=>normalizeStatus(x.status)==="ONLINE");
  $("onlineDriverCount").textContent=`${online.length} online`;
  $("overviewDrivers").innerHTML=online.length?online.slice(0,7).map(x=>`
    <div class="driver-mini-row">
      <span class="online-dot"></span>
      <div>
        <strong>${esc(x.name)}</strong>
        <small>${esc(x.plate||"Sem placa")} • ${esc(x.level||"BRONZE")} • ${n(x.score)} pts</small>
      </div>
      <span class="rating-mini">${n(x.averageRating)>0?n(x.averageRating).toFixed(1)+" ★":"—"}</span>
    </div>`).join(""):'<div class="empty">Nenhum motorista online.</div>';
}

function renderTrips(){
  const trips=state.data?.trips||[];

  $("tripsTable").innerHTML=trips.length?trips.map(t=>{
    const driver=findDriverByTrip(t);
    const fee=driver?.autoDiscount===false?0:DRIVER_FEE_PERCENT;
    const base=t.driver?driverBasePayout(t.value,driver):0;

    return `<tr>
      <td><strong>${esc(t.code)}</strong></td>
      <td><strong>${esc(t.requester||"—")}</strong><br><small>${esc(t.requesterWhatsapp||"")}</small></td>
      <td>${esc(t.origin||"—")} <i class="fa-solid fa-arrow-right route-arrow"></i> ${esc(t.destination||"—")}</td>
      <td>${t.driver?`<strong>${esc(t.driver)}</strong>`:'<span class="muted">Aguardando</span>'}</td>
      <td><span class="badge ${statusBadge(t.status)}">${esc(statusLabel(t.status))}</span></td>
      <td><span class="badge ${paymentBadge(t.paymentStatus)}">${esc(t.paymentStatus||"PENDENTE")}</span></td>
      <td><span class="trip-type">${esc(t.tripType||"VIAGEM")}</span></td>
      <td><strong>${money.format(n(t.value))}</strong></td>
      <td>${t.driver?`<strong>${money.format(base)}</strong><br><small>${fee}% taxa base</small>`:"—"}</td>
      <td>${esc(t.createdAt||"")}</td>
    </tr>`;
  }).join(""):'<tr><td colspan="10" class="empty">Nenhuma viagem encontrada.</td></tr>';
}

function renderUsers(){
  const users=state.data?.users||[];

  $("usersTable").innerHTML=users.length?users.map(u=>`
    <tr>
      <td><strong>${esc(u.name)}</strong><br><small>${esc(u.email)}</small></td>
      <td>${esc(u.whatsapp||"—")}</td>
      <td>${esc(u.city||"—")}</td>
      <td><span class="code-pill">${esc(u.travelCode||"—")}</span></td>
      <td><strong>${n(u.trips)}</strong></td>
      <td>${esc(u.createdAt||"")}</td>
      <td><button class="btn secondary mini" onclick="openDailySummary('${esc(u.id)}')"><i class="fa-solid fa-calendar-day"></i> Resumo</button></td>
    </tr>`).join(""):'<tr><td colspan="7" class="empty">Nenhum usuário cadastrado.</td></tr>';
}

function renderDrivers(){
  const drivers=state.data?.drivers||[];

  $("driversTable").innerHTML=drivers.length?drivers.map(d=>{
    const f=driverFinanceInfo(d);
    const online=normalizeStatus(d.status)==="ONLINE";

    return `<tr>
      <td><strong>${esc(d.name)}</strong><br><small>${esc(d.email)}</small></td>
      <td>${esc(d.whatsapp||"—")}<br><small>${esc(d.plate||"Sem placa")}</small></td>
      <td><span class="driver-status ${online?"online":"offline"}"><i class="fa-solid fa-circle"></i> ${online?"ONLINE":"OFFLINE"}</span></td>
      <td><strong>${esc(d.level||"BRONZE")}</strong><br><small>${n(d.score)} pontos</small></td>
      <td><strong>${n(d.reviews)}</strong><br><small>${n(d.averageRating)>0?n(d.averageRating).toFixed(1)+" ★":"Sem média"}</small></td>
      <td>${esc(shiftText(d.shift))}</td>
      <td><span class="badge ${f.feePercent===0?"ok":"warn"}">${f.feePercent===0?"Valor cheio":f.feePercent+"%"}</span></td>
      <td><strong>${money.format(f.bonusTotal)}</strong></td>
      <td><strong>${money.format(f.balance)}</strong></td>
      <td class="${f.valid?"":"money-danger"}">${money.format(f.requested)}</td>
      <td><strong class="${f.remaining>0?"money-positive":""}">${money.format(f.remaining)}</strong></td>
    </tr>`;
  }).join(""):'<tr><td colspan="11" class="empty">Nenhum motorista cadastrado.</td></tr>';
}

function renderWithdrawals(){
  const withdrawals=(state.data?.withdrawals||[])
    .filter(w=>normalizeStatus(w.status)==="SOLICITADO");

  $("withdrawalsTable").innerHTML=withdrawals.length?withdrawals.map(w=>{
    const v=withdrawalValidation(w);

    return `<tr>
      <td><strong>${esc(w.driverName)}</strong><br><small>${esc(w.email||"")}</small></td>
      <td><strong>${money.format(v.requested)}</strong></td>
      <td>${v.driver?money.format(v.balance):"—"}</td>
      <td>
        <span class="validation ${v.valid?"valid":"invalid"}">
          <i class="fa-solid ${v.valid?"fa-circle-check":"fa-triangle-exclamation"}"></i>
          ${esc(v.reason)}
        </span>
        ${v.valid?`<small class="after-withdraw">Depois: ${money.format(v.after)}</small>`:""}
      </td>
      <td><span class="pix-key">${esc(w.pixKey||"—")}</span></td>
      <td>${esc(w.createdAt||"")}</td>
      <td>
        ${v.valid
          ?`<button class="btn success mini" onclick="completeWithdrawal('${esc(w.id)}')"><i class="fa-solid fa-check"></i> Confirmar pagamento</button>`
          :'<span class="badge warn">Conferir</span>'}
      </td>
    </tr>`;
  }).join(""):'<tr><td colspan="7" class="empty">Nenhuma solicitação de saque.</td></tr>';
}

function renderAll(){
  if(!state.data)return;
  renderOverview();
  renderTrips();
  renderUsers();
  renderDrivers();
  renderWithdrawals();
}

async function loadDashboard(silent=false){
  if(state.busy||!state.token)return;

  state.busy=true;
  setSyncing(true);

  try{
    const firstLoad=!state.data;
    const j=await api(
      "adminDashboard",
      {sinceRevision:firstLoad?"":state.revision},
      {
        timeout:firstLoad?60000:18000,
        noRetry:!!silent
      }
    );

    // Se o servidor disser "unchanged" antes de termos os dados,
    // força uma leitura completa na mesma sessão.
    if(j.unchanged&&firstLoad){
      state.revision="";
      const full=await api(
        "adminDashboard",
        {sinceRevision:"__FORCE_FULL__"},
        {timeout:60000,noRetry:true}
      );

      state.revision=String(full.revision||"");
      state.data=full;
      renderAll();
      return;
    }

    if(!j.unchanged){
      state.revision=String(j.revision||state.revision||"");
      state.data=j;
      renderAll();
    }

  }catch(e){
    if(!silent){
      toastMsg(e.message||"Não foi possível carregar a gestão.");
    }
  }finally{
    state.busy=false;
    setSyncing(false);
  }
}
function startSync(){
  clearInterval(state.timer);

  loadDashboard(false);

  state.timer=setInterval(()=>{
    if(
      state.token &&
      !state.busy &&
      !document.hidden &&
      navigator.onLine
    ){
      loadDashboard(true);
    }
  },6000);
}

function panelTitle(panel){
  return ({
    overview:"Visão geral",
    trips:"Viagens",
    users:"Usuários",
    drivers:"Motoristas",
    finance:"Financeiro",
    register:"Cadastros"
  })[panel]||"Gestão";
}
function openPanel(panel){
  document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x.id===panel));
  document.querySelectorAll(".menu [data-panel]").forEach(x=>x.classList.toggle("active",x.dataset.panel===panel));
  $("pageTitle").textContent=panelTitle(panel);
  $("sidebar").classList.remove("on");
}
document.querySelectorAll("[data-panel]").forEach(btn=>{
  btn.onclick=()=>openPanel(btn.dataset.panel);
});
document.querySelectorAll("[data-go-panel]").forEach(btn=>{
  btn.onclick=()=>openPanel(btn.dataset.goPanel);
});

async function completeWithdrawal(id){
  const w=state.data?.withdrawals?.find(x=>String(x.id)===String(id));
  if(!w)return toastMsg("Solicitação não encontrada.");

  const v=withdrawalValidation(w);
  if(!v.valid)return toastMsg(v.reason);

  const message=[
    `Confirmar saque de ${money.format(v.requested)} para ${w.driverName}?`,
    "",
    `Saldo atual: ${money.format(v.balance)}`,
    `Valor a transferir: ${money.format(v.requested)}`,
    `Saldo previsto depois: ${money.format(v.after)}`,
    "",
    `PIX: ${w.pixKey}`
  ].join("\n");

  if(!confirm(message))return;

  const observation=prompt("Observação/comprovante do pagamento (opcional):","")||"";

  try{
    const j=await withLoading(
      "Confirmando saque",
      `Registrando pagamento de ${money.format(v.requested)} para ${w.driverName}.`,
      ()=>api("adminCompleteWithdrawal",{withdrawalId:id,observation},{timeout:30000,noRetry:true})
    );

    state.revision="";
    await loadDashboard();
    toastMsg(`Saque pago. Novo saldo: ${money.format(n(j.newBalance))}.`);
  }catch(e){
    toastMsg(e.message);
  }
}

function openDailySummary(userId=""){
  const users=state.data?.users||[];
  $("dailySummaryUser").innerHTML='<option value="">Selecione</option>'+
    users.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} • ${esc(u.travelCode||u.city||"")}</option>`).join("");

  if(userId)$("dailySummaryUser").value=userId;
  $("dailySummaryDate").value=todayISO();
  $("dailySummaryPreview").textContent="Selecione um usuário e uma data para gerar o resumo.";
  $("dailySummaryStats").classList.add("hide");
  state.dailySummary=null;
  $("dailySummaryModal").classList.add("on");
}
function buildDailySummaryMessage(j){
  const trips=j?.trips||[];

  const lines=[
    `*Pega&Leva Mobilidade • Resumo de viagens*`,
    "",
    `Usuário: ${j.user?.name||""}`,
    `Data: ${j.dateLabel||j.date||""}`,
    "",
    ...trips.map(t=>
      `• ${t.code} | ${t.origin} → ${t.destination} | ${money.format(n(t.value))} | ${t.paymentStatus}`
    ),
    "",
    `Viagens: ${n(j.count)}`,
    `Total: ${money.format(n(j.total))}`,
    `Pago: ${money.format(n(j.paidTotal))}`,
    `Pendente: ${money.format(n(j.pendingTotal))}`
  ];

  return lines.join("\n");
}
$("generateDailySummary").onclick=async()=>{
  const userId=$("dailySummaryUser").value;
  const date=$("dailySummaryDate").value;
  if(!userId||!date)return toastMsg("Selecione o usuário e a data.");

  try{
    const j=await withLoading(
      "Gerando resumo",
      "Buscando as viagens desse usuário no dia selecionado.",
      ()=>api("adminDailyUserSummary",{userId,date},{timeout:20000})
    );

    state.dailySummary=j;
    $("dailySummaryCount").textContent=n(j.count);
    $("dailySummaryTotal").textContent=money.format(n(j.total));
    $("dailySummaryPaid").textContent=money.format(n(j.paidTotal));
    $("dailySummaryPending").textContent=money.format(n(j.pendingTotal));
    $("dailySummaryStats").classList.remove("hide");
    $("dailySummaryPreview").textContent=buildDailySummaryMessage(j);
  }catch(e){
    toastMsg(e.message);
  }
};
$("copyDailySummary").onclick=async()=>{
  if(!state.dailySummary)return toastMsg("Gere o resumo primeiro.");
  try{
    await navigator.clipboard.writeText(buildDailySummaryMessage(state.dailySummary));
    toastMsg("Resumo copiado.");
  }catch(e){
    toastMsg("Não foi possível copiar.");
  }
};
$("whatsappDailySummary").onclick=()=>{
  if(!state.dailySummary)return toastMsg("Gere o resumo primeiro.");
  let phone=String(state.dailySummary.user?.whatsapp||"").replace(/\D/g,"");
  if(!phone)return toastMsg("Usuário sem WhatsApp cadastrado.");
  if(!phone.startsWith("55"))phone="55"+phone;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildDailySummaryMessage(state.dailySummary))}`,"_blank");
};
$("closeDailySummary").onclick=()=>$("dailySummaryModal").classList.remove("on");
$("dailySummaryModal").onclick=e=>{
  if(e.target===$("dailySummaryModal"))$("dailySummaryModal").classList.remove("on");
};

$("userForm").onsubmit=async e=>{
  e.preventDefault();
  const stop=loadingButton(e.submitter,"Cadastrando...");

  try{
    await withLoading(
      "Cadastrando usuário",
      "Criando uma nova conta de mobilidade.",
      ()=>api("adminRegisterUser",{user:{
        name:$("uName").value.trim(),
        email:$("uEmail").value.trim().toLowerCase(),
        password:$("uPassword").value,
        whatsapp:$("uWhatsapp").value.replace(/\D/g,""),
        document:$("uDocument").value.replace(/\D/g,""),
        street:$("uStreet").value.trim(),
        number:$("uNumber").value.trim(),
        reference:$("uReference").value.trim(),
        city:$("uCity").value
      }},{timeout:30000,noRetry:true})
    );

    e.currentTarget.reset();
    state.revision="";
    await loadDashboard();
    toastMsg("Usuário cadastrado.");
  }catch(err){
    toastMsg(err.message);
  }finally{
    stop();
  }
};

$("driverForm").onsubmit=async e=>{
  e.preventDefault();
  const stop=loadingButton(e.submitter,"Cadastrando...");

  try{
    await withLoading(
      "Cadastrando motorista",
      "Criando acesso com Score inicial Bronze e turno selecionado.",
      ()=>api("adminRegisterDriver",{driver:{
        name:$("dName").value.trim(),
        email:$("dEmail").value.trim().toLowerCase(),
        password:$("dPassword").value,
        whatsapp:$("dWhatsapp").value.replace(/\D/g,""),
        cpf:$("dCpf").value.replace(/\D/g,""),
        plate:$("dPlate").value.trim().toUpperCase(),
        shift:$("dShift").value
      }},{timeout:30000,noRetry:true})
    );

    e.currentTarget.reset();
    $("dShift").value="MANHA,TARDE,NOITE";
    state.revision="";
    await loadDashboard();
    toastMsg("Motorista cadastrado.");
  }catch(err){
    toastMsg(err.message);
  }finally{
    stop();
  }
};

document.querySelectorAll("[data-search]").forEach(input=>{
  input.oninput=()=>{
    const body=$(input.dataset.search);
    const q=input.value.trim().toLowerCase();

    [...body.querySelectorAll("tr")].forEach(row=>{
      row.style.display=!q||row.textContent.toLowerCase().includes(q)?"":"none";
    });
  };
});

$("toggleAdminPassword").onclick=()=>{
  const input=$("adminPassword");
  const showing=input.type==="text";
  input.type=showing?"password":"text";
  $("toggleAdminPassword").innerHTML=`<i class="fa-solid ${showing?"fa-eye":"fa-eye-slash"}"></i>`;
};

$("loginForm").onsubmit=async e=>{
  e.preventDefault();

  const password=$("adminPassword").value;

  if(!password){
    return toastMsg("Digite a senha administrativa.");
  }

  try{
    const j=await withLoading(
      "Conectando à gestão",
      "Validando o Apps Script e carregando a central.",
      ()=>api(
        "adminLogin",
        {password},
        {timeout:60000,noRetry:true}
      )
    );

    if(!j.token){
      throw new Error("O Apps Script não retornou a sessão administrativa.");
    }

    state.token=String(j.token);
    state.revision="";
    state.data=null;

    sessionStorage.setItem("pl_mob_admin_token",state.token);

    showApp();

  }catch(err){
    state.token="";
    sessionStorage.removeItem("pl_mob_admin_token");
    toastMsg(err.message||"Não foi possível entrar na gestão.");
  }
};

$("logoutBtn").onclick=async()=>{
  try{await api("logout",{}, {timeout:6000,noRetry:true})}catch(e){}
  finishLogout();
};
$("mobileMenu").onclick=()=>$("sidebar").classList.toggle("on");
$("refreshBtn").onclick=async()=>{
  if(state.busy)return;

  $("refreshBtn").classList.add("rotating");
  state.revision="";

  try{
    await loadDashboard(false);
  }finally{
    setTimeout(()=>$("refreshBtn").classList.remove("rotating"),400);
  }
};

document.addEventListener("visibilitychange",()=>{
  if(!document.hidden&&state.token)loadDashboard(true);
});
window.addEventListener("online",()=>{
  if(state.token){toastMsg("Conexão restabelecida.");loadDashboard(true)}
});
window.addEventListener("offline",()=>toastMsg("Você está sem internet."));

if(state.token){
  showApp();
}else{
  $("loginView").classList.remove("hide");
  $("appView").classList.add("hide");
}
