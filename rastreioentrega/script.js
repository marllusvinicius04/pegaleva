
const API_URL="https://script.google.com/macros/s/AKfycbyqeugeCr2xhK96ucylAez0-zpS1zJ1vzEb3qRVuA4rNEiGa6iTcwVTrkTF3Qr6RrGQ/exec";
const BAIRROS_URUCUÍ=["Fogoso","Malvinas","Vaquejada","Centro","Aeroporto","Novo Horizonte","Areia","Esperança","Água Branca","Alto Bonito","São Francisco","Babilônia","Canaã","Portal dos Cerrados","Cerrados Park","Vista Bela"];
const BAIRROS_BENEDITO=["Centro","Benedito Leite"];
let pedidoAtual=null,freteEscolhido="normal",precos={valorNormal:0,valorPromocional:0};
function onlyDigits(v){return String(v||"").replace(/\D/g,"")}
function money(v){return "R$ "+Number(v||0).toFixed(2).replace(".",",")}
async function api(action,data={}){try{const r=await fetch(API_URL,{method:"POST",cache:"no-store",body:JSON.stringify({action,...data})});return await r.json()}catch(err){return {ok:false,error:"Falha de conexão com o servidor."}}}
function showLoader(t){document.getElementById("loaderText").innerText=t||"Carregando...";document.getElementById("loader").classList.add("active")}
function hideLoader(){document.getElementById("loader").classList.remove("active")}
function goStep(id){document.querySelectorAll(".step").forEach(s=>s.classList.remove("active"));document.getElementById(id).classList.add("active")}
function required(ids){for(const id of ids){const el=document.getElementById(id);if(!el.value.trim()){el.focus();alert("Preencha todos os campos.");return false}}return true}
function updateBairros(){const cidade=document.getElementById("cidade").value;const bairro=document.getElementById("bairro");const list=cidade==="Benedito Leite"?BAIRROS_BENEDITO:BAIRROS_URUCUÍ;bairro.innerHTML='<option value="">Selecione</option>'+list.map(b=>`<option>${b}</option>`).join("")}
async function checkPedido(){
  if(!required(["pedidoCodigo"]))return;
  const codigo=document.getElementById("pedidoCodigo").value.toUpperCase();
  if(codigo.length!==4)return alert("Digite um código com 4 caracteres.");
  showLoader("Localizando pedido...");
  const res=await api("checkSavedOrder",{pedidoCodigo:codigo});
  hideLoader();
  if(!res.ok)return alert(res.error||"Pedido não encontrado.");
  pedidoAtual=res;
  if(res.solicitado){
    const entrega=res.entrega||{};
    document.getElementById("trackBox").innerHTML=`
      <p style="text-align:left;margin-bottom:8px"><b>Pedido:</b> ${res.nomePedido||"Pedido"} • <b>Código:</b> ${res.pedidoCodigo||codigo}</p>
      <p style="text-align:left;margin-bottom:8px"><b>Status:</b> ${res.statusPedido||entrega.Status||"Solicitado"}</p>
      ${entrega.NomeEntregador?`<p style="text-align:left;margin-bottom:8px"><b>Entregador:</b> ${entrega.NomeEntregador} • ${entrega.PlacaMoto||""}</p>`:""}
      ${entrega.Valor?`<p style="text-align:left;margin-bottom:0"><b>Valor:</b> ${money(entrega.Valor)}</p>`:""}
    `;
    goStep("stepAcompanhar");
    return;
  }
  document.getElementById("pedidoTitulo").innerText=res.nomePedido||"Cadastro para entrega";
  document.getElementById("empresaInfo").innerHTML="Pedido <b>"+(res.pedidoCodigo||codigo)+"</b> localizado para a empresa <b>"+((res.empresa&&res.empresa.Responsavel)||"")+"</b>.";
  goStep("stepEndereco");
}
function nextEndereco(){if(!required(["rua","numero","referencia","cidade","bairro"]))return;goStep("stepRecebedor")}
async function loadFrete(){
  if(!required(["nomeDestino","whatsappDestino"]))return;
  showLoader("Calculando frete...");
  const res=await api("checkSavedOrder",{pedidoCodigo:document.getElementById("pedidoCodigo").value,bairro:document.getElementById("bairro").value,cidade:document.getElementById("cidade").value});
  hideLoader();
  if(!res.ok)return alert(res.error||"Erro ao calcular frete.");
  precos={valorNormal:res.valorNormal||0,valorPromocional:res.valorPromocional||0};
  document.getElementById("valorNormal").innerText=money(precos.valorNormal);
  document.getElementById("valorPromo").innerText=money(precos.valorPromocional);
  selectFrete("normal");
  goStep("stepFrete");
}
function selectFrete(tipo){freteEscolhido=tipo;document.getElementById("offerNormal").classList.toggle("active",tipo==="normal");document.getElementById("offerPromo").classList.toggle("active",tipo==="promocional")}
async function submitSaved(){
  showLoader("Salvando pedido...");
  const res=await api("saveClientData",{pedidoCodigo:document.getElementById("pedidoCodigo").value,rua:document.getElementById("rua").value,numero:document.getElementById("numero").value||"0",referencia:document.getElementById("referencia").value,cidade:document.getElementById("cidade").value,bairro:document.getElementById("bairro").value,nomeDestino:document.getElementById("nomeDestino").value,whatsappDestino:onlyDigits(document.getElementById("whatsappDestino").value),freteEscolhido});
  hideLoader();
  if(!res.ok)return alert(res.error||"Erro ao salvar.");
  document.getElementById("formBox").style.display="none";
  document.getElementById("successBox").classList.add("active");
}
updateBairros();
(function(){
  const params=new URLSearchParams(window.location.search);
  const codigo=(params.get("codigoPedido")||params.get("codigo")||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4);
  if(codigo){document.getElementById("pedidoCodigo").value=codigo;setTimeout(checkPedido,250)}
})();
