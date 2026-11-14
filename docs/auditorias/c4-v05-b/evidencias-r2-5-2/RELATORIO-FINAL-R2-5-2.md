# RELATÓRIO FINAL — C.4-V05-B-R2.5.2

Correção da integridade de execução, visibilidade ancestral e consistência das evidências.

Data: 2026-11-14  
Branch: `feat/app-navigation-redesign`  
HEAD: `44458926e80949d52b1644f445df995de7a17b49`  
Diretório de evidências: `docs/auditorias/c4-v05-b/evidencias-r2-5-2/`

---

## A. Resumo executivo

### O que foi corrigido

1. **Visibilidade ancestral (R25-04)**: A travessia de ancestrais agora distingue entre leitura concluída, parcial, indisponível, erro, limite de profundidade e ciclo. Falhas na leitura de ancestral não produzem falsa confirmação de visibilidade (resultado é `unknown` quando o elemento próprio está visível mas a leitura de ancestral falhou). A travessia considera `display:none`, `visibility:hidden`, `visibility:collapse` e opacidade acumulada.

2. **Contrato de geometria (R25-05)**: Separado explicitamente "box model recebido" de "geometria utilizável". `geometryStatus` agora pode ser `available` (box model + retângulo válido), `unavailable` (box model sem retângulo utilizável) ou `error` (box model não obtido). Geometria degenerada (largura/altura zero) resulta em `geometryStatus: 'unavailable'` e `rect: null`.

3. **Testes artificiais substituídos**:
   - **A7**: Agora usa `createSampleIdRegistry()` real do núcleo, verifica unicidade e detecção de duplicidade.
   - **B4**: Provoca falha CDP real via injeção no `DOM.querySelectorAll`, não constrói objeto manualmente.
   - **C4/C5**: Cobertura completa de falha antes da aplicação, após aplicação, durante obtenção de estilo, durante remoção, e continuidade após falha isolada.

4. **Integridade da execução**: Log, JSON de resultados, manifesto e índice derivam da mesma execução. Contagens calculadas a partir dos estados individuais, não informadas manualmente.

5. **Consistência dos artefatos**: 114 testes individuais somam 114 no summary. Todos os artefatos apresentam resultados coerentes.

### O que permaneceu

- Todas as correções válidas da R2.5.1 (sampleId com screen, contrato de cardinalidade, try/finally com cleanupStatus, correção de opacity sem `|| 1`, classificação de erros CDP, caminhos relativos, limpeza DOM em finally, nenhum fallback a branco presumido).
- Nenhum arquivo de produção do aplicativo foi alterado.
- Nenhum commit nem push foi realizado (conforme regras da R2.5.2).

### Resultado geral

**114 PASS, 0 FAIL, 0 BLOCKED.** Todos os 14 critérios de aceitação da R2.5.2 estão atendidos.

---

## B. Diagnóstico

Para cada problema identificado na R2.5.1:

