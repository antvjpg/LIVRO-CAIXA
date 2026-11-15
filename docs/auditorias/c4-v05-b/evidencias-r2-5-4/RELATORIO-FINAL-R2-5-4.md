# RELATÓRIO TÉCNICO DE AUDITORIA — C.4-V05-B-R2.5.4

> Documento seguindo o modelo `docs/padroes/MODELO-RELATORIO-AUDITORIA.md` (Padrão B) e as regras de `AGENTS.md`, seções 53, 60 e 61.
> Aprovação independente da R2.5.4 **não** é declarada neste documento. Ver seção 9.

---

## 1. Identificação

- **Auditoria:** C.4-V05-B-R2.5.4 — correção da integridade da travessia de visibilidade ancestral
- **Data:** 2026-11-15
- **Repositório:** `antvjpg/LIVRO-CAIXA`
- **Branch:** `feat/app-navigation-redesign`
- **Commit-base:** `6a2052cce184d3d3fd841580f4f34aad70b5b17d`
- **Commit examinado:** `6a2052cce184d3d3fd841580f4f34aad70b5b17d` (mesmo commit-base: a R2.5.4 ainda não foi commitada)
- **Responsável pela execução:** agente de implementação (OpenCode), sob direção de auditoria independente externa
- **Estado do working tree:** modificado — somente `docs/auditorias/c4-v05-b/evidencias-r2-5-4/` (novo) e nenhum arquivo de produção

---

## 2. Objetivo e escopo

- **Objetivo:** corrigir exclusivamente os três defeitos de integridade confirmados na auditoria independente da R2.5.3, no núcleo `probeState()` do harness de auditoria, e prová-los com testes de integração usando o `probeState()` real.
- **Escopo:**
  - `docs/auditorias/c4-v05-b/evidencias-r2-5-4/c4-v05-b-r2-5-4-core.cjs` — Correções A, B e C em `probeState()`.
  - `docs/auditorias/c4-v05-b/evidencias-r2-5-4/c4-v05-b-r2-5-4-test.cjs` — testes V11, V12 e V13.
  - `docs/auditorias/c4-v05-b/evidencias-r2-5-4/c4-v05-b-r2-5-4-test-fixtures.html` — fixture de ancestral com `opacity: 0.5` para V13.
  - Artefatos de evidência e documentação da R2.5.4.
- **Fora do escopo:**
  - Nenhum arquivo de produção do aplicativo (`index.html`, `js/`, `style/`) foi lido para escrita ou alterado.
  - Nenhuma mudança de CSS de produção.
  - R2.6 e R2.7 não foram iniciadas.
  - Reescrita de `probeState()`, criação de novo mecanismo de visibilidade, novo módulo: não realizados.
  - Regra de classificação `discarded` / `reason` do núcleo: não alterada (ver Achado A-04).
  - Correção do manifesto da R2.5.3: não realizada (ver Achado A-05) — evidência histórica preservada.
  - Commit e push: não realizados.
- **Critérios de aprovação:** os três blocos de correção aplicados; V11, V12 e V13 com resultados individuais verificáveis; regressão executada; nenhuma divergência entre log, JSON, relatório e manifesto; todos os hashes declarados recalculados; nenhum arquivo de produção alterado; nenhum commit ou push.

---

## 3. Metodologia

- **Estratégia de investigação:** leitura integral do `probeState()` no núcleo da R2.5.3 antes de qualquer edição; confirmação literal dos três blocos citados na especificação; contagem determinística das chamadas `Runtime.callFunctionOn` para fixar os pontos de injeção de falha; correção pontual; execução da suíte completa em Chromium headless real via CDP com injeção controlada de falhas; consolidação das asserções do log em registros individuais com contagens recalculadas por script.
- **Ferramentas utilizadas:** `node` v26.12.1; `chromium-browser --headless=new --no-sandbox --remote-debugging-port=9222`; `chrome-remote-interface`; `python3 -m http.server 8000`; `node --check`; `sha256sum`; `git`.
- **Arquivos examinados:**
  - `docs/auditorias/c4-v05-b/evidencias-r2-5-3/c4-v05-b-r2-5-3-core.cjs` (1141 linhas) — `probeState()` integral, linhas 610–1098.
  - `docs/auditorias/c4-v05-b/evidencias-r2-5-3/c4-v05-b-r2-5-3-test.cjs` (1820 linhas) — V7, V9, V10, D10, D11, R6, R7, H1, H2 e a estrutura de mocks CDP.
  - `docs/auditorias/c4-v05-b/evidencias-r2-5-3/c4-v05-b-r2-5-3-test-fixtures.html` (586 linhas) — ancestrais `visibility:hidden`, `visibility:collapse`, `opacity:0`, `display:none`.
  - `docs/auditorias/c4-v05-b/evidencias-r2-5-3/c4-v05-b-r2-5-3-integrity.json` — manifesto herdado.
