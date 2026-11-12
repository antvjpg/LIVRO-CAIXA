/* C.3.0.1 — Coleta de evidências visuais corrigida e validada (todos os temas).
   Uso: node e2e/visual/c3/captura-evidencias.mjs [tema]
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
/* Commit que publicou as 110 evidências (imagens + manifesto + script). */
const SHA_PUBLICACAO = '';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
  { name: 'desktop', width: 1440, height: 900, scale: 1, mobile: false },
];

const THEMES_ALL = [
  /* 5 temas claros — accent/paper = valores computados comprovados por verificar-paletas.mjs */
  { name: 'oliva-claro',    modo: 'claro', temaId: '1', accent: '#5f7a43', paper: '#f7f5ef' },
  { name: 'verde-claro',    modo: 'claro', temaId: '2', accent: '#327957', paper: '#f8f7f2' },
  { name: 'lima-claro',     modo: 'claro', temaId: '3', accent: '#40916c', paper: '#faf9f6' },
  { name: 'terracota-claro',modo: 'claro', temaId: '4', accent: '#c66f50', paper: '#fbf6ef' },
  { name: 'laranja-claro',  modo: 'claro', temaId: '5', accent: '#e85002', paper: '#f9f9f9' },
  /* 5 temas escuros */
  { name: 'oliva-escuro',   modo: 'escuro',temaId: '1', accent: '#9dd08b', paper: '#1a1917' },
  { name: 'verde-escuro',   modo: 'escuro',temaId: '2', accent: '#22c55e', paper: '#121212' },
  { name: 'bege-escuro',    modo: 'escuro',temaId: '3', accent: '#c9a86a', paper: '#0f1712' },
  { name: 'terracota-escuro',modo: 'escuro',temaId: '4', accent: '#d08860', paper: '#141410' },
  { name: 'laranja-escuro', modo: 'escuro',temaId: '5', accent: '#e85002', paper: '#000000' },
];

const temaArg = process.argv[2];
const THEMES = temaArg ? THEMES_ALL.filter(function(t) { return t.name === temaArg; }) : THEMES_ALL;

if (temaArg && THEMES.length === 0) {
  console.error('Tema não encontrado: ' + temaArg);
  process.exit(1);
}

/* Cada registro representa um estado visual distinto.
   `tela-inicial` é a captura canônica de `viewCaixa` (ativa por padrão); não há
   segundo estado distinto para o mesmo destino `caixa`, então não se repete.
   A navegação inferior mobile é validada em todas as capturas mobile, não como
   tela separada (era idêntica a `tela-inicial`). */
const MOBILE_SCREENS = [
  { key: 'tela-inicial',   desc: 'Tela inicial do app (viewCaixa por padrão)', tab: 'caixa' },
  { key: 'view-inicio',    desc: 'View Início', tab: 'inicio' },
  { key: 'view-inicio-rolagem', desc: 'View Início — conteúdo abaixo da primeira dobra', tab: 'inicio', scroll: 'fundo' },
  { key: 'drawer-aberto',  desc: 'Drawer aberto', tab: 'caixa' },
  { key: 'perfil',         desc: 'Perfil', tab: 'profile' },
  { key: 'perfil-rolagem', desc: 'Perfil — conteúdo abaixo da primeira dobra (relação com a navegação inferior fixa)', tab: 'profile', scroll: 'fundo' },
];

const DESKTOP_SCREENS = [
  { key: 'tela-inicial',   desc: 'Tela inicial do app (viewCaixa por padrão)', tab: 'caixa' },
  { key: 'view-inicio',    desc: 'View Início', tab: 'inicio' },
  { key: 'drawer-aberto',  desc: 'Drawer aberto', tab: 'caixa' },
  { key: 'perfil',         desc: 'Perfil', tab: 'profile' },
];

