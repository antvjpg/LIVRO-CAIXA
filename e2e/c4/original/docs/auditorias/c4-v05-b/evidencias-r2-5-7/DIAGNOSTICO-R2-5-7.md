# Diagnóstico C.4-V05-B-R2.5.7

**Correção de colisão de identificadores entre execuções da coleta (F-04)**

| Campo | Valor |
|---|---|
| Versão de trabalho | `C.4-V05-B-R2.5.7` |
| Branch | `feat/app-navigation-redesign` |
| Commit-base | `a790d61612566185d42d24a9d1678faa7f466cf9` |
| Base da implementação | `evidencias-r2-5-6/` (R2.5.6, publicada em `a790d61`) |
| Diretório desta etapa | `docs/auditorias/c4-v05-b/evidencias-r2-5-7/` |
| Data de execução | 2026-11-15 |
| Ambiente | Chromium 156.0.8078.79 headless (Termux/Android), CDP na porta 9222 |
| Núcleo compartilhado | **Não alterado** — a R2.5.7 consome o núcleo publicado na R2.5.6 |
| Alteração em produção | **Nenhuma** |

---

## 1. F-04 — Colisão de identificadores `data-c4-audit` entre execuções

### 1.1 Causa-raiz

O `collectScript` — o script injetado na página que descobre os consumidores de
`--accent` — identificava cada elemento coletado por um índice **local**, que
reiniciava em zero a cada execução.

Trecho anterior (`evidencias-r2-5-6/c4-v05-b-r2-5-6.cjs`, `collectScript`):

```javascript
    let i=0; const arr=[];
```

e, na marcação do elemento:

```javascript
      const key='c4-'+i++;
      el.setAttribute('data-c4-audit',key);
```

O atributo `data-c4-audit` era, portanto, **reutilizado** entre execuções: a
chave `c4-0` designava um elemento na execução *N* e outro elemento na
execução *N+1*.

A resolução da associação (`resolveNodeIds`) consulta o atributo por igualdade
exata:

```javascript
        const qs = await DOM.querySelectorAll({
          nodeId: rootNodeId,
          selector: `[data-c4-audit="${key}"]`
        });
        const ids = qs.nodeIds || [];
        const result = resolveNodeIdResult(ids, key, `[data-c4-audit="${key}"]`);
```

Com duas execuções no mesmo documento e o mesmo índice, o seletor casa **dois**
elementos. O contrato de cardinalidade do núcleo então classifica corretamente
a ocorrência — mas como ambígua:

```javascript
function resolveNodeIdResult(ids, key, selector) {
  ...
  if (ids.length === 1) {
    return { status: 'resolved', nodeId: ids[0], key, selector: selector || null, idCount: 1 };
  }
  return { status: 'ambiguous-node-association', nodeId: null, key, selector: selector || null, idCount: ids.length };
}
```

Ou seja: a associação **não é resolvida**, a linha perde a captura das regras
CSS vencedoras e a evidência de ancestralidade do mecanismo rigoroso.

### 1.2 Por que a colisão se manifesta no fluxo real

Três condições coexistem no fluxo do harness:

1. **`collectScript` é executado repetidamente.** No `main()`, a coleta roda em
   três pontos (temas claros em abas/drawer, temas claros em painéis, temas
   escuros em abas), e cada um deles itera temas e telas — dezenas de execuções
   por rodada de coleta.
2. **A navegação mantém as views anteriores montadas.** `openTab()` chama
   `window.switchTab(...)`; no aplicativo, as views anteriores permanecem no
   DOM.
3. **A limpeza dos atributos ocorre apenas no fim.** O `finally` do `main()`
   remove todos os `data-c4-audit` do documento — **uma única vez**, ao encerrar
   a coleta, e não entre execuções.

```javascript
  } finally {
    // R25-09: limpeza garantida das mutações temporárias no DOM mesmo após falha
    try {
      await evalv(`(()=>{document.querySelectorAll('[data-c4-audit]').forEach(e=>e.removeAttribute('data-c4-audit'));...})()`);
```