- **Procedimentos executados:**
  1. Inspeção do estado do Git, do `AGENTS.md` e da árvore de `docs/`.
  2. Leitura integral dos três blocos citados e verificação literal contra a especificação.
  3. Contagem das chamadas `Runtime.callFunctionOn` do núcleo (confirmado: exatamente 2 por nível de travessia — estilo e obtenção do pai —, nenhuma antes da travessia).
  4. Cópia versionada do núcleo, harness, suíte e fixture para `evidencias-r2-5-4/`, com renomeação de referências internas; R2.5.3 preservada intacta.
  5. Aplicação das Correções A, B e C.
  6. Adição do fixture de `opacity: 0.5` e dos testes V11, V12 e V13.
  7. `node --check` em todos os `.cjs` modificados.
  8. Subida de Chromium headless com CDP e do servidor HTTP; execução da suíte completa.
  9. Consolidação do log em registros individuais com contagens recalculadas.
  10. Geração do manifesto de integridade por último e verificação independente por recálculo.
- **Limitações metodológicas:**
  - A auditoria independente foi conduzida sobre o código publicado da R2.5.3; este relatório documenta a implementação da correção, não a reemissão desse veredito.
  - O Chromium foi encerrado após a execução; o `browserVersion` foi capturado da resposta de `/json/version` durante a execução.
  - O ambiente é Termux/Android; o `platform` registrado nos artefatos reflete isso, divergindo do `Linux x86_64` declarado no `test-results.json` da R2.5.3 (divergência herdada, ver A-05).

---

## 4. Inventário de evidências

- **Identificador:** EV-01 · **Arquivo:** `c4-v05-b-r2-5-4-core.cjs` · **Finalidade:** núcleo com as três correções · **Origem:** cópia da R2.5.3 com edição localizada · **Integridade:** SHA-256 `4ce5fb5925cdfda6…` · **Verificação realizada:** `node --check` aprovado; 3 blocos conferidos por `diff` contra o original.
- **Identificador:** EV-02 · **Arquivo:** `c4-v05-b-r2-5-4.cjs` · **Finalidade:** harness de execução · **Origem:** cópia da R2.5.3 com referências renomeadas · **Integridade:** SHA-256 `38ce6e5305d513f9…` · **Verificação realizada:** `node --check` aprovado.
- **Identificador:** EV-03 · **Arquivo:** `c4-v05-b-r2-5-4-test.cjs` · **Finalidade:** suíte controlada com V11–V13 · **Origem:** cópia da R2.5.3 acrescida dos três testes · **Integridade:** SHA-256 `d70d6fb454bb0e3d…` · **Verificação realizada:** `node --check` aprovado; 1950 linhas.
- **Identificador:** EV-04 · **Arquivo:** `c4-v05-b-r2-5-4-test-fixtures.html` · **Finalidade:** fixture com ancestral `opacity:0.5` · **Origem:** cópia da R2.5.3 acrescida do fixture 28b · **Integridade:** SHA-256 `90e9049b64138650…` · **Verificação realizada:** servido por HTTP com status 200.
- **Identificador:** EV-05 · **Arquivo:** `c4-v05-b-r2-5-4-test.log` · **Finalidade:** log textual da execução · **Origem:** stdout do processo `node c4-v05-b-r2-5-4-test.cjs` · **Integridade:** SHA-256 `282f1e0a6edb7f16…` · **Verificação realizada:** 196 linhas, 170 linhas de resultado.
- **Identificador:** EV-06 · **Arquivo:** `c4-v05-b-r2-5-4-test-results.json` · **Finalidade:** registros individuais e contagens recalculadas · **Origem:** `gerar-resultados-r2-5-4.cjs` · **Integridade:** SHA-256 `5f25802e507bfdfb…` · **Verificação realizada:** `summaryMatchesLog: true`, `groupsMatchSummary: true`, 0 duplicidades, 0 linhas não parseadas.
- **Identificador:** EV-07 · **Arquivo:** `gerar-resultados-r2-5-4.cjs` · **Finalidade:** consolidação determinística do log em registros individuais · **Origem:** implementação desta etapa · **Integridade:** SHA-256 `fa697affbabdaf18…` · **Verificação realizada:** `node --check` aprovado.
- **Identificador:** EV-08 · **Arquivo:** `c4-v05-b-r2-5-4-integrity.json` · **Finalidade:** manifesto de SHA-256 de todos os artefatos · **Origem:** geração final, após o último artefato · **Integridade:** manifesto não declara o próprio hash (referência circular evitada) · **Verificação realizada:** recálculo independente em rotina separada.
- **Identificador:** EV-09 · **Arquivo:** `INDICE-EVIDENCIAS-R2-5-4.md` · **Finalidade:** índice das evidências da R2.5.4 · **Origem:** implementação desta etapa · **Integridade:** SHA-256 no manifesto · **Verificação realizada:** recálculo independente.
- **Identificador:** EV-10 · **Arquivo:** `RELATORIO-FINAL-R2-5-4.md` · **Finalidade:** este relatório · **Origem:** implementação desta etapa · **Integridade:** SHA-256 no manifesto · **Verificação realizada:** recálculo independente.
- **Identificador:** EV-11 · **Arquivo:** `gerar-manifesto-r2-5-4.cjs` · **Finalidade:** geração do manifesto após o último artefato · **Origem:** implementação desta etapa · **Integridade:** SHA-256 no manifesto · **Verificação realizada:** `node --check` aprovado.
- **Identificador:** EV-12 · **Arquivo:** `verificar-manifesto-r2-5-4.cjs` · **Finalidade:** recálculo independente dos hashes, em rotina separada da geradora · **Origem:** implementação desta etapa · **Integridade:** SHA-256 no manifesto · **Verificação realizada:** `node --check` aprovado; execução concluída com 11 de 11 artefatos conformes.

