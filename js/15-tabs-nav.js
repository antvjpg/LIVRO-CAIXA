/* LIVRO-CAIXA · js/15-tabs-nav.js — abas e navegação (app.js: 1013-1049). Separação por responsabilidade; conteúdo preservado. */


  // Alternância de Abas
  let LAST_TAB_STORAGE_KEY;

  let TAB_NAMES;

  let currentTab;

  let lastTabRestored;


  function persistLastTab(tab) {
    try {
      if (tab && TAB_NAMES.includes(tab)) sessionStorage.setItem(LAST_TAB_STORAGE_KEY, tab);
    } catch (e) {}
  }


