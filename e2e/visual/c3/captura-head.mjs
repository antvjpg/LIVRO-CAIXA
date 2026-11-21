import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE = 'http://127.0.0.1:8000/index.html';
const HEAD_SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const OUT = path.resolve(__dirname, 'coleta-' + HEAD_SHA.slice(0, 7));
const CAP = path.join(OUT, 'capturas');
const MANIFEST = path.join(OUT, 'manifest.json');

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
  { name: 'desktop', width: 1440, height: 900, scale: 1, mobile: false },
];
const THEMES_ALL = [
  { name: 'oliva-claro', modo: 'claro', temaId: '1', accent: '#5f7a43', paper: '#f7f5ef' },
  { name: 'verde-claro', modo: 'claro', temaId: '2', accent: '#327957', paper: '#f8f7f2' },
  { name: 'lima-claro', modo: 'claro', temaId: '3', accent: '#40916c', paper: '#faf9f6' },
  { name: 'terracota-claro', modo: 'claro', temaId: '4', accent: '#c66f50', paper: '#fbf6ef' },
  { name: 'laranja-claro', modo: 'claro', temaId: '5', accent: '#e85002', paper: '#f9f9f9' },
  { name: 'oliva-escuro', modo: 'escuro', temaId: '1', accent: '#9dd08b', paper: '#1a1917' },
  { name: 'verde-escuro', modo: 'escuro', temaId: '2', accent: '#22c55e', paper: '#121212' },
  { name: 'bege-escuro', modo: 'escuro', temaId: '3', accent: '#c9a86a', paper: '#0f1712' },
  { name: 'terracota-escuro', modo: 'escuro', temaId: '4', accent: '#d08860', paper: '#141410' },
  { name: 'laranja-escuro', modo: 'escuro', temaId: '5', accent: '#e85002', paper: '#000000' },
];
const MOBILE_SCREENS = [
  { key: 'tela-inicial', desc: 'Tela inicial do app (viewCaixa por padrão)', tab: 'caixa' },
  { key: 'view-inicio', desc: 'View Início', tab: 'inicio' },
  { key: 'view-inicio-rolagem', desc: 'View Início — conteúdo abaixo da primeira dobra', tab: 'inicio', scroll: 'fundo', navEsperada: 'oculta' },
  { key: 'drawer-aberto', desc: 'Drawer aberto', tab: 'caixa' },
  { key: 'perfil', desc: 'Perfil', tab: 'profile' },
  { key: 'perfil-rolagem', desc: 'Perfil — conteúdo abaixo da dobra', tab: 'profile', scroll: 'fundo', navEsperada: 'oculta' },
  { key: 'perfil-rolagem-nav-visivel', desc: 'Perfil — conteúdo inferior com nav reexibida', tab: 'profile', scroll: 'revelar-nav', navEsperada: 'visivel' },
];
const DESKTOP_SCREENS = [
  { key: 'tela-inicial', desc: 'Tela inicial do app (viewCaixa por padrão)', tab: 'caixa' },
  { key: 'view-inicio', desc: 'View Início', tab: 'inicio' },
  { key: 'drawer-aberto', desc: 'Drawer aberto', tab: 'caixa' },
  { key: 'perfil', desc: 'Perfil', tab: 'profile' },
];
const VIEW_ID_MAP = {
  caixa: 'viewCaixa', inicio: 'viewInicio', dashboard: 'viewDashboard', dash: 'viewDash',
  profile: 'viewProfile', invest: 'viewInvest', pockets: 'viewPockets',
};
const modoArg = process.argv.find(a => a.startsWith('--modo='))?.slice(7) || null;
const THEMES = modoArg ? THEMES_ALL.filter(t => t.modo === modoArg) : THEMES_ALL;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

