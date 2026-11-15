# Diagnóstico C.4-V05-B-R2.5.5

**Mecanismo rigoroso de visibilidade e integridade da travessia**

| Campo | Valor |
|---|---|
| Versão de trabalho | `C.4-V05-B-R2.5.5` |
| Branch | `feat/app-navigation-redesign` |
| Commit-base | `6bbffe70baf112983c5bed009ec0c4bcce04494e` |
| Núcleo de origem | `evidencias-r2-5-4/c4-v05-b-r2-5-4-core.cjs` (1.148 linhas) |
| Núcleo da R2.5.5 | `evidencias-r2-5-5/c4-v05-b-r2-5-5-core.cjs` |
| Data de execução | 2026-11-15 |
| Ambiente | Chromium 156.0.8078.79 headless (Termux/Android), CDP na porta 9222 |
| Alteração em produção | **Nenhuma** |

---

## 1. Objetivo

Separar duas perguntas que o mecanismo da R2.5.4 tratava como uma só:

1. **A árvore de ancestrais foi percorrida completamente?**
2. **Já existe evidência suficiente para concluir que o elemento não está visível?**

As duas não são equivalentes. Encontrar `display:none` permite concluir `hidden`, mas
não permite afirmar que a travessia chegou à raiz. O mesmo vale para opacidade
acumulada zero: permite concluir `not-visible`, ainda que uma leitura posterior
falhe. Evidência de ocultação não é evidência de completude da travessia.

---

## 2. Diagnóstico do estado herdado (R2.5.4)

Os quatro problemas estruturais abaixo foram confirmados por inspeção do código
publicado da R2.5.4 (`evidencias-r2-5-4/c4-v05-b-r2-5-4-core.cjs`).

### D-01 — `display:none` interrompe a travessia, mas registra `completed`

Trecho original (`c4-v05-b-r2-5-4-core.cjs`, linhas 912–919):

```javascript
if (styleVal.display === 'none') {
  // display:none é absoluto: oculta o elemento e todos os descendentes,
  // independentemente de sobrescrita de visibility ou opacidade acima.
  ancestorDisplayNoneAcc = true;
  ancestorHiddenAcc = true; // mantido para compatibilidade de campo de saída
  ancestorVisibility = 'completed';
  break;
}
```

**Causa-raiz.** O estado da travessia e o estado da evidência de ocultação eram
gravados no mesmo campo, com semânticas incompatíveis. Um único campo não
consegue representar simultaneamente "a árvore foi percorrida até a raiz" e
"a travessia foi interrompida por evidência absoluta".

**Comportamento anterior.** Um ancestral com `display:none` produzia
`ancestorVisibility: 'completed'`, afirmando completude de travessia sem que a
raiz tivesse sido examinada.

**Comportamento corrigido.** `ancestorVisibility: 'short-circuited'`. A conclusão
de visibilidade (`hidden`) é preservada por via separada, e a completude da
travessia passa a ser declarada honestamente.

### D-02 — O limite de profundidade pode sobrescrever um estado terminal legítimo

Trecho original (linhas 966–972):

```javascript
if (visitedCount >= 50 && currentObjId) {
  ancestorVisibility = 'depth-limit';
  ancestorFailureReason = 'limite de profundidade (50) atingido na travessia de ancestrais';
}
if (ancestorTraversalError && ancestorVisibility === 'completed') {
  ancestorVisibility = 'partial';
}
```

**Causa-raiz.** O motivo de término era inferido depois do laço, a partir de um
contador, e não no ponto em que a travessia terminava. Essa verificação posterior
era genérica e aplicava-se a qualquer término.

**Comportamento anterior.** Um `display:none` encontrado exatamente no 50º nível
era sobrescrito por `depth-limit`, porque o contador atingia 50 e a checagem
posterior era executada com `currentObjId` ainda preenchido. O estado real
(interrupção por evidência absoluta) era perdido.

**Comportamento corrigido.** O limite é verificado antes da leitura do próximo nó,
dentro do laço, e cada término é atribuído no ponto em que ocorre. Nenhuma
condição posterior pode sobrescrever um estado terminal.

### D-03 — A travessia por `parentElement` não percorre a árvore composta

Trecho original (linhas 942–948):

```javascript
const parentInfo = await Runtime.callFunctionOn({
  objectId: currentObjId,
  functionDeclaration: (function() {
    return this.parentElement || null;
  }).toString(),
  returnByValue: false,
});
```

E, no mesmo bloco, a identificação da raiz (linhas 890–897):

```javascript
const cs = window.getComputedStyle(this);
return {
  display: cs.display,
  visibility: cs.visibility,
  opacity: cs.opacity,
  isRoot: this.parentElement === null,
};
```