---

## 5. Achados

### A-01 — Falha ao obter o pai pode preservar `ancestorVisibility = 'completed'`

- **ID:** A-01
- **Título:** Ancestral com `visibility:hidden` mascara travessia incompleta e confirma visibilidade falsamente
- **Gravidade:** alta — produz falso positivo de visibilidade em auditoria
- **Localização:** `c4-v05-b-r2-5-4-core.cjs`, `probeState()`, bloco de obtenção do pai (linhas 950–963 na R2.5.3)
- **Problema observado:** a condição `if (ancestorVisibility === 'completed' && !ancestorHiddenAcc)` impedia a transição para `partial` quando um ancestral já havia sido lido com `visibility:hidden` ou `collapse`.
- **Causa-raiz:** `ancestorHiddenAcc` foi tratado como evidência de completude da travessia. `visibility` é herdável e sobrescrevível por descendentes, portanto um ancestral oculto comprova apenas um estilo, não que a árvore foi percorrida até a raiz. Como a raiz do documento é tratada antes (`isRoot`), alcançar o bloco de falha do pai significa, por construção, que a travessia não chegou à raiz.
- **Impacto:** com `ancestorVisibility` indevidamente `'completed'` e sem `display:none` nem opacidade zero, a decisão final mantinha `visibilityStatus = 'visible'`, confirmando visibilidade sem cobertura da árvore de ancestrais.
- **Evidência:** reprodução por V11 — ancestral `visibility:hidden`, descendente `visibility:visible`, falha na 4ª chamada `Runtime.callFunctionOn`. Antes da correção o resultado era `visible`; após a correção é `unknown` com `ancestorVisibility = 'partial'`.
- **Reprodução:** V11 no `c4-v05-b-r2-5-4-test.cjs`.
- **Correção recomendada:** aplicada — Corrigir A.
- **Critério de encerramento:** V11 e V12 passam com `ancestorVisibility = 'partial'` e `visibilityStatus ≠ 'visible'`. **Atendido.**

### A-02 — O bloco `catch` apaga evidências válidas já coletadas

