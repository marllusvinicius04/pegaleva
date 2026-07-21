
const QUICK_ACCESS_KEY="pegaleva_quick_access";

function getQuickAccessData(){
  try{return JSON.parse(localStorage.getItem(QUICK_ACCESS_KEY)||"{}")||{}}catch(e){return {}}
}
function saveQuickAccess(type,email,codigo){
  const all=getQuickAccessData();
  all[type]={email:String(email||"").trim().toLowerCase(),codigo:String(codigo||"").trim()};
  localStorage.setItem(QUICK_ACCESS_KEY,JSON.stringify(all));
  renderQuickAccess();
}
function removeQuickAccess(type){
  const all=getQuickAccessData();
  delete all[type];
  localStorage.setItem(QUICK_ACCESS_KEY,JSON.stringify(all));
  renderQuickAccess();
}
function renderQuickAccess(){
  const all=getQuickAccessData();
  [["usuario","quickAccessUser"],["empresa","quickAccessCompany"]].forEach(([type,id])=>{
    const box=document.getElementById(id),item=all[type];
    if(!box)return;
    if(!item||!item.email||!item.codigo){box.classList.remove("active");box.innerHTML="";return}
    const label=type==="empresa"?"empresa":"usuário";
    box.innerHTML=`<strong><i class="fa-solid fa-bolt"></i> Acesso rápido</strong><span>${item.email}</span><div class="quick-access-actions"><button type="button" class="btn green" onclick="quickLogin('${type}')">Entrar rapidamente</button><button type="button" class="btn gray" onclick="removeQuickAccess('${type}')" title="Remover acesso salvo"><i class="fa-solid fa-trash"></i></button></div>`;
    box.classList.add("active");
  });
}
async function quickLogin(type){
  const item=getQuickAccessData()[type];
  if(!item)return;
  await loginByCode(item.codigo,type,item.email,false);
}
function isPublicSiteVisible(){
  return document.getElementById("accessScreen")?.classList.contains("active")&&!session;
}
function setSupportVisibility(show){
  const float=document.getElementById("supportFloat");
  const chat=document.getElementById("supportChat");
  if(!show){
    if(float)float.style.display="none";
    if(chat)chat.classList.remove("active");
    return;
  }
  if(float)float.style.display="flex";
}
function openSupportChat(){
  if(!isPublicSiteVisible())return;
  document.getElementById("supportChat")?.classList.add("active");
  const float=document.getElementById("supportFloat");
  if(float)float.style.display="none";
}
function closeSupportChat(){
  document.getElementById("supportChat")?.classList.remove("active");
  setSupportVisibility(isPublicSiteVisible());
}
function answerSupport(topic){
  const answers={
    como:{text:"É simples: crie sua conta gratuita, informe o endereço de coleta e destino, confira o valor e confirme. A solicitação vai para os entregadores disponíveis e você acompanha tudo pelo painel.",cta:"Criar conta e solicitar",action:"user"},
    horario:{text:"O atendimento regular funciona de segunda a sábado, das 08h às 22h, conforme disponibilidade da frota. Aos domingos não há atendimento regular, salvo comunicação oficial do Pega&Leva.",cta:"Criar minha conta",action:"user"},
    frota:{text:"As entregas são realizadas por entregadores cadastrados na frota Pega&Leva. A aceitação depende da disponibilidade dos entregadores no momento da solicitação, e todo o pedido fica registrado na plataforma.",cta:"Solicitar uma entrega",action:"user"},
    agilidade:{text:"O sistema envia sua solicitação aos entregadores disponíveis para acelerar o atendimento. O tempo pode variar conforme demanda, distância, clima e disponibilidade, mas você acompanha cada atualização pelo painel.",cta:"Começar agora",action:"user"},
    preco:{text:"O frete é calculado automaticamente conforme cidade, bairros de coleta e destino, rota de retorno e regras ativas. Você pode simular o valor antes de criar a conta ou confirmar a entrega.",cta:"Simular meu frete",action:"sim"},
    empresa:{text:"Empresas ganham um painel próprio para organizar pedidos e entregas. As 100 primeiras empresas cadastradas não pagam mensalidade, uma oportunidade para começar sem custo mensal e testar o serviço no dia a dia.",cta:"Cadastrar meu negócio",action:"company"},
    seguranca:{text:"Após solicitar, você acompanha status, entregador e histórico diretamente no painel. As informações da coleta e do destino ficam registradas no sistema para facilitar o acompanhamento.",cta:"Criar conta gratuita",action:"user"}
  };
  const a=answers[topic]||answers.como;
  const box=document.getElementById("supportAnswer");
  if(!box)return;
  box.innerHTML=`<div class="support-answer">${a.text}<div class="support-cta"><button type="button" class="btn green" onclick="supportCta('${a.action}')">${a.cta}</button><button type="button" class="btn light" onclick="closeSupportChat()">Continuar navegando</button></div></div>`;
  box.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function supportCta(action){
  closeSupportChat();
  if(action==="company"){openCompanyRegistration();return}
  if(action==="sim"){openSimuladorFrete();return}
  document.getElementById("loginArea")?.scrollIntoView({behavior:"smooth",block:"center"});
  selectAccessType("usuario");
  showUserTab("create");
}
document.addEventListener("DOMContentLoaded",renderQuickAccess);


function openLegalModal(type){
  const title=document.getElementById("legalTitle"),text=document.getElementById("legalText");
  if(type==="privacidade"){
    title.innerText="Política de privacidade";
    text.innerText="O Pega e Leva utiliza os dados informados no cadastro e nas solicitações apenas para identificar o cliente, organizar a entrega, calcular fretes, facilitar contato e melhorar o atendimento. Não compartilhe seu código de acesso com terceiros.";
  }else{
    title.innerText="Termos de uso";
    text.innerText="Ao usar o Pega e Leva, o usuário confirma que as informações da entrega são verdadeiras, que os itens enviados são permitidos e que o pagamento deve seguir as regras exibidas no sistema. O serviço é destinado a entregas locais de pequenos itens conforme disponibilidade da frota.";
  }
  document.getElementById("legalModal").classList.add("active");
}
function closeLegalModal(){document.getElementById("legalModal").classList.remove("active")}

let slowLoaderTimer=null;
function ensureSlowLoaderNotice(){
  let box=document.getElementById("slowLoaderNotice");
  if(box)return box;
  const loader=document.getElementById("loader");
  if(!loader)return null;
  box=document.createElement("div");
  box.id="slowLoaderNotice";
  box.className="slow-loader-warning";
  box.style.display="none";
  box.innerHTML=`<strong>Ops, parece que está demorando mais que o esperado.</strong>
    <span>Isso pode acontecer por instabilidade na conexão ou sincronização da planilha.</span>
    <button type="button" onclick="updateWithoutLosingProgress()">Clique aqui para atualizar</button>`;
  const inner=loader.querySelector("div");
  (inner||loader).appendChild(box);
  return box;
}
function startSlowLoaderWarning(){
  clearTimeout(slowLoaderTimer);
  const box=ensureSlowLoaderNotice();
  if(box)box.style.display="none";
  slowLoaderTimer=setTimeout(()=>{
    const notice=ensureSlowLoaderNotice();
    const loader=document.getElementById("loader");
    if(notice&&loader&&loader.classList.contains("active"))notice.style.display="block";
  },12000);
}
function hideSlowLoaderWarning(){
  clearTimeout(slowLoaderTimer);
  const box=document.getElementById("slowLoaderNotice");
  if(box)box.style.display="none";
}
async function updateWithoutLosingProgress(){

  try{
    if(currentSearchingId){
      await tryAgainCurrentSearch();
      return;
    }
    if(session){
      refreshBusy=false;
      showLoader("Atualizando sem sair da tela...");
      await refreshPanel();
      hideLoader();
      return;
    }
    hideLoader();
  }catch(e){
    hideLoader();
    alert("Não foi possível atualizar agora. Tente novamente em alguns segundos.");
  }
}


const PIX_KEY="57293143000156";
const API_URL="https://script.google.com/macros/s/AKfycbx739xcgwZ0NTYdtj0pjFN0QAqyNh94PV96PxKRy90pOvKHOg1V0LFf-gjkrIsKaL1w/exec";
let session=JSON.parse(localStorage.getItem("pegaleva_client")||"null"),
chatDeliveryId="",currentStep=0,lastPrice=0,currentSearchingId="",showAllClientDeliveries=false,knownStatuses=JSON.parse(localStorage.getItem("pegaleva_status_client")||"{}"),refreshTimer=null,refreshBusy=false,clientCoupons=[],clientAnnouncements=[],clientSavedContacts=[];
const steps=()=>document.querySelectorAll(".step"),dots=()=>document.querySelectorAll(".dot");
if(session)openPanel();
let consecutiveApiFailures=0;
async function api(action,data={}){
  try{
    const r=await fetch(API_URL,{method:"POST",cache:"no-store",body:JSON.stringify({action,...data})});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const result=await r.json();
    consecutiveApiFailures=0;
    hideSlowLoaderWarning();
    return result;
  }catch(err){
    consecutiveApiFailures++;
    if(consecutiveApiFailures>=2)showSystemDelayNotice();
    return {ok:false,error:"Falha de conexão com o servidor. Confira a implantação do Apps Script e tente novamente."};
  }
}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function onlyDigits(v){return String(v||"").replace(/\D/g,"")}
const BAIRROS_URUCUÍ=["Fogoso","Malvinas","Vaquejada","Centro","Aeroporto","Novo Horizonte","Areia","Esperança","Água Branca","Alto Bonito","São Francisco","Babilônia","Canaã","Portal dos Cerrados","Cerrados Park","Vista Bela"];
function fillBairroSelect(selectId,cidadeId){
  const select=document.getElementById(selectId),cidade=document.getElementById(cidadeId).value;
  if(!select)return;
  if(cidade==="Benedito Leite"){
    select.innerHTML='<option value="Benedito Leite">Benedito Leite</option>';
    select.value="Benedito Leite";
    select.disabled=true;
    return;
  }
  select.disabled=false;
  select.innerHTML='<option value="">Selecione</option>'+BAIRROS_URUCUÍ.map(b=>`<option>${b}</option>`).join("");
}
function updateBairroOptions(){
  const coletaAtual=document.getElementById("bairroColeta")?.value||"";
  const destinoAtual=document.getElementById("bairroDestino")?.value||"";
  fillBairroSelect("bairroColeta","coletaCidade");
  fillBairroSelect("bairroDestino","destinoCidade");
  if(BAIRROS_URUCUÍ.includes(coletaAtual))document.getElementById("bairroColeta").value=coletaAtual;
  if(BAIRROS_URUCUÍ.includes(destinoAtual))document.getElementById("bairroDestino").value=destinoAtual;
}
function cidadeRota(cidade){cidade=String(cidade||"").trim();if(cidade==="Uruçuí"||cidade==="Urucui"||cidade==="URUCUI")return "Uruçuí-PI";if(cidade==="Benedito Leite")return "Benedito Leite-MA";return cidade}
function fullAddress(prefix){const rua=document.getElementById(prefix+"Rua").value.trim(),numero=(document.getElementById(prefix+"Numero").value.trim()||"0"),cidade=cidadeRota(document.getElementById(prefix+"Cidade").value);return[rua,numero,cidade].filter(Boolean).join(", ")}
function pontoReferencia(prefix){return(document.getElementById(prefix+"Referencia")?.value||"").trim()}
function showLoader(text,search=false){
  const loader=document.getElementById("loader");
  document.getElementById("loaderText").innerText=text||"Carregando...";
  document.getElementById("loaderSub").innerText=search?"Buscando entregador disponível.":"Aguarde um instante.";
  document.getElementById("searchActions").style.display=search?"block":"none";
  loader.classList.toggle("searching",!!search);
  loader.classList.add("active");

}
function hideLoader(){
  const loader=document.getElementById("loader");
  loader.classList.remove("active","searching");
  document.getElementById("searchActions").style.display="none";

}
function playSuccessNotification(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return;
    const ctx=new AudioCtx();
    const master=ctx.createGain();
    master.gain.setValueAtTime(0.72,ctx.currentTime);
    master.connect(ctx.destination);
    const tone=(freq,start,duration,type)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type=type||"sine";
      osc.frequency.setValueAtTime(freq,ctx.currentTime+start);
      gain.gain.setValueAtTime(0.001,ctx.currentTime+start);
      gain.gain.exponentialRampToValueAtTime(0.55,ctx.currentTime+start+0.018);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+start+duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime+start);
      osc.stop(ctx.currentTime+start+duration+0.04);
    };
    tone(659.25,0,0.14,"triangle");
    tone(783.99,0.16,0.16,"triangle");
    tone(1046.50,0.34,0.26,"triangle");
    tone(1318.51,0.62,0.22,"sine");
    if(navigator.vibrate)navigator.vibrate([90,40,120]);
    setTimeout(()=>ctx.close&&ctx.close(),1200);
  }catch(e){}
}
function selectAccessType(type){document.getElementById("accessOptions").style.display="none";document.getElementById("backBtn").style.display="block";if(type==="usuario"){document.getElementById("accessTitle").innerText="Acesso do usuário";document.getElementById("accessSubtitle").innerText="Entre ou crie sua conta para solicitar uma entrega.";document.getElementById("userAccess").style.display="block";document.getElementById("companyAccess").style.display="none";showUserTab("login")}else{document.getElementById("accessTitle").innerText="Acesso da empresa";document.getElementById("accessSubtitle").innerText="Entre ou cadastre sua empresa.";document.getElementById("userAccess").style.display="none";document.getElementById("companyAccess").style.display="block";showCompanyTab("login")}}
function backToOptions(){document.getElementById("accessTitle").innerText="Olá, bem-vindo";document.getElementById("accessSubtitle").innerText="Escolha uma opção para iniciar";document.getElementById("accessOptions").style.display="grid";document.getElementById("backBtn").style.display="none";document.getElementById("userAccess").style.display="none";document.getElementById("companyAccess").style.display="none"}
function openCompanyRegistration(){document.getElementById("loginArea")?.scrollIntoView({behavior:"smooth",block:"center"});selectAccessType("empresa");showCompanyTab("create")}
function showUserTab(tab){document.getElementById("tabUserLogin").classList.toggle("active",tab==="login");document.getElementById("tabUserCreate").classList.toggle("active",tab==="create");document.getElementById("userLoginBox").style.display=tab==="login"?"block":"none";document.getElementById("userCreateBox").style.display=tab==="create"?"block":"none";if(tab==="create")resetUserCreateSteps()}
function showCompanyTab(tab){document.getElementById("tabCompanyLogin").classList.toggle("active",tab==="login");document.getElementById("tabCompanyCreate").classList.toggle("active",tab==="create");document.getElementById("companyLoginBox").style.display=tab==="login"?"block":"none";document.getElementById("companyCreateBox").style.display=tab==="create"?"block":"none";if(tab==="create")resetCompanyCreateSteps()}
function resetCompanyCreateSteps(){showCompanyCreateStep(1)}
function getCompanyCreateData(){return {responsavel:(document.getElementById("cNomeEmpresa")?.value||"").trim(),cpfCnpj:onlyDigits(document.getElementById("cCpfCnpj")?.value||""),email:(document.getElementById("cEmail")?.value||"").trim(),whatsapp:onlyDigits(document.getElementById("cWhatsapp")?.value||""),cidade:(document.getElementById("cCidade")?.value||"").trim(),rua:(document.getElementById("cRua")?.value||"").trim(),numero:(document.getElementById("cNumero")?.value||"").trim(),referencia:(document.getElementById("cReferencia")?.value||"").trim(),codigo:(document.getElementById("newCompanyCode")?.value||"").trim()}}
function showCompanyCreateStep(step){const data=getCompanyCreateData();if(step===2&&(!data.responsavel||!data.cpfCnpj||!data.email||!data.whatsapp)){alert("Preencha os dados da empresa para continuar.");return}if(step===2&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)){alert("Digite um e-mail válido.");return}if(step===3&&(!data.cidade||!data.rua||!data.numero||!data.referencia)){alert("Preencha todas as informações de endereço para continuar.");return}[1,2,3].forEach(n=>{const el=document.getElementById("companyCreateStep"+n);if(el)el.style.display=n===step?"block":"none"})}
async function createCompanyAccount(){const data=getCompanyCreateData();if(!data.responsavel||!data.cpfCnpj||!data.email||!data.whatsapp||!data.cidade||!data.rua||!data.numero||!data.referencia||!data.codigo){alert("Preencha todos os dados da empresa.");return}showLoader("Cadastrando empresa...");const res=await api("adminRegisterCompany",data);hideLoader();if(!res.ok){alert(res.error||"Não foi possível cadastrar a empresa.");return}const ok=await loginByCode(data.codigo,"empresa",data.email,true);if(ok)saveQuickAccess("empresa",data.email,data.codigo)}
let codeTimer;function checkCodeLive(inputId,msgId){clearTimeout(codeTimer);codeTimer=setTimeout(async()=>{const codigo=document.getElementById(inputId).value.trim();if(!codigo){document.getElementById(msgId).innerText="";return}const res=await api("checkCode",{codigo});document.getElementById(msgId).innerText=res.message||"";document.getElementById(msgId).style.color=res.available?"#047857":"#ef4444"},350)}
let pendingUserRegisterData=null;
function resetUserCreateSteps(){const form=document.getElementById("userCreateFormStep"),terms=document.getElementById("userTermsStep");pendingUserRegisterData=null;if(form)form.style.display="block";if(terms)terms.style.display="none"}
function getUserCreateData(){return {nome:(document.getElementById("uNome")?.value||"").trim(),whatsapp:onlyDigits(document.getElementById("uWhatsapp")?.value||""),email:(document.getElementById("uEmail")?.value||"").trim(),cpf:onlyDigits(document.getElementById("uCpf")?.value||""),codigo:(document.getElementById("newUserCode")?.value||"").trim()}}
function showUserTermsStep(){const data=getUserCreateData();if(!data.nome||!data.whatsapp||!data.email||!data.cpf||!data.codigo){alert("Preencha todos os dados do usuário para continuar.");return}pendingUserRegisterData=data;document.getElementById("userCreateFormStep").style.display="none";document.getElementById("userTermsStep").style.display="block"}
async function createUserAccount(){const data=pendingUserRegisterData||getUserCreateData();if(!data.nome||!data.whatsapp||!data.email||!data.cpf||!data.codigo){alert("Preencha todos os dados do usuário para continuar.");return}showLoader("Criando conta de usuário...");const res=await api("registerUser",data);hideLoader();if(!res.ok){alert("Código de acesso inválido. Escolha outro código.");return}const ok=await loginByCode(data.codigo,"usuario",data.email,true);if(ok)saveQuickAccess("usuario",data.email,data.codigo)}
async function loginSelected(type){const codigo=type==="empresa"?document.getElementById("companyLoginCode").value.trim():document.getElementById("userLoginCode").value.trim();const email=type==="empresa"?(document.getElementById("companyLoginEmail")?.value||"").trim().toLowerCase():(document.getElementById("userLoginEmail")?.value||"").trim().toLowerCase();if(!email)return alert("Digite seu e-mail.");if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert("Digite um e-mail válido.");if(!codigo)return alert("Digite seu código de acesso.");const remember=type==="empresa"?document.getElementById("rememberCompanyAccess")?.checked:document.getElementById("rememberUserAccess")?.checked;const ok=await loginByCode(codigo,type,email);if(ok&&remember)saveQuickAccess(type,email,codigo)}
async function loginByCode(codigo,expectedType,email="",isNewAccount=false){session=null;localStorage.removeItem("pegaleva_client");showLoader("Carregando seu painel...");const res=await api("loginClient",{codigo,email,expectedType});hideLoader();if(!res.ok){session=null;localStorage.removeItem("pegaleva_client");alert("E-mail ou código de acesso inválido.");return false}if(res.type!==expectedType){session=null;localStorage.removeItem("pegaleva_client");alert("E-mail ou código de acesso inválido.");return false}const perfilEmail=String(res.profile?.Email||"").trim().toLowerCase();if(perfilEmail!==String(email||"").trim().toLowerCase()){session=null;localStorage.removeItem("pegaleva_client");alert("E-mail ou código de acesso inválido.");return false}session=res;localStorage.setItem("pegaleva_client",JSON.stringify(session));openPanel();if(isNewAccount)setTimeout(showNewAccountWelcomeModal,180);return true}
function showNewAccountWelcomeModal(){if(!session)return;const p=session.profile||{};const fullName=String(session.type==="empresa"?(p.Responsavel||""):(p.Nome||"")).trim();const firstName=fullName.split(/\s+/)[0]||"";const feminine=session.type==="empresa"||/[aáàâã]$/i.test(firstName);const title=document.getElementById("newAccountWelcomeTitle"),text=document.getElementById("newAccountWelcomeText"),modal=document.getElementById("newAccountWelcomeModal");if(title)title.innerText=(feminine?"Bem-vinda, ":"Bem-vindo, ")+(firstName||"ao Pega&Leva")+"!";if(text)text.innerText=session.type==="empresa"?"Sua empresa foi cadastrada com sucesso no Pega&Leva. O desconto de 20% ainda está em processo de ativação e pode ser liberado a qualquer momento, em até 30 minutos. Aguarde a notificação no WhatsApp confirmando que o desconto foi ativado antes de solicitar uma entrega. Caso solicite antes da liberação, será cobrado o valor normal, sem desconto. Após receber a confirmação, você poderá usar o desconto normalmente dentro do nosso sistema.":"Sua conta foi criada com sucesso no Pega&Leva. Agora você já pode acessar o painel e solicitar sua primeira entrega.";if(modal)modal.classList.add("active")}
function closeNewAccountWelcomeModal(){document.getElementById("newAccountWelcomeModal")?.classList.remove("active")}
function openPanel(){setSupportVisibility(false);setTimeout(updateBairroOptions,0);document.querySelector(".history-chat-btn").style.display="grid";document.getElementById("accessScreen").classList.remove("active");document.getElementById("appScreen").classList.add("active");
  const clientNav=document.getElementById("clientAppNav");
  if(clientNav) clientNav.style.display="";
const p=session.profile,name=session.type==="empresa"?p.Responsavel:p.Nome;const primeiroNome=String(name||"").trim().split(/\s+/)[0]||"";document.getElementById("welcomeName").innerText="Olá, "+primeiroNome;document.getElementById("welcomeType").innerText=session.type==="empresa"?"Painel da empresa":"Painel do usuário";document.getElementById("companyBox").style.display=session.type==="empresa"?"block":"none";document.getElementById("useAddressBtn").style.display=session.type==="empresa"?"block":"none";toggleCouponArea();renderProfile();loadClientTools();startAutoRefresh()}


