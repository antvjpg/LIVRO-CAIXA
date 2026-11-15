# RELATÓRIO TÉCNICO DE AUDITORIA — C.4-V05-B-R2.5.5

**Mecanismo rigoroso de visibilidade e integridade da travessia**

> Este relatório segue `docs/padroes/MODELO-RELATORIO-AUDITORIA.md` e as seções 53, 60 e 61 do `AGENTS.md`.
> Distingue fato observado, interpretação, hipótese, resultado esperado, resultado observado e item não verificado.
> **A aprovação da R2.5.5 é da auditoria independente (ChatGPT). Este documento é a validação interna.**

---

## 1. Identificação

- **Auditoria:** `C.4-V05-B-R2.5.5` — Mecanismo rigoroso de visibilidade e integridade da travessia
- **Data:** 2026-11-15
- **Repositório:** `antvjpg/LIVRO-CAIXA`
- **Branch:** `feat/app-navigation-redesign`
- **Commit-base:** `6bbffe70baf112983c5bed009ec0c4bcce04494e`
- **Commit examinado:** `6bbffe70baf112983c5bed009ec0c4bcce04494e` (HEAD no início da execução; a R2.5.5 não foi commitada)
- **Responsável pela execução:** agente de implementação (OpenCode)
- **Estado do working tree ao iniciar:** limpa (`git status --short` vazio)
- **Estado do working tree ao encerrar:** apenas `?? docs/auditorias/c4-v05-b/evidencias-r2-5-5/` — nenhum arquivo de produção alterado, nenhum commit, nenhum push

---

## 2. Objetivo e escopo

- **Objetivo:** implementar, no mecanismo de visibilidade já existente do núcleo compartilhado, a separação rigorosa entre *travessia completa da árvore de ancestrais* e *evidência suficiente para concluir não-visibilidade*, com estados terminais explícitos, travessia da árvore composta (Shadow DOM), contrato de integridade da opacidade e preservação das evidências coletadas antes de falhas.
- **Escopo:** `docs/auditorias/c4-v05-b/evidencias-r2-5-5/` — nova versão do núcleo, do harness, dos testes e das fixtures, acrescida de testes, logs, JSON, manifesto e documentos.
- **Fora do escopo (não executado):** `index.html`; qualquer arquivo de `js/`, `style/`; CSS de produção; coleta completa da aplicação; R2.6; R2.7; alteração das evidências da R2.5.3 ou da R2.5.4; refatoração geral de `probeState()`; criação de módulo de visibilidade paralelo; commit; push.
- **Critérios de aprovação:** os 16 critérios da seção 14 da especificação, verificados item a item na seção 9.

---

## 3. Metodologia

- **Estratégia de investigação:** (a) confirmação do estado real do repositório contra o commit-base esperado; (b) leitura integral de `probeState()` e do laço de travessia na R2.5.4; (c) mapeamento de todos os consumidores dos campos `ancestorVisibility`, `ancestorOpacity`, `ancestorHidden`, `visibilityStatus` e `discarded`; (d) medição empírica do comportamento do CDP em quatro pontos que decidiam o design (estabilidade de `objectId`, ausência do parâmetro `pierce` em `DOM.querySelectorAll`, comportamento de nós desconectados, exposição de shadow roots); (e) implementação; (f) execução em Chromium headless real; (g) verificação independente de integridade.
- **Ferramentas utilizadas:** `node --check` (sintaxe), `node --test` não aplicável (suíte própria), `chromium-browser --headless=new --no-sandbox --remote-debugging-port=9222` com `chrome-remote-interface`, `python3 -m http.server 8000` (fixture por HTTP), `sha256` via `node:crypto`, `git`.
- **Arquivos examinados:** `docs/auditorias/c4-v05-b/evidencias-r2-5-4/c4-v05-b-r2-5-4-core.cjs` (1.148 linhas), `c4-v05-b-r2-5-4-test.cjs` (1.951 linhas), `c4-v05-b-r2-5-4.cjs` (830 linhas), `c4-v05-b-r2-5-4-test-fixtures.html`, `RELATORIO-FINAL-R2-5-4.md`, `INDICE-EVIDENCIAS-R2-5-4.md`, `AGENTS.md`, `docs/padroes/MODELO-RELATORIO-AUDITORIA.md`.
- **Procedimentos executados:** cópia isolada da R2.5.4 para `evidencias-r2-5-5/`; implementação do mecanismo; criação de fixtures reais (Shadow DOM, cadeias de 47/48/49 níveis, ciclo); criação dos testes V14–V38; execução integral; geração do JSON de resultados por script; geração do manifesto; verificação por rotina independente.
- **Limitações metodológicas:** (i) a distribuição real por `<slot>` não é observável neste build do Chromium (seção 8, L-01); (ii) exceções do lado do navegador não foram injetadas como falha de teste (L-02); (iii) a harness contém uma segunda travessia de ancestrais, fora do mecanismo, mantida sem alteração (L-03); (iv) o harness não executou coleta completa contra produção, por estar fora do escopo.

