/* C.3.0.1 — Verificação de paleta dos 10 temas (sem recapturar imagens).
   Uso: node e2e/visual/c3/verificar-paletas.mjs
   Requer: servidor local em :8000 e Chromium com --remote-debugging-port=9222

   Comprova, para cada tema, que:
   - document.body.dataset.lightTheme/darkTheme === temaId solicitado;
   - a classe dark-mode corresponde ao modo;
   - as variáveis CSS computadas (--accent, --paper) são as esperadas;
   - não há duas paletas iguais dentro do mesmo modo.

   NÃO modifica fonte do app. Saída: JSON em stdout. */

import CDP from 'chrome-remote-interface';

const BASE = 'http://127.0.0.1:8000/index.html';

const THEMES = [
  { name: 'oliva-claro',     modo: 'claro',  temaId: '1', accent: '#5f7a43', paper: '#f7f5ef' },
  { name: 'verde-claro',     modo: 'claro',  temaId: '2', accent: '#327957', paper: '#f8f7f2' },
  { name: 'lima-claro',      modo: 'claro',  temaId: '3', accent: '#40916c', paper: '#faf9f6' },
  { name: 'terracota-claro', modo: 'claro',  temaId: '4', accent: '#c66f50', paper: '#fbf6ef' },
  { name: 'laranja-claro',   modo: 'claro',  temaId: '5', accent: '#e85002', paper: '#f9f9f9' },
  { name: 'oliva-escuro',    modo: 'escuro', temaId: '1', accent: '#9dd08b', paper: '#1a1917' },
  { name: 'verde-escuro',    modo: 'escuro', temaId: '2', accent: '#22c55e', paper: '#121212' },
  { name: 'bege-escuro',     modo: 'escuro', temaId: '3', accent: '#c9a86a', paper: '#0f1712' },
  { name: 'terracota-escuro',modo: 'escuro', temaId: '4', accent: '#d08860', paper: '#141410' },
  { name: 'laranja-escuro',  modo: 'escuro', temaId: '5', accent: '#e85002', paper: '#000000' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evalJS(Runtime, expression) {
  const { result, exceptionDetails } = await Runtime.evaluate({
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) return 'ERR: ' + (exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}

async function main() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime } = client;
  await Page.enable();
  await Runtime.enable();

  const resultados = [];

  for (const theme of THEMES) {
    await Page.navigate({ url: BASE });
    await Page.loadEventFired();
    await sleep(9000);

    await evalJS(Runtime,
      '(() => { var ov = document.getElementById("authOverlay"); if (ov) ov.classList.add("hidden"); return "ok"; })()'
    );
    await sleep(400);

    const aplicado = await evalJS(Runtime, `(() => {
      var queroEscuro = ${JSON.stringify(theme.modo)} === 'escuro';
      if (queroEscuro) document.body.classList.add('dark-mode');
      else document.body.classList.remove('dark-mode');
      var fn = queroEscuro ? 'applyDarkTheme' : 'applyLightTheme';
      if (typeof window[fn] !== 'function') return { erro: fn + '-nao-encontrado' };
      window[fn](${JSON.stringify(theme.temaId)}, false);
      var cs = getComputedStyle(document.body);
      return {
        datasetLight: document.body.dataset.lightTheme || '',
        datasetDark: document.body.dataset.darkTheme || '',
        isDark: document.body.classList.contains('dark-mode'),
        accent: (cs.getPropertyValue('--accent') || '').trim().toLowerCase(),
        paper: (cs.getPropertyValue('--paper') || '').trim().toLowerCase(),
      };
    })()`);

    const esperadoDataset = theme.modo === 'escuro' ? theme.temaId : theme.temaId;
    const datasetOk = theme.modo === 'escuro'
      ? aplicado.datasetDark === esperadoDataset
      : aplicado.datasetLight === esperadoDataset;
    const modoOk = aplicado.isDark === (theme.modo === 'escuro');
    const accentOk = aplicado.accent === theme.accent;
    const paperOk = aplicado.paper === theme.paper;

    resultados.push({
      tema: theme.name,
      modo: theme.modo,
      temaId: theme.temaId,
      datasetAplicado: theme.modo === 'escuro' ? aplicado.datasetDark : aplicado.datasetLight,
      datasetEsperado: esperadoDataset,
      datasetOk,
      modoOk,
      accentAplicado: aplicado.accent,
      accentEsperado: theme.accent,
      accentOk,
      paperAplicado: aplicado.paper,
      paperEsperado: theme.paper,
      paperOk,
      paletaOk: datasetOk && modoOk && accentOk && paperOk,
      erro: aplicado.erro || null,
    });

    console.log(
      `${theme.name.padEnd(18)} dataset=${datasetOk ? 'ok' : 'FALHA'} modo=${modoOk ? 'ok' : 'FALHA'} ` +
      `accent=${accentOk ? 'ok' : 'FALHA(' + aplicado.accent + '!=' + theme.accent + ')'} ` +
      `paper=${paperOk ? 'ok' : 'FALHA(' + aplicado.paper + '!=' + theme.paper + ')'}`
    );
  }

  await client.close();

  const duplicados = [];
  for (const modo of ['claro', 'escuro']) {
    const vistos = {};
    for (const r of resultados.filter(x => x.modo === modo)) {
      const chave = r.accentAplicado + '|' + r.paperAplicado;
      if (vistos[chave]) duplicados.push({ modo, a: vistos[chave], b: r.tema, chave });
      else vistos[chave] = r.tema;
    }
  }

  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter(r => r.paletaOk).length,
    falhas: resultados.filter(r => !r.paletaOk).map(r => r.tema),
    duplicados,
    resultados,
  };

  console.log('\nResumo: ' + resumo.aprovados + '/' + resumo.total + ' paletas comprovadas; duplicados: ' + duplicados.length);
  console.log(JSON.stringify(resumo, null, 2));

  if (resumo.falhas.length > 0 || duplicados.length > 0) process.exit(2);
}

main().catch(e => { console.error(e); process.exit(1); });