async function loadSavedClientContacts(){
  if(!session||session.type!=="empresa"){clientSavedContacts=[];updateSavedClientDot();return}

  const profile=session.profile||{};
  const res=await api("getSavedClients",{
    codigoEmpresa:profile.CodigoAcesso||profile.codigoAcesso||profile.codigo||"",
    codigo:profile.CodigoAcesso||profile.codigoAcesso||profile.codigo||"",
    whatsappEmpresa:profile.WhatsApp||profile.whatsapp||""
  });

  clientSavedContacts=res&&res.ok?(res.list||res.salvos||res.saved||res.clientes||[]):[];

  updateSavedClientDot();
}

function updateSavedClientDot(){
  const dot=document.getElementById("savedClientsDot");
  if(dot){
    dot.innerText=clientSavedContacts.length;
    dot.classList.toggle("active",clientSavedContacts.length>0);
  }
}

function renderSavedClientsModal(){
  const box=document.getElementById("savedOrdersPageBody")||document.getElementById("savedClientsBody");
  if(!box)return;
  if(session&&session.type!=="empresa"){
    box.innerHTML='<p class="muted" style="text-align:center">Essa opção fica disponível para empresas.</p>';
  }else if(!clientSavedContacts.length){
    box.innerHTML='<div class="saved-list-head"><div><strong>Meus pedidos</strong><small>Os pedidos ficam disponíveis por 1H. Depois disso saem da planilha e daqui também.</small></div><span class="badge">0</span></div><div class="saved-order-empty"><p class="muted" style="text-align:center;margin:0">Nenhum pedido salvo disponível. Clique em Criar pedido para gerar um código.</p></div>';
  }else{
    box.innerHTML=`<div class="saved-list-head"><div><strong>Meus pedidos</strong><small>Disponíveis por 1H. Copie a mensagem para o cliente preencher e solicite quando estiver pronto.</small></div><span class="badge">${clientSavedContacts.length}</span></div><div class="saved-orders-grid">`+clientSavedContacts.map(c=>{
      const solicitado=!!(c.EntregaID||String(c.StatusPedido||"").toLowerCase().includes("solicitado"));
      return `
      <div class="saved-client-card">
        <strong style="color:#0044c3">${c.NomePedido||c.NomeDestino||"Pedido salvo"}</strong>
        <p class="muted" style="margin-top:5px"><b>Código do pedido:</b> <span style="font-weight:950;color:#0044c3">${c.PedidoCodigo||"---"}</span></p>
        <p class="muted" style="margin-top:4px"><b>Coleta:</b> ${c.BairroColeta||"---"} • ${c.RotaRetorno?"com rota":"sem rota"}</p>
        <p class="muted" style="margin-top:4px"><b>Status:</b> ${solicitado?"Solicitado":(c.StatusPedido||c.NomeDestino?"Preenchido":"Aguardando cliente")}</p>
        ${c.NomeDestino?`<p class="muted" style="margin-top:5px">${c.NomeDestino} • ${c.Rua||""}, Nº ${c.Numero||"0"} - ${c.Bairro||""}, ${c.Cidade||""}</p>`:`<p class="muted" style="margin-top:5px">Aguardando cliente preencher as informações.</p>`}
        ${c.FreteEscolhido?`<p class="muted" style="margin-top:4px"><b>Frete:</b> ${c.FreteEscolhido} • R$ ${Number(c.ValorFrete||0).toFixed(2).replace(".",",")}</p>`:""}
        ${c.WhatsAppDestino?`<p class="muted" style="margin-top:4px"><b>WhatsApp:</b> ${c.WhatsAppDestino}</p>`:""}
        <div class="grid2" style="margin-top:10px">
          <button class="btn light" style="margin-top:0" onclick="copySavedClientCadastroLink('${c.PedidoCodigo||""}')"><i class="fa-solid fa-copy"></i> Copiar</button>
          ${solicitado?`<button class="btn gray" style="margin-top:0" onclick="alert('Pedido já solicitado. O cliente pode acompanhar pelo formulário.')">Solicitado</button>`:(c.NomeDestino?`<button class="btn green" style="margin-top:0" onclick="startSavedOrderDelivery('${c.ID}')"><i class="fa-solid fa-motorcycle"></i> Solicitar</button>`:`<button class="btn gray" style="margin-top:0" onclick="copySavedClientCadastroLink('${c.PedidoCodigo||""}')">Aguardando</button>`)}
        </div>
      </div>`;
    }).join("")+"</div>";
  }
}

