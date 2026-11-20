# RELATÓRIO TÉCNICO DE AUDITORIA — C.4-V05-B-R2.5.6

**Correção do contrato de exceções CDP e integração do mecanismo rigoroso de visibilidade**

> Este relatório segue `docs/padroes/MODELO-RELATORIO-AUDITORIA.md` e as seções 53, 60 e 61 do `AGENTS.md`.
> Distingue fato observado, interpretação, hipótese, resultado esperado, resultado observado e item não verificado.
> **A aprovação da R2.5.6 é da auditoria independente (ChatGPT). Este documento é a validação interna.**

---

## 1. Identificação

- **Auditoria:** `C.4-V05-B-R2.5.6` — correção do contrato de exceções CDP e integração do mecanismo rigoroso de visibilidade
- **Data:** 2026-11-15
- **Repositório:** `antvjpg/LIVRO-CAIXA`
- **Branch:** `feat/app-navigation-redesign`
- **Commit-base:** `b39ed07f94e2a6d374ca2596f6f020933ed05f3a` (HEAD no início da execução; confirmado com `git rev-parse HEAD`)
- **Commit examinado:** `b39ed07f94e2a6d374ca2596f6f020933ed05f3a` — a R2.5.6 não foi commitada
- **Responsável pela execução:** agente de implementação (OpenCode)
- **Estado do working tree ao iniciar:** limpa (`git status --short` vazio)
- **Estado do working tree ao encerrar:** apenas `?? docs/auditorias/c4-v05-b/evidencias-r2-5-6/` — nenhum arquivo de produção alterado, nenhum commit, nenhum push

---

## 2. Objetivo e escopo

- **Objetivo:** (a) tornar uniforme o tratamento de `exceptionDetails` na travessia de ancestrais do núcleo compartilhado; (b) eliminar a segunda travessia independente de ancestrais do coletor principal, integrando-o ao mecanismo rigoroso do núcleo; (c) produzir evidências reproduzíveis de ambos.
- **Escopo:** `docs/auditorias/c4-v05-b/evidencias-r2-5-6/` — versões atualizadas do núcleo, do harness, dos testes e das fixtures, acrescidas de testes, logs, JSON, manifesto e documentos.
- **Fora do escopo (não executado):** `index.html`; qualquer arquivo de `js/`, `style/`; CSS, tokens, temas ou componentes; coleta completa de consumidores `--accent`; R2.6; R2.7; alteração das evidências da R2.5.3, R2.5.4 ou R2.5.5; remoção de testes históricos; commit; push.
- **Critérios de aprovação:** os critérios das seções 5, 6 e 7 da especificação, verificados item a item na seção 9.

---

## 3. Metodologia

- **Estratégia de investigação:** (a) confirmação do estado real do repositório contra o commit-base obrigatório; (b) leitura dos nove pontos exigidos na seção 4 da especificação, com apresentação dos trechos reais antes de qualquer edição; (c) medição empírica do comportamento do CDP para duas questões que decideiam o design (estabilidade de `nodeId` sob `DOM.getDocument`, validade da associação em lote); (d) implementação; (e) execução em Chromium headless real; (f) verificação independente de integridade.
- **Ferramentas utilizadas:** `node --check`, `chromium-browser --headless=new --no-sandbox --remote-debugging-port=9222` com `chrome-remote-interface`, `python3 -m http.server 8000`, `sha256` via `node:crypto`, `git`.
- **Arquivos examinados:** `evidencias-r2-5-5/c4-v05-b-r2-5-5-core.cjs` (1.342 linhas), `c4-v05-b-r2-5-5.cjs` (830 linhas), `c4-v05-b-r2-5-5-test.cjs` (2.931 linhas), `c4-v05-b-r2-5-5-test-fixtures.html` (768 linhas), `c4-v05-b-r2-5-5-test.log`, `c4-v05-b-r2-5-5-test-results.json`, `DIAGNOSTICO-R2-5-5.md`, `docs/padroes/MODELO-RELATORIO-AUDITORIA.md`, `AGENTS.md`.
- **Procedimentos executados:** cópia isolada da R2.5.5 para `evidencias-r2-5-6/`; correção do contrato de exceções no núcleo; exposição de `traverseAncestorChain`; remoção da travessia do `collectScript` e integração do mecanismo na coleta principal; reorganização mínima do harness para permitir o teste de integração; criação de fixtures de exceção real; criação dos testes X1–X4 e Y1–Y5; execução integral; geração do JSON por script; geração do manifesto; verificação por rotina independente.
- **Limitações metodológicas:** (i) a distribuição real por `<slot>` não é observável neste build do Chromium (L-01); (ii) o harness não executou coleta completa contra a aplicação, por estar fora do escopo (L-03); (iii) a pré-seleção `visible()` permanece como pré-filtro de candidatos no `collectScript` (L-04).

