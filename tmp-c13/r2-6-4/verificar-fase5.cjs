const fs = require('fs');
const path = require('path');
const CDP = require('chrome-remote-interface');
const { createCDPAuditCore } = require('../../docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs');

const OUT = path.join(__dirname, 'fase5-contrato-erros.json');
const URL = 'http://127.0.0.1:8000/tmp-c13/r2-6-2/fixture.html';

(async () => {
  const client = await CDP({ port: 9222 });
  const { Page, DOM, CSS, Runtime } = client;
  const cdpErrors = [];
  await Promise.all([Page.enable(), DOM.enable(), CSS.enable(), Runtime.enable()]);
  await new Promise((resolve) => {
    Page.loadEventFired(resolve);
    Page.navigate({ url: URL });
  });
  const { root } = await DOM.getDocument({ depth: -1, pierce: true });
  const { nodeId } = await DOM.querySelector({ nodeId: root.nodeId, selector: '#r261-baseline' });
  const core = createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors: [], exceptions: [], cdpErrors });

  const r = await core.getWinningRule(nodeId, 'color');
  const capture = await core.captureWinningRules({}, nodeId);
  const historicalFields = ['property', 'computedValue', 'winningDeclaration', 'candidates', 'captureStatus'];
  const additiveFields = ['resolvedValue'];
  const winnerAdditive = ['source', 'specificity', 'pseudoElement', 'order'];
  const contrato = {
    getWinningRuleHistoricalOk: historicalFields.every((k) => Object.prototype.hasOwnProperty.call(r, k)),
    getWinningRuleAdditiveOk: additiveFields.every((k) => Object.prototype.hasOwnProperty.call(r, k)),
    winnerAdditiveOk: Boolean(r.winningDeclaration) && winnerAdditive.every((k) => Object.prototype.hasOwnProperty.call(r.winningDeclaration, k)),
    captureWinningRulesOk: capture.error === null && Object.keys(capture.properties).length === 10
      && Object.prototype.hasOwnProperty.call(capture.properties.color, 'resolvedValue'),
    captureStatus: r.captureStatus,
  };

  const errorCdp = [];
  const cssQueFalha = {
    getMatchedStylesForNode: async () => { throw new Error('CDP_CONTROLADO'); },
  };
  const coreComFalha = createCDPAuditCore({
    CDP,
    DOM,
    CSS: cssQueFalha,
    Runtime,
    consoleErrors: [],
    exceptions: [],
    cdpErrors: errorCdp,
  });
  const rFalha = await coreComFalha.getWinningRule(nodeId, 'color');
  const erro = {
    captureStatus: rFalha.captureStatus,
    winningDeclaration: rFalha.winningDeclaration,
    candidates: rFalha.candidates,
    cdpErrorsRegistrados: errorCdp.length,
    semVencedorFabricado: rFalha.winningDeclaration === null && rFalha.candidates.length === 0,
  };

  await client.close();
  const checks = [
    contrato.getWinningRuleHistoricalOk,
    contrato.getWinningRuleAdditiveOk,
    contrato.winnerAdditiveOk,
    contrato.captureWinningRulesOk,
    contrato.captureStatus === 'captured',
    erro.captureStatus === 'cdp-error',
    erro.semVencedorFabricado,
    erro.cdpErrorsRegistrados === 1,
  ];
  const saida = {
    id: 'R2.6-FASE5-CONTRATO',
    data: new Date().toISOString(),
    contrato,
    erro,
    resumo: { total: checks.length, PASS: checks.filter(Boolean).length, FAIL: checks.filter((x) => !x).length },
    status: checks.every(Boolean) ? 'PASS' : 'FAIL',
  };
  fs.writeFileSync(OUT, JSON.stringify(saida, null, 2) + '\n');
  console.log(saida.status, JSON.stringify(saida.resumo));
  process.exit(saida.status === 'PASS' ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
