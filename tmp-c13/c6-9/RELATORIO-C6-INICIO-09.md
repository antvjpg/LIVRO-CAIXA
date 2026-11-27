# RELATÓRIO DE VALIDAÇÃO DINÂMICA — C6-INICIO-09

**Base:** `470de21` (`feat/app-layout-redesign`)  
**Data:** 2026-11-26  
**Escopo:** teclado, foco, ARIA, estado vazio, sincronização de período e estabilidade do gráfico patrimonial da Início.  
**Restrições:** C.O.D.E. e Smoke não executados; sem commit/push; nenhuma alteração em C6-05 reaberta.

## 1. Diagnóstico inicial e método

- Estado inicial: árvore limpa, HEAD `470de21` sincronizado com `origin/feat/app-layout-redesign`.
- Exploração estática prévia mapeou listeners, guards, escritas ARIA, persistência e ciclo de vida do Chart.js.
- Validação dinâmica: Chromium headless + CDP, com `Input.dispatchKeyEvent` real para `Tab`, `Shift+Tab`, `Enter`, `Espaço`, `ArrowUp` e `ArrowDown`. **Não houve `dispatchEvent()` nem `.focus()` como substituto de interação de teclado.**
- Dados determinísticos fictícios em memória (`CODE_TEST_BANK`), com `currentUser`/`firstLoadDone` simulados para habilitar o readiness do gráfico. Nenhum dado real foi apagado ou modificado.
- Console/erros capturados por `Runtime.exceptionThrown` e `Log.entryAdded`.

Script reproduzível: `tmp-c13/c6-9/cdp-c9.mjs`.  
Resultados brutos: `tmp-c13/c6-9/c9-resultados.json`.
Resultados originais preservados: `tmp-c13/c6-9/c9-resultados-v1.json`.

## 2. Resultados por cenário

| Cenário | Resultado | Evidência |
|---|---|---|
| **C09-01** — foco e navegação por teclado | **PASS (evidência corrigida)** | Controle correto alcançado em 18 Tabs; `:focus-visible=true`; `outline: rgb(95,122,67) solid 2px`; `outline-offset: 3px`; seletor alcançado com 2 Tabs adicionais; Tab seguinte chegou ao botão de orçamentos (sem armadilha de foco). |
| **C09-02** — Enter | **PASS** | Expandido → `aria-expanded=false`, `aria-label="Mostrar gráfico do patrimônio"`, `aria-hidden=true`, `is-collapsed=true`, instância destruída. Segundo Enter restaurou tudo; contador de toggle: 1 por tecla. |
| **C09-03** — Espaço | **PASS** | Mesmas transições de C09-02; `scrollY=49` antes e depois; contador: 1 por tecla. |
| **C09-04** — sincronização de estados | **PASS** | Em Início e Caixa, `aria-expanded`, `aria-label`, `aria-hidden`, classes visuais, preferência `livro-caixa-patrimony-spark="1"` e instâncias Chart.js coerentes. Gráfico da Caixa preservado; gráfico da Início recriado ao retornar. |
| **C09-05** — seletor de período por teclado | **PASS** | `ArrowUp` → `3m`, `ArrowDown` → `6m`, `ArrowUp` → `3m`; pontos 3/6/3; `aria-label` do canvas atualizado; `#inicioEvolutionData` com 3/6/3 entradas e mesmos valores. |
| **C09-06** — estado vazio | **PASS (automático)** / **BLOCKED (leitor de tela real)** | Sem contas: mensagem visível, `role=status`, `aria-live=polite`, `aria-hidden=true`, sem instância, texto alternativo vazio. Com dados: mensagem oculta, instância recriada, texto restaurado. Anúncio real por leitor de tela não executado. |
| **C09-07** — regressão e estabilidade | **PASS (evidência corrigida)** | Após Shift+Tab real, `document.activeElement` confirmado como o controle; contador zerado; 6 transições reais (Enter/Espaço alternados) com contagens 1–6; estados `false/true` alternados; instância Chart.js destruída/recriada em cada par; 0 erros de console. |

## 3. Defeitos encontrados e correções

### Defeito 1 — estado “Sem histórico” era usado para collapse/troca de aba

**Antes:** `destroyPatrimonySparkline('inicio')` chamava `setInicioEvolutionEmpty(true)` sempre. Ao recolher o gráfico ou trocar para Caixa, a mensagem “Sem histórico disponível...” aparecia e o texto alternativo era apagado, mesmo existindo dados.

**Depois:** `destroyPatrimonySparkline()` apenas limpa a apresentação da Início (`setInicioEvolutionEmpty(false)`). O estado vazio é sinalizado explicitamente apenas quando não há histórico.

### Defeito 2 — ausência de histórico não era detectada

**Antes:** com `banks`, `pockets` e `investments` vazios, o gráfico era renderizado com barras zeradas e o texto alternativo anunciava `R$ 0,00`, enquanto a mensagem de ausência permanecia oculta.

**Depois:**
```js
const hasHistory = (Array.isArray(banks) && banks.length > 0)
  || (Array.isArray(pockets) && pockets.length > 0)
  || (Array.isArray(investments) && investments.length > 0);
if (isInicioEvolution && !hasHistory) {
  destroyPatrimonySparkline(ctx);
  setInicioEvolutionEmpty(true);
  return;
}
```