async function evalJS(Runtime, expression) {
  const r = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return 'ERR: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function checkOverlayHidden(Runtime, selector) {
  return evalJS(Runtime, '(() => { var el = document.querySelector("' + selector + '"); if (!el) return "nao-existe"; var cs = getComputedStyle(el); var hidden = el.classList.contains("hidden") || el.getAttribute("hidden") !== null || cs.display === "none" || cs.visibility === "hidden"; return hidden ? "oculto" : "visivel"; })()');
}
async function checkBodyMode(Runtime, modo) {
  return evalJS(Runtime, '(() => { var d = document.body.classList.contains("dark-mode"); return ((d && "' + modo + '" === "escuro") || (!d && "' + modo + '" === "claro")) ? "correto" : "incorreto"; })()');
}
async function ensureAuthHidden(Runtime) {
  return evalJS(Runtime, '(() => { var ov = document.getElementById("authOverlay"); if (!ov) return "sem-overlay-auth"; ov.classList.add("hidden"); return "auth-ocultado-runtime"; })()');
}
async function closeDrawerDirect(Runtime) {
  return evalJS(Runtime, '(() => { var ov = document.getElementById("appDrawerOverlay"); if (!ov) return "sem-overlay-drawer"; ov.classList.add("hidden"); ov.setAttribute("aria-hidden", "true"); return "fechou-drawer"; })()');
}
async function applyThemeDirect(Runtime, theme) {
  await evalJS(Runtime, '(() => { if ("' + theme.modo + '" === "escuro") document.body.classList.add("dark-mode"); else document.body.classList.remove("dark-mode"); return 1; })()');
  const fn = theme.modo === 'escuro' ? 'applyDarkTheme' : 'applyLightTheme';
  const applyRes = await evalJS(Runtime, '(() => { if (typeof window.' + fn + ' !== "function") return { erro: "' + fn + '-nao-encontrado" }; window.' + fn + '("' + theme.temaId + '", false); var cs = getComputedStyle(document.body); return { chamada: "' + fn + '-chamado:' + theme.temaId + '", dataset: "' + theme.modo + '" === "escuro" ? (document.body.dataset.darkTheme || "") : (document.body.dataset.lightTheme || ""), accent: (cs.getPropertyValue("--accent") || "").trim().toLowerCase(), paper: (cs.getPropertyValue("--paper") || "").trim().toLowerCase() }; })()');
  const verify = await checkBodyMode(Runtime, theme.modo);
  const ok = applyRes && !applyRes.erro && applyRes.dataset === theme.temaId && applyRes.accent === theme.accent && applyRes.paper === theme.paper;
  return { mode: theme.modo, apply: applyRes?.erro || applyRes?.chamada, verify, paleta: ok ? 'correta' : 'incorreta', paletaDetalhes: { esperado: { dataset: theme.temaId, accent: theme.accent, paper: theme.paper }, obtido: applyRes } };
}
async function navigateDirect(Runtime, tabName) {
  const viewId = VIEW_ID_MAP[tabName];
  if (!viewId) return 'tab-nao-mapeado:' + tabName;
  return evalJS(Runtime, '(() => { document.querySelectorAll(".tab-content").forEach(function(v){ v.classList.remove("active"); }); var t = document.getElementById("' + viewId + '"); if (!t) return "view-nao-encontrada"; t.classList.add("active"); var nav = document.querySelector(".mobile-bottom-nav"); if (nav) nav.querySelectorAll("button").forEach(function(b){ b.classList.toggle("is-active", b.dataset.destination === "' + tabName + '"); }); document.body.dataset.tab = "' + tabName + '"; return "navegou-para:' + tabName + '"; })()');
}
async function openDrawerDirect(Runtime) {
  return evalJS(Runtime, '(() => { var b = document.getElementById("btnOpenDrawer"); if (!b) return "btn-ausente"; b.click(); return "drawer-aberto"; })()');
}
async function checkViewActive(Runtime, viewId) {
  return evalJS(Runtime, '(() => { var e = document.getElementById("' + viewId + '"); return !e ? "view-nao-encontrada" : (e.classList.contains("active") ? "ativa" : "inativa"); })()');
}
async function validateCapture(Runtime, viewport, theme, screenKey) {
  const c = {};
  c.auth = (await checkOverlayHidden(Runtime, '#authOverlay')) === 'oculto' ? 'oculto' : 'visivel';
  c.themePicker = (await checkOverlayHidden(Runtime, '#panelThemePicker')) === 'oculto' ? 'oculto' : 'visivel';
  const drawerRaw = await checkOverlayHidden(Runtime, '#appDrawerOverlay');
  c.drawer = screenKey === 'drawer-aberto' ? drawerRaw : drawerRaw === 'oculto' ? 'oculto' : 'visivel';
  c.modoCorreto = await checkBodyMode(Runtime, theme.modo);
  if (viewport.mobile) {
    c.navMobile = await evalJS(Runtime, '(() => { var n = document.querySelector(".mobile-bottom-nav"); if (!n) return { estado: "ausente", total: 0 }; var cs = getComputedStyle(n); var r = n.getBoundingClientRect(); return { estado: cs.display === "none" ? "ausente" : (n.classList.contains("nav-hidden") ? "oculta-intencional" : "visivel"), total: n.querySelectorAll("button").length, geometria: { width: Math.round(r.width), height: Math.round(r.height) } }; })()');
  }
  const screens = viewport.mobile ? MOBILE_SCREENS : DESKTOP_SCREENS;
  const cfg = screens.find(s => s.key === screenKey);
  c.viewActive = screenKey === 'drawer-aberto' ? 'nao-aplica' : await checkViewActive(Runtime, VIEW_ID_MAP[cfg?.tab]);
  c.rolagem = await evalJS(Runtime, '(() => { var se = document.scrollingElement || document.documentElement; return { y: Math.round(window.scrollY), max: Math.round(se.scrollHeight - se.clientHeight) }; })()');
  return c;
}

