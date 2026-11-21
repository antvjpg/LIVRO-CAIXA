# Especificação da Navegação — APP LAYOUT REDESIGN

**Classificação:** especificação derivada de auditoria — **proposta, aguardando aceite independente**. Não é evidência de aprovação da fase C.2.
**Baseline:** branch `feat/app-layout-redesign` · HEAD `95b92c6aaf059f4d224dddc478ef201a2b31f503` · auditoria runtime em 21/11/2026 com Chromium 156 headless + CDP, recursos externos bloqueados e stub mínimo do Firebase.
**Evidência:** `tmp-c13/c2-navegacao.json` (script `tmp-c13/c2-navegacao.cjs`); resultados: bottom 5/5, drawer 12/12, persistência 2/2, desktop 7/7, 0 erros de console, 0 exceções.

## 1. Objetivo e escopo

Definir destinos, hierarquia, aliases, estados ativos, persistência e regras de transição da navegação, cobrindo barra inferior, Drawer e comportamento em mobile/desktop. Esta especificação descreve o **comportamento atual verificado**; mudanças de comportamento exigem aprovação explícita e escopo próprio.

## 2. Views canônicas

`TAB_NAMES` (`js/99-init.js:350`): `dash`, `dashboard`, `caixa`, `invest`, `pockets`, `cards`, `receivables`, `bills`, `profile`, `goals`, `inicio`.

| Tab | View | Entrada principal | Entrada alternativa |
|---|---|---|---|
| `inicio` | `#viewInicio` | barra inferior (posição 1) | Drawer `inicio` |
| `pockets` | `#viewPockets` | barra inferior (posição 2) | Drawer `pockets` |
| `caixa` | `#viewCaixa` | barra inferior (posição 3) | Drawer `overview` |
| `invest` | `#viewInvest` | barra inferior (posição 4) | Drawer `investments` |
| `profile` | `#viewProfile` | barra inferior (posição 5) | Drawer `profile` |
| `dash` | `#viewDash` | Drawer `dash` | — |
| `dashboard` | `#viewDashboard` | legado (sem entrada ativa identificada) | — |
| `cards` | `#viewCards` | Drawer `cards` | — |
| `bills` | `#viewBills` | Drawer `bills` | — |
| `receivables` | `#viewReceivables` | Drawer `receivables` | — |
| `goals` | `#viewGoals` | Drawer `goals` (patch dedicado) | — |

## 3. Barra inferior

| Posição | `data-destination` | Índice (`--nav-indicator-x`) | Tab persistida | View ativa |
|---:|---|---|---|---|
| 1 | `inicio` | `0%` | `inicio` | `#viewInicio` |
| 2 | `pockets` | `100%` | `pockets` | `#viewPockets` |
| 3 | `caixa` | `200%` | `caixa` | `#viewCaixa` |
| 4 | `invest` | `300%` | `invest` | `#viewInvest` |
| 5 | `profile` | `400%` | `profile` | `#viewProfile` |

Regras: exatamente cinco destinos; um único botão `is-active`; `nav.dataset.active` espelha o destino; clique chama `switchTab(destino)` e rola para o topo. A função `updateNavIndicator()` está em `js/00-bootstrap.js:51-64`.

## 4. Drawer

Ações e mapeamentos verificados (`js/99-init.js:1607-1628`, `js/legacy/patches.js:89-99`):

| Ação | Efeito | View resultante | Observação |
|---|---|---|---|
| `inicio` | `switchTab('inicio')` + scroll topo | `#viewInicio` | — |
| `overview` | alias de `caixa` + scroll topo | `#viewCaixa` | — |
| `dash` | `switchTab('dash')` + scroll topo | `#viewDash` | indicador cai para `caixa` (ver §7) |
| `cards` | `switchTab('cards')` | `#viewCards` | indicador `caixa` |
| `bills` | `switchTab('bills')` | `#viewBills` | indicador `caixa` |
| `receivables` | `switchTab('receivables')` | `#viewReceivables` | indicador `caixa` |
| `pockets` | `switchTab('pockets')` | `#viewPockets` | — |
| `goals` | patch dedicated `switchTab('goals')` | `#viewGoals` | `nav.dataset.active` removido (ver §7) |
| `investments` | alias de `invest` | `#viewInvest` | — |
| `profile` | `switchTab('profile')` + scroll topo | `#viewProfile` | — |
| `lab` | `openFeatureProfile()` | mantém view anterior | abre `#panelFeatureProfile` |
| `novoLog` | `openModal('panelLOG')` | mantém view anterior | abre `#panelLOG` |

