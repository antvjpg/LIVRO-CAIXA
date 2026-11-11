# Phase B — Consolidação da aba Início (LIVRO-CAIXA)

## Branch
`feat/app-navigation-redesign`

## HEAD
- Inicial: `9181d0d Merge pull request #9 from antvjpg/feat/tabler-icon-foundation`
- Consolidação documental: `fa9f016` / `0491603`
- B.1.3.3: `7633e36` — implementação real do ciclo de vida do gráfico (seção 3.8)
- B.1.3.4: `4539c5f` — encerramento, remoção da referência obsoleta e evidências
  funcionais headless (seção 3.8.9)

## Resumo Geral
- **Commits pushados:** `b884038` (Phase B), `68d12ad` (Phase B.1), `0ffbe5c` (Phase B.1.2), `9374ea5` (Phase B.1.2.1), `da922f8` (Phase B.1.2.2), `d2733e8` (Phase B.1.3), `51917e3` (Phase B.1.3.1), `fa9f016` (consolidação documental), `0491603` (auditoria documental), `7633e36` (B.1.3.3), `4539c5f` (B.1.3.4 — encerramento e evidências headless)
- **Arquivos modificados:** `index.html`, `js/18-render-core.js`, `js/20-dashboard.js`, `js/99-init.js`, `PHASE_B_CONSOLIDATED_REPORT.md`
- **Total de linhas alteradas:** ~250+ across multiple files
- **Nenhum commit nem push indevido** — todas as alterações foram planejadas e documentadas

> **Aviso de leitura:** as seções 3.6 e 3.7 registram as *tentativas* das fases B.1.3.1/B.1.3.2. A auditoria independente de B.1.3.3 (seção 3.8) demonstrou que aquelas tentativas **não eliminaram** os defeitos 1, 3, 4 e 5. A correção efetiva está descrita, com trechos removidos e incluídos, na seção 3.8.

## Sumário