**Causa-raiz.** `parentElement` não expressa a árvore composta. Elementos dentro
de um shadow root têm `parentElement` nulo quando são filhos diretos da shadow
root, e `assignedSlot` ignorado quando são distribuídos por slot. A marcação de
raiz por `parentElement === null` confundia a raiz do documento com qualquer
elemento desconectado.

**Comportamento anterior.** Um elemento dentro de shadow root era tratado como
filho da raiz (travessia encerrada precocemente ou declarada `completed` sem
percurso real). Um elemento desconectado podia ser considerado raiz. Elementos
distribuídos por slot eram percorridos pelo pai na árvore do shadow, e não pelo
slot que os distribui.

**Comportamento corrigido.** Precedência `assignedSlot` → `parentElement` →
`getRootNode().host`; raiz identificada por `this === document.documentElement`.
Elemento desconectado resulta em travessia incompleta.

### D-04 — `ancestorOpacity` não informa se representa a cadeia inteira

Trecho original (linhas 928–933):

```javascript
const ao = parseFloat(styleVal.opacity);
if (!isNaN(ao)) {
  ancestorOpacityAcc = ancestorOpacityAcc === null ? ao : ancestorOpacityAcc * ao;
} else if (ancestorOpacityAcc === null) {
  ancestorOpacityAcc = 1; // opacidade não especificada = 1 (totalmente opaco)
}
```

**Causa-raiz.** O campo carregava um único número, sem qualquer qualificador de
completude. Um valor acumulado sobre uma cadeia parcial era indistinguível de um
valor completo. Além disso, o tratamento do valor inválido não era uniforme: o
acúmulo ignorava valores inválidos, mas a ausência do primeiro valor era
convertida em `1`.

**Comportamento anterior.** `ancestorOpacity: 0.5` com a travessia interrompida
era indistinguível de `ancestorOpacity: 0.5` com a cadeia inteira percorrida.

**Comportamento corrigido.** Campo `ancestorOpacityStatus` acrescentado, com os
estados `complete`, `partial`, `conclusive-zero`, `short-circuited`,
`unavailable`, `invalid` e `error`. Validação estrita: um valor não numérico, não
finito ou fora de `[0,1]` nunca é convertido em `1`.

---

## 3. Achado adicional — a detecção de ciclo da R2.5.4 era inoperante

Este achado não constava da especificação e foi descoberto durante a
implementação.

**Fato observado.** O `objectId` devolvido pelo CDP **não é estável**: cada
`Runtime.callFunctionOn` produz um remote object novo para o mesmo elemento.
Medição direta (Chromium 156.0.8078.79):

```
resolveNode 2x sobre o mesmo nodeId  -> objectId igual? false
parentElement obtido 2x              -> objectId igual? false
```

**Consequência.** O conjunto `visited` da R2.5.4, indexado por `objectId`, nunca
poderia conter o mesmo nó duas vezes. O estado `cycle` era, portanto,
inalcançável: um ciclo real seria percorrido até o limite de profundidade e
reportado como `depth-limit`.

**Correção.** A identidade usada para detecção de ciclo passa a ser o `nodeId`,
obtido por `DOM.requestNode` e comprovadamente estável para o mesmo elemento
(medição: `nodeId igual? true` em chamadas sucessivas). O `objectId` continua
sendo o meio de percorrer a árvore, conforme a especificação.

**Teste que comprova.** V18, com um ciclo real construído por redefinição de
`parentElement` na própria instância.

---

## 4. Decisões de semântica exigidas pela especificação

### 4.1 `unavailable` × `partial` para falha de leitura de estilo

A tabela de estados da especificação define:

- `partial` — "A travessia foi iniciada, mas não chegou à raiz por ausência ou falha de leitura."
- `unavailable` — "Não foi possível iniciar a travessia ou resolver o nó."

A falha de leitura de estilo no meio da travessia é, literalmente, "falha de
leitura" em uma travessia já iniciada: o estado é `partial`. `unavailable` fica
reservado à falha de resolução do nó (`DOM.resolveNode` sem `objectId`).

**Impacto sobre a herança.** A R2.5.4 usava `unavailable` para a falha de leitura
de estilo (teste R6). O teste R6 verifica `ancestorVisibility !== 'completed'`,
que continua satisfeito por `partial`. Nenhuma expectativa histórica foi
alterada; apenas a granularidade do estado foi refinada conforme a tabela da
especificação.

### 4.2 Semântica legada de `ancestorOpacity`

Conforme a especificação, documentada explicitamente e **não alterada**: o valor
`ancestorOpacity` inclui a opacidade do próprio elemento examinado, além dos
níveis superiores, porque a travessia começa no elemento e sobe. O estado
correspondente é `ancestorOpacityStatus`.

