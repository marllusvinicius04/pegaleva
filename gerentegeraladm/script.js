
const API_URL="https://script.google.com/macros/s/AKfycbxPY3HHffu0PTEXiB7yzfZKbFhHEf9tHOKZgctTooPqN2S0FGLq6vpdmDCMxiigCYMy/exec";
const ADMIN_PASSWORD="ADMMINDEUS1";
const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const state={token:sessionStorage.getItem("pl_admin_token")||"",revision:"",data:null,tripCodes:new Set(),firstLoad:true,timer:null,busy:false,loadingCount:0,allMode:"sales",dailySummary:null,financeReady:false};



const DRIVER_FEE_PERCENT=20;

function n(v){
 return Number(v||0)||0;
}
function esc(v){
 return String(v??"")
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#039;");
}
function planName(plan){
 const p=String(plan||"GRATUITO").toUpperCase();
 return ["GRATUITO","PARCEIRO","PREMIUM"].includes(p)?p:"GRATUITO";
}
function planBadgeClass(plan){
 const p=planName(plan);
 return p==="PREMIUM"?"ok":p==="PARCEIRO"?"blue":"";
}
function userLimitInfo(u){
 const plan=planName(u&&u.plan);
 const used=Math.max(0,n(u&&u.deliveries));
 const raw=u&&u.deliveryLimit;
 const unlimited=String(raw||"").toUpperCase()==="ILIMITADO" || raw===null || raw===undefined || raw==="";
 const limit=unlimited?null:Math.max(0,n(raw));
 const reached=!!(u&&u.limitReached) || (limit!==null && used>=limit);

 return{
  plan,
  used,
  unlimited,
  limit,
  reached,
  text:unlimited?`${used} / ∞`:`${used} / ${limit}`,
  status:unlimited?"Ilimitado":reached?"Limite atingido":"Dentro do limite"
 };
}
function requestedWithdrawalsForDriver(driverId){
 return (state.data?.withdrawals||[])
  .filter(w=>
   String(w.driverId)===String(driverId) &&
   String(w.status||"").toUpperCase()==="SOLICITADO"
  )
  .reduce((sum,w)=>sum+n(w.value),0);
}
function driverFinanceInfo(driver){
 const balance=Math.max(0,n(driver&&driver.balance));
 const requested=Math.max(0,requestedWithdrawalsForDriver(driver&&driver.id));
 const remaining=Math.max(0,balance-requested);
 return{
  balance,
  requested,
  remaining,
  requestValid:requested<=balance,
  feePercent:driver&&driver.autoDiscount===false?0:DRIVER_FEE_PERCENT,
  bonusTotal:Math.max(0,n(driver&&driver.bonusTotal))
 };
}
function withdrawalValidation(w){
 const driver=(state.data?.drivers||[]).find(d=>String(d.id)===String(w.driverId));
 const balance=Math.max(0,n(driver&&driver.balance));
 const requested=Math.max(0,n(w&&w.value));
 const allRequested=Math.max(0,requestedWithdrawalsForDriver(w&&w.driverId));
 const valid=!!driver && requested>0 && requested<=balance && allRequested<=balance;
 return{
  driver,
  balance,
  requested,
  allRequested,
  valid,
  after:Math.max(0,balance-requested),
  reason:!driver
   ?"Entregador não localizado"
   :requested<=0
    ?"Valor inválido"
    :requested>balance
     ?"Solicitação maior que o saldo"
     :allRequested>balance
      ?"Total solicitado maior que o saldo"
      :"Solicitação válida"
 };
}
function driverBasePayout(value,driver){
 const gross=Math.max(0,n(value));
 const fee=driver&&driver.autoDiscount===false?0:DRIVER_FEE_PERCENT;
 return gross*(1-fee/100);
}
function findDriverByTrip(t){
 if(!t)return null;
 const name=String(t.driver||"").trim().toLowerCase();
 if(!name)return null;
 return (state.data?.drivers||[]).find(d=>String(d.name||"").trim().toLowerCase()===name)||null;
}
function ensureAdminEnhancementStyles(){
 if(document.getElementById("adminNewRulesStyles"))return;
 const style=document.createElement("style");
 style.id="adminNewRulesStyles";
 style.textContent=`
  .admin-rule-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 18px}
  .admin-rule-card{padding:16px;border:1px solid var(--line,#e2e8f0);border-radius:16px;background:#fff}
  .admin-rule-card small{display:block;color:var(--muted,#64748b);font-weight:700;margin-bottom:6px}
  .admin-rule-card strong{display:block;font-size:1.15rem;color:var(--text,#172033)}
  .admin-rule-card span{display:block;font-size:.72rem;color:var(--muted,#64748b);margin-top:5px;line-height:1.4}
  .money-positive{color:#16803d!important}
  .money-warning{color:#c56b00!important}
  .money-danger{color:#dc2626!important}
  .finance-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border-radius:999px;font-size:.66rem;font-weight:900;background:#f1f5f9;color:#475569}
  .finance-badge.ok{background:#dcfce7;color:#15803d}
  .finance-badge.warn{background:#fff7ed;color:#c2410c}
  .finance-badge.danger{background:#fee2e2;color:#b91c1c}
  .finance-note{padding:12px 14px;border-radius:14px;background:#f8fbff;border:1px solid #dbe7ff;color:#334155;font-size:.75rem;line-height:1.5;margin-bottom:14px}
  @media(max-width:900px){.admin-rule-grid{grid-template-columns:1fr 1fr}}
  @media(max-width:560px){.admin-rule-grid{grid-template-columns:1fr}}
 `;
 document.head.appendChild(style);
}
function setTableHead(tableBodyId,headers){
 const body=document.getElementById(tableBodyId);
 const table=body&&body.closest("table");
 const head=table&&table.querySelector("thead");
 if(!head)return;
 head.innerHTML=`<tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>`;
}
function ensureFinanceSummary(){
 ensureAdminEnhancementStyles();
 if(document.getElementById("adminFinanceSummary"))return;

 const anchor=
  document.getElementById("withdrawalsTable")?.closest(".card,.table-card,.panel-card") ||
  document.getElementById("driversTable")?.closest(".card,.table-card,.panel-card") ||
  document.getElementById("appView");

 if(!anchor)return;

 const box=document.createElement("div");
 box.id="adminFinanceSummary";
 box.innerHTML=`
  <div class="finance-note">
   <strong><i class="fa-solid fa-circle-info"></i> Regras financeiras atuais</strong><br>
   Entregador com taxa ativa recebe a base líquida após <strong>20%</strong> de taxa.
   Bônus são separados e o saldo/saque oficial é sempre o valor retornado pelo Apps Script.
   O painel não aprova saque acima do saldo atual.
  </div>
  <div class="admin-rule-grid" id="adminFinanceCards"></div>
 `;
 anchor.parentElement?.insertBefore(box,anchor);
}
function renderFinanceSummary(){
 ensureFinanceSummary();
 const cards=document.getElementById("adminFinanceCards");
 if(!cards||!state.data)return;

 const m=state.data.metrics||{};
 const vault=n(m.bonusVault);
 const used=n(m.bonusUsed);
 const remaining=n(m.bonusRemaining);
 const balances=n(m.driverBalances);
 const withdrawals=n(m.requestedWithdrawals);
 const pending=n(m.pendingTotal);

 cards.innerHTML=`
  <div class="admin-rule-card">
   <small>Clientes devem</small>
   <strong>${money.format(pending)}</strong>
   <span>Saldo pendente das faturas dos usuários.</span>
  </div>
  <div class="admin-rule-card">
   <small>Saldo dos entregadores</small>
   <strong>${money.format(balances)}</strong>
   <span>Valor disponível atualmente para saque.</span>
  </div>
  <div class="admin-rule-card">
   <small>Saques solicitados</small>
   <strong class="${withdrawals>balances?"money-danger":"money-warning"}">${money.format(withdrawals)}</strong>
   <span>${withdrawals>balances?"Atenção: total solicitado supera o saldo agregado.":"Aguardando conferência/pagamento."}</span>
  </div>
  <div class="admin-rule-card">
   <small>Taxa do entregador</small>
   <strong>${DRIVER_FEE_PERCENT}%</strong>
   <span>Base usada quando a taxa do entregador está ativa.</span>
  </div>
  <div class="admin-rule-card">
   <small>Cofre de bônus</small>
   <strong>${money.format(vault)}</strong>
   <span>Orçamento configurado para incentivos.</span>
  </div>
  <div class="admin-rule-card">
   <small>Bônus usados / disponíveis</small>
   <strong>${money.format(used)} / ${money.format(remaining)}</strong>
   <span>Consumo e saldo restante do cofre.</span>
  </div>
 `;
}
function ensureDriverShiftField(){
 if(!window.driverForm||document.getElementById("dShift"))return;

 const wrap=document.createElement("label");
 wrap.style.cssText="display:grid;gap:6px";
 wrap.innerHTML=`
  <span style="font-size:.75rem;font-weight:800;color:#64748b">Turno do entregador</span>
  <select id="dShift" style="padding:12px;border:1px solid #cbd5e1;border-radius:10px">
   <option value="MANHA">Manhã</option>
   <option value="TARDE">Tarde</option>
   <option value="NOITE">Noite</option>
   <option value="MANHA,TARDE">Manhã + Tarde</option>
   <option value="MANHA,NOITE">Manhã + Noite</option>
   <option value="TARDE,NOITE">Tarde + Noite</option>
   <option value="MANHA,TARDE,NOITE" selected>Todos os turnos</option>
  </select>
 `;
 const submit=driverForm.querySelector('button[type="submit"],button');
 if(submit)driverForm.insertBefore(wrap,submit);
 else driverForm.appendChild(wrap);

 // A API atual cria o entregador com taxa ativa. Evita um seletor enganoso no painel.
 const oldDiscount=document.getElementById("dDiscount");
 if(oldDiscount){
  const holder=oldDiscount.closest("label,.field,.form-group")||oldDiscount.parentElement;
  if(holder)holder.style.display="none";
 }
 const note=document.createElement("div");
 note.className="finance-note";
 note.innerHTML='<strong>Taxa do entregador:</strong> novos cadastros entram com taxa ativa de 20% conforme a API atual.';
 driverForm.insertBefore(note,driverForm.firstChild);
}
function configureNewRuleTables(){
 setTableHead("usersTable",[
  "Usuário","Contato / Cidade","Plano","Entregas / Limite","Situação do limite",
  "Mensalidade","Fatura pendente","Cadastro"
 ]);
 setTableHead("driversTable",[
  "Entregador","Contato / Placa","Status","Nível / Score","Avaliações",
  "Taxa","Bônus acumulado","Saldo","Saques solicitados","Saldo após solicitações"
 ]);
 setTableHead("withdrawalsTable",[
  "Entregador","Valor solicitado","Saldo atual","Validação","PIX",
  "Data","Ação"
 ]);
 setTableHead("tripsTable",[
  "Código","Empresa","Rota","Entregador","Status","Valor cliente",
  "Base entregador","Data"
 ]);
}

