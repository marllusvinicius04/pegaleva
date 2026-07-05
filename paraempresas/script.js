const WHATSAPP_NUMBER = "5588999999999"; // Troque pelo WhatsApp oficial do Pega & Leva

    let signupStep = 1;

    function openSignupModal(plano){
      signupStep = 1;
      document.getElementById('cadPlano').value = plano;
      document.getElementById('planoPreview').textContent = plano;
      document.getElementById('signupFormBox').style.display = 'block';
      document.getElementById('signupSuccess').classList.remove('active');
      document.getElementById('signupForm').reset();
      document.getElementById('cadPlano').value = plano;
      document.getElementById('planoPreview').textContent = plano;
      updateSignupStep();
      document.getElementById('signupModal').classList.add('active');
      document.getElementById('signupModal').setAttribute('aria-hidden','false');
    }

    function closeSignupModal(){
      document.getElementById('signupModal').classList.remove('active');
      document.getElementById('signupModal').setAttribute('aria-hidden','true');
    }

    function updateSignupStep(){
      [1,2,3].forEach(n=>{
        document.getElementById('formStep'+n).classList.toggle('active', n === signupStep);
        document.getElementById('stepDot'+n).classList.toggle('active', n <= signupStep);
      });
    }

    function validateCurrentStep(){
      const fields = document.querySelectorAll('#formStep'+signupStep+' input, #formStep'+signupStep+' select');
      for(const field of fields){
        if(!field.checkValidity()){
          field.reportValidity();
          return false;
        }
      }
      return true;
    }

    function showStepLoading(text){
      const loading = document.getElementById('stepLoading');
      loading.innerHTML = '<span class="mini-spinner"></span> ' + (text || 'Carregando próxima etapa...');
      loading.classList.add('active');
    }

    function hideStepLoading(){
      document.getElementById('stepLoading').classList.remove('active');
    }

    function nextSignupStep(){
      if(!validateCurrentStep()) return;
      showStepLoading('Carregando próxima etapa...');
      setTimeout(()=>{
        signupStep = Math.min(3, signupStep + 1);
        updateSignupStep();
        hideStepLoading();
      },700);
    }

    function prevSignupStep(){
      showStepLoading('Voltando etapa...');
      setTimeout(()=>{
        signupStep = Math.max(1, signupStep - 1);
        updateSignupStep();
        hideStepLoading();
      },450);
    }

    function onlyDigits(value){
      return String(value || '').replace(/\D/g,'');
    }

    function formatDateBR(){
      return new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    }

    function finishSignup(event){
      event.preventDefault();
      if(!validateCurrentStep()) return;

      const plano = document.getElementById('cadPlano').value.trim();
      const responsavel = document.getElementById('cadResponsavel').value.trim();
      const ddd = onlyDigits(document.getElementById('cadDDD').value.trim());
      const whatsapp = onlyDigits(document.getElementById('cadWhatsapp').value.trim());
      const email = document.getElementById('cadEmail').value.trim();
      const documento = document.getElementById('cadDocumento').value.trim();
      const rua = document.getElementById('cadRua').value.trim();
      const numero = document.getElementById('cadNumero').value.trim();
      const referencia = document.getElementById('cadReferencia').value.trim();
      const cidade = document.getElementById('cadCidade').value.trim();
      const codigo = document.getElementById('cadCodigo').value.trim();

      const btn = event.submitter;
      const originalText = btn ? btn.innerHTML : '';
      if(btn){
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando notinha...';
      }
      showStepLoading('Preparando notinha de cadastro...');

      setTimeout(()=>{
        const texto = `*NOVA SOLICITAÇÃO DE CADASTRO - PEGA & LEVA EMPRESAS*\n\n`+
        `*Plano escolhido:* ${plano}\n`+
        `*Data da solicitação:* ${formatDateBR()}\n\n`+
        `*DADOS DO RESPONSÁVEL*\n`+
        `Nome: ${responsavel}\n`+
        `WhatsApp: (${ddd}) ${whatsapp}\n`+
        `E-mail: ${email}\n`+
        `CPF/CNPJ: ${documento}\n\n`+
        `*ENDEREÇO COMERCIAL PARA ENTREGAS*\n`+
        `Rua: ${rua}\n`+
        `Número: ${numero}\n`+
        `Ponto de referência: ${referencia}\n`+
        `Cidade: ${cidade}\n\n`+
        `*ACESSO AO SISTEMA*\n`+
        `Código criado pela empresa: ${codigo}\n\n`+
        `Solicito o cadastro deste cliente empresarial no Pega & Leva.`;

        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`,'_blank');
        hideStepLoading();
        if(btn){
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
        document.getElementById('signupFormBox').style.display = 'none';
        document.getElementById('signupSuccess').classList.add('active');
        document.getElementById('signupForm').reset();
      },900);
    }

    document.getElementById('signupModal').addEventListener('click', function(event){
      if(event.target === this) closeSignupModal();
    });

    function toggleMenu(){
      document.getElementById('menu').classList.toggle('active');
    }

    document.querySelectorAll('#menu a').forEach(link=>{
      link.addEventListener('click',()=>document.getElementById('menu').classList.remove('active'));
    });

    const observer = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },{threshold:.12});

    document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
    
document.querySelectorAll('a[href^="#"]').forEach(anchor=>{
  anchor.addEventListener('click',function(e){
    const target=document.querySelector(this.getAttribute('href'));
    if(target){
      e.preventDefault();
      target.scrollIntoView({behavior:'smooth',block:'start'});
      document.getElementById('menu').classList.remove('active');
      history.replaceState(null,null,this.getAttribute('href'));
    }
  });
});


    document.getElementById('year').textContent = new Date().getFullYear();