---

## 4. Inventário de evidências

Todos os artefatos residem em `docs/auditorias/c4-v05-b/evidencias-r2-5-6/`. O manifesto `c4-v05-b-r2-5-6-integrity.json` é a fonte única dos hashes; o índice não cita hashes, para evitar circularidade.

| ID | Arquivo | Finalidade | Origem | Integridade | Verificação realizada |
|---|---|---|---|---|---|
| EV-01 | `c4-v05-b-r2-5-6-core.cjs` | Núcleo compartilhado: contrato de exceções e exposição do mecanismo | Cópia da R2.5.5 + acréscimos | SHA-256 no manifesto | `node --check` aprovado; 360 asserções reais |
| EV-02 | `c4-v05-b-r2-5-6.cjs` | Harness com a coleta principal integrada ao núcleo | Cópia da R2.5.5 + acréscimos | SHA-256 no manifesto | `node --check` aprovado; requirable sem executar a coleta |
| EV-03 | `c4-v05-b-r2-5-6-test.cjs` | Suíte: 309 asserções herdadas + 51 novas | Cópia da R2.5.5 + acréscimos | SHA-256 no manifesto | `node --check` aprovado; execução integral |
| EV-04 | `c4-v05-b-r2-5-6-test-fixtures.html` | Fixture: alvos de exceção real e consumidores de `--accent` | Cópia da R2.5.5 + acréscimos | SHA-256 no manifesto | Carregada em Chromium real a cada execução |
| EV-05 | `c4-v05-b-r2-5-6-test.log` | Log textual das 360 asserções | Execução da suíte | SHA-256 no manifesto | Parser: 0 linhas não parseadas |
| EV-06 | `c4-v05-b-r2-5-6-test-results.json` | 360 registros individuais e contagens recalculadas | `gerar-resultados-r2-5-6.cjs` | SHA-256 no manifesto | `summaryMatchesLog: true`; `groupsMatchSummary: true`; 0 duplicidades |
| EV-07 | `gerar-resultados-r2-5-6.cjs` | Consolida o log em registros individuais | Implementação desta etapa | SHA-256 no manifesto | `node --check` aprovado |
| EV-08 | `gerar-manifesto-r2-5-6.cjs` | Gera o manifesto após o último artefato | Implementação desta etapa | SHA-256 no manifesto | `node --check` aprovado |
| EV-09 | `verificar-manifesto-r2-5-6.cjs` | Recálculo independente dos hashes | Implementação desta etapa | SHA-256 no manifesto | `node --check` aprovado; execução concluída |
| EV-10 | `DIAGNOSTICO-R2-5-6.md` | Diagnóstico com trechos reais, causas-raiz e limites | Implementação desta etapa | SHA-256 no manifesto | Revisão textual |
| EV-11 | `INDICE-EVIDENCIAS-R2-5-6.md` | Índice das evidências | Implementação desta etapa | SHA-256 no manifesto | Revisão textual |
| EV-12 | `RELATORIO-FINAL-R2-5-6.md` | Este relatório | Implementação desta etapa | SHA-256 no manifesto | Revisão textual |
| EV-13 | `c4-v05-b-r2-5-6-integrity.json` | Manifesto SHA-256 dos 12 artefatos | `gerar-manifesto-r2-5-6.cjs` | **Não declara o próprio hash** | Recálculo por `verificar-manifesto-r2-5-6.cjs` |

