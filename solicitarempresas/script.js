const API_URL="https://script.google.com/macros/s/AKfycbx739xcgwZ0NTYdtj0pjFN0QAqyNh94PV96PxKRy90pOvKHOg1V0LFf-gjkrIsKaL1w/exec";
const BAIRROS_URUCUÍ=["Fogoso","Malvinas","Vaquejada","Centro","Aeroporto","Novo Horizonte","Areia","Esperança","Água Branca","Alto Bonito","São Francisco","Babilônia","Canaã","Portal dos Cerrados","Cerrados Park","Vista Bela"];
let companySession=JSON.parse(localStorage.getItem("pegaleva_company_light")||"null");
let companyDeliveries=[],savedOrders=[],deliveryStep=0,priceStep=0,deliveryPriceData=null,refreshTimer=null,priceDebounce=null,pendingSavedOrderId=null;

function qs(id){return document.getElementById(id)}
function onlyDigits(v){return String(v||"").replace(/\D/g,"")}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function showLoader(text){qs("loaderText").innerText=text||"Carregando...";qs("loader").classList.add("active")}
function hideLoader(){qs("loader").classList.remove("active")}
async function api(action,data={}){try{const response=await fetch(API_URL,{method:"POST",cache:"no-store",body:JSON.stringify({action,...data})});if(!response.ok)throw new Error("HTTP "+response.status);return await response.json()}catch(error){return {ok:false,error:"Não foi possível conectar ao sistema. Tente novamente."}}}
function fullAddress(ruaId,numeroId,cidadeId){return [qs(ruaId).value.trim(),qs(numeroId).value.trim()||"0",qs(cidadeId).value].filter(Boolean).join(", ")}
function companyCode(){return companySession?.profile?.CodigoAcesso||""}
function companyDiscount(){const p=companySession?.profile||{};return Number(p.EntregasComDescontoRestantes||0)>0?Number(p.DescontoPercentual||0):0}
function syncCityBairro(cityId,bairroId){const city=qs(cityId).value,select=qs(bairroId);if(city==="Benedito Leite"){select.innerHTML='<option value="Benedito Leite">Benedito Leite</option>';select.disabled=true;return}select.disabled=false;select.innerHTML='<option value="">Selecione</option>'+BAIRROS_URUCUÍ.map(b=>`<option value="${b}">${b}</option>`).join("")}
function initializeSelects(){[["orderCity","orderBairro"],["dColetaCidade","dColetaBairro"],["dDestinoCidade","dDestinoBairro"],["pColetaCidade","pColetaBairro"],["pDestinoCidade","pDestinoBairro"]].forEach(x=>syncCityBairro(x[0],x[1]))}

async function loginCompany(){const codigo=qs("companyCode").value.trim();qs("loginError").innerText="";if(!codigo){qs("loginError").innerText="Digite o código de acesso da empresa.";return}showLoader("Identificando empresa...");const res=await api("getClientPanel",{codigo,expectedType:"empresa",limit:80});hideLoader();if(!res.ok||res.type!=="empresa"){qs("loginError").innerText="Código de empresa inválido.";return}companySession={ok:true,type:"empresa",profile:res.profile};companyDeliveries=res.deliveries||[];localStorage.setItem("pegaleva_company_light",JSON.stringify(companySession));openApp();await loadSavedOrders();renderDeliveries()}
function openApp(){if(!companySession||companySession.type!=="empresa")return;qs("loginScreen").classList.add("hidden");qs("appScreen").classList.remove("hidden");qs("floatingDeliveries").classList.add("active");initializeSelects();renderCompanyHeader();renderDeliveries();startRefresh()}
function renderCompanyHeader(){const p=companySession.profile||{},name=p.Responsavel||"Empresa";qs("companyWelcome").innerText="Olá, "+String(name).trim().split(/\s+/)[0]+"!";qs("discountStat").innerText="Desconto: "+Number(p.DescontoPercentual||0)+"%";qs("discountRemainingStat").innerText="Entregas com desconto: "+Number(p.EntregasComDescontoRestantes||0);qs("priorityStat").innerText="Prioridade: "+(p.Prioridade||"Desativado")}
function logoutCompany(){clearInterval(refreshTimer);companySession=null;companyDeliveries=[];savedOrders=[];localStorage.removeItem("pegaleva_company_light");closeDeliveriesDrawer();qs("appScreen").classList.add("hidden");qs("loginScreen").classList.remove("hidden");qs("companyCode").value="";qs("loginError").innerText="";window.scrollTo(0,0)}
function openPanel(id){qs("menuGrid").classList.add("hidden");document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));qs(id).classList.add("active");if(id==="orderPanel")loadSavedOrders();if(id==="deliveryPanel")setDeliveryStep(0);if(id==="pricePanel")setPriceStep(0);window.scrollTo({top:0,behavior:"smooth"})}
function backMenu(){document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));qs("menuGrid").classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"})}

