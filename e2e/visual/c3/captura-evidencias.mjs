/* C.3.0 — Coleta de evidências visuais para auditoria independente.
   Uso: node e2e/visual/c3/captura-evidencias.mjs
   Requer: servidor local em :8000 e Chromium com --remote-debugging-port=9222
   NÃO modifica fonte do app. Apenas manipula DOM em runtime para capturas. */

import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, 'evidencias');
const BASE = 'http://127.0.0.1:8000/index.html';
const HEAD_SHA = '23b6c63a50e9ebb5aa1ee8837b4134bc2f536007';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
  { name: 'desktop', width: 1440, height: 900, scale: 1, mobile: false },
];

const THEMES = [
  { name: 'oliva-claro',  apply: false }, // default, no action
  { name: 'oliva-escuro', apply: true },  // set via profile -> aparencia
];

const SCREENS = [
  { key: 'tela-inicial',   desc: 'Tela inicial do app (viewCaixa por padrao)' },
  { key: 'view-inicio',    desc: 'View Início' },
  { key: 'view-livro-caixa', desc: 'View Livro-Caixa' },
  { key: 'drawer-aberto',  desc: 'Drawer aberto' },
  { key: 'perfil',         desc: 'Perfil' },
  { key: 'nav-mobile',     desc: 'Navegação mobile inferior' },
];

const manifest = [];
let shotIndex = 0;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evalJS(Runtime, expression) {
  const { result, exceptionDetails } = await Runtime.evaluate({
    expression, returnByValue: true, awaitPromise: true,
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

async function ensureAuth(client, Runtime) {
  /* Tenta remover o overlay de auth apenas para capturas visuais.
     Nao e uma alteracao de fonte: e manipulacao de DOM em runtime. */
  const authHidden = await evalJS(Runtime, `
    (() => {
      const ov = document.getElementById('authOverlay');
      if (!ov) return 'no-auth-overlay';
      if (ov.classList.contains('hidden')) return 'already-hidden';
      ov.classList.add('hidden');
      return 'auth-overlay-hidden-runtime';
    })()
  `);
  console.log('  auth:', authHidden);
  await sleep(500);
}

async function switchTab(Runtime, tabName) {
  const res = await evalJS(Runtime, `
    (() => {
      if (typeof window.switchTab !== 'function') return 'switchTab-not-found';
      window.switchTab('${tabName}');
      return 'switched-to-' + '${tabName}';
    })()
  `);
  console.log('  nav:', res);
  await sleep(1200);
}

async function openDrawer(client, Runtime) {
  const res = await evalJS(Runtime, `
    (() => {
      const btn = document.getElementById('btnOpenDrawer');
      if (!btn) return 'btnOpenDrawer-not-found';
      btn.click();
      return 'drawer-opened';
    })()
  `);
  console.log('  drawer:', res);
  await sleep(1000);
}

async function setDarkTheme(client, Runtime) {
  /* Abre o perfil, clica em Aparencia, seleciona Oliva escuro */
  await switchTab(Runtime, 'profile');
  await sleep(800);

  const openRes = await evalJS(Runtime, `
    (() => {
      const btn = document.getElementById('btnAparencia');
      if (!btn) return 'btnAparencia-not-found';
      btn.click();
      return 'aparencia-opened';
    })()
  `);
  console.log('  aparencia:', openRes);
  await sleep(1000);

  const setRes = await evalJS(Runtime, `
    (() => {
      const btn = document.querySelector('.dark-theme-option[data-theme="1"]');
      if (!btn) return 'dark-theme-btn-not-found';
      btn.click();
      return 'dark-theme-selected';
    })()
  `);
  console.log('  dark-theme:', setRes);
  await sleep(1000);

  /* Fecha o modal de aparencia se ainda estiver aberto */
  await evalJS(Runtime, `
    (() => {
      const close = document.querySelector('.modal-close, [data-close-dialog], [aria-label*="Fechar"]');
      if (close) close.click();
      return 'modal-close-attempted';
    })()
  `);
  await sleep(500);
}

async function captureScreen(client, Runtime, viewport, theme, screen) {
  const tag = `${viewport.name}-${theme.name}-${screen.key}`;
  const filepath = path.join(OUT, `${++shotIndex}-${tag}.png`);

  /* Aplica tema se necessario */
  if (theme.apply) {
    await setDarkTheme(client, Runtime);
  }

  /* Navega para a tela */
  switch (screen.key) {
    case 'tela-inicial':
      /* viewCaixa ja esta ativo por padrao */
      break;
    case 'view-inicio':
      await switchTab(Runtime, 'inicio');
      break;
    case 'view-livro-caixa':
      await switchTab(Runtime, 'caixa');
      break;
    case 'drawer-aberto':
      await openDrawer(client, Runtime);
      break;
    case 'perfil':
      await switchTab(Runtime, 'profile');
      break;
    case 'nav-mobile':
      /* Navegacao mobile inferior ja esta visível; apenas garante view caixa */
      await switchTab(Runtime, 'caixa');
      break;
  }
  await sleep(800);

  await screenshot(client, filepath);

  manifest.push({
    arquivo: path.basename(filepath),
    viewport: viewport.name,
    resolucao: `${viewport.width}x${viewport.height}`,
    tema: theme.name,
    tela: screen.key,
    descricao: screen.desc,
    estado: 'capturado',
    dataHora: new Date().toISOString(),
    shaHEAD: HEAD_SHA,
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const client = await CDP({ port: 9222 });
  const { Page, Runtime, Emulation } = client;
  await Page.enable();
  await Runtime.enable();

  for (const vp of VIEWPORTS) {
    await Emulation.setDeviceMetricsOverride({
      width: vp.width, height: vp.height, deviceScaleFactor: vp.scale, mobile: vp.mobile,
    });
    await sleep(500);

    for (const theme of THEMES) {
      await Page.navigate({ url: BASE });
      await Page.loadEventFired();
      await sleep(4000); /* app inicializar + Firebase */

      /* Remove overlay de auth para ver o app (runtime only) */
      await ensureAuth(client, Runtime);

      for (const screen of SCREENS) {
        await captureScreen(client, Runtime, vp, theme, screen);
      }
    }
  }

  await client.close();

  /* Grava manifest */
  const manifestPath = path.join(OUT, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\nManifest gravado:', manifestPath);
  console.log('Total de capturas:', manifest.length);
}

main().catch(e => { console.error(e); process.exit(1); });
