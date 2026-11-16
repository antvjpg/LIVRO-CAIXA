# Diagnóstico C.4-V05-B-R2.5.6

**Correção do contrato de exceções CDP e integração do mecanismo rigoroso de visibilidade**

| Campo | Valor |
|---|---|
| Versão de trabalho | `C.4-V05-B-R2.5.6` |
| Branch | `feat/app-navigation-redesign` |
| Commit-base | `b39ed07f94e2a6d374ca2596f6f020933ed05f3a` |
| Base da implementação | `evidencias-r2-5-5/` (R2.5.5, publicada em `b39ed07`) |
| Diretório desta etapa | `docs/auditorias/c4-v05-b/evidencias-r2-5-6/` |
| Data de execução | 2026-11-15 |
| Ambiente | Chromium 156.0.8078.79 headless (Termux/Android), CDP na porta 9222 |
| Alteração em produção | **Nenhuma** |

---

## 1. Objetivo

Fechar os dois pontos que impediram a aprovação da R2.5.5:

1. o tratamento de `exceptionDetails` não era uniforme na leitura do próximo ancestral;
2. o coletor principal mantinha uma segunda travessia independente de ancestrais, sem utilizar o mecanismo rigoroso do núcleo.

Nenhum arquivo de produção foi alterado. Nenhum arquivo de `js/`, `style/` ou `index.html` foi tocado.

---

## 2. F-01 — O tratamento de `exceptionDetails` era assimétrico na travessia

### 2.1 Causa-raiz

A leitura do **estilo** do nível corrente verificava `exceptionDetails` antes de interpretar o resultado; a leitura do **próximo ancestral** não verificava.

Trecho anterior (`c4-v05-b-r2-5-5-core.cjs`, função `traverseAncestorChain`, passo 6):

```javascript
// 6) Próximo ancestral na árvore composta.
const parentInfo = await Runtime.callFunctionOn({
  objectId: currentObjectId,
  functionDeclaration: ANCESTOR_PARENT_FUNCTION,
  returnByValue: false,
});
const parentObject = parentInfo ? parentInfo.result : null;
if (!parentObject || !parentObject.objectId) {
  // Ausência de pai: a raiz real não foi alcançada.
  result.ancestorVisibility = ANCESTOR_VISIBILITY_PARTIAL;
  result.ancestorFailureReason =
    'não foi possível obter o elemento pai para continuar a travessia';
  break;
}
```

O CDP **resolve** a promessa de `Runtime.callFunctionOn` quando a função executada
no Chromium lança uma exceção, devolvendo `exceptionDetails` na resposta. Nesse
caso `parentInfo.result` não contém um `objectId` utilizável, e o código caía
no ramo de "ausência de pai", classificando a ocorrência como `partial` — estado
que significa "falha de leitura", e não "exceção".

A consequência é uma classificação falsa: uma exceção real no navegador era
reportada como se o pai simplesmente não tivesse sido encontrado.

O caminho de estilo já tratava o caso corretamente (linhas 796–798 da R2.5.5):

```javascript
if (styleInfo && styleInfo.exceptionDetails) {
  throw new Error(describeCDPException(styleInfo.exceptionDetails));
}
```

### 2.2 Trecho novo

```javascript
// 6) Próximo ancestral na árvore composta.
const parentInfo = await Runtime.callFunctionOn({
  objectId: currentObjectId,
  functionDeclaration: ANCESTOR_PARENT_FUNCTION,
  returnByValue: false,
});

// R25.6: o CDP pode resolver a chamada normalmente e devolver
// `exceptionDetails` quando a função executada no Chromium lança uma
// exceção. Sem esta verificação, a exceção seria confundida com a
// simples ausência de `result`/`objectId` e classificada como
// 'partial'. A verificação ocorre ANTES de qualquer interpretação do
// resultado, para que a exceção seja tratada pelo catch como 'error'.
if (parentInfo && parentInfo.exceptionDetails) {
  throw new Error(describeCDPException(parentInfo.exceptionDetails));
}

const parentObject = parentInfo ? parentInfo.result : null;
if (!parentObject || !parentObject.objectId) {
  // Ausência de pai: a raiz real não foi alcançada.
  result.ancestorVisibility = ANCESTOR_VISIBILITY_PARTIAL;
  result.ancestorFailureReason =
    'não foi possível obter o elemento pai para continuar a travessia';
  break;
}
```