function showLoading(title="Carregando...",text="Aguarde enquanto processamos as informações."){
 state.loadingCount++;
 loadingTitle.textContent=title;
 loadingText.textContent=text;
 globalLoading.classList.add("on");
}
function hideLoading(){
 state.loadingCount=Math.max(0,state.loadingCount-1);
 if(state.loadingCount===0)globalLoading.classList.remove("on");
}
async function withLoading(title,text,task){
 showLoading(title,text);
 try{return await task()}finally{hideLoading()}
}
function setSyncing(on){
 liveStatus.classList.toggle("syncing",!!on);
 liveStatus.textContent=on?"Sincronizando dados...":"Atualização automática";
}
function tableLoading(){
 const row='<tr><td colspan="7" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando informações...</td></tr>';
 tripsTable.innerHTML=row;usersTable.innerHTML=row;driversTable.innerHTML=row;
 pendingTable.innerHTML='<tr><td colspan="4" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando pendências...</td></tr>';
 withdrawalsTable.innerHTML='<tr><td colspan="6" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando solicitações...</td></tr>';
 overviewTrips.innerHTML='<div class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando corridas...</div>';
 overviewPending.innerHTML='<div class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando pendências...</div>';
}

function loadingButton(btn,text){
 const old=btn.innerHTML;
 btn.disabled=true;
 btn.classList.add("loading-btn");
 btn.innerHTML=`<i class="fa-solid fa-spinner"></i> ${text}`;
 return()=>{btn.disabled=false;btn.classList.remove("loading-btn");btn.innerHTML=old};
}