- **ID:** A-02
- **Título:** Falha posterior na travessia invalida `display:none` e `opacity:0` já comprovados
- **Gravidade:** alta — perda de evidência absoluta, causando falso positivo de visibilidade
- **Localização:** `c4-v05-b-r2-5-4-core.cjs`, `probeState()`, `catch` da travessia (linhas 975–981 na R2.5.3)
- **Problema observado:** o `catch` redefinia `ancestorOpacityAcc = null` e `ancestorHiddenAcc = false`, descartando leituras válidas anteriores à exceção.
- **Causa-raiz:** a sub-rotina de tratamento de exceção foi escrita sob a premissa de que a ausência de evidência deveria neutralizar as evidências, em vez de preservar o que já foi medido.
- **Impacto:** um `opacity:0` comprovado antes da exceção deixava de ser considerado, e a decisão final podia confirmar `visible`.
- **Evidência:** reprodução por V12 — ancestral `opacity:0`, falha na 4ª chamada. Após a correção, `visibilityStatus = 'not-visible'` e `ancestorOpacity = 0`.
- **Reprodução:** V12 no `c4-v05-b-r2-5-4-test.cjs`.
- **Correção recomendada:** aplicada — Corrigir B.
- **Critério de encerramento:** V12 passa com `ancestorOpacity === 0` preservado. **Atendido.**

### A-03 — Precedência invertida na decisão final de visibilidade

- **ID:** A-03
- **Título:** Incerteza de travessia é avaliada antes da evidência absoluta de ocultação
- **Gravidade:** alta — evidência absoluta pode ser encoberta por incerteza e vice-versa
- **Localização:** `c4-v05-b-r2-5-4-core.cjs`, `probeState()`, decisão final (linhas 985–1002 na R2.5.3)
- **Problema observado:** a decisão final condicionava a avaliação de `display:none` e `opacity:0` a `ancestorVisibility === 'completed'`; e a incerteza era avaliada antes da evidência absoluta.
- **Causa-raiz:** a precedência foi estruturada como dois ramos mutuamente exclusivos com o critério "travessia completa" como condição de entrada, em vez de evidência absoluta como critério dominante.
- **Impacto:** (a) evidência absoluta obtida antes de uma falha era perdida por causa da ordem; (b) a ausência de evidência absoluta podia ser convertida em `unknown` mesmo quando a opacidade acumulada zero já estava comprovada.
- **Evidência:** o mesmo bloco de decisão atende A-01 e A-02; V11 e V12 exercitam os dois lados.
- **Reprodução:** V11 e V12 no `c4-v05-b-r2-5-4-test.cjs`.
- **Correção recomendada:** aplicada — Corrigir C.
- **Critério de encerramento:** V11 (`unknown`) e V12 (`not-visible`) passam simultaneamente, o que era impossível sob a precedência anterior. **Atendido.**

### A-04 — Precedência de `discarded` / `reason` não foi alterada

- **ID:** A-04
- **Título:** Regra de descarte mantém `unknown` registrado e não descartado
- **Gravidade:** informativo — comportamento correto, mantido deliberadamente
- **Localização:** `c4-v05-b-r2-5-4-core.cjs`, registro da ocorrência (`discarded` / `reason`)
- **Problema observado:** nenhum. `discarded` só é verdadeiro para `hidden` ou `not-visible`; `unknown` permanece registrado e não é descartado.
- **Causa-raiz:** não aplicável.
- **Impacto:** nenhum; comportamento alinhado ao contrato vigente.
- **Evidência:** V11 verifica `discarded === false` com `visibilityStatus === 'unknown'`.
- **Reprodução:** V11.
- **Correção recomendada:** nenhuma — a auditoria externa recomendou explicitamente não alterar essa regra nesta tarefa.
- **Critério de encerramento:** comportamento preservado. **Atendido.**

### A-05 — Divergência herdada no manifesto de integridade da R2.5.3