---

## 5. Achados

### F-01 — O tratamento de `exceptionDetails` não era uniforme na travessia

- **ID:** F-01 (R25.6-01)
- **Gravidade:** alta
- **Localização:** `evidencias-r2-5-5/c4-v05-b-r2-5-5-core.cjs`, função `traverseAncestorChain`, passo 6 (linhas 849–863)
- **Problema observado:** a leitura do estilo verificava `exceptionDetails`; a leitura do próximo ancestral não. Uma exceção real no Chromium — que o CDP **resolve** devolvendo `exceptionDetails`, sem rejeitar a promessa — caía no ramo de "ausência de pai" e era classificada como `partial`.
- **Causa-raiz:** o tratamento de erro foi aplicado por leitura, e não por tipo de operação. O `catch` do núcleo só é alcançado por rejeição de promessa, jamais por `exceptionDetails`.
- **Impacto:** classificação falsa de estado terminal. `partial` significa "falha de leitura"; a ocorrência era, na verdade, uma exceção. O `ancestorFailureReason` também não registrava a causa real.
- **Evidência:** X1, X2, X3, X4.
- **Reprodução:** na R2.5.5, um getter de `assignedSlot` que lança no elemento alvo produzia `ancestorVisibility: 'partial'`.
- **Correção aplicada:** verificação de `exceptionDetails` **antes** de qualquer interpretação do resultado, launching `Error` para o `catch` existente do núcleo:

```javascript
if (parentInfo && parentInfo.exceptionDetails) {
  throw new Error(describeCDPException(parentInfo.exceptionDetails));
}
```

- **Critério de encerramento:** exceção em `exceptionDetails` nunca produz `partial` nem `unavailable` — verificado por X1.

### F-02 — A coleta principal mantinha uma segunda travessia independente

- **ID:** F-02 (R25.6-03 e R25.6-04)
- **Gravidade:** alta
- **Localização:** `evidencias-r2-5-5/c4-v05-b-r2-5-5.cjs`, `collectScript` (linhas 421–441 e 465–467)
- **Problema observado:** o coletor principal calculava opacidade acumulada e ancestral com `display:none` por conta própria, com semântica divergente do mecanismo do núcleo em sete aspectos (raiz, árvore composta, elemento desconectado, `display:none`, validação de opacidade, limite de profundidade, estado resultante).
- **Causa-raiz:** a lógica de visibilidade nasceu dentro do script de página e nunca foi extraída para o núcleo; a R2.5.5 percorreu apenas o `probeState()`.
- **Impacto:** duas fontes de verdade para a mesma medição, com resultados potencialmente divergentes no mesmo artefato de auditoria.
- **Evidência:** Y1 (os campos da linha final vêm do núcleo), Y2, Y3, Y4.
- **Reprodução:** grep por `visitedAnc` / `ancestorOpacityAcc` no harness da R2.5.5.
- **Correção aplicada:** bloco removido do `collectScript`; `traverseAncestorChain` exposto pelo núcleo; `buildAuditRow` constrói a linha final a partir do resultado do núcleo; os três pontos de `result.rows.push()` migrados.
- **Critério de encerramento:** não resta travessia independente no coletor — verificado por busca textual e por Y1–Y5.

### F-03 — `DOM.getDocument()` invalidava a associação de quase todas as linhas