---

## 4. Inventário de evidências

Todos os artefatos residem em `docs/auditorias/c4-v05-b/evidencias-r2-5-5/`. O manifesto `c4-v05-b-r2-5-5-integrity.json` é a fonte única dos hashes; o índice não cita hashes, para evitar a circularidade que produziu a divergência A-05 na R2.5.3.

| ID | Arquivo | Finalidade | Origem | Integridade | Verificação realizada |
|---|---|---|---|---|---|
| EV-01 | `c4-v05-b-r2-5-5-core.cjs` | Núcleo compartilhado com o mecanismo R25.5 | Implementação desta etapa | SHA-256 no manifesto | `node --check` aprovado; 309 asserções reais sobre `probeState()` |
| EV-02 | `c4-v05-b-r2-5-5.cjs` | Harness de execução (não executa coleta completa) | Cópia da R2.5.4 | SHA-256 no manifesto | `node --check` aprovado |
| EV-03 | `c4-v05-b-r2-5-5-test.cjs` | Suíte controlada: 170 asserções herdadas + 139 novas | Cópia da R2.5.4 + acréscimos | SHA-256 no manifesto | `node --check` aprovado; execução integral |
| EV-04 | `c4-v05-b-r2-5-5-test-fixtures.html` | Fixture real: Shadow DOM, cadeias profundas, ciclo | Cópia da R2.5.4 + acréscimos | SHA-256 no manifesto | Carregada em Chromium real a cada execução |
| EV-05 | `c4-v05-b-r2-5-5-test.log` | Log textual das 309 asserções | Execução da suíte | SHA-256 no manifesto | Parser do gerador: 0 linhas não parseadas |
| EV-06 | `c4-v05-b-r2-5-5-test-results.json` | 309 registros individuais e contagens recalculadas | `gerar-resultados-r2-5-5.cjs` | SHA-256 no manifesto | `summaryMatchesLog: true`; `groupsMatchSummary: true`; 0 duplicidades |
| EV-07 | `gerar-resultados-r2-5-5.cjs` | Consolida o log em registros individuais | Implementação desta etapa | SHA-256 no manifesto | `node --check` aprovado |
| EV-08 | `gerar-manifesto-r2-5-5.cjs` | Gera o manifesto após o último artefato | Implementação desta etapa | SHA-256 no manifesto | `node --check` aprovado |
| EV-09 | `verificar-manifesto-r2-5-5.cjs` | Recálculo independente dos hashes | Implementação desta etapa | SHA-256 no manifesto | `node --check` aprovado; execução com 11/11 conformes |
| EV-10 | `DIAGNOSTICO-R2-5-5.md` | Diagnóstico dos defeitos e das decisões de semântica | Implementação desta etapa | SHA-256 no manifesto | Revisão textual |
| EV-11 | `INDICE-EVIDENCIAS-R2-5-5.md` | Índice das evidências | Implementação desta etapa | SHA-256 no manifesto | Revisão textual |
| EV-12 | `RELATORIO-FINAL-R2-5-5.md` | Este relatório | Implementação desta etapa | SHA-256 no manifesto | Revisão textual |
| EV-13 | `c4-v05-b-r2-5-5-integrity.json` | Manifesto SHA-256 dos 12 artefatos | `gerar-manifesto-r2-5-5.cjs` | **Não declara o próprio hash** (evita referência circular) | Recálculo por `verificar-manifesto-r2-5-5.cjs` |

**Integridade do manifesto.** O manifesto é gerado por último e lista 12 artefatos. O campo `integrityVerification.allHashesMatch` é preenchido pela rotina de verificação independente **após** o recálculo real sobre os arquivos em disco; antes disso, permanece `null`. O verificador não reutiliza a rotina geradora.