### 2.3 Comportamento

- **Anterior:** exceção real na leitura do pai → `ancestorVisibility: 'partial'`.
- **Novo:** exceção real na leitura do pai → `ancestorVisibility: 'error'`, com
  `ancestorFailureReason` contendo a descrição da exceção observada e as
  evidências anteriores preservadas.
- A precedência de `ancestorOpacityStatus` **não** foi alterada: um produto zero
  já alcançado continua `conclusive-zero`, mesmo diante de exceção posterior.

### 2.4 Evidência

- **X1** — exceção real em `exceptionDetails` na leitura do pai: `error`, não
  `partial`, não `unavailable`, causa identificada.
- **X2** — opacidade zero coletada antes da exceção: `error`, `ancestorOpacity`
  preservado em `0`, `ancestorOpacityStatus: 'conclusive-zero'`,
  `visibilityStatus: 'not-visible'`.
- **X3** — evidência de `visibility:hidden` de ancestral preservada: `error`,
  `ancestorHidden: true`, `visibilityStatus: 'unknown'`.
- **X4** — os dois caminhos de exceção (execução no navegador e rejeição no
  cliente CDP) resultam em `error`, cada um com a sua própria causa registrada.

A exceção é executada de fato no Chromium: o teste instala um getter de
`assignedSlot` que lança, e a resposta CDP é observada **sem alteração** para
confirmar que ela contém `exceptionDetails` e que a promessa foi resolvida
(não rejeitada).

---

## 3. F-02 — A coleta principal mantinha uma segunda travessia independente

### 3.1 Causa-raiz

O `collectScript` — script injetado na página para descobrir os consumidores de
`--accent` — calculava, por conta própria, opacidade acumulada e presença de
ancestral com `display:none`.

Trecho anterior (`c4-v05-b-r2-5-5.cjs`, dentro de `collectScript`):

```javascript
// R25-04: computar opacidade acumulada e visibilidade dos ancestrais
let ancestorOpacityAcc = 1;
let ancestorHiddenAcc = false;
let anc = el.parentElement;
const visitedAnc = new Set();
while (anc && anc !== document.documentElement && visitedAnc.size < 50) {
  if (visitedAnc.has(anc)) break;
  visitedAnc.add(anc);
  try {
    const acs = getComputedStyle(anc);
    if (acs.display === 'none') {
      ancestorHiddenAcc = true;
      break;
    }
    const ao = parseFloat(acs.opacity);
    if (!isNaN(ao)) ancestorOpacityAcc *= ao;
  } catch (e) {
    break;
  }
  anc = anc.parentElement;
}
```

e, no objeto de linha produzido pelo mesmo script:

```javascript
accentProperty: accentResult.property,
// R25-04: opacidade acumulada dos ancestrais e visibilidade de ancestral com display:none
ancestorOpacity: ancestorOpacityAcc,
ancestorHidden: ancestorHiddenAcc
```

Essa travessia não tinha a semântica do mecanismo da R2.5.5:

| Aspecto | Travessia do `collectScript` | Mecanismo do núcleo (R2.5.5) |
|---|---|---|
| Identificação da raiz | `anc !== document.documentElement` (loop) | `this === document.documentElement` |
| Árvore composta | apenas `parentElement` | `assignedSlot` → `parentElement` → host do shadow root |
| Elemento desconectado | percorria até o fim, sem sinalizar | travessia incompleta |
| `display:none` | interrompia e marcava `ancestorHidden` | interrompe com estado `short-circuited` |
| Opacidade | `parseFloat` sem validação; ausente virava `1` | validação estrita, status de completude |
| Limite de profundidade | `visitedAnc.size < 50` (contagem de nós, não de níveis) | `MAX_ANCESTOR_DEPTH` sobre níveis examinados |
| Resultado disponível | dois campos numéricos | estado terminal + contrato de integridade |

### 3.2 Trecho removido

O laço acima e os dois campos `ancestorOpacity` e `ancestorHidden` foram
removidos do `collectScript`. No lugar, resta o registro explícito:

```javascript
// R25.6: a travessia de ancestrais NAO e mais feita aqui. A evidencia de
// ancestralidade passa a vir exclusivamente do mecanismo rigoroso do
// nucleo compartilhado (core.traverseAncestorChain), invocado pelo
// harness apos a associacao valida key->nodeId.
```