const VIEW_ID_MAP = {
  'caixa': 'viewCaixa',
  'inicio': 'viewInicio',
  'dashboard': 'viewDashboard',
  'dash': 'viewDash',
  'profile': 'viewProfile',
  'invest': 'viewInvest',
  'pockets': 'viewPockets',
};

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

async function closeDrawerDirect(Runtime) {
  var res = await evalJS(Runtime,
    '(() => { var overlay = document.getElementById("appDrawerOverlay"); if (!overlay) return "sem-overlay-drawer"; overlay.classList.add("hidden"); overlay.setAttribute("aria-hidden", "true"); return "fechou-drawer"; })()'
  );
  await sleep(500);
  var status = await checkOverlayHidden(Runtime, '#appDrawerOverlay');
  return res + ' | drawer-status:' + status;
}

async function applyThemeDirect(Runtime, theme) {
  /* Força classe dark-mode no body conforme o modo solicitado */
  var modeRes = await evalJS(Runtime,
    '(() => { var queroEscuro = "' + theme.modo + '" === "escuro"; if (queroEscuro) { document.body.classList.add("dark-mode"); } else { document.body.classList.remove("dark-mode"); } return queroEscuro ? "dark-mode-set" : "light-mode-set"; })()'
  );
  await sleep(500);

  /* Chama applyLightTheme / applyDarkTheme global com o temaId e lê de volta
     o dataset e as variáveis CSS computadas (prova real da paleta). */
  var applyFn = theme.modo === 'escuro' ? 'applyDarkTheme' : 'applyLightTheme';
  var applyRes = await evalJS(Runtime,
    '(() => { if (typeof window.' + applyFn + ' !== "function") return { erro: "' + applyFn + '-nao-encontrado" }; window.' + applyFn + '("' + theme.temaId + '", false); var cs = getComputedStyle(document.body); return { chamada: "' + applyFn + '-chamado:' + theme.temaId + '", dataset: "' + theme.modo + '" === "escuro" ? (document.body.dataset.darkTheme || "") : (document.body.dataset.lightTheme || ""), accent: (cs.getPropertyValue("--accent") || "").trim().toLowerCase(), paper: (cs.getPropertyValue("--paper") || "").trim().toLowerCase() }; })()'
  );
  await sleep(500);

  /* Verifica se o modo ficou correto */
  var verifyRes = await checkBodyMode(Runtime, theme.modo);

  /* Paleta: dataset solicitado + accent/paper computados precisam bater */
  var paletaDetalhes = { esperado: { dataset: theme.temaId, accent: theme.accent, paper: theme.paper }, obtido: applyRes };
  var paletaOk = applyRes && !applyRes.erro &&
    applyRes.dataset === theme.temaId &&
    applyRes.accent === theme.accent &&
    applyRes.paper === theme.paper;
  var paleta = paletaOk ? 'correta' : ('incorreta:' + JSON.stringify(paletaDetalhes));

  return { mode: modeRes, apply: applyRes.erro ? applyRes.erro : applyRes.chamada, verify: verifyRes, paleta: paleta, paletaDetalhes: paletaDetalhes };
}

async function navigateDirect(Runtime, tabName) {
  var viewId = VIEW_ID_MAP[tabName];
  if (!viewId) return 'tab-nao-mapeado:' + tabName;
  var navRes = await evalJS(Runtime,
    '(() => { var views = document.querySelectorAll(".tab-content"); views.forEach(function(v) { v.classList.remove("active"); }); var targetView = document.getElementById("' + viewId + '"); if (!targetView) return "view-nao-encontrada:' + viewId + '"; targetView.classList.add("active"); var nav = document.querySelector(".mobile-bottom-nav"); if (nav) { nav.querySelectorAll("button").forEach(function(b) { b.classList.toggle("is-active", b.dataset.destination === "' + tabName + '"); }); } document.body.dataset.tab = "' + tabName + '"; return "navegou-para:' + tabName + '"; })()'
  );
  await sleep(500);
  return navRes;
}