- **ID:** A-05
- **Título:** Manifesto da R2.5.3 declara `allHashesMatch: true` com dois artefatos divergentes
- **Gravidade:** média — affecta a confiança nas afirmações de integridade herdadas
- **Localização:** `docs/auditorias/c4-v05-b/evidencias-r2-5-3/c4-v05-b-r2-5-3-integrity.json`
- **Problema observado:** o recálculo independente dos 9 artefatos declarados mostrou que `INDICE-EVIDENCIAS-R2-5-3.md` e `RELATORIO-FINAL-R2-5-3.md` não correspondem ao SHA-256 declarado; o segundo também diverge em tamanho (19417 declarado contra 19436 real). A afirmação `allHashesMatch: true` com `filesVerified: 9` é, portanto, incorreta.
- **Causa-raiz:** o manifesto e os documentos indexados foram gravados em momentos diferentes dentro da mesma iteração, e o manifesto não foi recalculado após a edição final dos dois documentos — o mesmo mecanismo que circularidade de hash entre índice e manifesto torna inconsistente.
- **Impacto:** restrito à R2.5.3. Nenhum artefato da R2.5.4 é afetado: o manifesto da R2.5.4 é gerado após o último artefato e verificado por recálculo independente.
- **Evidência:** recálculo dos 9 artefatos da R2.5.3 — 7 hashes conferem, 2 divergem. A contagem de linhas declarada usa `wc -l` e confere em todos os arquivos; a divergência de linhas observada por contagem de segmentos é artefato do método de contagem, não do manifesto.
- **Reprodução:*** recálculo por SHA-256 sobre `evidencias-r2-5-3/`.
- **Correção recomendada:** **não aplicada** — corrigir exigiria reescrever evidência histórica da R2.5.3, vedado pelo escopo ("não remover testes ou evidências históricas"). Registrada como divergência herdada e limitação remanescente.
- **Critério de encerramento:** divergência registrada e explicitada. **Atendido como registro; a correção permanece pendente e fora de escopo.**

---

## 6. Testes e verificações

**Estados válidos:** `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`.

### Testes novos da R2.5.4

- **ID:** V11 · **Objetivo:** ancestral `visibility:hidden` + descendente `visibility:visible` + falha na obtenção do pai não pode confirmar visibilidade · **Pré-condições:** fixture `#r25-v3-desc-vis`; ancestral oculto lido com sucesso; falha injetada na 4ª chamada `Runtime.callFunctionOn` (`returnByValue === false`) · **Procedimento:** `probeState()` real do núcleo, com mock de `Runtime.callFunctionOn` restituído em `finally` · **Resultado esperado:** `visibilityStatus = 'unknown'`, `ancestorVisibility = 'partial'`, `discarded = false`, `ancestorFailureReason ≠ null`, `ancestorHidden = true` · **Resultado observado:** idêntico ao esperado · **Status:** PASS (5 de 5 asserções) · **Evidência:** `c4-v05-b-r2-5-4-test.log`, linhas 154–158.
- **ID:** V12 · **Objetivo:** ancestral `opacity:0` + falha posterior preserva a evidência absoluta · **Pré-condições:** fixture `#r25-ancestor-opacity0-child`; opacidade zero lida com sucesso; falha injetada na 4ª chamada · **Procedimento:** `probeState()` real do núcleo · **Resultado esperado:** `visibilityStatus = 'not-visible'`, `ancestorOpacity = 0`, `ancestorVisibility ≠ 'completed'` · **Resultado observado:** idêntico ao esperado · **Status:** PASS (3 de 3 asserções) · **Evidência:** `c4-v05-b-r2-5-4-test.log`, linhas 159–161.
- **ID:** V13 · **Objetivo:** ancestral com `opacity:0.5` + falha posterior não resulta em visibilidade confirmada · **Pré-condições:** fixture novo `#r25-ancestor-opacity05-child`; opacidade parcial lida com sucesso; falha injetada na 4ª chamada · **Procedimento:** `probeState()` real do núcleo · **Resultado esperado:** `visibilityStatus ≠ 'visible'`, `ancestorVisibility ≠ 'completed'`, `ancestorOpacity` representa somente o valor parcial coletado (`0.5`) · **Resultado observado:** idêntico ao esperado · **Status:** PASS (3 de 3 asserções) · **Evidência:** `c4-v05-b-r2-5-4-test.log`, linhas 162–164.

### Regressão

- **ID:** REG-01 · **Objetivo:** as 159 asserções da R2.5.3 permanecem válidas após as correções · **Procedimento:** suíte completa executada em Chromium headless real via CDP · **Resultado esperado:** nenhum teste anterior alterado · **Resultado observado:** 159 asserções anteriores e 11 novas, todas PASS · **Status:** PASS · **Evidência:** `c4-v05-b-r2-5-4-test.log` (196 linhas), `c4-v05-b-r2-5-4-test-results.json`.
- **Cobertura por grupo:** A=16, B=17, C=21, D=27, V=25 (13 IDs distintos: V1–V13), P=19 (P1–P7), R=12 (R1–R7), E=7, F=11, G=11, H=4 (H1–H2). Soma = 170 = total de registros individuais.
- **Identificadores cobertos:** A1–A9 (incl. A7b), B1–B6 (incl. B4a/B4b), C1–C6 (incl. C4b), D1–D12, V1–V13, P1–P7, R1–R7, E1–E7, F1–F9, G1–G8, H1–H2.

