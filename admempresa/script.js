
const API_URL="https://script.google.com/macros/s/AKfycbydk3AEpDY4YBbNOQ_jyl8PoyJG3oXNl5kkeTr03GlsZGmxZKJD4sgHdwgnxhqhXgzf/exec";
const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const state={token:"",company:null,categories:[],products:[],logoData:"",productImageData:"",refreshTimer:null,busy:false};
async function api(action,payload={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(API_URL,{
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
      body:new URLSearchParams({action,payload:JSON.stringify({...payload,token:state.token})}),
      cache:"no-store",
      signal:controller.signal
    });
    if(!r.ok)throw new Error("Falha de conexão.");
    const j=await r.json();
    if(j.ok===false)throw new Error(j.error||"Erro.");
    return j;
  }catch(e){
    if(e.name==="AbortError")throw new Error("A conexão demorou demais.");
    throw e;
  }finally{clearTimeout(timeout)}
}
function showLoading(title,text){
  loadingTitle.textContent=title||"Carregando...";
  loadingText.textContent=text||"Aguarde um momento.";
  actionLoading.classList.add("on");
}
function hideLoading(){actionLoading.classList.remove("on")}
async function withLoading(title,text,task){
  showLoading(title,text);
  try{return await task()}finally{hideLoading()}
}
function toast(m){toastEl.textContent=m;toastEl.classList.add("on");setTimeout(()=>toastEl.classList.remove("on"),2400)}const toastEl=$("toast");
function imageUrl(url){
  url=String(url||"").trim();
  if(!url)return "";
  const match=url.match(/[?&]id=([^&]+)/)||url.match(/\/d\/([^/]+)/);
  if(match&&/drive\.google\.com/i.test(url)){
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w1200`;
  }
  return url;
}
function setImage(img,url){
  const finalUrl=imageUrl(url);
  if(!finalUrl){
    img.removeAttribute("src");
    img.style.display="none";
    return;
  }
  img.style.display="block";
  img.src=finalUrl;
  img.onerror=()=>{
    img.style.display="none";
    img.removeAttribute("src");
  };
}
function fileToData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
loginForm.onsubmit=async e=>{
  e.preventDefault();loginError.textContent="";
  try{
    const loginEmail=email.value.trim().toLowerCase();
    const j=await withLoading("Entrando no painel","Validando suas informações com segurança.",()=>api("login",{email:loginEmail,password:password.value}));
    state.token=j.token;
    const storage=rememberAccess.checked?localStorage:sessionStorage;
    storage.setItem("catalog_company_session",JSON.stringify({token:j.token,email:loginEmail}));
    if(rememberAccess.checked)localStorage.setItem("catalog_company_email",loginEmail);
    else localStorage.removeItem("catalog_company_email");
    loginView.classList.add("hide");appView.classList.remove("hide");
    await withLoading("Carregando catálogo","Buscando informações, categorias e produtos.",()=>loadDashboard());
    startPanelRefresh();
  }catch(x){loginError.textContent=x.message}
};
async function loadDashboard(silent=false){
  if(state.busy)return;
  state.busy=true;
  try{
    const j=await api("getCompanyDashboard");
    state.company=j.company;
    state.categories=j.categories||[];
    state.products=j.products||[];
    renderAll();
  }catch(e){
    if(!silent)throw e;
  }finally{state.busy=false}
}
function startPanelRefresh(){
  clearInterval(state.refreshTimer);
  state.refreshTimer=setInterval(()=>{
    if(!document.hidden&&navigator.onLine)loadDashboard(true);
  },5000);
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.token)loadDashboard(true)});
window.addEventListener("online",()=>{if(state.token)loadDashboard(true)});
function renderAll(){welcomeName.textContent=`Olá, ${state.company.name}!`;companyCode.textContent=state.company.id;companyName.value=state.company.name;companyWhatsapp.value=state.company.whatsapp;companyHours.value=state.company.hours;companyCity.value=state.company.city;companyNeighborhood.value=state.company.neighborhood;companySlug.value=state.company.slug;setImage(logoPreview,state.company.logo);productCategory.innerHTML='<option value="">Selecione</option>'+state.categories.filter(c=>c.active).map(c=>`<option value="${c.id}">${c.name}</option>`).join("");categoriesList.innerHTML=state.categories.map(c=>`<div class="category-row"><div><strong>${c.name}</strong><span class="status ${c.active?"":"off"}">${c.active?"Ativa":"Inativa"}</span></div><button class="btn secondary mini" onclick="toggleCategory('${c.id}',${!c.active})">${c.active?"Desativar":"Ativar"}</button></div>`).join("")||'<div>Nenhuma categoria.</div>';productsList.innerHTML=state.products.map(p=>`<div class="item"><img src="${imageUrl(p.image)}" alt="${p.name}" onerror="this.style.display='none';this.removeAttribute('src')"><div><strong>${p.name}</strong><span>${p.categoryName||"Sem categoria"} • ${money.format(p.price)}</span><span class="status ${p.active?"":"off"}">${p.active?"No ar":"Fora do ar"}</span></div><div class="item-actions"><button class="btn secondary mini" onclick="toggleProduct('${p.id}',${!p.active})">${p.active?"Tirar do ar":"Colocar no ar"}</button><button class="btn danger mini" onclick="deleteProduct('${p.id}')">Excluir</button></div></div>`).join("")||'<div>Nenhum produto.</div>'}
companyLogo.onchange=async()=>{
  if(companyLogo.files[0]){
    state.logoData=await fileToData(companyLogo.files[0]);
    setImage(logoPreview,state.logoData);
  }
};
productImage.onchange=async()=>{if(productImage.files[0])state.productImageData=await fileToData(productImage.files[0])};
companyForm.onsubmit=async e=>{e.preventDefault();try{await withLoading("Salvando informações","Atualizando os dados no catálogo.",()=>api("updateCompany",{name:companyName.value.trim(),whatsapp:companyWhatsapp.value.replace(/\D/g,""),hours:companyHours.value.trim(),city:companyCity.value,neighborhood:companyNeighborhood.value.trim(),logoData:state.logoData,logoName:companyLogo.files[0]?.name||"logo.jpg"}));toast("Informações atualizadas.");state.logoData="";await loadDashboard()}catch(x){toast(x.message)}};
categoryForm.onsubmit=async e=>{e.preventDefault();try{await withLoading("Criando categoria","Adicionando a nova categoria ao catálogo.",()=>api("createCategory",{name:categoryName.value.trim()}));categoryForm.reset();toast("Categoria criada.");await loadDashboard()}catch(x){toast(x.message)}};
productForm.onsubmit=async e=>{e.preventDefault();if(!state.productImageData)return toast("Selecione uma imagem.");try{await withLoading("Cadastrando produto","Enviando a imagem e atualizando o catálogo.",()=>api("createProduct",{name:productName.value.trim(),description:productDescription.value.trim(),price:Number(productPrice.value),categoryId:productCategory.value,imageData:state.productImageData,imageName:productImage.files[0]?.name||"produto.jpg"}));productForm.reset();state.productImageData="";toast("Produto cadastrado.");await loadDashboard()}catch(x){toast(x.message)}};
async function toggleCategory(id,active){try{await withLoading(active?"Ativando categoria":"Desativando categoria","Atualizando o catálogo.",()=>api("toggleCategory",{id,active}));await loadDashboard()}catch(x){toast(x.message)}}
async function toggleProduct(id,active){try{await withLoading(active?"Colocando produto no ar":"Tirando produto do ar","Atualizando o catálogo.",()=>api("toggleProduct",{id,active}));await loadDashboard()}catch(x){toast(x.message)}}
async function deleteProduct(id){if(!confirm("Excluir este produto?"))return;try{await withLoading("Excluindo produto","Removendo o produto e sua imagem.",()=>api("deleteProduct",{id}));await loadDashboard()}catch(x){toast(x.message)}}
document.querySelectorAll("[data-panel]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-panel]").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.panel).classList.add("active")});
logoutBtn.onclick=()=>{clearInterval(state.refreshTimer);sessionStorage.removeItem("catalog_company_session");localStorage.removeItem("catalog_company_session");state.token="";appView.classList.add("hide");loginView.classList.remove("hide")};
const rememberedEmail=localStorage.getItem("catalog_company_email")||"";
if(rememberedEmail){email.value=rememberedEmail;rememberAccess.checked=true}
const saved=JSON.parse(localStorage.getItem("catalog_company_session")||sessionStorage.getItem("catalog_company_session")||"null");
if(saved?.token){
  state.token=saved.token;
  loginView.classList.add("hide");appView.classList.remove("hide");
  withLoading("Carregando catálogo","Sincronizando suas informações.",()=>loadDashboard())
    .then(startPanelRefresh)
    .catch(()=>{sessionStorage.removeItem("catalog_company_session");localStorage.removeItem("catalog_company_session");location.reload()});
}