function setDeliveryStep(step){deliveryStep=Math.max(0,Math.min(3,step));document.querySelectorAll("[data-delivery-step]").forEach((el,i)=>el.classList.toggle("active",i===deliveryStep));qs("deliveryProgress").querySelectorAll("span").forEach((el,i)=>el.classList.toggle("active",i<=deliveryStep));if(deliveryStep===3)buildDeliverySummary()}
function validateDeliveryStep(step){const fields=step===0?[["dColetaCidade","cidade da coleta"],["dColetaBairro","bairro da coleta"],["dColetaRua","rua da coleta"],["dColetaNumero","número da coleta"],["dColetaRef","referência da coleta"]]:step===1?[["dDestinoCidade","cidade do destino"],["dDestinoBairro","bairro do destino"],["dDestinoRua","rua do destino"],["dDestinoNumero","número do destino"],["dDestinoRef","referência do destino"],["dNomeDestino","nome do destinatário"],["dWhatsDestino","WhatsApp do destinatário"]]:[["dConteudo","conteúdo da entrega"],["dVolumes","quantidade de volumes"],["dPagamento","forma de pagamento"]];const missing=fields.filter(([id])=>!String(qs(id).value||"").trim()).map(x=>x[1]);if(missing.length){alert("Preencha: "+missing.join(", ")+".");return false}return true}
async function nextDeliveryStep(){if(!validateDeliveryStep(deliveryStep))return;if(deliveryStep===2){showLoader("Calculando o valor final...");deliveryPriceData=await getPriceData("d");hideLoader();if(!deliveryPriceData.ok){alert(deliveryPriceData.error||"Não foi possível calcular o frete.");return}renderDeliverySelectedPrice()}setDeliveryStep(deliveryStep+1)}
function prevDeliveryStep(){setDeliveryStep(deliveryStep-1)}
function buildDeliverySummary(){const selectedPrice=qs("dOffer").value==="promocional"?deliveryPriceData?.valorPromocional:(deliveryPriceData?.valorNormal??deliveryPriceData?.valor);const discount=Number(deliveryPriceData?.desconto||0);qs("deliverySummary").innerHTML=[
 ["Coleta",fullAddress("dColetaRua","dColetaNumero","dColetaCidade")+" — "+qs("dColetaBairro").value],
 ["Destino",fullAddress("dDestinoRua","dDestinoNumero","dDestinoCidade")+" — "+qs("dDestinoBairro").value],
 ["Destinatário",qs("dNomeDestino").value+" • "+qs("dWhatsDestino").value],
 ["Conteúdo",qs("dConteudo").value+" • "+qs("dVolumes").value+" volume(s)"],
 ["Pagamento",qs("dPagamento").value+(qs("dObsPagamento").value?" — "+qs("dObsPagamento").value:"")],
 ["Rota de retorno",qs("dReturn").value==="sim"?"Sim":"Não"],
 ["Tipo de frete",qs("dOffer").value==="promocional"?"Oferta para empresa":"Entrega normal"],
 ["Desconto da empresa",discount>0?discount+"% aplicado":"Sem desconto percentual disponível"],
 ["Valor final",money(selectedPrice)]
 ].map(([a,b])=>`<div class="summary-row"><span>${a}</span><b>${esc(b)}</b></div>`).join("")}