### Testes não executados

- Nenhum. Todos os testes declarados foram executados: 170 registros individuais, `NOT RUN = 0`.
- **BLOCKED:** 0. Nenhum teste foi bloqueado por impedimento.

### Verificações estruturais

- **ID:** STR-01 · `node --check` em `c4-v05-b-r2-5-4-core.cjs`, `c4-v05-b-r2-5-4-test.cjs`, `c4-v05-b-r2-5-4.cjs`, `gerar-resultados-r2-5-4.cjs` · **Status:** PASS.
- **ID:** STR-02 · Diff dos três blocos corrigidos contra o original da R2.5.3, revisado linha a linha · **Status:** PASS.
- **ID:** STR-03 · Coerência log ↔ JSON: `summaryMatchesLog = true`, `groupsMatchSummary = true`, 0 duplicidades de `(id, name)`, 0 linhas de resultado não parseadas · **Status:** PASS.
- **ID:** STR-04 · Nenhum arquivo de produção alterado: `git status` restrito a `docs/auditorias/c4-v05-b/evidencias-r2-5-4/` · **Status:** PASS.

---

## 7. Consistência e integridade

- **Contagens:** 170 registros individuais, derivados por parsing do log — `PASS = 170`, `FAIL = 0`, `BLOCKED = 0`, `NOT RUN = 0`. Somatório dos 11 grupos = 170. Contagens do resumo do log = contagens recalculadas.
- **Divergências:** uma divergência herdada, explicitada em A-05: o manifesto da R2.5.3 declara `allHashesMatch: true` com 2 de 9 artefatos divergentes. Nenhuma divergência detectada entre log, JSON, relatório e manifesto da R2.5.4.
- **Hashes:** SHA-256 sobre o conteúdo completo de cada artefato final, gravados em `c4-v05-b-r2-5-4-integrity.json`, gerado após o último artefato. O manifesto não declara o próprio hash, para evitar referência circular.
- **Manifestos:** `c4-v05-b-r2-5-4-integrity.json` — 11 artefatos declarados, com nome, caminho, tamanho em bytes, linhas (`wc -l`) e SHA-256. O campo `integrityVerification.allHashesMatch` é preenchido pela rotina de verificação independente após o recálculo real, não por declaração.
- **Logs:** `c4-v05-b-r2-5-4-test.log` — 196 linhas, saída integral do processo de teste, exit code 0.
- **Verificações independentes:** os hashes do manifesto foram recalculados por rotina separada, por leitura independente dos arquivos, após a geração do manifesto.

### Trechos anteriores e novos

**Correção A — falha na obtenção do pai**

Anterior (R2.5.3, `core.cjs` 950–960):

```javascript
const parentObj = parentInfo.result;
if (!parentObj || !parentObj.objectId) {
  // Não foi possível obter o elemento pai.
  // Se já confirmamos que estamos na raiz (via isRoot acima), a travessia está completa.
  // Caso contrário, a travessia está incompleta — não dá para confirmar ancestrais visíveis.
  if (ancestorVisibility === 'completed' && !ancestorHiddenAcc) {
    ancestorVisibility = 'partial';
    ancestorFailureReason = 'não foi possível obter o elemento pai para continuar a travessia';
  }
  break;
}
```

Novo (R2.5.4, `core.cjs` 950–963):

```javascript
const parentObj = parentInfo.result;
if (!parentObj || !parentObj.objectId) {
  // Não foi possível obter o elemento pai.
  // A raiz do documento é tratada antes (isRoot acima), portanto
  // alcançar este ponto significa que a travessia NÃO alcançou a raiz.
  // ancestorHiddenAcc não comprova completude: visibility é herdável e
  // pode ser sobrescrita por descendentes, logo é evidência de estilo,
  // não de que a árvore foi percorrida por completo.
  ancestorVisibility = 'partial';
  ancestorFailureReason =
    'não foi possível obter o elemento pai para continuar a travessia';
  break;
}
```

Justificativa: `ancestorHiddenAcc` é evidência de estilo, não de completude da travessia. Alcançar este bloco significa, por construção, que a raiz não foi alcançada; a travessia é incompleta independentemente das propriedades já observadas.

**Correção B — preservação de evidências no `catch`**

Anterior (R2.5.3, `core.cjs` 975–981):