- **ID:** F-03 (R25.6-06) — **achado não previsto na especificação**
- **Gravidade:** alta
- **Localização:** `evidencias-r2-5-5/c4-v05-b-r2-5-5.cjs`, `resolveNodeIds` (linhas 475–497)
- **Problema observado:** `DOM.getDocument()` é chamado dentro do laço, uma vez por linha. A chamada reinicia o mapeamento de `nodeId` do agente DOM, invalidando os identificadores já obtidos. Medição direta:

```
1) describeNode antes de outro getDocument: OK -> DIV
2) describeNode DEPOIS de outro getDocument: FALHOU -> Could not find node with given id
3) nodeId da PRIMEIRA consulta apos a segunda: FALHOU -> Could not find node with given id
4) nodeId da SEGUNDA consulta (ultima): OK -> SPAN
```

- **Causa-raiz:** desconhecimento de que `DOM.getDocument()` invalida `nodeId`s anteriores.
- **Impacto:** de todas as linhas do lote, **apenas a última** mantinha associação utilizável. Atingia `core.captureWinningRules(c, assoc.nodeId)` — já na R2.5.5 — e tornaria a integração `core.traverseAncestorChain(assoc.nodeId)` inexequível.
- **Evidência:** Y5 (regressão: todas as associações do lote permanecem válidas); a falha observada na primeira execução de Y1 e Y3, que obrigou à investigação.
- **Correção aplicada:** `DOM.getDocument()` obtido uma vez por lote, fora do laço. Contrato de cardinalidade, tratamento de erro e formato do registro preservados.
- **Critério de encerramento:** todas as associações resolvidas de um lote permanecem utilizáveis — verificado por Y5.

### F-04 — Limitação da R2.5.5 superada

- **ID:** F-04 (R25.6-02)
- **Gravidade:** informativa
- **Localização:** limitação L-02 da R2.5.5
- **Problema observado:** a detecção de exceção do lado do navegador estava implementada no núcleo, sem teste dedicado.
- **Correção aplicada:** X1, X2 e X3 provocam a exceção de fato no Chromium — por getter de `assignedSlot` que lança — e observam a resposta real do CDP, sem fabricá-la.
- **Critério de encerramento:** coberto por X1–X3.

---

## 6. Testes e verificações

### 6.1 Execução integral

| Métrica | Valor | Origem |
|---|---|---|
| Registros individuais | 360 | parser do log |
| PASS | 359 | derivado dos registros |
| FAIL | 0 | derivado dos registros |
| BLOCKED | 1 | derivado dos registros |
| NOT RUN | 0 | derivado dos registros |
| `summaryMatchesLog` | `true` | comparação com o resumo declarado no log |
| `groupsMatchSummary` | `true` | soma dos grupos = 360 = total |
| Duplicidades de `(id, nome)` | 0 | verificação de integridade do parser |
| Linhas de resultado não parseadas | 0 | verificação de integridade do parser |

Distribuição por grupo: A:16 · B:17 · C:21 · D:27 · V:164 · P:19 · R:12 · E:7 · F:11 · G:11 · H:4 · **X:21** · **Y:30**.

**Quantidade de registros × quantidade de IDs distintos.** Os 360 registros correspondem a **124 identificadores distintos**. As duas grandezas não devem ser confundidas: 360 é o número de asserções verificadas; 124 é o número de casos nomeados (115 herdados da R2.5.5 e 9 novos: X1–X4 e Y1–Y5).

### 6.2 Preservação da herança

| Métrica | Resultado |
|---|---|
| Asserções históricas da R2.5.5 | 309 (308 PASS + 1 BLOCKED) |
| Asserções históricas **ausentes** na R2.5.6 | **0** |
| Asserções históricas alteradas | 0 |
| Asserções novas | 51 (51 PASS) |

A comparação foi feita assertion a assertion, entre o log publicado da R2.5.5 e o log da R2.5.6. Nenhuma expectativa histórica foi tocada.

### 6.3 Testes novos — grupo X (exceções reais no Chromium)