async function capture(client, viewport, theme, screenKey, manifest) {
  const desc = (viewport.mobile ? MOBILE_SCREENS : DESKTOP_SCREENS).find(s => s.key === screenKey);
  const tag = viewport.name + '-' + theme.name + '-' + screenKey;
  const file = path.join(CAP, (manifest.capturas.length + 1) + '-' + tag + '.png');
  const { Page, Runtime, Emulation } = client;
  await Emulation.setDeviceMetricsOverride({ width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale, mobile: viewport.mobile });
  await Page.navigate({ url: BASE });
  await Page.loadEventFired();
  await sleep(3500);
  await evalJS(Runtime, 'document.fonts.ready.then(function(){return 1;})');
  await ensureAuthHidden(Runtime);
  const themeRes = await applyThemeDirect(Runtime, theme);
  if (screenKey === 'drawer-aberto') await openDrawerDirect(Runtime);
  else { await navigateDirect(Runtime, desc.tab); await sleep(250); }
  if (screenKey !== 'drawer-aberto') await closeDrawerDirect(Runtime);
  if (desc?.scroll === 'fundo') {
    await evalJS(Runtime, '(() => { var se = document.scrollingElement || document.documentElement; window.scrollTo(0, se.scrollHeight); return 1; })()');
    await sleep(500);
  } else if (desc?.scroll === 'revelar-nav') {
    await evalJS(Runtime, '(() => { var se = document.scrollingElement || document.documentElement; window.scrollTo(0, se.scrollHeight); return 1; })()');
    await sleep(400);
    await evalJS(Runtime, '(() => { var se = document.scrollingElement || document.documentElement; window.scrollTo(0, Math.max(0, se.scrollHeight - se.clientHeight - 120)); return 1; })()');
    await sleep(500);
  } else {
    await evalJS(Runtime, 'window.scrollTo(0,0)');
  }
  const checks = await validateCapture(Runtime, viewport, theme, screenKey);
  const falhas = [];
  if (checks.auth !== 'oculto') falhas.push('auth-visivel');
  if (checks.themePicker !== 'oculto') falhas.push('tema-picker-visivel');
  if (screenKey !== 'drawer-aberto' && checks.drawer !== 'oculto') falhas.push('drawer-visivel');
  if (screenKey === 'drawer-aberto' && checks.drawer !== 'visivel') falhas.push('drawer-nao-visivel');
  if (checks.modoCorreto !== 'correto') falhas.push('modo-incorreto');
  if (screenKey !== 'drawer-aberto' && checks.viewActive !== 'ativa') falhas.push('view-nao-ativa:' + checks.viewActive);
  if (themeRes.verify !== 'correto') falhas.push('tema-verificacao-falhou');
  if (themeRes.paleta !== 'correta') falhas.push('paleta-incorreta');
  if ((desc?.scroll === 'fundo' || desc?.scroll === 'revelar-nav') && checks.rolagem.y <= 0) falhas.push('rolagem-nao-efetuada');
  const { data } = await Page.captureScreenshot({ format: 'png' });
  const buf = Buffer.from(data, 'base64');
  fs.writeFileSync(file, buf);
  manifest.capturas.push({
    arquivo: path.basename(file), sha256Arquivo: sha(buf), bytes: buf.length,
    viewport: viewport.name, resolucao: viewport.width + 'x' + viewport.height,
    tema: theme.name, modo: theme.modo, tela: screenKey, descricao: desc?.desc || '',
    estado: falhas.length ? 'capturado-com-falhas' : 'capturado', falhas,
    dataHora: new Date().toISOString(), headSha: HEAD_SHA, publicacaoSha: manifest.meta.publicacaoSha,
    rolagem: checks.rolagem, navMobile: checks.navMobile || { esperado: 'nao-aplica' },
    temaValidacao: themeRes, overlaysVerificados: checks,
  });
  console.log('  [' + manifest.capturas.length + '] ' + tag + (falhas.length ? ' FALHAS: ' + falhas.join(',') : ''));
}

