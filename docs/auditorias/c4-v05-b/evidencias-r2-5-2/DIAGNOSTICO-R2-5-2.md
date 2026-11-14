# DIAGNÓSTICO R2.5.2 — Problemas remanescentes da R2.5.1

Data: 2026-11-14  
Base auditada: `docs/auditorias/c4-v05-b/evidencias-r2-5-1/`  
Commit-base: `44458926e80949d52b1644f445df995de7a17b49`  
Branch: `feat/app-navigation-redesign`

---

## 1. Contexto

A R2.5.1 foi commitada em `4445892` com correções de ancestrais, tabindex e sintaxe. Os testes individuais executados via `node c4-v05-b-r2-5-1-test.cjs` passaram (87 PASS, 0 FAIL). No entanto, os artefatos de evidência (log, JSON, manifesto) apresentam divergências internas, e o diagnóstico independente da R2.5.1 identificou problemas que precisam ser corrigidos na R2.5.2.

---

## 2. Tabela de divergências encontradas

| # | Artefato | Campo | Valor declarado | Valor real / evidência | Tipo |
|---|----------|-------|-----------------|------------------------|------|
| 1 | `c4-v05-b-r2-5-1-test.log` | Resumo | `PASS: 84 FAIL: 2` | E1 e E2 reportam `tabindex` = `null` (fixture da época não tinha atributos) | Contagem |
| 2 | `c4-v05-b-r2-5-1-test-results.json` | `summary` | `total: 84, passed: 84, failed: 0` | Estados individuais contêm 6 FAILs (D5b, E1, E2, E4, E5, F8) | Contagem |
| 3 | `c4-v05-b-r2-5-1-test-results.json` | `summary` | `total: 84` | Array `tests` contém 85 entradas individuais | Contagem |
| 4 | `c4-v05-b-r2-5-1-test-results.json` | Grupo E | `passed: 5, failed: 2` | E1, E2, E4, E5 reportados como FAIL nos estados individuais (4 FAILs) | Contagem |
| 5 | `c4-v05-b-r2-5-1-test-results.json` | Grupo D | `passed: 11, failed: 0` | D5b reportado como FAIL nos estados individuais | Contagem |
| 6 | `c4-v05-b-r2-5-1-test-results.json` | Grupo F | `passed: 9, failed: 0` | F8 reportado como FAIL nos estados individuais | Contagem |
| 7 | `c4-v05-b-r2-5-1-test-results.json` | `integrityVerification.allHashesMatch` | `true` | Não há mecanismo de verificação independente; hash calculado pelo próprio harness | Integridade |
| 8 | `c4-v05-b-r2-5-1-integrity.json` | `baseCommit` | `8ac6434309d25ac241ebf65bc6ac8f753a4199d0` | O commit atual da R2.5.1 é `44458926...` (base do commit R2.5, não da R2.5.1) | Rastreabilidade |
| 9 | `c4-v05-b-r2-5-1-integrity.json` | `testSummary.failed` | `0` | O log relata 2 FAILs; os estados individuais do JSON relatam 6 FAILs | Contagem |
| 10 | `c4-v05-b-r2-5-1-test.cjs` | A7 | Usa `new Set()` local | Não utiliza `createSampleIdRegistry()` real do núcleo | Teste artificial |
| 11 | `c4-v05-b-r2-5-1-test.cjs` | B4 | Constrói `{status: 'cdp-error'}` manualmente | Não provoca falha CDP real | Teste artificial |
| 12 | `c4-v05-b-r2-5-1-core.cjs` | Ancestrais | `ancestorOpacityAcc = 1`, `ancestorHiddenAcc = false`, exceções ignoradas | Falha silenciosa não distinguível de ancestral visível | Confiabilidade |
| 13 | `c4-v05-b-r2-5-1-core.cjs` | Ancestrais | Não verifica `visibility: hidden` nem `visibility: collapse` | Ancestrais com essas propriedades não afetam a classificação | Classificação de visibilidade |
| 14 | `c4-v05-b-r2-5-1-core.cjs` | `geometryStatus` | Pode ser `'available'` quando `rectFromBorder()` retorna `null` (geometria degenerada) | Contrato ambíguo entre box model disponível e geometria utilizável | Contrato de geometria |
| 15 | `c4-v05-b-r2-5-1-test.cjs` | C4/C5 | Injeções de falha não cobrem falha antes da aplicação, após aplicação, durante obtenção de estilo, durante remoção | Cobertura incompleta de cenários de falha de pseudoestado | Teste incompleto |
| 16 | `c4-v05-b-r2-5-1-test-fixtures.html` | Ancestrais | Não contém ancestral com `visibility: hidden` nem `visibility: collapse` | Não é possível testar essas propriedades | Fixture incompleta |
| 17 | `INDICE-EVIDENCIAS.md` | Índice | Termina em R2.4 | Não contém entradas R2.5, R2.5.1 | Documentação |

