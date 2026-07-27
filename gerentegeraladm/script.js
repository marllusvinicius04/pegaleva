
const API_URL="https://script.google.com/macros/s/AKfycbyn3065wcnSaDbtTGkjf78a-E5xvuyTn_grtEbWaS3LO8ziPX_I8BmrCKb3NzE3Mk_Y/exec";
const ADMIN_PASSWORD="ADMMINDEUS1";
const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const state={token:sessionStorage.getItem("pl_admin_token")||"",revision:"",data:null,tripCodes:new Set(),firstLoad:true,timer:null,busy:false,loadingCount:0,allMode:"sales",dailySummary:null};


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

function startSync(){clearInterval(state.timer);loadDashboard();state.timer=setInterval(()=>{if(!document.hidden&&navigator.onLine)loadDashboard(true)},6000)}
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
 const d=state.data,m=d.metrics;if(allDataModal.classList.contains("on"))renderAllModal();
 mSales.textContent=money.format(m.salesToday);mPending.textContent=money.format(m.pendingTotal);mUsers.textContent=m.users;mDrivers.textContent=m.drivers;
 mOpen.textContent=m.openTrips;mDriverBalance.textContent=money.format(m.driverBalances);mWithdrawals.textContent=money.format(m.requestedWithdrawals);mTrips.textContent=m.trips;
 overviewTrips.innerHTML=d.trips.filter(t=>parseDateBR(t.createdAt)===todayISO()).slice(0,4).map(t=>`<div class="trip-row" style="padding:10px 0;border-bottom:1px solid var(--line)"><strong>${t.code}</strong><div style="font-size:.68rem;color:var(--muted);margin-top:4px">${t.requester} • ${t.origin} → ${t.destination}</div><div style="display:flex;justify-content:space-between;margin-top:6px"><span class="badge blue">${t.status}</span><strong>${money.format(t.value)}</strong></div></div>`).join("")||'<div class="empty">Nenhuma corrida.</div>';
 const pend=d.users.filter(u=>u.invoiceBalance>0).slice(0,4);overviewPending.innerHTML=pend.map(u=>`<div style="padding:10px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:10px"><div><strong>${u.name}</strong><div style="font-size:.67rem;color:var(--muted)">${u.whatsapp}</div></div><strong>${money.format(u.invoiceBalance)}</strong></div>`).join("")||'<div class="empty">Nenhuma pendência.</div>';
 tripsTable.innerHTML=d.trips.map(t=>`<tr><td><strong>${t.code}</strong></td><td>${t.requester}</td><td>${t.origin} → ${t.destination}</td><td>${t.driver||"Aguardando"}</td><td><span class="badge blue">${t.status}</span><br><span class="badge ${String(t.paymentStatus).toUpperCase()==="PAGO"?"ok":""}" style="margin-top:5px">${t.paymentStatus||"PENDENTE"}</span></td><td>${money.format(t.value)}</td><td>${t.createdAt}</td></tr>`).join("");
 usersTable.innerHTML=d.users.map(u=>`<tr><td><strong>${u.name}</strong><br>${u.email}</td><td>${u.whatsapp}</td><td>${u.city}</td><td>${u.travelCode}</td><td>${money.format(u.invoiceBalance)}</td><td>${u.createdAt}</td></tr>`).join("");
 driversTable.innerHTML=d.drivers.map(x=>`<tr><td><strong>${x.name}</strong><br>${x.email}</td><td>${x.whatsapp}</td><td>${x.plate}</td><td>${money.format(x.balance)}</td><td>${x.autoDiscount?"Ativo":"Inativo"}</td><td>${x.createdAt}</td></tr>`).join("");
 pendingTable.innerHTML=d.users.filter(u=>u.invoiceBalance>0).map(u=>`<tr><td><strong>${u.name}</strong><br>${u.email}</td><td>${u.whatsapp}</td><td><strong>${money.format(u.invoiceBalance)}</strong></td><td><div class="actions"><button class="btn secondary mini" onclick="chargeUser('${u.id}')"><i class="fa-brands fa-whatsapp"></i> Cobrar</button><button class="btn secondary mini" onclick="openDailySummary('${u.id}')"><i class="fa-solid fa-calendar-day"></i> Resumo do dia</button><button class="btn success mini" onclick="markPaid('${u.id}')"><i class="fa-solid fa-check"></i> Marcar pago</button></div></td></tr>`).join("")||'<tr><td colspan="4" class="empty">Nenhuma pendência.</td></tr>';
 withdrawalsTable.innerHTML=d.withdrawals.filter(w=>String(w.status).toUpperCase()==="SOLICITADO").map(w=>`<tr><td><strong>${w.driverName}</strong><br>${w.email}</td><td><strong>${money.format(w.value)}</strong></td><td>${w.pixKey}</td><td><span class="badge ${w.status==="PAGO"?"ok":""}">${w.status}</span></td><td>${w.createdAt}</td><td>${w.status==="PAGO"?w.paidAt:`<button class="btn success mini" onclick="completeWithdrawal('${w.id}')"><i class="fa-solid fa-check"></i> Pagamento realizado</button>`}</td></tr>`).join("")||'<tr><td colspan="6" class="empty">Nenhuma solicitação.</td></tr>';
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
 const w=state.data.withdrawals.find(x=>x.id===id);
 if(!w||!confirm(`Confirmar pagamento de ${money.format(w.value)} para ${w.driverName}?`))return;
 const observation=prompt("Observação ou comprovante (opcional):","")||"";
 try{
  await withLoading("Confirmando pagamento do saque","Descontando o saldo, vinculando as corridas e removendo a solicitação.",()=>api("adminCompleteWithdrawal",{withdrawalId:id,observation}));
  state.data.withdrawals=state.data.withdrawals.filter(x=>x.id!==id);
  renderAll();
  state.revision="";
  await loadDashboard();
  toastMsg("Saque pago, saldo atualizado e solicitação removida.")
 }catch(x){toastMsg(x.message)}
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
  await withLoading("Cadastrando entregador","Criando o acesso e salvando os dados do entregador.",()=>api("adminRegisterDriver",{driver:{name:dName.value,email:dEmail.value,password:dPassword.value,whatsapp:dWhatsapp.value,cpf:dCpf.value,plate:dPlate.value,autoDiscount:dDiscount.value==="true"}}));
  driverForm.reset();state.revision="";await loadDashboard();toastMsg("Entregador cadastrado.")
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
if(state.token)showApp();