function openSavedOrdersPage(){
  const main=document.querySelector("#appScreen > .container");
  const page=document.getElementById("savedOrdersPage");
  if(main)main.style.display="none";
  if(page)page.style.display="block";
  renderSavedClientsModal();
  if(session&&session.type==="empresa"){
    loadSavedClientContacts().then(renderSavedClientsModal).catch(()=>renderSavedClientsModal());
  }
}
function closeSavedOrdersPage(){
  const main=document.querySelector("#appScreen > .container");
  const page=document.getElementById("savedOrdersPage");
  if(page)page.style.display="none";
  if(main)main.style.display="grid";
}
function openCreateSavedOrderModal(){
  document.getElementById("savedClientsModal").classList.add("active");
  updateNewSavedOrderBairros();
}

function openSavedClientsModal(){openSavedOrdersPage()}
function closeSavedClientsModal(){document.getElementById("savedClientsModal").classList.remove("active")}

function updateNewSavedOrderBairros(){
  const cidade=(document.getElementById("newSavedOrderCity")||{}).value||"Uruçuí";
  const el=document.getElementById("newSavedOrderBairro");
  if(!el)return;
  const list=cidade==="Benedito Leite"?["Centro","Benedito Leite"]:["Fogoso","Malvinas","Vaquejada","Centro","Aeroporto","Novo Horizonte","Areia","Esperança","Água Branca","Alto Bonito","São Francisco","Babilônia","Canaã","Portal dos Cerrados","Cerrados Park","Vista Bela"];
  el.innerHTML='<option value="">Selecione</option>'+list.map(b=>`<option>${b}</option>`).join("");
}

function getSavedClientCadastroLink(codigoPedido){
  return "https://pegaelevadelivery.com.br/rastreioentrega";
}

function copySavedClientCadastroLink(codigoPedido){
  const link=getSavedClientCadastroLink(codigoPedido);
  const mensagem="INFORME SEUS DADOS NO FORMULARIO ABAIXO PARA RECEBER SEU PRODUTO EM SUA CASA COM QUALIDADE E ECONOMIA!\n\n"+link+"\n\nCódigo do pedido: "+String(codigoPedido||"").toUpperCase();
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(mensagem).then(()=>alert("Mensagem copiada.")).catch(()=>prompt("Copie a mensagem:",mensagem));
  }else{
    prompt("Copie a mensagem:",mensagem);
  }
}

async function createSavedOrderFromPanel(){
  if(!session||session.type!=="empresa")return alert("Entre como empresa para cadastrar pedidos.");
  const nome=(document.getElementById("newSavedOrderName")||{}).value.trim();
  const cidadeColeta=(document.getElementById("newSavedOrderCity")||{}).value||"Uruçuí";
  const bairroColeta=(document.getElementById("newSavedOrderBairro")||{}).value||"";
  const rotaRetorno=(document.getElementById("newSavedOrderRota")||{}).value||"";
  if(!nome)return alert("Informe o nome do pedido.");
  if(!bairroColeta)return alert("Informe o bairro de coleta.");
  const profile=session.profile||{};
  showLoader("Criando pedido...");
  const res=await api("createSavedOrder",{
    nomePedido:nome,
    cidadeColeta,
    bairroColeta,
    rotaRetorno,
    codigoEmpresa:profile.CodigoAcesso||profile.codigoAcesso||profile.codigo||"",
    whatsappEmpresa:profile.WhatsApp||profile.whatsapp||""
  });
  hideLoader();
  if(!res.ok)return alert(res.error||"Erro ao criar pedido.");
  const codigo=res.pedidoCodigo||res.codigoPedido;
  const link=getSavedClientCadastroLink(codigo);
  const mensagem="INFORME SEUS DADOS NO FORMULARIO ABAIXO PARA RECEBER SEU PRODUTO EM SUA CASA COM QUALIDADE E ECONOMIA!\n\n"+link+"\n\nCódigo do pedido: "+String(codigo||"").toUpperCase();
  await loadSavedClientContacts();
  closeSavedClientsModal();
  renderSavedClientsModal();
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(mensagem).catch(()=>{});
  }
  alert("Pedido cadastrado! Mensagem copiada para enviar ao cliente.\n\nCódigo: "+codigo);
}