**Verificação de escopo:** a diferença entre o `collectScript` da R2.5.5 e o da
R2.5.6, comparada no código-fonte, resume-se **exatamente** ao bloco removido e
aos dois campos retirados. Nenhuma outra linha do script injetado mudou — a
descoberta de consumidores, a identificação de pseudo-elementos, a coleta SVG,
a geometria, as cores e os fundos permanecem byte a byte iguais.

### 3.3 Integração nova

O mecanismo passa a ser exposto pelo núcleo compartilhado (F-03) e consumido
pelo harness após a associação válida `key → nodeId`.

No núcleo (`c4-v05-b-r2-5-6-core.cjs`), o objeto retornado por
`createCDPAuditCore()`:

```javascript
return {
  getWinningRule,
  captureWinningRules,
  probeState,
  // R25.6: a mesma implementação de travessia usada por probeState() é
  // exposta para a coleta principal, que deixa de manter uma travessia
  // independente de ancestrais. Não há cópia: é a mesma função.
  traverseAncestorChain,
  resolveNodeIdResult,
  createSampleIdRegistry,
  // demais métodos existentes preservados
  ...
};
```

No harness (`c4-v05-b-r2-5-6.cjs`), três funções novas no escopo do módulo:

```javascript
// R25.6: classificacao de visibilidade a partir do resultado do mecanismo.
function classifyVisibility(traversal) {
  if (!traversal) return 'unknown';
  if (traversal.ancestorDisplayNone === true) return 'hidden';
  if (
    traversal.ancestorOpacity === 0 &&
    traversal.ancestorOpacityStatus === 'conclusive-zero'
  ) {
    return 'not-visible';
  }
  if (
    traversal.ancestorVisibility === 'completed' &&
    traversal.ancestorOpacityStatus === 'complete' &&
    typeof traversal.ancestorOpacity === 'number' &&
    traversal.ancestorOpacity > 0
  ) {
    return 'visible';
  }
  return 'unknown';
}

// R25.6: evidencia de ancestralidade obtida do nucleo compartilhado.
async function collectAncestryEvidence(core, assoc) {
  if (!assoc || assoc.status !== 'resolved' || !assoc.nodeId) {
    const status = assoc ? assoc.status : 'desconhecido';
    return {
      ancestorVisibility: 'unavailable',
      ancestorOpacity: null,
      ancestorOpacityStatus: 'unavailable',
      ancestorHidden: false,
      ancestorDisplayNone: false,
      ancestorDepth: 0,
      ancestorFailureReason:
        'associacao key->nodeId invalida (' + status + '); travessia de ancestrais nao executada',
      visibilityStatus: 'unknown',
    };
  }
  const traversal = await core.traverseAncestorChain(assoc.nodeId);
  return {
    ancestorVisibility: traversal.ancestorVisibility,
    ancestorOpacity: traversal.ancestorOpacity,
    ancestorOpacityStatus: traversal.ancestorOpacityStatus,
    ancestorHidden: traversal.ancestorHidden,
    ancestorDisplayNone: traversal.ancestorDisplayNone,
    ancestorDepth: traversal.ancestorDepth,
    ancestorFailureReason: traversal.ancestorFailureReason,
    visibilityStatus: classifyVisibility(traversal),
  };
}

// R25.6: construcao da linha final da coleta principal.
async function buildAuditRow({ core, row, association, context }) {
  const assoc = association || { status: 'node-not-found', nodeId: null, key: row.key, selector: row.sel, idCount: 0 };
  let wr = null;
  if (assoc.status === 'resolved' && assoc.nodeId) {
    wr = await core.captureWinningRules(row, assoc.nodeId);
  } else {
    wr = { error: assoc.status, properties: {}, association: assoc };
  }
  const ancestry = await collectAncestryEvidence(core, assoc);
  const m = measure(row);
  return { ...context, ...row, ...m, winningRules: wr, nodeAssociation: assoc, ...ancestry };
}
```

Os três pontos de produção da linha (`result.rows.push`) — temas claros em
abas/drawer, temas claros em painéis e temas escuros em abas — passaram a chamar
`buildAuditRow(...)`, que é a **mesma** função usada pelo teste de integração.

### 3.4 Preservação da coleta