---

## 3. Análise de cada divergência

### 3.1 Contagem de testes (log vs JSON vs estados individuais)

O `test.log` reporta 84 PASS e 2 FAIL (E1, E2 — tabindex não lido). Esse log foi gerado em uma execução anterior, quando o fixture ainda não tinha `tabindex="0"`/`tabindex="-1"`.

O `test-results.json` declara `summary: {total: 84, passed: 84, failed: 0}`, mas seus próprios estados individuais contêm 6 FAILs:
- D5b: `geometryStatus !== 'available'` (espelhado)
- E1: `tabindex='0'` → null
- E2: `tabindex='-1'` → null
- E4: `role='button'` → null
- E5: `aria-label` → null
- F8: `rectFromBorder` com dados não-degenerados retorna objeto, não null

A soma dos estados individuais (79 PASS + 6 FAIL = 85) não bate com o summary (84). Além disso, o array `tests` tem 85 entradas, não 84.

### 3.2 A7 — Registro artificial de sampleId

O teste A7 usa `const ids = new Set();` e `makeSampleId()` diretamente, sem invocar `createSampleIdRegistry()`. Não comprova:
- que o mecanismo real de registro detecta duplicidade;
- que `probeState()` integra o registro;
- o comportamento diante de duplicidade.

### 3.3 B4 — Erro CDP fabricado

O teste B4 constrói manualmente `{status: 'cdp-error', ...}` sem chamar qualquer função real do núcleo nem provocar falha CDP. Não comprova que `resolveNodeIdResult()` ou `probeState()` tratam erro CDP real.

### 3.4 C4/C5 — Falhas de pseudoestado incompletas

C4 injeta falha em `CSS.getComputedStyleForNode` mas apenas verifica `cleanupStatus === 'success'`. Não testa:
- falha antes da aplicação do pseudoestado;
- falha durante a obtenção de estilo;
- falha durante a remoção com verificação do estado real do `finally`.

C5 injeta falha na limpeza, mas o mock ainda chama `originalForcePseudoState.call(CSS, params)` para chamadas de aplicação, o que não testa isoladamente a falha de limpeza.

### 3.5 Ancestrais — falha silenciosa

No `core.cjs`, o bloco de travessia de ancestrais (linhas ~831-885) inicializa:
- `ancestorOpacityAcc = 1`
- `ancestorHiddenAcc = false`
- envolve tudo em `try/catch` que ignora exceções

Uma falha na leitura de ancestral não é distinguível de um ancestral visível. Isso pode produzir falsa confirmação de visibilidade.

Além disso, a travessia não verifica `visibility: hidden` nem `visibility: collapse` nos ancestrais.

### 3.6 Contrato de geometria

`geometryStatus` é definido como `'available'` quando `DOM.getBoxModel` retorna dados (mesmo que `rectFromBorder()` retorne `null` por geometria degenerada). Isso confunde "box model recebido" com "geometria utilizável".

### 3.7 Fixture incompleta

O fixture não contém:
- ancestral com `visibility: hidden`
- ancestral com `visibility: collapse`
- cenário de falha de resolução de nó
- cenário de falha na obtenção do elemento pai
- limite de profundidade na travessia
- duas ocorrências do mesmo seletor com ancestrais diferentes

### 3.8 Integridade criptográfica

O manifesto `integrity.json` registra `allHashesMatch: true` mas não há verificação independente. O `baseCommit` aponta para o commit R2.5 (não R2.5.1). Os tamanhos e hashes registrados no manifesto não correspondem aos arquivos atuais (foram atualizados após o commit `4445892`).

---

## 4. Hashes e tamanhos atuais (base para R2.5.2)