async function openDrawerDirect(Runtime) {
  var res = await evalJS(Runtime,
    '(() => { var btn = document.getElementById("btnOpenDrawer"); if (!btn) return "btnOpenDrawer-nao-encontrado"; btn.click(); return "drawer-aberto"; })()'
  );
  await sleep(800);
  return res;
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
    var drawerRaw = await checkOverlayHidden(Runtime, '#appDrawerOverlay');
    checks.drawerVisible = drawerRaw;
    checks.drawer = drawerRaw === 'visivel' ? 'visivel' : 'nao-visivel';
  }

  checks.modoCorreto = await checkBodyMode(Runtime, theme.modo);

  if (viewport.mobile) {
    var navCheck = await evalJS(Runtime,
      '(() => { var nav = document.querySelector(".mobile-bottom-nav"); if (!nav) return { encontrado: "nao", visivel: "nao", totalDestinos: 0 }; var cs = getComputedStyle(nav); var vis = cs.display !== "none" && cs.visibility !== "hidden"; var btns = nav.querySelectorAll("button, a"); return { encontrado: "sim", visivel: vis ? "sim" : "nao", totalDestinos: btns.length }; })()'
    );
    checks.navMobileDetalhes = navCheck;
    checks.navMobileValido = (navCheck.encontrado === "sim" && navCheck.visivel === "sim" && navCheck.totalDestinos >= 5) ? "valido" : "invalido";
  } else {
    checks.navMobileValido = 'nao-aplica';
  }

  if (screenKey !== 'drawer-aberto') {
    var tabName = null;
    for (var i = 0; i < (viewport.mobile ? MOBILE_SCREENS : DESKTOP_SCREENS).length; i++) {
      var s = (viewport.mobile ? MOBILE_SCREENS : DESKTOP_SCREENS)[i];
      if (s.key === screenKey) { tabName = s.tab; break; }
    }
    var viewId = tabName ? VIEW_ID_MAP[tabName] : null;
    checks.viewActive = viewId ? await checkViewActiveById(Runtime, viewId) : 'nao-verificado';
  }

  checks.rolagem = await evalJS(Runtime,
    '(() => { var se = document.scrollingElement || document.documentElement; return { y: Math.round(window.scrollY), max: Math.round(se.scrollHeight - se.clientHeight) }; })()'
  );

  return checks;
}

async function checkViewActiveById(Runtime, viewId) {
  return await evalJS(Runtime,
    '(() => { var el = document.getElementById("' + viewId + '"); if (!el) return "view-nao-encontrada"; return el.classList.contains("active") ? "ativa" : "inativa"; })()'
  );
}