function toggleCashObservation(){qs("cashObservationBox").classList.toggle("hidden",qs("dPagamento").value!=="Espécie")}
function useCompanyAddress(){const p=companySession.profile||{};qs("dColetaRua").value=p.Rua||p.Endereco||"";qs("dColetaNumero").value=p.Numero||"";qs("dColetaRef").value=p.Referencia||"";if(p.Cidade){qs("dColetaCidade").value=String(p.Cidade).includes("Benedito")?"Benedito Leite":"Uruçuí";syncCityBairro("dColetaCidade","dColetaBairro")}}
function scheduleDeliveryPrice(){clearTimeout(priceDebounce);priceDebounce=setTimeout(previewDeliveryPrice,350)}
async function previewDeliveryPrice(){if(!qs("dColetaBairro").value||!qs("dDestinoBairro").value)return;deliveryPriceData=await getPriceData("d");if(deliveryPriceData.ok)renderDeliverySelectedPrice()}
function renderDeliverySelectedPrice(){if(!deliveryPriceData?.ok)return;const selected=qs("dOffer").value==="promocional"?deliveryPriceData.valorPromocional:(deliveryPriceData.valorNormal??deliveryPriceData.valor);qs("deliveryPreview").innerText=money(selected);const discount=Number(deliveryPriceData.desconto||0);qs("deliveryDiscountInfo").innerText=discount>0?`Desconto da empresa de ${discount}% aplicado. Restam ${Number(companySession.profile.EntregasComDescontoRestantes||0)} entrega(s) com desconto.`:"Sua empresa não possui desconto percentual disponível neste momento."}
async function createDelivery(){if(!validateDeliveryStep(0)||!validateDeliveryStep(1)||!validateDeliveryStep(2))return;showLoader("Solicitando entregador...");const res=await api("createDelivery",{tipoCliente:"empresa",codigoCliente:companyCode(),enderecoColeta:fullAddress("dColetaRua","dColetaNumero","dColetaCidade"),bairroColeta:qs("dColetaBairro").value,coletaCidade:qs("dColetaCidade").value,referenciaColeta:qs("dColetaRef").value,enderecoDestino:fullAddress("dDestinoRua","dDestinoNumero","dDestinoCidade"),bairroDestino:qs("dDestinoBairro").value,destinoCidade:qs("dDestinoCidade").value,referenciaDestino:qs("dDestinoRef").value,nomeDestino:qs("dNomeDestino").value.trim(),whatsappDestino:onlyDigits(qs("dWhatsDestino").value),conteudo:qs("dConteudo").value.trim(),volumes:qs("dVolumes").value,pagamento:qs("dPagamento").value,observacaoPagamento:qs("dObsPagamento").value.trim(),rotaRetorno:qs("dReturn").value,ofertaEntrega:qs("dOffer").value});hideLoader();if(!res.ok){showResult("deliveryResult",res.error||"Não foi possível solicitar o entregador.",false);return}showResult("deliveryResult","Solicitação criada com sucesso. Você pode acompanhar pelo botão flutuante de entregas.",true);resetDeliveryForm();await refreshAll();openDeliveriesDrawer()}
function resetDeliveryForm(){["dColetaRua","dColetaNumero","dColetaRef","dDestinoRua","dDestinoNumero","dDestinoRef","dNomeDestino","dWhatsDestino","dConteudo","dObsPagamento"].forEach(id=>qs(id).value="");qs("dVolumes").value="1";qs("dPagamento").value="PIX";qs("dReturn").value="nao";qs("dOffer").value="normal";deliveryPriceData=null;qs("deliveryPreview").innerText="R$ 0,00";toggleCashObservation();setDeliveryStep(0)}