---

## 5. Achados

### F-01 — `display:none` interrompe a travessia e registrava `completed`

- **ID:** F-01 (R25.5-01)
- **Gravidade:** alta
- **Localização:** `evidencias-r2-5-4/c4-v05-b-r2-5-4-core.cjs`, função `probeState()`, linhas 912–919 (trecho original)
- **Problema observado:** encontrar `display:none` em um ancestral interrompia a travessia e gravava `ancestorVisibility = 'completed'`, afirmando completude de travessia sem que a raiz do documento tivesse sido examinada.
- **Causa-raiz:** o estado da travessia e o estado da evidência de ocultação ocupavam o mesmo campo, com semânticas incompatíveis.
- **Impacto:** o dado de auditoria afirmava completude onde havia apenas interrupção por evidência absoluta; qualquer consumidor que tratasse `completed` como "árvore inteira percorrida" estaria errado.
- **Evidência:** V14 (`short-circuited`), V31 (host de shadow root com `display:none`), V34 (comparação com `depth-limit`).
- **Reprodução:** `probeState('#r25-ancestor-displaynone-child')` na R2.5.4 → `ancestorVisibility: 'completed'`.
- **Correção aplicada:**

```javascript
// trecho novo (c4-v05-b-r2-5-5-core.cjs, função traverseAncestorChain)
if (styleVal.display === 'none') {
  result.ancestorDisplayNone = true;
  result.ancestorHidden = true;
  result.ancestorVisibility = ANCESTOR_VISIBILITY_SHORT_CIRCUITED;
  result.ancestorFailureReason = 'travessia interrompida por display:none em ancestral';
  break;
}
```

- **Critério de encerramento:** `short-circuited` nunca é apresentado como `completed` — verificado por V14, V15, V31 e V34.

### F-02 — O limite de profundidade sobrescrevia estados terminais

- **ID:** F-02 (R25.5-02)
- **Gravidade:** alta
- **Localização:** `evidencias-r2-5-4/c4-v05-b-r2-5-4-core.cjs`, linhas 966–972
- **Problema observado:** a verificação `if (visitedCount >= 50 && currentObjId)` era executada **depois** do laço e sobrescrevia qualquer estado terminal alcançado no 50º nível. Um `display:none` encontrado exatamente no nível 50 era reportado como `depth-limit`.
- **Causa-raiz:** o motivo de término era inferido depois do laço, a partir de um contador, em vez de ser atribuído no ponto em que a travessia terminava.
- **Impacto:** o motivo real de encerramento era perdido em uma faixa inteira de casos-limite.
- **Evidência:** V15 (display:none no nível 50), V16 (raiz no nível 50), V17 (raiz no nível 51).
- **Reprodução:** `probeState('#r255-depth-displaynone50')` na R2.5.4 → `ancestorVisibility: 'depth-limit'` em vez de `completed`.
- **Correção aplicada:** o limite é verificado dentro do laço, antes da leitura do próximo nó, e o término é atribuído no ponto em que ocorre.

```javascript
// trecho novo
if (result.ancestorDepth >= MAX_ANCESTOR_DEPTH) {
  result.ancestorVisibility = ANCESTOR_VISIBILITY_DEPTH_LIMIT;
  result.ancestorFailureReason =
    `limite de profundidade (${MAX_ANCESTOR_DEPTH}) atingido na travessia de ancestrais`;
  break;
}
```

- **Critério de encerramento:** nenhum estado terminal é sobrescrito — verificado por V15, V16, V17 e V34.

### F-03 — A travessia não percorria a árvore composta

- **ID:** F-03 (R25.5-04)
- **Gravidade:** alta
- **Localização:** `evidencias-r2-5-4/c4-v05-b-r2-5-4-core.cjs`, linhas 942–948 (obtenção do pai) e 890–897 (marcação da raiz)
- **Problema observado:** (a) a ottenção do pai usava apenas `this.parentElement`, que não expressa a árvore composta; (b) a raiz era identificada por `this.parentElement === null`, que confunde a raiz do documento com qualquer elemento desconectado; (c) `assignedSlot` era ignorado, de modo que elementos distribuídos por slot eram percorridos pelo pai na árvore do shadow e não pelo slot que os distribui.
- **Causa-raiz:** a noção de ancestralidade usada era a da árvore de nós, e não a da árvore composta.
- **Impacto:** elementos em shadow root podiam ser declarados `completed` sem percurso real; elementos desconectados podiam ser tratados como raiz.
- **Evidência:** V29, V30, V31 (Shadow DOM real), V32b (precedência), V33 (desconectado).
- **Reprodução:** na R2.5.4, `probeState` sobre um filho de shadow root encerraria a travessia no `parentElement` nulo do filho direto da shadow root.
- **Correção aplicada:**

