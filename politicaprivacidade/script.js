document.addEventListener("DOMContentLoaded", function () {
  const anoAtual = document.getElementById("anoAtual");

  if (anoAtual) {
    anoAtual.textContent = new Date().getFullYear();
  }
});