Nada foi alterado em `KEY_SELECTORS`, `STATE_SELECTORS`, `STATE_STATES`, na
descoberta de consumidores, na identificação de pseudo-elementos, na coleta SVG,
em `captureWinningRules()`, na geometria, na associação de `nodeId`, na captura
de cores e fundos, na navegação entre telas e nos ciclos de temas e viewports.

A função `visible()` do `collectScript` permanece como **pré-filtro de
candidatos**. Ela é a única fonte da confirmação das condições próprias do
elemento (display, visibility, opacity e área de layout) e não substitui o
mecanismo rigoroso: a evidência de ancestralidade e a classificação de
visibilidade vêm exclusivamente de `core.traverseAncestorChain()`.

---

## 4. F-03 — `DOM.getDocument()` invalidava a associação de quase todas as linhas

Este achado **não constava** da especificação da R2.5.6 e foi descoberto durante
a execução do teste de integração. Ele é registrado aqui porque altera o
comportamento do harness e precisa da decisão do auditor.

### 4.1 Fato observado

`DOM.getDocument()` reinicia o mapeamento de `nodeId` do agente DOM. Medição
direta, em Chromium 156.0.8078.79:

```
nodeId obtido: 333
1) describeNode antes de outro getDocument: OK -> DIV
2) describeNode DEPOIS de outro getDocument: FALHOU -> Could not find node with given id
3) nodeId da PRIMEIRA consulta apos a segunda: FALHOU -> Could not find node with given id
4) nodeId da SEGUNDA consulta (ultima): OK -> SPAN
```

### 4.2 Causa-raiz

A `resolveNodeIds` da R2.5.5 chamava `DOM.getDocument()` **dentro do laço**, uma
vez por linha:

```javascript
for (const row of rows) {
  const key = row.key;
  if (!key) continue;
  try {
    const root = await DOM.getDocument({ depth: -1, pierce: true });   // <- invalida os nodeIds anteriores
    const qs = await DOM.querySelectorAll({ nodeId: root.root.nodeId, selector: `[data-c4-audit="${key}"]` });
    ...
```

Consequência: de todas as linhas do lote, **apenas a última** mantinha um
`nodeId` utilizável. A linha imediatamente anterior à última já estava inválida.

### 4.3 Impacto

Este defeito é pré-existente e afeta o harness da R2.5.5. Ele atingia:

- `core.captureWinningRules(c, assoc.nodeId)`, executado logo após a
  associação, que recebia um `nodeId` inválido para todas as linhas exceto a
  última do lote;
- a nova integração `core.traverseAncestorChain(assoc.nodeId)`, que falharia
  do mesmo modo.

A integração exigida pela R2.5.6 **não pode funcionar** enquanto a associação
for inutilizável: a evidência de ancestralidade da linha viria de uma falha de
resolução, e não do mecanismo.

### 4.4 Correção aplicada

`DOM.getDocument()` passou a ser obtido **uma vez por lote**, fora do laço:

```javascript
async function resolveNodeIds(DOM, rows, cdpErrors) {
  const map = new Map();
  // R25.6: DOM.getDocument() reinicia o mapeamento de nodeIds do agente DOM.
  // Chama-lo dentro do loop invalidava o nodeId de todas as linhas ja
  // consultadas, de modo que apenas a ultima linha do lote mantinha uma
  // associacao utilizavel. O documento e obtido UMA vez por lote.
  let rootNodeId = null;
  try {
    const root = await DOM.getDocument({ depth: -1, pierce: true });
    rootNodeId = root.root.nodeId;
  } catch (e) {
    cdpErrors.push(makeCDPErrorRecord('DOM.getDocument', e.name, e.message, {}));
    for (const row of rows) {
      if (!row.key) continue;
      map.set(row.key, { status: 'cdp-error', nodeId: null, key: row.key, selector: `[data-c4-audit="${row.key}"]`, idCount: 0 });
    }
    return map;
  }
  for (const row of rows) {
    const key = row.key;
    if (!key) continue;
    try {
      const qs = await DOM.querySelectorAll({ nodeId: rootNodeId, selector: `[data-c4-audit="${key}"]` });
      const ids = qs.nodeIds || [];
      const result = resolveNodeIdResult(ids, key, `[data-c4-audit="${key}"]`);
      map.set(key, result);
    } catch (e) {
      cdpErrors.push(makeCDPErrorRecord('DOM.querySelectorAll', e.name, e.message, {
        selector: `[data-c4-audit="${key}"]`,
      }));
      map.set(row.key, { status: 'cdp-error', nodeId: null, key, selector: `[data-c4-audit="${key}"]`, idCount: 0 });
    }
  }
  return map;
}
```