Todos executam o `probeState()` real. A exceção é provoked **dentro do navegador**, por um getter de `assignedSlot` que lança, instalado e removido em `finally`. A resposta do CDP é observada por uma passagem direta, que **não fabrica nem altera** resposta alguma.

| ID | Objetivo | Resultado esperado | Resultado observado | Status |
|---|---|---|---|---|
| X1 | `exceptionDetails` na leitura do pai | resposta CDP contém `exceptionDetails`; chamada resolvida, não rejeitada; `error`; não `partial`; não `unavailable`; causa identificada; opacidade em `error` | idem | PASS (7) |
| X2 | opacidade zero antes da exceção | `error`; `ancestorOpacity` 0 preservado; `conclusive-zero`; `not-visible` | idem | PASS (5) |
| X3 | evidência de ocultação antes da exceção | `error`; `ancestorHidden` preservado; `unknown`; não `visible`; não descartado | idem | PASS (6) |
| X4 | distinção entre os dois caminhos de exceção | ambos `error`; cada um com a sua própria causa; caminho de rejeição exercitado | idem | PASS (3) |

**Total do grupo X:** 21 asserções, 21 PASS, 0 FAIL, 0 BLOCKED.

### 6.4 Testes novos — grupo Y (integração da coleta principal)

Exercitam o fluxo **real** do harness: `collectScript` real (descoberta), `resolveNodeIds` real (associação), `buildAuditRow` real (linha final). Nenhuma lógica de integração foi copiada para dentro do teste.

| ID | Objetivo | Resultado esperado | Resultado observado | Status |
|---|---|---|---|---|
| Y1 | linha final pelo fluxo real | consumidor descoberto; associação resolvida; mecanismo do núcleo chamado uma vez; os sete campos de ancestralidade iguais ao resultado do núcleo; `completed`; `complete`; `visible`; associação preservada | idem | PASS (13) |
| Y2 | ancestral com opacidade zero | `ancestorOpacity` 0 pela linha final; `conclusive-zero`; `not-visible`; nunca `visible` | idem | PASS (4) |
| Y3 | travessia incompleta | `partial` na linha final; `unknown`; nunca `visible` | idem | PASS (3) |
| Y4 | associação inválida | `unavailable`; `ancestorOpacity` nulo (sem inventar `1`); status `unavailable`; causa explícita; `unknown`; nunca `visible`; captura de regras CSS sinalizada | idem | PASS (7) |
| Y5 | validade das associações do lote | nenhuma associação invalidada; lote com mais de uma associação resolvida | idem | PASS (3) |

**Total do grupo Y:** 30 asserções, 30 PASS, 0 FAIL, 0 BLOCKED.

### 6.5 Verificações estáticas

| Verificação | Resultado |
|---|---|
| `node --check` nos seis arquivos `.cjs` | Aprovado em todos |
| Busca por travessia independente no harness (`visitedAnc`, `ancestorOpacityAcc`, `ancestorHiddenAcc`) | Nenhuma ocorrência |
| Ocorrências de `const collectScript` no harness | 1 (sem duplicação) |
| Diff do `collectScript` entre R2.5.5 e R2.5.6, no código-fonte | Restrito ao bloco removido e aos dois campos retirados |
| Diff do núcleo entre R2.5.5 e R2.5.6 | 15 linhas: a verificação de `exceptionDetails` e a exposição de `traverseAncestorChain` |
| `require` do harness sem executar a coleta | Funciona; exporta `buildAuditRow`, `collectAncestryEvidence`, `classifyVisibility`, `resolveNodeIds`, `collectScript` |

### 6.6 Verificações runtime