Quando nenhum valor confiável foi obtido, `ancestorOpacity` é `null` — nunca `1`.

### 4.3 Ordem de precedência de `ancestorOpacityStatus`

Resolvida ao final da travessia, com a precedência abaixo. Um produto zero é
conclusivo e não pode ser alterado por valores posteriores; a exceção vem em
seguida, porque uma exceção posterior não apaga evidência já obtida.

| # | Condição | Estado |
|---|---|---|
| 1 | produto acumulado chegou a zero | `conclusive-zero` |
| 2 | exceção interrompeu a travessia | `error` |
| 3 | algum valor de opacidade foi inválido | `invalid` |
| 4 | travessia interrompida por `display:none` | `short-circuited` |
| 5 | nenhum valor de opacidade foi lido | `unavailable` |
| 6 | raiz real examinada | `complete` |
| 7 | qualquer outro término | `partial` |

### 4.4 Limite do que o mecanismo declara

O mecanismo declara **visibilidade baseada nas propriedades CSS examinadas,
opacidade acumulada, ancestralidade percorrida e geometria já coletada pelo
harness**. Ele **não** afirma que o elemento está dentro da viewport, que não está
coberto por outro elemento, nem que não está recortado por `clip-path` ou
`overflow`. Essa delimitação é registrada no relatório final.

---

## 5. Limitações identificadas durante a execução

### L-01 — Distribuição real por slot não observável neste ambiente

**Fato observado.** O Chromium 156.0.8078.79 (build Termux/Android) não computa a
tabela de slots do shadow root. Em todas as variantes testadas — slot nomeado,
slot padrão, elemento direto ou aninhado, construção por `createElement` ou por
`innerHTML`, antes e depois de um flush de layout — `element.assignedSlot` é
`null` e `slot.assignedNodes()` retorna lista vazia, inclusive no caso canônico
(slot padrão com um único filho).

**Consequência.** A distribuição real de um elemento por `<slot>` não pôde ser
observada neste ambiente. O teste V32 foi registrado como **BLOCKED**, com causa
específica, e nunca como PASS.

**Como a regra implementada foi comprovada.** O teste V32b verifica a
**precedência** `assignedSlot` → `parentElement` → host por meio de um
`assignedSlot` definido na própria instância do elemento — a mesma técnica usada
para construir o ciclo real do teste V18. Com `assignedSlot` presente, o produto
acumulado é `0.5` (a opacidade do slot); por `parentElement` seria `1`. O
resultado `0.5` prova que a precedência foi respeitada.

**O que permanece não verificado.** Que o navegador distribua de fato um
elemento por slot, e que a opacidade de um slot com `display: contents` seja
aplicada à renderização do conteúdo distribuído.

### L-02 — Exceção do lado do navegador não é injetada como falha de teste

Os testes de exceção real (V20, V21, V22, V23) provocam a exceção no lado do
cliente CDP: a chamada `Runtime.callFunctionOn` lança e a exceção percorre o
`catch` do núcleo. O mecanismo também detecta exceções do lado do
navegador, via `exceptionDetails` na resposta do CDP — caminho implementado e
documentado, mas sem teste dedicado, porque exigiria injetar uma falha no motor
de execução de JavaScript do Chromium.

### L-03 — Traversal paralelo no harness

O harness `c4-v05-b-r2-5-5.cjs` contém uma segunda travessia de ancestrais,
executada dentro do script de página injetado (linhas 421–441), que produz os
campos `ancestorOpacity` e `ancestorHidden` da tabela de acentos. Essa travessia usa
apenas `parentElement` e não faz parte do mecanismo de visibilidade. Ela não foi
alterada nesta etapa: está fora do escopo do mecanismo e sua alteração exigiria
intervir no script de página do harness, não no núcleo compartilhado. A
divergência está registrada como item de auditoria.

### L-04 — Elemento com área de layout degenerada

Elementos `inline` sem conteúdo têm caixa degenerada. O mecanismo então responde
`unknown` — semântica **pré-existente** da R2.5.4, não alterada nesta etapa.
As fixtures novas usam `inline-block` com conteúdo e área real.

---

## 6. Conclusão do diagnóstico

Os quatro problemas estruturais especificados foram confirmados no
código publicado e corrigidos no núcleo compartilhado, sem reescrita de
`probeState()`, sem módulo de visibilidade paralelo e sem alteração de arquivo de
produção. Um quinto problema — a detecção de ciclo inoperante — foi descoberto e
corrigido.

A aprovação da R2.5.5 permanece com a auditoria independente.
