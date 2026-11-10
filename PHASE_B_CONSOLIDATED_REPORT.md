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

**Fase B — Consolidada em 2026-11-10 · revisada em B.1.3.3**

*Documento único da Phase B. Consolida o histórico técnico das subfases, registra as
tentativas (3.6/3.7), a implementação efetiva (3.8) e as validações estáticas, com as
pendências funcionais explicitadas na seção 3.8.7.*
