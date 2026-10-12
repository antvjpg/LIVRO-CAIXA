/* LIVRO-CAIXA · js/14-theme.js — tema, cores e PWA (app.js: 848-976). Separação por responsabilidade; conteúdo preservado. */


  // Tema Escuro / Claro
  let themeBtn;

  let themeColorMeta;

  let lightThemeOptions;

  let LIGHT_THEME_STORAGE_KEY;

  let LIGHT_THEME_COLORS;

  let darkThemeOptions;

  let DARK_THEME_STORAGE_KEY;

  let DARK_THEME_COLORS;


  let THEME_IDS_MIGRATED_KEY;

  function migrateThemeIdsOnce() {
    try {
      const stage = localStorage.getItem(THEME_IDS_MIGRATED_KEY);
      if (stage === '3') return;
      if (!stage) {
        // Estágio 1 (pré-numeração contígua) → 2
        const light0 = localStorage.getItem(LIGHT_THEME_STORAGE_KEY);
        const lightMapV2 = { '2': '1', '3': '1', '4': '2', '5': '3', '6': '4', '7': '5', '8': '6' };
        if (light0 !== null && lightMapV2[light0]) localStorage.setItem(LIGHT_THEME_STORAGE_KEY, lightMapV2[light0]);
        const dark0 = localStorage.getItem(DARK_THEME_STORAGE_KEY);
        const darkMapV2 = { '2': '1', '3': '2', '4': '3', '5': '4', '6': '1', '7': '1' };
        if (dark0 !== null && darkMapV2[dark0]) localStorage.setItem(DARK_THEME_STORAGE_KEY, darkMapV2[dark0]);
        localStorage.setItem(THEME_IDS_MIGRATED_KEY, '2');
      }
      // Estágio 2 → 3: claro Oliva/Verde/Lima/Terracota/Laranja (Azul removido);
      // escuro Oliva/Verde/Bege/Terracota/Laranja. Ids que sumiram caem no padrão '1'.
      const light = localStorage.getItem(LIGHT_THEME_STORAGE_KEY);
      const lightMapV3 = { '1': '2', '2': '4', '3': '5', '4': '1', '5': '3', '6': '1' };
      if (light !== null && lightMapV3[light]) localStorage.setItem(LIGHT_THEME_STORAGE_KEY, lightMapV3[light]);
      const dark = localStorage.getItem(DARK_THEME_STORAGE_KEY);
      const darkMapV3 = { '1': '3', '2': '4', '3': '2', '4': '5', '5': '1' };
      if (dark !== null && darkMapV3[dark]) localStorage.setItem(DARK_THEME_STORAGE_KEY, darkMapV3[dark]);
      localStorage.setItem(THEME_IDS_MIGRATED_KEY, '3');
    } catch (e) {}
  }

  function validLightTheme(value) {
    return Object.prototype.hasOwnProperty.call(LIGHT_THEME_COLORS, value) ? value : '1';
  }

  function getSavedLightTheme() {
    migrateThemeIdsOnce();
    return validLightTheme(localStorage.getItem(LIGHT_THEME_STORAGE_KEY));
  }

  function updateLightThemePicker(themeId) {
    lightThemeOptions.forEach(option => {
      const selected = option.dataset.theme === themeId;
      option.setAttribute('aria-pressed', String(selected));
    });
  }

  function applyLightTheme(themeId, persist = true) {
    const selectedTheme = validLightTheme(themeId);
    document.body.dataset.lightTheme = selectedTheme;
    updateLightThemePicker(selectedTheme);
    if (persist) localStorage.setItem(LIGHT_THEME_STORAGE_KEY, selectedTheme);
    if (themeColorMeta) themeColorMeta.setAttribute('content', LIGHT_THEME_COLORS[selectedTheme]);
  }

  function validDarkTheme(value) {
    return Object.prototype.hasOwnProperty.call(DARK_THEME_COLORS, value) ? value : '1';
  }

  function getSavedDarkTheme() {
    migrateThemeIdsOnce();
    return validDarkTheme(localStorage.getItem(DARK_THEME_STORAGE_KEY));
  }

  function updateDarkThemePicker(themeId) {
    darkThemeOptions.forEach(option => {
      const selected = option.dataset.theme === themeId;
      option.setAttribute('aria-pressed', String(selected));
    });
  }

  function applyDarkTheme(themeId, persist = true) {
    const selectedTheme = validDarkTheme(themeId);
    document.body.dataset.darkTheme = selectedTheme;
    updateDarkThemePicker(selectedTheme);
    if (persist) localStorage.setItem(DARK_THEME_STORAGE_KEY, selectedTheme);
    if (themeColorMeta) themeColorMeta.setAttribute('content', DARK_THEME_COLORS[selectedTheme]);
  }

  function setThemeToggleIcon(isDark) {
    if (!themeBtn) return;
    themeBtn.innerHTML = `<i class="fi fi-sr-contrast" aria-hidden="true"></i>`;
  }