Regra transversal: **todo** clique em ação do Drawer chama `closeDrawer()` ao final; `Escape` e clique no overlay também fecham. Ações de painel não alteram a view ativa.

## 5. Dispatcher e camadas

Não há dispatcher paralelo: há uma cadeia de embrulhos sobre a mesma função.

1. **Base** — `window.switchTabOriginal` (`js/99-init.js:399-448`): atualiza `currentTab`, `body.dataset.tab`, classes `.active` das views, indicador da barra inferior, renderizações por aba e `balanceStrip`/`universalPeriodBar`.
2. **Patch Metas** — `js/legacy/patches.js:19-87`: trata `goals` isoladamente e reforça a pílula da barra inferior; resolve `switchTabOriginal` em tempo de chamada.
3. **FAB** — `js/99-init.js:3646-3653`: chama a camada anterior e atualiza `aria-label` do botão flutuante.

`window.persistLastTab` é exportado em `js/99-init.js:360` para o patch externo de Metas. Referências a `#tabBtn*` na base são inofensivas (`?.`) porque esses IDs não existem no HTML atual.

## 6. Persistência e transições

- Chave: `sessionStorage['livrocaixa_last_tab']` (`LAST_TAB_STORAGE_KEY`, `js/99-init.js:349`).
- `localStorage` é limpo no boot (`js/99-init.js:357`): a aba vale somente pela sessão, sobrevive a F5, some ao fechar o app.
- `persistLastTab()` só grava se o valor pertence a `TAB_NAMES` (`js/15-tabs-nav.js:14-18`).
- Restauração síncrona no bootstrap (`js/99-init.js:459-467`) chama `switchTab(savedTab)`, evitando flash e garantindo classes/indicador.
- Renderizações por aba: `bills`, `cards`, `receivables`, `invest`, `dashboard`/`inicio`, `caixa`/`inicio`, `dash` e `profile` (`js/99-init.js:426-447`).
- Transição visual: `body.tab-changing` por 240 ms; `scrollTo({top:0, behavior:'smooth'})` nos caminhos principal e em `inicio`, `overview`, `dash`, `profile`.

## 7. Divergências conhecidas (não corrigidas nesta especificação)

1. **Indicador de `dash`:** `updateNavIndicator()` mapeia `dash → dashboard` (`js/00-bootstrap.js:55`), mas a barra inferior não tem mais `dashboard` desde D-01. Resultado observado: `#viewDash` ativa, porém `nav.dataset.active = caixa` e indicador `200%`.
2. **Indicador de `goals`:** o patch remove `data-active` da barra inferior (`js/legacy/patches.js:50-51`); o indicador permanece no último valor (`100%` no cenário medido).
3. **Abas secundárias** (`cards`, `bills`, `receivables`, `dash`) usam `caixa` como fallback visual na barra inferior — comportamento atual, não bug funcional.
4. **`dashboard`** permanece em `TAB_NAMES` sem entrada ativa no shell; é rota legada preservada.
5. Não há roteamento por URL/hash nem histórico de deep-link identificado; a restauração depende apenas de `sessionStorage`.
6. Navegação por teclado/foco e leitores de tela não foi exercitada nesta auditoria.

## 8. Critérios de aceite propostos para C.2

- [x] Todos os destinos e aliases mapeados e validados no runtime (5 bottom + 12 drawer + 7 desktop).
- [x] Persistência da última aba validada em `inicio` e `pockets` após reload.
- [x] Drawer fechado após todas as ações; painéis `lab`/`novoLog` não trocam de view.
- [x] Nenhum dispatcher paralelo: cadeia documentada.
- [ ] Aceite independente desta especificação.
- [ ] Decisão sobre as divergências de indicador (§7.1–7.2), se desejar correção.
- [ ] Validação de teclado/foco/acessibilidade, se exigida para o aceite.

## 9. Evidências

`tmp-c13/c2-navegacao.json`, `tmp-c13/c2-navegacao.cjs`, `tmp-c13/c2-http-server.log`, `tmp-c13/c2-chromium.log`. Nenhuma alteração em `index.html`, `js/` ou `style/` foi feita por esta auditoria.