| # | Arquivo | Função/trecho | Causa-raiz | Consequência | Correção aplicada |
|---|---------|---------------|------------|--------------|-------------------|
| 1 | `core.cjs` | Travessia de ancestrais (linhas ~831-894) | `ancestorOpacityAcc = 1`, `ancestorHiddenAcc = false`, exceções ignoradas | Falha silenciosa não distinguível de ancestral visível; falsa confirmação de visibilidade | Contrato de leitura com `ancestorVisibility` (`completed`/`partial`/`unavailable`/`error`/`depth-limit`/`cycle`), `ancestorFailureReason`, `ancestorDepth`; falha não converte ausência em visibilidade confirmada |
| 2 | `core.cjs` | Travessia de ancestrais | Não verificava `visibility:hidden` nem `visibility:collapse` nos ancestrais | Ancestrais com essas propriedades não afetavam a classificação | Incluído `visibility` na leitura via `window.getComputedStyle`; `visibility:hidden` e `visibility:collapse` definem `ancestorHiddenAcc = true` |
| 3 | `core.cjs` | `probeState()` — identidade da ocorrência | Usava `document.querySelector(selector)` na versão anterior; R2.5.1 já usava `nodeId`, mas sem contrato de falha | Duas ocorrências do mesmo seletor podiam ser confundidas | Preservado uso individual de `nodeId` via `DOM.resolveNode` + `Runtime.callFunctionOn`; teste D12 comprova identidade individual |
| 4 | `core.cjs` | `geometryStatus` (linhas ~780-796) | `geometryStatus = 'available'` quando `DOM.getBoxModel` computado, mesmo que `rectFromBorder()` retorne `null` | Contrato ambíguo entre "box model recebido" e "geometria utilizável" | `geometryStatus` agora separa: `available` (rect !== null), `unavailable` (box model sem retângulo), `error` (box model não obtido) |
| 5 | `test.cjs` | A7 | Usava `new Set()` local | Não comprovava `createSampleIdRegistry()` real nem detecção de duplicidade | Substituído por teste que usa o registro real, verifica unicidade e provoca duplicidade |
| 6 | `test.cjs` | B4 | Construía `{status: 'cdp-error'}` manualmente | Não provocava falha CDP real | Substituído por injeção real de falha no `DOM.querySelectorAll` via `core.probeState()` |
| 7 | `test.cjs` | C4/C5 | Cobertura incompleta de cenários de falha de pseudoestado | Não testava falha antes da aplicação, durante obtenção de estilo, durante remoção | Adicionados C4b (falha na aplicação), C5d (injeção de falha de limpeza), C6 (continuidade após falha isolada) |
| 8 | `test-results.json` | `summary` | Contagens informadas manualmente, não derivadas dos estados individuais | Inconsistência entre summary e estados individuais | Contagens calculadas a partir do array `tests`; grupos corrigidos para bater com os itens individuais |
| 9 | `integrity.json` | `baseCommit` | Apontava para commit R2.5, não R2.5.1 | Rastreabilidade incorreta | Corrigido para `44458926...` (HEAD da R2.5.1) |
| 10 | `integrity.json` | `allHashesMatch` | Não havia verificação independente | Possível afirmação falsa de integridade | Verificação independente implementada; `allHashesMatch` confirmado por recálculo |
| 11 | `test-fixtures.html` | Fixture | Não continha ancestral `visibility:hidden`, `visibility:collapse`, duas ocorrências mesmo seletor | Não era possível testar essas propriedades | Adicionados elementos para todos os casos obrigatórios |

---

## C. Alterações

### C.1 — `c4-v05-b-r2-5-2-core.cjs` — Travessia de ancestrais

**Trecho anterior (R2.5.1):**
```javascript
let ancestorOpacityAcc = 1;
let ancestorHiddenAcc = false;
try {
  const resolved = await DOM.resolveNode({nodeId});
  if (resolved && resolved.object && resolved.object.objectId) {
    let currentObjId = resolved.object.objectId;
    const visited = new Set();
    let visitedCount = 0;
    while (currentObjId && visitedCount < 50) {
      if (visited.has(currentObjId)) break;
      visited.add(currentObjId);
      visitedCount++;
      const styleInfo = await Runtime.callFunctionOn({
        objectId: currentObjId,
        functionDeclaration: (function() {
          const cs = window.getComputedStyle(this);
          return {display: cs.display, opacity: cs.opacity};
        }).toString(),
        returnByValue: true,
      });
      const styleResult = styleInfo.result;
      if (!styleResult || !styleResult.value) break;
      const styleVal = styleResult.value;
      if (styleVal.display === 'none') {
        ancestorHiddenAcc = true;
        break;
      }
      const ao = parseFloat(styleVal.opacity);
      if (!isNaN(ao)) ancestorOpacityAcc *= ao;
      const parentInfo = await Runtime.callFunctionOn({
        objectId: currentObjId,
        functionDeclaration: (function() {
          return this.parentElement || null;
        }).toString(),
        returnByValue: false,
      });
      const parentObj = parentInfo.result;
      if (!parentObj || !parentObj.objectId) break;
      currentObjId = parentObj.objectId;
    }
  }
} catch (e) {
  // Não conseguir ler ancestrais não invalida a verificação do próprio elemento
}
```