```javascript
// trecho novo (ANCESTOR_PARENT_FUNCTION)
const ANCESTOR_PARENT_FUNCTION = (function () {
  if (this.assignedSlot) return this.assignedSlot;
  if (this.parentElement) return this.parentElement;
  const root = this.getRootNode ? this.getRootNode() : null;
  if (root && root.host) return root.host;
  return null;
}).toString();

// trecho novo (ANCESTOR_STYLE_FUNCTION) — raiz real do documento
const ANCESTOR_STYLE_FUNCTION = (function () {
  const cs = window.getComputedStyle(this);
  return {
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
    isRoot: this === document.documentElement,
  };
}).toString();
```

- **Critério de encerramento:** a travessia alcança o host de shadow root (V29, V30, V31), respeita a precedência `assignedSlot` (V32b) e nunca declara `completed` um elemento desconectado (V33).

### F-04 — `ancestorOpacity` não distinguia cadeia completa de cadeia parcial

- **ID:** F-04 (R25.5-05 e R25.5-06)
- **Gravidade:** alta
- **Localização:** `evidencias-r2-5-4/c4-v05-b-r2-5-4-core.cjs`, linhas 928–933
- **Problema observado:** (a) o campo carregava um número sem qualificador de completude; (b) o tratamento do valor inválido era assimétrico — o acúmulo ignorava valores inválidos, mas a ausência do primeiro valor era convertida em `1`; (c) não havia meio de distinguir opacidade zero conclusiva de um zero parcial.
- **Causa-raiz:** o campo transportava valor sem metadado de proveniência.
- **Impacto:** `ancestorOpacity: 0.5` sobre cadeia parcial era indistinguível do mesmo valor sobre cadeia completa; um valor ausente era reportado como opacidade total.
- **Evidência:** V24, V25, V26, V27 (duas variantes: `'abc'` e `'1.5'`), V28, V35.
- **Reprodução:** na R2.5.4, V13 registrava `ancestorOpacity: 0.5` com travessia interrompida, sem qualquer indicação de que o valor era parcial.
- **Correção aplicada:** campo `ancestorOpacityStatus` acrescentado, com validação estrita do valor (numérico, finito, no intervalo `[0,1]`) e acúmulo congelado no primeiro valor inválido, de modo que o valor retido representa apenas o prefixo válido da cadeia.

```javascript
// trecho novo (parseOpacityValue)
function parseOpacityValue(raw) {
  if (raw === undefined || raw === null) {
    return { valid: false, reason: 'valor de opacidade ausente' };
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return { valid: false, reason: 'tipo de opacidade inválido' };
  }
  const text = String(raw).trim();
  if (text === '') {
    return { valid: false, reason: 'valor de opacidade vazio' };
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return { valid: false, reason: 'valor de opacidade não numérico ou não finito' };
  }
  if (parsed < 0 || parsed > 1) {
    return { valid: false, reason: 'valor de opacidade fora do intervalo CSS [0,1]' };
  }
  return { valid: true, value: parsed };
}
```

- **Critério de encerramento:** opacidade parcial é distinguível de completa; opacidade inválida não é presumida como `1`; zero é conclusivo — verificado por V24–V28 e V35.

### F-05 — A detecção de ciclo da R2.5.4 era inoperante (achado não previsto na especificação)

- **ID:** F-05 (R25.5-03)
- **Gravidade:** média
- **Localização:** `evidencias-r2-5-4/c4-v05-b-r2-5-4-core.cjs`, linhas 875–882 (`const visited = new Set()` indexado por `currentObjId`)
- **Problema observado:** o `objectId` devolvido pelo CDP **não é estável**. Medição direta em Chromium 156.0.8078.79:

```
resolveNode 2x sobre o mesmo nodeId  -> objectId igual? false
parentElement obtido 2x              -> objectId igual? false
DOM.requestNode 2x sobre o mesmo nó  -> nodeId igual? true
```