function setPriceStep(step){priceStep=Math.max(0,Math.min(2,step));document.querySelectorAll("[data-price-step]").forEach((el,i)=>el.classList.toggle("active",i===priceStep));qs("priceProgress").querySelectorAll("span").forEach((el,i)=>el.classList.toggle("active",i<=priceStep))}
async function nextPriceStep(){if(priceStep===0&&!qs("pColetaBairro").value)return alert("Selecione o bairro da coleta.");if(priceStep===1){if(!qs("pDestinoBairro").value)return alert("Selecione o bairro do destino.");showLoader("Calculando taxas...");const res=await getPriceData("p");hideLoader();if(!res.ok)return alert(res.error||"Não foi possível calcular.");renderPriceResult(res)}setPriceStep(priceStep+1)}
function prevPriceStep(){setPriceStep(priceStep-1)}
function renderPriceResult(res){const discount=Number(res.desconto||0);qs("priceResult").innerHTML=`<div class="price-box"><span class="muted">Valores encontrados</span><div class="price-options"><div class="price-option active">Entrega normal<b>${money(res.valorNormal??res.valor)}</b><small>Valor com desconto percentual da empresa, quando disponível.</small></div><div class="price-option">Oferta para empresa<b>${money(res.valorPromocional)}</b><small>Oferta promocional exclusiva para empresa.</small></div></div><div class="discount-box">${discount>0?`Desconto de ${discount}% aplicado. Sua empresa ainda possui ${Number(companySession.profile.EntregasComDescontoRestantes||0)} entrega(s) com desconto.`:"Nenhum desconto percentual disponível para esta empresa neste momento."}</div></div>`}
function openDeliveryFromSimulation(){qs("dColetaCidade").value=qs("pColetaCidade").value;syncCityBairro("dColetaCidade","dColetaBairro");qs("dColetaBairro").value=qs("pColetaBairro").value;qs("dDestinoCidade").value=qs("pDestinoCidade").value;syncCityBairro("dDestinoCidade","dDestinoBairro");qs("dDestinoBairro").value=qs("pDestinoBairro").value;qs("dReturn").value=qs("pReturn").value;openPanel("deliveryPanel");scheduleDeliveryPrice()}
async function getPriceData(prefix){return api("getPrice",{bairroColeta:qs(prefix+"ColetaBairro").value,bairroDestino:qs(prefix+"DestinoBairro").value,coletaCidade:qs(prefix+"ColetaCidade").value,destinoCidade:qs(prefix+"DestinoCidade").value,rotaRetorno:qs(prefix+"Return").value,desconto:companyDiscount(),cupom:"",forcePriceFresh:true})}