**Trecho novo (R2.5.2):**
```javascript
let ancestorVisibility = 'completed';
let ancestorOpacityAcc = null;
let ancestorHiddenAcc = false;
let ancestorDepth = 0;
let ancestorFailureReason = null;
let ancestorTraversalError = false;
try {
  const resolved = await DOM.resolveNode({nodeId});
  if (resolved && resolved.object && resolved.object.objectId) {
    let currentObjId = resolved.object.objectId;
    const visited = new Set();
    let visitedCount = 0;
    while (currentObjId && visitedCount < 50) {
      if (visited.has(currentObjId)) {
        ancestorVisibility = 'cycle';
        ancestorFailureReason = 'ciclo detectado na travessia de ancestrais';
        break;
      }
      visited.add(currentObjId);
      visitedCount++;
      ancestorDepth = visitedCount;
      const styleInfo = await Runtime.callFunctionOn({
        objectId: currentObjId,
        functionDeclaration: (function() {
          const cs = window.getComputedStyle(this);
          return {display: cs.display, visibility: cs.visibility, opacity: cs.opacity, isRoot: this.parentElement === null};
        }).toString(),
        returnByValue: true,
      });
      const styleResult = styleInfo.result;
      if (!styleResult || !styleResult.value) {
        ancestorVisibility = 'unavailable';
        ancestorFailureReason = 'não foi possível ler estilo computado do ancestral';
        ancestorTraversalError = true;
        break;
      }
      const styleVal = styleResult.value;
      if (styleVal.isRoot) break;
      if (styleVal.display === 'none') { ancestorHiddenAcc = true; ancestorVisibility = 'completed'; break; }
      if (styleVal.visibility === 'hidden' || styleVal.visibility === 'collapse') { ancestorHiddenAcc = true; ancestorVisibility = 'completed'; break; }
      const ao = parseFloat(styleVal.opacity);
      if (!isNaN(ao)) { ancestorOpacityAcc = ancestorOpacityAcc === null ? ao : ancestorOpacityAcc * ao; }
      else if (ancestorOpacityAcc === null) { ancestorOpacityAcc = 1; }
      const parentInfo = await Runtime.callFunctionOn({
        objectId: currentObjId,
        functionDeclaration: (function() { return this.parentElement || null; }).toString(),
        returnByValue: false,
      });
      const parentObj = parentInfo.result;
      if (!parentObj || !parentObj.objectId) {
        if (ancestorVisibility === 'completed' && !ancestorHiddenAcc) {
          ancestorVisibility = 'partial';
          ancestorFailureReason = 'não foi possível obter o elemento pai para continuar a travessia';
        }
        break;
      }
      currentObjId = parentObj.objectId;
    }
    if (visitedCount >= 50 && currentObjId) {
      ancestorVisibility = 'depth-limit';
      ancestorFailureReason = 'limite de profundidade (50) atingido na travessia de ancestrais';
    }
    if (ancestorTraversalError && ancestorVisibility === 'completed') {
      ancestorVisibility = 'partial';
    }
  } else {
    ancestorVisibility = 'unavailable';
    ancestorFailureReason = 'não foi possível resolver o nó para travessia de ancestrais';
  }
} catch (e) {
  ancestorVisibility = 'error';
  ancestorFailureReason = e.message;
  ancestorOpacityAcc = null;
  ancestorHiddenAcc = false;
}
if (ancestorVisibility !== 'completed' && visibilityStatus === 'visible') {
  visibilityStatus = 'unknown';
} else if (ancestorVisibility === 'completed') {
  if (ancestorHiddenAcc) visibilityStatus = 'hidden';
  else if (ancestorOpacityAcc === 0) visibilityStatus = 'not-visible';
}
```

**Justificativa:** Distinguir sucesso de falha na leitura de ancestral; não presumir visibilidade quando a leitura falhou; incluir `visibility:hidden` e `visibility:collapse`; preservar identidade por `nodeId`.

**Dependências afetadas:** Nenhuma fora do núcleo.

---

### C.2 — `c4-v05-b-r2-5-2-core.cjs` — Contrato de geometria

**Trecho anterior:**
```javascript
let rect = null;
let geometryStatus = 'available';
if (boxModel) {
  const border = boxModel.border;
  if (border && border.length >= 8) {
    rect = rectFromBorder(border);
  } else {
    geometryStatus = border && border.length > 0 ? 'available' : 'unavailable';
  }
} else {
  geometryStatus = 'error';
}
```

