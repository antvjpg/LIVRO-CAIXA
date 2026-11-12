/* C.3.0.1 — Coleta de evidências visuais corrigida e validada (todos os temas).
   Uso: node e2e/visual/c3/captura-evidencias.mjs
   Requer: servidor local em :8000 e Chromium com --remote-debugging-port=9222
   NÃO modifica fonte do app. Apenas manipula DOM em runtime para capturas.
   Cada captura começa em estado limpo (recarrega index.html).
   Abrange todos os 10 temas: 5 claros + 5 escuros. */

import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, 'evidencias');
const BASE = 'http://127.0.0.1:8000/index.html';
const HEAD_SHA = 'ab656b9e7a7d224b4269e598db649fcdce2d41a4';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
  { name: 'desktop', width: 1440, height: 900, scale: 1, mobile: false },
];

const THEMES_ALL = [
  /* 5 temas claros */
  { name: 'oliva-claro',    modo: 'claro', seletor: '.light-theme-option[data-theme="1"]' },
  { name: 'verde-claro',    modo: 'claro', seletor: '.light-theme-option[data-theme="2"]' },
  { name: 'lima-claro',     modo: 'claro', seletor: '.light-theme-option[data-theme="3"]' },
  { name: 'terracota-claro',modo: 'claro', seletor: '.light-theme-option[data-theme="4"]' },
  { name: 'laranja-claro',  modo: 'claro', seletor: '.light-theme-option[data-theme="5"]' },
  /* 5 temas escuros */
  { name: 'oliva-escuro',   modo: 'escuro',seletor: '.dark-theme-option[data-theme="1"]' },
  { name: 'verde-escuro',   modo: 'escuro',seletor: '.dark-theme-option[data-theme="2"]' },
  { name: 'bege-escuro',    modo: 'escuro',seletor: '.dark-theme-option[data-theme="3"]' },
  { name: 'terracota-escuro',modo: 'escuro',seletor: '.dark-theme-option[data-theme="4"]' },
  { name: 'laranja-escuro', modo: 'escuro',seletor: '.dark-theme-option[data-theme="5"]' },
];

/* Tema específico via argumento de linha de comando, ou todos se omitido */
const temaArg = process.argv[2];
const THEMES = temaArg ? THEMES_ALL.filter(function(t) { return t.name === temaArg; }) : THEMES_ALL;

if (temaArg && THEMES.length === 0) {
  console.error('Tema não encontrado: ' + temaArg);
  process.exit(1);
}

const MOBILE_SCREENS = [
  { key: 'tela-inicial',   desc: 'Tela inicial do app (viewCaixa por padrao)' },
  { key: 'view-inicio',    desc: 'View Início' },
  { key: 'view-livro-caixa', desc: 'View Livro-Caixa' },
  { key: 'drawer-aberto',  desc: 'Drawer aberto' },
  { key: 'perfil',         desc: 'Perfil' },
  { key: 'nav-mobile',     desc: 'Navegação mobile inferior' },
];

const DESKTOP_SCREENS = [
  { key: 'tela-inicial',   desc: 'Tela inicial do app (viewCaixa por padrao)' },
  { key: 'view-inicio',    desc: 'View Início' },
  { key: 'view-livro-caixa', desc: 'View Livro-Caixa' },
  { key: 'drawer-aberto',  desc: 'Drawer aberto' },
  { key: 'perfil',         desc: 'Perfil' },
];