async function createOrder(){const nomePedido=qs("orderName").value.trim(),cidadeColeta=qs("orderCity").value,bairroColeta=qs("orderBairro").value,rotaRetorno=qs("orderReturn").value;if(!nomePedido||!bairroColeta)return showResult("orderResult","Preencha o nome e o bairro da coleta.",false);showLoader("Criando pedido...");const res=await api("createSavedOrder",{codigoEmpresa:companyCode(),codigo:companyCode(),whatsappEmpresa:companySession.profile.WhatsApp||"",nomePedido,cidadeColeta,bairroColeta,rotaRetorno});hideLoader();if(!res.ok)return showResult("orderResult",res.error||"Não foi possível criar o pedido.",false);const codigo=res.pedidoCodigo||res.codigoPedido||"";const mensagem=`INFORME SEUS DADOS NO FORMULÁRIO ABAIXO PARA RECEBER SEU PRODUTO EM SUA CASA COM QUALIDADE E ECONOMIA!\n\nhttps://pegaelevadelivery.com.br/rastreioentrega\n\nCódigo do pedido: ${String(codigo).toUpperCase()}`;try{await navigator.clipboard.writeText(mensagem)}catch(e){}qs("orderResult").innerHTML=`<div class="result">Pedido criado com sucesso.<span class="code">${esc(codigo)}</span>A mensagem para o cliente foi copiada quando permitido pelo navegador.</div>`;qs("orderName").value="";await loadSavedOrders()}
async function loadSavedOrders(){if(!companySession)return;const res=await api("getSavedClients",{codigoEmpresa:companyCode(),codigo:companyCode(),whatsappEmpresa:companySession.profile.WhatsApp||""});savedOrders=res&&res.ok?(res.list||res.salvos||res.saved||res.clientes||[]):[];renderSavedOrders()}
function renderSavedOrders(){const box=qs("savedOrdersBox");if(!savedOrders.length){box.innerHTML='<div class="item-card"><p class="muted">Nenhum pedido ativo no momento.</p></div>';return}box.innerHTML=savedOrders.map(c=>{const requested=!!(c.EntregaID||String(c.StatusPedido||"").toLowerCase().includes("solicitado"));const filled=!!c.NomeDestino;return `<article class="item-card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap"><strong>${esc(c.NomePedido||c.NomeDestino||"Pedido")}</strong><span class="badge ${requested?"green":filled?"yellow":""}">${requested?"Solicitado":filled?"Preenchido":"Aguardando cliente"}</span></div><p class="muted"><b>Código:</b> ${esc(c.PedidoCodigo||"---")}</p><p class="muted"><b>Coleta:</b> ${esc(c.CidadeColeta||"")} • ${esc(c.BairroColeta||"---")} • ${c.RotaRetorno?"com retorno":"sem retorno"}</p>${filled?`<p class="muted"><b>Destino:</b> ${esc(c.NomeDestino||"")} — ${esc(c.Rua||"")}, Nº ${esc(c.Numero||"0")} - ${esc(c.Bairro||"")}, ${esc(c.Cidade||"")}</p>`:'<p class="muted">Aguardando o cliente preencher os dados.</p>'}${c.FreteEscolhido?`<p class="muted"><b>Frete:</b> ${esc(c.FreteEscolhido)} • ${money(c.ValorFrete||0)}</p>`:""}<div class="item-actions"><button class="btn light" onclick="copyOrderMessage('${esc(c.PedidoCodigo||"")}')"><i class="fa-solid fa-copy"></i> Copiar</button>${requested?'<button class="btn gray" disabled>Já solicitado</button>':filled?`<button class="btn green" onclick="requestSavedOrder('${esc(c.ID||"")}')"><i class="fa-solid fa-motorcycle"></i> Solicitar</button>`:'<button class="btn gray" disabled>Aguardando</button>'}</div></article>`}).join("")}
async function copyOrderMessage(code){const message=`INFORME SEUS DADOS NO FORMULÁRIO ABAIXO PARA RECEBER SEU PRODUTO EM SUA CASA COM QUALIDADE E ECONOMIA!\n\nhttps://pegaelevadelivery.com.br/rastreioentrega\n\nCódigo do pedido: ${String(code).toUpperCase()}`;try{await navigator.clipboard.writeText(message);alert("Mensagem copiada com sucesso.")}catch(e){alert(message)}}
function requestSavedOrder(id){
  const order=savedOrders.find(x=>String(x.ID)===String(id));
  if(!order)return alert("Pedido não encontrado. Atualize a página e tente novamente.");
  pendingSavedOrderId=id;
  const p=companySession?.profile||{};
  qs("savedOrderRuaColeta").value=p.Rua||p.Endereco||"";
  qs("savedOrderNumeroColeta").value=p.Numero||"";
  qs("savedOrderReferenciaColeta").value=p.Referencia||"";
  qs("savedOrderCidadeColeta").value=String(p.Cidade||order.CidadeColeta||"Uruçuí").includes("Benedito")?"Benedito Leite":"Uruçuí";
  qs("savedOrderConfirmationInfo").innerHTML=`Pedido <b>${esc(order.NomePedido||order.PedidoCodigo||"selecionado")}</b>. Confirme os dados da coleta da sua empresa antes de solicitar.`;
  qs("savedOrderCompanyModal").classList.add("active");
}
function closeSavedOrderCompanyModal(){
  pendingSavedOrderId=null;
  qs("savedOrderCompanyModal").classList.remove("active");
}
function useSavedCompanyAddressForOrder(){
  const p=companySession?.profile||{};
  qs("savedOrderRuaColeta").value=p.Rua||p.Endereco||"";
  qs("savedOrderNumeroColeta").value=p.Numero||"";
  qs("savedOrderReferenciaColeta").value=p.Referencia||"";
  qs("savedOrderCidadeColeta").value=String(p.Cidade||"Uruçuí").includes("Benedito")?"Benedito Leite":"Uruçuí";
}
async function confirmSavedOrderDelivery(){
  const order=savedOrders.find(x=>String(x.ID)===String(pendingSavedOrderId));
  if(!order)return alert("Pedido não encontrado. Feche esta tela e tente novamente.");
  const rua=qs("savedOrderRuaColeta").value.trim();
  const numero=qs("savedOrderNumeroColeta").value.trim();
  const referencia=qs("savedOrderReferenciaColeta").value.trim();
  const cidade=qs("savedOrderCidadeColeta").value.trim();
  if(!rua||!numero||!referencia||!cidade)return alert("Confirme rua, número, ponto de referência e cidade da coleta.");
  showLoader("Solicitando entregador...");
  const res=await api("createDeliveryFromSavedOrder",{
    pedidoCodigo:order.PedidoCodigo,
    ruaColeta:rua,
    numeroColeta:numero||"0",
    referenciaColeta:referencia,
    cidadeColeta:cidade,
    bairroColeta:order.BairroColeta||""
  });
  hideLoader();
  if(!res.ok){alert(res.error||"Não foi possível solicitar este pedido.");return}
  closeSavedOrderCompanyModal();
  await refreshAll();
  openDeliveriesDrawer();
}