async function api(action,data={},retry=true){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),18000);
 try{
  const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,token:state.token,...data}),signal:ctrl.signal});
  const j=await r.json();if(!j.ok)throw new Error(j.error||"Erro no servidor.");return j
 }catch(e){
  if(retry&&navigator.onLine){await new Promise(r=>setTimeout(r,900));return api(action,data,false)}
  throw e
 }finally{clearTimeout(timer)}
}
function showApp(){loginView.classList.add("hide");appView.classList.remove("hide");startSync()}
function toastMsg(m){toast.textContent=m;toast.classList.add("on");setTimeout(()=>toast.classList.remove("on"),2800)}
toggleAdminPassword.onclick=()=>{
 const showing=adminPassword.type==="text";
 adminPassword.type=showing?"password":"text";
 toggleAdminPassword.innerHTML=`<i class="fa-solid ${showing?"fa-eye":"fa-eye-slash"}"></i>`;
 toggleAdminPassword.setAttribute("aria-label",showing?"Mostrar senha":"Ocultar senha");
 toggleAdminPassword.title=showing?"Mostrar senha":"Ocultar senha";
 adminPassword.focus();
};
loginForm.onsubmit=async e=>{
 e.preventDefault();
 if(adminPassword.value!==ADMIN_PASSWORD)return toastMsg("Senha incorreta.");
 try{
  const j=await withLoading("Entrando no dashboard","Validando sua senha e preparando a central de gestão.",()=>api("adminLogin",{password:adminPassword.value}));
  state.token=j.token;sessionStorage.setItem("pl_admin_token",j.token);showApp()
 }catch(x){toastMsg(x.message)}
};
function finishLogout(){
 clearInterval(state.timer);
 state.timer=null;
 state.token="";
 state.revision="";
 state.data=null;
 state.tripCodes=new Set();
 state.firstLoad=true;
 state.busy=false;
 state.loadingCount=0;
 sessionStorage.removeItem("pl_admin_token");
 globalLoading.classList.remove("on");
 appView.classList.add("hide");
 loginView.classList.remove("hide");
 adminPassword.value="";
 adminPassword.type="password";
 toggleAdminPassword.innerHTML='<i class="fa-solid fa-eye"></i>';
 toggleAdminPassword.setAttribute("aria-label","Mostrar senha");
 toggleAdminPassword.title="Mostrar senha";
}
logoutBtn.onclick=async()=>{
 if(!confirm("Deseja realmente sair do painel?"))return;
 showLoading("Saindo do painel","Encerrando sua sessão administrativa.");
 try{
  await Promise.race([
   api("logout",{},false),
   new Promise(resolve=>setTimeout(resolve,2500))
  ]);
 }catch(e){}
 finally{
  finishLogout();
 }
};