function sourceFiles() {
  const files = ['index.html', 'sw.js'];
  for (const d of ['style', 'js']) {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (e.isFile() && /\.(css|js)$/.test(e.name) && !/\.(bak|backup)/.test(e.name)) files.push(d + '/' + e.name);
    }
  }
  return files.filter(f => fs.existsSync(path.join(ROOT, f))).map(f => {
    const b = fs.readFileSync(path.join(ROOT, f));
    return { path: f, bytes: b.length, sha256: sha(b) };
  });
}

async function main() {
  fs.mkdirSync(CAP, { recursive: true });
  let manifest = { meta: { geradoEm: new Date().toISOString(), headSha: HEAD_SHA, publicacaoSha: null, branch: execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim(), base: 'http://127.0.0.1:8000/index.html', sourceFiles: sourceFiles() }, capturas: [] };
  try { const old = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); if (Array.isArray(old.capturas)) manifest = old; } catch (e) {}
  const existing = new Set(manifest.capturas.map(c => c.viewport + '|' + c.tema + '|' + c.tela));
  const client = await CDP({ port: 9222 });
  const { Page, Runtime } = client;
  await Page.enable();
  await Runtime.enable();
  for (const vp of VIEWPORTS) {
    const screens = vp.mobile ? MOBILE_SCREENS : DESKTOP_SCREENS;
    for (const theme of THEMES) {
      for (const screen of screens) {
        const key = vp.name + '|' + theme.name + '|' + screen.key;
        if (existing.has(key)) { console.log('  pulando (ja existe): ' + key); continue; }
        await capture(client, vp, theme, screen.key, manifest);
      }
    }
  }
  await client.close();
  manifest.meta.ultimaAtualizacao = new Date().toISOString();
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Total de capturas: ' + manifest.capturas.length + ' | manifesto: ' + MANIFEST);
}

main().catch(e => { console.error(e); process.exit(1); });