```javascript
} catch (e) {
  ancestorVisibility = 'error';
  ancestorFailureReason = e.message;
  // Não conseguir ler ancestrais não converte ausência de evidência em visibilidade confirmada
  ancestorOpacityAcc = null;
  ancestorHiddenAcc = false;
}
```

Novo (R2.5.4, `core.cjs` 975–984):

```javascript
} catch (e) {
  ancestorVisibility = 'error';
  ancestorFailureReason = e.message;

  // Preservar as evidências já obtidas.
  // A falha altera a completude da travessia, não os resultados
  // válidos das leituras anteriores.
  // Um display:none ou uma opacidade zero já comprovados não podem ser
  // apagados por uma leitura posterior que falhou.
}
```

Justificativa: a falha altera a completude da travessia, não os resultados válidos das leituras anteriores. Redefinir os acumuladores no tratamento de exceção destruía evidência válida.

**Correção C — precedência da decisão final**

Anterior (R2.5.3, `core.cjs` 983–1002):

```javascript
// Se a leitura de ancestrais não foi concluída com sucesso e o próprio
// elemento está visível, não presumir que ancestrais estão visíveis.
if (ancestorVisibility !== 'completed' && visibilityStatus === 'visible') {
  visibilityStatus = 'unknown';
} else if (ancestorVisibility === 'completed') {
  // display:none de qualquer ancestral é absoluto: oculta o elemento e
  // todos os descendentes, independentemente de sobrescrita de visibility.
  if (ancestorDisplayNoneAcc) {
    visibilityStatus = 'hidden';
  }
  // visibility:hidden/collapse de ancestral não força hidden sozinho:
  // o estilo computado do próprio elemento já reflete herança +
  // sobrescrita. Se o próprio elemento tem visibility:visible, ele é
  // visível apesar do ancestral oculto (desde que não haja display:none
  // e a opacidade acumulada seja maior que zero).
  // Se a opacidade acumulada é zero, o elemento não está visível.
  else if (ancestorOpacityAcc === 0) {
    visibilityStatus = 'not-visible';
  }
}
```

Novo (R2.5.4, `core.cjs` 983–1005):

```javascript
// Precedência da decisão final de visibilidade:
// 1. Evidência absoluta: display:none em qualquer ancestral.
// 2. Evidência absoluta: opacidade acumulada zero.
// 3. Incerteza: travessia de ancestrais incompleta ou com erro.
// 4. Resultado do próprio elemento, quando não invalidado por evidência superior.
//
// Uma falha de leitura posterior não pode apagar uma evidência absoluta
// já comprovada; e uma travessia incompleta não pode resultar em
// visibilidade confirmada.
//
// visibility:hidden/collapse de ancestral não força hidden sozinho:
// o estilo computado do próprio elemento já reflete herança + sobrescrita.
if (ancestorDisplayNoneAcc) {
  visibilityStatus = 'hidden';
} else if (ancestorOpacityAcc === 0) {
  visibilityStatus = 'not-visible';
} else if (
  ancestorVisibility !== 'completed' &&
  visibilityStatus === 'visible'
) {
  visibilityStatus = 'unknown';
}
```

Justificativa: evidência absoluta de ocultação precede a incerteza por travessia incompleta. Uma falha posterior não apaga `display:none` ou `opacity:0` já comprovados, e uma travessia incompleta nunca resulta em visibilidade confirmada.

---

## 8. Limitações e incertezas

- **Itens não verificados:**
  - O comportamento do núcleo da R2.5.4 sob falha que atinja o `catch` (exceção real do CDP) não foi exercitado por teste dedicado: V11, V12 e V13 provocam falha de leitura devolvendo `result: null`, não exceção. A Correção B altera esse caminho; a cobertura direta permanece pendente.
  - A correção de A-05 (manifesto da R2.5.3) não foi implementada.
  - O harness `c4-v05-b-r2-5-4.cjs` não executa coleta completa contra a aplicação de produção nesta iteração, conforme o padrão herdado da R2.5.3.
- **Testes bloqueados:** nenhum.
- **Testes não executados:** nenhum.
- **Incertezas:**
  - O contrato atual não distingue opacidade acumulada parcial de completa. Em travessia incompleta, `ancestorOpacity` representa o produto dos níveis efetivamente examinados, não a opacidade efetiva de toda a cadeia. V13 fixa o valor coletado (`0.5`) e a documentação registra essa limitação; alterar o contrato exigiria mudança de schema de saída, fora do escopo autorizado.
  - `ancestorDisplayNoneAcc` interrompe a travessia e marca `ancestorVisibility = 'completed'` por decisão de desenho herdada da R2.5.3. A correção C apenas dá precedência a esse sinal; o significado de `'completed'` nesse caso específico (descoberta antecipada de `display:none`) permanece o da R2.5.3 e não foi reclassificado.