**Trecho novo:**
```javascript
let rect = null;
let geometryStatus = 'unavailable';
if (boxModel) {
  const border = boxModel.border;
  if (border && border.length >= 8) {
    rect = rectFromBorder(border);
    if (rect !== null) {
      geometryStatus = 'available';
    } else {
      geometryStatus = 'unavailable';
    }
  } else {
    geometryStatus = 'unavailable';
  }
} else {
  geometryStatus = 'error';
}
```

**Justificativa:** `geometryStatus: 'available'` só quando há retângulo utilizável; `unavailable` quando box model recebido mas retângulo não utilizável; `error` quando box model não obtido.

**Dependências afetadas:** Testes D5, D5b, D5c atualizados para refletir o novo contrato.

---

### C.3 — `c4-v05-b-r2-5-2-core.cjs` — Campos de ocorrência

**Adicionados:** `ancestorVisibility`, `ancestorDepth`, `ancestorFailureReason` ao objeto de ocorrência empurrado em `occurrences.push()`.

**Justificativa:** Expor o contrato de leitura de ancestrais aos consumidores.

---

### C.4 — `c4-v05-b-r2-5-2-core.cjs` — Falha na aplicação de pseudoestado

**Trecho anterior:**
```javascript
if (state !== 'normal') {
  pseudoApplied = true;
  await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [state] });
}
```

**Trecho novo:**
```javascript
if (state !== 'normal') {
  pseudoApplied = true;
  try {
    await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [state] });
  } catch (e) {
    cdpErrors.push(makeCDPErrorRecord('CSS.forcePseudoState-apply', e.name, e.message, {
      sampleId, selector, state, index: i, nodeId,
    }));
  }
}
```

**Justificativa:** Falha na aplicação não escapa do `try/finally`; limpeza ainda roda em `finally`; teste C4b comprova.

---

### C.5 — `c4-v05-b-r2-5-2-test.cjs` — Testes substituídos e adicionados

| Teste | Alteração |
|-------|-----------|
| A7 | Agora usa `createSampleIdRegistry()` real; adicionados A7b (registro contém 50) e A7c (detecta duplicidade) |
| B4 | Substituído por injeção real de falha CDP; adicionados B4a, B4b, B4c |
| C4 | Adicionados C4b (amostra descartada), C4c (motivo), C4d (injeção efetiva), C4e (falha na aplicação) |
| C5 | Adicionado C5d (injeção de falha de limpeza efetiva) |
| C6 | Novo teste de continuidade após falha isolada (3 chamadas sequenciais) |
| D5 | Corrigido para `geometryStatus: 'unavailable'` e `rect: null` (novo contrato) |
| D9, D10 | Novos testes para `visibility:hidden` e `visibility:collapse` em ancestral |
| D11 | Novo teste: falha na leitura de ancestral resulta em `visibilityStatus: unknown` |
| D12 | Novo teste: duas ocorrências do mesmo seletor com ancestrais diferentes |

---

### C.6 — `c4-v05-b-r2-5-2-test-fixtures.html` — Novo fixture

Adicionados:
- Ancestral com `visibility:hidden` (`.r25-ancestor-visibilityhidden`)
- Ancestral com `visibility:collapse` (`.r25-ancestor-visibilitycollapse`)
- Duas ocorrências do mesmo seletor `.r25-same-selector` com ancestrais diferentes (um com `opacity:0`, outro com `opacity:1`)
- Elementos HTML correspondentes e registro no `window.__r25Fixtures.buttonIds`

---

### C.7 — Novos arquivos de evidência

- `c4-v05-b-r2-5-2-test.log` — Log textual dos 114 testes
- `c4-v05-b-r2-5-2-test-results.json` — JSON de resultados com estados individuais e summary consistente
- `c4-v05-b-r2-5-2-integrity.json` — Manifesto de integridade com SHA-256 de todos os artefatos
- `INDICE-EVIDENCIAS-R2-5-2.md` — Índice de evidências R2.5.2
- `DIAGNOSTICO-R2-5-2.md` — Diagnóstico técnico (criado antes das correções)

---

## D. Testes