O contrato de cardinalidade (`resolveNodeIdResult`), o tratamento de erro
(`cdp-error`) e o formato do registro permanecem idênticos. A única mudança é a
frequência da chamada que invalida identificadores.

**Regressão coberta:** o teste Y5 verifica que, em um lote com múltiplas
associações resolvidas, **todas** permanecem utilizáveis após a resolução.

### 4.5 Ponto para decisão do auditor

A correção altera o harness fora do que a especificação da R2.5.6 descrevia. Foi
adotada porque a integração exigida por T4 e T6 é inexequível sem ela, e porque
o defeito é demonstrado por experimento controlado. O auditor pode considerar
alternativas (por exemplo, usar `backendNodeId` em vez de `nodeId`, que é estável
entre chamadas de `getDocument`) e decidir se a correção deve permanecer nesta
etapa ou ser adiada.

---

## 5. Extração estrutural mínima para o teste de integração

O teste de integração (T6) precisa exercitar o fluxo real da coleta principal
sem executar a coleta completa — que é proibida nesta etapa. O harness foi,
portanto, reorganizado de forma mínima:

1. o fluxo principal passou a ser a função `main()`, executada apenas quando o
   módulo é o ponto de entrada (`require.main === module`);
2. `collectScript` e `resolveNodeIds` passaram ao escopo do módulo;
3. `buildAuditRow`, `collectAncestryEvidence` e `classifyVisibility` foram
  extraídas para o escopo do módulo e exportadas.

Nenhuma lógica de integração foi copiada para dentro do teste: o teste importa o
`collectScript`, o `resolveNodeIds` e o `buildAuditRow` **do próprio harness** e
os executa contra a fixture real.

A reorganização é verificável por diff: fora do `collectScript` (cuja diferença
está integralmente descrita na seção 3.2), o harness difere da R2.5.5 apenas
pela extração descrita acima e pelas três substituições de `result.rows.push()`.

---

## 6. Limitações que permanecem

### L-01 — Distribuição real por slot segue não observável

O Chromium 156.0.8078.79 (build Termux/Android) não computa a tabela de slots do
shadow root: `element.assignedSlot` é `null` e `slot.assignedNodes()` retorna
lista vazia, inclusive no caso canônico. O teste **V32 permanece BLOCKED** com
causa específica. **V32b** continua sendo evidência da *precedência* da regra, e
não da distribuição real — nenhuma afirmação em sentido contrário é feita.

### L-02 — Exceção do lado do navegador agora tem cobertura direta

A limitação L-02 da R2.5.5 (exceção do lado do navegador sem teste dedicado)
**foi superada**: X1, X2 e X3 provocam a exceção dentro do Chromium e observam
`exceptionDetails` na resposta real do CDP.

### L-03 — O harness não executou coleta completa

Por estar fora do escopo, o harness não executou a coleta de consumidores
`--accent` contra a aplicação. A integração foi validada contra a fixture, com o
mesmo `collectScript` e o mesmo `resolveNodeIds` de produção.

### L-04 — A pré-seleção `visible()` continua no `collectScript`

Ela permanece como pré-filtro de candidatos e é a única fonte da confirmação das
condições próprias do elemento. A classificação de visibilidade da linha depende
desse contrato, declarado por construção (o `collectScript` só emite linhas que
passaram em `visible()`), e não por verificação redundante dentro do núcleo.

---

## 7. Conclusão do diagnóstico

Os dois problemas determinados pela auditoria foram corrigidos: o tratamento de
`exceptionDetails` é agora uniforme na travessia, e a coleta principal utiliza
exclusivamente o mecanismo rigoroso do núcleo compartilhado — não resta nenhuma
travessia independente de ancestrais no coletor.

Um terceiro defeito, não previsto na especificação, foi descoberto e corrigido
porque bloqueava a integração exigida; ele está documentado na seção 4 com a
medição que o comprova.

A aprovação da R2.5.6 permanece com a auditoria independente.
