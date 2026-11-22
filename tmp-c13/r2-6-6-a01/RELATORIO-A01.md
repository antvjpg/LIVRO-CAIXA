# A-01 — Proveniência explícita da origem USER no C.4

## 1. Diagnóstico técnico inicial

Fluxo mapeado antes de qualquer alteração:

1. `inject.js:8` e `sw.js:5` executam `chrome.scripting.insertCSS({ origin: 'USER', css: '#r266-user-important { color: rgb(200,10,20) !important; }' })`. A API resolve e `inject.js:13` registra `r266-inject:ok`.
2. `CSS.getMatchedStylesForNode` devolve a regra injetada com `rule.origin = 'user-agent'`. A regra do autor aparece como `regular`, com `rgb(10,20,30)`.
3. O validador R2.6.6 copiava `rule.origin` diretamente em `regrasCandidatas()` e `winnerView()` também normalizava o vencedor para `user-agent`.
4. O núcleo R2.6.6 fazia o mesmo em `addProps()`: `origin: rule.origin || null`.
5. `originRank()` prioriza `user-agent !important` com rank 4 e `user !important` com rank 3. Assim, `R265-U1` passava usando o ramo UA, não o ramo USER.
6. `casos.json` codificava essa classificação incorreta ao esperar `origin: 'user-agent'` para o vencedor do caso USER.
7. O registro `injecao` continha a evidência da operação, mas não era passado para `core.getWinningRule()`; a proveniência não sobrevivia até a comparação.

Conclusão: o defeito não é a injeção nem a precedência numérica; é a ausência de proveniência explícita entre a operação USER e a regra candidata.

## 2. Arquivos alterados e justificativa individual

### Criados

- `docs/auditorias/c4-v05-b/evidencias-r2-6-6-a01/c4-v05-b-r2-6-6-a01-core.cjs` — núcleo versionado A-01. Aceita `options.provenance`, preserva `cdpOrigin` separado de `origin` e aplica a origem USER somente à regra cuja identidade coincide com a proveniência.
- `tmp-c13/r2-6-6-a01/casos.json` — casos derivados da R2.6.6; apenas `R265-U1` foi ajustado para exigir `origin: 'user'`, `cdpOrigin: 'user-agent'` e `provenance: 'user'`.
- `tmp-c13/r2-6-6-a01/validacao-a01.cjs` — validador de navegador A-01. Reaproveita a extensão e a fixture da R2.6.6, registra a evidência da operação, identifica a regra injetada e passa a proveniência ao núcleo.
- `tmp-c13/r2-6-6-a01/teste-comparador-a01.cjs` — Teste A, com comparador sintético usando os domínios CDP simulados e o núcleo A-01 real.
- `tmp-c13/r2-6-6-a01/resultados/` — evidências locais versionadas.
- `e2e/.artifacts/r2-6-a01-matriz.json` e `e2e/.artifacts/r2-6-a01-comparador.json` — artefatos gerados pelo runner.

### Alterados

- `e2e/scripts/run-c4-r26.cjs` — acrescenta etapa A-01 após a R2.6.6, sem alterar as etapas matriz original, R2.6.5, R2.6.6 ou regressão. Também publica os artefatos A-01 no resumo e no Step Summary.

### Não alterados

- Núcleos R2.5.6, R2.5.7, R2.6 e R2.6.6.
- Evidências históricas R2.6.5 e R2.6.6.
- Extensão e fixture R2.6.6 — reaproveitadas sem duplicação.
- CSS de produção, V32, A-02 e A-03.

## 3. Mecanismo de proveniência adotado

A proveniência USER não é inferida de `CSSRule.origin`. Ela é construída a partir de três evidências encadeadas:

1. **Operação**: `chrome.scripting.insertCSS` com `origin: 'USER'` e texto CSS lido de `inject.js`.
2. **Confirmação**: `document.title === 'r266-inject:ok'` e valor computado `rgb(200,10,20)` no alvo.
3. **Vinculação à regra**: o validador procura, entre as regras candidatas do CDP, apenas a regra com o mesmo seletor, propriedade, valor, `!important` e `cdpOrigin` observado. Um `identificadorRegra` determinístico é registrado; quando o CDP fornece `styleSheetId` ou `rule.id`, eles também são registrados.

O núcleo recebe `options.provenance` com `origin: 'user'`. A sobrescrita só é aplicada quando todos os campos de identidade conferem. As demais regras permanecem conservadoras: `regular` vira `author`, `user-agent` permanece `user-agent` e o metadado bruto é mantido em `cdpOrigin`.

A precedência não foi alterada: `user-agent !important` continua com rank 4, `user !important` com rank 3 e `author !important` com rank 1. O que mudou foi apenas a origem efetiva atribuída à regra provadamente injetada.

## 4. Trecho anterior e trecho corrigido

### Núcleo — captura da origem

Anterior:

```js
candidates.push({
  property: prop.name,
  value: prop.value || null,
  important: propImportant(prop),
  selectorText: selector || null,
  origin: meta.origin || null,
  styleSheetId: meta.styleSheetId || null,
  ...
});
```

Corrigido:

```js
const provenance = findProvenance(selector, prop, meta, options);
const cdpOrigin = meta.origin || null;
candidates.push({
  property: prop.name,
  value: prop.value || null,
  important: propImportant(prop),
  selectorText: selector || null,
  origin: provenance ? provenance.origin : cdpOrigin,
  cdpOrigin,
  provenance: provenance || null,
  styleSheetId: meta.styleSheetId || null,
  ...
});
```

### Validador — chamada ao núcleo

Anterior:

```js
const nucleo = await core.getWinningRule(nodeId, caso.propriedade, {
  selector: caso.alvo,
  pseudoElement: caso.pseudoElement || undefined,
});
```

Corrigido:

```js
const nucleo = await core.getWinningRule(nodeId, caso.propriedade, {
  selector: caso.alvo,
  pseudoElement: caso.pseudoElement || undefined,
  provenance: registro.proveniencia ? [registro.proveniencia] : [],
});
```

### Caso R265-U1

Anterior:

```json
"vencedor": {"origin": "user-agent", "declaredValue": "rgb(200, 10, 20)"}
```

Corrigido:

```json
"vencedor": {"origin": "user", "cdpOrigin": "user-agent", "provenance": "user", "declaredValue": "rgb(200, 10, 20)"}
```

## 5. Testes executados e resultados

| Teste | Escopo | Resultado |
|---|---|---|
| A — comparador sintético | 4 verificações: USER > AUTHOR; UA > USER; USER não classificado como UA; rastreabilidade dos candidatos | `4 PASS / 0 FAIL` |
| B — navegador real | Injeção USER real e proveniência recebida pelo núcleo | `11 PASS / 0 FAIL / 0 BLOCKED`; `provenienciaPASS=1`; `userBranchExercised=true` |
| C — regressão | Matriz original, R2.6.5, R2.6.6 e 393 registros históricos | Matriz `10/10`; R2.6.5 `10/13`; R2.6.6 `11/11`; regressão `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, `0 divergências` |
| Runner completo local | Todas as etapas, incluindo A-01 | `verdict: PASS`, `problems: []` |
| `node --check` | Runner, núcleo A-01, validador A-01 e teste sintético | Sintaxe válida |
| CI GitHub Actions | Não executado: sem commit/push nesta tarefa | `NOT RUN` |

Hashes:

- núcleo A-01: `e6b66c91316f18c9c23cafdc7e0c3eb28cbcec19076bbff7425bad4101cab774`
- comparador A-01: `c2e6e2396266d1071a6fcfa36719b6e93dc6dc3c8ec8d46b9ea33358d66d14c8`
- validador A-01: `208d7176d0cd66cc909c28a19df67e3ef204e4fa0cbf8185b25b9fd543e07127`
- matriz A-01: `c007ebab5715e093ac42005a87065bbe3821a5ac2f5a27f4de7d52ca59630259`
- comparador final: `bf499b7062181a3ff74bb47777f04a0c1c205ad6daf53484dc2332b23c817710`
- resumo do runner: `8ceed2fbc63bd4cc4a83202025509f20fb9f5a0a4ebb280e413806aaf4a49442`

## 6. Evidências da injeção USER real

- Operação: `chrome.scripting.insertCSS`
- Origem informada à API: `USER`
- CSS injetado: `#r266-user-important { color: rgb(200, 10, 20) !important; }`
- Confirmação: `r266-inject:ok`
- Valor computado após injeção: `rgb(200, 10, 20)`
- Metadado CDP da regra: `user-agent`
- Proveniência reconhecida pelo núcleo: `user`
- Identificador da regra: `ee0e738aab2fee63a1374e682ff60cbe58cb6aa3c21b8a9eea8e92d765ae7929`
- Chave de identidade: `#r266-user-important|color|rgb(200, 10, 20)|important|user-agent|sem-styleSheetId`
- Vencedor: `#r266-user-important`, `rgb(200,10,20)`, `important=true`, `origin=user`, `cdpOrigin=user-agent`, `provenance=user`
- Perdedores registrados: duas declarações `author` com `rgb(10,20,30)`
- Valor calculado pelo navegador: `rgb(200, 10, 20)`

## 7. Limitações encontradas

- O CDP não forneceu `styleSheetId` nem `rule.id` para a regra injetada pela extensão; por isso o identificador é uma chave determinística baseada em seletor, propriedade, valor, importância e origem CDP.
- `CSSRule.origin` continua reportando `user-agent` para a regra injetada. A correção não altera esse metadado; ela o registra separadamente em `cdpOrigin`.
- A prova de origem USER depende da confirmação da API de extensão e do efeito computado. Isso é intencional e evita inferência a partir de metadado ambíguo.
- CI GitHub Actions não foi executado nesta entrega porque commit/push não foram autorizados.
- A-02 e A-03 permanecem pendentes e não foram implementados.
- A R2.6.6 não está sendo declarada oficialmente promovida por esta correção.

## 8. Parecer final

**A-01: APROVADO COM RESSALVAS.**

Todos os critérios funcionais da correção foram atendidos localmente: injeção USER identificada como `user`, ramo `user` exercitado no comparador, `user !important` superior a `author !important`, `user-agent !important` superior a `user !important`, proveniência vinculada à regra correta e regressão preservada. A ressalva é exclusivamente a ausência de execução no CI GitHub Actions nesta entrega.