| ID | Comportamento testado | Método | Resultado | Evidência |
|----|----------------------|--------|-----------|-----------|
| A7 | `createSampleIdRegistry()` real detecta 50 IDs únicos e rejeita duplicidade | Chamada real ao núcleo | PASS | `registry.size() === 50`; segundo `register` lança erro |
| B4 | Falha CDP real via injeção no `DOM.querySelectorAll` | `core.probeState()` com `DOM.querySelectorAll` injetado para falhar | PASS | `Array.isArray(occurrences) === true`; `occurrences.length === 0` |
| C4 | Falha de `getComputedStyleForNode` não impede limpeza em `finally` | Injeção de falha no método CDP | PASS | `cleanupStatus === 'success'`; `discarded === true` |
| C5 | Falha de limpeza invalida a amostra | Injeção de falha na remoção do pseudoestado | PASS | `cleanupStatus === 'failed'`; `discarded === true`; `reason === 'cleanup-failed'` |
| C6 | Continuidade após falha isolada | 3 chamadas sequenciais de `probeState` com falha na 2ª | PASS | 1ª e 3ª chamadas com `cleanupStatus === 'success'` |
| D6 | Ancestral `opacity:0` → `not-visible` | `probeState()` real em Chromium | PASS | `visibilityStatus === 'not-visible'`; `ancestorOpacity === 0` |
| D7 | Ancestral `display:none` → `hidden` | `probeState()` real em Chromium | PASS | `visibilityStatus === 'hidden'`; `ancestorHidden === true` |
| D9 | Ancestral `visibility:hidden` → `hidden` | `probeState()` real em Chromium | PASS | `visibilityStatus === 'hidden'`; `ancestorVisibility === 'completed'` |
| D10 | Ancestral `visibility:collapse` → `hidden` | `probeState()` real em Chromium | PASS | `visibilityStatus === 'hidden'`; `ancestorHidden === true` |
| D11 | Falha na leitura de ancestral → `unknown` | Injeção de falha na obtenção do elemento pai | PASS | `visibilityStatus === 'unknown'`; `ancestorVisibility !== 'completed'` |
| D12 | Duas ocorrências mesmo seletor, ancestrais diferentes | `probeState()` com seletor `.r25-same-selector` | PASS | Oculto → `not-visible`; visível → `visible`; nodeIds individuais |
| E1-E7 | Atributos DOM (tabindex, role, aria-label, disabled) | `core.probeState()` real em Chromium | PASS | Valores exatos lidos via `DOM.getAttributes` |
| F1-F9 | Validação geométrica (`rectFromBorder`) | Função pura do núcleo | PASS | 11 casos de borda cobertos |
| G1-G8 | Classificação de erros CDP | Funções puras do núcleo | PASS | 8 classificações validadas |
| H1-H2 | Visibilidade ancestral com Chromium real | `probeState()` real | PASS | `ancestorOpacity === 0`; `ancestorHidden === true` |

**Total: 114 testes, 114 PASS, 0 FAIL, 0 BLOCKED.**

---

## E. Consistência dos artefatos

| Artefato | Total | PASS | FAIL | BLOCKED | Fonte |
|----------|-------|------|------|---------|-------|
| `c4-v05-b-r2-5-2-test.log` | 114 | 114 | 0 | 0 | Contagem das linhas PASS/FAIL/BLOCKED no log |
| `c4-v05-b-r2-5-2-test-results.json` (summary) | 114 | 114 | 0 | 0 | Campo `summary` do JSON |
| `c4-v05-b-r2-5-2-test-results.json` (estados individuais) | 114 | 114 | 0 | 0 | Soma do array `tests` |
| `c4-v05-b-r2-5-2-integrity.json` (testSummary) | 114 | 114 | 0 | 0 | Campo `testSummary` do manifesto |

**Verificação:** 16 + 17 + 21 + 27 + 7 + 11 + 11 + 4 = 114. Todos os artefatos são coerentes.

---

## F. Integridade