| Arquivo | Linhas | Tamanho (bytes) | SHA-256 |
|---------|--------|-----------------|---------|
| `c4-v05-b-r2-5-1-core.cjs` | 1030 | 35448 | `8e2db9f5d00f872ba3ba07fe759bf64c039eb60d448b209eeef721cc782e3903` |
| `c4-v05-b-r2-5-1.cjs` | 827 | 33256 | `f6603c98a6894d904ee9a02a2ae84dd2998f384197121be53964a0f9bbb32a60` |
| `c4-v05-b-r2-5-1-test.cjs` | 1006 | 31624 | `c85370ff0474c68b0b21806fdb1152c8e39e1aec987cdda9745a27692e899ab3` |
| `c4-v05-b-r2-5-1-test-fixtures.html` | 437 | 11203 | `83e6e417a5a887ffb65a22e03d9bc29720f412bf0bb1c8b8417506005a0c1661` |
| `c4-v05-b-r2-5-1-test.log` | 105 | 5313 | `331bde6cc1a44d59fc1d182b35dbb414c78f4f14153de2f9f9a1111cfa1e919e` |
| `c4-v05-b-r2-5-1-test-results.json` | 188 | 14082 | `dd7466fd803d24751c27fab6510176cf043895b24c9aa7d1470ac4b1eb93ab12` |
| `c4-v05-b-r2-5-1-integrity.json` | 78 | 2611 | `4200b31d155b1953afe27a7f2ba759157b5d6e9eb899c2a27d97882e1fa459b6` |
| `CORRECOES_APLICADAS_E_RESSALVAS-R2-5-1.md` | 166 | 7782 | `f989186193a89e09fe7484eab4e31a19ab2f06e70e889fe0a0521d382af689db` |

> **Nota:** Os hashes do manifesto `integrity.json` não correspondem aos arquivos atuais (foram registrados antes do commit `4445892` que alterou `core.cjs`, `test.cjs` e `fixtures.html`).

---

## 5. Testes artificiais ou incompletos identificados

| ID | Teste | Problema | Por que é artificial/incompleto |
|----|-------|----------|----------------------------------|
| A7 | `50 chamadas sucessivas geram 50 sampleIds únicos` | Usa `new Set()` local | Não testa `createSampleIdRegistry()` real, nem detecção de duplicidade, nem integração com `probeState()` |
| B4 | `erro CDP resulta em cdp-error` | Constrói objeto manualmente | Não chama função real do núcleo, não provoca falha CDP |
| C4 | `limpeza tentada após falha de computed style` | Só verifica `cleanupStatus` | Não testa falha antes da aplicação, nem durante obtenção de estilo |
| C5 | `cleanupStatus é failed quando limpeza falha` | Mock não isola limpeza | Não testa falha durante remoção com verificação de `finally` |

---

## 6. Correções válidas da R2.5.1 a preservar

| ID | Correção | Arquivo |
|----|----------|---------|
| R25-01 | `sampleId` incorpora `screen` efetivamente | `core.cjs` |
| R25-02 | Contrato de cardinalidade key→nodeId (0/1/>1/erro) | `core.cjs` |
| R25-03 | `try/finally` real com `cleanupStatus` explícito | `core.cjs` |
| R25-04 | Travessia de ancestrais via `DOM.resolveNode` + `Runtime.callFunctionOn` | `core.cjs` |
| R25-05 | Validação numérica explícita de `opacity` (sem `|| 1`) | `core.cjs` |
| R25-06 | Classificação de erros CDP sem falsos positivos textuais | `core.cjs` |
| R25-07 | `makeCDPErrorRecord` preserva `sampleId` e `nodeId` | `core.cjs` |
| R25-08 | Caminhos relativos | `c4-v05-b-r2-5-1.cjs` |
| R25-09 | Limpeza de mutações DOM em `finally` | `c4-v05-b-r2-5-1.cjs` |
| R25-10 | Nenhum fallback a branco presumido | `core.cjs` (`measure()`) |

---

## 7. Plano de correção para R2.5.2

| Tarefa | Objetivo | Arquivos afetados |
|--------|----------|-------------------|
| T2 | Visibilidade ancestral: distinguir sucesso/falha, verificar `visibility:hidden`/`collapse`, preservar identidade por `nodeId` | `c4-v05-b-r2-5-2-core.cjs` |
| T3 | Contrato de geometria: separar box model recebido de geometria utilizável | `c4-v05-b-r2-5-2-core.cjs` |
| T4 | Substituir testes artificiais (A7, B4, C4, C5) | `c4-v05-b-r2-5-2-test.cjs` |
| T5 | Consistência de resultados (log, JSON, manifesto, índice, relatório) | Todos os artefatos de `evidencias-r2-5-2/` |
| T6 | Integridade criptográfica com verificação independente | `c4-v05-b-r2-5-2-integrity.json` |
| T7 | Execução controlada e validação sintática | Todos |
| T8 | Revisão final e relatório no formato obrigatório | `DIAGNOSTICO-R2-5-2.md` + relatório final |

**Não serão iniciadas R2.6 nem R2.7. Nenhum arquivo de produção será alterado.**

---

## 8. Decisão

O diagnóstico está concluído. As divergências são reais e não podem ser simplesmente sobrescritas. Avançar para a Tarefa 2 (visibilidade ancestral).