async function refreshAll(){if(!companySession)return;const res=await api("getClientPanel",{codigo:companyCode(),expectedType:"empresa",limit:80,_t:Date.now()});if(res.ok&&res.type==="empresa"){companySession={ok:true,type:"empresa",profile:res.profile};companyDeliveries=res.deliveries||[];localStorage.setItem("pegaleva_company_light",JSON.stringify(companySession));renderCompanyHeader();renderDeliveries()}await loadSavedOrders()}
function startRefresh(){clearInterval(refreshTimer);refreshTimer=setInterval(refreshAll,12000)}
function statusClass(status){const s=String(status||"").toLowerCase();if(s.includes("finalizada")||s.includes("coletado")||s.includes("aceita"))return "green";if(s.includes("cancelada"))return "red";return "yellow"}
function renderDeliveries(){qs("deliveryCount").innerText=companyDeliveries.length;const box=qs("deliveriesBox");if(!companyDeliveries.length){box.innerHTML='<div class="delivery-card"><p class="muted">Nenhuma entrega encontrada.</p></div>';return}box.innerHTML=companyDeliveries.map(d=>`<article class="delivery-card"><div class="title"><strong>${esc(d.NomeDestino||d.ID||"Entrega")}</strong><span class="badge ${statusClass(d.Status)}">${esc(d.Status||"Aguardando")}</span></div><div class="route"><div class="route-point"><small>Coleta</small><b>${esc(d.EnderecoColeta||"")} — ${esc(d.BairroColeta||"")}</b></div><div class="route-point dest"><small>Destino</small><b>${esc(d.EnderecoDestino||"")} — ${esc(d.BairroDestino||"")}</b></div></div><p class="muted"><b>Pagamento:</b> ${esc(d.Pagamento||"---")} • <b>Status:</b> ${esc(d.StatusPagamento||"Pendente")}</p><p class="muted"><b>Entregador:</b> ${esc(d.NomeEntregador||"Aguardando entregador")}${d.PlacaMoto?" • "+esc(d.PlacaMoto):""}</p><p class="muted"><b>Atualizado:</b> ${esc(d.AtualizadoEm||d.CriadoEm||"---")}</p><span class="delivery-price">${money(d.Valor||0)}</span></article>`).join("")}
function openDeliveriesDrawer(){qs("drawerOverlay").classList.add("active");qs("deliveriesDrawer").classList.add("active");refreshAll()}
function closeDeliveriesDrawer(){qs("drawerOverlay").classList.remove("active");qs("deliveriesDrawer").classList.remove("active")}
function showResult(id,text,ok){qs(id).innerHTML=`<div class="result ${ok?"":"bad"}">${esc(text)}</div>`}

initializeSelects();
if(companySession&&companySession.type==="empresa")openApp();