- **Dependências externas:** Chromium 156 headless via CDP na porta 9222 e servidor HTTP local na porta 8000, ambos provisionados nesta execução e encerrados ao término.

---

## 9. Veredito

- **APROVADA / REPROVADA / INCONCLUSIVA:** **APROVADA — validação interna da implementação da R2.5.4.** Não equivale à aprovação independente.
- **Fundamentação:** as três correções especificadas foram aplicadas de forma localizada no fluxo existente de `probeState()`, sem reescrita da função e sem novo mecanismo de visibilidade. Os três cenários que faltavam na R2.5.3 estão cobertos por testes de integração que exercitam o `probeState()` real em Chromium headless com injeção controlada de falha CDP: V11 (falso positivo de visibilidade com ancestral oculto), V12 (perda de evidência absoluta) e V13 (opacidade parcial). Todos os 170 registros individuais passaram; 159 asserções da R2.5.3 permaneceram inalteradas. Nenhum arquivo de produção foi alterado, nenhum commit ou push foi realizado.
- **Critérios atendidos:** três blocos de correção aplicados; V11, V12 e V13 com resultados individuais verificáveis; regressão executada sem alteração de expectativas antigas; nenhuma divergência entre log, JSON, relatório e manifesto; hashes declarados recalculados; nenhum arquivo de produção alterado; nenhum commit ou push.
- **Critérios não atendidos:** cobertura direta do caminho de exceção do `catch` (Correção B) por teste dedicado — registrado como item não verificado na seção 8; correção de A-05, deliberadamente fora de escopo.
- **Condições para nova avaliação:** auditoria independente externa sobre o código publicado da R2.5.4 e sobre as evidências aqui indexadas, com reprodução dos testes V11–V13 e recálculo dos hashes.

> **Fundamentação do `AGENTS.md` seção 61:** este documento é o resultado da implementação e da validação interna. O agente que implementou não declara aprovação independente da R2.5.4; essa decisão permanece com o auditor externo.

---

## 10. Próximos passos

- **Correções necessárias:**
  - Executar auditoria independente sobre a R2.5.4, com foco em: precedência da decisão final, preservação de evidências no `catch` e cobertura do caminho de exceção.
  - Decidir sobre a correção de A-05 (manifesto da R2.5.3), mantendo a exigência de não reescrever evidência histórica.
  - Avaliar cobertura de teste para o caminho de exceção real do `catch`, se o auditor externo considerar necessário.
- **Evidências adicionais:**
  - Reprodução independente de V11, V12 e V13 a partir do commit publicado.
  - Recálculo independente dos SHA-256 de `c4-v05-b-r2-5-4-integrity.json`.
- **Próxima etapa autorizada:** R2.6 e R2.7 permanecem bloqueadas até decisão do auditor externo. Nenhuma alteração de CSS de produção está autorizada.

---

## Anexo — Estado final do repositório

- **Arquivos criados:** `docs/auditorias/c4-v05-b/evidencias-r2-5-4/` — `c4-v05-b-r2-5-4-core.cjs`, `c4-v05-b-r2-5-4.cjs`, `c4-v05-b-r2-5-4-test.cjs`, `c4-v05-b-r2-5-4-test-fixtures.html`, `c4-v05-b-r2-5-4-test.log`, `c4-v05-b-r2-5-4-test-results.json`, `c4-v05-b-r2-5-4-integrity.json`, `gerar-resultados-r2-5-4.cjs`, `gerar-manifesto-r2-5-4.cjs`, `verificar-manifesto-r2-5-4.cjs`, `INDICE-EVIDENCIAS-R2-5-4.md`, `RELATORIO-FINAL-R2-5-4.md` — 12 arquivos.
- **Arquivos alterados:** nenhum fora do diretório acima. `docs/auditorias/c4-v05-b/evidencias-r2-5-3/` preservado intacto.
- **Arquivos de produção alterados:** nenhum.
- **Commit:** nenhum. **Push:** nenhum.
- **Branch:** `feat/app-navigation-redesign` em `6a2052cce184d3d3fd841580f4f34aad70b5b17d`.