### Defeito 3 — `aria-hidden` e `aria-expanded` podiam contradizer o estado visual

**Antes:** `setInicioEvolutionEmpty(false)` escrevia `aria-hidden` incorretamente; `renderBalances()` e `togglePatrimonySparkline()` sobrescreviam os atributos sem considerar `is-empty`.

**Depois:** todos os pontos de escrita derivam de `isEmpty` e `patrimonySparkVisible`:
- `aria-hidden = isEmpty || !patrimonySparkVisible`;
- `aria-expanded = patrimonySparkVisible && !isEmpty`;
- `aria-label` acompanha `aria-expanded`.

## 4. Arquivos alterados

| Arquivo | Justificativa |
|---|---|
| `js/18-render-core.js` | Correções de estado vazio, limpeza da apresentação e sincronização ARIA. |
| `tmp-c13/c6-9/cdp-c9.mjs` | Script CDP reproduzível com teclado real. |
| `tmp-c13/c6-9/c9-resultados.json` | Snapshots completos antes/depois de cada interação. |
| `tmp-c13/c6-9/prints/c9-sem-historico.png` | Evidência visual do estado vazio. |
| `tmp-c13/c6-9/prints/c9-recuperado.png` | Evidência visual da recuperação com dados. |
| `tmp-c13/c6-9/RELATORIO-C6-INICIO-09.md` | Este relatório. |

Nenhum arquivo de teste E2E, HTML, CSS ou outro módulo foi alterado.

## 5. Evidências

- `c9-resultados.json` contém snapshots com `active`, `focus`, `ctrl`, `box`, `canvas`, `dataText`, `empty`, `select`, preferências, `scrollY`, contador de toggles e estado dos dois gráficos.
- Sequência de foco registrada: controle → seletor → botão de orçamentos.
- `outline` does control after Tab: `rgb(95, 122, 67) solid 3px`.
- Erros de console: **0**.
- Screenshots em `tmp-c13/c6-9/prints/`.

### 5.1 Correções de evidências após auditoria independente

A auditoria independente apontou duas inconsistências no script/relatório original. O JSON anterior foi preservado como `tmp-c13/c6-9/c9-resultados-v1.json` para rastreabilidade.

| Item | Situação anterior | Correção | Resultado |
|---|---|---|---|
| C09-01 | O script media `outline` do controle, mas a primeira sequência de Tab havia parado em outro `.balance-symbol`; registrou `outline-style: none` e o relatório afirmava 3 px. | O laço agora exige `focus.activeIsControl`; o `getComputedStyle` é lido do `document.activeElement`; foram registrados `:focus-visible`, estilo, largura, cor e offset. | Reexecutado: `activeIsControl=true`, `:focus-visible=true`, `outline=solid 2px`, `outline-offset=3px`. **PASS**. |
| C09-07 | O foco permaneceu em `#inicioPeriodSelect` após C09-06; `toggleCount=0` não comprovou estabilidade. | Shift+Tab real até o controle; confirmação de `document.activeElement`; contador zerado depois; 6 teclas reais com snapshot por transição. | Reexecutado: 6 transições, contagens 1–6, estados alternados, gráfico destruído/recriado. **PASS**. |

Nenhuma alteração de produção foi necessária para essas duas correções: o indicador de foco já existia (`solid 2px`) e o controle já respondia corretamente; apenas a captura da evidência estava errada.

Classificação dos testes:
- **Executados e aprovados:** C09-01, C09-02, C09-03, C09-04, C09-05, C09-06 (automático), C09-07.
- **Executados e falharam na primeira versão:** C09-01 e C09-07 por erro do script de medição; corrigidos e repetidos.
- **Bloqueados:** anúncio real com leitor de tela.
- **Não executados:** C.O.D.E., Smoke completa, sessão QA real.

## 6. Limitações

- Ausência de credenciais QA reais: dados foram injetados em memória; `__inicioSparkForcedVisible` e `dashFilters` foram usados apenas como estado de teste.
- Leitor de tela real não executado: presença e conteúdo de `aria-live` foram validados automaticamente, mas o anúncio perceptível permanece **BLOCKED** para teste humano.
- Playwright local: BLOCKED (`Unsupported platform: android`); C.O.D.E. e Smoke não executados por restrição explícita.
- O readiness (`currentUser`/`firstLoadDone`) foi simulado para exercitar os mesmos caminhos da aplicação autenticada.

## 7. Validações estáticas

| Comando | Resultado |
|---|---|
| `node --check tmp-c13/c6-9/cdp-c9.mjs` | PASS |
| `node --check js/18-render-core.js` | PASS |
| `git diff --check` | PASS |
| CDP real (teclado + ARIA + gráfico) | PASS nos cenários 01–07, exceto leitor de tela real |

## 8. Parecer final

**PASS COM RESSALVAS.** Os sete cenários foram executados com evidência reproduzível; os três defeitos encontrados foram corrigidos no escopo da C6-INICIO-09. Permanece pendente apenas a verificação de anúncio com leitor de tela real e a execução futura em CI/PC com sessão QA.

**Não foi feito commit ou push.**