function startSavedOrderDelivery(id){
  const c=clientSavedContacts.find(x=>String(x.ID)===String(id));
  if(!c)return;
  const box=document.getElementById("savedOrdersPageBody")||document.getElementById("savedClientsBody");
  box.innerHTML=`
    <div class="saved-client-card">
      <strong style="color:#0044c3;display:flex;align-items:center;gap:8px"><i class="fa-solid fa-motorcycle"></i> Solicitar pedido</strong>
      <p class="muted" style="margin-top:6px"><b>${c.NomePedido||"Pedido"}</b> • Código ${c.PedidoCodigo||"---"}</p>
      <p class="muted" style="margin-top:6px"><b>Cliente:</b> ${c.NomeDestino||"---"} • ${c.WhatsAppDestino||"---"}</p>
      <p class="muted" style="margin-top:6px"><b>Destino:</b> ${c.Rua||""}, Nº ${c.Numero||"0"}, ${c.Referencia||""} - ${c.Bairro||""}, ${c.Cidade||""}</p>
      <p class="muted" style="margin-top:6px"><b>Frete:</b> ${c.FreteEscolhido||"Normal"} • R$ ${Number(c.ValorFrete||0).toFixed(2).replace(".",",")}</p>
      <div style="margin-top:12px;background:#f8fbff;border:1px solid #e5edf8;border-radius:18px;padding:12px">
        <button class="btn light" style="margin-top:0;margin-bottom:8px" onclick="useSavedCompanyAddressForOrder()"><i class="fa-solid fa-location-dot"></i> Usar meu endereço salvo</button>
        <label>Rua/Avenida da coleta</label><input id="savedOrderRuaColeta" placeholder="Endereço de coleta">
        <label>Número da coleta</label><input id="savedOrderNumeroColeta" placeholder="Se não tiver número, coloque 0">
        <label>Ponto de referência da coleta</label><input id="savedOrderReferenciaColeta" placeholder="Obrigatório">
        <label>Cidade da coleta</label><select id="savedOrderCidadeColeta"><option>${c.CidadeColeta||"Uruçuí"}</option><option>Uruçuí</option><option>Benedito Leite</option></select>
      </div>
      <div class="grid2" style="margin-top:10px">
        <button class="btn gray" onclick="renderSavedClientsModal()">Voltar</button>
        <button class="btn green" onclick="confirmSavedOrderDelivery('${c.ID}')"><i class="fa-solid fa-motorcycle"></i> Solicitar</button>
      </div>
    </div>`;
}

function useSavedCompanyAddressForOrder(){
  if(!session||session.type!=="empresa")return;
  const p=session.profile||{};
  const rua=document.getElementById("savedOrderRuaColeta");
  const numero=document.getElementById("savedOrderNumeroColeta");
  const referencia=document.getElementById("savedOrderReferenciaColeta");
  const cidade=document.getElementById("savedOrderCidadeColeta");
  if(rua)rua.value=p.Rua||p.Endereco||"";
  if(numero)numero.value=p.Numero||"";
  if(referencia)referencia.value=p.Referencia||"";
  if(cidade)cidade.value=p.Cidade||cidade.value||"Uruçuí";
}


async function confirmSavedOrderDelivery(id){
  const c=clientSavedContacts.find(x=>String(x.ID)===String(id));
  if(!c)return;
  const rua=(document.getElementById("savedOrderRuaColeta")||{}).value||"";
  const numero=(document.getElementById("savedOrderNumeroColeta")||{}).value||"";
  const referencia=(document.getElementById("savedOrderReferenciaColeta")||{}).value||"";
  const cidade=(document.getElementById("savedOrderCidadeColeta")||{}).value||"";
  if(!rua.trim()||!numero.trim()||!referencia.trim()||!cidade.trim())return alert("Confirme rua, número, ponto de referência e cidade da coleta.");
  showLoader("Buscando entregador...",true);
  const res=await api("createDeliveryFromSavedOrder",{
    pedidoCodigo:c.PedidoCodigo,
    ruaColeta:rua,
    numeroColeta:numero||"0",
    referenciaColeta:referencia,
    cidadeColeta:cidade,
    bairroColeta:c.BairroColeta||""
  });
  if(!res.ok){hideLoader();return alert(res.error||"Não foi possível solicitar.");}
  currentSearchingId=res.delivery.ID;
  await loadSavedClientContacts();
  renderSavedClientsModal();
  refreshPanel();
}

function applySavedClient(id){startSavedOrderDelivery(id)}

function updateClientNavDots(){
  const nav=document.getElementById("clientAppNav");
  if(nav)nav.style.display="";
  const cd=document.getElementById("couponDot"),md=document.getElementById("messageDot");
  if(cd){cd.innerText=clientCoupons.length;cd.classList.toggle("active",clientCoupons.length>0)}
  if(md){md.innerText=clientAnnouncements.length;md.classList.toggle("active",clientAnnouncements.length>0)}
  updateSavedClientDot();
}

async function loadClientTools(){
  if(!session)return;
  const [c,m]=await Promise.all([api("getAvailableCoupons",{}),api("getActiveAnnouncements",{})]);
  clientCoupons=c&&c.ok?c.cupons||[]:[];
  clientAnnouncements=m&&m.ok?m.comunicados||[]:[];
  updateClientNavDots();
  await loadSavedClientContacts();
}

function openCouponsModal(){
  const box=document.getElementById("couponsBody");
  box.innerHTML=clientCoupons.length?clientCoupons.map(c=>`<div class="coupon-card"><small>CUPOM DISPONÍVEL</small><b>${String(c.Cupom||"").toUpperCase()}</b><span>${Number(c.DescontoPercentual||0)}% de desconto</span></div>`).join(""):'<p class="muted" style="text-align:center">Ops, 0 cupons por aqui!</p>';
  document.getElementById("couponsModal").classList.add("active");
}
function closeCouponsModal(){document.getElementById("couponsModal").classList.remove("active")}

function openAnnouncementsModal(){
  const box=document.getElementById("announcementsBody");
  box.innerHTML=clientAnnouncements.length?clientAnnouncements.map(c=>`<div class="msg-bubble"><b>${c.Titulo||"Comunicado PegaLeva"}</b><p style="margin-top:6px;line-height:1.45">${String(c.Mensagem||"").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p><small>${c.CriadoEm||""}</small></div>`).join(""):'<p class="muted" style="text-align:center">Nenhum comunicado disponível.</p>';
  document.getElementById("announcementsModal").classList.add("active");
}
function closeAnnouncementsModal(){document.getElementById("announcementsModal").classList.remove("active")}