Resultado: os elementos da view anterior, já montados, **conservam** o atributo
da execução que os descobriu. A execução seguinte reutiliza o mesmo índice e
atribui a mesma chave a outro elemento — colisão.

### 1.3 Reprodução determinística

O teste Z1 reproduz a falha usando o caminho **real** de resolução: o elemento
antigo recebe a chave da execução corrente (como o contador reiniciado faria)
e a resolução real encontra dois elementos para a mesma chave.

```
PASS: Z1: com chaves reutilizadas, a resolucao real encontra dois elementos para a mesma chave
PASS: Z1: a reutilizacao de chave produz ambiguous-node-association (reproducao de F-04)
PASS: Z1: a associacao ambigua nao escolhe arbitrariamente um nodeId
```

---

## 2. Correção — identificador exclusivo por execução

### 2.1 Decisão

A correção isola as identidades **sem apagar nada do DOM**. Cada execução passa
a ter um identificador próprio, obtido de um **contador monotônico no contexto
da página**; a chave de cada elemento é composta por esse identificador e pelo
índice local.

Alternativas descartadas, com a razão:

| Alternativa | Por que não foi adotada |
|---|---|
| Remover todos os `data-c4-audit` antes de cada execução | Proibido pela especificação e pela própria regra: interfere em outra execução, diagnóstico ou ferramenta que use o mesmo atributo. Além disso, não resolve a coexistência de execuções sobrepostas. |
| Identificador aleatório | Não é monotônico nem verificável; a especificação pede contador monotônico. |
| Identificador derivado do horário | Não é monotônico sob chamadas no mesmo milissegundo e não é verificável. |
| `backendNodeId` do CDP | Requer migração do contrato de resolução, expressamente fora do escopo desta rodada. |

### 2.2 Trecho anterior