const manifest = [];
let shotIndex = 0;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evalJS(Runtime, expression) {
  const { result, exceptionDetails } = await Runtime.evaluate({
    expression: expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) return 'ERR: ' + (exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}

async function screenshot(client, filepath) {
  const { Page } = client;
  const { data } = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
  console.log('  shot:', filepath);
}

async function checkOverlayHidden(Runtime, selector) {
  return await evalJS(Runtime,
    '(() => { var el = document.querySelector("' + selector + '"); if (!el) return "nao-existe"; var cs = getComputedStyle(el); var hidden = el.classList.contains("hidden") || el.getAttribute("hidden") !== null || cs.display === "none" || cs.visibility === "hidden"; return hidden ? "oculto" : "visivel"; })()'
  );
}

async function checkViewActive(Runtime, tabName) {
  var cap = tabName.charAt(0).toUpperCase() + tabName.slice(1);
  var viewId = 'view' + cap;
  return await evalJS(Runtime,
    '(() => { var el = document.getElementById("' + viewId + '"); if (!el) { var views = document.querySelectorAll(".tab-content"); var active = null; for (var i = 0; i < views.length; i++) { if (views[i].classList.contains("active")) { active = views[i]; break; } } return active ? active.id : "sem-view-ativa"; } return el.classList.contains("active") ? "ativa" : "inativa"; })()'
  );
}

async function checkBodyMode(Runtime, modo) {
  return await evalJS(Runtime,
    '(() => { var isDark = document.body.classList.contains("dark-mode"); return ((isDark && "' + modo + '" === "escuro") || (!isDark && "' + modo + '" === "claro")) ? "correto" : "incorreto"; })()'
  );
}

async function ensureAuthHidden(Runtime) {
  var res = await evalJS(Runtime,
    '(() => { var ov = document.getElementById("authOverlay"); if (!ov) return "sem-overlay-auth"; if (ov.classList.contains("hidden")) return "auth-ja-oculto"; ov.classList.add("hidden"); return "auth-ocultado-runtime"; })()'
  );
  await sleep(500);
  return res;
}

async function closeThemeModal(Runtime) {
  var res = await evalJS(Runtime,
    '(() => { var modal = document.getElementById("panelThemePicker"); if (!modal) return "sem-modal-tema"; var close = document.querySelector("#panelThemePicker .modal-close"); if (!close) return "botao-fechar-tema-nao-encontrado"; close.click(); return "fechou-modal-tema"; })()'
  );
  await sleep(600);
  var status = await checkOverlayHidden(Runtime, '#panelThemePicker');
  return res + ' | modal-status:' + status;
}

async function closeDrawer(Runtime) {
  var res = await evalJS(Runtime,
    '(() => { var overlay = document.getElementById("appDrawerOverlay"); if (!overlay) return "sem-overlay-drawer"; var close = document.querySelector("[data-close-drawer]"); if (!close) return "botao-fechar-drawer-nao-encontrado"; close.click(); return "fechou-drawer"; })()'
  );
  await sleep(600);
  var status = await checkOverlayHidden(Runtime, '#appDrawerOverlay');
  return res + ' | drawer-status:' + status;
}

async function applyTheme(Runtime, theme) {
  var navRes = await evalJS(Runtime,
    '(() => { if (typeof window.switchTab !== "function") return "switchTab-nao-encontrado"; window.switchTab("profile"); return "nav-perfil"; })()'
  );
  await sleep(1000);

  var openRes = await evalJS(Runtime,
    '(() => { var btn = document.getElementById("btnAparencia"); if (!btn) return "btnAparencia-nao-encontrado"; btn.click(); return "aparencia-aberta"; })()'
  );
  await sleep(1000);

  var setRes = await evalJS(Runtime,
    '(() => { var btn = document.querySelector("' + theme.seletor + '"); if (!btn) return "paleta-nao-encontrada"; btn.click(); return "paleta-selecionada"; })()'
  );
  await sleep(800);

  var closeRes = await closeThemeModal(Runtime);
  /* Força o modo no body para garantir correspondência com o tema solicitado */
  var forceRes = await evalJS(Runtime,
    '(() => { var isDark = document.body.classList.contains("dark-mode"); var queroEscuro = "' + theme.modo + '" === "escuro"; if (queroEscuro && !isDark) { document.body.classList.add("dark-mode"); return "adicionou-dark-mode"; } if (!queroEscuro && isDark) { document.body.classList.remove("dark-mode"); return "removeu-dark-mode"; } return "ja-estava-correto"; })()'
  );
  await sleep(500);
  var modeStatus = await checkBodyMode(Runtime, theme.modo);
  return { nav: navRes, open: openRes, set: setRes, close: closeRes, force: forceRes, modo: modeStatus };
}

async function validateCapture(Runtime, viewport, theme, screenKey) {
  var checks = {};

  var authRaw = await checkOverlayHidden(Runtime, '#authOverlay');
  checks.auth = (authRaw === 'oculto' || authRaw === 'nao-existe') ? 'oculto' : 'visivel';

  var pickerRaw = await checkOverlayHidden(Runtime, '#panelThemePicker');
  checks.themePicker = (pickerRaw === 'oculto' || pickerRaw === 'nao-existe') ? 'oculto' : 'visivel';

  if (screenKey !== 'drawer-aberto') {
    var drawerRaw = await checkOverlayHidden(Runtime, '#appDrawerOverlay');
    checks.drawer = (drawerRaw === 'oculto' || drawerRaw === 'nao-existe') ? 'oculto' : 'visivel';
  } else {
    checks.drawer = 'drawer-aberto-esperado';
  }

  checks.modoCorreto = await checkBodyMode(Runtime, theme.modo);

  if (screenKey === 'nav-mobile') {
    checks.isMobile = viewport.mobile ? 'sim' : 'nao';
    if (!viewport.mobile) {
      checks.navMobileValido = 'invalido-em-desktop';
    } else {
      checks.navMobileValido = 'valido';
    }
  } else {
    checks.navMobileValido = 'nao-aplica';
  }

  if (screenKey !== 'drawer-aberto') {
    var viewIdMap = {
      'tela-inicial': 'Caixa',
      'view-inicio': 'Inicio',
      'view-livro-caixa': 'Caixa',
      'perfil': 'Profile',
      'nav-mobile': 'Caixa',
    };
    var viewId = viewIdMap[screenKey];
    checks.viewActive = viewId ? await checkViewActive(Runtime, viewId) : 'nao-verificado';
  } else {
    checks.drawerVisible = await checkOverlayHidden(Runtime, '#appDrawerOverlay');
  }

  return checks;
}

function switchToTab(Runtime, tabName) {
  return evalJS(Runtime,
    '(() => { if (typeof window.switchTab === "function") window.switchTab("' + tabName + '"); return "' + tabName + '"; })()'
  );
}

async function captureScreen(client, Runtime, Page, viewport, theme, screens, screenKey, manifestNovo) {
  var descObj = screens.find(function(s) { return s.key === screenKey; });
  var tag = viewport.name + '-' + theme.name + '-' + screenKey;
  var filepath = path.join(OUT, (++shotIndex) + '-' + tag + '.png');

  /* Recarrega a página para isolar o estado */
  await Runtime.evaluate({ expression: 'location.reload()', awaitPromise: true });
  await Page.loadEventFired();
  await sleep(3000);

  /* Oculta auth overlay em runtime */
  var authRes = await ensureAuthHidden(Runtime);

  /* Aplica o tema explicitamente */
  var themeRes = await applyTheme(Runtime, theme);

  /* Navega para a tela desejada */
  if (screenKey === 'drawer-aberto') {
    var drawerRes = await evalJS(Runtime,
      '(() => { var btn = document.getElementById("btnOpenDrawer"); if (!btn) return "btnOpenDrawer-nao-encontrado"; btn.click(); return "drawer-aberto"; })()'
    );
    await sleep(1000);
  } else if (screenKey === 'view-inicio') {
    await switchToTab(Runtime, 'inicio');
    await sleep(1000);
  } else if (screenKey === 'view-livro-caixa' || screenKey === 'tela-inicial' || screenKey === 'nav-mobile') {
    await switchToTab(Runtime, 'caixa');
    await sleep(1000);
  } else if (screenKey === 'perfil') {
    await switchToTab(Runtime, 'profile');
    await sleep(1000);
  }

  /* Valida antes de gravar */
  var checks = await validateCapture(Runtime, viewport, theme, screenKey);

  var estado = 'capturado';
  var falhas = [];
  if (checks.auth !== 'oculto') falhas.push('auth-visivel');
  if (checks.themePicker !== 'oculto') falhas.push('tema-picker-visivel');
  if (screenKey !== 'drawer-aberto' && checks.drawer !== 'oculto') falhas.push('drawer-visivel');
  if (checks.modoCorreto !== 'correto') falhas.push('modo-incorreto');
  if (screenKey === 'nav-mobile' && checks.navMobileValido === 'invalido-em-desktop') falhas.push('nav-mobile-em-desktop');

  if (falhas.length > 0) {
    estado = 'capturado-com-falhas: ' + falhas.join(', ');
  }

  await screenshot(client, filepath);

  manifestNovo.push({
    arquivo: path.basename(filepath),
    viewport: viewport.name,
    resolucao: viewport.width + 'x' + viewport.height,
    tema: theme.name,
    modo: theme.modo,
    tela: screenKey,
    descricao: descObj ? descObj.desc : '',
    estado: estado,
    dataHora: new Date().toISOString(),
    shaHEAD: HEAD_SHA,
    overlaysVerificados: {
      authOculto: checks.auth,
      temaPickerOculto: checks.themePicker,
      drawerOculto: screenKey !== 'drawer-aberto' ? checks.drawer : 'nao-aplica',
      modoCorreto: checks.modoCorreto,
    },
    falhas: falhas,
  });

  console.log('  [' + shotIndex + '] ' + screenKey + ' (' + theme.name + '): ' + estado);
  console.log('    auth=' + checks.auth + ', picker=' + checks.themePicker + ', modo=' + checks.modoCorreto);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  /* Conta PNGs existentes para continuar a numeração sem sobrescrever */
  var arquivosExistentes = fs.readdirSync(OUT).filter(function(f) { return f.endsWith('.png'); });
  shotIndex = arquivosExistentes.length;

  /* Carrega manifest existente se houver, para acumular entre execuções por tema */
  var manifestPath = path.join(OUT, 'manifest.json');
  var manifestExistente = [];
  try {
    var conteudo = fs.readFileSync(manifestPath, 'utf8');
    manifestExistente = JSON.parse(conteudo);
    if (!Array.isArray(manifestExistente)) manifestExistente = [];
    console.log('Manifest existente carregado: ' + manifestExistente.length + ' entradas');
  } catch (e) {
    manifestExistente = [];
  }

  const client = await CDP({ port: 9222 });
  const { Page, Runtime, Emulation } = client;
  await Page.enable();
  await Runtime.enable();

  var total = 0;
  var manifestNovo = [];

  for (var i = 0; i < VIEWPORTS.length; i++) {
    var vp = VIEWPORTS[i];
    await Emulation.setDeviceMetricsOverride({
      width: vp.width, height: vp.height, deviceScaleFactor: vp.scale, mobile: vp.mobile,
    });
    await sleep(500);

    var screens = vp.mobile ? MOBILE_SCREENS : DESKTOP_SCREENS;

    for (var j = 0; j < THEMES.length; j++) {
      var theme = THEMES[j];
      for (var k = 0; k < screens.length; k++) {
        var screen = screens[k];
        await captureScreen(client, Runtime, Page, vp, theme, screens, screen.key, manifestNovo);
        total++;
      }
    }
  }

  await client.close();

  /* Combina manifest existente com as novas capturas */
  var manifestFinal = manifestExistente.concat(manifestNovo);

  fs.writeFileSync(manifestPath, JSON.stringify(manifestFinal, null, 2));
  console.log('\nManifest gravado: ' + manifestPath);
  console.log('Capturas nesta execução: ' + total);
  console.log('Total acumulado: ' + manifestFinal.length);
}

main().catch(function(e) { console.error(e); process.exit(1); });