function startAutoRefresh(){if(refreshTimer)clearTimeout(refreshTimer);refreshPanel();scheduleAutoRefresh()}
function scheduleAutoRefresh(){if(refreshTimer)clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{await refreshPanel();scheduleAutoRefresh()},1000)}
document.addEventListener("visibilitychange",()=>{if(!session)return;scheduleAutoRefresh();refreshPanel()});window.addEventListener("focus",()=>{if(session)refreshPanel()});window.addEventListener("pageshow",()=>{if(session)refreshPanel()})
function useRegisteredAddress(){if(session.type!=="empresa")return;const p=session.profile;document.getElementById("coletaRua").value=p.Rua||p.Endereco||"";document.getElementById("coletaNumero").value=p.Numero||"";document.getElementById("coletaReferencia").value=p.Referencia||"";document.getElementById("coletaCidade").value=p.Cidade||""}
function renderProfile(){const p=session.profile,pendente=Number(p.PagamentoPendente||0),payBtn=pendente>0?` <button type="button" class="btn-pay-pending" onclick="openClientPendingPaymentModal()" style="margin-top:0!important;padding:7px 10px!important;font-size:11px!important"><i class="fa-solid fa-money-bill-wave"></i> PAGAR AGORA</button>`:"";document.getElementById("profileBox").innerHTML=session.type==="empresa"?`<div class="info-row"><span>Responsável</span><b>${p.Responsavel||""}</b></div><div class="info-row"><span>WhatsApp</span><b><a target="_blank" href="https://wa.me/55${onlyDigits(p.WhatsApp)}">${p.WhatsApp||""}</a></b></div><div class="info-row"><span>Email</span><b>${p.Email||""}</b></div><div class="info-row"><span>CPF/CNPJ</span><b>${p.CPF_CNPJ||""}</b></div><div class="info-row"><span>Endereço</span><b>${p.Endereco||""}</b></div><div class="info-row"><span>Valor pago</span><b>${money(p.ValorPago||0)}</b></div><div class="info-row"><span>Pagamento pendente</span><b style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">${money(p.PagamentoPendente||0)}${payBtn}</b></div>`:`<div class="info-row"><span>Nome</span><b>${p.Nome||""}</b></div><div class="info-row"><span>WhatsApp</span><b><a target="_blank" href="https://wa.me/55${onlyDigits(p.WhatsApp)}">${p.WhatsApp||""}</a></b></div><div class="info-row"><span>Email</span><b>${p.Email||""}</b></div><div class="info-row"><span>CPF</span><b>${p.CPF||""}</b></div><div class="info-row"><span>Entregas solicitadas</span><b>${p.EntregasSolicitadas||0}</b></div><div class="info-row"><span>Valor pago</span><b>${money(p.ValorPago||0)}</b></div><div class="info-row"><span>Pagamento pendente</span><b style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">${money(p.PagamentoPendente||0)}${payBtn}</b></div>`}
async function refreshPanel(){if(!session||refreshBusy)return;refreshBusy=true;try{const res=await api("getClientPanel",{codigo:session.profile.CodigoAcesso,_t:Date.now()});if(!res.ok)return;session={ok:true,type:res.type,profile:res.profile};localStorage.setItem("pegaleva_client",JSON.stringify(session));renderProfile();loadClientTools();window.activeDrivers=res.activeDrivers!==false;renderDeliveries(res.deliveries||[]);renderClientHistory(res.deliveries||[]);handleStatusModals(res.deliveries||[]);if(currentSearchingId){const d=(res.deliveries||[]).find(x=>x.ID===currentSearchingId);if(d&&d.CodigoEntregador) {currentSearchingId="";hideLoader();playSuccessNotification();showStatus("Sua entrega foi aceita","Um entregador aceitou sua solicitação.","ok")} if(d&&d.Status==="Cancelada"){currentSearchingId="";hideLoader();showStatus("Sua entrega foi cancelada","Tente novamente ou cancele geral no card da entrega.","bad")} if(d&&d.Status==="Cancelada Geral"){currentSearchingId="";hideLoader();showStatus("Entrega cancelada","A entrega foi cancelada definitivamente.","bad")}}if(session.type==="empresa"){document.getElementById("companyBox").style.display="block";const p=session.profile;document.getElementById("companyStats").innerHTML=`<div class="info-row"><span>Entregas restantes com desconto</span><b>${p.EntregasComDescontoRestantes||0}</b></div><div class="info-row"><span>Desconto</span><b>${p.DescontoPercentual||0}%</b></div><div class="info-row"><span>Prioridade</span><b class="badge green">${p.Prioridade||"Desativado"}</b></div>`}else document.getElementById("companyBox").style.display="none"}finally{refreshBusy=false}}
function handleStatusModals(list){list.forEach(d=>{if(!knownStatuses[d.ID]){knownStatuses[d.ID]=d.Status;return}if(knownStatuses[d.ID]!==d.Status){knownStatuses[d.ID]=d.Status;if(d.Status==="Entrega aceita"){playSuccessNotification();showStatus("Sua entrega foi aceita","O entregador aceitou sua entrega.","ok")};if(d.Status==="Estou a caminho")showStatus("5MIN CHEGANDO...","O entregador está chegando para a coleta.","ok");if(d.Status==="Coletado")showStatus("Entrega em rota","Sua entrega foi coletada e está em rota.","ok");if(d.Status==="Entrega finalizada")showStatus("Entrega finalizada com sucesso","Sua entrega foi concluída.","ok");if(d.Status==="Cancelada")showStatus("Sua entrega foi cancelada","Tente novamente.","bad");if(d.Status==="Aguardando entregador")showStatus("Procurando outro entregador","A entrega voltou para novas entregas disponíveis até outro entregador aceitar.","ok")}});localStorage.setItem("pegaleva_status_client",JSON.stringify(knownStatuses))}
function isClosedDelivery(status){return ["Entrega finalizada","Cancelada","Cancelada Geral"].includes(String(status||""))}
function showPanelMessage(text,type){const box=document.getElementById("deliveriesBox");if(!box)return;box.innerHTML=`<div class="pay-alert" style="${type==='bad'?'background:#fee2e2;color:#b91c1c':''}">${text}</div>`}
function renderDeliveries(list){
  window.lastClientDeliveries=list||[];
  const box=document.getElementById("deliveriesBox");
  list=(list||[]).filter(d=>!isClosedDelivery(d.Status));
  if(!list.length){box.innerHTML='<p class="muted">Sem entregas aqui (0) Solicite agora</p>';window.lastClientDeliveries=[];return}
  const visible=showAllClientDeliveries?list:list.slice(0,3);
  box.innerHTML=visible.map(d=>{
    const waDest=onlyDigits(d.WhatsAppDestino),waSend=onlyDigits(d.WhatsAppSolicitante);
    const canCancel=d.Status!=="Entrega finalizada"&&d.Status!=="Cancelada"&&d.Status!=="Cancelada Geral"&&d.Status!=="Coletado";
    const going=d.Status==="Estou a caminho";
    const collected=d.Status==="Coletado";
    return `<div class="delivery-card">
      <div class="title"><strong>${d.BairroColeta} → ${d.BairroDestino}</strong><span class="badge ${d.Status==="Entrega finalizada"?"green":(d.Status==="Cancelada"||d.Status==="Cancelada Geral")?"red":"yellow"}">${going?"5MIN CHEGANDO...":d.Status}</span></div>
      ${going?`<div class="route-mini">5MIN CHEGANDO...</div>`:""}
      ${collected?`<div class="route-mini">entrega em rota <i class="fa-solid fa-motorcycle"></i></div>`:""}
      <p class="muted">Quem envia: ${d.NomeSolicitante||""} - <a target="_blank" href="https://wa.me/55${waSend}">${d.WhatsAppSolicitante||""}</a></p>
      <p class="muted">Quem recebe: ${d.NomeDestino||""} - <a target="_blank" href="https://wa.me/55${waDest}">${d.WhatsAppDestino||""}</a></p>
      <p class="muted">Valor: <b>${money(d.Valor)}</b></p><p class="muted">Pagamento: <b>${d.StatusPagamento||"Aguardando confirmação"}</b></p>
      ${d.NomeEntregador?driverMiniHtml(d):(!window.activeDrivers?`<p class="muted"><b>OPS, SEM ENTREGADORES NESSE HORÁRIO</b></p>`:`<p class="muted"><i class="fa-solid fa-motorcycle fa-bounce"></i> Buscando entregador...</p>`)}
      ${!isClosedDelivery(d.Status)&&d.CodigoEntregador?`<button class="btn light" onclick="openChatModal('${d.ID}')">Enviar mensagem${Number(d.ClienteNaoLidas||0)>0?` <span class="chat-badge">${d.ClienteNaoLidas}</span>`:""}</button>`:""}
      ${canCancel?`<button class="btn red" onclick="cancelDelivery('${d.ID}')">Cancelar entrega</button>`:""}
      ${d.Status==="Cancelada"?`<button class="btn green" onclick="retryDelivery('${d.ID}')">Tentar novamente</button><button class="btn red" onclick="cancelGeneralDelivery('${d.ID}')">Cancelar geral</button>`:""}
      ${d.Status==="Cancelada Geral"?`<p class="muted"><b>Entrega cancelada definitivamente.</b></p>`:""}
    </div>`
  }).join("") + (list.length>3?`<button class="btn light" onclick="showAllClientDeliveries=!showAllClientDeliveries;renderDeliveries(window.lastClientDeliveries||[])">${showAllClientDeliveries?"Ver menos":"Ver todas"}</button>`:"");
  window.lastClientDeliveries=list;
}



function hasClientPendingPayment(d){
  const status=String(d&&d.StatusPagamento||"").trim().toLowerCase();
  const pendente=Number(d&&d.PagamentoPendente||d&&d.ValorPendente||0);
  return status==="pendente" || pendente>0;
}
let clientPaymentTimer=null;
function clientPaymentDateText(){
  const d=new Date();
  return d.toLocaleDateString("pt-BR")+" às "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
}
function buildPendingPaymentWhatsAppLink(valorPendente,nome){
  const data=clientPaymentDateText();
  const valor=money(valorPendente||0);
  const msg=`CONFIRMAÇÃO DE PAGAMENTO - PEGA E LEVA!\n\nValor pendente de ${valor} dos fretes da empresa/responsável ${nome||""} foi pago via PIX na data ${data}.\n\nPega e Leva!`;
  return `https://wa.me/5589994376585?text=${encodeURIComponent(msg)}`;
}
function copyClientPixKey(){
  const key=String(PIX_KEY||"");
  const done=()=>{const btn=document.getElementById("copyClientPixBtn");if(btn)btn.innerHTML='<i class="fa-solid fa-check"></i> Chave copiada'};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(key).then(done).catch(()=>fallbackCopyClientPixKey(key,done));return}
  fallbackCopyClientPixKey(key,done);
}
function fallbackCopyClientPixKey(key,done){
  const temp=document.createElement("textarea");
  temp.value=key;
  temp.setAttribute("readonly","");
  temp.style.position="fixed";
  temp.style.left="-9999px";
  temp.style.top="0";
  temp.style.opacity="0";
  temp.style.pointerEvents="none";
  document.body.appendChild(temp);
  temp.select();
  temp.setSelectionRange(0,temp.value.length);
  try{document.execCommand("copy");done&&done()}catch(e){alert("Chave PIX: "+key)}
  document.body.removeChild(temp);
}
function formatPaymentTimer(seconds){
  const m=String(Math.floor(seconds/60)).padStart(2,"0");
  const s=String(seconds%60).padStart(2,"0");
  return `${m}:${s}`;
}
function startClientPaymentConfirmTimer(valorPendente,nome){
  const area=document.getElementById("clientPaymentConfirmArea");
  if(!area)return;
  let seconds=60;
  if(clientPaymentTimer)clearInterval(clientPaymentTimer);
  const renderTimer=()=>{
    area.innerHTML=`<div class="payment-timer"><strong>TEMPO DE PAGAMENTO</strong><span>${formatPaymentTimer(seconds)}</span></div>`;
  };
  renderTimer();
  clientPaymentTimer=setInterval(()=>{
    seconds--;
    if(seconds>0){renderTimer();return}
    clearInterval(clientPaymentTimer);
    clientPaymentTimer=null;
    const link=buildPendingPaymentWhatsAppLink(valorPendente,nome);
    area.innerHTML=`<a class="whatsapp-confirm-btn" href="${link}" target="_blank"><img src="https://images.icon-icons.com/1853/PNG/512/iconfinder-whatsapp-4416091_116647.png" alt="WhatsApp"> CONFIRMAR PAGAMENTO</a>`;
  },1000);
}
function openClientPendingPaymentModal(){
  const p=session&&session.profile?session.profile:{};
  const valorPendente=Number(p.PagamentoPendente||0);
  if(valorPendente<=0)return;
  const nome=p.Nome||p.Responsavel||"";
  const qrUrl="https://i.ibb.co/Nd0HHzGc/Whats-App-Image-2026-07-02-at-22-17-59.jpg";
  document.getElementById("clientPaymentBody").innerHTML=`<div class="delivery-card" style="box-shadow:none;margin-top:12px">
    <p class="muted"><b>Cliente/Responsável:</b> ${nome}</p>
    <p class="muted"><b>WhatsApp:</b> ${p.WhatsApp||""}</p>
    <p class="muted"><b>Valor pendente:</b> ${money(valorPendente)}</p>
    <div class="pix-box">
      <b>QR CODE PIX</b>
      <img src="${qrUrl}" alt="QR Code PIX">
      <div class="pix-key-highlight"><small>CHAVE PIX</small><b>${PIX_KEY}</b></div><button type="button" class="copy-pix-btn" id="copyClientPixBtn" onclick="copyClientPixKey()"><i class="fa-solid fa-copy"></i> Copiar chave PIX</button>
      <p class="muted"><b>Banco:</b> MERCADO PAGO LTDA</p>
      <p class="muted"><b>Recebedor:</b> 57.293.143 Marllus Vinicius Silva Araujo</p>
    </div>
    <div id="clientPaymentConfirmArea"></div>
  </div>`;
  document.getElementById("clientPaymentModal").classList.add("active");
  startClientPaymentConfirmTimer(valorPendente,nome);
}
function openClientPaymentModal(id){
  const d=(window.lastClientDeliveries||[]).find(x=>String(x.ID)===String(id));
  if(!d)return alert("Entrega não encontrada no painel.");
  const qrUrl="https://i.ibb.co/Nd0HHzGc/Whats-App-Image-2026-07-02-at-22-17-59.jpg";
  const valorPendente=Number(d.PagamentoPendente||d.ValorPendente||d.Valor||0);
  document.getElementById("clientPaymentBody").innerHTML=`<div class="delivery-card" style="box-shadow:none;margin-top:12px">
    <p class="muted"><b>ID:</b> ${d.ID}</p>
    <p class="muted"><b>Rota:</b> ${d.BairroColeta||""} → ${d.BairroDestino||""}</p>
    <p class="muted"><b>Cliente:</b> ${d.NomeSolicitante||""}</p>
    <p class="muted"><b>Valor para pagar:</b> ${money(valorPendente)}</p>
    <p class="muted"><b>Status atual:</b> ${d.StatusPagamento||"Pendente"}</p>
    <div class="pix-box">
      <b>QR CODE PIX</b>
      <img src="${qrUrl}" alt="QR Code PIX">
      <div class="pix-key-highlight"><small>CHAVE PIX</small><b>${PIX_KEY}</b></div><button type="button" class="copy-pix-btn" id="copyClientPixBtn" onclick="copyClientPixKey()"><i class="fa-solid fa-copy"></i> Copiar chave PIX</button>
      <p class="muted"><b>Banco:</b> MERCADO PAGO LTDA</p>
      <p class="muted"><b>Recebedor:</b> 57.293.143 Marllus Vinicius Silva Araujo</p>
    </div>
    <div id="clientPaymentConfirmArea"></div>
  </div>`;
  document.getElementById("clientPaymentModal").classList.add("active");
  startClientPaymentConfirmTimer(valorPendente,d.NomeSolicitante||d.Responsavel||d.Empresa||"");
}
function closeClientPaymentModal(){if(clientPaymentTimer)clearInterval(clientPaymentTimer);clientPaymentTimer=null;document.getElementById("clientPaymentModal").classList.remove("active")}