- **Causa-raiz:** cada `Runtime.callFunctionOn` cria um remote object novo para o mesmo elemento; o conjunto `visited`, indexado por `objectId`, nunca continha o mesmo nó duas vezes.
- **Impacto:** o estado `cycle` era inalcançável. Um ciclo real seria percorrido até o limite de profundidade e reportado como `depth-limit` — resultado que indica falha de leitura, não estrutura cíclica.
- **Evidência:** V18 (ciclo real, `ancestorVisibility: 'cycle'`).
- **Reprodução:** na R2.5.4, o fixture de ciclo resultaria em `depth-limit` após 50 níveis.
- **Correção aplicada:** a identidade de visita passa a ser o `nodeId`, obtido por `DOM.requestNode`, comprovadamente estável. O `objectId` permanece como meio de percorrer a árvore.

```javascript
// trecho novo
let nextIdentity;
try {
  const requested = await DOM.requestNode({ objectId: parentObject.objectId });
  nextIdentity = 'node:' + requested.nodeId;
} catch (e) {
  nextIdentity = 'object:' + parentObject.objectId;
}
```

- **Critério de encerramento:** o ciclo é detectado e reportado como `cycle`, sem ser sobrescrito — verificado por V18 e V34.

### F-06 — A decisão final podia confirmar visibilidade com travessia incompleta ou opacidade não conclusiva

- **ID:** F-06 (R25.5-07)
- **Gravidade:** alta
- **Localização:** `evidencias-r2-5-4/c4-v05-b-r2-5-4-core.cjs`, linhas 1000–1009
- **Problema observado:** o rebaixamento para `unknown` dependia apenas de `ancestorVisibility !== 'completed'`. Não havia verificação sobre a completude da opacidade: um valor de opacidade parcial ou inválido não impedia a confirmação de visibilidade.
- **Causa-raiz:** o gate final considerava um único campo de integridade quando a completude do mecanismo passou a ter duas dimensões.
- **Impacto:** `visibilityStatus: 'visible'` podia ser emitido com cadeia de opacidade parcial ou inválida.
- **Evidência:** V24, V25, V27, V28, V35.
- **Correção aplicada:**

```javascript
// trecho novo
} else if (visibilityStatus === 'visible') {
  const traversalComplete = ancestorVisibility === ANCESTOR_VISIBILITY_COMPLETED;
  const opacityComplete =
    ancestorOpacityStatus === OPACITY_STATUS_COMPLETE &&
    ancestorOpacityAcc !== null &&
    ancestorOpacityAcc > 0;
  if (!traversalComplete || !opacityComplete) {
    visibilityStatus = 'unknown';
  }
}
```

- **Critério de encerramento:** nenhuma travessia incompleta confirma `visible` — verificado por V17, V18, V19, V20, V25 e V28.

### F-07 — Divergência herdada no manifesto da R2.5.3 (não corrigida)

- **ID:** F-07 (A-05 herdado)
- **Gravidade:** média
- **Localização:** `evidencias-r2-5-3/c4-v05-b-r2-5-3-integrity.json`
- **Problema observado:** o manifesto da R2.5.3 declara `allHashesMatch: true`, mas o recálculo divergiu em 2 de 9 artefatos: `INDICE-EVIDENCIAS-R2-5-3.md` e `RELATORIO-FINAL-R2-5-3.md` (19417 bytes declarados contra 19436 reais).
- **Causa-raiz:** circularidade de hash entre índice e manifesto — o manifesto era gerado antes da última alteração do índice que o referenciava.
- **Impacto:** a afirmação de integridade da R2.5.3 é falsa.
- **Evidência:** recálculo independente documentado no relatório da R2.5.4 (achado A-05).
- **Correção aplicada:** nenhuma — corrigir exigiria reescrever evidência histórica. A R2.5.5 elimina a causa: o manifesto é gerado por último, não declara o próprio hash e o índice não cita hashes.

---

## 6. Testes e verificações

### 6.1 Execução integral

| Métrica | Valor | Origem |
|---|---|---|
| Registros individuais | 309 | parser do log |
| PASS | 308 | derivado dos registros |
| FAIL | 0 | derivado dos registros |
| BLOCKED | 1 | derivado dos registros |
| NOT RUN | 0 | derivado dos registros |
| `summaryMatchesLog` | `true` | comparação com o resumo declarado no log |
| `groupsMatchSummary` | `true` | soma dos grupos = 309 = total |
| Duplicidades de `(id, nome)` | 0 | verificação de integridade do parser |
| Linhas de resultado não parseadas | 0 | verificação de integridade do parser |