| Verificação | Resultado |
|---|---|
| Suíte completa em Chromium headless real | Exit code 0 |
| Comparação assertion a assertion com o log da R2.5.5 | 309/309 presentes e aprovadas |
| Resposta CDP com `exceptionDetails` observada em runtime | Confirmada em X1, X2 e X3 |
| Travessia do núcleo chamada pela coleta principal | Confirmada por Y1 (1 chamada, campos idênticos) |
| Recálculo dos hashes por rotina separada | 12/12 artefatos conformes |

---

## 7. Consistência e integridade

- **Contagens:** 360 registros individuais extraídos do log; 359 PASS, 0 FAIL, 1 BLOCKED, 0 NOT RUN, em 124 identificadores distintos. Todas as contagens derivam dos registros.
- **Divergências:** nenhuma divergência entre log, JSON, índice e relatório. O único item não aprovado é **V32**, BLOCKED com causa específica, declarado como tal no log, no JSON, no índice e neste relatório.
- **Hashes:** SHA-256 sobre o conteúdo completo de cada artefato, recalculado por rotina independente que não reutiliza a rotina geradora.
- **Manifestos:** `c4-v05-b-r2-5-6-integrity.json`, 12 artefatos, gerado por último, sem auto-referência. `integrityVerification.allHashesMatch` permanece `null` na geração e é preenchido pela verificação com o resultado real do recálculo.
- **Logs:** `c4-v05-b-r2-5-6-test.log` é a saída integral da execução; o parser consumiu 360 linhas de resultado, com 0 linha não parseada e 0 duplicidade.
- **Identificação do ambiente:** commit-base `b39ed07f94e2a6d374ca2596f6f020933ed05f3a`, branch `feat/app-navigation-redesign`, Node `v26.12.1`, Chromium `156.0.8078.79` headless, plataforma `linux (Termux/Android)`, data/hora de execução registradas no manifesto e no JSON.
- **Verificações independentes:** o manifesto foi conferido por rotina separada, com o resultado registrado no próprio manifesto. A auditoria independente da R2.5.6 **não** foi realizada por este agente e permanece pendente.

---

## 8. Limitações e incertezas

- **Itens não verificados:**
  1. A distribuição real de elemento por `<slot>` no navegador — o build não computa a tabela de slots. V32 permanece BLOCKED. V32b é evidência da *precedência* da regra, **não** da distribuição real.
  2. A coleta completa de consumidores `--accent` contra a aplicação — proibida nesta etapa. A integração foi validada contra a fixture, com o mesmo `collectScript` e o mesmo `resolveNodeIds` de produção.
  3. O comportamento do harness após a correção de F-03 em uma coleta real de múltiplos temas e viewports — não executado.
  4. A resposta de `DOM.getDocument()` quando a página é recarregada entre lotes — não exercitada.
- **Testes bloqueados:** V32 — distribuição real por slot não observável no Chromium 156.0.8078.79 (build Termux/Android). Causa específica registrada no log, no JSON e no índice.
- **Testes não executados:** nenhum.
- **Incertezas:**
  - **F-03 altera comportamento fora da especificação.** A correção de `resolveNodeIds` foi adotada porque a integração exigida por T4/T6 é inexequível sem ela e porque o defeito é demonstrado por experimento controlado. Alternativas existem (por exemplo, `backendNodeId`, estável entre chamadas de `getDocument`) e a decisão de manter a correção nesta etapa cabe ao auditor.
  - A pré-seleção `visible()` permanece no `collectScript` como única confirmação das condições próprias do elemento. A classificação de visibilidade da linha depende desse contrato, declarado por construção.
  - A reorganização do harness (fluxo em `main()` com guarda `require.main === module`) é uma mudança estrutural; o comportamento do fluxo de coleta é preservado, mas não foi exercitado em coleta real.
- **Dependências externas:** Chromium 156.0.8078.79 headless via CDP (porta 9222) e servidor HTTP local (porta 8000) para a fixture.

---

## 9. Veredito