function driverMiniHtml(d){
  const likes=Number(d.CurtidasEntregador||0);
  return `<div class="driver-mini">
    <div class="driver-mini-info">
      <i class="fa-solid fa-circle-user"></i>
      <div><b>${d.NomeEntregador||"Entregador"} <i class="fa-solid fa-circle-check verified"></i></b><span>Placa: ${d.PlacaMoto||"-"}</span></div>
    </div>
    <button class="btn like-driver" onclick="likeDriver('${d.ID}')"><i class="fa-solid fa-thumbs-up"></i> Curtir ${likes}</button>
  </div>`;
}
async function likeDriver(id){
  const likedKey="pegaleva_liked_"+id;
  if(localStorage.getItem(likedKey))return alert("Você já curtiu esse entregador nesta entrega.");
  const res=await api("likeDriver",{deliveryId:id});
  if(!res.ok)return alert(res.error||"Erro ao curtir entregador.");
  localStorage.setItem(likedKey,"1");
  refreshPanel();
}

function openHistoryChat(){document.getElementById("historyPanel").classList.add("active")}
function closeHistoryChat(){document.getElementById("historyPanel").classList.remove("active")}
function renderClientHistory(list){
  const box=document.getElementById("historyChatBox");
  if(!box)return;
  const closed=(list||[]).filter(d=>isClosedDelivery(d.Status));
  if(!closed.length){box.innerHTML='<p class="muted">Nenhuma entrega finalizada ou cancelada nas últimas 24H.</p>';return}
  box.innerHTML=closed.map(d=>`<div class="delivery-card">
    <div class="title"><strong>${d.BairroColeta} → ${d.BairroDestino}</strong><span class="badge ${d.Status==="Entrega finalizada"?"green":"red"}">${d.Status}</span></div>
    <p class="muted">ID: <b>${d.ID}</b></p>
    <p class="muted">Valor: <b>${money(d.Valor)}</b></p>
    <p class="muted">Pagamento: <b>${d.StatusPagamento||"Aguardando confirmação"}</b></p>
    <p class="muted">Recebido por: <b>${d.ConfirmacaoEntrega||"-"}</b></p>
    ${d.NomeEntregador?driverMiniHtml(d):""}
    <p class="muted">Atualizado em: ${d.AtualizadoEm||d.CriadoEm||""}</p>
  </div>`).join("");
}

function validateStep(){const s=steps()[currentStep],fields=s.querySelectorAll("input,select,textarea");for(const f of fields){if(f.type!=="hidden"&&f.offsetParent!==null&&!f.dataset.optional&&!f.value.trim()){f.focus();alert("Preencha os campos desta etapa.");return false}}if(currentStep===4&&!document.getElementById("conteudo").value){alert("Selecione o tipo de conteúdo.");return false}return true}
function setStep(n){const total=steps().length;n=Math.max(0,Math.min(n,total-1));steps().forEach((s,i)=>s.classList.toggle("active",i===n));dots().forEach((d,i)=>d.classList.toggle("active",i<=n));currentStep=n}
function nextStepWithLoading(text){if(!validateStep())return;showLoader(text);setTimeout(()=>{hideLoader();setStep(currentStep+1)},500)}
function prevStep(){if(currentStep>0)setStep(currentStep-1)}
function selectChoice(el,field,value){el.parentElement.querySelectorAll(".choice").forEach(c=>c.classList.remove("active"));el.classList.add("active");document.getElementById(field).value=value}
function selectRotaRetorno(el,value){el.parentElement.querySelectorAll(".choice").forEach(c=>c.classList.remove("active"));el.classList.add("active");document.getElementById("rotaRetorno").value=value}
function toggleCouponArea(){const area=document.getElementById("cupomArea");if(!area)return;const show=session&&session.type==="usuario";area.style.display=show?"block":"none";if(!show){const c=document.getElementById("cupom");const m=document.getElementById("cupomMsg");const b=document.getElementById("cupomBtn");if(c)c.value="";if(m)m.innerText="";if(b)b.style.display="none";}}
function onCouponInput(){const c=document.getElementById("cupom");const b=document.getElementById("cupomBtn");const m=document.getElementById("cupomMsg");if(m)m.innerText="";if(b)b.style.display=c&&c.value.trim()?"inline-block":"none"}

function renderCompanyOffers(res){
  const box=document.getElementById("companyOfferBox");
  const normal=document.getElementById("companyNormalPrice");
  const promo=document.getElementById("companyPromoPrice");
  const oferta=document.getElementById("ofertaEntrega");
  if(!box)return;
  if(session){
    const isEmpresa=session.type==="empresa";
    const temDescontoEmpresa=!isEmpresa||Number(session.profile.EntregasComDescontoRestantes||0)>0;
    box.style.display="grid";
    if(normal)normal.innerText=money(res.valorNormal||res.valor);
    if(promo)promo.innerText=money(res.valorPromocional||res.valor);
    if(oferta)oferta.value="normal";
    box.querySelectorAll(".company-offer").forEach((btn,i)=>{
      btn.classList.toggle("active",i===0);
      if(i===1)btn.style.display=temDescontoEmpresa?"":"none";
    });
    if(!temDescontoEmpresa)document.getElementById("priceText").innerText=money(res.valorNormal||res.valor);
  }else{
    box.style.display="none";
    if(oferta)oferta.value="normal";
  }
}
function selectCompanyOffer(tipo){
  const box=document.getElementById("companyOfferBox");
  const oferta=document.getElementById("ofertaEntrega");
  if(session&&session.type==="empresa"&&Number(session.profile.EntregasComDescontoRestantes||0)<=0)tipo="normal";
  if(oferta)oferta.value=tipo;
  if(box)box.querySelectorAll(".company-offer").forEach(btn=>btn.classList.toggle("active",btn.textContent.toLowerCase().includes(tipo==="promocional"?"promocional":"normal")));
  const priceEl=document.getElementById(tipo==="promocional"?"companyPromoPrice":"companyNormalPrice");
  const val=priceEl?priceEl.innerText:"";
  if(val)document.getElementById("priceText").innerText=val;
}
async function loadPrice(){if(!validateStep())return;showLoader("Carregando valores...");const desconto=session.type==="empresa"&&Number(session.profile.EntregasComDescontoRestantes||0)>0?Number(session.profile.DescontoPercentual||0):0;const res=await api("getPrice",{bairroColeta:document.getElementById("bairroColeta").value,bairroDestino:document.getElementById("bairroDestino").value,coletaCidade:document.getElementById("coletaCidade").value,destinoCidade:document.getElementById("destinoCidade").value,desconto,cupom:"",rotaRetorno:document.getElementById("rotaRetorno").value,forcePriceFresh:true});hideLoader();if(!res.ok)return alert("Erro ao carregar preço.");lastPrice=res.valor;document.getElementById("priceText").innerText=money(lastPrice);renderCompanyOffers(res);document.getElementById("ecoText").style.display=res.desconto>0?"inline-block":"none";document.getElementById("ecoText").innerText=res.desconto>0?"Frete com economia "+res.desconto+"%":"Frete com economia";const c=document.getElementById("cupom");if(c)c.value="";const m=document.getElementById("cupomMsg");if(m)m.innerText="";const b=document.getElementById("cupomBtn");if(b)b.style.display="none";toggleCouponArea();setStep(6)}
async function applyCouponPrice(){if(!session||session.type!=="usuario")return;const cupom=document.getElementById("cupom")?.value.trim()||"";const msg=document.getElementById("cupomMsg");const btn=document.getElementById("cupomBtn");if(!cupom){if(msg)msg.innerText="";if(btn)btn.style.display="none";return loadPriceWithoutStep()}showLoader("Verificando cupom...");const desconto=0;const res=await api("getPrice",{bairroColeta:document.getElementById("bairroColeta").value,bairroDestino:document.getElementById("bairroDestino").value,coletaCidade:document.getElementById("coletaCidade").value,destinoCidade:document.getElementById("destinoCidade").value,desconto,cupom,rotaRetorno:document.getElementById("rotaRetorno").value,forcePriceFresh:true});hideLoader();if(!res.ok){if(msg)msg.innerText="Cupom inválido";return}if(msg){msg.style.color="#047857";msg.innerText=res.cupomDesconto>0?"Cupom aplicado com sucesso":""}if(btn)btn.style.display="none";lastPrice=res.valor;document.getElementById("priceText").innerText=money(lastPrice);if(res.cupomDesconto>0){document.getElementById("ecoText").style.display="inline-block";document.getElementById("ecoText").innerText="Cupom aplicado "+res.cupomDesconto+"%"}else document.getElementById("ecoText").style.display="none"}
async function loadPriceWithoutStep(){const desconto=session.type==="empresa"&&Number(session.profile.EntregasComDescontoRestantes||0)>0?Number(session.profile.DescontoPercentual||0):0;const res=await api("getPrice",{bairroColeta:document.getElementById("bairroColeta").value,bairroDestino:document.getElementById("bairroDestino").value,coletaCidade:document.getElementById("coletaCidade").value,destinoCidade:document.getElementById("destinoCidade").value,desconto,cupom:"",rotaRetorno:document.getElementById("rotaRetorno").value,forcePriceFresh:true});if(!res.ok)return;lastPrice=res.valor;document.getElementById("priceText").innerText=money(lastPrice);renderCompanyOffers(res);document.getElementById("ecoText").style.display=res.desconto>0?"inline-block":"none";document.getElementById("ecoText").innerText=res.desconto>0?"Frete com economia "+res.desconto+"%":"Frete com economia"}
function toggleCashObs(){
  const pg=document.getElementById("pagamento").value;
  document.getElementById("cashObs").style.display=pg==="Espécie"?"block":"none";
  document.getElementById("paymentNotice").style.display=pg?"block":"none";
}
async function confirmDelivery(){if(!validateStep())return;const cupom=session.type==="usuario"?(document.getElementById("cupom")?.value.trim()||""):"";if(cupom){showLoader("Verificando cupom...");const check=await api("getPrice",{bairroColeta:document.getElementById("bairroColeta").value,bairroDestino:document.getElementById("bairroDestino").value,coletaCidade:document.getElementById("coletaCidade").value,destinoCidade:document.getElementById("destinoCidade").value,desconto:0,cupom,rotaRetorno:document.getElementById("rotaRetorno").value,forcePriceFresh:true});hideLoader();if(!check.ok){document.getElementById("cupomMsg").style.color="#ef4444";document.getElementById("cupomMsg").innerText="Cupom inválido";return}}showLoader("Buscando entregador...",true);const res=await api("createDelivery",{tipoCliente:session.type,codigoCliente:session.profile.CodigoAcesso,enderecoColeta:fullAddress("coleta"),bairroColeta:document.getElementById("bairroColeta").value,coletaCidade:document.getElementById("coletaCidade").value,enderecoDestino:fullAddress("destino"),referenciaColeta:pontoReferencia("coleta"),referenciaDestino:pontoReferencia("destino"),bairroDestino:document.getElementById("bairroDestino").value,destinoCidade:document.getElementById("destinoCidade").value,nomeDestino:document.getElementById("nomeDestino").value,whatsappDestino:onlyDigits(document.getElementById("whatsappDestino").value),conteudo:document.getElementById("conteudo").value,volumes:document.getElementById("volumes").value,pagamento:document.getElementById("pagamento").value,observacaoPagamento:document.getElementById("observacaoPagamento").value,cupom,rotaRetorno:document.getElementById("rotaRetorno").value,ofertaEntrega:document.getElementById("ofertaEntrega")?document.getElementById("ofertaEntrega").value:"normal"});if(!res.ok){hideLoader();showPanelMessage(res.error||"Não foi possível criar entrega.","bad");return}currentSearchingId=res.delivery.ID;resetDeliveryForm(false);refreshPanel()}
function closeSearchLoader(){hideLoader()}
async function tryAgainCurrentSearch(){
  if(!currentSearchingId){hideLoader();return}
  showLoader("Buscando entregador...",true);
  const res = await api("retryDelivery",{deliveryId:currentSearchingId});
  if(!res.ok){
    hideLoader();
    showStatus("Não foi possível tentar novamente", res.error || "Tente novamente.", "bad");
    return;
  }
  refreshPanel();
}
async function retryDelivery(id){
  showLoader("Buscando entregador...", true);
  const res = await api("retryDelivery",{deliveryId:id});
  if(!res.ok){hideLoader();showStatus("Erro",res.error||"Não foi possível tentar novamente.","bad");return}
  currentSearchingId=id;
  showStatus("Pedido reenviado","A entrega foi enviada novamente para todos os entregadores ativos.","ok");
  refreshPanel();
}