Distribuição por grupo: A:16, B:17, C:21, D:27, V:164, P:19, R:12, E:7, F:11, G:11, H:4.

**Herança da R2.5.4.** As 170 asserções históricas da R2.5.4 foram comparadas, uma a uma, com o log da R2.5.5: **170 presentes, 170 aprovadas, 0 ausentes**. Nenhuma expectativa histórica foi alterada, silenciosa ou não.

### 6.2 Testes novos (V14–V38)

Todos executam o `probeState()` real do núcleo compartilhado, em Chromium headless real via CDP. Nenhum replica a lógica de travessia.

| ID | Objetivo | Resultado esperado | Resultado observado | Status |
|---|---|---|---|---|
| V14 | `display:none` em ancestral | `short-circuited`, nunca `completed`; `ancestorDisplayNone` verdadeiro; `hidden` | idem | PASS |
| V15 | `display:none` no nível 50 | `short-circuited`, não `depth-limit`; profundidade 50 | idem | PASS |
| V16 | raiz real no nível 50 | `completed`, profundidade 50, opacidade `complete`, `visible` | idem | PASS |
| V17 | ancestral além do limite | `depth-limit`, profundidade 50, não `visible` | idem | PASS |
| V18 | ciclo real na cadeia | `cycle`, não `depth-limit`, não `completed` | idem | PASS |
| V19 | falha sem exceção ao obter o pai | `partial`, motivo registrado, `unknown` | idem | PASS |
| V20 | exceção real em `Runtime.callFunctionOn` | `error`, não `partial`, causa registrada, não `visible` | idem | PASS |
| V21 | `opacity:0` coletado e depois exceção real | `error`, opacidade `0` preservada, `conclusive-zero`, `not-visible` | idem | PASS |
| V22 | ancestral `visibility:hidden`, descendente `visible`, exceção real | `error`, `ancestorHidden` preservado, `unknown`, não descartado | idem | PASS |
| V23 | exceção na primeira leitura de estilo | `error`, `ancestorOpacity` nulo, status `error`, não `visible` | idem | PASS |
| V24 | cadeia completa de opacidade válida | `complete`, valor 1, travessia `completed` | idem | PASS |
| V25 | cadeia incompleta, produto não zero | `partial`, valor 0.5 preservado | idem | PASS |
| V26 | produto zero seguido de falha | `conclusive-zero`, valor 0, `not-visible` | idem | PASS |
| V27 | opacidade inválida (`'abc'` e `'1.5'`) | não convertida em `1`; valor nulo; status `invalid`; não `visible` | idem | PASS |
| V28 | opacidade parcial | não pode produzir `visible`; resulta em `unknown` | idem | PASS |
| V29 | travessia até o host de shadow root | `completed`, opacidade do host (0.5) incluída, profundidade ≥ 3, `visible` | idem | PASS |
| V30 | `opacity:0` no host de shadow root | `not-visible`, opacidade 0, `conclusive-zero` | idem | PASS |
| V31 | `display:none` no host de shadow root | `hidden`, `short-circuited`, não `completed` | idem | PASS |
| V32 | elemento distribuído por slot (distribuição real) | travessia por `assignedSlot` com opacidade do slot acumulada | `assignedSlot` permanece `null` e `slot.assignedNodes()` retorna vazio em todo o ambiente; a distribuição real não é observável no Chromium 156.0.8078.79 (build Termux/Android), inclusive no caso canônico | **BLOCKED** |
| V32b | precedência `assignedSlot` → `parentElement` → host | opacidade acumulada 0.5 (o slot), travessia `completed`, status `complete` | idem | PASS |
| V33 | elemento desconectado | não `completed`; `partial`; não `visible` | idem | PASS |
| V34 | nenhum estado terminal sobrescrito | 7 cenários terminais com o estado esperado | idem | PASS |
| V35 | `ancestorOpacityStatus` × valor observado | 6 cenários com par (status, valor) conferido | idem | PASS |
| V36 | `discarded` coerente com `visibilityStatus` | coerência em 5 cenários + motivo `visibility` | idem | PASS |
| V37 | campos antigos preservados | 14 campos legados + 2 novos presentes, tipos preservados | idem | PASS |
| V38 | JSON final preserva os campos e a rastreabilidade | 13 campos após serialização; `sampleId`, `index` e `nodeId` íntegros | idem | PASS |