- **APROVADA / REPROVADA / INCONCLUSIVA:** **APROVADA NA VALIDAÇÃO INTERNA.**
- **Fundamentação:** os dois problemas determinados pela auditoria foram corrigidos e verificados por 21 asserções de exceção real no Chromium e 30 asserções de integração da coleta principal, executadas contra o `probeState()` e contra o fluxo real do harness. As 309 asserções históricas da R2.5.5 permanecem inalteradas e aprovadas. Um teste permanece BLOCKED, com causa ambiental específica e documentada.
- **Critérios atendidos:**

| # | Critério da especificação | Verificado por |
|---|---|---|
| 1 | Exceção em `exceptionDetails` na leitura do pai → `error`, nunca `partial`/`unavailable` | X1 |
| 2 | Evidências anteriores à exceção preservadas | X2, X3 |
| 3 | Precedência de `ancestorOpacityStatus` não alterada | X2 (`conclusive-zero` sobre `error`) |
| 4 | `traverseAncestorChain` exposta pelo núcleo, sem cópia | Diff do núcleo (15 linhas) + Y1 |
| 5 | Travessia independente eliminada do `collectScript` | Busca textual + diff do `collectScript` + Y1 |
| 6 | Descoberta e coleta de propriedades CSS preservadas | Diff do `collectScript` (apenas o bloco removido) + Y1 |
| 7 | Classificação de `visibilityStatus` conforme o contrato | Y1, Y2, Y3, Y4 |
| 8 | Associação inválida → estado indisponível e causa explícita | Y4 |
| 9 | Exceção real executada no Chromium | X1, X2, X3 |
| 10 | Caminho de rejeição CDP mantido e distinguido | X4 + V20–V23 |
| 11 | Teste de integração real da coleta principal | Y1–Y5 |
| 12 | 308 PASS e 1 BLOCKED históricos preservados | Comparação assertion a assertion: 309/309 |
| 13 | V32 permanece BLOCKED | Log, JSON e índice |
| 14 | Expectativas de V18, V20–V31, V33–V38 não enfraquecidas | Mesmas asserções, todas aprovadas |
| 15 | Nenhum arquivo de produção alterado | `git status --short`: apenas o diretório novo |
| 16 | R2.5.3, R2.5.4 e R2.5.5 intactas | `git diff HEAD -- evidencias-r2-5-3/ evidencias-r2-5-4/ evidencias-r2-5-5/`: vazio |
| 17 | Sem commit e sem push | `git log --oneline -1` = `b39ed07` |

- **Critérios não atendidos:** nenhum dos 17 critérios acima.
- **Condições para nova avaliação:** execução da auditoria independente pelo ChatGPT, com acesso direto ao código publicado e aos artefatos. Este agente **não** declara aprovação independente: a validação interna demonstra apenas o resultado dos testes executados por ele (seção 61 do `AGENTS.md`).

---

## 10. Próximos passos

- **Correções necessárias:** nenhuma dentro do escopo da R2.5.6. Permanece para decisão do auditor: (a) confirmar se a correção de F-03 deve permanecer nesta etapa ou ser adiada; (b) avaliar o uso de `backendNodeId` como alternativa mais robusta à invalidate de `nodeId`; (c) definir se a pré-seleção `visible()` deve ser explicitada como campo da linha.
- **Evidências adicionais:** reexecução de V32 em ambiente cujo Chromium compute a tabela de slots; execução do harness contra a aplicação em etapa posterior autorizada, para validar a integração em escala.
- **Próxima etapa autorizada:** nenhuma. Nenhum commit e nenhum push foram executados. R2.6 e R2.7 permanecem não iniciadas, aguardando a auditoria independente.

---

## Histórico de uso

| Data | Auditoria | Commit-base | Veredito | Responsável |
|---|---|---|---|---|
| 2026-11-15 | C.4-V05-B-R2.5.6 | `b39ed07f94e2a6d374ca2596f6f020933ed05f3a` | Aprovada na validação interna | Agente de implementação (OpenCode) |
