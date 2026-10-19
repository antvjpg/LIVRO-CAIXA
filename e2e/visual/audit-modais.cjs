/* C.O.D.E. — auditoria visual dos modais em desktop.
 *
 * Escopo: SOMENTE QA. Não altera nenhum arquivo de produção.
 * Objetivo: abrir cada painel do aplicativo em viewport desktop, capturar
 * screenshot e medir problemas objetivos de layout (overflow, corte,
 * conteúdo fora da viewport, alvo de toque sem altura, texto ilegível).
 *
 * IMPORTANTE — modo de execução:
 *   Este script NÃO autentica. Ele esconde o #authOverlay apenas no contexto
 *   do navegador de teste para poder inspecionar a GEOMETRIA dos painéis.
 *   Portanto ele valida ESTRUTURA/LAYOUT (estado vazio), não conteúdo
 *   preenchido. A validação com dados reais exige a conta QA e a cota do
 *   Firestore disponível (ver e2e/README.md).
 *
 * Uso:
 *   node e2e/visual/audit-modais.cjs [--url http://127.0.0.1:8000] [--out dir]
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');

function arg(nome, fallback) {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/* Servidor HTTP embutido: o script não depende de python nem de processo
   externo (ambientes de CI/desktop reiniciam processos em background). */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function servirEstatico() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(ROOT, '.' + rel);
      /* impede escapar da raiz do repositório */
      if (!file.startsWith(ROOT)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

let OUT_DIR = path.resolve(ROOT, arg('out', 'e2e/visual/saida'));
const SHOT_DIR = path.join(OUT_DIR, 'modais');
const VIEWPORT = { width: 1440, height: 900 };

/* Painéis que vivem no index.html (levantados do DOM, não presumidos). */
const PANELS = [
  'panelNovo', 'panelBanco', 'panelCategoria', 'panelFiltros', 'panelFeatureProfile',
  'panelDiagnostico', 'panelTransferencia', 'panelBill', 'panelBillLaunch', 'panelReceivable',
  'panelBillShare', 'panelCard', 'panelPurchase', 'panelInvest', 'panelPocket',
  'panelPocketMovement', 'panelInvestMovement', 'panelCryptoReconcile', 'panelExportFormat',
  'panelEntryHistory', 'panelPaste', 'panelImport', 'panelGoalForm', 'panelAiChat',
  'panelOcrReview', 'panelCustomPeriod',
];

/* Abridores reais do app. Preferi-los à manipulação de classe porque vários
   painéis só são populados (e às vezes só podem ser abertos) pela função que
   os abre: openNewEntryModal exige banco, openPurchaseModal exige cartão,
   btnTransferencia exige dois destinos. Abrir por classe inventaria um estado
   que o usuário nunca alcança. */
const ABRIDORES = {
  panelAiChat: 'openAiChat',
  panelBanco: 'openBankManagementPanel',
  panelBill: 'openBillModal',
  panelCard: 'openCardModal',
  panelCustomPeriod: 'openCustomPeriodModal',
  panelDiagnostico: 'openDiagnostics',
  panelFeatureProfile: 'openFeatureProfile',
  panelGoalForm: 'openNewGoalModal',
  panelInvest: 'openNewInvestModal',
  panelNovo: 'openNewEntryModal',
  panelPocket: 'openNewPocketModal',
  panelPurchase: 'openPurchaseModal',
  panelReceivable: 'openReceivableModal',
};

/* Abre o painel. Caminho preferido: função real do app. Fallback: replicar o
   openModal por classe (js/24-automation-render.js:279), marcado como forçado. */
async function abrirPainel(page, id) {
  const funcao = ABRIDORES[id];
  if (funcao) {
    const real = await page.evaluate(
      ({ panelId, fnName }) => {
        if (typeof window[fnName] !== 'function') return { via: 'sem-funcao' };
        try {
          window[fnName]();
        } catch (e) {
          return { via: fnName, erro: String(e.message).slice(0, 160) };
        }
        const aberto = document.querySelector('.panel.open');
        const alvo = document.getElementById(panelId);
        return {
          via: fnName,
          abriu: !!alvo && alvo.classList.contains('open'),
          painelAberto: aberto ? aberto.id : null,
        };
      },
      { panelId: id, fnName: funcao }
    );
    if (real.abriu) return { existe: true, via: real.via };
    return {
      existe: false,
      bloqueado: true,
      via: real.via,
      motivo: real.erro || (real.painelAberto ? `abriu ${real.painelAberto}` : 'não abriu'),
    };
  }

  return page.evaluate((panelId) => {
    const overlay = document.getElementById('modalOverlay');
    document.querySelectorAll('.panel.open, .panel').forEach((p) => p.classList.remove('open'));
    const panel = document.getElementById(panelId);
    if (!panel) return { existe: false, via: 'ausente' };
    panel.classList.add('open');
    if (overlay) overlay.classList.add('open');
    return { existe: true, via: 'classe-forcada' };
  }, id);
}

/* Medições objetivas dentro de um painel aberto. */
async function medir(page, id) {
  return page.evaluate((panelId) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const painel = document.getElementById(panelId);
    if (!painel) return null;
    const r = painel.getBoundingClientRect();
    const visivel = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    };

    const overlay = document.getElementById('modalOverlay');
    const ocs = overlay ? getComputedStyle(overlay) : null;
    const pcs = getComputedStyle(painel);
    const centroX = Math.round(r.x + r.width / 2);
    const centroY = Math.round(r.y + r.height / 2);
    const noTopo = document.elementFromPoint(centroX, centroY);
    const descrever = (el) => el
      ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''}`
      : null;

    /* Rolagem interna: em painéis com header/rodapé fixos (ex.: metas) quem
       rola é um filho, não o painel. Medir só o painel esconderia conteúdo
       inalcançável. */
    const rolantes = [];
    for (const el of [painel, ...painel.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2) {
        rolantes.push({
          el: descrever(el),
          scrollH: el.scrollHeight,
          clientH: el.clientHeight,
          visivel: Math.round(el.clientHeight),
        });
      }
    }

    /* Controles visíveis + estilos computados: permite comparar a consistência
       entre campos do mesmo formulário (select vs botão-trigger, por exemplo). */
    const controles = [...painel.querySelectorAll('input, select, textarea, button')]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return b.height > 0 && b.width > 0 && cs.display !== 'none' && !el.classList.contains('modal-close');
      })
      .map((el) => {
        const cs = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        return {
          el: descrever(el),
          altura: Math.round(b.height),
          largura: Math.round(b.width),
          topo: Math.round(b.top),
          esquerda: Math.round(b.left),
          raio: cs.borderTopLeftRadius,
          borda: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
          fundo: cs.backgroundColor,
          fonte: cs.fontSize,
          padding: cs.padding,
        };
      });

    const foraHorizontal = [];
    const foraVertical = [];
    const semAltura = [];
    const textoIlegivel = [];

    for (const el of painel.querySelectorAll('*')) {
      if (!visivel(el)) continue;
      const b = el.getBoundingClientRect();
      const desc = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
        `${el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''}`;
      /* tolerância de 1px para arredondamento subpixel */
      if (b.right > vw + 1 || b.left < -1) {
        foraHorizontal.push({ el: desc, esquerda: Math.round(b.left), direita: Math.round(b.right) });
      }
      if (b.bottom > vh + 1) {
        foraVertical.push({ el: desc, topo: Math.round(b.top), base: Math.round(b.bottom) });
      }
      const interativo = el.matches('button, a, input, select, textarea, [role="button"]');
      if (interativo && b.height < 1) semAltura.push({ el: desc, largura: Math.round(b.width) });
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (interativo && fs && fs < 11) textoIlegivel.push({ el: desc, fonte: fs });
    }

    return {
      painel: {
        x: Math.round(r.x), y: Math.round(r.y),
        largura: Math.round(r.width), altura: Math.round(r.height),
      },
      /* O modal está de fato apresentado ao usuário? (não basta ter tamanho) */
      exposto:
        pcs.display !== 'none' && pcs.visibility !== 'hidden' && Number(pcs.opacity) > 0 &&
        !!ocs && ocs.display !== 'none' && ocs.visibility !== 'hidden' && Number(ocs.opacity) > 0,
      overlayEstado: ocs
        ? { opacity: ocs.opacity, display: ocs.display, visibility: ocs.visibility, zIndex: ocs.zIndex, classe: overlay.className }
        : null,
      painelEstado: { display: pcs.display, visibility: pcs.visibility, opacity: pcs.opacity },
      noTopoNoCentro: descrever(noTopo),
      centro: { x: centroX, y: centroY },
      containersRolaveis: rolantes,
      controles,
      overflowX: painel.scrollWidth > painel.clientWidth + 1,
      overflowY: painel.scrollHeight > painel.clientHeight + 1,
      scrollH: Math.round(painel.scrollHeight),
      clientH: Math.round(painel.clientHeight),
      bodyOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      foraHorizontal: foraHorizontal.slice(0, 8),
      qtdForaHorizontal: foraHorizontal.length,
      qtdForaVertical: foraVertical.length,
      semAltura: semAltura.slice(0, 8),
      textoIlegivel: textoIlegivel.slice(0, 8),
      /* conteúdo real? painel sem nenhum texto indica estado vazio */
      temTexto: (painel.innerText || '').trim().length > 0,
      qtdCampos: painel.querySelectorAll('input, select, textarea').length,
      qtdBotoes: painel.querySelectorAll('button, [role="button"]').length,
    };
  }, id);
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  /* Remove capturas da execução anterior: painel bloqueado não gera print, e
     um PNG órfão faria o relatório mostrar um estado que não existe mais. */
  for (const f of fs.readdirSync(SHOT_DIR)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOT_DIR, f));
  }
  const externo = arg('url', null);
  const embutido = externo ? null : await servirEstatico();
  const baseUrl = externo || embutido.url;
  console.log(`[visual] servidor ${externo ? 'externo' : 'embutido'}: ${baseUrl}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();

  const errosConsole = [];
  const dialogos = [];
  page.on('pageerror', (e) => errosConsole.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') errosConsole.push(String(m.text()).slice(0, 200));
  });
  /* Alertas do app são evidência: é assim que ele bloqueia fluxos sem dados. */
  page.on('dialog', async (d) => {
    dialogos.push(d.message());
    await d.dismiss();
  });

  console.log(`[visual] abrindo ${baseUrl}/index.html`);
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.panel').length >= 20, null, { timeout: 45_000 });
  /* O init (js/99-init.js) roda DEPOIS do DOM e chama closeAllPanels(); abrir
     um painel antes disso faz a classe .open ser removida por ele. Esperar o
     app se declarar pronto (openModal global + body[data-tab]) evita a corrida. */
  await page
    .waitForFunction(
      () => typeof window.openModal === 'function' && !!document.body.dataset.tab,
      null,
      { timeout: 45_000 }
    )
    .catch(() => console.warn('[visual] aviso: sinal de prontidão não apareceu; seguindo'));
  await page.waitForTimeout(600);

  /* SOMENTE NO NAVEGADOR DE TESTE: esconder overlays de autenticação/sync para
     os painéis ficarem inspecionáveis sem sessão. Não toca no app. */
  await page.addStyleTag({
    content: '#authOverlay,#syncOverlay,#authDiagnosticPanel{display:none!important}',
  });

  const resultados = [];
  for (const id of PANELS) {
    const antes = errosConsole.length;
    const aberto = await abrirPainel(page, id);
    if (!aberto.existe) {
      const status = aberto.bloqueado ? 'bloqueado-pelo-app' : 'ausente-no-dom';
      resultados.push({
        id,
        status,
        via: aberto.via,
        motivo: aberto.motivo || 'painel não renderizado',
        dialogo: dialogos.length ? dialogos[dialogos.length - 1] : null,
      });
      console.log(
        `[visual] ${id}: ${status.toUpperCase()} (${aberto.via}` +
        `${aberto.motivo ? ': ' + aberto.motivo : ''})`
      );
      continue;
    }
    /* Espera a transição de opacidade (0.2s) terminar: medir no meio dela
       produzia falso "não exposto". */
    await page
      .waitForFunction(
        () => {
          const o = document.getElementById('modalOverlay');
          return !!o && getComputedStyle(o).opacity === '1';
        },
        null,
        { timeout: 3000 }
      )
      .catch(() => {});
    /* duas frames: evita medir durante transição de classe */
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(120);

    const m = await medir(page, id);
    const arquivo = path.join(SHOT_DIR, `${id}.png`);
    await page.screenshot({ path: arquivo, fullPage: false });

    /* Conteúdo rolável: o print do topo corta um controle ao meio e isso é
       normal. Para não confundir rolagem com defeito, capturo também o fim e
       meço o respiro entre o último elemento e a borda inferior. */
    let fim = null;
    if (m.scrollH > m.clientH + 2 || (m.containersRolaveis || []).length > 0) {
      await page.evaluate((panelId) => {
        const p = document.getElementById(panelId);
        if (!p) return;
        p.scrollTop = p.scrollHeight;
        for (const el of p.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') el.scrollTop = el.scrollHeight;
        }
      }, id);
      await page.waitForTimeout(120);
      const arquivoFim = path.join(SHOT_DIR, `${id}--fim.png`);
      await page.screenshot({ path: arquivoFim, fullPage: false });
      fim = await page.evaluate((panelId) => {
        const p = document.getElementById(panelId);
        if (!p) return null;
        const base = p.getBoundingClientRect().bottom;
        let maior = -Infinity;
        let alvo = null;
        for (const el of p.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const b = el.getBoundingClientRect();
          if (b.height <= 0) continue;
          if (b.bottom > maior) { maior = b.bottom; alvo = el; }
        }
        return {
          respiroInferior: Math.round(base - maior),
          ultimoElemento: alvo ? `${alvo.tagName.toLowerCase()}${alvo.id ? '#' + alvo.id : ''}` : null,
        };
      }, id);
      if (fim) fim.screenshot = path.relative(ROOT, arquivoFim);
      /* devolve ao topo para o próximo painel não herdar a rolagem */
      await page.evaluate((panelId) => {
        const p = document.getElementById(panelId);
        if (!p) return;
        p.scrollTop = 0;
        for (const el of p.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') el.scrollTop = 0;
        }
      }, id);
    }

    resultados.push({
      id,
      status: 'ok',
      via: aberto.via,
      screenshot: path.relative(ROOT, arquivo),
      rolagemFim: fim,
      ...m,
      errosConsole: errosConsole.slice(antes, antes + 3),
    });
    console.log(
      `[visual] ${id}: ${m.painel.largura}x${m.painel.altura}` +
      `${m.exposto ? '' : ' NAO-EXPOSTO'}` +
      `${m.overflowX ? ' OVERFLOW-X' : ''}${m.qtdForaHorizontal ? ` fora=${m.qtdForaHorizontal}` : ''}` +
      `${m.qtdCampos ? ` campos=${m.qtdCampos}` : ''}`
    );
  }

  const json = {
    geradoEm: new Date().toISOString(),
    url: baseUrl,
    viewport: VIEWPORT,
    modo: 'estrutura-sem-autenticacao',
    resultados,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'auditoria-modais.json'), JSON.stringify(json, null, 2));

  /* Resumo em markdown para leitura humana. */
  const problemas = resultados.filter(
    (r) => r.status !== 'ok' || !r.exposto || r.overflowX || r.qtdForaHorizontal > 0 || r.semAltura?.length > 0
  );
  const linhas = [
    '# Auditoria visual dos modais — desktop',
    '',
    `- Executado: ${json.geradoEm}`,
    `- Viewport: ${VIEWPORT.width}x${VIEWPORT.height}`,
    `- Modo: **estrutura sem autenticação** (estado vazio, sem dados reais)`,
    `- Modais medidos: ${resultados.filter((r) => r.status === 'ok').length}/${PANELS.length}`,
    `- Com achados: ${problemas.length}`,
    '',
    '| Modal | Via | Tamanho | Exposto | Overflow X | Fora da tela | Sem altura | Campos |',
    '|---|---|---|---|---|---|---|---|',
    ...resultados.map((r) =>
      r.status === 'ok'
        ? `| ${r.id} | ${r.via} | ${r.painel.largura}x${r.painel.altura} | ${r.exposto ? 'sim' : '**NÃO**'} | ${r.overflowX ? '**SIM**' : 'não'} | ${r.qtdForaHorizontal} | ${r.semAltura?.length || 0} | ${r.qtdCampos} |`
        : `| ${r.id} | ${r.via || '—'} | ${r.status} | - | - | - | - | - |`
    ),
    '',
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'RELATORIO.md'), linhas.join('\n'));

  console.log(`\n[visual] saida: ${path.relative(ROOT, OUT_DIR)}`);
  console.log(`[visual] modais com achados: ${problemas.length}`);
  await browser.close();
  if (embutido) embutido.server.close();
})().catch((e) => {
  console.error('[visual] falhou:', e.message);
  process.exit(1);
});