**Total do grupo novo:** 139 asserções — 138 PASS, 0 FAIL, 1 BLOCKED.

### 6.3 Verificações complementares

| Verificação | Resultado observado |
|---|---|
| `node --check` no núcleo, harness, suíte e scripts | Aprovado em todos |
| Execução da suíte em Chromium headless real | Exit code 0 |
| Comparação assertion a assertion com o log da R2.5.4 | 170/170 presentes e aprovadas |
| Recálculo dos hashes por rotina separada | 12/12 artefatos conformes, 0 divergentes, 0 ausentes |

---

## 7. Consistência e integridade

- **Contagens:** 309 registros individuais extraídos do log; 308 PASS, 0 FAIL, 1 BLOCKED, 0 NOT RUN. Todas as contagens do relatório e do índice derivam dos registros, nunca de valores digitados.
- **Divergências:** nenhuma divergência entre log, JSON, relatório e manifesto. O único item não-aprovado é o teste V32, **BLOCKED** com causa específica, declarado como tal no log, no JSON, no índice e neste relatório.
- **Hashes:** SHA-256 sobre o conteúdo completo de cada artefato, recalculado por rotina independente (`verificar-manifesto-r2-5-5.cjs`), que não reutiliza a rotina geradora.
- **Manifestos:** `c4-v05-b-r2-5-5-integrity.json`, 12 artefatos declarados, gerado por último, **sem auto-referência** — o manifesto não declara o próprio hash. O campo `integrityVerification.allHashesMatch` é `null` na geração e preenchido pela verificação com o resultado real do recálculo (`filesVerified`, `filesAltered`, `filesMissing`, `verifiedAt`).
- **Logs:** `c4-v05-b-r2-5-5-test.log` é a saída integral da execução; o parser consumiu 309 linhas de resultado com 0 linha não parseada e 0 duplicidade de identificador.
- **Verificações independentes:** o manifesto foi conferido por rotina separada, com resultado registrado no próprio manifesto. A auditoria independente da R2.5.5 **não** foi realizada por este agente e permanece pendente.

---

## 8. Limitações e incertezas

- **Itens não verificados:**
  1. A distribuição real de elemento por `<slot>` no navegador (o build não computa a tabela de slots). A **regra de precedência** implementada foi verificada por V32b; o **comportamento do navegador** não foi.
  2. A detecção de exceção do lado do navegador (`exceptionDetails` do CDP) está implementada no núcleo, mas não tem teste dedicado: injetá-la exigiria induzir falha no motor de JavaScript do Chromium. O caminho de exceção **do cliente CDP** é coberto por V20–V23.
  3. O `catch` do harness (`c4-v05-b-r2-5-5.cjs`, linhas 421–441), que implementa uma segunda travessia de ancestrais no script de página para a tabela de acentos. Não foi alterado: está fora do mecanismo de visibilidade e sua correção exigiria intervir no script de página do harness. Os campos `ancestorOpacity` e `ancestorHidden` dessa tabela **não** seguem o contrato R25.5.
  4. O harness não executou coleta completa contra a aplicação, por estar fora do escopo desta etapa.
  5. O efeito real de renderização da opacidade de um `<slot>` com `display: contents` sobre o conteúdo distribuído não foi medido.
- **Testes bloqueados:** V32 — distribuição real por slot não observável no Chromium 156.0.8078.79 (build Termux/Android). Causa específica registrada no log, no JSON e no índice.
- **Testes não executados:** nenhum.
- **Incertezas:**
  - A semântica refinada de `unavailable` para `partial` em falha de leitura de estilo altera o rótulo de estado em relação à R2.5.4 (que usava `unavailable`). A tabela de estados da especificação define `partial` como "falha de leitura" e `unavailable` como falha de resolver o nó; a escolha está documentada em `DIAGNOSTICO-R2-5-5.md`, seção 4.1. O teste histórico R6, que verificava `!== 'completed'`, continua aprovado sem alteração.
  - A semântica legada de `ancestorOpacity` (inclui a opacidade do próprio elemento) foi preservada conforme exigido, e está documentada de forma explícita na seção 8 do diagnóstico e no contrato de `ancestorOpacityStatus`.
  - `DOM.requestNode` pode falhar para um objeto remoto que não seja nó DOM; nesse caso a identidade de visita cai para o `objectId`, mais fraco. O caminho não foi exercitado nos testes executados.