```javascript
  const collectScript = `(() => {
    const exact = (a,b) => {
```

```javascript
    let i=0; const arr=[];
```

```javascript
      const key='c4-'+i++;
      el.setAttribute('data-c4-audit',key);
```

```javascript
    return {rows:arr, derivedCount: derivedCandidates.length, derivedExample: ...};
```

### 2.3 Trecho novo

```javascript
  const collectScript = `(() => {
    // R25.7: identificador exclusivo por execucao da coleta.
    // O contador e monotonico e vive no contexto da pagina, de modo que duas
    // execucoes da mesma pagina nunca reutilizam o mesmo identificador, mesmo
    // quando as views anteriores continuam montadas no DOM. Nao se depende de
    // aleatoriedade e Nao se removem atributos de execucoes anteriores.
    const RUN_COUNTER_KEY = '__c4AuditRunCounter';
    if (typeof window[RUN_COUNTER_KEY] !== 'number') window[RUN_COUNTER_KEY] = 0;
    const runId = ++window[RUN_COUNTER_KEY];
    const exact = (a,b) => {
```

```javascript
      // R25.7: a chave carrega a identidade da execucao, de modo que uma
      // execucao posterior nunca reutiliza a chave de uma execucao anterior.
      const key='c4-'+runId+'-'+i++;
      el.setAttribute('data-c4-audit',key);
```

```javascript
    return {rows:arr, runId: runId, derivedCount: derivedCandidates.length, derivedExample: ...};
```

**Por que o contador vive no contexto da página.** O problema é o *documento*
compartilhado entre execuções: as views permanecem montadas, o documento não.
Um contador em `window` sobrevive à navegação interna e por isso distingue
execuções que ocorrem no mesmo documento; a recarga completa da página zera
tudo — e com ela os elementos antigos, que desaparecem junto.

**Por que a chave é composta e não apenas incrementada.** A chave precisa ser
única **dentro** do documento, porque é o valor do atributo consultado pelo
seletor. `c4-<runId>-<i>` satisfaz essa exigência: dois elementos de execuções
diferentes jamais compartilham o valor do atributo.

### 2.4 A resolução passa a ser restrita à execução corrente

Trecho anterior:

```javascript
async function resolveNodeIds(DOM, rows, cdpErrors) {
    const map = new Map();
    ...
    for (const row of rows) {
      const key = row.key;
      if (!key) continue;
      try {
        const qs = await DOM.querySelectorAll({
          nodeId: rootNodeId,
          selector: `[data-c4-audit="${key}"]`
        });
```

Trecho novo:

```javascript
async function resolveNodeIds(DOM, rows, cdpErrors, runId) {
    const map = new Map();
    // R25.7: a resolucao e restrita a execucao corrente. Uma chave pertencente
    // a outra execucao NAO e resolvida: o elemento antigo continua no DOM com
    // o atributo antigo e nao pode contaminar a associacao atual. Sem o
    // identificador da execucao, nenhuma associacao e resolvida — ausencia de
    // evidencia nunca e convertida em sucesso.
    const runPrefix = (runId === undefined || runId === null) ? null : 'c4-' + runId + '-';
    ...
    for (const row of rows) {
      const key = row.key;
      if (!key) continue;
      if (runPrefix === null) {
        map.set(key, { status: 'node-not-found', nodeId: null, key, selector: `[data-c4-audit="${key}"]`, idCount: 0, reason: 'execucao da coleta nao informada' });
        continue;
      }
      if (!key.startsWith(runPrefix)) {
        map.set(key, { status: 'node-not-found', nodeId: null, key, selector: `[data-c4-audit="${key}"]`, idCount: 0, reason: 'chave pertence a outra execucao da coleta' });
        continue;
      }
      try {
        const qs = await DOM.querySelectorAll({
          nodeId: rootNodeId,
          selector: `[data-c4-audit="${key}"]`
        });
```

O status `node-not-found` e o motivo explícito preservam o vocabulário de status
do núcleo (`resolveNodeIdResult` **não** foi alterado) e garantem que a recusa
nunca seja apresentada como sucesso.

Os três pontos de produção passaram a informar o identificador corrente:

```javascript
          const nodeIdMap = await resolveNodeIds(DOM, raw.rows, cdpErrors, raw.runId);
```

### 2.5 Núcleo compartilhado — não alterado

`resolveNodeIdResult`, `traverseAncestorChain`, `buildAuditRow` e todo o resto
do núcleo permanecem exatamente como publicados na R2.5.6. A R2.5.7 **não
copia** o núcleo: o harness e a suíte consomem
`../evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs`.

```javascript
// R25.7: o nucleo compartilhado NAO foi alterado nesta rodada.
// A R2.5.7 usa exatamente o nucleo publicado na R2.5.6.
const CORE_PATH = path.resolve(SCRIPT_DIR, '../evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs');
```

### 2.6 Diff funcional do harness

O diff entre o harness da R2.5.6 e o da R2.5.7, normalizado para os nomes de
arquivo, resume-se a: (a) o `CORE_PATH`; (b) o contador de execução; (c) a
composição da chave; (d) o `runId` no retorno do `collectScript`; (e) a
assinatura e as guardas de `resolveNodeIds`; (f) os três call sites
informando `raw.runId`. Nada mais.

---

## 3. Testes

### 3.1 Reprodução e correção

| ID | Asserções | Resultado |
|---|---|---|
| Z1 | 3 | Reprodução de F-04 pelo caminho real de resolução: 2 elementos para a mesma chave → `ambiguous-node-association`, sem escolha arbitrária de `nodeId` |
| Z2 | 4 | Identificadores de execução distintos e monotônicos; nenhuma chave reutilizada; todas as chaves carregam o identificador da execução |
| Z3 | 5 | Todas as linhas da execução atual resolvidas com exatamente um `nodeId`; o `nodeId` pertence ao elemento que recebeu a chave; o elemento antigo conserva o próprio atributo e não recebe a chave atual |

### 3.2 Múltiplas execuções

| ID | Asserções | Resultado |
|---|---|---|
| Z4 | 6 | Três execuções sucessivas: identificadores distintos e crescentes, nenhuma chave repetida, todas as linhas resolvidas, nenhuma associação ambígua, chave de execução anterior não resolvida na execução atual |
| Z5 | 4 | View anterior oculta e ainda montada: execução atual resolve sem ambiguidade, chave não reutilizada, consumidor oculto não descoberto (pré-filtro de visibilidade) e mantém o atributo da execução que o descobriu |

### 3.3 Situações negativas

| ID | Asserções | Resultado |
|---|---|---|
| Z6 | 2 | Chave inexistente → `node-not-found`, sem `nodeId` |
| Z7 | 2 | Chave duplicada dentro da execução atual → `ambiguous-node-association`, `idCount` 2, nenhum `nodeId` escolhido |
| Z8 | 3 | Chave antiga de outra execução → `node-not-found`, sem `nodeId`, causa explícita registrada |
| Z9 | 3 | Erro CDP durante a resolução → `cdp-error`, sem `nodeId`, erro registrado no registro de erros |
| Z10 | 1 | Resolução sem identificador de execução → nenhuma associação resolvida |

**Total do grupo Z:** 33 asserções, 33 PASS, 0 FAIL, 0 BLOCKED.

### 3.4 Nota sobre a adaptação dos testes Y

Os testes Y da R2.5.6 chamavam `harness.resolveNodeIds(DOM, rows, cdpErrors)`.
Com a nova assinatura, foram adaptados para informar `raw.runId`. **Nenhuma
asserção foi removida, renomeada, reescrita ou enfraquecida**: as 30 asserções
do grupo Y permanecem idênticas no texto e continuam aprovadas. A adaptação é
mecânica e corresponde à integração exigida por T3.

### 3.5 Preservação da herança

| Métrica | Resultado |
|---|---|
| Asserções históricas da R2.5.6 | 360 (359 PASS + 1 BLOCKED) |
| Asserções históricas **ausentes** na R2.5.7 | **0** |
| Asserções novas | 33 (33 PASS) |
| V32 | permanece BLOCKED, com a mesma causa |
| V32b | permanece sendo evidência de precedência, sem alegar distribuição real por slot |

---

## 4. Limitações

### L-01 — Distribuição real por slot segue não observável

Inalterado em relação à R2.5.6: o Chromium 156.0.8078.79 (build Termux/Android)
não computa a tabela de slots do shadow root. **V32 permanece BLOCKED** e
**V32b** continua sendo evidência da precedência da regra.

### L-02 — Atributo antigo é sobrescrito quando o elemento é redesenhado

O atributo `data-c4-audit` guarda **apenas a chave da última execução** que
desenhou o elemento. Se o mesmo elemento for redesenhado por uma execução
posterior, a chave anterior deixa de existir no DOM.

Isso não afeta o fluxo de produção, em que a resolução ocorre **imediatamente**
após cada execução. O teste Z4 reproduz essa ordem e confirma que todas as
linhas de cada execução são resolvidas no momento da execução. A observação
está registrada porque o comportamento é uma consequência direta da correção e
não foi silencioso.

### L-03 — Coleta completa não executada

Por estar fora do escopo, o harness não executou a coleta de consumidores
`--accent` contra a aplicação. A integração foi validada contra a fixture, com
o mesmo `collectScript` e o mesmo `resolveNodeIds` de produção.

### L-04 — O contador de execução é estado de página

`window.__c4AuditRunCounter` é estado de instrumentação persistido na página
enquanto ela viver. Ele é reiniciado por uma recarga completa — o que também
descarta os elementos antigos. Não há dependência de aleatoriedade.

---

## 5. Conclusão do diagnóstico

F-04 está corrigido com a menor alteração verificável possível: um contador
monotônico no contexto da página, uma chave composta pela identidade da
execução, e a restrição da resolução à execução corrente. Nenhum atributo de
execução anterior é apagado; nenhum mecanismo anterior foi reaberto; o núcleo
compartilhado não foi tocado.

A aprovação da R2.5.7 permanece com a auditoria independente.
