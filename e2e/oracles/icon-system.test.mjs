/* C.O.D.E. — testes do resolvedor centralizado de ícones Tabler.
   Executam a IMPLEMENTAÇÃO REAL (js/domain/icon-system.js + catálogo) em Node.
   Execução: node --test e2e/oracles/icon-system.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as ICON from '../../js/domain/icon-system.js';
import { TABLER_ICON_CATALOG, TABLER_LEGACY_EMOJI_MAP } from '../../js/data/tabler-icon-catalog.js';

const FALLBACK = ICON.FALLBACK_ICON;

// ---------------------------------------------------------------- validação
test('isValidTablerIcon: id válido cadastrado', () => {
  assert.equal(ICON.isValidTablerIcon('chart-line'), true);
  assert.equal(ICON.isValidTablerIcon('ti-chart-line'), true);
  assert.equal(ICON.isValidTablerIcon('star'), true);
  assert.equal(ICON.isValidTablerIcon('  chart-line  '), true);
});

test('isValidTablerIcon: id inexistente ou malformado', () => {
  assert.equal(ICON.isValidTablerIcon('nao-existe-x'), false);
  assert.equal(ICON.isValidTablerIcon('ti-nao-existe-x'), false);
  assert.equal(ICON.isValidTablerIcon('--'), false);
});

test('isValidTablerIcon: vazio, nulo e tipos inesperados', () => {
  for (const v of ['', '   ', null, undefined, 42, {}, [], true]) {
    assert.equal(ICON.isValidTablerIcon(v), false, String(v));
  }
});

test('isValidTablerIcon: rejeita espaços e HTML', () => {
  assert.equal(ICON.isValidTablerIcon('chart line'), false);
  assert.equal(ICON.isValidTablerIcon('chart-line evil'), false);
  assert.equal(ICON.isValidTablerIcon('<b>chart-line</b>'), false);
  assert.equal(ICON.isValidTablerIcon('chart-line" onclick="x'), false);
});

// ------------------------------------------------------------- compatibilidade
test('resolveIcon: emojis legados conhecidos viram IDs Tabler', () => {
  assert.equal(ICON.resolveIcon('📈'), 'chart-line');
  assert.equal(ICON.resolveIcon('🏦'), 'building-bank');
  assert.equal(ICON.resolveIcon('🎯'), 'target');
});

test('resolveIcon: IDs Tabler já armazenados são preservados', () => {
  assert.equal(ICON.resolveIcon('chart-line'), 'chart-line');
  assert.equal(ICON.resolveIcon('ti-chart-line'), 'chart-line');
  const stored = TABLER_ICON_CATALOG.map((e) => e.id);
  for (const id of stored) assert.equal(ICON.resolveIcon(id), id);
});

test('resolveIcon: valores desconhecidos retornam o fallback', () => {
  assert.equal(ICON.resolveIcon('🦄'), FALLBACK);
  assert.equal(ICON.resolveIcon('ti-nao-existe-x'), FALLBACK);
  assert.equal(ICON.resolveIcon(''), FALLBACK);
  assert.equal(ICON.resolveIcon(null), FALLBACK);
  assert.equal(ICON.resolveIcon(undefined), FALLBACK);
  assert.equal(ICON.resolveIcon(123), FALLBACK);
  assert.equal(ICON.resolveIcon({}), FALLBACK);
});

test('getLegacyIconMapping: conhecido retorna id; desconhecido retorna null', () => {
  assert.equal(ICON.getLegacyIconMapping('📈'), 'chart-line');
  assert.equal(ICON.getLegacyIconMapping('🎯'), 'target');
  assert.equal(ICON.getLegacyIconMapping('🦄'), null);
  assert.equal(ICON.getLegacyIconMapping('chart-line'), null);
  assert.equal(ICON.getLegacyIconMapping(null), null);
});

test('getIconClass: monta "ti ti-<id>" apenas com id validado', () => {
  assert.equal(ICON.getIconClass('📈'), 'ti ti-chart-line');
  assert.equal(ICON.getIconClass('chart-line'), 'ti ti-chart-line');
  assert.equal(ICON.getIconClass(null), `ti ti-${FALLBACK}`);
  assert.equal(ICON.getIconClass('🦄'), `ti ti-${FALLBACK}`);
});

// ------------------------------------------------------------------ segurança
test('segurança: strings arbitrárias nunca vazam para a classe', () => {
  const payloads = [
    'chart-line evil',
    '" onclick="alert(1)',
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    'chart-line\nextra',
    'TI-CHART-LINE ti-evil',
  ];
  for (const p of payloads) {
    const cls = ICON.getIconClass(p);
    assert.equal(cls, `ti ti-${FALLBACK}`, p);
    assert.ok(!cls.includes('<') && !cls.includes('"'), p);
  }
});

// --------------------------------------------------------------------- catálogo
test('catálogo: ids únicos, fallback cadastrado, tudo válido', () => {
  const ids = TABLER_ICON_CATALOG.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'ids duplicados');
  assert.ok(ids.includes(FALLBACK), 'fallback não está no catálogo');
  for (const id of ids) assert.equal(ICON.isValidTablerIcon(id), true, id);
  for (const id of Object.values(TABLER_LEGACY_EMOJI_MAP)) {
    assert.ok(ids.includes(id), `mapa aponta id fora do catálogo: ${id}`);
  }
});

test('catálogo: cobre todos os emojis de js/data/emoji-catalog.js', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const source = readFileSync(join(root, 'js/data/emoji-catalog.js'), 'utf-8');
  const emojis = [...source.matchAll(/\['(.+?)','(.+?)','(.+?)'\]/g)].map((m) => m[1]);
  assert.ok(emojis.length > 0);
  for (const emoji of emojis) {
    const id = ICON.getLegacyIconMapping(emoji);
    assert.ok(id, `emoji sem mapeamento: ${emoji}`);
    assert.equal(ICON.resolveIcon(emoji), id);
  }
});

test('determinismo: chamadas repetidas retornam o mesmo valor e não mutam entrada', () => {
  const input = '📈';
  assert.equal(ICON.resolveIcon(input), ICON.resolveIcon(input));
  assert.equal(ICON.getIconClass(input), ICON.getIconClass(input));
});

test('getIconLabel: id e legado retornam o rótulo do catálogo', () => {
  assert.equal(ICON.getIconLabel('chart-line'), 'Investimento');
  assert.equal(ICON.getIconLabel('📈'), 'Investimento');
  assert.equal(ICON.getIconLabel('texto-inexistente'), 'Padrão (fallback)');
});

test('getTablerIconCatalog: retorna cópia com entradas do catálogo', () => {
  const catalog = ICON.getTablerIconCatalog();
  assert.equal(catalog.length, TABLER_ICON_CATALOG.length);
  catalog.push({ id: 'x', label: 'x', group: 'x' });
  assert.equal(ICON.getTablerIconCatalog().length, TABLER_ICON_CATALOG.length);
});

test('setas de fluxo in/out resolvidas pelo catálogo', () => {
  assert.equal(ICON.resolveIcon('↗'), 'trending-up');
  assert.equal(ICON.resolveIcon('↘'), 'trending-down');
  assert.equal(ICON.resolveIcon('↔️'), 'arrows-exchange');
});