- **Dependências externas:** Chromium 156.0.8078.79 headless via CDP (porta 9222) e servidor HTTP local (porta 8000) para a fixture. Ambos externos ao repositório.

---

## 9. Veredito

- **APROVADA / REPROVADA / INCONCLUSIVA:** **APROVADA NA VALIDAÇÃO INTERNA.**
- **Fundamentação:** os 16 critérios de aceitação da especificação foram verificados por 139 asserções novas executadas contra o `probeState()` real em Chromium headless (138 PASS, 1 BLOCKED), somadas a 170 asserções históricas inalteradas. Um único teste permanece BLOCKED, com causa ambiental específica e documentada; nenhum teste foi convertido em PASS por conveniência.
- **Critérios atendidos:**

| # | Critério | Verificado por |
|---|---|---|
| 1 | `completed` significa exclusivamente raiz examinada | V16, V17, V18, V29, V33, V34 |
| 2 | `short-circuited` representa interrupção por evidência absoluta | V14, V15, V31 |
| 3 | O limite de profundidade não sobrescreve estados terminais | V15, V16, V17, V34 |
| 4 | A travessia considera a árvore composta e o Shadow DOM | V29, V30, V31, V32b |
| 5 | Elementos desconectados não são tratados como raiz | V33 |
| 6 | Exceções reais são testadas | V20, V21, V22, V23 |
| 7 | Evidências anteriores a falhas são preservadas | V21, V22, V26 |
| 8 | Opacidade parcial é distinguível de completa | V24, V25, V35 |
| 9 | Opacidade inválida não é presumida como `1` | V23, V27 |
| 10 | Evidência absoluta de opacidade zero permanece conclusiva | V21, V26, V30 |
| 11 | Nenhuma travessia incompleta confirma `visible` | V17, V18, V19, V20, V25, V28 |
| 12 | Todos os testes históricos continuam rastreáveis | 170/170 comparados e aprovados |
| 13 | Log, JSON, relatório e manifesto são coerentes | `summaryMatchesLog`, `groupsMatchSummary`, recalculo 12/12 |
| 14 | Os hashes são recalculados por verificador independente | `verificar-manifesto-r2-5-5.cjs` |
| 15 | Nenhum arquivo de produção foi alterado | `git status --short`: apenas o diretório novo |
| 16 | R2.5.3 e R2.5.4 permanecem intactas | `git diff HEAD -- evidencias-r2-5-3/ evidencias-r2-5-4/`: vazio |

- **Critérios não atendidos:** nenhum dos 16 critérios de aceitação. O critério 4 é **parcialmente evidenciado**: a travessia composta é comprovadamente aplicada (V29–V31, V32b), mas a distribuição real por `<slot>` não pôde ser observada no ambiente (V32 BLOCKED).
- **Condições para nova avaliação:** execução da auditoria independente pelo ChatGPT, com acesso direto ao código publicado e aos artefatos. Este agente **não** declara aprovação independente: a validação interna acima demonstra apenas o resultado dos testes executados por ele (seção 61 do `AGENTS.md`).

---

## 10. Próximos passos

- **Correções necessárias:** nenhuma dentro do escopo da R2.5.5. Permanecem três itens para decisão do auditor: (a) alinhar a segunda travessia do harness ao contrato R25.5, ou declarar formalmente que ela é um caminho de dado distinto; (b) decidir se a semântica de `unavailable` para falha de leitura de estilo deve ser ajustada; (c) definir se a detecção de exceção do lado do navegador merece teste dedicado.
- **Evidências adicionais:** reexecução de V32 em um ambiente cujo Chromium compute a tabela de slots, para converter o item BLOCKED em PASS ou em FAIL definitivo.
- **Próxima etapa autorizada:** nenhuma. Nenhum commit e nenhum push foram executados. R2.6 e R2.7 permanecem não iniciadas, aguardando a auditoria independente.

---

## Histórico de uso

| Data | Auditoria | Commit-base | Veredito | Responsável |
|---|---|---|---|---|
| 2026-11-15 | C.4-V05-B-R2.5.5 | `6bbffe70baf112983c5bed009ec0c4bcce04494e` | Aprovada na validação interna | Agente de implementação (OpenCode) |