async function cancelGeneralDelivery(id){
  showLoader("Cancelando definitivamente...");
  const res = await api("cancelGeneralDelivery",{deliveryId:id});
  hideLoader();
  if(!res.ok){showStatus("Erro",res.error||"Não foi possível cancelar definitivamente.","bad");return}
  currentSearchingId="";
  showStatus("Entrega cancelada","A entrega foi cancelada definitivamente e não será enviada novamente.","bad");
  refreshPanel();
}

async function cancelDelivery(id){
  showLoader("Cancelando entrega...");
  const res=await api("cancelDelivery",{deliveryId:id,fromClient:true});
  hideLoader();
  if(!res.ok)return alert(res.error||"Erro ao cancelar.");
  currentSearchingId="";
  knownStatuses[id]="Cancelada";
  localStorage.setItem("pegaleva_status_client",JSON.stringify(knownStatuses));
  refreshPanel()
}
function resetDeliveryForm(){["coletaRua","coletaNumero","coletaReferencia","coletaCidade","destinoRua","destinoNumero","destinoReferencia","destinoCidade","nomeDestino","whatsappDestino","conteudo","observacaoPagamento","cupom"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});updateBairroOptions();document.getElementById("bairroColeta").value="";document.getElementById("bairroDestino").value="";document.getElementById("volumes").value="1";if(document.getElementById("rotaRetorno"))document.getElementById("rotaRetorno").value="Não";lastPrice=0;if(document.getElementById("ofertaEntrega"))document.getElementById("ofertaEntrega").value="normal";if(document.getElementById("companyOfferBox"))document.getElementById("companyOfferBox").style.display="none";document.getElementById("paymentNotice").style.display="none";if(document.getElementById("cupomMsg"))document.getElementById("cupomMsg").innerText="";if(document.getElementById("cupomBtn"))document.getElementById("cupomBtn").style.display="none";toggleCouponArea();document.querySelectorAll(".choice").forEach(c=>c.classList.remove("active"));const rr=document.getElementById("rotaRetorno");if(rr){const rotaStep=rr.closest(".step");if(rotaStep){const choices=rotaStep.querySelectorAll(".choice");if(choices[1])choices[1].classList.add("active");}}setStep(0)}
function showStatus(title,text,type){document.getElementById("statusTitle").innerText=title;document.getElementById("statusText").innerText=text;document.getElementById("statusIcon").className=type==="bad"?"fa-solid fa-circle-xmark":"fa-solid fa-circle-check";document.getElementById("statusIcon").style.color=type==="bad"?"#ef4444":"#10b981";document.getElementById("statusModal").classList.add("active")}
function closeStatusModal(){document.getElementById("statusModal").classList.remove("active")}
function logout(){
document.querySelector(".history-chat-btn").style.display="none";
showLoader("Saindo...");
setTimeout(()=>{
if(refreshTimer)clearTimeout(refreshTimer);
localStorage.removeItem("pegaleva_client");
session=null;
hideLoader();
document.getElementById("appScreen").classList.remove("active");
document.getElementById("accessScreen").classList.add("active");
setSupportVisibility(true);
},2000);
}

async function openChatModal(id){
  chatDeliveryId=id;
  document.getElementById("chatInput").value="";
  document.getElementById("chatMessages").innerHTML='<p class="muted">Carregando mensagens...</p>';
  document.getElementById("chatModal").classList.add("active");
  await loadChatMessages(true);
}
function closeChatModal(){chatDeliveryId="";document.getElementById("chatModal").classList.remove("active");refreshPanel()}
async function loadChatMessages(markRead){
  if(!chatDeliveryId||!session)return;
  const res=await api("getMessages",{deliveryId:chatDeliveryId,viewer:"cliente",markRead:!!markRead});
  const box=document.getElementById("chatMessages");
  if(!res.ok){box.innerHTML='<p class="muted">Erro ao carregar mensagens.</p>';return}
  const msgs=res.messages||[];
  box.innerHTML=msgs.length?msgs.map(m=>`<div class="chat-msg ${m.RemetenteTipo==="cliente"?"me":"other"}">${m.Mensagem||""}<small>${m.CriadoEm||""}</small></div>`).join(""):'<p class="muted">Nenhuma mensagem ainda.</p>';
  box.scrollTop=box.scrollHeight;
}
async function sendChatMessage(){
  const input=document.getElementById("chatInput"), texto=input.value.trim();
  if(!chatDeliveryId||!texto)return;
  input.value="";
  const res=await api("sendMessage",{deliveryId:chatDeliveryId,from:"cliente",mensagem:texto});
  if(!res.ok)return alert(res.error||"Erro ao enviar mensagem.");
  loadChatMessages(true);
  refreshPanel();
}


function openSimuladorFrete(){document.getElementById("simuladorFreteModal").classList.add("active");simUpdateBairros()}
function closeSimuladorFrete(){document.getElementById("simuladorFreteModal").classList.remove("active")}
const simSteps=["simStepComoSolicitar","simStepLocais","simStepValor"];
function simGoStep(index){
  simClearError();
  if(index===1&&!document.getElementById("simTipoSolicitacao").value){simShowError("Escolha se deseja solicitar como empresa ou como usuário.");return}
  simSteps.forEach((id,i)=>document.getElementById(id).classList.toggle("active",i===index));
  document.querySelectorAll("#simuladorFreteModal .sim-progress .bar").forEach((bar,i)=>bar.classList.toggle("active",i<=index));
}
function simFillBairroSelect(selectId,cidadeId){
  const select=document.getElementById(selectId),cidade=document.getElementById(cidadeId).value;
  if(!select)return;
  if(cidade==="Benedito Leite"){select.innerHTML='<option value="Benedito Leite">Benedito Leite</option>';select.value="Benedito Leite";select.disabled=true;return}
  if(cidade==="Uruçuí"){select.disabled=false;select.innerHTML='<option value="">Selecione</option>'+BAIRROS_URUCUÍ.map(b=>`<option>${b}</option>`).join("");return}
  select.disabled=false;select.innerHTML='<option value="">Selecione a cidade primeiro</option>';
}
function simUpdateBairros(){
  const coletaAtual=document.getElementById("simBairroColeta")?.value||"",destinoAtual=document.getElementById("simBairroDestino")?.value||"";
  simFillBairroSelect("simBairroColeta","simColetaCidade");simFillBairroSelect("simBairroDestino","simDestinoCidade");
  if(BAIRROS_URUCUÍ.includes(coletaAtual))document.getElementById("simBairroColeta").value=coletaAtual;
  if(BAIRROS_URUCUÍ.includes(destinoAtual))document.getElementById("simBairroDestino").value=destinoAtual;
}
function simSelectTipoSolicitacao(el,value){el.parentElement.querySelectorAll(".choice").forEach(c=>c.classList.remove("active"));el.classList.add("active");document.getElementById("simTipoSolicitacao").value=value;simClearError()}
function simSelectRotaRetorno(el,value){el.parentElement.querySelectorAll(".choice").forEach(c=>c.classList.remove("active"));el.classList.add("active");document.getElementById("simRotaRetorno").value=value}
function simSetLoading(active){document.getElementById("simLoader").classList.toggle("active",active)}
function simShowError(msg){const box=document.getElementById("simErrorBox");box.innerText=msg||"Não foi possível calcular o frete.";box.classList.add("active")}
function simClearError(){const box=document.getElementById("simErrorBox");box.innerText="";box.classList.remove("active")}
function simValidarLocais(){
  const campos=["simColetaCidade","simBairroColeta","simDestinoCidade","simBairroDestino"];
  for(const id of campos){const el=document.getElementById(id);if(!el.value){simShowError("Preencha todos os campos de cidade e bairro para simular o frete.");return false}}
  return true;
}
async function simCalcularFrete(){
  simClearError();
  if(!document.getElementById("simTipoSolicitacao").value){simShowError("Escolha se deseja solicitar como empresa ou como usuário.");simGoStep(0);return}
  if(!simValidarLocais())return;
  simGoStep(2);simSetLoading(true);
  const tipo=document.getElementById("simTipoSolicitacao").value;
  const payload={bairroColeta:document.getElementById("simBairroColeta").value,bairroDestino:document.getElementById("simBairroDestino").value,coletaCidade:document.getElementById("simColetaCidade").value,destinoCidade:document.getElementById("simDestinoCidade").value,rotaRetorno:document.getElementById("simRotaRetorno").value,desconto:tipo==="empresa"?20:0,cupom:"",forcePriceFresh:true};
  const res=await api("getPrice",payload);simSetLoading(false);
  if(!res.ok){simShowError(res.error||"Não foi possível calcular o frete.");return}
  document.getElementById("simPriceText").innerHTML=tipo==="empresa"?`<div class="sim-offers"><div class="sim-offer"><strong><i class="fa-solid fa-motorcycle"></i> Entrega Normal</strong><small>Valor com desconto da empresa</small><b>${money(res.valorNormal||res.valor)}</b></div><div class="sim-offer promo"><strong><i class="fa-solid fa-tag"></i> Entrega Promocional</strong><small>Oferta Promocional</small><b>${money(res.valorPromocional||res.valor)}</b></div></div>`:money(res.valor);
  const tipoTxt=tipo==="empresa"?"Empresa":"Usuário";
  document.getElementById("simRouteText").innerHTML=`<i class="fa-solid fa-motorcycle"></i> ${tipoTxt} • ${payload.bairroColeta} → ${payload.bairroDestino}${payload.rotaRetorno==="Sim"?" • com retorno":""}`;
}