function startSync(){clearInterval(state.timer);loadDashboard();state.timer=setInterval(()=>{if(!state.busy&&!document.hidden&&navigator.onLine)loadDashboard(true)},3000)}
async function loadDashboard(silent=false){
 if(state.busy)return;state.busy=true;
 const initial=!state.data;
 if(initial){tableLoading();showLoading("Carregando dashboard","Buscando corridas, usuários, entregadores e financeiro.")}
 else if(silent)setSyncing(true);
 try{
  const j=await api("adminDashboard",{sinceRevision:state.revision});
  if(j.unchanged)return;
  detectNewTrips(j.trips||[]);
  state.revision=j.revision;state.data=j;renderAll()
 }catch(x){
  if(String(x.message).includes("Sessão expirada")){sessionStorage.removeItem("pl_admin_token");location.reload()}
  else if(!silent)toastMsg(x.message)
 }finally{
  if(initial)hideLoading();
  if(silent)setSyncing(false);
  state.busy=false
 }
}
function detectNewTrips(trips){
 const current=new Set(trips.map(t=>t.code));
 if(!state.firstLoad){
  const fresh=trips.filter(t=>!state.tripCodes.has(t.code));
  if(fresh.length){
   const t=fresh[0];newTripText.textContent=`${t.code} • ${t.requester} • ${money.format(t.value)}`;
   newTripAlert.classList.add("on");setTimeout(()=>newTripAlert.classList.remove("on"),6000);
   try{new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play()}catch(e){}
  }
 }
 state.tripCodes=current;state.firstLoad=false
}