async function captureScreen(client, Runtime, Page, viewport, theme, screens, screenKey, manifestNovo) {
  var descObj = screens.find(function(s) { return s.key === screenKey; });
  var tag = viewport.name + '-' + theme.name + '-' + screenKey;
  var filepath = path.join(OUT, (++shotIndex) + '-' + tag + '.png');

  /* Navega para a URL do app e recarrega para isolar o estado */
  await Page.navigate({ url: BASE });
  await Page.loadEventFired();
  await sleep(9000);

  /* Oculta auth overlay em runtime */
  var authRes = await ensureAuthHidden(Runtime);

  /* Aplica o tema diretamente via funções globais + body class */
  var themeRes = await applyThemeDirect(Runtime, theme);

  /* Navega para a tela desejada via manipulação direta do DOM */
  if (screenKey === 'drawer-aberto') {
    var drawerRes = await openDrawerDirect(Runtime);
  } else {
    await navigateDirect(Runtime, screens.find(function(s) { return s.key === screenKey; }).tab);
    await sleep(800);
  }

  /* Fecha drawer se não for drawer-aberto */
  if (screenKey !== 'drawer-aberto') {
    await closeDrawerDirect(Runtime);
  }

  /* Posiciona a rolagem: 'fundo' para capturas complementares abaixo da dobra */
  var rolagemEsperada = descObj && descObj.scroll === 'fundo' ? 'fundo' : 'topo';
  await evalJS(Runtime, '(() => { window.scrollTo(0, 0); return 1; })()');
  if (rolagemEsperada === 'fundo') {
    await evalJS(Runtime,
      '(() => { var se = document.scrollingElement || document.documentElement; window.scrollTo(0, se.scrollHeight); return 1; })()'
    );
    await sleep(700);
  }

  /* Valida antes de gravar */
  var checks = await validateCapture(Runtime, viewport, theme, screenKey);

  var estado = 'capturado';
  var falhas = [];
  if (checks.auth !== 'oculto') falhas.push('auth-visivel');
  if (checks.themePicker !== 'oculto') falhas.push('tema-picker-visivel');
  if (screenKey !== 'drawer-aberto' && checks.drawer !== 'oculto') falhas.push('drawer-visivel');
  if (screenKey === 'drawer-aberto' && checks.drawer !== 'visivel') falhas.push('drawer-nao-visivel');
  if (checks.modoCorreto !== 'correto') falhas.push('modo-incorreto');
  if (viewport.mobile && checks.navMobileValido !== 'valido') falhas.push('nav-mobile-invalido:' + JSON.stringify(checks.navMobileDetalhes));
  if (screenKey !== 'drawer-aberto' && checks.viewActive !== 'ativa') falhas.push('view-nao-ativa:' + checks.viewActive);
  if (rolagemEsperada === 'fundo' && checks.rolagem.y <= 0) falhas.push('rolagem-nao-efetuada');
  if (themeRes.verify !== 'correto') falhas.push('tema-verificacao-falhou:' + themeRes.verify);
  if (themeRes.apply && themeRes.apply.indexOf('nao-encontrado') !== -1) falhas.push('tema-apply-falhou:' + themeRes.apply);
  if (themeRes.paleta !== 'correta') falhas.push('paleta-incorreta:' + themeRes.paleta);

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
    shaPublicacao: SHA_PUBLICACAO,
    rolagem: { posicao: rolagemEsperada, y: checks.rolagem.y, max: checks.rolagem.max },
    temaValidacao: themeRes,
    paletaVerificada: themeRes.paleta === 'correta' ? 'sim' : 'nao',
    overlaysVerificados: {
      authOculto: checks.auth,
      temaPickerOculto: checks.themePicker,
      drawerOculto: screenKey !== 'drawer-aberto' ? checks.drawer : 'nao-aplica',
      drawerVisivel: screenKey === 'drawer-aberto' ? checks.drawerVisible : 'nao-aplica',
      modoCorreto: checks.modoCorreto,
      viewActive: screenKey !== 'drawer-aberto' ? checks.viewActive : 'nao-aplica',
      navMobileValido: viewport.mobile ? checks.navMobileValido : 'nao-aplica',
    },
    falhas: falhas,
  });

  console.log('  [' + shotIndex + '] ' + screenKey + ' (' + theme.name + '): ' + estado);
  console.log('    auth=' + checks.auth + ', picker=' + checks.themePicker + ', modo=' + checks.modoCorreto + ', view=' + checks.viewActive + ', drawer=' + checks.drawer);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  var arquivosExistentes = fs.readdirSync(OUT).filter(function(f) { return f.endsWith('.png'); });
  shotIndex = arquivosExistentes.length;

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

  var manifestFinal = manifestExistente.concat(manifestNovo);
  fs.writeFileSync(manifestPath, JSON.stringify(manifestFinal, null, 2));
  console.log('\nManifest gravado: ' + manifestPath);
  console.log('Capturas nesta execução: ' + total);
  console.log('Total acumulado: ' + manifestFinal.length);
}

main().catch(function(e) { console.error(e); process.exit(1); });