| Arquivo | Tamanho (bytes) | SHA-256 declarado | SHA-256 recalculado | Comparação |
|---------|-----------------|-------------------|---------------------|------------|
| `c4-v05-b-r2-5-2-core.cjs` | 39902 | `6a2f2537...8bb` | `6a2f2537...8bb` | ✓ |
| `c4-v05-b-r2-5-2.cjs` | 33256 | `74e78597...259` | `74e78597...259` | ✓ |
| `c4-v05-b-r2-5-2-test.cjs` | 42437 | `21671d00...da66` | `21671d00...da66` | ✓ |
| `c4-v05-b-r2-5-2-test-fixtures.html` | 13719 | `7280582a...231` | `7280582a...231` | ✓ |
| `c4-v05-b-r2-5-2-test.log` | 7145 | `a97c66c4...6a` | `a97c66c4...6a` | ✓ |
| `c4-v05-b-r2-5-2-test-results.json` | 18233 | `777b7e3e...7b9` | `777b7e3e...7b9` | ✓ |
| `DIAGNOSTICO-R2-5-2.md` | 11222 | `1905bf87...e3` | `1905bf87...e3` | ✓ |

**Método:** Cada arquivo lido, SHA-256 calculado sobre o conteúdo completo, comparado com o valor registrado no manifesto `c4-v05-b-r2-5-2-integrity.json`. Verificação independente da rotina que gerou os hashes.

**Resultado:** `allHashesMatch: true`, 7 arquivos verificados, 0 ausentes, 0 alterados.

---

## G. Preservações

As seguintes correções da R2.5.1 foram mantidas na R2.5.2:

| ID | Correção | Arquivo |
|----|----------|---------|
| R25-01 | `sampleId` incorpora `screen` efetivamente | `core.cjs` |
| R25-02 | Contrato de cardinalidade key→nodeId (0/1/>1/erro) | `core.cjs` |
| R25-03 | `try/finally` real com `cleanupStatus` explícito | `core.cjs` |
| R25-04 | Visibilidade efetiva considerando ancestrais (expandida com contrato de falha) | `core.cjs` |
| R25-05 | Validação numérica explícita de `opacity` (sem `|| 1`) | `core.cjs` |
| R25-06 | Classificação de erros CDP sem falsos positivos textuais | `core.cjs` |
| R25-07 | `makeCDPErrorRecord` preserva `sampleId` e `nodeId` | `core.cjs` |
| R25-08 | Caminhos relativos | `c4-v05-b-r2-5-2.cjs` |
| R25-09 | Limpeza de mutações DOM em `finally` | `c4-v05-b-r2-5-2.cjs` |
| R25-10 | Nenhum fallback a branco presumido | `core.cjs` (`measure()`) |

---

## H. Limitações

- **DOM.describeNode** pode não retornar `attributes` para todos os elementos (depende da implementação do CDP). O código usa `DOM.getAttributes` como primário com fallback para `describeNode`.
- **Gradientes**: cores extraídas sem reconstrução completa de parâmetros (mesma limitação da R2.5.1).
- **Não há screenshots** nem validação em dispositivo físico.
- **Não implementar algoritmo completo da cascata CSS** (deferido para R2.6).
- **Não alterar metodologia WCAG** (deferido para R2.7).
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente e não relacionado à R2.5.2.
- Nenhuma falha obrigatória foi ocultada ou reclassificada.

---

## I. Estado do repositório

| Item | Valor |
|------|-------|
| Branch | `feat/app-navigation-redesign` |
| HEAD | `44458926e80949d52b1644f445df995de7a17b49` |
| Arquivos alterados | Nenhum (apenas arquivos novos em `evidencias-r2-5-2/`) |
| Arquivos novos | 7 (`c4-v05-b-r2-5-2-core.cjs`, `c4-v05-b-r2-5-2.cjs`, `c4-v05-b-r2-5-2-test.cjs`, `c4-v05-b-r2-5-2-test-fixtures.html`, `c4-v05-b-r2-5-2-test.log`, `c4-v05-b-r2-5-2-test-results.json`, `c4-v05-b-r2-5-2-integrity.json`, `INDICE-EVIDENCIAS-R2-5-2.md`) |
| Commit criado | **Não** (conforme regra da R2.5.2) |
| Push realizado | **Não** (conforme regra da R2.5.2) |
| Arquivos de produção alterados | **Nenhum** |
| CSS de produção alterado | **Não** |

---

**Conclusão:** A R2.5.2 atende todos os 14 critérios de aceitação. Está tecnicamente concluída e aguarda a auditoria independente do ChatGPT. Não avançar para R2.6 ou R2.7 sem aprovação.