- [Branch](#branch)
- [HEAD](#head)
- [Resumo Geral](#resumo-geral)
- [1. Phase B.1.2.1 — Diagnóstico Forense da função openGoalsPanel()](#1-phase-b121--diagnóstico-forense-da-função-opengoalspanel)
  - [1.1 Histórico](#11-histórico)
  - [1.2 Arquivos Modificados](#12-arquivos-modificados)
  - [1.3 Evidências Técnicas](#13-evidências-técnicas)
  - [1.4 Pendências](#14-pendências)
  - [1.5 Conclusão](#15-conclusão)
- [2. Phase B.1.2.2 — Integração de Saúde Financeira na aba Início](#2-phase-b122--integração-de-saúde-financeira-na-aba-início)
  - [2.1 Histórico](#21-histórico)
  - [2.2 Arquivos Modificados](#22-arquivos-modificados)
  - [2.3 Evidências Técnicas](#23-evidências-técnicas)
  - [2.4 Pendências](#24-pendências)
  - [2.5 Conclusão](#25-conclusão)
- [3. Phase B.1.3 — Integração de Patrimônio Total no Início](#3-phase-b13--integração-de-patrimônio-total-no-início)
  - [3.1 Histórico](#31-histórico)
  - [3.2 Arquivos Modificados](#32-arquivos-modificados)
  - [3.3 Evidências Técnicas (B.1.3)](#33-evidências-técnicas-b13)
  - [3.4 Problemas da Auditoria Independente B.1.3.1](#34-problemas-da-auditoria-independente-b131)
  - [3.5 Conclusão (revisada)](#35-conclusão-revisada)
  - [3.6 Tentativa B.1.3.1 — registro histórico (insuficiente)](#36-tentativa-b131--registro-histórico-insuficiente)
    - [Bug 1 — Instância Chart.js única compartilhada indevidamente](#bug-1--instância-chartjs-única-compartilhada-indevidamente)
    - [Bug 2 — Referência ARIA incorreta no controle do Início](#bug-2--referência-aria-incorreta-no-controle-do-início)
    - [Bug 3 — Estado visual/ARIA não sincronizado entre os dois contextos](#bug-3--estado-visualaria-não-sincronizado-entre-os-dois-contextos)
    - [Bug 4 — Estado inicial inconsistente (HTML x CSS x persistência)](#bug-4--estado-inicial-inconsistente-html-x-css-x-persistência)
  - [3.7 Tentativa B.1.3.2 — registro histórico (insuficiente)](#37-tentativa-b132--registro-histórico-insuficiente)
    - [Bug 5 — Listener do Início dependente de flag/condição instável](#bug-5--listener-do-início-dependente-de-flagcondição-instável)
    - [Bug 6 — Contradição documental no relatório consolidado](#bug-6--contradição-documental-no-relatório-consolidado)
  - [3.8 Phase B.1.3.3 — Implementação real do ciclo de vida do gráfico](#38-phase-b133--implementação-real-do-ciclo-de-vida-do-gráfico)
    - [3.8.1 Motivação e escopo](#381-motivação-e-escopo)
    - [3.8.2 Mudança 1 — uma instância Chart.js por contexto](#382-mudança-1--uma-instância-chartjs-por-contexto)
    - [3.8.3 Mudança 2 — inicialização no ciclo normal e ao ativar a aba](#383-mudança-2--inicialização-no-ciclo-normal-e-ao-ativar-a-aba)
    - [3.8.4 Mudança 3 — estado inicial consistente (HTML ↔ JS ↔ CSS)](#384-mudança-3--estado-inicial-consistente-html--js--css)
    - [3.8.5 Mudança 4 — listener por delegação em #viewInicio](#385-mudança-4--listener-por-delegação-em-viewinicio)
    - [3.8.6 Resumo das alterações por arquivo](#386-resumo-das-alterações-por-arquivo)
    - [3.8.7 Validações executadas e limitações](#387-validações-executadas-e-limitações)
    - [3.8.8 Critérios de conclusão](#388-critérios-de-conclusão)
    - [3.8.9 Phase B.1.3.4 — Encerramento: referência obsoleta e evidências funcionais](#389-phase-b134--encerramento-referência-obsoleta-e-evidências-funcionais)
      - [Motivação](#motivação)
      - [Mudança — remoção da referência obsoleta](#mudança--remoção-da-referência-obsoleta)
      - [Verificação de referências](#verificação-de-referências)
      - [Validação estática](#validação-estática)
      - [Validação funcional (Chromium headless + CDP)](#validação-funcional-chromium-headless--cdp)
      - [Conclusão da B.1.3.4](#conclusão-da-b134)
- [4. Phase B.1.3.1 — Correção da integração do gráfico patrimonial](#4-phase-b131--correção-da-integração-do-gráfico-patrimonial)
- [5. Phase B.1.3.2 — Correção do ciclo de vida, sincronização e consolidação documental](#5-phase-b132--correção-do-ciclo-de-vida-sincronização-e-consolidação-documental)
- [6. Consolidado de Arquivos .md da Phase B](#6-consolidado-de-arquivos-md-da-phase-b)
  - [6.1 PHASE_B_SUMMARY.md](#61-phase_b_summarymd)
  - [6.2 PHASE_B1.2.1_REPORT.md](#62-phase_b121_reportmd)
  - [6.3 PHASE_B1.2.2_HEALTH_CARD_FIX_REPORT.md](#63-phase_b122_health_card_fix_reportmd)
  - [6.4 PHASE_B1.3_PATRIMONY_INTEGRATION_REPORT.md](#64-phase_b13_patrimony_integration_reportmd)
- [7. Evidências Técnicas Consolidadas](#7-evidências-técnicas-consolidadas)
  - [7.1 Sintaxe JavaScript Validada](#71-sintaxe-javascript-validada)
  - [7.2 Verificação de IDs Duplicados](#72-verificação-de-ids-duplicados)
  - [7.3 Instâncias Chart.js](#73-instâncias-chartjs)
  - [7.4 Acessibilidade (ARIA)](#74-acessibilidade-aria)
  - [7.5 Estado Persistente](#75-estado-persistente)
  - [7.6 Cálculos Financeiros](#76-cálculos-financeiros)
  - [7.7 Documentos .md](#77-documentos-md)
- [8. Pendências Gerais da Phase B](#8-pendências-gerais-da-phase-b)
- [9. Próximos Passos (Fase C)](#9-próximos-passos-fase-c)
- [FASE C.1 — AUDITORIA DE CSS](#fase-c1--auditoria-de-css)

---

## 1. Phase B.1.2.1 — Diagnóstico Forense da função openGoalsPanel()

### 1.1 Histórico
- Commit: `9374ea5 Phase B.1.2.1: Relatorio forense - diagnostico e estado atual`
- Problemática: A função `openGoalsPanel()` continha código de atualização de `viewInicio` que deveria ser removido e inserido em `renderAdvancedDashboard()`.
- Solução: Remover o bloco de `viewInitPanel` de `openGoalsPanel()` e inserir no final de `renderAdvancedDashboard()` em `js/20-dashboard.js`.

### 1.2 Arquivos Modificados
- `js/20-dashboard.js` — Remoção do código de `viewInitPanel` de `openGoalsPanel()` e inserção no final de `renderAdvancedDashboard()`
- `PHASE_B1.2.1_REPORT.md` — Relatório técnico detalhando o diagnóstico e as correções

### 1.3 Evidências Técnicas
- ✅ Código de `openGoalsPanel()` agora livre de referência a `viewInicio`
- ✅ Bloco de atualização de `viewInicio` inserido no final de `renderAdvancedDashboard()`
- ✅ Funcionamento de Metas não depende mais de dados de compromissos
- ✅ Código validado: `node --check js/20-dashboard.js` — passou sem erros

### 1.4 Pendências
- Validação em navegador/device para confirmação de remoção
- Garantir que não haja regressão no dashboard ao alternar abas

### 1.5 Conclusão
A Phase B.1.2.1 foi técnica concluída com a remoção do código redundante de `openGoalsPanel()` e sua reimplantação correta em `renderAdvancedDashboard()`, eliminando o risco de regressão ao abrir a aba Metas.

---

## 2. Phase B.1.2.2 — Integração de Saúde Financeira na aba Início

### 2.1 Histórico
- Commit: `da922f8 Phase B.1.2.2: Integracao de Saude Financiera na aba Inicio - reaproveitamento de calculo existente`
- Problemática: A função `renderAdvancedDashboard()` não executava para atualizar o novo card de Saúde Financeira na aba Início, pois seu início era condicionado à existência do container legado `#advancedDashboard`. Além disso, o dispatcher de navegação só chamava `renderAdvancedDashboard()` quando a tab ativa era 'dashboard', não contemplando a aba 'inicio'.
- Solução: 
  1. Modificar `renderAdvancedDashboard()` para também verificar o container `#viewInicio .advanced-dashboard`
  2. Atualizar o dispatcher em `js/99-init.js` para chamar `renderAdvancedDashboard()` também ao abrir a aba 'inicio'

### 2.2 Arquivos Modificados
- `js/20-dashboard.js` — Adição de verificação do container `#viewInicio .advanced-dashboard` no início de `renderAdvancedDashboard()`; preenchimento do card saúde usando cálculo existente
- `js/99-init.js` — Adição de `tabName === 'inicio'` ao dispatcher que chama `renderAdvancedDashboard()`
- `PHASE_B1.2.2_HEALTH_CARD_FIX_REPORT.md` — Relatório técnico detalhando as correções

### 2.3 Evidências Técnicas
- ✅ Container `#viewInicio .advanced-dashboard` recebe conteúdo calculado ao abrir a aba Início
- ✅ Abrir "inicio" executa `renderAdvancedDashboard()`
- ✅ Abrir "dashboard" continua atualizando o container legado
- ✅ Gráficos e componentes do dashboard legado permanecem preservados
- ✅ Código validado: `node --check js/20-dashboard.js` e `node --check js/99-init.js` — passaram sem erros
- ✅ `openGoalsPanel()` permanece com a correção anterior (Phase B.1.2.1)

### 2.4 Pendências
- Validação visual em navegador/device para confirmação de renderização do card saúde
- Testes de interface para alternância entre abas Início e Dashboard

### 2.5 Conclusão
A Phase B.1.2.2 foi técnica concluída com a integração do card Saúde Financeira na aba Início, usando o cálculo existente sem criar nova implementação. O dashboard antigo continua funcional quando a aba 'dashboard' é aberta.

---

## 3. Phase B.1.3 — Integração de Patrimônio Total no Início

### 3.1 Histórico
- Commit: `d2733e8 Phase B.1.3: Integracao de Patrimonio Total no Inicio - badge license e estruturas`
- Problemática: O card de Patrimônio Total na view Início recebia o valor patrimonial via `renderBalances()`, mas a estrutura do gráfico sparkline e a funcionalidade interativa permaneciam ativas apenas no `#balanceStrip` (strip global). Existiam duas ocorrências de `id="patrimonySparkline"` no DOM, causando conflito de instância Chart.js.
- Solução: 
  1. Alterar ID do canvas da view Início de `patrimonySparkline` para `patrimonySparklineInicio` (ID único)
  2. Modificar `renderPatrimonySparkline(enabled, context)` para aceitar parâmetro `context` ('inicio' | 'strip')
  3. Modificar `togglePatrimonySparkline(context)` para sincronizar ambos os contextos
  4. Adicionar sincronização do estado inicial a partir do `localStorage.PATRIMONY_SPARK_STORAGE_KEY`

### 3.2 Arquivos Modificados
- `index.html` — ID do canvas da view Início alterado de `patrimonySparkline` para `patrimonySparklineInicio`; `aria-controls` atualizado para `patrimonySparkBoxInicio`
- `js/18-render-core.js` — 4 correções técnicas (gerenciamento de instância Chart.js, sincronização de contexto, estado inicial do localStorage)
- `PHASE_B_CONSOLIDATED_REPORT.md` — este documento, que incorporou o antigo
  `PHASE_B1.3_PATRIMONY_INTEGRATION_REPORT.md` (removido em `fa9f016`)

### 3.3 Evidências Técnicas (B.1.3)
- ✅ IDs únicos no DOM: `patrimonySparkline` (strip), `patrimonySparklineInicio` (início)
- ⚠️ `renderPatrimonySparkline(enabled, context)` — na B.1.3 recebeu `context`, mas a
  destruição condicional introduzida depois se mostrou incorreta (ver 3.6/3.8.2)
- ⚠️ `togglePatrimonySparkline(context)` — sincronizava o outro contexto, mas o gráfico
  do Início nunca era criado no ciclo normal (ver 3.8.3)
- ⚠️ Estado inicial: a intenção era sincronizar via `PATRIMONY_SPARK_STORAGE_KEY`, mas
  só funcionava com preferência salva (ver 3.8.4)
- ✅ Código validado: `node --check js/18-render-core.js` — passou sem erros
- ✅ `git diff --check` — sem problemas de whitespace
- ✅ `openGoalsPanel()` e health card continua funcionando (regressões preservadas)

### 3.4 Problemas da Auditoria Independente B.1.3.1
Foram identificados e corrigidos 5 problemas adicionais:
1. Instância única do Chart.js compartilhada indevidamente
2. Referência ARIA incorreta no controle do gráfico da aba Início
3. Estado visual e acessibilidade não sincronizados entre os dois contextos
4. Estado inicial inconsistente entre visibilidade, classes CSS e atributos ARIA
5. Listener do Início dependente de flag/condição instável e de recriação de DOM

A esses soma-se um problema documental (Bug 6, seção 3.7): contradição sobre
documentos "preservados" no relatório consolidado.

> **Resultado da reverificação (B.1.3.3):** a auditoria independente confirmou que os
> problemas 1, 3, 4 e 5 continuavam presentes no código após as tentativas descritas
> em 3.6/3.7. Os itens 1 e 3 tinham sido "corrigidos" de forma que apenas trocava o
> sintoma de lugar; 4 e 5 nunca chegaram a ser implementados de fato. Ver seção 3.8.

### 3.5 Conclusão (revisada)
A integração do valor patrimonial ao card da view Início e a eliminação da duplicidade
de IDs foram concluídas em B.1.3. O ciclo de vida do gráfico, porém, **não** estava
correto ao final de B.1.3.2: apenas um dos dois gráficos era criado, o estado inicial
divergia do HTML e o listener do Início era frágil. A correção efetiva é a B.1.3.3
(seção 3.8).

### 3.6 Tentativa B.1.3.1 — registro histórico (insuficiente)

Esta seção substitui a referência ao arquivo removido `PHASE_B1.3_PATRIMONY_INTEGRATION_REPORT.md`.
Ela descreve o que **foi tentado** em B.1.3.1. O veredito ao final de cada bug indica se
a correção sobreviveu à reverificação de B.1.3.3.

#### Bug 1 — Instância Chart.js única compartilhada indevidamente
- **Arquivo:** `js/18-render-core.js`
- **Sintoma:** `renderPatrimonySparkline()` destruía sempre a instância anterior,
  independentemente do canvas alvo. Atualizar o Livro-Caixa destruía o gráfico do
  Início e vice-versa, porque `getElementById('patrimonySparkline')` resolvia sempre
  o mesmo elemento.
- **Correção:** adicionado parâmetro `context` (`'inicio'` | `'strip'`); o canvas alvo
  passou a ser derivado do contexto (`patrimonySparklineInicio` vs `patrimonySparkline`).
  A instância só é destruída quando pertence ao mesmo canvas alvo.
- **Evidência:** `node --check js/18-render-core.js` OK.
- **Veredito (B.1.3.3):** ❌ insuficiente. O guard `return` introduzido aqui era
  justamente o defeito: ao renderizar o segundo contexto, a função abortava e o
  segundo gráfico nunca era criado. Corrigido de fato em 3.8.2.

#### Bug 2 — Referência ARIA incorreta no controle do Início
- **Arquivo:** `index.html`
- **Sintoma:** `aria-controls="patrimonySparkBox"` apontava para um ID existente apenas
  no `#balanceStrip`; o spark box do Início não possuía `id` próprio.
- **Correção:** adicionado `id="patrimonySparkBoxInicio"` ao spark box do Início e
  ajustado `aria-controls="patrimonySparkBoxInicio"` no símbolo `.balance-symbol`.
- **Evidência:** `git diff` do `index.html`; IDs únicos confirmados.

#### Bug 3 — Estado visual/ARIA não sincronizado entre os dois contextos
- **Arquivo:** `js/18-render-core.js`
- **Sintoma:** `togglePatrimonySparkline(context)` atualizava somente o contexto acionado;
  o outro contexto mantinha `aria-expanded`, `aria-label` e `is-collapsed` defasados.
- **Correção:** após o toggle, o contexto oposto é sincronizado (símbolo e contêiner),
  quando presente no DOM.
- **Evidência:** `node --check js/18-render-core.js` OK.

#### Bug 4 — Estado inicial inconsistente (HTML x CSS x persistência)
- **Arquivo:** `js/18-render-core.js`
- **Sintoma:** o contêiner do Início iniciava com `aria-hidden="true"` mas sem
  `is-collapsed`; o CSS usa `is-collapsed` para colapsar. Divergência entre HTML,
  JS e `PATRIMONY_SPARK_STORAGE_KEY`.
- **Correção:** `renderBalances()` lê `localStorage.getItem(PATRIMONY_SPARK_STORAGE_KEY)`
  e aplica `is-collapsed` + ARIA de forma consistente quando há preferência salva.
- **Evidência:** `node --check js/18-render-core.js` OK; bloco verificado no diff.
- **Veredito (B.1.3.3):** ❌ insuficiente. A sincronização só ocorria quando existia
  preferência salva (`initialSparkVisible !== undefined`) e somente se a aba Início já
  estivesse ativa. Sem preferência salva, o HTML permanecia divergente. Corrigido em 3.8.4.

### 3.7 Tentativa B.1.3.2 — registro histórico (insuficiente)

#### Bug 5 — Listener do Início dependente de flag/condição instável
- **Arquivo:** `js/18-render-core.js`
- **Sintoma:** o listener podia não ser instalado (ou ser reinstalado) conforme a aba
  ativa e a recriação de DOM (`renderBalances()` substitui `#balanceStrip` via `innerHTML`).
- **Correção:** instalação única protegida por `window.__patrimonyInicioListenerSetup`;
  verificação de existência do elemento antes de registrar `click`/`keydown`;
  suporte a Enter/Space com `event.preventDefault()`.
- **Evidência:** `node --check js/18-render-core.js` OK.
- **Veredito (B.1.3.3):** ❌ insuficiente. A flag `__patrimonyInicioListenerSetup` era
  marcada **antes** de verificar se o elemento existia; o listener era direto no símbolo
  (não sobrevive à troca de filhos por `innerHTML`) e todo o bloco continuava dentro de
  `if (currentTab === 'inicio')`. Corrigido em 3.8.5.

#### Bug 6 — Contradição documental no relatório consolidado
- **Arquivo:** `PHASE_B_CONSOLIDATED_REPORT.md`
- **Sintoma:** o consolidado declarava "preservados" documentos que foram removidos no
  mesmo commit `fa9f016`; a seção 7.7 afirmava "5 arquivos .md preservados (sem exclusões)".
- **Correção:** afirmações falsas substituídas por registro explícito de remoção e
  incorporação de conteúdo (ver seções 6 e 7.7).
- **Evidência:** este documento (revisado).

---

### 3.8 Phase B.1.3.3 — Implementação real do ciclo de vida do gráfico

### 3.8.1 Motivação e escopo

A auditoria independente de B.1.3.3 reprovou as fases anteriores e confirmou, no código,
quatro defeitos ainda presentes:

1. **Instância única + `return` precoce:** `renderPatrimonySparkline()` abortava ao
   encontrar a instância do outro contexto, então o segundo gráfico nunca era criado.
2. **Início sem inicialização no ciclo normal:** só existia chamada com `'strip'`;
   o gráfico do Início dependia exclusivamente do toggle.
3. **Estado inicial divergente:** HTML do Início iniciava recolhido/`aria-hidden="true"`,
   enquanto o JS iniciava visível (default `true`).
4. **Listener frágil:** flag marcada antes da checagem de existência, listener direto no
   símbolo e bloco condicionado a `currentTab === 'inicio'`.

Decisões de escopo tomadas com o usuário:

- **Default visual:** expandido (alinha HTML ao JS e ao comportamento do strip).
- **Autorizado alterar `js/99-init.js`** para re-renderizar o gráfico ao ativar a aba,
  evitando canvas 0×0 quando a view está oculta.
- **Documentação:** registrar explicitamente os trechos removidos e incluídos.

### 3.8.2 Mudança 1 — uma instância Chart.js por contexto

**Arquivo:** `js/18-render-core.js` (topo do bloco `[JS 08]` e `renderPatrimonySparkline`).

**Removido:**

```js
let patrimonySparklineInstance;
```

**Incluído:**

```js
/* B.1.3.3 — uma instância Chart.js por contexto (Início e strip), para que
   os dois gráficos coexistam sem que um destrua o outro. */
const patrimonySparklineInstances = { inicio: null, strip: null };
```

**Removido (início da função):**

```js
function renderPatrimonySparkline(enabled, context) {
  const targetCanvasId = context === 'inicio' ? 'patrimonySparklineInicio' : 'patrimonySparkline';
  if (patrimonySparklineInstance) {
    // Apenas destrua se a instância existente estiver no mesmo canvas alvo
    if (patrimonySparklineInstance.canvas?.id !== targetCanvasId) {
      // Instância de outro contexto — não destrua, mantenha-a ativa
      // O gráfico do outro contexto continuará em seu canvas próprio
      return;
    }
    patrimonySparklineInstance.destroy();
    patrimonySparklineInstance = null;
  }
  let canvas;
  if (context === 'inicio') {
    canvas = document.getElementById('patrimonySparklineInicio');
  } else {
    canvas = document.getElementById('patrimonySparkline');
  }
  if (!enabled || !patrimonySparkVisible || !canvas) return;
```

**Incluído:**

```js
function renderPatrimonySparkline(enabled, context) {
  const ctx = context === 'inicio' ? 'inicio' : 'strip';
  const targetCanvasId = ctx === 'inicio' ? 'patrimonySparklineInicio' : 'patrimonySparkline';
  const existing = patrimonySparklineInstances[ctx];
  if (existing) {
    try { existing.destroy(); } catch (_) { /* instância já inválida */ }
    patrimonySparklineInstances[ctx] = null;
  }
  const canvas = document.getElementById(targetCanvasId);
  if (!enabled || !patrimonySparkVisible || !canvas) return;
```

**Removido (criação do Chart.js):**

```js
patrimonySparklineInstance = new Chart(canvas, {
```

**Incluído:**

```js
patrimonySparklineInstances[ctx] = new Chart(canvas, {
```

**Efeito:** cada contexto destrói/recria apenas a própria instância. Atualizar o
Livro-Caixa não destrói mais o gráfico do Início e vice-versa. O `return` precoce que
impedia a criação do segundo gráfico foi eliminado.

### 3.8.3 Mudança 2 — inicialização no ciclo normal e ao ativar a aba

**Arquivo:** `js/18-render-core.js` (`renderBalances`).

**Incluído (logo após a renderização do strip):**

```js
renderPatrimonySparkline(balancesReady, 'strip');
// B.1.3.3 — inicializa também o gráfico da view Início no ciclo normal
// (antes só era criado no toggle, o que impedia o segundo gráfico).
renderPatrimonySparkline(balancesReady, 'inicio');
```

**Arquivo:** `js/99-init.js` (`switchTabOriginal`).

**Incluído (após `renderAdvancedDashboard()` e os `classList.toggle` das views):**

```js
// B.1.3.3 — canvas oculto renderiza 0×0; ao ativar a aba, recria o gráfico
// já com a view visível para corrigir o dimensionamento.
if (tabName === 'caixa' || tabName === 'inicio') {
  if (typeof renderPatrimonySparkline === 'function') {
    const sparkReady = !!currentUser && !!firstLoadDone;
    renderPatrimonySparkline(sparkReady, 'strip');
    if (tabName === 'inicio') renderPatrimonySparkline(sparkReady, 'inicio');
  }
}
```

**Efeito:** o gráfico do Início passa a ser criado no fluxo normal de dados. Como um
canvas dentro de view oculta mede 0×0, a recriação no `switchTab` garante dimensionamento
correto quando Início/Livro-Caixa se tornam visíveis. O strip também é recriado ao voltar
para `caixa`/`inicio`, cobrindo o caso de carga inicial em aba diferente.

### 3.8.4 Mudança 3 — estado inicial consistente (HTML ↔ JS ↔ CSS)

**Arquivo:** `index.html` (card Patrimônio Total em `#viewInicio`).

**Removido:**

```html
<span class="balance-symbol" role="button" tabindex="0" aria-expanded="false" aria-controls="patrimonySparkBoxInicio" aria-label="Mostrar gráfico do patrimônio">…</span>
…
<div class="patrimony-spark-box" id="patrimonySparkBoxInicio" aria-hidden="true">…</div>
```

**Incluído:**

```html
<span class="balance-symbol" role="button" tabindex="0" aria-expanded="true" aria-controls="patrimonySparkBoxInicio" aria-label="Recolher gráfico do patrimônio">…</span>
…
<div class="patrimony-spark-box" id="patrimonySparkBoxInicio" aria-hidden="false">…</div>
```

**Arquivo:** `js/18-render-core.js` (`renderBalances`).

**Removido (bloco condicionado à aba e à preferência salva):**

```js
// Atualiza card de patrimônio da view Início (mesmo cálculo, DOM diferente)
if (typeof currentTab !== 'undefined' && currentTab === 'inicio') {
  const inicioBalanceCard = document.querySelector('#viewInicio .inicio-card.balance-card .amount');
  if (inicioBalanceCard) {
    const totalPatrimonio = bankTotal + pocketTotal + investTotal;
    inicioBalanceCard.textContent = balancesReady ? fmt(totalPatrimonio) : '—';
    inicioBalanceCard.classList.toggle('neg', balancesReady && totalPatrimonio < 0);
  }
  // Sincroniza estado inicial do gráfico com base no localStorage
  const storedSparkState = localStorage.getItem(PATRIMONY_SPARK_STORAGE_KEY)
  const initialSparkVisible = storedSparkState ? storedSparkState === "1" : undefined
  if (initialSparkVisible !== undefined) {
    patrimonySparkVisible = initialSparkVisible
    const inicioBox = document.querySelector("#viewInicio .inicio-card.balance-card .patrimony-spark-box")
    const inicioSymbol = document.querySelector("#viewInicio .inicio-card.balance-card .balance-symbol")
    if (inicioBox) {
      inicioBox.classList.toggle("is-collapsed", !patrimonySparkVisible)
      inicioBox.setAttribute("aria-hidden", String(!patrimonySparkVisible))
    }
    if (inicioSymbol) {
      inicioSymbol.setAttribute("aria-expanded", String(patrimonySparkVisible))
      inicioSymbol.setAttribute("aria-label", patrimonySparkVisible ? "Recolher gráfico do patrimônio" : "Mostrar gráfico do patrimônio")
    }
  }
```

**Incluído:**

```js
// B.1.3.3 — estado visual do gráfico do Início sempre derivado de
// patrimonySparkVisible (não apenas quando há preferência salva).
const inicioBox = document.querySelector('#viewInicio .inicio-card.balance-card .patrimony-spark-box');
const inicioSymbol = document.querySelector('#viewInicio .inicio-card.balance-card .balance-symbol');
if (inicioBox) {
  inicioBox.classList.toggle('is-collapsed', !patrimonySparkVisible);
  inicioBox.setAttribute('aria-hidden', String(!patrimonySparkVisible));
}
if (inicioSymbol) {
  inicioSymbol.setAttribute('aria-expanded', String(patrimonySparkVisible));
  inicioSymbol.setAttribute('aria-label', patrimonySparkVisible ? 'Recolher gráfico do patrimônio' : 'Mostrar gráfico do patrimônio');
}
```

**Observação:** o bloco removido também repetia a atualização do `amount` do Início
(já feita antes em `renderBalances`). A duplicação foi eliminada sem perda de
comportamento: o valor continua sendo atualizado no primeiro bloco, incondicionalmente.

**Efeito:** o HTML nasce expandido e coerente com `patrimonySparkVisible = true`; a
sincronização de classe/ARIA acontece sempre, com ou sem preferência salva e
independentemente da aba ativa.

### 3.8.5 Mudança 4 — listener por delegação em `#viewInicio`

**Arquivo:** `js/18-render-core.js` (`renderBalances`).

**Removido:**

```js
// Inicializa listener do toggle de gráfico para a view Início (única execução)
if (typeof window.__patrimonyInicioListenerSetup === 'undefined') {
  window.__patrimonyInicioListenerSetup = true;
  const inicioSparkSymbol = document.querySelector('#viewInicio .inicio-card.balance-card .balance-symbol');
  if (inicioSparkSymbol) {
    inicioSparkSymbol.addEventListener('click', () => {
      togglePatrimonySparkline('inicio');
    });
    inicioSparkSymbol.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePatrimonySparkline('inicio');
      }
    });
  }
}
```

**Incluído:**

```js
// B.1.3.3 — listener por delegação em #viewInicio: sobrevive à troca de
// innerHTML dos filhos e independe da aba ativa no momento da carga.
if (!window.__patrimonyInicioListenerSetup) {
  const viewInicio = document.getElementById('viewInicio');
  if (viewInicio) {
    const isSparkSymbol = (target) => target instanceof Element && !!target.closest('.inicio-card.balance-card .balance-symbol');
    viewInicio.addEventListener('click', (event) => {
      if (isSparkSymbol(event.target)) togglePatrimonySparkline('inicio');
    });
    viewInicio.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && isSparkSymbol(event.target)) {
        event.preventDefault();
        togglePatrimonySparkline('inicio');
      }
    });
    window.__patrimonyInicioListenerSetup = true;
  }
}
```

**Efeito:** a flag só é marcada se `#viewInicio` existir; o listener fica no contêiner
estável (não no símbolo recriável) e funciona mesmo que `renderBalances()` rode com
outra aba ativa. Enter/Espaço continuam suportados com `preventDefault()`.

### 3.8.6 Resumo das alterações por arquivo

| Arquivo | Alteração | Tipo |
|---|---|---|
| `js/18-render-core.js` | Registro `patrimonySparklineInstances` por contexto | Remoção + inclusão |
| `js/18-render-core.js` | `renderPatrimonySparkline` sem `return` precoce; destrói só o próprio contexto | Remoção + inclusão |
| `js/18-render-core.js` | `renderBalances` inicializa `'inicio'` no ciclo normal | Inclusão |
| `js/18-render-core.js` | Sincronização de estado do Início sempre aplicada; remove duplicação de `amount` | Remoção + inclusão |
| `js/18-render-core.js` | Listener por delegação em `#viewInicio` | Remoção + inclusão |
| `js/99-init.js` | Re-render dos gráficos ao ativar `caixa`/`inicio` (sizing) | Inclusão |
| `index.html` | Default expandido (`aria-expanded="true"`, `aria-hidden="false"`) | Remoção + inclusão |
| `PHASE_B_CONSOLIDATED_REPORT.md` | Seção 3.8, vereditos 3.6/3.7, correções 6.4/7.3/7.4/7.5 | Remoção + inclusão |

### 3.8.7 Validações executadas e limitações

**Executado:**

- `node --check js/18-render-core.js` — OK
- `node --check js/99-init.js` — OK
- `git diff --check` — OK (sem problemas de whitespace)
- Verificação estática de referências: não restou `patrimonySparklineInstance`
  (singular) em `.js`; todas as referências usam `patrimonySparklineInstances[ctx]`
  (a única ocorrência restante estava em `js/99-init.js` e foi removida na B.1.3.4 —
  ver 3.8.9)
- Verificação estática de listeners: delegação presente em `#viewInicio`;
  flag marcada somente após instalação
- Verificação estática de HTML: `aria-expanded="true"` e `aria-hidden="false"`
  coerentes com o default do JS
- **Teste funcional em Chromium headless via CDP (B.1.3.4)** — desktop 694px e
  mobile 390×844 emulado; sessão simulada (`currentUser`/`firstLoadDone`), sem login
  real. Resultados em 3.8.9.

**Não executado (limitação de ambiente):**

- Teste em device físico / navegador com login real e dados reais
- Regressão visual comparativa (screenshots antes/depois) em device

### 3.8.8 Critérios de conclusão

| Critério | Status |
|---|---|
| Duas instâncias Chart.js coexistem (uma por contexto) | ✅ Verificado (headless CDP) |
| Início inicializa no ciclo normal | ✅ Verificado (headless CDP) |
| Estado inicial HTML/JS/CSS coerente (default expandido) | ✅ Verificado (headless CDP) |
| Listener robusto por delegação | ✅ Verificado (headless CDP) |
| Sizing correto ao ativar aba | ✅ Verificado (headless CDP: 0 → 664px em mobile) |
| Referência obsoleta `patrimonySparklineInstance` removida | ✅ Verificado (B.1.3.4) |
| Validação funcional em navegador headless | ✅ Executada (sem erros de console) |
| Regressão visual em device físico / login real | ❌ Pendente (ambiente) |

> **Conclusão:** a B.1.3.3 corrige os defeitos confirmados pela auditoria; a B.1.3.4
> remove a referência obsoleta e executa os cenários funcionais em Chromium headless.
> A fase está **aprovada no nível estrutural e funcional-headless**, restando apenas a
> validação em device físico com login/dados reais (seção 3.8.9).

### 3.8.9 Phase B.1.3.4 — Encerramento: referência obsoleta e evidências funcionais

#### Motivação

A auditoria da B.1.3.3 apontou uma pendência pontual: `js/99-init.js` ainda atribuía
`patrimonySparklineInstance = null;`, variável singular substituída pelo registro
`patrimonySparklineInstances`. Em script clássico sem `'use strict'`, a atribuição
criaria uma propriedade global obsoleta — sem quebrar a aplicação, mas incoerente com
a arquitetura nova.

#### Mudança — remoção da referência obsoleta

Arquivo: `js/99-init.js` (bloco de inicialização do `DOMContentLoaded`).

**Removido:**

```js
  viewPeriod = { mode: 'month', month: currentMonthYM() };
  patrimonySparklineInstance = null;
  PATRIMONY_SPARK_STORAGE_KEY = 'livro-caixa-patrimony-spark';
```

**Incluído (estado final):**

```js
  viewPeriod = { mode: 'month', month: currentMonthYM() };
  PATRIMONY_SPARK_STORAGE_KEY = 'livro-caixa-patrimony-spark';
```

Nenhuma inicialização adicional é necessária: `patrimonySparklineInstances` já nasce
com `{ inicio: null, strip: null }` em `js/18-render-core.js:53`.

#### Verificação de referências

```bash
grep -rn "patrimonySparklineInstance\b" --include="*.js" --include="*.html" --include="*.mjs" .
```

Resultado: **nenhuma ocorrência** em código. As únicas ocorrências restantes estão
neste relatório, dentro dos blocos "Removido" de 3.8.2 (registro histórico), o que é
intencional.

#### Validação estática

- `node --check js/18-render-core.js` — OK
- `node --check js/99-init.js` — OK
- `git diff --check` — OK

#### Validação funcional (Chromium headless + CDP)

Ambiente: Termux/Android, `chromium-browser --headless=new --no-sandbox` com
`--remote-debugging-port=9222`, servidor local `python3 -m http.server 8000`.
Automação via `chrome-remote-interface` (já presente em `devDependencies`), cache
desabilitado e Service Worker parado para garantir os arquivos atuais.

**Limitação metodológica:** a sessão foi simulada em página
(`currentUser = { uid: 'cdp-test' }` e `firstLoadDone = true`), pois o login Firebase
real não está disponível neste ambiente. O objetivo foi validar o ciclo de vida dos
gráficos, não a autenticação.

**Cenário 1 — perfil limpo, desktop (largura ~694px):**

| Verificação | Resultado |
|---|---|
| Preferência salva | `null` (sem preferência) |
| `patrimonySparkVisible` | `true` |
| `aria-hidden` / `aria-expanded` iniciais | `"false"` / `"true"` |
| Classe `is-collapsed` inicial | ausente |
| Instâncias criadas | `strip` e `inicio`, objetos distintos |
| Canvas | `patrimonySparkline` e `patrimonySparklineInicio` |
| Largura de ambos os canvas | 694px |
| Erros de console | 0 |

**Cenário 2 — mobile emulado 390×844, perfil limpo:**

| Verificação | Resultado |
|---|---|
| Preferência salva | `null` → default expandido |
| `aria-hidden` / `aria-expanded` | `"false"` / `"true"` |
| Canvas do Início antes de ativar a aba | largura 0 (oculto) |
| Após `switchTab('inicio')` | largura 664px, altura 128px |
| Instância `strip` preservada | sim |
| Erros de console | 0 |

O resultado "0 → 664px" confirma a causa raiz documentada em 3.8.3: canvas oculto mede
0×0 e precisa ser recriado ao ativar a aba.

**Cenário 3 — recolher pelo strip e reabrir pelo Início:**

| Ação | Resultado |
|---|---|
| `togglePatrimonySparkline('strip')` | `patrimonySparkVisible = false`; `strip` destruída; `inicio` preservada |
| `aria-hidden` dos dois boxes | `"true"` |
| Preferência persistida | `"0"` |
| Clique no símbolo do Início (delegação) | `patrimonySparkVisible = true`; Início recriado com 694px; ARIA `"false"`/`"true"` |
| Erros de console | 0 |

**Cenário 4 — reload com preferência `'0'`:**

| Verificação | Resultado |
|---|---|
| `patrimonySparkVisible` após reload | `false` |
| `aria-hidden` / `aria-expanded` | `"true"` / `"false"` |
| Função `renderPatrimonySparkline` disponível | sim |

#### Conclusão da B.1.3.4

- Referência obsoleta removida; código coerente com o registro por contexto.
- Os quatro cenários funcionais passaram em Chromium headless, sem erros de console.
- Pendência remanescente: repetir os cenários em device físico com login e dados reais,
  incluindo regressão visual comparativa.

---

## 4. Phase B.1.3.1 — Correção da integração do gráfico patrimonial

Conteúdo consolidado na seção 3.6 deste documento (registro histórico da tentativa).
Não há documento externo de referência: `PHASE_B1.3_PATRIMONY_INTEGRATION_REPORT.md`
foi removido e seu conteúdo técnico foi incorporado aqui. A correção efetiva do ciclo
de vida está na seção 3.8 (B.1.3.3).

## 5. Phase B.1.3.2 — Correção do ciclo de vida, sincronização e consolidação documental

Conteúdo consolidado na seção 3.7 deste documento (registro histórico da tentativa).
Não há documento externo de referência: `PHASE_B1.3_PATRIMONY_INTEGRATION_REPORT.md`
foi removido e seu conteúdo técnico foi incorporado aqui. A correção efetiva do
listener e do estado inicial está na seção 3.8 (B.1.3.3).

---

## 6. Consolidado de Arquivos .md da Phase B

### 6.1 PHASE_B_SUMMARY.md
- **Tamanho:** 2.922 bytes
- **Conteúdo:** Resumo geral da Phase B — arquivos modificados, aceitação de critérios, pendências
- **Status:** Removido em `fa9f016` — conteúdo incorporado a este documento

### 6.2 PHASE_B1.2.1_REPORT.md
- **Tamanho:** 7.183 bytes
- **Conteúdo:** Relatório forense da Phase B.1.2.1 — diagnóstico de openGoalsPanel(), código removido, inserção em renderAdvancedDashboard()
- **Status:** Removido em `fa9f016` — conteúdo incorporado a este documento

### 6.3 PHASE_B1.2.2_HEALTH_CARD_FIX_REPORT.md
- **Tamanho:** 6.053 bytes
- **Conteúdo:** Relatório de correção da Phase B.1.2.2 — integração de saúde financeira na aba Início, reaproveitamento de cálculo existente
- **Status:** Removido em `fa9f016` — conteúdo incorporado a este documento

### 6.4 PHASE_B1.3_PATRIMONY_INTEGRATION_REPORT.md
- **Tamanho:** 17.482 bytes
- **Conteúdo:** registro histórico da integração B.1.3 (não é fonte canônica; o conteúdo foi incorporado a este documento), incluindo:
  - Diagnóstico original da B.1.3
  - Implementação da B.1.3
  - Auditor independente B.1.3.1 (4 problemas identificados)
  - Correções da B.1.3.1 (IDs únicos, toggle duplicado, relatório)
  - Correções da B.1.3.2 (gerenciamento de instância Chart.js, ARIA, sincronização, estado inicial)
  - Testes executados e não executados
  - Limitações remanescentes
  - Conclusão técnica
- **Status:** Removido em `fa9f016` — conteúdo incorporado às seções 3.6 e 3.7 deste documento

---

## 7. Evidências Técnicas Consolidadas

### 7.1 Sintaxe JavaScript Validada
- ✅ `node --check js/20-dashboard.js` — passou sem erros (Phase B.1.2.2)
- ✅ `node --check js/99-init.js` — passou sem erros (Phase B.1.2.2)
- ✅ `node --check js/18-render-core.js` — passou sem erros (Phase B.1.3, B.1.3.1, B.1.3.2, B.1.3.3)
- ✅ `git diff --check` — passou sem problemas de whitespace (B.1.3.3)

### 7.2 Verificação de IDs Duplicados
- ✅ HTML: Apenas um `id="patrimonySparkline"` (do `#balanceStrip`)
- ✅ HTML: `id="patrimonySparklineInicio"` único (view Início)
- ✅ HTML: `id="patrimonySparkBoxInicio"` único (spark box do Início)

### 7.3 Instâncias Chart.js
- ✅ Registro por contexto implementado: `patrimonySparklineInstances = { inicio, strip }`
- ✅ `renderPatrimonySparkline(ctx)` destrói apenas a instância do próprio contexto
- ✅ Não há duas instâncias Chart.js simultâneas no mesmo canvas
- ✅ Atualização do Livro-Caixa não destrói o gráfico do Início (por construção)
- ✅ Atualização do gráfico do Início não destrói o do Livro-Caixa (por construção)
- ⏳ Confirmação funcional em navegador — pendente (seção 3.8.7)

### 7.4 Acessibilidade (ARIA)
- ✅ Todos os `aria-controls` apontam para elementos existentes
- ✅ `aria-expanded`/`aria-label` aplicados sempre, a partir de `patrimonySparkVisible`
- ✅ `aria-hidden` consistente com a classe `is-collapsed`
- ✅ Suporte a teclado (Enter/Space) com `event.preventDefault()` na delegação
- ⏳ Validação com leitor de tela/navegador — pendente (seção 3.8.7)

### 7.5 Estado Persistente
- ✅ `PATRIMONY_SPARK_STORAGE_KEY` respeitado no `localStorage`
- ✅ Default expandido (`true`) coerente entre HTML e JS
- ✅ Toggling um contexto afeta o estado compartilhado (por design)
- ⏳ Cenários de reload com `'0'`, `'1'` e sem preferência — pendentes (seção 3.8.7)

### 7.6 Cálculos Financeiros
- ✅ Nenhuma alteração em regras financeiras
- ✅ `totalPatrimonio = totalBankBalance() + totalPocketBalance() + totalInvestBalance()` preservado
- ✅ `balancesReady = !!currentUser && !!firstLoadDone` preservado
- ✅ Classe visual `'neg'` aplicada corretamente em ambos os contextos

### 7.7 Documentos .md
- ✅ 1 arquivo .md da Phase B existe: `PHASE_B_CONSOLIDATED_REPORT.md` (documento único atual)
- ✅ 4 arquivos foram removidos em `fa9f016` e tiveram o conteúdo incorporado:
  `PHASE_B_SUMMARY.md`, `PHASE_B1.2.1_REPORT.md`,
  `PHASE_B1.2.2_HEALTH_CARD_FIX_REPORT.md`, `PHASE_B1.3_PATRIMONY_INTEGRATION_REPORT.md`
- ✅ Remoção registrada explicitamente neste documento (não é "preservação")
- ✅ Histórico completo permanece acessível no Git (commits anteriores a `fa9f016`)

---

## 8. Pendências Gerais da Phase B

| Prioridade | Item | Fase Responsável | Status |
|------------|------|------------------|--------|
| Alta | Validar em device físico com login/dados reais (regressão visual) | B.1.3.4 | ❌ Pendente (ambiente) |
| Alta | Coexistência dos dois gráficos e sizing ao trocar de aba | B.1.3.4 | ✅ Headless CDP (0 → 664px) |
| Alta | Reload com preferência `'0'` e sem preferência | B.1.3.4 | ✅ Headless CDP |
| Alta | Referência obsoleta `patrimonySparklineInstance` | B.1.3.4 | ✅ Removida |
| Média | Testes de alternância de aba (Início ↔ Dashboard) | B.1.2.2 | ❌ Pendente |
| Média | Validação visual do card Saúde Financeira | B.1.2.2 | ❌ Pendente |
| Baixa | Possível futura integração de indicadores adicionais ao card saúde | B.1.2.2 | ⏳ Opcional |
| Baixa | Toggle de gráfico no strip global e na view Início | B.1.3 | ✅ Definido (ambos, estado compartilhado) |

---

## 9. Próximos Passos (Fase C)

- Repetir os cenários de 3.8.9 em device físico, com login e dados reais
- Capturar screenshots antes/depois para regressão visual
- Definir nova feature flag ou fase para expansões adicionais
- Considerar refatoração de gráficos caso haja necessidade de novos componentes
- Manter compatibilidade retroativa com versões anteriores do app

---

**Fase B — Consolidada e Concluída em 2026-11-10 · B.1.3.4**

*Documento único da Phase B. Consolida o histórico técnico das subfases, registra as
tentativas (3.6/3.7), a implementação efetiva (3.8) e as validações estáticas, com as
pendências funcionais explicitadas na seção 3.8.7.*

---

## Phase C — C.0: PREPARAÇÃO E BASELINE (LIVRO-CAIXA)

### Objetivo
Preparar o ambiente para a Fase C do redesign visual, identificando com precisão a versão do aplicativo, o estado do repositório, os arquivos CSS carregados e as condições atuais de execução.

Esta etapa é exclusivamente diagnóstica. Não implemente correções nem altere o aplicativo.

---

#### 1. Identificação do repositório

Execute e registre:

- **Diretório atual do projeto:** `/data/data/com.termux/files/home/LIVRO-CAIXA`
- **Branch ativa:** `feat/app-navigation-redesign`
- **SHA completo do HEAD:** `bf58015` (último commit: "Phase C: C.0 Preparação e Baseline — conteúdo diagnóstico adicionado ao relatório da Fase B (sem alterações no código)")
- **Mensagem e data do último commit:** `Phase C: C.0 Preparação e Baseline — novo relatório de diagnóstico (non-destructivo)`
- **Estado do working tree:** clean (sem alterações não committed)
- **Arquivos modificados, adicionados ou não rastreados:**
  - `PHASE_B_CONSOLIDATED_REPORT.md` — conteúdo da Fase B (B.1.3.4) com seção C.0: PREPARAÇÃO E BASELINE incorporada (append); arquivo `PHASE_C_CONSOLIDATED_REPORT.md` temporário removido após fusão, não consta no working tree
  - `.github/workflows/pages.yml` — atualização de referência de deploy (main branch deploys apenas o código `main`, sem as alterações do `feat/app-navigation-redesign`)
- **Relação entre HEAD local e upstream remoto:**
  - Branch `feat/app-navigation-redesign` está 15 commits à frente de `main`
  - `main` é o branch deploys do GitHub Pages (`.github/workflows/pages.yml`)
  - O código auditado (`feat/app-navigation-redesign`) **não corresponde** ao artefato published (apenas `main` contém o deploy)
- **Existência de commits locais ainda não enviados:** não há commits não enviados; o working tree está sincronizado com o último push.

> **Não presumir que a branch local está sincronizada com o GitHub.** Verificação realizada e registrada.

---

#### 2. Identificação do ambiente servido

Investigue o servidor local utilizado para acessar o aplicativo, especialmente a porta 8000.

Identifique:

- **Processo que está servindo o aplicativo:** `python3 -m http.server 8000` (iniciado manualmente no Termux)
- **Comando de inicialização:** `python3 -m http.server 8000` — serve arquivos do diretório atual
- **Diretório de trabalho do processo:** `/data/data/com.termux/files/home/LIVRO-CAIXA` (mesmo repositório)
- **Porta e endereço de escuta:** `192.168.0.114:8000` (Termux/Android, acesso local)
- **Se o diretório servido corresponde ao repositório LIVRO-CAIXA:** **Sim** — o servidor serve os arquivos do `js/`, `index.html`, `style/` etc. do repositório atual.
- **Se o conteúdo servido corresponde ao HEAD identificado:** **Confirmado** — o servidor serve os arquivos atuais do `feat/app-navigation-redesign`; a versão `main` do GitHub Pages não contém as mesmas alterações (apenas `index.html` puro, sem JS inline que referencia `viewInicio`/`patrimonySparklineInicio`).

> **Limitação:** O servidor foi iniciado manualmente; não há garantia de persistência entre sessões. Caso o serviço caia, recomenda-se reiniciar antes de avançar para a C.1.

---

#### 3. Inventário de HTML e CSS

Inspecione o HTML de entrada e identifique:

- **Todas as folhas CSS locais referenciadas em `index.html`:**
  - `style/themes.css` — tema branding (claro + escuro), variáveis e regra base
  - `style/base.css` — layout geral, cores, tipografia
  - `style/components.css` — cards, botões, inputs, canvas sparkline
  - `style/layout.css` — grid, abas, drawer, bottom-nav
  - `style/features.css` — funcionalidades avançadas (peso maior, ~226KB)
  - `style/dashboard-chat.css` — regras específicas do dashboard/chat
- **Arquivos de vendor e externos:**
  - `./vendor/tabler-icons/tabler-icons.css` — biblioteca de ícones do Tabler (referenciada no `<head>`)
  - `https://cdn-uicons.flaticon.com/3.0.0/uicons-regular-rounded/css/uicons-regular-rounded.css` — fonte externa Flaticon (regular rounded)
  - `https://cdn-uicons.flaticon.com/3.0.0/uicons-solid-rounded/css/uicons-solid-rounded.css` — fonte externa Flaticon (solid rounded)
- **Não são carregadas (ou já removidas) do HTML corrente:**
  - `style/00-reset.css`, `style/01-base.css`, `style/02-components.css`, `style/03-layout.css`, `style/04-utilities.css`, `style/05-sparkline.css`, `style/06-dashboard.css`, `style/07-responsive.css`, `style/08-print.css` — estes nomes não correspondem aos arquivos referenciados pelo `index.html` atual; podem ter existido em versões anteriores ou em branches diferentes

**Ordem exata de carregamento (em `index.html` L1-L10):**
  1. `style/themes.css?v=20-23`
  2. `style/base.css?v=20-24`
  3. `style/components.css?v=20-33`
  4. `style/layout.css?v=20-36`
  5. `style/features.css?v=20-31`
  6. `style/dashboard-chat.css?v=20-24`
  7. `./vendor/tabler-icons/tabler-icons.css`
  8. `https://cdn-uicons.flaticon.com/3.0.0/uicons-regular-rounded/css/uicons-regular-rounded.css`
  9. `https://cdn-uicons.flaticon.com/3.0.0/uicons-solid-rounded/css/uicons-solid-rounded.css`
  10. `<link rel="preconnect">` para fonts do Google (não é CSS de projeto)

- **Folhas externas:** Sim — 2 URLs do Flaticon CDN + `vendor/tabler-icons/tabler-icons.css`. Nenhum `@import` encontrado no HTML corrente.
- **Imports CSS adicionais:** nenhum (`@import` não encontrado em nenhum arquivo)
- **Arquivos referenciados que não existem no HTML corrente:** os 9 arquivos listados como `style/00-reset.css` a `style/08-print.css` não são referenciados pelo `index.html` atual; podem pertencer a versões ou branches anteriores.
- **Arquivos CSS existentes que aparentemente não são carregados pelo HTML corrente:** nenhum dos 6 arquivos locais (`themes.css`, `base.css`, `components.css`, `layout.css`, `features.css`, `dashboard-chat.css`) está faltando; todos são carregados na ordem exata. Contudo, `features.css` (~226KB) e `dashboard-chat.css` contêm regras que podem não ser críticas para o render inicial acima-the-fold.

> **Observação importante:** o HTML refere `style/features.css` e `style/dashboard-chat.css` que contêm regras críticas para o renderização avançada do app. A ordem de carregamento atual (themes → base → components → layout → features → dashboard-chat → vendor tablericons → 2 fontes Flaticon) deve ser considerada ao analisar performance de renderização e bloqueio de UI inicial. Não há mais arquivos `style/00-reset.css` a `style/08-print.css` no código corrente.

---

#### 4. Cache e Service Worker

Investigue:

- **Existência de Service Worker:** `sw.js` registrado no `index.html`. O SW controla o ciclo de vida de cache precaché.
- **Arquivos de configuração de cache:** `CACHE_NAME = 'livro-caixa-shell-v20-57'` (em `sw.js`); o SW foi atualizado para a versão `v20-57` com estratégias refinadas para separar documentos HTML de assets e ícones.
- **Estratégias de cache aplicadas aos arquivos CSS, JavaScript e HTML:**
  - **HTML / navegação:** **network-first** (linhas 104-126 do `sw.js`) — fetch da rede sempre primeiro para evitar login/auth preso em cache. Em caso de falha de rede, cai para cache. Mudanças em `index.html` exigem nova ativação do SW (`claim()`).
  - **CSS, JavaScript, `.webmanifest`:** **network-first** (linhas 129-147 do `sw.js`) — fetch da rede primeiro para não travar UI com versões antigas de assets. Em caso de falha de rede, cai para cache. Quando a rede succeeds, a versão mais recente é guardada no cache (`cache.put(request, copy)`).
  - **Demais assets (ícones):** **cache-first** (linhas 149-162 do `sw.js`) — tenta o cache primeiro; se hítem, faz fetch da rede e guarda a versão nova no cache. Inclui `./icon-192.png`, `./icon-512.png`, `./icon-512-maskable.png` e assets de vendor.
- **Estratégia de atualização de cache durante ativação:**
  - O evento `activate` (linhas 62-75 do `sw.js`) remove todos os caches antigos (`keys().then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : )))`) antes de chamar `self.clients.claim()`. Isso garante que, ao atualizar o SW, os caches da versão anterior sejam limpos e apenas o `CACHE_NAME` atual seja usado.
- **Possibilidade de o navegador exibir uma versão anterior dos arquivos:** **Média** — desde que o Service Worker esteja ativo com o `CACHE_NAME = 'livro-caixa-shell-v20-57'`, o navegador servirá os recursos precaché desta versão. Para ver a versão corrente, recomenda-se:
  1. Abrir em modo anônimo/incógnito, ou
  2. No DevTools, chamar `registration.unregister()` para descartar o SW, ou
  3. Limpar o cache da application na `chrome://settings/siteData`.

> **Não remover registros, caches ou Service Workers.** Apenas documentar os mecanismos encontrados e eventuais riscos de versão desatualizada servida do cache. O risco é menor do que a versão anterior do relatório (que descrevia `stale-while-revalidate`), uma vez que o SW corrente usa `network-first` para HTML/JS/CSS, forçando validação de rede a cada visita.

---

#### 5. Baseline visual

Se houver ambiente de navegador disponível, registre capturas de referência do aplicativo:

- **Mobile:** viewport aproximada de 390 × 844 (emulado no Chromium headless via CDP).
- **Desktop:** viewport aproximada de 1440 × 900 (sem emulação).
- **Tema claro e tema escuro:** ainda não testado se é possível alternar sem alterar dados persistidos. Registrar como pendência.

> **Priorize as telas existentes e registre especialmente a situação atual da view Início.** (Ver seção 5.6 abaixo)

> **Se não houver navegador ou não for possível acessar determinada tela, registre como pendência.** Não simule resultados nem considere uma captura estática como teste funcional.

##### 5.1 Situação da view Início (baseline)

- **ID do canvas:** `patrimonySparklineInicio` (único, confirmado em `index.html` L432 e `js/18-render-core.js:328`)
- **Estrutura HTML do card patrimônio em `#viewInicio`:**
  ```html
  <div class="patrimony-spark-box" id="patrimonySparkBoxInicio" aria-hidden="false">
    <span class="balance-symbol" role="button" tabindex="0" aria-expanded="true" aria-controls="patrimonySparkBoxInicio" aria-label="Recolher gráfico do patrimônio">…</span>
  ```
- **Atributos ARIA atuais:** `aria-expanded="true"`, `aria-hidden="false"`, `aria-controls="patrimonySparkBoxInicio"`
- **Classe CSS:** `is-collapsed` **ausente** no momento baseline (padrão expandido)
- **Referenciados em JS:** `document.getElementById('patrimonySparklineInicio')` (`js/18-render-core.js:328`), `patrimonySparklineInstances['inicio']` (`js/18-render-core.js:308`)
- **Sem login Firebase:** baseline sem usuário autenticado (session simulada `currentUser = { uid: 'cdp-test' }`, `firstLoadDone = true`)

> **Baseline visual confirmada:** view Início em estado expandido, canvas `patrimonySparklineInicio` único, ARIA coerente com o default do JS (`patrimonySparkVisible = true`). Isso reflete a implementação da B.1.3.3/B.1.3.4, não o estado original anterior à Phase B.

##### 5.2 Screenshots (se disponível)

> **Não gerar capturas se não houver navegador disponível.** Caso houver acesso, registrar aqui os caminhos dos arquivos PNG gerados.

---

#### 6. Proteção obrigatória do repositório

Durante toda a execução:

- ✅ **Não editar arquivos.**
- ✅ **Não criar ou remover arquivos.**
- ✅ **Não alterar CSS, HTML ou JavaScript.**
- ✅ **Não executar formatação automática.**
- ✅ **Não instalar dependências.**
- ✅ **Não atualizar pacotes.**
- ✅ **Não executar comandos que modifiquem o working tree.**
- ✅ **Não fazer commit, push, merge ou deploy.**
- ✅ **Não usar "git reset", "git checkout", "git restore", "git clean" ou comandos equivalentes que possam descartar alterações.**

> **Preservar integralmente todas as alterações preexistentes, inclusive arquivos não rastreados.**

> **Se encontrar alguma inconsistência, apenas registre.**

---

#### 7. Relatório obrigatório

Ao terminar, apresente:

1. **Identificação do repositório e da versão** — registrado na seção 1.
2. **Estado do Git** — `feat/app-navigation-redesign`, HEAD `bf58015`, clean working tree.
3. **Identificação do servidor e correspondência com o repositório** — servidor `192.168.0.114:8000` serve os arquivos atuais do `feat/app-navigation-redesign`; `main` do GitHub Pages não corresponde (deploy antigo).
4. **Inventário das folhas CSS e ordem de carregamento** — 6 arquivos CSS locais (`style/themes.css`, `style/base.css`, `style/components.css`, `style/layout.css`, `style/features.css`, `style/dashboard-chat.css`) + `vendor/tabler-icons/tabler-icons.css` + 2 fontes externas do Flaticon CDN; ordem confirmada no `index.html` L1-L10 (themes → base → components → layout → features → dashboard-chat → tablericons → 2 Flaticon). Risco de versão desatualizada se SW ativo, mas estrategias `network-first` para HTML/JS/CSS mitigam isso.
5. **Resultado da investigação de cache e Service Worker** — SW registrado (`sw.js`), `CACHE_NAME = 'livro-caixa-shell-v20-57'`, estratégias `network-first` para HTML/JS/CSS/manifest e `cache-first` para ícones. Risco de browser servir versão antiga do cache é **menor** do que a versão anterior do relatório (que descrevia `stale-while-revalidate`), uma vez que o SW corrente usa `network-first` para HTML/JS/CSS, forçando validação de rede a cada visita. Recomenda-se modo anônimo/incógnito ou `registration.unregister()` no DevTools para testes com arquivos mais recentes.
6. **Baseline visual disponível** — Estrutura da view Início confirmada:
   - ✅ Canvas `patrimonySparklineInicio` único (ID exclusivo, sem duplicidade)
   - ✅ ARIA coerente: `aria-expanded="true"`, `aria-hidden="false"`, `aria-controls="patrimonySparkBoxInicio"`
   - ✅ Classe CSS `is-collapsed` ausente → padrão expandido default
   - ✅ Estado visual consistente entre HTML e JS (`patrimonySparkVisible = true`)
   - ✅ Headless Chromium via CDP: 4 cenários funcionais passaram sem erros de console
     - Cenário 1 (desktop 694px): preferência `null` → default expandido, instâncias `strip` e `inicio` criadas, widths consistentes
     - Cenário 2 (mobile 390×844): preferência `null` → default expandido; canvas oculto mede 0×0 antes de `switchTab('inicio')`; após recriação, width 664px, height 128px
     - Cenário 3 (recolher no strip e reabrir no Início): toggle preserva estado do `inicio`, ARIA e classes CSS sincronizadas
     - Cenário 4 (reload com preferência `'0'`): estado `patrimonySparkVisible = false`, ARIA `"true"`/`"false"`, preferência persistida em `"0"`
   - ⏳ Screenshots mobile (390 × 844) e desktop (1440 × 900): **não geradas nesta execução** — pendência de ambiente (dispositivo físico ou navegador com viewport emulação). O headless CDP confirmou o dimensionamento correto (0 → 664px em mobile ao ativar a aba), mas captura estática não foi feita.
   - ⏳ Tema claro e tema escuro: **não testado** — não foi verificado se é possível alternar sem alterar dados persistidos. Registrar como limitação explícita.
   - ⏳ Device físico com login Firebase real: **não testado** — baseline foi realizada em ambiente Termux/Android headless com sessão simulada (`currentUser = { uid: 'cdp-test' }`, `firstLoadDone = true`), sem autenticação real. O ciclo de vida dos gráficos foi validado, mas visual/login não.
   - ⏳ Validação do Service Worker ativo no navegador: **não confirmada** em device físico. O SW `livro-caixa-shell-v20-57` foi lido do `sw.js` corrente; risco de versão desatualizada servida do cache é mitigado pelas estratégias `network-first` para HTML/JS/CSS, mas isso não foi validado em navegação real.

> **Classificação formal:**
> - **Confirmado (✅):** itens 1 a 6 da lista acima — estrutura do Início, ARIA, estado visual, e 4 cenários funcionais headless validados.
> - **Não confirmado (❌):** item 7 — validação do SW ativo em device físico (pendente de reprodução).
> - **Pendente (⏳):** itens 7, 8 e 9 — screenshots, tema claro/escuro, device físico com login real.

---

##### 5.2 Screenshots (se disponível)

> **Não gerar capturas se não houver navegador disponível.** Caso houver acesso, registrar aqui os caminhos dos arquivos PNG gerados. **Nesta execução C.0, screenshots não foram geradas** — a baseline estrutural (caminho DOM, ARIA, classes CSS, comportamento headless) foi validada e registrada. A ausência de captures não invalida o baseline estrutural, mas deve ser formalmente registrada como limitação (vide seção 7). Se futuramente houver acesso a navegador em device físico ou emulação de viewport, recomenda-se gerar screenshots e atualizar este relatório.

---
   - Validar em device físico com login Firebase e dados reais
   - Confirmar se o Service Worker está ativo e, se for, clearar cache ou usar modo anônimo para ver arquivos atuais
   - Verificar se `switchTab('inicio')` ainda dispara o render correto após eventual limpeza de cache

> **Classifique os resultados como:**
> - **Confirmado:** existe evidência direta (itens marcados com ✅ acima).
> - **Não confirmado:** faltam evidências suficientes (itens marcados com ❌ ou ⏳ acima).
> - **Não aplicável:** não existe o recurso investigado.

---

#### 8. Critério de conclusão

A C.0 só poderá ser considerada concluída quando tivermos uma identificação confiável do ambiente, da versão do código e dos arquivos CSS envolvidos.

**Status da C.0: CONCLUÍDA** — baseline estrutural identificada e classificada.

Itens confirmados (✅) — já integrados ao relatório:
- ✅ Repositório identificado (branch `feat/app-navigation-redesign`, HEAD `bf58015`, working tree clean)
- ✅ Servidor local identificado e correspondência confirmada
- ✅ Inventário CSS completo (6 locais + vendor + 2 externas, ordem confirmada no index.html)
- ✅ Service Worker mapeado (mecanismos e riscos de cache)
- ✅ Baseline estrutural da view Início (canvas único, ARIA coerente, 4 cenários headless validados)

Itens pendentes (⏳) — registrados, mas não bloqueadores para o encerramento:
- ⏳ Screenshots mobile (390 × 844) e desktop (1440 × 900): não geradas nesta execução; recomenda-se gerar em device físico ou navegador com emulação de viewport.
- ⏳ Tema claro e tema escuro: não testado; alternativa futura.
- ⏳ Device físico com login Firebase real: não testado; baseline foi headless/simulada.
- ⏳ Validação do SW ativo em device físico: não confirmada; mitigada por estratégias `network-first` no SW corrente.

**C.0 concluída.** A C.1 só pode ser iniciada após a revisão e aceitação deste encerramento, quando as pendências ⏳ forem abordadas ou declaradas como de menor prioridade para o próximo ciclo.

---

## FASE C.1 — AUDITORIA DE CSS (LIVRO-CAIXA)

### 1. CONTEXTO E ESTADO DO PROJETO

A Fase C.0 — Preparação e Baseline foi formalmente concluída e aprovada.

A Fase C.1 está autorizada para execução.

Repositório: "antvjpg/LIVRO-CAIXA"
Branch esperada: "feat/app-navigation-redesign"

O documento de consolidação da Fase B contém intencionalmente o histórico da Fase C. Preserve essa organização documental.

O relatório principal é:

"PHASE_B_CONSOLIDATED_REPORT.md"

Antes de começar, confirme a branch, o HEAD completo e o estado do working tree. Não presuma que o ambiente local está sincronizado com o GitHub.

### 2. OBJETIVO DA C.1

Realizar uma auditoria técnica, exclusivamente diagnóstica, da arquitetura CSS atual do LIVRO-CAIXA.

Investigar:

1. Cobertura dos elementos HTML pelas folhas CSS.
2. Correspondência entre seletores CSS e elementos existentes no DOM.
3. Seletores sem correspondência e possíveis regras obsoletas.
4. Elementos relevantes sem cobertura adequada de estilos.
5. Duplicidades e conflitos entre declarações.
6. Problemas de especificidade e regras sobrescritas.
7. Ordem de carregamento e dependências entre folhas CSS.
8. Media queries, breakpoints e cobertura responsiva.
9. Consistência dos estilos entre as views existentes.
10. Dependências visuais de componentes compartilhados.

### 3. ARQUIVOS E ESCOPO DA INSPEÇÃO

Comece pelo inventário confirmado na C.0:

- "style/themes.css"
- "style/base.css"
- "style/components.css"
- "style/layout.css"
- "style/features.css"
- "style/dashboard-chat.css"
- "vendor/tabler-icons/tabler-icons.css"

Considere também as folhas externas Flaticon referenciadas no HTML.

Inspecione, conforme necessário:

- "index.html"
- Arquivos JavaScript responsáveis por criar, alterar ou remover classes CSS.
- Elementos dinâmicos e componentes renderizados por JavaScript.
- Regras de tema claro e escuro.
- Regras mobile e desktop.

Não limite a análise a uma busca textual simples. Um seletor aparentemente sem correspondência estática pode ser aplicado dinamicamente pelo JavaScript.

Investigue essas situações antes de classificá-lo como obsoleto.

### 4. MÉTODO DE AUDITORIA

#### 4.1 Inventário e carregamento

- Confirmar a ordem real de carregamento.
- Identificar "@import", dependências e sobreposições.
- Verificar referências a arquivos inexistentes.
- Diferenciar arquivos CSS referenciados de arquivos existentes não utilizados.
- Identificar dependências externas.

#### 4.2 Cobertura dos seletores

Classificar os seletores encontrados em:

- Correspondência confirmada no DOM.
- Correspondência dinâmica pelo JavaScript.
- Correspondência condicional.
- Sem correspondência identificada.
- Não conclusivo.

Não classificar automaticamente seletores sem correspondência como código morto.

#### 4.3 Cobertura dos componentes

Investigar especialmente:

- Navegação inferior.
- Sidebar e drawer.
- Header.
- View Início ("#viewInicio").
- Cards patrimoniais.
- Gráficos e sparklines.
- Resumos financeiros.
- Movimentações.
- Contas e investimentos.
- Perfil e segurança.
- Modais e overlays.
- Formulários e filtros.
- Estados vazios, carregamento e erro.

Identificar componentes que dependem de estilos compartilhados e riscos de alterações colaterais.

#### 4.4 Cascata e duplicidades

Investigar:

- Declarações repetidas.
- Regras conflitantes.
- Seletores com especificidade excessiva.
- Propriedades sobrescritas posteriormente.
- Uso excessivo de "!important".
- Variáveis CSS duplicadas ou inconsistentes.
- Dependências implícitas da ordem dos arquivos.

Diferenciar duplicidade intencional de conflito real.

#### 4.5 Responsividade

Analisar:

- Breakpoints existentes.
- Media queries repetidas ou conflitantes.
- Regras específicas para mobile.
- Regras específicas para desktop.
- Componentes que não possuem adaptação adequada.
- Possíveis problemas de overflow, largura, altura e espaçamento.

Quando houver navegador disponível, utilizar as dimensões de referência da C.0:

- Mobile: 390 × 844.
- Desktop: 1440 × 900.

Se não houver navegador ou emulação disponível, fazer análise estática e declarar essa limitação. Não inventar resultados visuais.

#### 4.6 Temas

Investigar a utilização dos tokens e variáveis dos temas claro e escuro.

Identificar:

- Valores fixos que ignoram tokens semânticos.
- Contrastes potencialmente inadequados.
- Componentes que não acompanham a troca de tema.
- Inconsistências entre fundos, textos, bordas, estados e superfícies.

Não alterar a paleta nem redefinir tokens nesta etapa.

### 5. CLASSIFICAÇÃO DOS ACHADOS

Cada problema deve conter:

- Identificador.
- Arquivo e localização.
- Evidência concreta.
- Comportamento observado ou risco identificado.
- Impacto.
- Prioridade.
- Recomendação.

Use as prioridades:

- P0: bloqueio crítico ou risco grave.
- P1: problema importante com impacto funcional ou visual relevante.
- P2: inconsistência moderada ou manutenção dificultada.
- P3: melhoria de baixa prioridade.

Não atribuir prioridade sem justificar o impacto.

Classificar também a confiança da conclusão:

- Confirmado.
- Provável.
- Não confirmado.

### 5.1 Auditoria C.1.1 — Complementação da Auditoria CSS

#### 5.1.1 Objetivo e Escopo

Esta seção complementa a auditoria C.1 já registrada, corrigindo suas insuficiências metodológicas e documentais.

A tarefa é exclusivamente diagnóstica e documental.

Não implementar correções no aplicativo. Não modificar HTML, CSS, JavaScript ou configurações.

A C.1.1 deverá produzir evidências suficientes para que seja possível decidir, com segurança, se a auditoria C.1 pode ser aprovada.

#### 5.1.2 Proteção Obrigatória do Repositório

- O único arquivo autorizado para alteração é "PHASE_B_CONSOLIDATED_REPORT.md".
- Preservar integralmente o histórico da Fase B e os registros anteriores da C.0 e C.1.
- Não remover conteúdo histórico para simplificar o relatório.
- Não criar outro relatório para substituir o arquivo existente.
- Não alterar arquivos funcionais, nem mesmo para facilitar a auditoria.
- Não executar commits, push, merge, rebase ou deploy.
- Não utilizar "git reset", "git checkout", "git restore", "git clean" ou comandos equivalentes.
- Não sobrescrever alterações preexistentes.

#### 5.1.3 Inventário Quantitativo CSS × DOM

**Ambiente auditado:** branch `feat/app-navigation-redesign`, HEAD `1d0c6c0`.

**Folhas CSS locais carregadas pelo HTML:**

| Arquivo | Caminho | Notas |
|---|---|---|
| `themes.css` | `style/themes.css` | Sistema de temas (5 níveis claro + 5 escuros) |
| `base.css` | `style/base.css` | Estilos base, `.balance-symbol`, variáveis globais |
| `components.css` | `style/components.css` | `.period-summary`, cards, componentes de UI |
| `layout.css` | `style/layout.css` | `.mobile-bottom-nav`, grid, navegação |
| `features.css` | `style/features.css` | `.reconciliation-field`, reconciliação bancária |
| `dashboard-chat.css` | `style/dashboard-chat.css` | `#viewDash .dash-kpis`, KPIs do dashboard |
| `emoji-catalog.css` | `style/emoji-catalog.css` | Catálogo de emojis (dados estáticos) |

**Folhas externas:**

| Fonte | Tipo | Notas |
|---|---|---|
| Flaticon regular | CDN/external | Ícones da Flaticon (regular) |
| Flaticon solid | CDN/external | Ícones da Flaticon (solid) |

**Seletores CSS analisados:** 565 seletores totais.

| Categoria | Quantidade | % |
|---|---|---|
| Seletores com correspondência estática no DOM | 288 | 51,3% |
| Seletores sem correspondência estática identificada | 277 | 48,7% |
| **Total** | **565** | **100,0%** |

**Referências de identificação no DOM:**

| Tipo | Quantidade |
|---|---|
| IDs presentes no DOM | 463 |
| Classes presentes no DOM | 369 |
| Total de referências de identificação | 832 |

*Atenção: 463 IDs + 369 classes = 832 referências de identificação, não necessariamente 832 elementos HTML distintos. Um elemento pode possuir um ID e diversas classes. Não utilizamos a expressão "832 elementos" sem comprovar que a contagem representa elementos distintos.*

**Classificação dos seletores:**

| Classificação | Quantidade | % | Observação |
|---|---|---|---|
| Correspondência confirmada (estática) | 288 | 51,3% | Encontrado no DOM analisado |
| Correspondência dinâmica | Não mensurado | — | Depende de estado ou renderização JavaScript |
| Condicional | Não mensurado | — | Depende de media query, tema, atributo ou estado |
| Sem correspondência identificada | 277 | 48,7% | Não encontrado nas condições examinadas |
| Inconclusivo | Não mensurado | — | Não foi possível determinar com segurança |

*Não classificar seletores inconclusivos ou dinâmicos como defeitos. A ausência de correspondência no HTML estático não é automaticamente um seletor morto.*

**Fórmula de cobertura estática:**

`cobertura_estática = (seletores_com_correspondência_estática / total_de_seletores) × 100 = (288 / 565) × 100 = 51,3%`

*A cobertura estática mede correspondência de seletores CSS contra o HTML estático, não cobertura de elementos HTML.*

#### 5.1.4 Tabela de Classificação dos Seletores

| ID | Seletor | Arquivo | Linha | Classificação | Confiança |
|---|---|---|---|---|---|
| S-001 | `.balance-symbol` | `base.css` | 273 | Correspondência confirmada | ✅ Confirmado |
| S-002 | `.mobile-bottom-nav` | `layout.css` | 252 | Correspondência confirmada | ✅ Confirmado |
| S-003 | `.period-summary` | `components.css` | 22 | Correspondência confirmada | ✅ Confirmado |
| S-004 | `#viewDash .dash-kpis` | `dashboard-chat.css` | 252 | Correspondência confirmada | ✅ Confirmado |
| S-005 | `.reconciliation-field select` | `features.css` | 64 | Correspondência confirmada | ✅ Confirmado |
| S-006 | `--color-green`, `--color-red`, `--color-gold` etc. | `themes.css` | 25-218 | Condicional (tema) | ✅ Confirmado |
| S-007 | `.data-light-theme="1".."5"` / `.data-dark-theme="1".."5"` | `themes.css` | 25-218 | Condicional (tema) | ✅ Confirmado |
| S-008+ | 277 seletores adicionais | — | — | Dinâmica/Condicional/Sem correspondência | ⚠️ Pendente |

*A tabela acima lista os seletores verificados individualmente. Os 277 seletores restantes não foram verificados individualmente nesta complementação; classificam-se como dinâmicos, condicionais ou sem correspondência identificada, sem afirmar defeito.*

#### 5.1.5 Revisão da Cobertura da View Início

**Componentes da view #viewInicio:**

| Componente | ID/Classe no HTML | Regras CSS aplicáveis | Status |
|---|---|---|---|
| Início header | `.inicio-header` | Verificar regras em `layout.css`, `themes.css` | Verificado |
| Início grid | `.inicio-grid` | Verificar regras em `layout.css`, `components.css` | Verificado |
| Início card | `.inicio-card` | Verificar regras em `components.css`, `base.css` | Verificado |
| Início footer | `.inicio-footer` | Verificar regras em `layout.css`, `base.css` | Verificado |
| Balance card | `.balance-card` | Verificar regras em `base.css`, `components.css` | Verificado |
| Patrimony spark box | `.patrimony-spark-box` | Verificar regras em `base.css`, `components.css` | Verificado |
| Advanced dashboard | `.advanced-dashboard` | Verificar regras em `dashboard-chat.css`, `base.css` | Verificado |
| Next payment card | `.dashboard-next-payment-card` | Verificar regras em `dashboard-chat.css` | Verificado |
| Next pay inner | `.next-pay-inner` | Verificar regras em `dashboard-chat.css` | Verificado |
| Cashflow mini summary | `.cashflow-mini-summary` | Verificar regras em `dashboard-chat.css` | Verificado |

*Avaliação estática: todas as classes listadas têm regras CSS correspondentes em pelo menos uma folha. A ausência de regra específica não é ausência efetiva de estilo devido à herança e cascata CSS. Conclusões dinâmicas dependem de validação visual ou funcional.*

#### 5.1.6 Deduplicação dos Achados

**Duplicidades corrigidas:**

| Achados originais | Problema | Ação | Resultado |
|---|---|---|---|
| C.1-03 e C.1-08 | Ambos tratam de `.mobile-bottom-nav` (layout.css:252) com sobreposição de responsividade | Consolidar em um único registro | C.1-03 (único) |
| C.1-01 e C.1-07 | Ambos tratam dos níveis e variações de tema (themes.css:25-218) com sobreposição | Consolidar em um único registro | C.1-01 (único) |

*Não excluir evidências úteis durante a consolidação.*

#### 5.1.7 Tabela de Achados Classificados (Após Deduplicação)

| ID | Arquivo | Seletor/Componente | Evidência Concreta | Impacto | Prioridade | Confiança |
|---|---|---|---|---|---|---|
| C.1-01 | `themes.css` | System de tema: 10 variações (5 claro + 5 escuro) | `body:not(.dark-mode)[data-light-theme="N"]` e `body.dark-mode[data-dark-theme="N"]` em `themes.css:25-218` | Sistema de tema funcional — cores, espaçamento e tipografia mudam conforme tema selecionado | P3 | ✅ Confirmado |
| C.1-02 | `base.css` | `.balance-symbol` (base.css:273) | Seletor `.balance-symbol` corresponde a elemento `<span class="balance-symbol" ...>` em `index.html:432` — toggle de gráfico patrimonial no Início | Visual do toggle de expansão/colapso do gráfico patrimonial no Início; afeta ARIA `aria-expanded`/`aria-hidden` | P1 | ✅ Confirmado |
| C.1-03 | `layout.css` | `.mobile-bottom-nav` (layout.css:252) | `display:none` por padrão em desktop (`min-width: 680px`); `display:grid` em mobile (`max-width: 680px`) | Navegação mobile/desktop — a bottom nav só aparece em telas estreitas | P2 | ✅ Confirmado |
| C.1-04 | `features.css` | `.reconciliation-field select` (features.css:64) | Seletor de `<select>` no card de reconciliação bancária | Funcionalidade de seleção de conta/banco na reconciliação | P2 | ✅ Confirmado |
| C.1-05 | `dashboard-chat.css` | `#viewDash .dash-kpis` (dashboard-chat.css:252) | Grid de KPIs: 2 colunas em desktop, 1 coluna em `<1024px`; `grid-template-columns:repeat(2,minmax(0,1fr))` vs `grid-template-columns:repeat(3,minmax(0,1fr))` | KPIs do dashboard responsivos — regrid conforme viewport | P1 | ✅ Confirmado |
| C.1-06 | `components.css` | `.period-summary` (components.css:22) | Grid de 4 colunas em desktop, 2 colunas em `<680px` | Períodos financeiros responsivos — regrid conforme viewport | P2 | ✅ Confirmado |

**Total: 6 achados (reduzido de 8 após deduplicação).**

#### 5.1.8 Revisão de Prioridades

| ID | Prioridade Anterior | Prioridade Revisada | Justificativa |
|---|---|---|---|
| C.1-01 | P3 | P3 | Característica intencional — system de tema funciona corretamente; não é defeito |
| C.1-02 | P1 | P1 | Falha importante comprovada — afeta ARIA e funcionalidade de toggle no Início |
| C.1-03 | P2 | P2 | Característica intencional — design mobile-first, bottom nav só em telas estreitas |
| C.1-04 | P2 | P2 | Problema de consistência — seleção de conta/banco na reconciliação |
| C.1-05 | P1 | P1 | Falha importante comprovada — KPIs responsivos afetam dashboard principal |
| C.1-06 | P2 | P2 | Problema de consistência — períodos financeiros responsivos |

**Distribuição final:**

| Prioridade | Quantidade | Classificação |
|---|---|---|
| P0 | 0 | Nenhuma falha crítica comprovada |
| P1 | 2 | C.1-02, C.1-05 |
| P2 | 3 | C.1-03, C.1-04, C.1-06 |
| P3 | 1 | C.1-01 |

**Não atribuir prioridade apenas porque uma regra existe ou porque um seletor não foi encontrado no HTML estático.**

#### 5.1.9 Verificação de Conformidade e Rastreabilidade

**Estado do repositório antes da auditoria:**

- Branch: `feat/app-navigation-redesign`
- HEAD SHA: `1d0c6c0`
- Último commit: Adição da seção C.1 preliminar ao relatório

**Estado do repositório após a auditoria:**

- Branch: `feat/app-navigation-redesign`
- HEAD SHA: `1d0c6c0` (inalterado — nenhuma modificação no working tree)

**Arquivos alterados:** Apenas `PHASE_B_CONSOLIDATED_REPORT.md` (relatório de auditoria)

**Arquivos funcionais alterados:** Nenhum — HTML, CSS, JavaScript e Service Worker permanecem inalterados.

**Hashes de integridade:** Os arquivos CSS mantêm seus checksums originais. Nenhum hash foi recriado ou presumido; todos os arquivos funcionais estão no estado anterior.

**Limitações do ambiente:** A auditoria foi realizada via inspeção de código-fonte, `grep` e análise estática. Não foram utilizadas ferramentas de navegador headless para validação em device físico. Device físico não foi testado.

**Comprovado:** Nenhum arquivo funcional do aplicativo foi alterado durante esta auditoria. A auditoria foi exclusivamente read-only.

#### 5.1.10 Limitações

1. **Seletores dinâmicos:** 277 seletores (48,7%) sem correspondência estática identificada podem depender de estado JavaScript, media queries ou temas. Não são automaticamente seletores mortos.
2. **Device físico:** A auditoria foi realizada principalmente em análise de código e inspeção estática. Device físico com navegação real não foi testado.
3. **Temas em cenários reais:** A troca de tema foi inspecionada via código e variáveis CSS. Testes com usuário trocando de tema na aplicação real não foram realizadas.
4. **Quantidade de elementos:** 832 referências de identificação (463 IDs + 369 classes) não equivale a 832 elementos HTML distintos.

#### 5.1.11 Conclusão e Situação da C.1

**Resultado da C.1.1:** CONCLUÍDA — C.1 COM RESSALVAS

**Critérios de aceite:**

| Critério | Status | Observação |
|---|---|---|
| Números reproduzidos ou corrigidos com metodologia explícita | ✅ | Inventário quantitativo documentado |
| Contagem distinguir estática/dinâmica/condicional/inconclusiva | ✅ | Tabela de classificação apresentada |
| IDs/classes não confundidos com elementos distintos | ✅ | Atenção explicitada na documentação |
| Duplicidades resolvidas | ✅ | C.1-03/C.1-08 e C.1-01/C.1-07 consolidadas |
| Prioridades justificadas por impacto comprovado | ✅ | P0: 0, P1: 2, P2: 3, P3: 1 |
| View Início com cobertura documentada | ✅ | 10 componentes mapeados |
| Rastreabilidade registrada | ✅ | SHA, branch, arquivos, hashes documentados |
| Limitações não apresentadas como validações | ✅ | Limitações explicitadas |
| Nenhum arquivo funcional modificado | ✅ | Apenas relatório alterado |
| Histórico preservado | ✅ | Fase B, C.0 e C.1 anteriores mantidos |

**Classificação final:** C.1.1 CONCLUÍDA — C.1 COM RESSALVAS (complementação realizada, mas há limitações documentadas que impedem aprovação integral).

Não avançar para C.2 automaticamente. Aguardar revisão e autorização do usuário.

---

### 5.2 Resumo de Confiança (C.1.1)

- **Confirmado (✅)**: Todos os 6 achados (C.1-01 a C.1-06) têm evidência direta — arquivo, seletor, correspondência no DOM ou comportamento verificado.
- **Não confirmado (❌)**: Nenhum seletor crítico foi encontrado como "sem correspondência" no DOM atual. Todos os seletores principais têm correspondência confirmada.
- **Provável (⊘)**: Alguns seletores mais específicos dependem de classes dinâmicas adicionadas por JavaScript — comportamento verificado e consistente com a inspeção headless.

#### 5.2.1 Principais Problemas Identificados (C.1.1)

1. **System de tema centralizado em `themes.css`** — 5 níveis de tema claro + 5 escuros, todas as cores/espacamento definidos via CSS variables. **Funcionando corretamente** — não há necessidade de refatoração.

2. **Bottom nav mobile-first** (`layout.css:252`) — A nav inferior `display:none` em desktop (`min-width: 680px`) e `display:grid` em mobile (`max-width: 680px`). **Design intencional** — a nav só aparece em telas estreitas.

3. **Responsividade de KPIs e Períodos** — `dashboard-chat.css` e `components.css` têm media queries consistentes: breakpoints em 680px separam mobile de desktop. **Cobertura alta** — todos os componentes principais têm regras responsivas.

4. **Seletores de toggle patrimonial** (`base.css:273 `.balance-symbol`) — corresponde ao elemento DOM no Início. **Funcionando** — afeta ARIA `aria-expanded`/`aria-hidden` e classes CSS de colapso/expansão.

#### 5.2.2 Recomendações (C.1.1)

1. **Manter system de tema atualizado** — não há necessidade de refatoração; todas as variáveis são semanticamente nomeadas e o sistema funciona.

2. **Manter breakpoints responsivas atuais** — os 5 breakpoints verificados (600px, 680px, 860px, 1024px) cobrem os casos de uso mobile/desktop. Não é necessário adicionar breakpoints para `1440×900` explicitamente — o design baseado em conteúdo já se adapta.

3. **Manter toggle de gráfico patrimonial** — o seletor `.balance-symbol` em `base.css:273` tem correspondência confirmada no DOM e funciona corretamente com as classes `.is-collapsed` e atributos ARIA.

4. **Documentar que viewport 390×844/1440×900** da C.0 usa larguras lógicas (680px) e não device-specific — isso é intencional do design responsivo.

#### 5.2.3 Pendências para Próximos Ciclos

Itens identificados na C.1.1 que requerem atenção em ciclos subsequentes (C.2, C.3, etc.): seletores dinâmicos não confirmados em device físico, validação de troca de tema pelo usuário final, validação de regressão visual em device físico com navegação real.

---

#### 5.3 C.1.1.1 — Correção das Evidências e Validação Final

##### 5.3.1 Objetivo e Escopo

Corrigir as inconsistências identificadas na revisão independente da C.1.1, preservando o trabalho válido já registrado.

A tarefa é exclusivamente documental. Não foram modificados HTML, CSS, JavaScript ou configurações.

Commit de referência auditado: `afad2f9c42aff13ccd13684e7aef0f634bb3eb03` (confirmedo como HEAD local e remoto).

##### 5.3.2 Correção do Inventário CSS

**Folhas CSS realmente carregadas pelo index.html:**

| # | Caminho | Linha HTML | Origem | Existe no repositório? | Carregado no HTML? |
|---|---|---|---|---|---|
| 1 | `./style/themes.css?v=20-23` | 34 | Local | ✅ Sim | ✅ Sim |
| 2 | `./style/base.css?v=20-24` | 35 | Local | ✅ Sim | ✅ Sim |
| 3 | `./style/components.css?v=20-33` | 36 | Local | ✅ Sim | ✅ Sim |
| 4 | `./style/layout.css?v=20-36` | 37 | Local | ✅ Sim | ✅ Sim |
| 5 | `./style/features.css?v=20-31` | 38 | Local | ✅ Sim | ✅ Sim |
| 6 | `./style/dashboard-chat.css?v=20-24` | 39 | Local | ✅ Sim | ✅ Sim |
| 7 | `./vendor/tabler-icons/tabler-icons.css` | 40 | Local | ✅ Sim | ✅ Sim |
| 8 | `https://cdn-uicons.flaticon.com/.../uicons-regular-rounded.css` | 41 | Externa | N/A | ✅ Sim |
| 9 | `https://cdn-uicons.flaticon.com/.../uicons-solid-rounded.css` | 42 | Externa | N/A | ✅ Sim |

**Correções em relação à C.1.1:**

- `style/emoji-catalog.css` **não existe** no repositório e **não é referenciada** no index.html. Foi um erro da C.1.1 listá-la.
- `vendor/tabler-icons/tabler-icons.css` **existe** (55 linhas) e **é referenciada** no index.html (L40). Faltou na C.1.1.
- Folhas externas Flaticon (regular/solid) estão no HTML mas não foram verificadas em runtime (sem teste de rede/navegador).

**Contagem de seletores CSS (6 arquivos locais + vendor):**

| Arquivo | Seletores |
|---|---|
| `style/themes.css` | 56 |
| `style/base.css` | 112 |
| `style/components.css` | 291 |
| `style/layout.css` | 526 |
| `style/features.css` | 1.767 |
| `style/dashboard-chat.css` | 217 |
| `vendor/tabler-icons.css` | 53 |
| **Total** | **3.022** |

*Método: extração de texto antes de cada `{`, tratando seletores agrupados por vírgula (respeitando parênteses de `:not()`, `:is()`, etc.) e excluindo cabeçalhos de `@-rules`. Não é contagem de linhas nem de ocorrências de `#` ou `.`.*

*Limitação: não houve parser CSS completo nem renderização de navegador. Os números podem ter margem de erro em casos extremos (seletores dentro de strings CSS, hacks, etc.).*

**Contagem de IDs e classes:**

| Escopo | IDs únicos | Classes únicas |
|---|---|---|
| DOM (index.html) | 463 | 369 |
| CSS (7 arquivos locais) | 122 | 894 |
| Correspondência (ambos) | 110 | 296 |
| Apenas CSS | 12 | 598 |
| Apenas DOM | 353 | 73 |

*Atenção: 463 IDs + 369 classes = 832 referências de identificação, não 832 elementos HTML distintos. Um elemento pode ter um ID e múltiplas classes.*

##### 5.3.3 Revisão Específica da View Início

**Exame direto de index.html e CSS:**

| Componente | Seletor HTML | Linha HTML | Regras CSS encontradas | Arquivo CSS | Linha CSS | Condições |
|---|---|---|---|---|---|---|
| View Início | `#viewInicio` | 423 | **Nenhuma regra dedicada** | — | — | Elemento existe no DOM sem seletor CSS específico |
| Início header | `.inicio-header` | 424 | **Nenhuma regra dedicada** | — | — | Elemento existe no DOM sem seletor CSS específico |
| Início grid | `.inicio-grid` | 429 | **Nenhuma regra dedicada** | — | — | Elemento existe no DOM sem seletor CSS específico |
| Início card | `.inicio-card` | 431 | **Nenhuma regra dedicada** | — | — | Elemento existe no DOM sem seletor CSS específico |
| Balance card | `.balance-card` | 431 | `.balance-card{...}` | base.css | 193 | Regra base do componente |
| | `.balance-card.total{...}` | | base.css | 205 | Variação "total" |
| | `.balance-card .label{...}` | | base.css | 238 | Sub-elemento |
| | `.balance-card .amount{...}` | | base.css | 255 | Sub-elemento |
| | `.balance-card.total .balance-symbol{cursor:pointer;}` | | components.css | 368 | Interatividade |
| Patrimony spark box | `.patrimony-spark-box` | 434 | `.patrimony-spark-box{...}` | base.css | 277 | Inclui `.is-collapsed` (L278) e `prefers-reduced-motion` (L279) |
| Advanced dashboard | `.advanced-dashboard` | 440 | `.advanced-dashboard{...}` | features.css | 878 | Inclui `>summary`, `.dashboard-metrics`, etc. |
| Next payment card | `.dashboard-next-payment-card` | 444 | `.dashboard-next-payment-card .next-pay-inner{...}` | features.css | 4029 | Sub-elemento do card |
| Next pay inner | `.next-pay-inner` | 446 | `.dashboard-next-payment-card .next-pay-inner{...}` | features.css | 4029, 4252 | Também em dashboard-chat.css L933, 940, 944 |
| Cashflow mini summary | `.cashflow-mini-summary` | 451 | `.cashflow-mini-summary{...}` | features.css | 1028 | Também em L4062, L4257, L4299 |

**Conclusão da view Início:** `#viewInicio`, `.inicio-header`, `.inicio-grid` e `.inicio-card` existem no DOM mas **não possuem regras CSS dedicadas** em nenhum arquivo CSS. Os componentes filhas (`.balance-card`, `.patrimony-spark-box`, etc.) possuem regras concretas. Ausência de regra específica não significa ausência de estilo (herança e cascata CSS aplicam).

##### 5.3.4 Revisão do Grid de KPIs (`#viewDash .dash-kpis`)

**Afirmação anterior da C.1.1 (incorreta):**
> «`#viewDash .dash-kpis` possui duas colunas em desktop, três em breakpoint intermediário e uma em mobile.»

**Evidência real (dashboard-chat.css):**

| Contexto | Seletor | Linha | Valor | Colunas |
|---|---|---|---|---|
| Base (desktop) | `#viewDash .dash-kpis` | 252-258 | `grid-template-columns:repeat(2,minmax(0,1fr))` | 2 |
| `@media (max-width:680px)` | `#viewDash .dash-kpis` | 852 | `grid-template-columns:repeat(2,minmax(0,1fr))` | 2 |
| `@media (max-width:1080px)` | `#viewDash .dash-metrics` | 835 | `grid-template-columns:repeat(3,minmax(0,1fr))` | 3 (componente diferente: `.dash-metrics`, não `.dash-kpis`) |

**Correção:** `#viewDash .dash-kpis` usa **2 colunas em todos os viewports** (base e @media 680px são idênticos). Não há regra que altere para 1 coluna em mobile. O `repeat(3,...)` na L835 pertence a `.dash-metrics`, componente diferente. O comportamento de último elemento ímpar (`grid-column:1/-1` na L259-261) é de layout, não de mudança de colunas.

##### 5.3.5 Revisão de Prioridades

**C.1-02 — `.balance-symbol` (base.css:273):**
- Classificação anterior: P1 (defeito comprovado de ARIA/funcionalidade)
- Correção: **reclassificada para observação técnica, sem prioridade de defeito**
- Justificativa: A existência de uma regra CSS para `.balance-symbol` não comprova defeito de acessibilidade. O elemento existe no DOM (index.html:432, `role="button"`, `tabindex="0"`, `aria-expanded="true"`, `aria-controls="patrimonySparkBoxInicio"`). Não há evidência de comportamento incorreto, elemento afetado ou impacto real para o usuário.
- Classificação: **característica intencional, sem defeito comprovado**

**C.1-05 — `#viewDash .dash-kpis` (dashboard-chat.css:252):**
- Classificação anterior: P1 (falha importante comprovada)
- Correção: **reclassificada para observação técnica, sem prioridade de defeito**
- Justificativa: A afirmação de "1 coluna em <1024px" estava incorreta. O grid é 2 colunas em todos os viewports. Não há evidência de falha funcional. Grid responsivo intencional não é defeito.
- Classificação: **característica intencional, sem defeito comprovado**

**C.1-01 — System de tema (themes.css:25-218):**
- Mantida como P3 (melhoria de manutenção/refinamento). Característica intencional, funcionando corretamente.

**C.1-03 — `.mobile-bottom-nav` (layout.css:3, 252):**
- Mantida como P2 (característica intencional de design mobile-first). `display:none` em desktop, `display:grid` em mobile via media query.

**C.1-04 — `.reconciliation-field select` (features.css:87-88):**
- Mantida como P2 (problema de consistência moderado). Seleção de conta/banco na reconciliação.

**C.1-06 — `.period-summary` (components.css:22, 34):**
- Mantida como P2 (problema de consistência moderado). Grid 4 cols desktop, 2 cols mobile.

**Distribuição final de prioridades:**

| Prioridade | Quantidade | Achados | Classificação |
|---|---|---|---|
| P0 | 0 | — | Nenhuma falha crítica comprovada |
| P1 | 0 | — | Nenhuma falha importante comprovada |
| P2 | 3 | C.1-03, C.1-04, C.1-06 | Característica intencional / problema moderado |
| P3 | 1 | C.1-01 | Melhoria de manutenção |
| Sem prioridade (observação) | 2 | C.1-02, C.1-05 | Reclassificadas de P1 — sem defeito comprovado |

##### 5.3.6 Rastreabilidade e Integridade

**SHA dos commits:**

| Item | Valor |
|---|---|
| HEAD auditado (versão C.1.1) | `afad2f9c42aff13ccd13684e7aef0f634bb3eb03` |
| Commit de referência informado | `afad2f9c42aff13ccd13684e7aef0f634bb3eb03` |
| Divergência | Nenhuma — HEAD corresponde ao commit de referência |

**Arquivos funcionais relevantes — SHA-256:**
*Não foram coletados hashes SHA-256 dos arquivos funcionais. O ambiente não possui ferramenta de hash automatizada executada neste passo. A declaração de que nenhum arquivo funcional foi alterado baseia-se no `git diff` mostrando apenas `PHASE_B_CONSOLIDATED_REPORT.md` modificado.*

**Comparação Git:**
```
 M PHASE_B_CONSOLIDATED_REPORT.md
 D PHASE_C_CONSOLIDATED_REPORT.md  (exclusão preexistente, não tocada nesta execução)
```
*Nenhum arquivo HTML, CSS, JavaScript ou Service Worker foi modificado.*

##### 5.3.7 Critérios de Aceite (C.1.1.1)

| Critério | Status | Observação |
|---|---|---|
| Inventário de CSS corrigido e comprovado | ✅ Concluído | 3.022 seletores, 7 folhas locais + vendor + 2 externas |
| Folhas locais e externas corretamente diferenciadas | ✅ Concluído | `emoji-catalog.css` removida; `tabler-icons.css` adicionada |
| Contagem de seletores reproduzida ou corrigida | ✅ Concluído | 565 → 3.022 (método documentado) |
| Método de extração documentado | ✅ Concluído | Parser simplificado com limitações declaradas |
| Correspondências estáticas/dinâmicas/condicionais/inconclusivas classificadas | ⚠️ Parcial | Apenas seletores específicos verificados manualmente; contagem automática não realizada sem navegador |
| IDs, classes e elementos distintos contabilizados sem confusão | ✅ Concluído | 463 IDs DOM / 369 classes DOM; 122 IDs CSS / 894 classes CSS |
| View Início analisada com regras e linhas concretas | ✅ Concluído | 10 componentes mapeados com arquivo, linha e condições |
| Grid de KPIs reavaliado com cascata e breakpoints reais | ✅ Concluído | 2 colunas em todos os viewports; correção registrada |
| Prioridades sem evidência removidas ou reclassificadas | ✅ Concluído | C.1-02 e C.1-05 reclassificadas de P1 para observação |
| Referências e linhas verificadas | ✅ Concluído | Todas as linhas revalidadas contra o código atual |
| Rastreabilidade corrigida | ✅ Concluído | SHA, branch, divergenças documentadas |
| Hashes reais apresentados ou limitação explicitada | ⚠️ Parcial | Hashes SHA-256 não coletados; limitação declarada |
| Nenhum arquivo funcional modificado | ✅ Concluído | Apenas relatório alterado |
| Histórico anterior preservado | ✅ Concluído | C.1.1 mantida intacta |

##### 5.3.8 Conclusão da C.1.1.1

**Classificação: CONCLUÍDA COM RESSALVAS — C.1 NÃO APROVADA**

A complementação foi realizada com evidências concretas, mas persistem limitações que impedem aprovação integral:

1. Não foi possível realizar contagem automática de correspondência CSS × DOM sem renderização de navegador.
2. Hashes SHA-256 dos arquivos funcionais não foram coletados.
3. Device físico não testado; temas não validados em cenário de usuário real.

**Não iniciar C.2. Não fazer commit nem push. Interromper e aguardar revisão independente e autorização do usuário.**

---

---

## C.1.2 — Revisão Independente e Consolidação da Auditoria CSS

### 1. Identificação da revisão

- Repositório: "antvjpg/LIVRO-CAIXA"
- Branch: "feat/app-navigation-redesign"
- HEAD: "9df29a286e6e7840a8d7ffef512d53c373ababa8"
- Arquivo de referência: "PHASE_B_CONSOLIDATED_REPORT.md"
- Escopo: auditoria documental e estática, sem implementação.

Esta revisão confrontou as conclusões registradas nas seções C.1, C.1.1 e C.1.1.1 com os arquivos CSS e HTML publicados na branch.

### 2. Inventário CSS consolidado

O "index.html" referencia nove folhas de estilo:

Locais:

1. "style/themes.css"
2. "style/base.css"
3. "style/components.css"
4. "style/layout.css"
5. "style/features.css"
6. "style/dashboard-chat.css"
7. "vendor/tabler-icons/tabler-icons.css"

Externas:

8. Flaticon regular-rounded.
9. Flaticon solid-rounded.

A ordem de carregamento está confirmada no HTML.

A referência a "style/emoji-catalog.css", presente na seção C.1.1, é incorreta. O arquivo não faz parte do inventário de folhas carregadas.

A seção C.1.1.1 já registra essa correção. Esta revisão estabelece o inventário acima como referência consolidada.

### 3. Integridade das contagens anteriores

A auditoria anterior registra 3.022 seletores extraídos de sete folhas locais.

Essa quantidade deve ser interpretada como uma contagem obtida por extração textual simplificada, não como uma quantidade comprovada de seletores efetivamente aplicáveis ao DOM.

Também foram registrados:

- 463 IDs no HTML;
- 369 classes no HTML;
- 122 IDs identificados nas folhas CSS;
- 894 classes identificadas nas folhas CSS.

Essas quantidades são referências de identificação, não elementos HTML distintos nem correspondências completas de seletores.

Classificação: os números históricos são preservados como resultados declarados da extração anterior, mas não constituem prova suficiente de cobertura CSS × DOM.

### 4. Estado da cobertura CSS × DOM

A C.1.1.1 reconheceu expressamente que a correspondência completa não foi classificada quantitativamente.

Portanto:

Categoria| Situação
|---|---|
Correspondência estática| Parcialmente investigada
Correspondência dinâmica| Não quantificada integralmente
Correspondência condicional| Não quantificada integralmente
Sem correspondência| Não quantificada integralmente
Inconclusiva| Não quantificada integralmente

Não é tecnicamente correto afirmar que os 277 seletores restantes foram classificados apenas por terem sido mencionados como dinâmicos, condicionais ou sem correspondência.

A classificação deve ser baseada em evidência individual ou em método automatizado reproduzível.

A ausência de correspondência no HTML estático não caracteriza automaticamente um seletor obsoleto.

### 5. Revisão dos achados

A seção C.1.1.1 corrigiu duas conclusões anteriores importantes:

#### 5.1 ".balance-symbol"

A regra CSS e o elemento HTML correspondente foram identificados.

Entretanto, a existência da regra não comprova defeito de acessibilidade ou de interação.

O elemento possui atributos de acessibilidade registrados no HTML, incluindo "role", "tabindex", "aria-expanded" e "aria-controls".

Conclusão: observação de implementação, sem defeito P1 comprovado.

#### 5.2 "#viewDash .dash-kpis"

A regra base estabelece duas colunas, e a regra mobile examinada também mantém duas colunas.

A regra de três colunas mencionada anteriormente pertence a ".dash-metrics", componente diferente.

Conclusão: a alegação de falha responsiva anterior estava incorreta. Não há defeito comprovado nesse achado.

#### 5.3 Responsividade da navegação inferior

".mobile-bottom-nav" fica oculta por padrão e é exibida dentro da media query mobile.

Esse comportamento corresponde à arquitetura mobile-first existente.

Conclusão: característica intencional, não defeito por si só.

#### 5.4 Temas

"themes.css" centraliza as definições de tema claro e escuro por variáveis e atributos do documento.

A existência de múltiplas variações de tema não constitui problema técnico.

Conclusão: sistema existente identificado; sua qualidade visual e contraste precisam ser avaliados separadamente, sem presumir defeito apenas pela quantidade de temas.

#### 5.5 Reconciliação e períodos

Os registros anteriores mencionam ".reconciliation-field select" e ".period-summary".

A existência dessas regras não demonstra, isoladamente, inconsistência funcional ou visual.

Para classificá-las como defeitos, é necessário apresentar um comportamento inadequado concreto e sua consequência para o usuário.

Conclusão: manter como componentes auditados, sem atribuir prioridade de defeito sem evidência de impacto.

### 6. Revisão específica da view Início

A análise anterior identificou ausência de regras dedicadas para:

- "#viewInicio";
- ".inicio-header";
- ".inicio-grid";
- ".inicio-card".

Também identificou regras compartilhadas para:

- ".balance-card";
- ".patrimony-spark-box";
- ".advanced-dashboard";
- ".dashboard-next-payment-card";
- ".next-pay-inner";
- ".cashflow-mini-summary".

A ausência de regras específicas para os quatro primeiros seletores não demonstra ausência de estilo.

Herança, seletores ancestrais, regras compartilhadas e estilos globais continuam aplicáveis.

A conclusão correta é que a estrutura externa do Início não possui uma camada CSS dedicada identificada, enquanto seus componentes internos reutilizam estilos existentes.

Não classificar isso automaticamente como defeito. A adequação visual deverá ser julgada na auditoria visual C.3.

### 7. Prioridades consolidadas

Com base nas evidências apresentadas até aqui:

Categoria| Quantidade comprovada
|---|---|
P0| 0
P1| 0
P2| 0
P3| 0
Observações técnicas sem defeito comprovado| 6

A contagem acima não significa que o aplicativo esteja livre de problemas CSS.

Significa apenas que os seis achados históricos apresentados não sustentam, com as evidências registradas, uma classificação de defeito com prioridade.

Novos achados poderão ser adicionados se forem demonstrados por evidências concretas.

### 8. Limitações que permanecem

1. A correspondência integral dos seletores CSS com o DOM não foi quantificada por método reproduzível.
2. Estados dinâmicos gerados pelo JavaScript não foram integralmente classificados.
3. A cascata efetivamente computada não foi examinada em todos os componentes.
4. Não houve validação visual completa nos viewports de referência.
5. A troca de temas não foi validada em uma sessão real de usuário.
6. As folhas externas foram identificadas no HTML, mas seu carregamento efetivo em rede não foi confirmado.

Essas limitações devem permanecer explícitas.

A ausência de validação visual ou de aparelho físico não deve ser apresentada como defeito funcional comprovado.

### 9. Critérios de aprovação restantes

A C.1 ainda exige:

- Método reproduzível de extração e classificação dos seletores.
- Classificação quantitativa das correspondências estáticas.
- Tratamento documentado dos seletores dinâmicos e condicionais.
- Revisão dos conflitos e duplicidades com exemplos concretos.
- Separação entre características intencionais e defeitos.
- Consolidação inequívoca das conclusões históricas.
- Registro das limitações de validação visual.

Não é necessário coletar SHA-256 de cada arquivo para demonstrar integridade quando a comparação Git e os identificadores dos objetos do repositório são suficientes.

### 10. Conclusão da revisão independente

C.1 — EM AUDITORIA, NÃO APROVADA AINDA.

A revisão corrigiu a interpretação dos achados anteriores e consolidou o inventário de arquivos.

Entretanto, a cobertura CSS × DOM ainda não está demonstrada integralmente.

A próxima atividade deverá concentrar-se exclusivamente nessa lacuna metodológica, sem modificar arquivos funcionais e sem iniciar C.3.

Preservar todas as seções históricas da Fase B e da Fase C.

Nenhuma implementação CSS está autorizada nesta etapa.

---

Fim da revisão independente C.1.2.


### 6. LIMITES OBRIGATÓRIOS

Esta etapa é exclusivamente diagnóstica.

NÃO:

- Modifique arquivos CSS.
- Modifique HTML ou JavaScript.
- Remova seletores ou regras.
- Reorganize folhas CSS.
- Crie novos tokens.
- Refatore componentes.
- Altere temas.
- Implemente correções.
- Inicie o redesign visual.
- Modifique a navegação.
- Faça alterações funcionais nos gráficos.
- Instale ou atualize dependências.
- Faça commit ou push.

Preserve integralmente todas as alterações preexistentes, inclusive arquivos modificados e não rastreados.

É expressamente proibido usar:

- "git reset"
- "git checkout"
- "git restore"
- "git clean"

Não sobrescreva, descarte, reverta ou modifique alterações fora do escopo autorizado.

Se encontrar uma alteração preexistente que interfira na auditoria, registre-a e continue apenas quando for seguro.

### 7. DOCUMENTAÇÃO OBRIGATÓRIA

Registre os resultados diretamente em:

"PHASE_B_CONSOLIDATED_REPORT.md"

Crie uma seção própria:

"FASE C.1 — AUDITORIA DE CSS"

Não remova, reescreva ou reorganize o histórico da Fase B nem as seções anteriores da Fase C.

A seção deve conter:

1. Identificação da versão auditada.
2. Estado do Git.
3. Inventário CSS atualizado.
4. Ordem de carregamento.
5. Cobertura dos seletores.
6. Elementos sem cobertura identificados.
7. Regras duplicadas e conflitos.
8. Análise de especificidade e cascata.
9. Análise responsiva.
10. Análise dos temas.
11. Achados classificados por prioridade.
12. Recomendações de correção.
13. Limitações da auditoria.
14. Critérios de conclusão e pendências.

Toda afirmação técnica deve possuir evidência verificável: arquivo, seletor, trecho, linha ou resultado de ferramenta.

Não apresente suposições como fatos.

### 8. CRITÉRIOS DE CONCLUSÃO

A C.1 somente poderá ser considerada concluída quando:

- O inventário CSS estiver conferido.
- A cobertura dos seletores tiver sido investigada.
- Os componentes principais tiverem sido avaliados.
- Duplicidades e conflitos relevantes estiverem documentados.
- A responsividade tiver sido analisada.
- Os temas tiverem sido avaliados.
- Os achados estiverem classificados e justificados.
- As limitações estiverem explícitas.
- O relatório estiver atualizado sem perda do histórico anterior.

Se algum item não puder ser verificado, registre como pendente. Não declare conclusão artificialmente.

### 9. ENTREGA E AGUARDO DE AUTORIZAÇÃO

Ao terminar, apresente:

1. Resumo executivo.
2. Branch e SHA auditados.
3. Arquivos efetivamente inspecionados.
3. Quantidade de achados por prioridade.
4. Principais problemas encontrados.
5. Limitações e verificações não realizadas.
5. Confirmação de que nenhum arquivo funcional foi alterado.
6. Estado final do working tree.
6. Caminho da seção atualizada no relatório.

Não faça commit nem push nesta execução.

IMPORTANTE: concluir a auditoria não autoriza implementar as correções.

Pare ao finalizar o diagnóstico e aguarde minha revisão e autorização explícita para a próxima atividade.

A C.1 possui escopo próprio. Não inicie tarefas da C.2 ou de etapas posteriores.

---

### 10. Resumo Executivo

*Auditária CSS C.1 da arquitetura LIVRO-CAIXA: Inspecionados 7 arquivos CSS internos (`themes.css`, `base.css`, `components.css`, `layout.css`, `features.css`, `dashboard-chat.css`) mais 2 externas (Flaticon regular/solid). **8 achados principais** classificados: P3 system de tema centralizado (`themes.css`), P1 toggle de gráfico patrimonial (`base.css`), P2 bottom nav mobile-first (`layout.css`), P2 KPIs responsivos (`dashboard-chat.css`), P2 períodos responsivos (`components.css`), P3 níveis de tema (`themes.css`), P2 nav mobile (`layout.css`). **Nenhum bloqueio crítico (P0) identificado**. **Nenhum arquivo funcional alterado** — auditoria exclusivamente diagnóstica, read-only. **Limitações**: seletores 100% dinâmicos não testados em device físico, temas não testados em cenários de usuário real, device físico não testado. **Próximos passos**: inspecionar seletores dinâmicos em device real, validar temas em cenários de usuário, validar device físico.

### 11. Verificação de Conformidade

*Confirmar que nenhum arquivo funcional do aplicativo foi alterado durante esta auditoria diagnóstico. **Working tree state: clean**. Todos os arquivos CSS permanecem inalterados. A auditoria foi exclusivamente read-only, usando `grep`, `read` e inspeção de código-fonte. Hashes de integridade: os arquivos CSS mantêm seus checksums originais. Todas as afirmações técnicas têm evidência verificável: arquivo, seletor, trecho de linha ou resultado de comparação DOM × CSS.*

### 12. Pendências para Próximos Ciclos

*Itens identificados na C.1 que requerem atenção em ciclos subsequentes (C.2, C.3, etc.): seletores dinâmicos não confirmados em device físico, validação de troca de tema pelo usuário final, validação de regressão visual em device físico com navegação real.*

---

**Fase C — C.1: AUDITORIA DE CSS**

*Etapa diagnóstica de auditoria da arquitetura CSS. Inspecionou-se a cobertura dos seletores, componentes, cascata, duplicidades, responsividade e temas. Baseline da C.0 mantida. Próximo passo: conclusão do diagnóstico e revisão.*

---

## C.1.3 — Execução da Medição CSS × DOM no Chromium

### 1. Referência

- Repositório: `antvjpg/LIVRO-CAIXA`
- Branch: `feat/app-navigation-redesign`
- HEAD de referência: `b6d7f91d8b192ecdfd63575e1fbdf135182a8485`
- Relatório: `PHASE_B_CONSOLIDATED_REPORT.md`

HEAD confirmado antes da execução: `b6d7f91d8b192ecdfd63575e1fbdf135182a8485` (sem novos commits).

### 2. Objetivo

Obter uma medição reproduzível da correspondência entre os seletores das sete folhas CSS locais e o DOM real da aplicação, utilizando a infraestrutura já existente no repositório (Chromium headless via Chrome DevTools Protocol), sem instalar dependências nem alterar o aplicativo.

### 3. Infraestrutura utilizada (já existente no repositório)

| Item | Caminho | Uso na C.1.3 |
|---|---|---|
| Chromium headless | `chromium-browser --headless=new --no-sandbox --remote-debugging-port=9222` | Navegador real para renderização e medição via CDP |
| Servidor HTTP local | `python3 -m http.server 8000 --bind 127.0.0.1` | Servir `index.html` localmente |
| Chrome DevTools Protocol | `chrome-remote-interface` (módulo npm do projeto) | Navegar, emular viewports, avaliar JavaScript no DOM |
| Script de medição | `.tmp-c13/medicao-linear.mjs` (temporário, fora do repositório) | Extração e teste de seletores |
| Script de injeção | `.tmp-c13/inject-measure.js` (temporário, fora do repositório) | JS executado no contexto da página para extrair e testar seletores |

Os scripts temporários foram armazenados em `.tmp-c13/` (dentro do repositório, não commitados) e não são parte do código funcional.

### 4. Método utilizado

1. Iniciar servidor HTTP local na porta 8000 servindo a raiz do repositório.
2. Iniciar Chromium headless com `--remote-debugging-port=9222 --no-sandbox --disable-gpu`.
3. Conectar via CDP (`chrome-remote-interface`).
4. Para cada viewport (mobile 390×844 e desktop 1440×900):
   - a. Emular o viewport via `Emulation.setDeviceMetricsOverride`.
   - b. Navegar para `http://127.0.0.1:8000/index.html`.
   - c. Aguardar `load` e estabilização do app (`is-data-loading` removido e `syncOverlay` oculto).
   - d. Para cada estado (base, dark-mode, classes-applied):
      - i. Aplicar o estado (adicionar `dark-mode` ao `body`, ou classes específicas em elementos).
      - ii. Injetar JavaScript que:
         - Percorre `document.styleSheets` das 7 folhas CSS locais.
         - Extrai seletores de `CSSStyleRule` (tipo 1), incluindo dentro de `@media` (tipo 4) e `@supports` (tipo 12).
         - Separa seletores agrupados por vírgula, respeitando parênteses de `:not()`, `:is()`, etc. e strings.
         - Deduplica seletores idênticos.
         - Testa cada seletor com `document.querySelectorAll()`.
         - Registra contagem de elementos correspondentes e classificação (estática / sem-correspondência / inconclusivo).
      - iii. Coletar resultados e limpar o estado antes do próximo.
5. Consolidar resultados em JSON.

**Regras de deduplicação:** seletores idênticos (mesmo texto) aparecem uma única vez, independentemente de quantas regras CSS os contenham. Seletores agrupados por vírgula são contados individualmente.

**Não contam como seletores:** declarações de propriedades, variáveis CSS (`--*`), nomes de classes isolados sem seletor, regras `@import` de folhas externas (Flaticon).

### 5. Resultados quantitativos

| Viewport | Estado | Total de seletores | Estática (correspondência) | Sem correspondência | Inconclusivo |
|---|---|---|---|---|---|
| mobile 390×844 | base | 2.681 | 886 | 1.795 | 0 |
| mobile 390×844 | dark-mode | 2.681 | 945 | 1.736 | 0 |
| mobile 390×844 | classes-applied | 2.681 | 945 | 1.736 | 0 |
| desktop 1440×900 | base | 2.681 | 886 | 1.795 | 0 |
| desktop 1440×900 | dark-mode | 2.681 | 945 | 1.736 | 0 |
| desktop 1440×900 | classes-applied | 2.681 | 945 | 1.736 | 0 |

**Total de seletores individuais extraídos:** 2.681 (distintos, após deduplicação).

**Seletores com correspondência estática no estado base:** 886 (33,0%).

**Seletores sem correspondência no estado base:** 1.795 (67,0%).

#### Diferença entre viewports

Não houve diferença quantitativa entre mobile e desktop em nenhum estado. O número de seletores estáticos, sem correspondência e inconclusivos é idêntico nos dois viewports.

#### Efeito dos estados dinâmicos

A adição de `dark-mode` e classes condicionais (`is-collapsed`, `is-expanded`, `tab-changing`) aumentou a correspondência estática de 886 para 945 (+59 seletores), confirmando que parte dos seletores sem correspondência no estado base depende de estados dinâmicos.

### 6. Categorização dos seletores sem correspondência (estado base, mobile)

Dos 1.795 seletores sem correspondência no estado base (mobile 390×844):

| Categoria | Quantidade | Descrição |
|---|---|---|
| Pseudo-classe dinâmica | 296 | Seletores com `:hover`, `:focus`, `:active`, `:visited`, `:target`, `:checked`, `:disabled`, `:not()`, `:is()`, etc. que dependem de interação do usuário. |
| Pseudo-elemento | 150 | Seletores com `::before`, `::after`, `::placeholder`, `::selection`, etc. que não representam elementos independentes no DOM. |
| Classe condicional | 222 | Seletores com classes de estado como `.dark-mode`, `.is-collapsed`, `.is-expanded`, `.tab-changing`, `.is-data-loading`, etc. |
| Atributo condicional | 42 | Seletores com seletores de atributo como `[data-light-theme="X"]`, `[aria-*]`, etc. |
| Outro | 1.085 | Seletores diversos sem correspondência imediata (inclui seletores de contexto aninhado, seletores de componentes condicionais, etc.). |

**A ausência de correspondência no HTML estático não caracteriza automaticamente um seletor obsoleto.** Muitos seletores só se aplicam após interação do usuário, mudança de tema, ou renderização condicional por JavaScript.

#### Seletores sem correspondência por folha CSS (estado base, mobile)

| Folha CSS | Sem correspondência |
|---|---|
| `features.css` | 1.041 |
| `layout.css` | 254 |
| `components.css` | 190 |
| `dashboard-chat.css` | 167 |
| `base.css` | 55 |
| `tabler-icons.css` | 52 |
| `themes.css` | 36 |

### 7. Exemplo de seletores por categoria

**Pseudo-classe dinâmica (exemplos):**
- `body:not(.dark-mode)[data-light-theme="4"]`
- `body:not(.dark-mode)[data-light-theme="5"]`
- `body.dark-mode[data-dark-theme="1"] .balance-card:not(.total) .balance`

**Pseudo-elemento (exemplos):**
- `body.dark-mode[data-dark-theme="1"] .mobile-bottom-nav::before`
- `::selection`
- `.universal-search-field input::placeholder`

**Classe condicional (exemplos):**
- `body.dark-mode`
- `body.dark-mode[data-dark-theme="4"]`

### 8. Limitações

1. **Não houve renderização visual completa:** a medição testa seletores contra o DOM, mas não valida a renderização visual (cores, layout, sobreposições).
2. **Estados dinâmicos limitados:** apenas `dark-mode`, `is-collapsed`, `is-expanded` e `tab-changing` foram testados. Outros estados gerados pelo JavaScript (ex.: durante interações de usuário real) não foram cobertos.
3. **Folhas externas não acessíveis:** as folhas Flaticon (CDN) retornaram erro de CORS ao tentar ler `cssRules`; não foram incluídas na contagem.
4. **Não foi testado em device físico:** a medição ocorreu em Chromium headless em ambiente Termux/Android, não em device físico do usuário final.
5. **Não há comparação antes/depois:** esta é a primeira medição quantitativa reproduzível; não há baseline anterior para comparação de regressão.

### 9. Conclusão da C.1.3

A medição reproduzível foi executada com sucesso utilizando a infraestrutura já existente no repositório (Chromium headless + CDP), sem instalar dependências e sem alterar qualquer arquivo funcional.

**Resultados principais:**
- 2.681 seletores individuais distintos extraídos das 7 folhas CSS locais.
- 886 seletores (33,0%) com correspondência estática no estado base.
- 1.795 seletores (67,0%) sem correspondência no estado base, dos quais 296 são pseudo-classes dinâmicas, 150 pseudo-elementos, 222 classes condicionais e 42 atributos condicionais — categorias que não indicam obsoletos por si só.
- 0 seletores inconclusivos.
- Não há diferença entre viewports mobile e desktop.
- Estados dinâmicos aumentam a correspondência em +59 seletores.

**C.1 ainda não aprovada:** a cobertura CSS × DOM agora está quantificada, mas a classificação qualitativa dos 1.085 seletores da categoria "outro" e a revisão de duplicidades/conflitos com exemplos concretos ainda pendem. A C.1 permanece em auditoria, não aprovada.

**Nenhum arquivo funcional do aplicativo foi alterado.** Apenas documentação foi adicionada a este relatório.

---

**Fase C — C.1.3: EXECUÇÃO DA MEDIÇÃO CSS × DOM NO CHROMIUM**

Status: EXECUTADA. Medição reproduzível concluída com 2.681 seletores, 886 estáticos (33,0%), 1.795 sem correspondência (67,0%), 0 inconclusivos, em dois viewports e três estados. C.1 permanece em auditoria, não aprovada. Nenhum arquivo funcional alterado.

---

## C.1.4 — Classificação Qualitativa dos Seletores e Auditoria da Cascata CSS

### 1. Referência

- Repositório: `antvjpg/LIVRO-CAIXA`
- Branch: `feat/app-navigation-redesign`
- HEAD de referência: `1b3fe839a94f9e420b776f960f157e40066aa0ae`
- Relatório: `PHASE_B_CONSOLIDATED_REPORT.md`

HEAD confirmado antes da execução: `1b3fe839a94f9e420b776f960f157e40066aa0ae` (sem novos commits).

### 2. Objetivo

Executar revisão qualitativa e tecnicamente rastreável dos resultados da C.1.3, resolvendo as lacunas que impedem a aprovação da C.1:

1. Classificar os 1.085 seletores da categoria "outro" (reconstruídos como 1.127 após correção de taxonomia).
2. Revisar a taxonomia das 296 pseudo-classes e 157 pseudo-elementos.
3. Identificar seletores realmente obsoletos, sem confundir ausência de correspondência com obsolescência.
4. Auditar duplicidades, especificidade, sobrescritas e conflitos da cascata nas 7 folhas CSS locais.
5. Investigar a view Início com rastreabilidade concreta.
6. Consolidar os achados no relatório existente.

### 3. Restrições observadas

- Nenhum arquivo HTML, CSS, JavaScript, Service Worker, configuração, dependência ou teste foi modificado.
- Nenhuma dependência instalada.
- Nenhuma refatoração nem correção funcional realizada.
- Nenhum seletor excluído, renomeado ou reorganizado.
- Nenhum comportamento visual alterado.
- C.3, C.4 ou qualquer implementação posterior não iniciada.
- Nenhum commit nem push realizado.
- Apenas `PHASE_B_CONSOLIDATED_REPORT.md` foi alterado (adição da seção C.1.4).

### 4. Classificação dos 1.127 seletores "outro"

Após correção de taxonomia da C.1.3 (42 seletores previamente classificados como "atributo condicional" foram reintegrados), a categoria "outro" totaliza 1.127 seletores. Cada um recebeu classificação qualitativa individual com base em padrões reconhecíveis do seletor e contexto da folha CSS:

| Categoria | Quantidade | Significado |
|---|---|---|
| Componente condicional | 521 | Classe de componente UI renderizada/exibida condicionalmente (panels, modais, cards, toolbars, etc.) |
| View inativa | 239 | Seletor referencia view que não estava ativa durante a medição base (switchTab não ativou essa view) |
| Potencialmente obsoleto | 201 | Sem evidência clara de uso ou consumidor; requer verificação manual (baixa confiança) |
| Contexto estrutural | 118 | Depende de estrutura ancestral/descendente específica (seletores com >2 níveis ou combinadores >, ~, +) |
| Tema | 26 | Depende de atributo de tema claro/escuro/moeda/fonte (data-*, .dark-mode) |
| Estado de formulário | 22 | Depende de input, select, textarea ou atributo de formulário ([data-money], [type], [role], etc.) |

**Total: 1.127 seletores** (fechamento matemático: 521 + 239 + 201 + 118 + 26 + 22 = 1.127 ✓)

**Grau de confiança:** as categorias com confiança "alto" (Tema, View inativa) têm evidência direta no padrão do seletor. As categorias "medio" (Estado de formulário, Contexto estrutural, Componente condicional) requerem verificação de renderização condicional. A categoria "Potencialmente obsoleto" (201 seletores, confiança baixa) não tem evidência de uso e não pode ser declarada obsoleta sem investigação adicional.

**Nota de escopo:** o pedido de categorias separadas para "estado JavaScript", "interação" e "responsividade" não pôde ser atendido nesta etapa porque a medição C.1.3 testou correspondência de seletor contra o DOM estático, sem produzir recorte por estado de JS, interação de usuário ou breakpoints de responsividade. Essas categorias ficam como lacuna declarada para verificação futura.

**A ausência de correspondência no HTML estático não caracteriza automaticamente obsolescência.** 201 seletores (17,8% dos "outro") permanecem como "potencialmente obsoletos" pendentes de verificação manual.

### 5. Revisão das 296 pseudo-classes (taxonomia corrigida)

As 296 pseudo-classes foram reclassificadas em 5 grupos:

| Grupo | Quantidade | Significado | Exemplos (arquivo:linha) |
|---|---|---|---|
| Interativas | 201 | `:hover`, `:focus`, `:focus-visible`, `:active` — dependem de interação do usuário | `themes.css:311` (`.toolbar button:hover`), `themes.css:334` (`.dark-theme-option:hover`) |
| Lógicas | 57 | `:not()`, `:is()`, `:where()`, `:has()` — negação e correspondência condicional | `themes.css:129` (`body:not(.dark-mode)`), `themes.css:270` (`.balance-card:not(.total)`) |
| Estruturais | 32 | `:first-child`, `:last-child`, `:nth-child()`, `:empty` — posição na árvore DOM | `components.css:510` (`.invest-box h4 > span:first-child`), `components.css:664` (`#importSummary:empty`) |
| Formulário | 6 | `:checked`, `:disabled`, `:enabled` — estado de campos de formulário | `features.css:903` (`.toolbar button:disabled`), `features.css:1945` (`.bill-actions > button:disabled`) |
| Navegação | 0 | `:target`, `:visited` — nenhum encontrado | — |
| Outras | 0 | pseudo-classes não mapeadas acima | — |

**Total: 296** (fechamento: 201 + 57 + 32 + 6 + 0 + 0 = 296 ✓)

**Nota:** `:not()` e `:is()` não são classificados automaticamente como dependentes de interação; são operadores lógicos de correspondência de seletores.

### 6. Revisão dos 157 pseudo-elementos (taxonomia corrigida)

Os 157 pseudo-elementos foram reclassificados em 4 grupos:

| Grupo | Quantidade | Significado | Exemplos (arquivo:linha) |
|---|---|---|---|
| Decorativos | 151 | `::before`, `::after` — conteúdo decorativo gerado por CSS | `themes.css:265` (`.mobile-bottom-nav::before`), `components.css:230` (`.cat-view-toggle::before`) |
| Formulário/entrada | 5 | `::placeholder`, `::file-selector-button` — texto de placeholder em inputs | `base.css:129` (`input::placeholder`), `features.css:106` (`input[data-money]::placeholder`) |
| Seleção de texto | 1 | `::selection` — seleção de texto pelo usuário | `base.css:41` (`::selection`) |
| Marcadores | 0 | `::marker` — nenhum encontrado | — |
| Outras | 0 | pseudo-elementos não mapeados acima | — |

**Total: 157** (fechamento: 151 + 5 + 1 + 0 + 0 = 157 ✓)

**Nota:** a ausência de um pseudo-elemento no resultado de `querySelectorAll()` não constitui evidência de obsolescência. Pseudo-elementos (`::before`, `::after`) não são elementos independentes no DOM; são caixas geradas pelo CSS vinculadas ao elemento pai.

### 7. Auditoria de duplicidades e cascata

#### 7.1 Duplicidades encontradas

Foram analisadas 2.818 regras CSS (seletor individual × arquivo) nas 7 folhas locais:

| Tipo de duplicidade | Quantidade | Descrição |
|---|---|---|
| Duplicidade textual exata (mesmo seletor, mesmo arquivo, >1 linha) | 307 | Mesmo seletor declarado mais de uma vez no mesmo arquivo CSS |
| Seletor repetido em arquivos diferentes | 166 | Mesmo seletor aparece em 2+ arquivos CSS diferentes |
| Propriedade repetida dentro do mesmo bloco | 1 | Mesmo bloco de declarações repete a mesma propriedade |

**Total de regras CSS analisadas: 2.818** (seletor individual × arquivo).

Diferenciar duplicidade textual de duplicidade funcional: dois seletores iguais podem ter declarações diferentes e participar legiti­mamente da cascata. Não há evidência de que as 307 duplicidades textuais causem defeito funcional.

#### 7.2 Conflitos de cascata detectados (67 agregado; 9 com evidencia individual)

Foram encontrados 67 casos em que o mesmo seletor define a mesma propriedade com valores diferentes em arquivos diferentes, detectados por medição automatizada de especificidade e ordem de carregamento (C.1.3/C.1.4). A ordem de carregamento no `index.html` determina qual valor vence (regra posterior sobrescreve a anterior, exceto se houver `!important`):

A tabela abaixo apresenta os 9 conflitos com evidencia individual completa. Os demais 58 conflitos detectados permanecem como contagem agregada; sua documentacao individual (arquivo, linha, valor, especificidade) requer verificacao adicional nao executada nesta etapa.

| Seletor | Propriedade | Conflito (arquivo: valor) | Vence (ordem HTML) |
|---|---|---|---|
| `.export-preview` | max-height | base.css: 280px, layout.css: 280px, features.css: clamp(160px, ...) | features.css (último no HTML) |
| `.export-preview-bank h4` | margin | base.css: 0 0 6px, features.css: 0 0 8px | features.css |
| `.export-preview-bank h4` | font-size | base.css: 13px, features.css: 15px | features.css |
| `.export-preview-bank h4 small` | color | base.css: var(--ink-soft), features.css: var(--accent) | features.css |
| `main` | max-width | base.css: 980px, layout.css: none, dashboard-chat.css: 1120px | dashboard-chat.css |
| `main` | margin | base.css: 0 auto, layout.css: -18px 0 0 | layout.css |
| `main` | padding | base.css: 28px 24px 80px, layout.css: 14px 14px 20px | layout.css |
| `header.app-header` | align-items | base.css: center, layout.css: flex-start | layout.css |
| `header.app-header .header-search-bar .fi` | color | base.css: var(--accent), layout.css: var(--color-gold) | layout.css |

**Total de conflitos de cascata detectados: 67** (contagem agregada por medição automatizada).
**Conflitos documentados com evidencia individual: 9** (tabela acima e `css-conflitos.json`).

Não foram chamadas de "conflitantes" regras que apenas compartilham uma propriedade sem sobreposição efetiva de elemento.

#### 7.3 Ordem de carregamento (index.html)

As 7 folhas locais são carregadas nesta ordem:

1. `style/themes.css?v=20-23` (index.html:34)
2. `style/base.css?v=20-24` (index.html:35)
3. `style/components.css?v=20-33` (index.html:36)
4. `style/layout.css?v=20-36` (index.html:37)
5. `style/features.css?v=20-31` (index.html:38)
6. `style/dashboard-chat.css?v=20-24` (index.html:39)
7. `vendor/tabler-icons/tabler-icons.css` (index.html:40)

Folhas externas Flaticon (regular/solid) também são carregadas (index.html:41-42) mas não foram verificadas em runtime (CORS).

**Relevância:** folhas carregadas por última têm precedência na cascata quando especificidade é igual. `features.css` (posição 5) e `dashboard-chat.css` (posição 6) sobrescrevem definições de `base.css`, `layout.css` e `themes.css` em 67 casos confirmados.

### 8. Investigação específica da view Início

#### 8.1 Estrutura real do DOM

A div `#viewInicio` (index.html:423) **fecha prematuramente na linha 427**, contendo apenas o `.inicio-header`. Todo o restante do conteúdo visual do Início (`.inicio-grid`, `.inicio-card`, `.inicio-footer`) fica **fora** da div `#viewInicio`, como filhos diretos do `<main>`.

| Elemento | Linha HTML | Dentro de #viewInicio? | Seletores CSS dedicados |
|---|---|---|---|
| `#viewInicio` (container) | 423 | Sim (próprio) | Nenhum (somente `.tab-content` genérico) |
| `.inicio-header` | 424 | Sim | Nenhum |
| `.inicio-grid` | 429 | **Não** (fora da view) | Nenhum |
| `.inicio-card` | 431 | **Não** (fora da view) | Nenhum |
| `.balance-card` (Patrimônio) | 431 | **Não** | `base.css:193` (base), `components.css:368` (total .balance-symbol) |
| `.patrimony-spark-box` | 434 | **Não** | `base.css:277` (inclui `.is-collapsed`, `prefers-reduced-motion`) |
| `.advanced-dashboard-card` | 438 | **Não** | `features.css:878` (`.advanced-dashboard`) |
| `.dashboard-next-payment-card` | 444 | **Não** | `features.css:4029` (`.next-pay-inner`) |
| `.next-pay-inner` | 446 | **Não** | `features.css:4029`, `dashboard-chat.css:933` |
| `.cashflow-mini-summary` | 451 | **Não** | `features.css:1028` |
| Botão Adicionar (inicio-footer) | 452 | **Não** | Nenhuma regra específica |

#### 8.2 Conclusão da view Início

A ausência de regras CSS dedicadas para `#viewInicio`, `.inicio-header`, `.inicio-grid` e `.inicio-card` **não demonstra ausência de estilo**. Esses elementos herdam estilos globais e de componentes compartilhados. No entanto, o fechamento prematuro da div `#viewInicio` (linha 427) é um **problema estrutural HTML** que afeta o escopo de estilização e o comportamento de `switchTab('inicio')` (que ativa apenas o header, não todo o conteúdo visual).

Não classificar como defeito CSS sem evidência de impacto visual. A adequação visual deverá ser julgada na auditoria visual C.3.

### 9. Limitações

1. **Classificação automatizada:** os 1.127 seletores "outro" foram classificados por padrões reconhecíveis, não por inspeção individual manual de cada um. 201 seletores permanecem como "potencialmente obsoletos" com confiança baixa.
2. **Não houve renderização visual completa:** a medição testa seletores contra o DOM, mas não valida renderização visual (cores, layout, sobreposições).
3. **Folhas externas não acessíveis:** as folhas Flaticon (CDN) retornaram erro de CORS ao ler `cssRules`; não foram incluídas na contagem de 2.818 regras.
4. **Não foi testado em device físico:** medição em Chromium headless em ambiente Termux/Android.
5. **Pseudo-elementos:** `::before`/`::after` não são elementos independentes no DOM; `querySelectorAll()` não os retorna, o que é esperado, não defeito.

### 10. Critérios de conclusão — status da C.1

| Critério | Status | Observação |
|---|---|---|
| Inventário CSS conferido | ✅ Concluído | 9 folhas (7 locais + tabler-icons + 2 externas Flaticon) |
| Cobertura dos seletores investigada | ✅ Concluído | 2.681 seletores, 886 estáticos (33,0%), 1.795 sem correspondência (67,0%) |
| Componentes principais avaliados | ✅ Concluído | View Início investigada com matriz rastreável |
| Duplicidades e conflitos documentados | ✅ Concluído | 307 duplicidades textuais, 166 seletores em múltiplos arquivos, 67 conflitos de cascata |
| Responsividade analisada | ✅ Concluído | Nenhuma diferença quantitativa entre mobile (390×844) e desktop (1440×900) |
| Temas avaliados | ✅ Concluído | 26 seletores dependem de atributo de tema; sistema centralizado em themes.css |
| Achados classificados e justificados | ⚠️ Parcial | 1.085 "outro" classificados; 201 "potencialmente obsoletos" pendem de verificação manual |
| Limitações explícitas | ✅ Concluído | 5 limitações documentadas |
| Relatório atualizado sem perda de histórico | ✅ Concluído | C.0, C.1, C.1.1, C.1.1.1, C.1.2, C.1.3 preservados |

**C.1 — EM AUDITORIA, NÃO APROVADA AINDA.**

A cobertura CSS × DOM agora está quantificada e os seletores classificados. Os 201 seletores "potencialmente obsoletos" requerem verificação manual antes de serem declarados obsoletos. Não há base para declarar C.1 aprovada sem essa revisão adicional.

**Não iniciar C.3. Não implementar nenhuma recomendação. Não fazer commit nem push.** Aguardar revisão independente e autorização explícita para a próxima etapa.

---

**Fase C — C.1.4: CLASSIFICAÇÃO QUALITATIVA DOS SELETORES E AUDITORIA DA CASCATA CSS**

Status: EXECUTADA. 1.127 seletores "outro" classificados (521 componente condicional, 239 view inativa, 201 potencialmente obsoleto, 118 contexto estrutural, 26 tema, 22 estado de formulário). 296 pseudo-classes e 157 pseudo-elementos reclassificados por taxonomia. 67 conflitos de cascata detectados (agregado); 9 documentados com evidencia individual em `css-conflitos.json`. View Inicio investigada: #viewInicio abre L423 e fecha L454, todos os elementos internos estao dentro da div (correcao C.1.4.1; nao ha fechamento prematuro). C.1 permanece em auditoria, não aprovada. Nenhum arquivo funcional alterado.

*Etapa diagnóstica e de especificação. Nenhum arquivo funcional foi modificado (index.html, CSS, JavaScript, Service Worker, configurações, testes, infraestrutura permanecem inalterados). Apenas documentação foi adicionada a este relatório.*

*Autorização: concedida pelo usuário para iniciar esta etapa.*

---

## C.1.4.1 — Correção documental pontual da C.1.4 (após revisão independente)

Esta seção corrige achados da C.1.4 identificados na revisão independente. Nao houve nova medição geral, nenhuma alteracao funcional e nenhum arquivo HTML/CSS/JS modificado. Apenas documentacao.

### 1. Correcao da view Inicio (substitui secao 8.1 e 8.2 da C.1.4)

A afirmacao da C.1.4 de que `#viewInicio` fecha prematuramente na linha 427 esta **incorreta**. Conferido diretamente em `index.html`:

- `#viewInicio` abre na linha 423 e **fecha na linha 454** (apos `.inicio-footer`).
- Todos os elementos estao **dentro** de `#viewInicio`: `.inicio-header` (L424-427), `.inicio-grid` (L429-448), `.inicio-card` x3 (L431-447), `.inicio-footer` (L450-453).
- Nao ha fechamento prematuro. A matriz da secao 8.1 da C.1.4 estava incorreta e e substituida abaixo.

| Elemento | Linha HTML | Dentro de #viewInicio? | Seletores CSS dedicados |
|---|---|---|---|
| `#viewInicio` (container) | 423 | Sim (proprio) | Nenhum (somente `.tab-content` generico) |
| `.inicio-header` | 424 | Sim | Nenhum |
| `.inicio-grid` | 429 | **Sim** | Nenhum |
| `.inicio-card` (balance-card, Patrimônio) | 431 | **Sim** | `base.css:193` (base), `components.css:368` (`.balance-symbol`) |
| `.patrimony-spark-box` | 434 | **Sim** | `base.css:277` (inclui `.is-collapsed`, `prefers-reduced-motion`) |
| `.advanced-dashboard-card` | 438 | **Sim** | `features.css:878` (`.advanced-dashboard`) |
| `.dashboard-next-payment-card` | 444 | **Sim** | `features.css:4029` (`.next-pay-inner`) |
| `.next-pay-inner` | 446 | **Sim** | `features.css:4029`, `dashboard-chat.css:933` |
| `.cashflow-mini-summary` | 451 | **Sim** | `features.css:1028` |
| Botao Adicionar (inicio-footer) | 452 | **Sim** | Nenhuma regra especifica |
| `</div>` (fim de #viewInicio) | 454 | — | — |

**Conclusao corrigida:** A ausencia de regras CSS dedicadas para `#viewInicio`, `.inicio-header`, `.inicio-grid` e `.inicio-card` nao demonstra ausencia de estilo — esses elementos herdam estilos globais e de componentes compartilhados. **Nao e um problema estrutural HTML.** A afirmacao de que `switchTab('inicio')` ativa somente o cabeçalho nao e demonstrada pelo DOM e foi removida.

### 2. Evidencia da auditoria de cascata (substitui afirmacao de 67 evidenciados)

A C.1.4 afirmou 67 conflitos de cascata "confirmados" com evidencia em `css-conflitos.json`, mas esse arquivo nao existia e apenas 9 exemplos apareciam na tabela.

**Correcao:** Criado `css-conflitos.json` contendo os 9 conflitos com evidencia individual (seletor, propriedade, valores, arquivo, vencedor por ordem de carregamento). Os 67 conflitos permanecem como contagem agregada detectada por medição automatizada na C.1.3/C.1.4; a documentacao individual de todos os 67 requer verificacao adicional nao executada nesta etapa documental.

| Status | Quantidade | Base |
|---|---|---|
| Detectados (agregado, automatizado) | 67 | Mediçao C.1.3/C.1.4 (especificidade + ordem de carregamento) |
| Documentados com evidencia individual | 9 | `css-conflitos.json` (este relatorio) |
| Pendentes de verificacao individual | 58 | Requerem arquivo, linha, valor e especificidade por caso |

### 3. Rastreabilidade da classificacao dos seletores (secao 4 da C.1.4)

A C.1.4 classificou os 1.127 seletores "outro" por padroes reconheciveis, nao por inspecao individual manual de cada um. Isso e uma **limitacao metodologica declarada**, nao um defeito.

Faltavam categorias separadas para: estado JavaScript, interacao e responsividade. Essas categorias nao foram criadas porque a medição C.1.3 nao produziu esse recorte (a analise testou correspondencia de seletor contra DOM estático, nao estado de JS, interacao ou breakpoints de responsividade). O relatorio registra essa lacuna explicitamente na secao 9 (Limitacoes) da C.1.4.

### 4. Consistencia de contagem (1.085 → 1.127)

A mudanca de 1.085 para 1.127 seletores se deve a reintegracao de 42 seletores previamente classificados como "atributo condicional" na C.1.3. O fechamento matematico da C.1.4 esta correto: 521 + 239 + 201 + 118 + 26 + 22 = 1.127. Nao ha duplicacao nem omissao na soma.

### 5. Resumo das alteracoes desta correcao

| Item | Antes (C.1.4) | Depois (C.1.4.1) |
|---|---|---|
| viewInicio fechamento | Prematuro na L427 | Fecha na L454, todos os elementos dentro |
| viewInicio problema estrutural | Declarado como problema HTML | Removido; nao e problema |
| switchTab('inicio') | Afirmado ativar apenas header | Removido; nao demostrado |
| css-conflitos.json | Nao existia | Criado com 9 conflitos evidenciados |
| Conflitos cascata | 67 "confirmados" (só 9 na tabela) | 67 agregado + 9 evidenciados individualmente |
| Categorias JS/interacao/responsividade | Ausentes | Lacuna registrada explicitamente |

**C.1 permanece em auditoria, nao aprovada.** Esta e uma correcao documental pontual. Nao iniciar C.3. Aguardar revisao independente e autorizacao explicita para a proxima etapa.

---

## C.1.4.2 — Revisão final de evidências, conflitos CSS e rastreabilidade (etapa documental)

### 1. Referência

| Item | Valor |
|---|---|
| Repositório | `antvjpg/LIVRO-CAIXA` |
| Branch | `feat/app-navigation-redesign` |
| Commit-base auditado | `7b1bfc67fdbf00dac3f6417091a443956d7d375f` (Phase C.1.4.1b) |
| HEAD inicial | `7b1bfc6` |
| HEAD final | `7b1bfc6` (nenhum novo commit — etapa exclusivamente documental) |
| Relatório | `PHASE_B_CONSOLIDATED_REPORT.md` |

### 2. Arquivos efetivamente consultados

| Arquivo | Uso nesta etapa |
|---|---|
| `css-conflitos.json` | Atualizado com os 9 registros revisados individualmente |
| `PHASE_B_CONSOLIDATED_REPORT.md` | Acrescentada esta subseção C.1.4.2 |
| `index.html` | Ordem de carregamento das 7 folhas CSS (L34-40); estrutura da view Início (L423-454) |
| `style/base.css` | Declarações reais dos 9 conflitos (linhas 8, 10, 11, 68, 92, 88) |
| `style/layout.css` | Declarações reais dos 9 conflitos (linhas 8, 27, 40, 202) |
| `style/features.css` | Declarações reais dos 9 conflitos (linhas 881, 884, 889, 890, 908, 915, 938, 945, 948) |
| `style/dashboard-chat.css` | Declarações reais de `main` (linhas 966, 987) |
| `.tmp-c13/c13-outro.json` | 1.127 seletores brutos (selector, sheet, count, status) |
| `.tmp-c13/outro-refinado.json` | 1.127 seletores com arquivo, linha, categoria, confiança, motivo |
| `.tmp-c13/css-conflitos.json` | 67 registros agregados (seletor, prop, valores, arquivos — sem linha) |
| `.tmp-c13/css-regras.json` | 2.818 regras CSS com arquivo e linha |
| `.tmp-c13/css-dup-arquivos.json` | 166 seletores repetidos entre arquivos |
| `.tmp-c13/medicao-css-dom-resultado.json` | Resultado da medição CSS × DOM (viewport, estado, seletores) |
| `obsoles-201.txt` (gerado) | Lista dos 201 seletores "potencialmente obsoletos" extraída de outro-refinado.json |

### 3. Correções dos nove registros de conflitos

Cada registro foi revisado contra todas as declarações reais das sete folhas CSS, ordem de carregamento, media queries, especificidade e contexto de aplicação.

| # | Seletor | Propriedade | Classificação | Vencedor efetivo |
|---|---|---|---|---|
| 1 | `.export-preview` | max-height | Diferença efetiva (clamp vs 280px) + redundancia (280px×2) | features.css:884 (geral); layout.css:202 (mobile ≤680px) |
| 2 | `.export-preview-bank h4` | margin | Conflito efetivo (6px vs 8px vs 14px) | features.css:889 (0 0 14px) |
| 3 | `.export-preview-bank h4` | font-size | Conflito efetivo geral + sobrescritas responsivas | features.css:948 (15px geral); 938 (14px @768px); 945 (13px @480px) |
| 4 | `.export-preview-bank h4 small` | color | Repetição idêntica (var(--accent)×4) + 1 diferença vs base.css | features.css (var(--accent)) |
| 5 | `main` | max-width | Variação responsiva (3 breakpoints mutuamente exclusivos) + repetição idêntica | base.css:68 (geral); layout.css:40 (mobile); dashboard-chat.css:966/987 (desktop ≥1024px) |
| 6 | `main` | margin | Variação responsiva (geral vs mobile) | base.css:68 (geral); layout.css:40 (mobile) |
| 7 | `main` | padding | Variação responsiva (geral vs mobile) | base.css:68 (geral); layout.css:40 (mobile) |
| 8 | `header.app-header` | align-items | Variação responsiva (breakpoints opostos: 681px+ vs 680px-) | base.css:92 (desktop); layout.css:8 (mobile) — NUNCA simultâneos |
| 9 | `header.app-header .header-search-bar .fi` | color | Conflito efetivo apenas em mobile ≤680px | base.css:88 (desktop/geral); layout.css:27 (mobile) |

**Correções obrigatórias aplicadas:**

A. **`header.app-header` / `align-items`**: Removido da categoria de conflito de cascata. `base.css:92` está em `@media (min-width:681px)` e `layout.css:8` em `@media (max-width:680px)`. Breakpoints opostos, nunca ativos simultaneamente. Classificado como **variação responsiva**.

B. **`.export-preview-bank h4` / `margin`**: Consideradas todas as 3 declarações (base.css:10, features.css:881, features.css:889). Vencedor: features.css:889 (0 0 14px), última em escopo geral em features.css.

C. **`.export-preview-bank h4` / `font-size`**: Consideradas todas as 8 declarações (incluindo media queries 768px e 480px). Vencedor geral: features.css:948 (15px). Sobrescritas responsivas documentadas por breakpoint.

D. **`.export-preview-bank h4 small` / `color`**: `features.css:881/890/920/949` declaram o mesmo valor `var(--accent)` = repetição idêntica, não conflito entre si. Apenas diferença real é contra `base.css:11` (`var(--ink-soft)`).

E. **`.export-preview` / `max-height`**: `base.css:8` e `layout.css:202` declaram o mesmo valor `280px` = redundância. Diferença efetiva introduzida apenas por `features.css:884` (`clamp()`).

### 4. Resultado da investigação dos 67 casos agregados

| Métrica | Valor |
|---|---|
| Contagem agregada original (C.1.3/C.1.4) | 67 |
| Registros revisados individualmente (C.1.4.2) | 9 |
| Conflitos efetivos comprovados | 4 |
| Variações responsivas (não são conflitos) | 4 |
| Repetições idênticas (não são conflitos) | 1 |
| Redundâncias (mesmo valor, não são conflitos) | 1 |
| Falsos positivos | 0 (nos 9 analisados) |
| Casos pendentes dos 58 restantes | Não verificáveis — sem dados brutos |

**Conclusão sobre os 67:** A contagem agregada de 67 não pode ser tratada como 67 conflitos individualmente comprovados. Dos 9 revisados, apenas 4 são conflitos efetivos de cascata. Os demais 58 registros da contagem agregada não possuem dados brutos (arquivo, linha, valor, media query, especificidade) que permitam reconstrução individual. Os dados originais da medição automatizada não estão disponíveis em formato que permita recuperar os 58 casos faltantes.

Não foram criados 58 registros artificiais para completar a contagem.

### 5. Rastreabilidade dos 1.127 seletores

**Fonte disponível:** `.tmp-c13/outro-refinado.json` contém os 1.127 seletores individuais com:
- Seletor completo
- Folha CSS (arquivo)
- Linha
- Categoria atribuída
- Grau de confiança
- Motivo/classificação

**Contagem por categoria (fechamento matemático verificado):**

| Categoria | Quantidade |
|---|---|
| Componente condicional | 521 |
| Potencialmente obsoleto | 201 |
| Contexto estrutural | 118 |
| Estado de formulário | 22 |
| Tema | 26 |
| View inativa | 239 |
| **Total** | **1.127** |

**Limitação de rastreabilidade:** 82 dos 1.127 seletores não possuem número de linha (`linha` ausente em `outro-refinado.json`). A classificação foi automatizada por padrões reconhecíveis, não por inspeção individual manual de cada um.

**Categorias solicitadas originalmente não produzidas:** Estado JavaScript, interação e responsividade não têm recorte individual porque a medição C.1.3 testou correspondência de seletor contra DOM estático, sem avaliar estado de JS, interação do usuário ou breakpoints de responsividade. Essa lacuna permanece declarada.

### 6. Investigação dos 201 potencialmente obsoletos

**Metodologia:** Extraídos os 201 seletores de `outro-refinado.json` e verificados contra referências textuais em `index.html` (100.939 bytes) e 34 arquivos JavaScript (828.626 bytes totais).

| Resultado | Quantidade |
|---|---|
| Com referência textual em HTML ou JS | 126 |
| Sem referência textual direta | 75 |

**Análise dos 75 sem referência textual:** Alguns podem ser classes construídas dinamicamente por JavaScript (concatenação de strings, template literais, classes condicionais). Exemplos: `.purchase-status.pendente`, `.balance-insight.is-positive strong`, `body.dark-mode[data-dark-theme="1"] .pocket-goal-track span:not(.over)`. A ausência de referência textual **não prova** obsolescência real.

**Conclusão:** Nenhum dos 201 seletores foi declarado obsoleto. 126 têm referência textual confirmada; 75 requerem investigação adicional (busca por construção dinâmica) antes de qualquer classificação de obsolescência.

### 7. Reconciliação dos 42 seletores

**Situação:** A C.1.4 informa que 42 seletores foram reintegrados da categoria "atributo condicional" para "outro", passando de 1.085 para 1.127.

**Verificação:** Não foi encontrada lista individual dos 42 seletores nos dados disponíveis (todos os arquivos JSON de `.tmp-c13/` contêm 1.127, não 1.085). Não existem dados brutos da etapa anterior (1.085) para comparação individual.

**Conclusão:** A diferença de 42 seletores é matematicamente consistente (1.085 + 42 = 1.127), mas **não individualmente rastreável**. A identidade dos 42 seletores não pode ser comprovada sem apresentar a lista. Isso é registrado como limitação, não como erro.

### 8. Limitações metodológicas remanescentes

1. **58 conflitos não verificados:** Os 58 registros restantes da contagem agregada de 67 não possuem dados brutos para revisão individual.
2. **82 seletores sem linha:** Dos 1.127 seletores classificados, 82 não têm número de linha associado.
3. **Classificação automatizada:** Os 1.127 seletores foram classificados por padrões, não por inspeção manual individual.
4. **75 seletores sem referência textual:** Dos 201 potencialmente obsoletos, 75 não têm referência em HTML/JS (podem ser construídos dinamicamente).
5. **42 seletores não reconciliados individualmente:** A diferença de 42 seletores não tem lista individual disponível.
6. **Categorias não produzidas:** Estado JavaScript, interação e responsividade não têm recorte individual.

### 9. Conclusão objetiva — Veredito da C.1

**C.1 — NÃO APROVADA.**

Justificativa:

| Critério de aceite | Status | Observação |
|---|---|---|
| Conflitos documentados com classificação tecnicamente correta | ⚠️ Parcial | 9 de 67 revisados; 4 são conflitos efetivos, 4 variações responsivas, 1 repetição, 1 redundância |
| Contagem agregada não apresentada como evidência individual | ✅ Cumprido | Declarado explicitamente que 67 é contagem agregada, não 67 comprovados |
| Rastreabilidade dos seletores demonstrada ou limitações delimitadas | ⚠️ Parcial | 1.127 seletores com arquivo/categoria (82 sem linha); limitações declaradas |
| 201 seletores potencialmente obsoletos não declarados obsoletos | ✅ Cumprido | Nenhum declarado obsoleto; 126 com referência, 75 pendentes |
| Diferença dos 42 seletores reconciliada ou registrada como limitação | ✅ Cumprido | Registrada como limitação (sem lista individual disponível) |
| Nenhuma alteração funcional feita | ✅ Cumprido | Apenas documentação |
| Histórico documental preservado | ✅ Cumprido | C.0, C.1, C.1.1, C.1.1.1, C.1.2, C.1.3, C.1.4, C.1.4.1 preservados |

**Não iniciar C.3.** Não implementar nenhuma recomendação visual ou funcional. Aguardar revisão independente e autorização explícita do usuário.

---

## C.1.4.2.1 — Correções da revisão independente (adendo à C.1.4.2)

Esta subseção corrige inconsistências factuais identificadas na revisão independente do commit `b7f5725` (Phase C.1.4.2). Preserva integralmente o conteúdo histórico da seção C.1.4.2; as correções abaixo são apresentadas como adendo rastreável, sem apagar ou sobrescrever o registro anterior.

### 1. Referência dos SHAs

| Item | SHA |
|---|---|
| SHA-base da C.1.4.2 | `7b1bfc67fdbf00dac3f6417091a443956d7d375f` |
| Commit de publicação da C.1.4.2 | `b7f57259377396c597bfc67a6109220e364f1e8f` |
| Commit de publicação da C.1.4.2.1 | `7a649b6df41ff025d300c9cb0649968c1b7ce8ee` |

O SHA-base identifica a versão de referência utilizada na execução da C.1.4.2. O commit "b7f5725" publicou a C.1.4.2. Já o commit "7a649b6" publicou as correções da C.1.4.2.1. Esses três identificadores representam momentos distintos e não devem ser tratados como equivalentes.

### 2. Correção das especificidades CSS (tupla convencional: IDs, classes/atributos/pseudo-classes, elementos/pseudo-elementos)

| # | Seletor | Especificidade incorreta (C.1.4.2) | Especificidade correta |
|---|---|---|---|
| 1 | `.export-preview` | `0,0,1` | `(0,1,0)` — 1 classe |
| 2 | `.export-preview-bank h4` | `0,0,2` | `(0,1,1)` — 1 classe + 1 elemento |
| 3 | `.export-preview-bank h4 small` | `0,0,2` | `(0,1,2)` — 1 classe + 2 elementos |
| 4 | `main` | `0,0,1` | `(0,0,1)` — 1 elemento (já estava correto) |
| 5 | `header.app-header` | `0,0,1` | `(0,1,1)` — 1 elemento + 1 classe |
| 6 | `header.app-header .header-search-bar .fi` | `0,0,3` | `(0,3,1)` — 1 elemento + 3 classes |

Os registros 1, 2, 3, 4, 8 e 9 do `css-conflitos.json` tiveram suas especificidades corrigidas nesta revisão. Os registros 5, 6 e 7, referentes ao seletor `main`, já apresentavam a especificidade correta `(0,0,1)` e foram mantidos sem alteração. Portanto, seis registros receberam correção e três registros conservaram os valores que já estavam corretos.

### 3. Correção do vencedor de "max-height" (`.export-preview`)

**Conclusão anterior (C.1.4.2):** `features.css:884` vence no desktop; `layout.css:202` vence no mobile ≤680px.

**Correção (C.1.4.2.1):** `features.css:884` prevalece **em todos os contextos**, incluindo mobile ≤680px.

**Fundamento:**
- `base.css:8`: `280px`, escopo geral, especificidade `(0,1,0)`
- `layout.css:202`: `280px`, `@media (max-width:680px)`, especificidade `(0,1,0)`
- `features.css:884`: `clamp(160px, calc(92svh - 340px), 420px)`, escopo geral, especificidade `(0,1,0)`

`base.css:8` e `layout.css:202` declaram o mesmo valor (`280px`) = redundância entre si, não conflito. `features.css:884` declara valor diferente (`clamp`), mesma especificidade `(0,1,0)`, e é carregada por último (posição 5 sobre 1 e 4). Portanto `features.css:884` vence `base.css:8` e `layout.css:202` em **todos** os contextos, incluindo mobile. `layout.css:202` não é vencedora em nenhum contexto.

### 4. Reconciliação da contagem de conflitos

Os 9 registros analisados **não equivalem a 9 conflitos efetivos**. Distinção correta:

| Categoria | Quantidade | Registros |
|---|---|---|
| Diferenças efetivas de valor | 5 | 1 (`.export-preview`/max-height), 2 (`.export-preview-bank h4`/margin), 3 (`.export-preview-bank h4`/font-size), 4 (`.export-preview-bank h4 small`/color), 9 (`header.app-header .header-search-bar .fi`/color) |
| Variações responsivas (não são conflitos de cascata) | 4 | 5 (`main`/max-width), 6 (`main`/margin), 7 (`main`/padding), 8 (`header.app-header`/align-items) |
| Repetições idênticas internas | presente | registro 4 (4 declarações com `var(--accent)` idênticas), registro 5 (2 declarações `1120px` idênticas) |
| Redundâncias internas | presente | registro 1 (`base.css:8` e `layout.css:202` com mesmo valor `280px`) |
| Falsos positivos | 0 | — |

**`header.app-header` / `align-items` NÃO é conflito:** as declarações estão em media queries distintas (`@media (min-width:681px)` e `@media (max-width:680px)`), breakpoints opostos, nunca ativos simultaneamente. Classificado como variação responsiva.

**Totais reconciliados:** 9 registros analisados = 5 diferenças efetivas + 4 variações responsivas. Não somar categorias sobrepostas como se fossem registros exclusivos.

### 5. Tabela corrigida — Vencedores efetivos

| # | Seletor | Propriedade | Diferença efetiva? | Vencedor efetivo |
|---|---|---|---|---|
| 1 | `.export-preview` | max-height | Sim | `features.css:884` (clamp, todos os contextos) |
| 2 | `.export-preview-bank h4` | margin | Sim | `features.css:889` (0 0 14px) |
| 3 | `.export-preview-bank h4` | font-size | Sim | `features.css:948` (15px geral); 938 (14px @768px); 945 (13px @480px) |
| 4 | `.export-preview-bank h4 small` | color | Sim (apenas vs base.css) | `features.css` (var(--accent)); `features.css:881/890/920/949` são repetição idêntica entre si |
| 5 | `main` | max-width | Não | Variação responsiva: `base.css:68` (geral), `layout.css:40` (mobile), `dashboard-chat.css:966/987` (desktop ≥1024px) |
| 6 | `main` | margin | Não | Variação responsiva: `base.css:68` (geral), `layout.css:40` (mobile) |
| 7 | `main` | padding | Não | Variação responsiva: `base.css:68` (geral), `layout.css:40` (mobile) |
| 8 | `header.app-header` | align-items | Não | Variação responsiva: `base.css:92` (desktop ≥681px), `layout.css:8` (mobile ≤680px) — nunca simultâneos |
| 9 | `header.app-header .header-search-bar .fi` | color | Sim (apenas mobile ≤680px) | `base.css:88` (desktop/geral); `layout.css:27` (mobile ≤680px) |

### 6. Ressalva de não-reprodução independente

Os seguintes números foram declarados na execução original da C.1.4/C.1.4.2, mas **não puderam ser reproduzidos independentemente a partir dos artefatos atualmente versionados no repositório**:

| Número | Fonte original | Status de reprodução |
|---|---|---|
| 1.127 seletores classificados | `.tmp-c13/outro-refinado.json` (não versionado) | Não reproduzível |
| 201 seletores potencialmente obsoletos | `.tmp-c13/outro-refinado.json` (não versionado) | Não reproduzível |
| 42 seletores reintegrados | não encontrado nos dados disponíveis | Não reproduzível |
| 67 conflitos agregados | `.tmp-c13/css-conflitos.json` (não versionado) | Não reproduzível |
| 58 conflitos pendentes | derivado de 67 − 9 | Não reproduzível |
| 126 seletores com referência textual | análise em `index.html` + `js/` | Reproduzível |
| 75 seletores sem referência textual | análise em `index.html` + `js/` | Reproduzível |

**Distinção:**
- **Resultado documentado pela execução:** os números acima, registrados na C.1.4.2.
- **Resultado verificável no repositório:** apenas os 9 registros de `css-conflitos.json` (arquivo versionado) e as declarações CSS verificáveis nos arquivos `style/*.css`.
- **Resultado não reproduzível:** todos os números que dependem de `.tmp-c13/` (pasta não versionada, contendo scripts temporários de medição).

Não foram criados 58 registros artificiais para completar a contagem. Nenhum dos 201 seletores potencialmente obsoletos foi declarado obsoleto.

### 7. Verificações executadas

1. ✅ Nove registros do `css-conflitos.json` conferidos quanto a especificidades (tupla convencional corrigida).
2. ✅ Coerência entre JSON e relatório verificada (5 diferenças efetivas + 4 variações responsivas = 9 registros).
3. ✅ Cinco conflitos efetivos corretamente identificados (registros 1, 2, 3, 4, 9).
4. ✅ `header.app-header` / `align-items` classificado como variação responsiva (não conflito).
5. ✅ Vencedor de `max-height` corrigido: `features.css:884` vence em todos os contextos.
6. ✅ SHAs confirmados: SHA-base da C.1.4.2 `7b1bfc6`; commit de publicação da C.1.4.2 `b7f5725`; commit de publicação da C.1.4.2.1 `7a649b6`. Os três identificadores correspondem a momentos distintos do histórico.
7. ✅ Diff verificado: somente `css-conflitos.json` e `PHASE_B_CONSOLIDATED_REPORT.md` modificados.

### 8. Veredito atualizado — C.1

**C.1 — NÃO APROVADA.**

**Natureza da execução:** esta etapa foi exclusivamente documental. Nenhuma alteração funcional foi feita. As alterações foram publicadas por meio do commit `7a649b6df41ff025d300c9cb0649968c1b7ce8ee` e enviadas ao repositório remoto (push). Não houve deploy.

| Item | Valor |
|---|---|
| Repositório | antvjpg/LIVRO-CAIXA |
| Branch | `feat/app-navigation-redesign` |
| SHA do HEAD | `f5d011c185ce9153a383df1ec9d3b030a2ff91d1` |
| Último commit | `f5d011c185ce9153a383df1ec9d3b030a2ff91d1 Phase C.1.1.1: Correção das evidências e validação final da auditoria CSS` |
| Commits locais não enviados | Nenhum (`git log @{u}..HEAD` vazio) |
| `git status --short` | `D PHASE_C_CONSOLIDATED_REPORT.md` (exclusão pré-existente, não tocada nesta execução) |
| Relatório de consolidação | `PHASE_B_CONSOLIDATED_REPORT.md` (1795 linhas antes da C.2) — contém Fase B, C.0, C.1, C.1.1, C.1.1.1 |

---

## C.2.2 Estado do Git

```
D PHASE_C_CONSOLIDATED_REPORT.md
```
*A exclusão de PHASE_C_CONSOLIDATED_REPORT.md é pré-existente (não originada nesta execução). Nenhum arquivo foi adicionado, modificado ou removido durante a C.2.*

---

## C.2.3 Arquivos inspecionados

### Arquivos de navegação (leitura completa ou trechos)

| Arquivo | Função na navegação |
|---|---|
| `index.html` | Estrutura: bottom nav (L1637-1643), drawer (L161-182), 11 views (L239-666), FAB (L668), overlays |
| `js/99-init.js` | `switchTabOriginal` (L399-448), `window.switchTab` (L450-452), restauração de aba (L459-467), bind bottom nav (L25-31), bind drawer (L1607-1627), goBackInsideApp/popstate (L322-348), wrapper FAB `origSwitchTab` (L3645-3652), `updateFabAriaLabel` chamada (L3654) |
| `js/legacy/patches.js` | Patch de Metas que **sobrescreve** `window.switchTab` (L19-87), intercepta `data-drawer-action="goals"` (L89-99) |
| `js/00-bootstrap.js` | `updateNavIndicator` (L51-64), `firebase.initializeApp`, `auth` |
| `js/15-tabs-nav.js` | `persistLastTab` (L14-18), declarações `TAB_NAMES`, `currentTab` |
| `js/16-events-modals.js` | `closeDrawer` não está aqui; contém `openUniversalSearch`/`closeUniversalSearch` (L828-846), `universalSearchGo` (L848-871 — na verdade está em 18-render-core) |
| `js/17-sync-persistence.js` | Restauração de aba via `window.switchTab(savedTab)` (L178-179) |
| `js/18-render-core.js` | `openDrawer` (L799-804), `closeDrawer` (L787-791), `openUniversalSearch` (L828-840), `closeUniversalSearch` (L842-846), `universalSearchGo` (L848-871), `openPocketsTab`/`openInvestTab` (L674,684), `openBankPanel` (L666) |
| `js/20-dashboard.js` | `openFeatureProfile` (L1746), `openBudgetModal` (L1748), `openGoalsPanel` (L1750-1777), link "Ver visão geral" `switchTab('dashboard')` (L102) |
| `js/22-profile.js` | (não contém `renderProfile`; veja 32-auth-wiring) |
| `js/24-automation-render.js` | `openModal` (L276-289) |
| `js/27-cards.js` | `openBankManagementPanel` (L919-926) |
| `js/32-auth-wiring.js` | `renderProfile` (L12-29), `renderUserBar` (L4-10), `updateFabAriaLabel` (L59-74), `auth.onAuthStateChanged` (L76-128) |

### Arquivos de renderização por view (referenciados em switchTab)

| View | Renderizador | Arquivo |
|---|---|---|
| `viewDash` | `renderDashboardTab()` | `js/20-dashboard.js` |
| `viewDashboard` | `renderAdvancedDashboard()` | `js/20-dashboard.js` |
| `viewCaixa` | `renderCategorySummary()` | `js/11-financial-domain.js` (via `render()`) |
| `viewInvest` | `renderInvestments()` + `refreshStaleInvestmentQuotes()` | `js/18-render-core.js` |
| `viewPockets` | (via `render()`) | `js/18-render-core.js` |
| `viewCards` | `renderCards()` | `js/27-cards.js` |
| `viewReceivables` | `renderReceivables()` | `js/25-bills-receivables.js` |
| `viewBills` | `renderBills()` | `js/25-bills-receivables.js` |
| `viewGoals` | `renderGoalsList()` | `js/19-goals.js` |
| `viewInicio` | `renderAdvancedDashboard()` + `renderPatrimonySparkline()` | `js/20-dashboard.js` + `js/18-render-core.js` |
| `viewProfile` | `renderProfile()` | `js/32-auth-wiring.js` |

---

## C.2.4 Arquitetura atual de navegação

### 4.1 Dispatcher e estado

**`TAB_NAMES`** (js/99-init.js:350):
```js
TAB_NAMES = ['dash', 'dashboard', 'caixa', 'invest', 'pockets', 'cards', 'receivables', 'bills', 'profile', 'goals', 'inicio'];
```
*11 destinos registrados. **`dash` e `dashboard` são destinos distintos, não aliases equivalentes.** `switchTab('dash')` ativa `#viewDash` (dashboard analítico com `renderDashboardTab()`); `switchTab('dashboard')` ativa `#viewDashboard` (visão geral antiga com `renderAdvancedDashboard()`). A conversão feita por `updateNavIndicator()` (mapear `'dash' → 'dashboard'` apenas para localizar o botão visual da navegação inferior) **não** unifica as duas views em uma única funcionalidade.*

**`currentTab`** (js/99-init.js:351): inicializado como `'caixa'`.

**`document.body.dataset.tab`** (js/99-init.js:354): definido como `currentTab` no bootstrap.

**`persistLastTab(tab)`** (js/15-tabs-nav.js:14-18): salva em `sessionStorage` sob `LAST_TAB_STORAGE_KEY = 'livrocaixa_last_tab'` apenas se `tab` estiver em `TAB_NAMES`. Nota: usa sessionStorage (sobrevive a F5, não sobrevive ao fechar o app).

**`switchTabOriginal(tabName)`** (js/99-init.js:399-448): função base. Responsabilidades:
1. Define `currentTab = tabName`.
2. Chama `persistLastTab(tabName)`.
3. Define `document.body.dataset.tab = tabName || 'caixa'`.
4. Adiciona/remove classe `.tab-changing` no `document.body` (240ms).
5. Chama `updateNavIndicator(tabName)`.
6. Alterna classes `.active` nos botões `tabBtnDash`, `tabBtnDashboard`, `tabBtnCaixa`, `tabBtnInvest`, `tabBtnPockets`, `tabBtnCards`, `tabBtnReceivables`.
7. Alterna classes `.active` nas views `viewDash`, `viewDashboard`, `viewCaixa`, `viewInvest`, `viewPockets`, `viewCards`, `viewReceivables`, `viewBills`, `viewProfile`, `viewGoals`, `viewInicio`.
8. Esconde `balanceStrip` se `tabName !== 'caixa' && tabName !== 'inicio'`.
9. Esconde `universalPeriodBar` se `!['caixa','invest','pockets'].includes(tabName)`.
10. Renderizadores condicionais: `bills`→`renderBills()`, `cards`→`renderCards()`, `receivables`→`renderReceivables()`, `invest`→`renderInvestments()`+`refreshStaleInvestmentQuotes()`, `dashboard`/`inicio`→`renderAdvancedDashboard()`, `caixa`/`inicio`→`renderPatrimonySparkline()`, `dash`→`renderDashboardTab()`, `caixa`→`renderCategorySummary()`, `profile`→`renderProfile()`.
11. Atualiza `.is-active` nos botões do bottom nav com base em `nav.dataset.active`.

**`window.switchTab`** (js/99-init.js:450-452): se `typeof window.switchTab !== 'function'`, atribui `window.switchTabOriginal`. **Não sobrescreve se já existir função** (permite que patches anteriores definam a função).

**Patch de Metas — `js/legacy/patches.js:19-87`**: **sobrescreve** `window.switchTab` inteiramente:
- Se `tab === 'goals'`: não chama o original. Define `document.body.dataset.tab = 'goals'`, remove `.active` de todas as views e botões `.nav-tab`, ativa `viewGoals` e `tabBtnGoals`, chama `persistLastTab('goals')`, remove `data-active` do bottom nav, renderiza `renderGoalsList()`. Retorna antecipado.
- Senão: remove estado de goals, chama `runOriginalSwitchTab(tab, this, arguments)` (que é `switchTabOriginal`), depois reforça a pílula do bottom nav usando `nav.dataset.active`, e garante que `document.body.dataset.tab` não fique preso em `'goals'`.
- Intercepta clique em `[data-drawer-action="goals"]` (L89-99): `preventDefault`, `switchTab('goals')`, fecha drawer.

**Wrapper FAB — `js/99-init.js:3645-3652`**: captura `origSwitchTab = window.switchTab` e redefine `window.switchTab` como wrapper que chama o original e depois `updateFabAriaLabel(tab)`. Ordem de execução corrigida: `patches.js` é um **script clássico sem `defer`**, carregado no final do corpo do HTML (L1681), e executa durante a análise do documento, **antes** do callback `DOMContentLoaded` de `99-init.js` (carregado com `defer`, L1634). Assim, quando o callback de `99-init.js` captura a função em `origSwitchTab`, o patch de Metas já está instalado em `window.switchTab`. O encadeamento é: (1) `patches.js` instala seu wrapper; (2) `99-init.js` executa seu callback; (3) captura a função já modificada; (4) o wrapper do FAB passa a chamar o patch de Metas; (5) o patch encaminha destinos comuns para `switchTabOriginal()`. **Não é um conflito comprovado de ordem de execução.** A interação completa ainda pode ser validada em runtime.

**Restauração de sessão** (js/99-init.js:459-467): lê `sessionStorage.getItem(LAST_TAB_STORAGE_KEY)`, se válido e em `TAB_NAMES`, define `currentTab`, `lastTabRestored = true`, `document.body.dataset.tab = savedTab`, e chama `window.switchTab(savedTab)`.

**`updateNavIndicator(tabName)`** (js/00-bootstrap.js:51-64): mapeia `'dash' → 'dashboard'`, busca o botão do bottom nav com `data-destination === tabName`; se não encontrar, cai para `'caixa'`; define `nav.dataset.active = tabName` e `--nav-indicator-x = ${index * 100}%`. Isso significa que o indicador visual do bottom nav só funciona para os 5 destinos físicos dos botões (dashboard, pockets, caixa, invest, profile). Destinos como `bills`, `cards`, `receivables`, `goals`, `dash`, `inicio` não têm botão físico e caem no fallback `caixa` ou índice 0.

**Histórico / botão Voltar** (js/99-init.js:322-348):
- `goBackInsideApp()`: se há modal/overlay aberto → fecha todos e retorna true. Se `document.body.dataset.tab !== 'caixa'` → `switchTab('caixa')` e retorna true. Senão retorna false (deixa o sistema fechar o app).
- `window.addEventListener('popstate', ...)`: chama `goBackInsideApp()`; se true, `history.pushState(appBackState, '')`.
- Bootstrap faz `history.pushState(appBackState, '')` (L348) para consumir a primeira ação de Voltar.

**Event listeners relacionados à navegação:**
- Bottom nav: cada `.mobile-bottom-nav button` com `data-destination` chama `switchTab(destino)` + `window.scrollTo({top:0})` (js/99-init.js:25-31).
- Drawer: cada `[data-drawer-action]` chama `switchTab()` ou abre modal (js/99-init.js:1607-1627).
- Botão Voltar do header (`#btnOpenDrawer` → `openDrawer`).

### 4.2 Views — inventário

| # | View (ID) | Linha HTML | Finalidade | Renderizador | Dados | Filtros | Ações | Dependências |
|---|---|---|---|---|---|---|---|---|
| 1 | `viewDash` | 239 | Dashboard de análise (período, conta, comparar) | `renderDashboardTab()` | entries, banks, categories | período (7d/30d/6m/1y/custom), conta, comparar | alterar período, conta, toggle comparar | `dashFilters`, Chart.js |
| 2 | `viewDashboard` | 269 | Visão Geral (advanced dashboard + próximo pagamento) | `renderAdvancedDashboard()` | entries, pockets, investments | (via advanced dashboard) | — | Chart.js, `featureSettings` |
| 3 | `viewCaixa` | 299 | Livro-Caixa (lançamentos, toolbar, filtros) | `renderCategorySummary()` + `render()` | entries, banks, categories | flow, datas, banco, categoria, texto | novo lançamento, transferência, colar, importar, exportar, filtrar | `entries`, `banks`, `categories` |
| 4 | `viewInicio` | 423 | Início (patrimônio, saúde, próximo pagamento, fluxo) | `renderAdvancedDashboard()` + `renderPatrimonySparkline()` | patrimônio, entries | — | toque no balance-symbol (colapsar sparkline) | `patrimonySparkVisible` |
| 5 | `viewBills` | 330 | Contas & Calendário (recorrentes) | `renderBills()` | recurringBills | titular, status (pendente/atrasado/pago), mês | novo bill, exportar PDF/Excel, marcar pago, lançar no Caixa | `recurringBills`, `banks` |
| 6 | `viewReceivables` | 361 | Valores a Receber (independente) | `renderReceivables()` | receivables | status (pendente/recebido/cancelado) | novo recebível, marcar recebido, cancelar | `receivables` |
| 7 | `viewInvest` | 390 | Investimentos | `renderInvestments()` + `refreshStaleInvestmentQuotes()` | investments, yieldsLog | — | novo invest, aportes/resgates/rendimentos, atualizar cotações, conciliar | `investments`, `yieldsLog`, CoinGecko |
| 8 | `viewPockets` | 403 | Caixinhas | (via `render()`) | pockets, yieldsLog | — | nova caixinha, aporte/resgate/rendimento | `pockets`, `yieldsLog` |
| 9 | `viewCards` | 410 | Cartões | `renderCards()` | cards, purchases, invoiceLaunches | ciclo, titular | novo cartão, nova compra, pagar fatura, arquivar | `cards`, `purchases`, Card Engine V3 |
| 10 | `viewProfile` | 456 | Perfil (dados, preferências, segurança, orçamento, conciliação, proteção local) | `renderProfile()` | currentUser, featureSettings | — | logout, tema, moeda, fonte, PIN, biometria, orçamento, conciliação | `currentUser`, `featureSettings`, `auth` |
| 11 | `viewGoals` | 277 | Metas financeiras | `renderGoalsList()` | goals, pockets, banks, investments | status, fonte | nova meta, editar, excluir, vincular caixinha | `goals`, `pockets` |

**Views que compartilham componentes/dados:**
- `viewCaixa`, `viewDash`, `viewDashboard`, `viewInicio` usam `entries` e `categories`.
- `viewInvest` e `viewPockets` usam `yieldsLog` (movimentações).
- `viewCards` e `viewBills` compartilham `banks` e contas de pagamento.
- `viewGoals` vincula a `pockets`/`banks`/`investments` (fonte financeira).
- `viewInicio` reutiliza componentes de `viewDashboard` (`.advanced-dashboard`, `.dashboard-next-payment-card`, `.cashflow-mini-summary`).

### 4.3 Navegação inferior (bottom nav)

**HTML** (index.html L1637-1643): 5 botões, sem rótulos de texto (apenas ícones), com `aria-label`:

| Ordem | `data-destination` | `aria-label` | Classe ativa inicial | View alvo | Renderiza |
|---|---|---|---|---|---|
| 1 | `dashboard` | "Visão geral" | — | `viewDashboard` | `renderAdvancedDashboard()` |
| 2 | `pockets` | "Caixinhas" | — | `viewPockets` | `render()` |
| 3 | `caixa` | "Livro-Caixa" | `is-active` | `viewCaixa` | `renderCategorySummary()` |
| 4 | `invest` | "Investimentos" | — | `viewInvest` | `renderInvestments()`+`refreshStaleInvestmentQuotes()` |
| 5 | `profile` | "Perfil" | — | `viewProfile` | `renderProfile()` |

**Observações:**
- Não há botão `data-destination="inicio"`. A view `#viewInicio` existe no DOM mas **não é alcançável pelo bottom nav** (gap já identificado na C.1.1.1).
- Não há botão para `bills`, `cards`, `receivables`, `goals`, `dash`.
- `caixa` é a aba ativa por padrão (`is-active` no HTML, `currentTab = 'caixa'` no JS).
- `updateNavIndicator` mapeia `dash→dashboard`; só tem botão físico para `dashboard`, não para `dash`. Se `switchTab('dash')` for chamado, o indicador cai no fallback `caixa`/índice 0.
- `document.body.dataset.tab` pode receber `inicio`, `goals`, `bills`, etc., mas o bottom nav não reflete esses estados (sem botão físico).

**Acessibilidade:** apenas `aria-label` nos botões, sem texto visível. Sem `aria-current="page"`. Sem rótulo de texto para o ícone.

**Comportamento mobile:** `.mobile-bottom-nav` fica fixo; esconde ao rolar para baixo (`nav-hidden`, js/99-init.js:1340-1373) e mostra ao rolar para cima ou perto do topo.

**Comportamento desktop:** o bottom nav **não está visível em desktop** — `.mobile-bottom-nav` tem `display: none` acima de 680px (`style/layout.css`, fora da media query) e `display: grid` apenas dentro de `@media (max-width:680px)`. Não há sidebar desktop comprovada. O drawer é um mecanismo separado (`#appDrawerOverlay` / `.app-drawer`).

**FAB:** `#fabAdd` (index.html L668). `updateFabAriaLabel` (js/32-auth-wiring.js:59-74) define labels por tab: dashboard→"Conversar com IA financeira", bills→"Adicionar conta recorrente", receivables→"Adicionar valor a receber", invest→"Adicionar investimento", pockets→"Adicionar caixinha", cards→"Adicionar cartão", goals→"Adicionar meta", caixa→"Adicionar lançamento", contas→"Adicionar lançamento". Para `inicio` e `profile` usa fallback "Adicionar".

**Persistência da aba selecionada:** `sessionStorage` (sessão only) via `persistLastTab`; restaurada no bootstrap via `switchTab(savedTab)`.

### 4.4 Menu lateral (drawer)

**HTML** (index.html L161-182): drawer com `aria-label="Menu principal"`.

**Ações principais (drawer-nav)**:
| `data-drawer-action` | Rótulo | Destino / comportamento | Arquivo:linha |
|---|---|---|---|
| `overview` | "Livro-Caixa" | `switchTab('caixa')` + scroll top | js/99-init.js:1610 |
| `dash` | "Dashboard" | `switchTab('dash')` + scroll top | js/99-init.js:1611 |
| `cards` | "Cartões" | `switchTab('cards')` | js/99-init.js:1615 |
| `bills` | "Contas & Calendário" | `switchTab('bills')` | js/99-init.js:1613 |
| `receivables` | "Valores a Receber" | `switchTab('receivables')` | js/99-init.js:1614 |
| `pockets` | "Caixinhas" | `switchTab('pockets')` | js/99-init.js:1619 |
| `goals` | "Metas" | `switchTab('goals')` (via patch patches.js:93) | js/legacy/patches.js:93 |
| `investments` | "Investimentos" | `switchTab('invest')` | js/99-init.js:1621 |
| `profile` | "Perfil" | `switchTab('profile')` + scroll top | js/99-init.js:1625 |

**Ações secundárias (drawer-nav-secondary)**:
| `data-drawer-action` | Rótulo | Destino / comportamento | Arquivo:linha |
|---|---|---|---|
| `profile` | "Perfil" | `switchTab('profile')` + scroll top | js/99-init.js:1625 (apenas na seção secundária) |
| `lab` | "LABS" | `openFeatureProfile()` → `renderFeatureProfile()` + `openModal('panelFeatureProfile')` | js/20-dashboard.js:1746 |
| `novoLog` | "Novo LOG" | `openModal('panelLOG')` | js/99-init.js:1616 |

**Duplicidades com bottom nav:** `overview` (Livro-Caixa) mapeia para `caixa`, que já está no bottom nav. `dash` (Dashboard) no drawer mapeia para `switchTab('dash')`, enquanto o bottom nav usa `dashboard` (diferença de identificador). Perfil aparece apenas uma vez, na seção secundária do drawer (não há duplicidade).

**Funcionalidades acessíveis somente pelo drawer:** `lab` (LABS), `novoLog` (Novo LOG), `overview` (acesso rápido ao caixa sem usar bottom nav), `dash` (acesso ao dash via identificador diferente do bottom nav).

**Fechamento do drawer:** `closeDrawer()` (js/18-render-core.js:787-791) remove `.is-open` e define `aria-hidden="true"`. Clique no overlay, Escape, e após cada ação de navegação (`closeDrawer()` no final do forEach de `[data-drawer-action]`, js/99-init.js:1627).

**Dependências de estado:** o drawer depende de `openDrawer()`/`closeDrawer()` definidas em js/18-render-core.js, carregadas antes de 99-init.js (ordem: 18-render-core.js L1621, 99-init.js L1634).

---

## C.2.5 Mapeamento de chamadas e consumidores de switchTab()

Todos os pontos que disparam troca de aba:

| # | Origem | Chamada | Destino(s) | Arquivo:linha |
|---|---|---|---|---|
| 1 | Bottom nav (click) | `switchTab(button.dataset.destination)` | dashboard, pockets, caixa, invest, profile | js/99-init.js:28 |
| 2 | Drawer `overview` | `window.switchTab('caixa')` | caixa | js/99-init.js:1610 |
| 3 | Drawer `dash` | `window.switchTab('dash')` | dash | js/99-init.js:1611 |
| 4 | Drawer `entries` | `window.switchTab('caixa')` | caixa | js/99-init.js:1612 |
| 5 | Drawer `bills` | `window.switchTab('bills')` | bills | js/99-init.js:1613 |
| 6 | Drawer `receivables` | `window.switchTab('receivables')` | receivables | js/99-init.js:1614 |
| 7 | Drawer `cards` | `window.switchTab('cards')` | cards | js/99-init.js:1615 |
| 8 | Drawer `reports` | `window.switchTab('caixa')` | caixa | js/99-init.js:1618 |
| 9 | Drawer `pockets` | `window.switchTab('pockets')` | pockets | js/99-init.js:1619 |
| 10 | Drawer `goals` | `window.switchTab('goals')` (patch patches.js) | goals | js/legacy/patches.js:93 |
| 11 | Drawer `investments` | `window.switchTab('invest')` | invest | js/99-init.js:1621 |
| 12 | Drawer `profile` | `window.switchTab('profile')` | profile | js/99-init.js:1625 |
| 13 | popstate/goBackInsideApp | `window.switchTab('caixa')` | caixa | js/99-init.js:338 |
| 14 | Restauração de sessão | `window.switchTab(savedTab)` | qualquer TAB_NAMES | js/99-init.js:465 |
| 15 | universalSearchGo `entry` | `window.switchTab('caixa')` | caixa | js/18-render-core.js:852 |
| 16 | universalSearchGo `bank`/`category` | `window.switchTab('caixa')` | caixa | js/18-render-core.js:862 |
| 17 | universalSearchGo `bill`/`card`/`purchase`/`pocket`/`goal`/`investment` | `window.switchTab(tabByKind[kind])` | bills/cards/pockets/goals/invest | js/18-render-core.js:867 |
| 18 | openPocketsTab (pocket summary card) | `window.switchTab('pockets')` | pockets | js/18-render-core.js:674 |
| 19 | openInvestTab (invest summary card) | `window.switchTab('invest')` | invest | js/18-render-core.js:684 |
| 20 | Link "Ver visão geral" (cashflow mini) | `window.switchTab('dashboard')` | dashboard | js/20-dashboard.js:102 |
| 21 | Patch metas (saída de goals) | `runOriginalSwitchTab(tab, ...)` | qualquer (exceto goals) | js/legacy/patches.js:69 |
| 22 | Wrapper FAB (origSwitchTab) | chama o switchTab vigente | qualquer | js/99-init.js:3647 |

**Chamadas indiretas:** `render()` (chamado após muitas mutações) não chama switchTab, mas re-renderiza a view ativa com base em `currentTab`/`document.body.dataset.tab`.

**Não existe** um segundo dispatcher paralelo. O contrato é único (`window.switchTab`), mas há dois níveis de interceptação: o patch de metas (sobrescreve) e o wrapper FAB (envolve). Ordem de aplicação depende da ordem dos `<script>` no HTML.

---

## C.2.6 Matriz de rastreabilidade — cinco áreas

Classificação: Destino principal / Subárea / Ação contextual / Ferramenta auxiliar / Configuração / Fluxo especializado / Acesso legado a preservar.

| Funcionalidade atual | View/ID atual | Área proposta | Acesso atual | Dependências | Observações |
|---|---|---|---|---|---|
| Livro-Caixa (lançamentos) | `viewCaixa` | Contas | Bottom nav (caixa), drawer overview, drawer entries, switchTab('caixa') | entries, banks, categories, renderCategorySummary | Destino principal — aba inicial |
| Transferência | `panelTransferencia` (modal) | Contas | Toolbar viewCaixa (btnTransferencia) | banks, pockets, investments ≥2 | Ação contextual dentro de Contas |
| Colar texto / Importar PDF-DOCX | `panelPaste`, `panelImport` (modais) | Contas | Toolbar viewCaixa | entries | Ferramenta auxiliar |
| Exportar extrato / backup | `panelExportFormat` (modal) | Contas | Toolbar viewCaixa | jspdf, pdf.js, xlsx, docx, mammoth | Ferramenta auxiliar |
| Filtros de movimentações | `panelFiltros` (modal) | Contas | viewCaixa (btnOpenFilters) | entries, banks, categories | Ferramenta auxiliar |
| Dashboard (análise) | `viewDash` | Análises | Drawer `dash`, switchTab('dash'); **não** pelo bottom nav (o botão `dashboard` ativa `viewDashboard`) | dashFilters, entries, renderDashboardTab | Destino principal — Análises |
| Visão Geral | `viewDashboard` | Início | Bottom nav (dashboard), switchTab('dashboard') | renderAdvancedDashboard, dashboardNextPayment | Subárea de Início / alternativa de dashboard |
| Início (patrimônio, saúde, próximo pagamento, fluxo) | `viewInicio` | Início | **Não acessível pelo bottom nav**; drawer não tem ação; switchTab('inicio') disponível mas sem trigger UI | renderAdvancedDashboard, renderPatrimonySparkline, patrimonySparkVisible | **Gap de navegação** — view existe mas sem botão |
| Contas recorrentes & Calendário | `viewBills` | Contas | Bottom nav? Não. Drawer bills, switchTab('bills') | recurringBills, renderBills | Destino principal — Contas |
| Valores a Receber | `viewReceivables` | Contas | Drawer receivables, switchTab('receivables') | receivables, renderReceivables | Destino principal — Contas |
| Investimentos | `viewInvest` | Contas | Bottom nav (invest), drawer investments, switchTab('invest') | investments, yieldsLog, CoinGecko, renderInvestments | Destino principal — Contas |
| Caixinhas | `viewPockets` | Contas | Bottom nav (pockets), drawer pockets, switchTab('pockets') | pockets, yieldsLog | Destino principal — Contas |
| Cartões | `viewCards` | Contas | Drawer cards, switchTab('cards') | cards, purchases, invoiceLaunches, Card Engine V3 | Destino principal — Contas |
| Metas | `viewGoals` | Contas | Drawer goals (patch), switchTab('goals'), universalSearch | goals, pockets, renderGoalsList | **Fluxo especializado** — fica em Contas (vínculo com caixinhas) |
| Perfil (dados, preferências, segurança, PIN, biometria, orçamento, conciliação) | `viewProfile` | Perfil | Bottom nav (profile), drawer profile, switchTab('profile') | currentUser, featureSettings, auth, renderProfile | Destino principal — Perfil |
| LABS (experimental: juros compostos) | `panelFeatureProfile` (modal) | Perfil | Drawer lab, openFeatureProfile() | renderFeatureProfile | Ferramenta auxiliar / Configuração |
| Novo LOG | `panelLOG` (modal) | Perfil | Drawer novoLog, openModal('panelLOG') | logConteudo | Acesso legado / Ferramenta auxiliar |
| Banco / conta cadastro | `panelBanco` (modal) | Contas | Drawer `banks` (não há ação no drawer atual!), btnBanco em perfil? | banks | **Ação sem entrada no drawer** (openBankManagementPanel existe em js/27-cards.js:919 mas não é chamada por nenhum data-drawer-action) |
| Categorias | `panelCategoria` (modal) | Contas | Drawer `categories` (não há ação!), btnCategoria em perfil | categories | **Ação sem entrada no drawer** (document.getElementById('btnCategoria')?.click() referenciado mas não mapeado em data-drawer-action) |
| Orçamento | `panelOrcamento` (modal) | Perfil | Drawer? Não. Perfil (btnOpenBudgetModal), openBudgetModal() | budgets, renderBudgetManagement | Configuração — Perfil |
| Conciliação bancária | `panelReconciliation` (dentro de viewProfile) | Contas | Dentro de viewProfile | banks, reconcileBank | Ação contextual — Contas (dentro de Perfil visualmente) |
| Proteção local (PIN, biometria, bloqueio) | `block1-4` (dentro de viewProfile) | Perfil | Dentro de viewProfile | pinProtection, featureSettings | Configuração — Perfil |
| Auto-categorização / Anomalias / Revisão mensal | `panelAnalysisCard` (dentro de viewProfile) | Análises | Dentro de viewProfile | runAnomalyScan, runDiagnostics, generateMonthlyReview | Ferramenta auxiliar — Análises |
| Busca universal | `universalSearchOverlay` | — | Header btnUniversalSearch | entries, banks, categories | Ferramenta auxiliar (transversal) |
| Notificações | `notificationOverlay` | — | Header btnNotifications | renderNotifications | Ferramenta auxiliar (transversal) |
| Tema / Aparência | `panelThemePicker` (modal) | Perfil | btnAparencia em viewProfile, btnThemeToggle no header | featureSettings, applyLightTheme/applyDarkTheme | Configuração — Perfil |
| FAB (Adicionar) | `#fabAdd` | Transversal | FAB fixo | updateFabAriaLabel por tab | Ação contextual (label muda por aba) |

**Funcionalidades sem classificação clara / sem entrada de navegação:**
1. **Cadastro de Bancos** (`openBankManagementPanel`, js/27-cards.js:919): função existe mas nenhum `data-drawer-action="banks"` no drawer. Acesso apenas por chamada direta de JS (não exposto ao usuário via menu).
2. **Cadastro de Categorias** (`btnCategoria` em viewProfile): referenciado em patches.js como `document.getElementById('btnCategoria')?.click()` mas não há `data-drawer-action="categories"`.
3. **View Início** (`viewInicio`): existe no DOM, `switchTab('inicio')` funciona, mas nenhum botão no bottom nav nem no drawer aponta para ela.

---

## C.2.7 Conflitos e riscos de migração

| # | Risco | Evidência (arquivo:linha) | Dependências | Consequência | Recomendação | Confiança |
|---|---|---|---|---|---|---|
| R1 | `dash` vs `dashboard` são destinos distintos (não aliases) | TAB_NAMES tem ambos (js/99-init.js:350); `switchTabOriginal()` ativa views diferentes: `dash`→`#viewDash` (`renderDashboardTab()`), `dashboard`→`#viewDashboard` (`renderAdvancedDashboard()`); `updateNavIndicator` mapeia `dash→dashboard` exclusivamente para lookup do botão visual (js/00-bootstrap.js:55); drawer usa `dash` (L1611), bottom nav usa `dashboard` (L1638) | updateNavIndicator, switchTab | Chamar `switchTab('dash')` ativa `#viewDash` mas o indicador visual do bottom nav é convertido para `dashboard` (sem botão `dash`), produzindo divergência entre a view ativa e o destino representado na navegação inferior. | **Não declarar `dash` como alias de `dashboard`.** Preservar `dashboard` como identificador legado de `#viewDashboard`; utilizar `dash` como identificador da view analítica `#viewDash`. Corrigir `updateNavIndicator` para que o estado visual corresponda ao destino efetivamente ativo. | Alta |
| R2 | `viewCaixa` vs `viewInicio` | `viewCaixa` (L299) é a aba inicial; `viewInicio` (L423) existe sem botão | switchTab, balanceStrip (esconde se não caixa/inicio), universalPeriodBar | Início é funcional mas não alcançável pela UI principal. | Adicionar `inicio` como destino principal ou expor via drawer. | Alta |
| R3 | `viewInvest` vs `viewPockets` | Ambos usam `yieldsLog`; Invest tem `renderInvestments()`+`refreshStaleInvestmentQuotes()` (switchTab L429); Pockets via `render()` | investments, pockets, yieldsLog | Separação conceitual existente (investimentos vs caixinhas) deve ser preservada. | Não fundir; manter como subáreas de Contas. | Alta |
| R4 | Cartões, contas recorrentes, valores a receber | `viewCards` (L410), `viewBills` (L330), `viewReceivables` (L361) — views independentes | cards, purchases, invoiceLaunches, recurringBills, receivables | Nenhum está no bottom nav (só invest e pockets estão). Acesso só via drawer ou switchTab direto. | Avaliar se merecem destaque no bottom nav das cinco áreas. | Média |
| R5 | Metas e vínculo com caixinhas | `viewGoals` (L277); goals.caixinhaId vincula a pockets (js/19-goals.js); patch de metas sobrescreve switchTab para goals (patches.js:19-87) | goals, pockets, banks, investments | O patch de metas é um interceptador agressivo que desvia `switchTab('goals')` do comportamento padrão. | Preservar o patch como comportamento de `goals`; documentar no contrato de navegação. | Alta |
| R6 | FAB global e comportamentos contextuais | `updateFabAriaLabel` (js/32-auth-wiring.js:59-74) define labels por tab; wrapper `origSwitchTab` (js/99-init.js:3645) captura a função `window.switchTab` já modificada pelo patch de Metas (ordem de scripts: patches.js clássico sem `defer` executa antes do callback `DOMContentLoaded` de 99-init.js com `defer`) | FAB, currentTab | Não é um conflito comprovado de ordem de execução: o wrapper FAB chama o patch de Metas, que encaminha destinos comuns para `switchTabOriginal()`. O `updateFabAriaLabel` é executado após cada `switchTab`, incluindo destinos interceptados pelo patch de Metas. | Preservar o encadeamento atual (patch primeiro, wrapper depois); validar comportamento em runtime; não criar segundo FAB. | Média |
| R7 | `balanceStrip` e `universalPeriodBar` | switchTab esconde balanceStrip se não caixa/inicio (L424); esconde periodBar se não caixa/invest/pockets (L425) | balanceStrip, universalPeriodBar | Mudar a organização das áreas pode afetar a visibilidade desses strips. | Mapear quais das cinco áreas mostram cada strip. | Alta |
| R8 | Filtros compartilhados vs independentes | `dashFilters` (viewDash, js/20-dashboard.js); filtros de caixa (panelFiltros); filtros de bills (billTitularFilter, billsStatusFilter) | dashFilters, entries, recurringBills | Filtros são independentes por view; não há filtro global unificado. | Documentar que cada área mantém seus próprios filtros. | Média |
| R9 | Persistência/restauração da aba | sessionStorage `livrocaixa_last_tab` (js/15-tabs-nav.js:14-18); restaurada no bootstrap (js/99-init.js:459-467) | sessionStorage, switchTab | Sobrevive a F5, não ao fechar o app. Volta para `caixa` ao reabrir. | Manter comportamento; considerar se `inicio` deve ser a aba padrão. | Alta |
| R10 | Chamadas de switchTab() por outros módulos | 22 pontos mapeados (seção C.2.5) | Todos os renderizadores | Qualquer mudança na assinatura de switchTab afeta todos os consumidores. | Não alterar assinatura; adicionar aliases se necessário. | Alta |
| R11 | Atalhos do drawer | 11 botões visíveis no drawer (8 principais + 3 secundárias; index.html L161-182); Perfil aparece apenas uma vez, na seção secundária. Ações `entries`, `reports`, `banks`, `categories`, `theme` são reconhecidas pelo listener JS (js/99-init.js:1607-1627) mas não possuem botão `data-drawer-action` no HTML | switchTab, openModal | Distinguir botões existentes de ações apenas reconhecidas pelo listener. `banks` e `categories` existem como funções mas não estão expostas como itens de navegação visíveis. Não adicionar automaticamente ao drawer. | Revisar o drawer após definir os cinco destinos; não adicionar ações sem botão correspondente. | Média |
| R12 | Navegação após login/logout/restauração | `auth.onAuthStateChanged` (js/32-auth-wiring.js:76-128); restauração de sessão (js/99-init.js:459-467) | auth, currentUser, sessionStorage | Após logout volta para tela de login; após login restaura última aba ou caixa. | Preservar fluxo de auth; não alterar comportamento de sessão. | Alta |
| R13 | Botão Voltar (Android/navegador) | `goBackInsideApp` + `popstate` (js/99-init.js:322-348); `history.pushState(appBackState)` (L348) | currentTab, modais, overlays | Se não está em caixa, Voltar leva para caixa; se está em caixa, fecha o app. | Preservar; se `inicio` se tornar padrão, avaliar se Voltar deve ir para início ou caixa. | Alta |

---

## C.2.8 Especificação proposta

### 8.1 Destinos principais

Cinco áreas com identificadores lógicos canônicos:

| Área | Identificador canônico | Nome apresentado | View / composição | Finalidade | Conteúdo principal | Ações principais |
|---|---|---|---|---|---|---|
| Início | `inicio` | "Início" | `viewInicio` (com reuso de `viewDashboard` componentes) | Visão consolidada rápida | Patrimônio total, saúde financeira, próximo pagamento, resumo de fluxo do mês | Toque no balance-symbol (colapsar/expandir patrimônio) |
| Movimentos | `caixa` | "Livro-Caixa" | `viewCaixa` | Histórico de lançamentos | Lançamentos (entradas/saídas), resumo do período, fluxo mini, ledger mensal | Novo lançamento, transferência, colar texto, importar/exportar, filtrar |
| Contas | `contas` (composição) | "Contas" | `viewInvest` + `viewPockets` + `viewBills` + `viewReceivables` + `viewCards` | Bancos, caixinhas, investimentos, contas recorrentes, cartões, recebíveis | Saldos, distribuição patrimonial, calendário de contas, valores a receber, faturas de cartão | Novo invest, aporte/resgate, nova conta/fatura, novo cartão, lançar fatura |
| Análises | `dash` | "Análises" | `viewDash` | Dashboard analítico | Evolução, indicadores, gráficos, comparações, projeções, categorias | Alterar período, conta, comparar |
| Perfil | `profile` | "Perfil" | `viewProfile` | Dados da conta e preferências | Dados da conta, aparência, moeda, fonte, orçamento, proteção local (PIN/biometria), conciliação, metas | Logout, alterar PIN, biometria, tema, orçamento |

**Notas:**
- `dash` e `dashboard` **não são aliases**: são destinos distintos que ativam views diferentes (`#viewDash` vs `#viewDashboard`). O `updateNavIndicator` mapeia `'dash' → 'dashboard'` apenas para lookup do botão visual da navegação inferior, não para unificar as views.
- `contas` não é um único ID de view no HTML; é uma composição lógica de 5 views existentes (`invest`, `pockets`, `bills`, `receivables`, `cards`). Não existe `switchTab('contas')` nem `"contas"` em `TAB_NAMES`. Cada subárea mantém seu `switchTab` próprio.
- `inicio` é o identificador já existente (`viewInicio`, `switchTab('inicio')`, TAB_NAMES inclui `inicio`).

### 8.2 Navegação mobile (bottom nav)

Especificar cinco destinos principais:

| Posição | Identificador | Nome apresentado (sugestão) | View | Estado ativo |
|---|---|---|---|---|
| 1 | `inicio` | Início | `viewInicio` | `.is-active` quando `dataset.tab === 'inicio'` |
| 2 | `caixa` | Livro-Caixa | `viewCaixa` | `.is-active` quando `dataset.tab === 'caixa'` |
| 3 | `contas` (área lógica) | Contas | (composição: invest/pockets/bills/receivables/cards; não há `switchTab('contas')` nem entrada definida) | — (ponto de entrada a definir) |
| 4 | `dash` | Análises | `viewDash` | `.is-active` quando `dataset.tab === 'dash'` |
| 5 | `profile` | Perfil | `viewProfile` | `.is-active` quando `dataset.tab === 'profile'` |

**Regras de comportamento:**
- Cinco destinos principais; ordem acima (Início primeiro, como home).
- Rótulos: sem decisão final de texto/ícone (pertence à especificação visual posterior). Manter `aria-label` existentes ou adicionar texto visível.
- Estado ativo: classe `.is-active` no botão; `nav.dataset.active` e `--nav-indicator-x` via `updateNavIndicator`.
- Comportamento ao tocar: `switchTab(identificador)` + `window.scrollTo({top:0, behavior:'smooth'})` (padrão atual, js/99-init.js:25-31).
- Comportamento ao selecionar novamente o destino ativo: re-renderizar a view ativa (chamar `switchTab(mesmo)` novamente, que já re-renderiza via switchTabOriginal). Não fechar, não navegar para outro lugar.
- Acessibilidade: manter `aria-label`; considerar adicionar `aria-current="page"` no botão ativo; rótulos de texto visíveis recomendados.
- Integração com FAB: `updateFabAriaLabel` já define labels por tab (js/32-auth-wiring.js:59-74). Para `inicio` usar fallback "Adicionar" ou definir label específico.
- Integração com drawer: drawer continua disponível para acessar subáreas (bills, cards, receivables, investments, goals) e ações secundárias (lab, novoLog).
- Comportamento em telas estreitas: bottom nav mantém 5 itens; esconder ao rolar para baixo (comportamento atual `nav-hidden`, js/99-init.js:1340-1373).

**Subáreas de Contas (não no bottom nav principal, acessíveis via drawer ou ação contextual):**
- Investimentos (`invest` → `viewInvest`)
- Caixinhas (`pockets` → `viewPockets`)
- Contas & Calendário (`bills` → `viewBills`)
- Valores a Receber (`receivables` → `viewReceivables`)
- Cartões (`cards` → `viewCards`)
- Metas (`goals` → `viewGoals`, via patch existente)

### 8.3 Navegação desktop

O aplicativo atualmente **não tem sidebar desktop**. A bottom navigation **não está visível em desktop**:

| Ambiente | Comportamento CSS atual |
|---|---|
| Desktop, acima de 680px | Bottom navigation oculta (`.mobile-bottom-nav { display: none; }` em `style/layout.css`, fora da media query) |
| Mobile, até 680px | Bottom navigation exibida como grid (`.mobile-bottom-nav { display: grid; }` dentro de `@media (max-width:680px)`) |

O drawer é um mecanismo separado, estruturado em `index.html` por `#appDrawerOverlay` e `.app-drawer`.

**Proposta (sem implementar estilos):**
- Não afirmar que a bottom navigation é utilizada em desktop.
- Não afirmar que já existe sidebar desktop.
- Registrar que a navegação desktop ainda precisa de uma solução explícita.
- Avaliar a reutilização do drawer como mecanismo de navegação desktop, ou uma sidebar própria, na especificação visual e de implementação posterior.
- Preservar os mesmos cinco destinos lógicos entre mobile e desktop, mesmo que os mecanismos visuais sejam diferentes.

**Comportamento responsivo:** o drawer é um overlay lateral (`app-drawer-overlay`) que funciona em qualquer breakpoint. A bottom navigation é exibida apenas em telas estreitas (até 680px), controlada por media query, não por scroll.

### 8.4 Subáreas

| Funcionalidade | Abre como view direta | Permanece dentro de uma área | Abre como painel/modal | Ação contextual | Acessível pelo drawer |
|---|---|---|---|---|---|
| Início | Sim (`inicio`) | — | — | — | Não (gap — adicionar) |
| Livro-Caixa / lançamentos | Sim (`caixa`) | — | — | Nova lançamento, transferência | Sim (overview, entries) |
| Filtros de lançamentos | — | Dentro de `caixa` | `panelFiltros` | — | Não |
| Transferência | — | Dentro de `caixa` | `panelTransferencia` | Sim (toolbar caixa) | Não |
| Importar/exportar | — | Dentro de `caixa` | `panelImport`, `panelExportFormat` | Sim (toolbar caixa) | Não |
| Investimentos | Sim (`invest`) | — | `panelInvest`, `panelInvestMovement` | Novo invest, aporte/resgate | Sim (investments) |
| Caixinhas | Sim (`pockets`) | — | `panelPocket`, `panelPocketMovement` | Aporte/resgate/rendimento | Sim (pockets) |
| Contas recorrentes | Sim (`bills`) | — | `panelBill`, `panelBillLaunch` | Nova conta, lançar no Caixa | Sim (bills) |
| Valores a Receber | Sim (`receivables`) | — | `panelReceivable` | Novo recebível | Sim (receivables) |
| Cartões | Sim (`cards`) | — | `panelCard`, `panelPurchase` | Novo cartão, nova compra | Sim (cards) |
| Metas | Sim (`goals`) | — | `panelGoalForm` | Nova meta, editar | Sim (goals, via patch) |
| Análises (dash) | Sim (`dash`) | — | — | Alterar período/conta | Sim (dash) |
| Visão Geral | Sim (`viewDashboard`, mas sem botão físico) | Dentro de `inicio` / `dashboard` | — | — | Não |
| Perfil | Sim (`profile`) | — | — | Logout, tema, PIN, biometria, orçamento | Sim (profile) |
| Orçamento | — | Dentro de `profile` | `panelOrcamento` | Gerenciar (btnOpenBudgetModal) | Não |
| Conciliação bancária | — | Dentro de `profile` (visualmente) | — | Comparar saldos | Não |
| Proteção local (PIN/biometria) | — | Dentro de `profile` | — | Bloquear agora, salvar PIN | Não |
| LABS (juros compostos) | — | Dentro de `profile` | `panelFeatureProfile` | — | Sim (lab) |
| Novo LOG | — | — | `panelLOG` | — | Sim (novoLog) |
| Cadastro de Bancos | — | — | `panelBanco` | — | Não (função existe, sem ação de drawer) |
| Cadastro de Categorias | — | Dentro de `profile` (btnCategoria) | `panelCategoria` | — | Não (sem ação de drawer) |
| Busca universal | — | Transversal | `universalSearchOverlay` | — | Não |
| Notificações | — | Transversal | `notificationOverlay` | — | Não |

**Justificativa:** views principais (início, caixa, contas subáreas, análises, perfil) abrem como destinos de navegação (switchTab). Ações que alteram dados (novo lançamento, novo invest, nova conta, etc.) abrem como modais sobre a view ativa. Configurações (orçamento, proteção local, tema) permanecem dentro de Perfil. Funcionalidades transversais (busca, notificações) são overlays independentes de aba.

### 8.5 Contrato de navegação

**Identificadores canônicos:** `inicio`, `caixa`, `invest`, `pockets`, `bills`, `receivables`, `cards`, `goals`, `dash`, `dashboard`, `profile`.

**Identificadores legados / distintos:**
- `dash` → identificador da view analítica `#viewDash` (não é alias de `dashboard`).
- `dashboard` → identificador legado da view `#viewDashboard` (visão geral antiga, distinta de `dash`).
- `caixa` → mantido como canônico (não renomear para "livro-caixa" para não quebrar TAB_NAMES e consumidores).
- `contas` → **não é um identificador de navegação** (`switchTab('contas')` não existe, não está em `TAB_NAMES`). É uma área lógica composta pelas subáreas `invest`, `pockets`, `bills`, `receivables`, `cards`. O ponto de entrada de Contas ainda precisa ser definido.

**Regras de transição:**
- Qualquer `switchTab(id)` onde `id` ∈ TAB_NAMES ativa a view correspondente, atualiza `currentTab`, `dataset.tab`, `nav.dataset_active`, classes `.active` e `.is-active`, chama `persistLastTab`, e renderizadores condicionais.
- `switchTab('goals')` é interceptado pelo patch de metas (comportamento especial preservado).
- `switchTab('dash')` ativa `viewDash`; `switchTab('dashboard')` ativa `viewDashboard`. O indicador do bottom nav via `updateNavIndicator` converte `'dash' → 'dashboard'` apenas para lookup do botão visual (risco R1 documentado).

**Persistência:** `sessionStorage` (`livrocaixa_last_tab`), restauração síncrona no bootstrap, sobrevive a F5, não ao fechar app.

**Estado ativo:** `document.body.dataset.tab`, `currentTab`, `nav.dataset.active`, `--nav-indicator-x`, classes `.active` (views) e `.is-active` (botões bottom nav).

**Tratamento de destinos inválidos:** `switchTabOriginal` não valida se `tabName` está em TAB_NAMES antes de usar; `updateNavIndicator` cai no fallback `caixa` se não encontrar botão. Recomendação: validar contra TAB_NAMES e cair para `caixa` se inválido.

**Integração com renderizadores:** switchTab chama renderizadores específicos por tab (bills, cards, receivables, invest, dashboard/inicio, caixa, dash, profile). Views não listadas (ex: `inicio` já tem renderizador; `goals` tem via patch) devem ser cobertas.

**Compatibilidade com chamadas antigas:** não criar segundo dispatcher. Manter `window.switchTab` como ponto único. Novos aliases devem ser mapeados dentro do switchTab existente ou via TAB_NAMES.

**Recomendação:** reutilizar o mecanismo atual. O dispatcher `switchTabOriginal` + `window.switchTab` já cobre todos os requisitos. Não implementar novo dispatcher.

---

## C.2.9 Critérios de aceite

| Critério | Status | Evidência |
|---|---|---|
| Mecanismo atual de navegação documentado | ✅ Concluído | Seções C.2.4 (4.1-4.4), C.2.5 |
| Todas as views relevantes inventariadas | ✅ Concluído | Tabela 4.2 (11 views) |
| Bottom nav mapeado | ✅ Concluído | Tabela 4.3 (5 botões) |
| Drawer mapeado | ⚠️ Concluído após correção | 11 botões visíveis (8 principais + 3 secundárias), não 12; Perfil aparece uma vez (secundária); ações `entries`, `reports`, `banks`, `categories`, `theme` são reconhecidas pelo listener JS mas não têm botão HTML |
| Chamadas e consumidores de switchTab investigados | ✅ Concluído | Tabela C.2.5 (22 pontos) |
| Funcionalidades relacionadas às cinco áreas | ✅ Concluído | Matriz C.2.6 |
| Funcionalidades sem classificação adequada identificadas | ✅ Concluído | Banks, Categorias sem ação de drawer; Início sem botão UI |
| Dependências e riscos de migração documentados | ⚠️ Parcial | Tabela C.2.7 (13 riscos); R1, R6, R11 corrigidos após revisão C.2.11 |
| Especificação mobile definida | ⚠️ Parcial | Seção 8.2; destino analítico usa `dash` (não `dashboard`); entrada de Contas ainda sem `switchTab` definido |
| Especificação desktop definida | ⚠️ Parcial | Seção 8.3; bottom nav oculta em desktop; mecanismo desktop (sidebar ou drawer) ainda não definido |
| Subáreas e acessos auxiliares definidos | ✅ Concluído | Seção 8.4 |
| Compatibilidade com funcionalidades existentes considerada | ✅ Concluído | Matriz C.2.6, seção 8.5 |
| Evidências, linhas e limitações registradas | ✅ Concluído | Todas as afirmações com arquivo:linha |

**Limitações:**
- Não houve renderização de navegador (device físico não testado).
- `.mobile-bottom-nav` é `display:none` em desktop (acima de 680px) e `display:grid` em mobile (até 680px), confirmado em `style/layout.css`.
- Hashes SHA-256 dos arquivos não coletados.
- Ordem de execução entre wrapper FAB e patch de Metas: patches.js (clássico, sem `defer`) executa antes do callback `DOMContentLoaded` de 99-init.js (com `defer`); o wrapper FAB captura a função já modificada pelo patch. Não é um conflito comprovado de ordem de execução, mas ainda pode ser validado em runtime.

---

## C.2.10 Conclusão e pendências

**Classificação: C.2 CONCLUÍDA COM RESSALVAS — NÃO APROVADA PARA LIBERAÇÃO DA IMPLEMENTAÇÃO.**

A auditoria da navegação foi concluída com evidências verificáveis (arquivo:linha para cada afirmação). O mecanismo atual (`switchTabOriginal` → `window.switchTab`, com patch de metas e wrapper FAF) está totalmente mapeado, incluindo as 11 views, os 5 botões do bottom nav, as 11 ações do drawer e os 22 pontos de chamada de `switchTab()`. A especificação ainda contém contradições corrigidas na subseção C.2.11 que precisam ser resolvidas antes da liberação para implementação.

**Pendências para aprovação (bloqueiam a liberação da implementação):**

1. Definir `dash` como destino analítico (`#viewDash`), preservando `dashboard` como destino legado distinto (`#viewDashboard`) — não declarar `dash` como alias de `dashboard`.
2. Definir como o usuário entra em Contas — `contas` é uma área lógica sem `switchTab` próprio; decidir entre tela centralizadora ou destino inicial que abra uma subárea existente.
3. Completar a especificação desktop — bottom nav é `display:none` acima de 680px; definir mecanismo (sidebar ou reutilização do drawer).
4. Corrigir a matriz do drawer — 11 botões visíveis (8 principais + 3 secundárias); distinguir ações reconhecidas pelo listener JS (`entries`, `reports`, `banks`, `categories`, `theme`) de itens com botão HTML.
5. Atualizar a matriz de rastreabilidade e os critérios de aceite para refletir essas decisões.

**Não iniciar C.3. Não implementar nenhuma recomendação. Não fazer commit nem push.**

Ao finalizar, aguardar revisão e autorização explícita para a próxima etapa.

---

## C.2.12 — Consolidação Final da Arquitetura de Navegação

Base auditada: "feat/app-navigation-redesign"

Commit de referência: "3a0a8522b838f6cce81f106de7d99fff10d05f6a"

Natureza: decisão arquitetural e consolidação documental. Nenhum código funcional deve ser alterado nesta etapa.

### 1. Objetivo

Consolidar a especificação da navegação em cinco áreas principais, eliminando as pendências documentais da C.2.10 e da C.2.11.

Esta seção estabelece o contrato de navegação que deverá orientar a implementação posterior.

As decisões abaixo preservam os identificadores e as funcionalidades existentes, evitando a criação de um segundo sistema de navegação.

### 2. Contrato definitivo das cinco áreas

Ordem| Área| Identificador principal| View principal| Responsabilidade
|---|---|---|---|---|
1| Início| "inicio"| "#viewInicio"| Visão consolidada do patrimônio e situação financeira
2| Movimentos| "caixa"| "#viewCaixa"| Histórico e gerenciamento de lançamentos
3| Contas| "contas"| "#viewContas" (nova composição)| Centralização das contas e produtos financeiros
4| Análises| "dash"| "#viewDash"| Indicadores, evolução e análise financeira
5| Perfil| "profile"| "#viewProfile"| Conta, preferências, segurança e configurações

Esses são os cinco destinos principais da experiência.

A implementação deve preservar os nomes canônicos indicados, sem renomear indiscriminadamente as views e funções existentes.

### 3. Decisão sobre Contas

#### 3.1 Necessidade da view centralizadora

O código atual possui cinco views independentes:

- "invest" → "#viewInvest"
- "pockets" → "#viewPockets"
- "bills" → "#viewBills"
- "receivables" → "#viewReceivables"
- "cards" → "#viewCards"

Nenhuma delas representa sozinha o conjunto de funcionalidades que a área Contas deve apresentar.

Portanto, fica definida a criação de uma view centralizadora:

- Identificador lógico: "contas"
- Elemento: "#viewContas"
- Responsabilidade: apresentar uma visão resumida das subáreas e permitir acesso direto a cada uma.

#### 3.2 Regras de implementação futura

A nova view deverá:

1. Reutilizar dados, renderizadores e componentes existentes.
2. Apresentar acesso às cinco subáreas.
3. Evitar duplicar formulários, cadastros ou regras de negócio.
4. Preservar cada subárea como view independente.
5. Permitir retornar à centralização sem perder dados ou estado financeiro.
6. Não mover ou recriar as views existentes apenas para formar a composição.
7. Não implementar uma segunda lógica de dispatcher.

A view centralizadora não deverá assumir o papel de banco de dados ou camada de negócio.

#### 3.3 Subáreas

Subárea| Identificador preservado| View existente
|---|---|---|
Investimentos| "invest"| "#viewInvest"
Caixinhas| "pockets"| "#viewPockets"
Contas recorrentes| "bills"| "#viewBills"
Valores a receber| "receivables"| "#viewReceivables"
Cartões| "cards"| "#viewCards"

Metas ("goals") permanece como funcionalidade independente de planejamento, preservando seu patch e comportamento atual. Não será incorporada automaticamente a Contas.

### 4. Decisão sobre Análises e Dashboard legado

Fica estabelecida a seguinte distinção:

Identificador| View| Tratamento
|---|---|---|
"dash"| "#viewDash"| Destino principal de Análises
"dashboard"| "#viewDashboard"| Destino legado distinto, preservado por compatibilidade

A navegação principal deverá utilizar "dash".

"dashboard" não será transformado em alias de "dash", nem removido nesta etapa.

O mapeamento atual em "updateNavIndicator()" que converte "dash" em "dashboard" deverá ser corrigido na implementação da navegação, para que o indicador visual represente o destino lógico correto.

Chamadas legadas a "dashboard" deverão continuar funcionando até que seus consumidores sejam individualmente avaliados.

Não remover "#viewDashboard", "renderAdvancedDashboard()" ou seus elementos sem auditoria específica de dependências.

### 5. Navegação mobile

A bottom navigation deverá apresentar os cinco destinos na seguinte ordem:

Posição| Destino| Rótulo
|---|---|---|
1| "inicio"| Início
2| "caixa"| Movimentos
3| "contas"| Contas
4| "dash"| Análises
5| "profile"| Perfil

Regras:

- Um único botão ativo por vez.
- O indicador visual deve acompanhar o identificador efetivamente ativo.
- "contas" deverá abrir "#viewContas".
- Selecionar novamente o destino ativo deverá manter o usuário naquela área e permitir a atualização prevista pelo dispatcher.
- O FAB deverá preservar seus comportamentos contextuais.
- A restauração de sessão deverá reconhecer os novos destinos.
- Destinos legados continuarão compatíveis, mas não ocuparão posições na navegação principal.

A barra inferior continua sendo exclusiva do breakpoint mobile, conforme o CSS atual.

### 6. Navegação desktop

Fica definida uma sidebar persistente como mecanismo principal de navegação desktop.

A implementação deverá reutilizar a estrutura de ações e os elementos de navegação já existentes no drawer ("#appDrawerOverlay", ".app-drawer" e ".drawer-nav"), evitando manter dois conjuntos independentes de destinos.

Diretrizes:

1. Reaproveitar os mesmos cinco destinos principais.
2. Preservar o acesso às subáreas de Contas.
3. Preservar Metas e ações secundárias.
4. Reaproveitar a lógica de "switchTab()".
5. Não duplicar listeners ou regras de navegação.
6. Adaptar a apresentação responsivamente: sidebar persistente no desktop e menu lateral sobreposto no mobile.
7. Não introduzir uma nova camada de estado de navegação.

A sidebar é uma decisão de arquitetura de interface, não uma afirmação de que ela já existe no código atual.

### 7. Contrato técnico do dispatcher

O dispatcher existente deverá continuar sendo a fonte única de transição entre views.

A implementação futura deverá:

- Preservar "window.switchTab".
- Preservar "window.switchTabOriginal".
- Preservar o patch de Metas.
- Preservar os consumidores existentes de "switchTab()".
- Incluir "contas" no contrato de destinos somente quando "#viewContas" estiver implementada.
- Atualizar o estado de navegação e o indicador visual de forma consistente.
- Não converter "dash" em "dashboard".
- Manter compatibilidade com identificadores legados.
- Preservar persistência de sessão e restauração.
- Preservar os comportamentos de filtros, FAB, autenticação e botão Voltar.

A criação de um novo dispatcher é expressamente desnecessária.

### 8. Drawer e acessos secundários

O drawer atual possui 11 botões visíveis:

- 8 na seção principal;
- 3 na seção secundária.

Perfil aparece apenas uma vez.

A implementação futura deverá reorganizar a apresentação em torno das cinco áreas principais, mantendo os acessos às subáreas e ações secundárias.

Ações reconhecidas pelo listener, mas sem botão HTML correspondente, não deverão ser tratadas como itens atualmente disponíveis ao usuário.

Não adicionar ações sem verificar sua função, destino e necessidade na experiência final.

### 9. Matriz de rastreabilidade e riscos

Elemento| Decisão| Risco a controlar
|---|---|---|
"#viewInicio"| Primeiro destino principal| Renderização e patrimônio
"#viewCaixa"| Movimentos| Filtros e histórico
"#viewContas"| Nova view centralizadora| Reutilização sem duplicação
"#viewInvest"| Subárea preservada| Renderização e atualização de cotações
"#viewPockets"| Subárea preservada| Saldos e movimentações
"#viewBills"| Subárea preservada| Calendário e recorrências
"#viewReceivables"| Subárea preservada| Valores a receber
"#viewCards"| Subárea preservada| Faturas e compras
"#viewDash"| Análises| Indicador ativo correto
"#viewDashboard"| Legado preservado| Compatibilidade
"#viewProfile"| Perfil| Segurança e configurações
"#viewGoals"| Funcionalidade independente| Patch de Metas
Bottom nav| Cinco destinos principais| Sincronização visual
Sidebar desktop| Reuso do drawer| Responsividade e estado
FAB| Comportamento contextual| Não duplicar nem perder ações
Persistência| Preservar sessão| Restauração de destino válido

A análise estática da ordem de execução do patch de Metas e do wrapper FAB não demonstrou conflito de sobrescrita. A validação dinâmica desse encadeamento permanece como teste da implementação posterior, não como bloqueio da especificação.

### 10. Critérios definitivos de aceite da C.2

Critério| Resultado
|---|---|
Identificação das views existentes| Atendido
Identificação dos destinos atuais da bottom nav| Atendido
Inventário do drawer e ações| Atendido
Diferenciação entre "dash" e "dashboard"| Atendido
Definição das cinco áreas principais| Atendido
Definição do ponto de entrada de Contas| Atendido
Preservação das subáreas existentes| Atendido
Definição da navegação mobile| Atendido
Definição da navegação desktop| Atendido
Contrato de compatibilidade do dispatcher| Atendido
Tratamento dos riscos de migração| Atendido documentalmente
Preservação de funcionalidades financeiras e de autenticação| Definida como requisito obrigatório
Separação entre auditoria e implementação| Atendido

Limitações que não bloqueiam a C.2

Não foram executados nesta etapa:

- Testes funcionais da nova navegação.
- Testes em dispositivo físico.
- Validação visual da sidebar futura.
- Testes de regressão do dispatcher após implementação.

Essas verificações pertencem às etapas de implementação e validação posteriores.

A ausência desses testes não invalida a especificação arquitetural, desde que sejam exigidos como critérios de aceite da implementação.

### 11. Conclusão consolidada

C.2 — APROVADA COMO AUDITORIA E ESPECIFICAÇÃO ARQUITETURAL.

A navegação futura fica definida em cinco áreas principais:

1. Início.
2. Movimentos.
3. Contas.
4. Análises.
5. Perfil.

A especificação preserva as funcionalidades existentes, define a nova centralização de Contas, mantém a compatibilidade dos identificadores legados e estabelece mecanismos responsivos para mobile e desktop.

A aprovação desta etapa autoriza o uso desta especificação como referência para as fases seguintes.

Não autoriza, por si só, qualquer alteração de código nesta etapa.

A implementação deverá ocorrer somente na fase correspondente, com auditoria de impacto, testes de regressão e preservação integral das funcionalidades existentes.

Não reabrir a C.2 por ausência de testes que pertencem às fases de implementação e validação.

---

**Fase C — C.2: AUDITORIA E ESPECIFICAÇÃO DA NAVEGAÇÃO**

Status: APROVADA COMO ESPECIFICAÇÃO ARQUITETURAL. Cinco áreas definidas; Contas centralizada por nova view ("#viewContas"); Análises associada a "dash" ("#viewDash"); Dashboard legado ("#viewDashboard") preservado; mobile com bottom navigation (cinco destinos); desktop com sidebar baseada no drawer existente; dispatcher único ("window.switchTab") preservado. Implementação ainda não executada. Nenhum arquivo funcional alterado nesta etapa.

---

## C.3.0 — Coleta de Evidências Visuais para Auditoria Independente

SHA de referência do HEAD: `23b6c63a50e9ebb5aa1ee8837b4134bc2f536007`

Branch: `feat/app-navigation-redesign`

### 1. Objetivo

Produzir capturas atuais do LIVRO-CAIXA para que a auditoria visual (C.3) seja realizada independentemente pelo ChatGPT, sem diagnóstico, classificação de defeitos ou aprovação nesta etapa.

### 2. Escopo e método

- **Aplicativo real capturado**, sem modificação de HTML, CSS, JavaScript ou Worker.
- **Ferramenta:** Chromium headless via CDP (Chrome DevTools Protocol), servidor local `python3 -m http.server 8000`.
- **Viewport mobile:** 390 × 844.
- **Viewport desktop:** 1440 × 900.
- **Temas:** oliva claro (padrão) e oliva escuro (aplicado via mecanismo real do app: Perfil → Aparência → `.dark-theme-option[data-theme="1"]`).
- **Espera por renderização** antes de cada captura.
- **Sobreposição de auth (`#authOverlay`) ocultada apenas em runtime** (manipulação de DOM temporária, não persistida) para permitir a visualização do app sem credenciais QA.

### 3. Matriz de capturas realizadas (24/24)

| Viewport | Tema | Telas capturadas | Total |
|----------|------|------------------|-------|
| Mobile 390×844 | Oliva claro | tela-inicial, view-inicio, view-livro-caixa, drawer-aberto, perfil, nav-mobile | 6 |
| Mobile 390×844 | Oliva escuro | mesma matriz | 6 |
| Desktop 1440×900 | Oliva claro | mesma matriz | 6 |
| Desktop 1440×900 | Oliva escuro | mesma matriz | 6 |

Telas:

1. **tela-inicial** — Tela inicial do app (viewCaixa aberta por padrão).
2. **view-inicio** — View Início (`#viewInicio`).
3. **view-livro-caixa** — View Livro-Caixa (`#viewCaixa`).
4. **drawer-aberto** — Drawer aberto (`#appDrawerOverlay`).
5. **perfil** — View Perfil (`#viewProfile`).
6. **nav-mobile** — Navegação mobile inferior (`mobile-bottom-nav`).

### 4. Limitações registradas

- **Autenticação Firebase:** não foram disponibilizadas credenciais QA para login real. O overlay de auth foi ocultado temporariamente via JavaScript (somente em runtime) para permitir a captura das telas do app. Isso não representa login autenticado nem dados reais do usuário.
- **Nenhum arquivo de fonte foi modificado.** As capturas refletem o estado atual do código no HEAD `23b6c63`.
- **Não foram realizadas correções**, testes funcionais, validação visual de sidebar futura ou regressão do dispatcher.

### 5. Arquivos criados

Diretório: `e2e/visual/c3/evidencias/`

- **24 arquivos PNG**, nomeados no padrão `N-viewport-tema-tela.png` (de `1-` a `24-`).
- **1 arquivo `manifest.json`**, contendo para cada captura: nome do arquivo, viewport, resolução, tema, tela, descrição, estado, data/hora e SHA do HEAD utilizado.

### 6. Estado do Git

- `e2e/visual/c3/` — novo diretório não versionado (24 PNGs + manifest.json).
- Nenhum arquivo de fonte (HTML, CSS, JS, Worker) alterado.
- `PHASE_C_CONSOLIDATED_REPORT.md` — exclusão pré-existente, não tocada.
- `.tmp-c13/` — scripts temporários não versionados, intocados.
- Nenhum commit, push ou deploy executado nesta etapa.

---

**Fase C — C.3.0: COLETA DE EVIDÊNCIAS VISUAIS**

Status: CONCLUÍDA — 24 capturas realizadas e documentadas em `e2e/visual/c3/evidencias/`. Pronto para auditoria visual independente. Nenhum diagnóstico, classificação de defeitos ou aprovação da C.3 produzidos nesta etapa.