function parseDateBR(value){
 const s=String(value||"");
 const m=s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
 if(m)return `${m[3]}-${m[2]}-${m[1]}`;
 const iso=s.match(/(\d{4})-(\d{2})-(\d{2})/);
 return iso?`${iso[1]}-${iso[2]}-${iso[3]}`:"";
}
function todayISO(){
 const d=new Date(),p=n=>String(n).padStart(2,"0");
 return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function uniqueValues(items,key){
 return [...new Set(items.map(x=>String(x[key]||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}
function openAllModal(mode){
 state.allMode=mode;
 showLoading("Carregando informações",mode==="sales"?"Preparando o histórico completo de vendas.":"Preparando todas as pendências.");
 setTimeout(()=>{
  configureAllModal();
  allDataModal.classList.add("on");
  hideLoading();
 },350);
}
function configureAllModal(){
 const sales=state.allMode==="sales";
 allDataTitle.textContent=sales?"Histórico de vendas":"Todas as pendências";
 allDataSubtitle.textContent=sales?"Consulte vendas por hoje, data, empresa e status.":"Consulte débitos por empresa e faça cobranças ou baixas.";
 allSearch.value="";allPeriod.value=sales?"TODAY":"ALL";allDate.value="";allDate.classList.add("hide");
 const items=sales?(state.data?.trips||[]):(state.data?.users||[]).filter(u=>Number(u.invoiceBalance)>0);
 const companies=uniqueValues(items,sales?"requester":"name");
 allCompany.innerHTML='<option value="">Todas as empresas</option>'+companies.map(v=>`<option>${v}</option>`).join("");
 if(sales){
  const statuses=uniqueValues(items,"status");
  allStatus.classList.remove("hide");
  allStatus.innerHTML='<option value="">Todos os status</option>'+statuses.map(v=>`<option>${v}</option>`).join("");
  allTableHead.innerHTML="<tr><th>Código</th><th>Empresa</th><th>Rota</th><th>Entregador</th><th>Status</th><th>Valor</th><th>Data</th></tr>";
 }else{
  allStatus.classList.add("hide");
  allTableHead.innerHTML="<tr><th>Empresa</th><th>Contato</th><th>Cidade</th><th>Valor pendente</th><th>Ações</th></tr>";
 }
 renderAllModal();
}
function renderAllModal(){
 if(!state.data)return;
 const sales=state.allMode==="sales";
 const q=allSearch.value.trim().toLowerCase();
 const company=allCompany.value;
 const status=allStatus.value;
 const period=allPeriod.value;
 const dateValue=allDate.value;
 let items=sales?[...state.data.trips]:state.data.users.filter(u=>Number(u.invoiceBalance)>0);
 items=items.filter(item=>{
  const text=JSON.stringify(item).toLowerCase();
  if(q&&!text.includes(q))return false;
  const itemCompany=sales?item.requester:item.name;
  if(company&&itemCompany!==company)return false;
  if(sales&&status&&item.status!==status)return false;
  if(sales){
   const itemDate=parseDateBR(item.createdAt);
   if(period==="TODAY"&&itemDate!==todayISO())return false;
   if(period==="CUSTOM"&&dateValue&&itemDate!==dateValue)return false;
  }
  return true;
 });
 if(sales){
  allTableBody.innerHTML=items.map(t=>`<tr><td><strong>${t.code}</strong></td><td>${t.requester}</td><td>${t.origin} → ${t.destination}</td><td>${t.driver||"Aguardando"}</td><td><span class="badge blue">${t.status}</span><br><span class="badge ${String(t.paymentStatus).toUpperCase()==="PAGO"?"ok":""}" style="margin-top:5px">${t.paymentStatus||"PENDENTE"}</span></td><td>${money.format(t.value)}</td><td>${t.createdAt}</td></tr>`).join("")||'<tr><td colspan="7" class="empty">Nenhuma venda encontrada.</td></tr>';
  allTotal.textContent=`Total: ${money.format(items.reduce((s,t)=>s+Number(t.value||0),0))}`;
 }else{
  allTableBody.innerHTML=items.map(u=>`<tr><td><strong>${u.name}</strong><br>${u.email}</td><td>${u.whatsapp}</td><td>${u.city}</td><td><strong>${money.format(u.invoiceBalance)}</strong></td><td><div class="actions"><button class="btn secondary mini" onclick="chargeUser('${u.id}')"><i class="fa-brands fa-whatsapp"></i> Cobrar</button><button class="btn secondary mini" onclick="openDailySummary('${u.id}')"><i class="fa-solid fa-calendar-day"></i> Resumo do dia</button><button class="btn success mini" onclick="markPaid('${u.id}')"><i class="fa-solid fa-check"></i> Marcar pago</button></div></td></tr>`).join("")||'<tr><td colspan="5" class="empty">Nenhuma pendência encontrada.</td></tr>';
  allTotal.textContent=`Total pendente: ${money.format(items.reduce((s,u)=>s+Number(u.invoiceBalance||0),0))}`;
 }
 allCount.textContent=`${items.length} ${items.length===1?"registro":"registros"}`;
}


function openDailySummary(userId=""){
 if(!state.data)return toastMsg("Os dados ainda estão sendo carregados.");
 const users=[...(state.data.users||[])].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
 dailySummaryUser.innerHTML='<option value="">Selecione a empresa</option>'+users.map(u=>`<option value="${u.id}">${u.name} • ${u.travelCode||u.city||""}</option>`).join("");
 if(userId)dailySummaryUser.value=userId;
 dailySummaryDate.value=todayISO();
 dailySummaryPreview.textContent="Selecione uma empresa e uma data para gerar o resumo.";
 dailySummaryStats.classList.add("hide");
 copyDailySummary.disabled=true;
 sendDailySummaryWhatsapp.disabled=true;
 state.dailySummary=null;
 dailySummaryModal.classList.add("on");
}

function buildDailySummaryMessage(summary){
 const trips=Array.isArray(summary.trips)?summary.trips:[];
 const lines=trips.map((t,index)=>{
  const payment=String(t.paymentStatus||"PENDENTE").toUpperCase();
  return `${index+1}. ${t.code} • ${t.origin} → ${t.destination} • ${money.format(Number(t.value||0))} • ${payment}`;
 });
 return[
  `Olá, ${firstName(summary.user?.name)}! Tudo bem? 😊`,
  "",
  `Segue o resumo das entregas realizadas em *${summary.dateLabel}*:`,
  "",
  lines.length?lines.join("\n"):"Nenhuma viagem foi encontrada nessa data.",
  "",
  `*Quantidade de viagens: ${summary.count||0}*`,
  `*Valor total do dia: ${money.format(Number(summary.total||0))}*`,
  `*Total pago: ${money.format(Number(summary.paidTotal||0))}*`,
  `*Total pendente: ${money.format(Number(summary.pendingTotal||0))}*`,
  "",
  "Obrigado pela parceria com a Pega&Leva! 💙🏍️"
 ].join("\n");
}

async function generateSelectedDailySummary(){
 const userId=dailySummaryUser.value;
 const date=dailySummaryDate.value;
 if(!userId)return toastMsg("Selecione uma empresa ou usuário.");
 if(!date)return toastMsg("Selecione a data.");

 try{
  const j=await withLoading(
   "Gerando resumo diário",
   "Buscando todas as viagens da empresa na data selecionada.",
   ()=>api("adminDailyUserSummary",{userId,date})
  );
  state.dailySummary=j;
  const message=buildDailySummaryMessage(j);
  dailySummaryPreview.textContent=message;
  dailySummaryCount.textContent=String(j.count||0);
  dailySummaryTotal.textContent=money.format(Number(j.total||0));
  dailySummaryPending.textContent=money.format(Number(j.pendingTotal||0));
  dailySummaryStats.classList.remove("hide");
  copyDailySummary.disabled=false;
  sendDailySummaryWhatsapp.disabled=!String(j.user?.whatsapp||"").trim();
  if(!j.count)toastMsg("Nenhuma viagem encontrada para essa data.");
 }catch(x){
  toastMsg(x.message);
 }
}

function renderAll(){
 const d=state.data,m=d.metrics||{};
 if(allDataModal.classList.contains("on"))renderAllModal();

 configureNewRuleTables();
 ensureDriverShiftField();
 renderFinanceSummary();

 mSales.textContent=money.format(n(m.salesToday));
 mPending.textContent=money.format(n(m.pendingTotal));
 mUsers.textContent=n(m.users);
 mDrivers.textContent=n(m.drivers);
 mOpen.textContent=n(m.openTrips);
 mDriverBalance.textContent=money.format(n(m.driverBalances));
 mWithdrawals.textContent=money.format(n(m.requestedWithdrawals));
 mTrips.textContent=n(m.trips);

 overviewTrips.innerHTML=d.trips
  .filter(t=>parseDateBR(t.createdAt)===todayISO())
  .slice(0,4)
  .map(t=>{
   const driver=findDriverByTrip(t);
   const base=t.driver?driverBasePayout(t.value,driver):0;
   return `<div class="trip-row" style="padding:10px 0;border-bottom:1px solid var(--line)">
    <strong>${esc(t.code)}</strong>
    <div style="font-size:.68rem;color:var(--muted);margin-top:4px">${esc(t.requester)} • ${esc(t.origin)} → ${esc(t.destination)}</div>
    <div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px">
     <span class="badge blue">${esc(t.status)}</span>
     <div style="text-align:right">
      <strong>${money.format(n(t.value))}</strong>
      ${t.driver?`<small style="display:block;color:var(--muted)">Base entregador: ${money.format(base)}</small>`:""}
     </div>
    </div>
   </div>`;
  }).join("")||'<div class="empty">Nenhuma corrida.</div>';

 const pend=d.users.filter(u=>n(u.invoiceBalance)>0).slice(0,4);
 overviewPending.innerHTML=pend.map(u=>{
  const li=userLimitInfo(u);
  return `<div style="padding:10px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:10px">
   <div>
    <strong>${esc(u.name)}</strong>
    <div style="font-size:.67rem;color:var(--muted)">${esc(u.whatsapp)}</div>
    <div style="margin-top:4px"><span class="finance-badge ${li.reached?"warn":""}">${li.plan} • ${li.text}</span></div>
   </div>
   <strong>${money.format(n(u.invoiceBalance))}</strong>
  </div>`;
 }).join("")||'<div class="empty">Nenhuma pendência.</div>';

 tripsTable.innerHTML=d.trips.map(t=>{
  const driver=findDriverByTrip(t);
  const base=t.driver?driverBasePayout(t.value,driver):0;
  const fee=driver&&driver.autoDiscount===false?0:DRIVER_FEE_PERCENT;
  return `<tr>
   <td><strong>${esc(t.code)}</strong></td>
   <td>${esc(t.requester)}</td>
   <td>${esc(t.origin)} → ${esc(t.destination)}</td>
   <td>${esc(t.driver||"Aguardando")}</td>
   <td>
    <span class="badge blue">${esc(t.status)}</span><br>
    <span class="badge ${String(t.paymentStatus).toUpperCase()==="PAGO"?"ok":""}" style="margin-top:5px">${esc(t.paymentStatus||"PENDENTE")}</span>
   </td>
   <td><strong>${money.format(n(t.value))}</strong></td>
   <td>${t.driver?`<strong>${money.format(base)}</strong><br><small style="color:var(--muted)">base com ${fee}% de taxa${fee===0?" (valor cheio)":""}</small>`:"—"}</td>
   <td>${esc(t.createdAt)}</td>
  </tr>`;
 }).join("");

 usersTable.innerHTML=d.users.map(u=>{
  const li=userLimitInfo(u);
  return `<tr>
   <td><strong>${esc(u.name)}</strong><br><small>${esc(u.email)}</small></td>
   <td>${esc(u.whatsapp)}<br><small>${esc(u.city)}</small></td>
   <td><span class="badge ${planBadgeClass(li.plan)}">${li.plan}</span></td>
   <td><strong>${li.text}</strong></td>
   <td>
    <span class="finance-badge ${li.reached?"warn":"ok"}">${li.status}</span>
    ${li.reached&&li.plan==="PARCEIRO"?'<br><small style="color:#c2410c">Desconto do plano deixa de valer após o limite.</small>':""}
   </td>
   <td>${money.format(n(u.monthlyFee))}</td>
   <td><strong>${money.format(n(u.invoiceBalance))}</strong></td>
   <td>${esc(u.createdAt)}</td>
  </tr>`;
 }).join("");

 driversTable.innerHTML=d.drivers.map(x=>{
  const f=driverFinanceInfo(x);
  const fee=f.feePercent;
  return `<tr>
   <td><strong>${esc(x.name)}</strong><br><small>${esc(x.email)}</small></td>
   <td>${esc(x.whatsapp)}<br><small>${esc(x.plate)}</small></td>
   <td><span class="finance-badge ${String(x.status).toUpperCase()==="ONLINE"?"ok":""}">${esc(x.status||"OFFLINE")}</span><br><small>${esc(String(x.shift||"").replace(/,/g," • "))}</small></td>
   <td><strong>${esc(x.level||"BRONZE")}</strong><br><small>${n(x.score)} pts</small></td>
   <td>${n(x.reviews)}<br><small>${n(x.averageRating)>0?n(x.averageRating).toFixed(1)+" ★":"Sem média"}</small></td>
   <td><span class="finance-badge ${fee===0?"":"warn"}">${fee===0?"Valor cheio":fee+"%"}</span></td>
   <td>${money.format(f.bonusTotal)}</td>
   <td><strong>${money.format(f.balance)}</strong></td>
   <td class="${f.requestValid?"":"money-danger"}">${money.format(f.requested)}${f.requested>0?`<br><small>${f.requestValid?"Dentro do saldo":"Acima do saldo"}</small>`:""}</td>
   <td><strong class="${f.remaining>0?"money-positive":""}">${money.format(f.remaining)}</strong></td>
  </tr>`;
 }).join("");

 pendingTable.innerHTML=d.users
  .filter(u=>n(u.invoiceBalance)>0)
  .map(u=>{
   const li=userLimitInfo(u);
   return `<tr>
    <td><strong>${esc(u.name)}</strong><br>${esc(u.email)}<br><small>${li.plan} • ${li.text}</small></td>
    <td>${esc(u.whatsapp)}</td>
    <td><strong>${money.format(n(u.invoiceBalance))}</strong></td>
    <td><div class="actions">
     <button class="btn secondary mini" onclick="chargeUser('${u.id}')"><i class="fa-brands fa-whatsapp"></i> Cobrar</button>
     <button class="btn secondary mini" onclick="openDailySummary('${u.id}')"><i class="fa-solid fa-calendar-day"></i> Resumo do dia</button>
     <button class="btn success mini" onclick="markPaid('${u.id}')"><i class="fa-solid fa-check"></i> Marcar pago</button>
    </div></td>
   </tr>`;
  }).join("")||'<tr><td colspan="4" class="empty">Nenhuma pendência.</td></tr>';

 withdrawalsTable.innerHTML=d.withdrawals
  .filter(w=>String(w.status).toUpperCase()==="SOLICITADO")
  .map(w=>{
   const v=withdrawalValidation(w);
   return `<tr>
    <td><strong>${esc(w.driverName)}</strong><br><small>${esc(w.email)}</small></td>
    <td><strong>${money.format(v.requested)}</strong></td>
    <td>${v.driver?money.format(v.balance):"—"}</td>
    <td>
     <span class="finance-badge ${v.valid?"ok":"danger"}">${esc(v.reason)}</span>
     ${v.valid?`<br><small>Após pagar: ${money.format(v.after)}</small>`:""}
    </td>
    <td>${esc(w.pixKey)}</td>
    <td>${esc(w.createdAt)}</td>
    <td>
     ${v.valid
      ?`<button class="btn success mini" onclick="completeWithdrawal('${w.id}')"><i class="fa-solid fa-check"></i> Pagar ${money.format(v.requested)}</button>`
      :'<span class="finance-badge danger"><i class="fa-solid fa-triangle-exclamation"></i> Conferir saldo</span>'}
    </td>
   </tr>`;
  }).join("")||'<tr><td colspan="7" class="empty">Nenhuma solicitação.</td></tr>';
}
function wa(number,message){
 let n=String(number||"").replace(/\D/g,"");
 if(!n)return toastMsg("WhatsApp não informado.");
 if(!n.startsWith("55"))n="55"+n;
 window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`,"_blank");
}
function firstName(value){
 return String(value||"").trim().split(/\s+/)[0]||"cliente";
}
function pendingTripsForUser(user){
 const apiTrips=Array.isArray(user.pendingTrips)?user.pendingTrips:[];
 if(apiTrips.length)return apiTrips;
 return (state.data?.trips||[]).filter(t=>
  String(t.userId)===String(user.id)&&
  String(t.paymentStatus||"").toUpperCase()!=="PAGO"
 );
}
function chargeUser(id){
 const u=state.data.users.find(x=>x.id===id);
 if(!u)return toastMsg("Cliente não encontrado.");

 const pending=pendingTripsForUser(u);
 const lines=pending.map((t,index)=>{
  const route=t.origin&&t.destination?` • ${t.origin} → ${t.destination}`:"";
  return `${index+1}. ${t.code}${route} • ${money.format(Number(t.value||0))}`;
 });

 const summary=lines.length
  ?lines.join("\n")
  :"As entregas pendentes estão registradas em sua fatura.";

 const message=[
  `Olá, ${firstName(u.name)}! Tudo bem? 😊`,
  "",
  "Segue o resumo de pagamento pendente das suas últimas entregas realizadas com a Pega&Leva:",
  "",
  summary,
  "",
  `*Valor total pendente: ${money.format(Number(u.invoiceBalance||0))}*`,
  "",
  "Quando realizar o pagamento, pode enviar o comprovante por aqui para conferirmos. Muito obrigado pela parceria! 💙🏍️"
 ].join("\n");

 wa(u.whatsapp,message);
}
async function markPaid(id){
 const u=state.data.users.find(x=>x.id===id);
 if(!u)return toastMsg("Cliente não encontrado.");
 const pending=pendingTripsForUser(u);
 const count=pending.length;
 const detail=count?` Isso marcará ${count} ${count===1?"corrida":"corridas"} como paga(s).`:"";
 if(!confirm(`Confirmar o pagamento de ${money.format(Number(u.invoiceBalance||0))} de ${u.name}?${detail}`))return;

 try{
  const j=await withLoading(
   "Baixando pagamento",
   "Marcando as corridas pendentes como pagas e zerando o saldo do cliente.",
   ()=>api("adminMarkInvoicePaid",{userId:id})
  );
  state.revision="";
  await loadDashboard();
  toastMsg(`${j.updatedTrips||count||0} corrida(s) marcada(s) como paga(s).`);
 }catch(x){
  toastMsg(x.message);
 }
}
async function completeWithdrawal(id){
 const w=state.data?.withdrawals?.find(x=>x.id===id);
 if(!w)return toastMsg("Solicitação não encontrada.");

 const validation=withdrawalValidation(w);
 if(!validation.valid){
  return toastMsg(validation.reason+". Atualize/conferira o saldo antes de pagar.");
 }

 const driver=validation.driver;
 const msg=[
  `Confirmar saque de ${money.format(validation.requested)} para ${w.driverName}?`,
  "",
  `Saldo atual: ${money.format(validation.balance)}`,
  `Valor a transferir: ${money.format(validation.requested)}`,
  `Saldo previsto depois: ${money.format(validation.after)}`,
  "",
  `PIX: ${w.pixKey}`
 ].join("\n");

 if(!confirm(msg))return;

 const observation=prompt(
  `Comprovante/observação do pagamento de ${money.format(validation.requested)} (opcional):`,
  ""
 )||"";

 try{
  const j=await withLoading(
   "Confirmando pagamento do saque",
   `Transferir ${money.format(validation.requested)}. O servidor validará novamente o saldo antes de baixar.`,
   ()=>api("adminCompleteWithdrawal",{withdrawalId:id,observation})
  );

  state.revision="";
  await loadDashboard();

  toastMsg(
   `Saque pago: ${money.format(n(j.amount||validation.requested))}. `+
   `Novo saldo: ${money.format(n(j.newBalance))}.`
  );
 }catch(x){
  toastMsg(x.message);
 }
}

userForm.onsubmit=async e=>{
 e.preventDefault();
 const stopButton=loadingButton(e.submitter||userForm.querySelector("button"),"Cadastrando...");
 try{
  await withLoading("Cadastrando usuário","Salvando os dados do novo cliente.",()=>api("adminRegisterUser",{user:{name:uName.value,email:uEmail.value,password:uPassword.value,whatsapp:uWhatsapp.value,document:uDocument.value,street:uStreet.value,number:uNumber.value,reference:uReference.value,city:uCity.value}}));
  userForm.reset();state.revision="";await loadDashboard();toastMsg("Usuário cadastrado.")
 }catch(x){toastMsg(x.message)}
 finally{stopButton()}
};
driverForm.onsubmit=async e=>{
 e.preventDefault();
 const stopButton=loadingButton(e.submitter||driverForm.querySelector("button"),"Cadastrando...");
 try{
  const shift=document.getElementById("dShift")?.value||"MANHA,TARDE,NOITE";
  await withLoading(
   "Cadastrando entregador",
   "Criando acesso com taxa ativa de 20%, Score inicial Bronze e turno selecionado.",
   ()=>api("adminRegisterDriver",{
    driver:{
     name:dName.value,
     email:dEmail.value,
     password:dPassword.value,
     whatsapp:dWhatsapp.value,
     cpf:dCpf.value,
     plate:dPlate.value,
     shift
    }
   })
  );
  driverForm.reset();
  if(document.getElementById("dShift"))document.getElementById("dShift").value="MANHA,TARDE,NOITE";
  state.revision="";
  await loadDashboard();
  toastMsg("Entregador cadastrado com as regras atuais.");
 }catch(x){toastMsg(x.message)}
 finally{stopButton()}
};

document.querySelectorAll(".menu button[data-panel]").forEach(b=>b.onclick=()=>{
 showLoading("Carregando área",`Preparando ${b.textContent.trim().toLowerCase()}.`);
 setTimeout(()=>{
  document.querySelectorAll(".menu button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
  $(b.dataset.panel).classList.add("active");
  pageTitle.textContent=b.textContent.trim();
  sidebar.classList.remove("on");
  hideLoading();
 },320);
});
document.querySelectorAll("[data-search]").forEach(i=>i.oninput=()=>{
 const q=i.value.toLowerCase();
 const old=i.placeholder;
 i.placeholder="Carregando resultados...";
 setTimeout(()=>{
  document.querySelectorAll(`#${i.dataset.search} tr`).forEach(r=>{
   r.style.display=r.textContent.toLowerCase().includes(q)?"":"none";
  });
  i.placeholder=old;
 },180);
});