function openForgotModal(){document.getElementById("forgotResult").innerText="";document.getElementById("forgotModal").classList.add("active")}
function closeForgotModal(){document.getElementById("forgotModal").classList.remove("active")}
async function recoverCode(){
  const email=document.getElementById("forgotEmail").value.trim();
  const res=await api("forgotCode",{email});
  document.getElementById("forgotResult").innerText=res.ok?("SEU CÓDIGO É: "+res.codigo):(res.error||"E-mail não encontrado.");
}

function showSuccessToast(msg){
 const t=document.getElementById('successToast');
 if(!t)return;
 t.textContent=msg||'Informações adicionadas';
 t.classList.add('show');
 clearTimeout(t._h);
 t._h=setTimeout(()=>t.classList.remove('show'),2000);
}





function enhanceClientDeliveryCards(){
  const selectors=[
    "#historyList .delivery-card",
    "#deliveriesBox .delivery-card",
    "#clientDeliveries .delivery-card",
    "#myDeliveries .delivery-card",
    ".history-panel .delivery-card"
  ].join(",");
  document.querySelectorAll(selectors).forEach(card=>{
    if(card.dataset.clientPro==="1")return;
    card.dataset.clientPro="1";

    const title=card.querySelector(".title");
    if(title&&!card.querySelector(".client-route-pro")){
      const strong=title.querySelector("strong");
      const routeText=strong?strong.innerText.trim():"";
      if(routeText.includes("→")){
        const parts=routeText.split("→").map(x=>x.trim()).filter(Boolean);
        if(parts.length>=2){
          const route=document.createElement("div");
          route.className="client-route-pro";
          route.innerHTML=`<div class="client-route-point"><div class="client-route-label">Pickup</div><div class="client-route-address">${parts[0]}</div></div><div class="client-route-point dest"><div class="client-route-label">Entrega</div><div class="client-route-address">${parts.slice(1).join(" → ")}</div></div>`;
          title.insertAdjacentElement("afterend",route);
        }
      }
    }

    card.querySelectorAll("p").forEach(p=>{
      if(p.dataset.clientProText==="1")return;
      let html=p.innerHTML;
      html=html.replace(/(<b>Valor:<\/b>\s*)(R\$\s*[\d.,]+)/i,'$1<span class="delivery-price-client">$2</span>');
      html=html.replace(/Buscando entregador\.\.\./gi,'<span class="route-mini"><i class="fa-solid fa-motorcycle"></i> Buscando entregador...</span>');
      html=html.replace(/Aguardando entregador/gi,'<span class="badge yellow">Aguardando entregador</span>');
      p.innerHTML=html;
      p.dataset.clientProText="1";
    });
  });
}



const clientCardsObserver=new MutationObserver(()=>{try{enhanceClientDeliveryCards()}catch(e){}});
document.addEventListener("DOMContentLoaded",()=>{
  try{
    enhanceClientDeliveryCards();
    clientCardsObserver.observe(document.body,{childList:true,subtree:true});
  }catch(e){}
});

// Aviso amigável apenas para falhas de sistema/planilha
function showSystemDelayNotice(){
  let box=ensureSlowLoaderNotice();
  if(box){
    box.style.display="block";
  }else{
    alert("Ops, parece que está demorando mais que o esperado. Tente novamente.");
  }
}


/* =========================================================
   Correção reforçada dos selects de bairros
   Evita bug onde os bairros às vezes não aparecem no formulário.
========================================================= */
(function(){
  const BAIRROS_PADRAO_URUCUÍ = ["Fogoso","Malvinas","Vaquejada","Centro","Aeroporto","Novo Horizonte","Areia","Esperança","Água Branca","Alto Bonito","São Francisco","Babilônia","Canaã","Portal dos Cerrados","Cerrados Park","Vista Bela"];

  function getEl(id){
    return document.getElementById(id);
  }

  function bairrosPorCidade(cidade){
    cidade = String(cidade || "").trim();
    if(cidade === "Benedito Leite") return ["Benedito Leite"];
    return (typeof BAIRROS_URUCUÍ !== "undefined" && Array.isArray(BAIRROS_URUCUÍ) && BAIRROS_URUCUÍ.length)
      ? BAIRROS_URUCUÍ
      : BAIRROS_PADRAO_URUCUÍ;
  }

  function ensureBairroSelect(selectId, cidadeId, keepValue=true){
    const select = getEl(selectId);
    const cidadeEl = getEl(cidadeId);
    if(!select || !cidadeEl) return;

    const cidade = String(cidadeEl.value || "").trim();
    const atual = keepValue ? String(select.value || "").trim() : "";
    const bairros = bairrosPorCidade(cidade);

    if(cidade === "Benedito Leite"){
      select.disabled = true;
      select.innerHTML = '<option value="Benedito Leite">Benedito Leite</option>';
      select.value = "Benedito Leite";
      return;
    }

    select.disabled = false;

    const precisaRecriar =
      select.options.length <= 1 ||
      !Array.from(select.options).some(o => bairros.includes(o.value || o.textContent));

    if(precisaRecriar){
      select.innerHTML = '<option value="">Selecione</option>' + bairros.map(b => `<option value="${b}">${b}</option>`).join("");
    }

    if(atual && bairros.includes(atual)){
      select.value = atual;
    }else if(select.value && !bairros.includes(select.value)){
      select.value = "";
    }
  }

  const originalFillBairroSelect = typeof fillBairroSelect === "function" ? fillBairroSelect : null;
  fillBairroSelect = function(selectId,cidadeId){
    try{
      ensureBairroSelect(selectId,cidadeId,true);
    }catch(e){
      if(originalFillBairroSelect) try{ originalFillBairroSelect(selectId,cidadeId); }catch(err){}
    }
  };

  const originalUpdateBairroOptions = typeof updateBairroOptions === "function" ? updateBairroOptions : null;
  updateBairroOptions = function(){
    try{
      ensureBairroSelect("bairroColeta","coletaCidade",true);
      ensureBairroSelect("bairroDestino","destinoCidade",true);
    }catch(e){
      if(originalUpdateBairroOptions) try{ originalUpdateBairroOptions(); }catch(err){}
    }
  };

  function bindBairroFixEvents(){
    [["coletaCidade","bairroColeta"],["destinoCidade","bairroDestino"]].forEach(pair=>{
      const cidade = getEl(pair[0]);
      const bairro = getEl(pair[1]);
      if(cidade && cidade.dataset.bairroFixReady !== "1"){
        cidade.dataset.bairroFixReady = "1";
        cidade.addEventListener("change",()=>ensureBairroSelect(pair[1],pair[0],false));
        cidade.addEventListener("input",()=>ensureBairroSelect(pair[1],pair[0],false));
        cidade.addEventListener("blur",()=>ensureBairroSelect(pair[1],pair[0],true));
      }
      if(bairro && bairro.dataset.bairroFixReady !== "1"){
        bairro.dataset.bairroFixReady = "1";
        bairro.addEventListener("focus",()=>ensureBairroSelect(pair[1],pair[0],true));
        bairro.addEventListener("click",()=>ensureBairroSelect(pair[1],pair[0],true));
        bairro.addEventListener("touchstart",()=>ensureBairroSelect(pair[1],pair[0],true),{passive:true});
      }
    });
  }

  const originalOpenPanelBairroFix = typeof openPanel === "function" ? openPanel : null;
  openPanel = function(){
    if(originalOpenPanelBairroFix) originalOpenPanelBairroFix();
    setTimeout(()=>{ bindBairroFixEvents(); updateBairroOptions(); },50);
    setTimeout(()=>{ bindBairroFixEvents(); updateBairroOptions(); },350);
  };

  const originalSetStepBairroFix = typeof setStep === "function" ? setStep : null;
  setStep = function(n){
    const result = originalSetStepBairroFix ? originalSetStepBairroFix(n) : undefined;
    setTimeout(()=>{ bindBairroFixEvents(); updateBairroOptions(); },30);
    return result;
  };

  const originalValidateStepBairroFix = typeof validateStep === "function" ? validateStep : null;
  validateStep = function(){
    bindBairroFixEvents();
    updateBairroOptions();
    return originalValidateStepBairroFix ? originalValidateStepBairroFix() : true;
  };

  document.addEventListener("DOMContentLoaded",()=>{
    bindBairroFixEvents();
    updateBairroOptions();
    setTimeout(updateBairroOptions,300);
  });

  window.addEventListener("pageshow",()=>{
    bindBairroFixEvents();
    updateBairroOptions();
  });

  setTimeout(()=>{ bindBairroFixEvents(); updateBairroOptions(); },200);
})();
