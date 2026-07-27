const menu=document.getElementById("menu");
    document.getElementById("mobileToggle").addEventListener("click",()=>menu.classList.toggle("open"));
    document.querySelectorAll("#menu a").forEach(a=>a.addEventListener("click",()=>menu.classList.remove("open")));
    document.getElementById("year").textContent=new Date().getFullYear();