closeDailySummary.onclick=()=>dailySummaryModal.classList.remove("on");
dailySummaryModal.onclick=e=>{if(e.target===dailySummaryModal)dailySummaryModal.classList.remove("on")};
generateDailySummary.onclick=generateSelectedDailySummary;
copyDailySummary.onclick=async()=>{
 if(!state.dailySummary)return;
 const message=buildDailySummaryMessage(state.dailySummary);
 try{
  await navigator.clipboard.writeText(message);
  toastMsg("Resumo copiado.");
 }catch(e){
  toastMsg("Não foi possível copiar automaticamente.");
 }
};
sendDailySummaryWhatsapp.onclick=()=>{
 if(!state.dailySummary)return;
 wa(state.dailySummary.user.whatsapp,buildDailySummaryMessage(state.dailySummary));
};

closeAllData.onclick=()=>allDataModal.classList.remove("on");
allDataModal.onclick=e=>{if(e.target===allDataModal)allDataModal.classList.remove("on")};
allSearch.oninput=()=>{showLoading("Filtrando resultados","Aplicando busca nos registros.");setTimeout(()=>{renderAllModal();hideLoading()},220)};
allCompany.onchange=()=>{showLoading("Filtrando por empresa","Atualizando os registros da empresa selecionada.");setTimeout(()=>{renderAllModal();hideLoading()},220)};
allStatus.onchange=()=>{showLoading("Filtrando por status","Atualizando os registros pelo status selecionado.");setTimeout(()=>{renderAllModal();hideLoading()},220)};
allPeriod.onchange=()=>{
 allDate.classList.toggle("hide",allPeriod.value!=="CUSTOM");
 showLoading("Filtrando por período","Atualizando os registros pelo período selecionado.");
 setTimeout(()=>{renderAllModal();hideLoading()},220)
};
allDate.onchange=()=>{showLoading("Filtrando por data","Buscando registros da data selecionada.");setTimeout(()=>{renderAllModal();hideLoading()},220)};

mobileMenu.onclick=()=>sidebar.classList.toggle("on");
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.token)loadDashboard(true)});
window.addEventListener("online",()=>{if(state.token)loadDashboard(true)});

ensureAdminEnhancementStyles();
ensureDriverShiftField();
configureNewRuleTables();

if(state.token)showApp();
