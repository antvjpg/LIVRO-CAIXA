// [PATCH] Contas/Faturas — menus contextuais
function closeBillMenus(){
  document.querySelectorAll('.bill-more-menu').forEach(menu => {
    menu.hidden = true;
  });
  document.querySelectorAll('.bill-more-button').forEach(button => {
    button.setAttribute('aria-expanded','false');
  });
}

function toggleBillMenu(id){
  const menu = document.getElementById(`bill-more-${id}`);
  if(!menu) return;

  const wasHidden = menu.hidden;
  closeBillMenus();

  if(wasHidden){
    menu.hidden = false;
    const button = menu.parentElement?.querySelector('.bill-more-button');
    if(button) button.setAttribute('aria-expanded','true');
  }
}

document.addEventListener('click', (event) => {
  if(!event.target.closest('.bill-more-wrap')){
    closeBillMenus();
  }
});
// [PATCH] Metas — isolamento de aba / switchTab
/* Metas como aba própria — resolve switchTabOriginal em tempo de chamada (nunca captura undefined) */
(function () {
  function runOriginalSwitchTab(tab, ctx, args) {
    var original = window.switchTabOriginal;
    if (typeof original !== 'function') {
      console.error('[Metas] switchTabOriginal indisponível');
      try {
        if (typeof logError === 'function') {
          logError('Sistema', 'erro de interface', 'Falha', 'switchTabOriginal indefinido ao navegar para ' + tab);
        }
      } catch (e) {}
      return;
    }
    return original.apply(ctx, args);
  }

  window.switchTab = function(tab) {
    if (tab === 'goals') {
      document.body.dataset.tab = 'goals';

      document.querySelectorAll('.tab-content').forEach(function(view) {
        view.classList.remove('active');
      });

      document.querySelectorAll('.nav-tab').forEach(function(button) {
        button.classList.remove('active');
      });

      var goalsView = document.getElementById('viewGoals');
      var goalsButton = document.getElementById('tabBtnGoals');

      var goalsOverlay = document.getElementById('modalOverlay');
      if (goalsOverlay) goalsOverlay.classList.remove('open');

      document.querySelectorAll('.panel.open').forEach(function(panel) {
        panel.classList.remove('open');
      });

      if (goalsView) goalsView.classList.add('active');
      if (goalsButton) goalsButton.classList.add('active');

      if (typeof currentTab !== 'undefined') currentTab = 'goals';
      if (typeof persistLastTab === 'function') persistLastTab('goals');

      document.querySelectorAll('.mobile-bottom-nav button').forEach(function(button) {
        button.classList.remove('is-active');
      });
      var goalsNav = document.querySelector('.mobile-bottom-nav');
      if (goalsNav) goalsNav.removeAttribute('data-active');

      if (typeof renderGoalsList === 'function') {
        try { renderGoalsList(); } catch (e) { console.warn(e); }
      }
      if (typeof initMoneyMasks === 'function') {
        try { initMoneyMasks(); } catch (e) {}
      }

      return;
    }

    // Saindo de Metas
    var goalsView = document.getElementById('viewGoals');
    var goalsButton = document.getElementById('tabBtnGoals');
    if (goalsView) goalsView.classList.remove('active');
    if (goalsButton) goalsButton.classList.remove('active');

    var result = runOriginalSwitchTab(tab, this, arguments);

    // Reforço da pílula BNI
    var nav = document.querySelector('.mobile-bottom-nav');
    document.querySelectorAll('.mobile-bottom-nav button').forEach(function(button) {
      button.classList.toggle('is-active', button.dataset.destination === tab);
    });
    if (nav) nav.dataset.active = tab || 'caixa';

    // Garantir que o body não fique preso em goals
    if (document.body.dataset.tab === 'goals') {
      document.body.dataset.tab = tab || 'caixa';
    }

    return result;
  };

  document.addEventListener('click', function(event) {
    var item = event.target.closest('[data-drawer-action="goals"]');
    if (!item) return;
    event.preventDefault();
    window.switchTab('goals');
    var drawer = document.getElementById('appDrawerOverlay');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }
  });
})();
