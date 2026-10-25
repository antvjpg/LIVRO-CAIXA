/* LIVRO-CAIXA · js/32-auth-wiring.js — fiação de autenticação final (app.js: 15213-15394). Separação por responsabilidade; conteúdo preservado. */


  function renderUserBar() {
    const bar = document.getElementById('userBar');
    if (!currentUser) { bar.innerHTML = ''; renderProfile(); return; }
    bar.innerHTML = `<span class="sync-dot" id="syncDot"></span> ${escapeHTML(currentUser.email)} <button type="button" id="btnLogout">Sair</button>`;
    document.getElementById('btnLogout').onclick = () => auth.signOut();
    renderProfile();
  }

  function renderProfile() {
    const email = currentUser?.email || 'Sua conta e preferências';
    const target = document.getElementById('profileEmail');
    if (target) target.textContent = email;
    const hour = new Date().getHours();
    const greeting = hour >= 6 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
    const greetEl = document.getElementById('headerGreeting');
    if (greetEl) greetEl.textContent = greeting;
    const greetNameEl = document.getElementById('headerGreetingName');
    if (greetNameEl) greetNameEl.textContent = (currentUser?.displayName || currentUser?.email || '').trim() || '—';
    const remindersChk = document.getElementById('featureReminders');
    if (remindersChk) remindersChk.checked = featureSettings.reminders;
    const remindersAdvance = document.getElementById('featureReminderAdvanceDays');
    if (remindersAdvance) remindersAdvance.value = featureSettings.reminderAdvanceDays;
    const cycleInput = document.getElementById('inputFinancialCycleDay');
    if (cycleInput) cycleInput.value = getFinancialCycleStartDay();
    renderFeatureProfile();
  }

  function setAuthError(msg) {
    const el = document.getElementById('authError');

    if (el) {
      el.textContent = msg || '';
    }

    if (msg) {
      window.loginDebugLog?.(
        'AUTH',
        'Mensagem exibida na tela',
        msg
      );
    }
  }

  function translateAuthError(code) {
    const map = {
      'auth/invalid-email': 'E-mail inválido.',
      'auth/user-not-found': 'Conta não encontrada. Crie uma conta.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
      'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase.',
      'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Tentando redirecionar...',
      'auth/popup-closed-by-user': 'A janela do Google foi fechada.',
      'auth/web-storage-unsupported': 'O navegador bloqueou o armazenamento necessário para o login Google.',
      'auth/operation-not-supported-in-this-environment': 'Este ambiente não permite o login Google por janela.',
      'auth/internal-error': 'O Firebase encontrou um erro interno ao iniciar o login Google.'
    };
    return map[code] || 'Não foi possível concluir. Tente novamente.';
  }

  function updateFabAriaLabel(tab) {
    const fab = document.getElementById('fabAdd');
    if (!fab) return;
    const labels = {
      dashboard: 'Conversar com IA financeira',
      bills: 'Adicionar conta recorrente',
      receivables: 'Adicionar valor a receber',
      invest: 'Adicionar investimento',
      pockets: 'Adicionar caixinha',
      cards: 'Adicionar cartão',
      goals: 'Adicionar meta',
      caixa: 'Adicionar lançamento',
      contas: 'Adicionar lançamento'
    };
    fab.setAttribute('aria-label', labels[tab] || 'Adicionar');
  }
