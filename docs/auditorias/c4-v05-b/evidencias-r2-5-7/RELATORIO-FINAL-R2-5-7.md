# RELATÓRIO TÉCNICO DE AUDITORIA — C.4-V05-B-R2.5.7

**Correção de colisão de identificadores entre execuções da coleta (F-04)**

> Este relatório segue `docs/padroes/MODELO-RELATORIO-AUDITORIA.md` e as seções 53, 60 e 61 do `AGENTS.md`.
> Distingue fato observado, interpretação, hipótese, resultado esperado, resultado observado e item não verificado.
> **A aprovação da R2.5.7 é da auditoria independente (ChatGPT). Este documento é a validação interna.**

---

## 1. Identificação

- **Auditoria:** `C.4-V05-B-R2.5.7` — correção de colisão de identificadores entre execuções da coleta (F-04)
- **Data:** 2026-11-15
- **Repositório:** `antvjpg/LIVRO-CAIXA`
- **Branch:** `feat/app-navigation-redesign`
- **Commit-base:** `a790d61612566185d42d24a9d1678faa7f466cf9` (HEAD confirmado com `git rev-parse HEAD` antes de qualquer edição)
- **Commit examinado:** `a790d61612566185d42d24a9d1678faa7f466cf9`
- **Commit publicado:** `ad9188964b5c5a68e380c77af95c8f688fd1dec2` — ver a retificação pós-publicação na seção 10
- **Responsável pela execução:** agente de implementação (OpenCode)
- **Estado do working tree ao iniciar:** limpa (`git status --short` vazio)
- **Estado do working tree ao encerrar a rodada de implementação:** apenas `?? docs/auditorias/c4-v05-b/evidencias-r2-5-7/`; **após a publicação**, a branch está sincronizada com o remoto e a working tree está limpa
- **Núcleo compartilhado:** **não alterado** nesta rodada — a R2.5.7 consome o núcleo publicado na R2.5.6

---

## 2. Objetivo e escopo

- **Objetivo:** corrigir a identidade das amostras entre execuções do `collectScript`, para que uma execução não interfira nas associações de outra, mesmo com as telas anteriores ainda montadas; e demonstrar, por teste de integração, que a navegação entre telas não produz associações ambíguas.
- **Escopo:** `docs/auditorias/c4-v05-b/evidencias-r2-5-7/` — harness, suíte de testes, fixture, log, JSON, manifesto, scripts e documentos. **O núcleo não foi copiado nem alterado.**
- **Fora do escopo (não executado):** `index.html`; qualquer arquivo de `js/`, `style/`; CSS, HTML funcional, regras financeiras; coleta completa de consumidores `--accent`; R2.6; R2.7; alteração do mecanismo de travessia de ancestrais; alteração de F-03; migração para `backendNodeId`; expansão para Shadow DOM; alteração das evidências da R2.5.3, R2.5.4, R2.5.5 ou R2.5.6. A publicação da rodada (commit e push) ocorreu **após** a implementação e está registrada na seção 10.
- **Critérios de aprovação:** os critérios de aceite da seção 4 da especificação, verificados item a item na seção 9.

---

## 3. Metodologia

- **Estratégia de investigação:** (a) confirmação do estado real do repositório contra o commit-base obrigatório; (b) localização dos trechos reais exigidos — criação do atributo `data-c4-audit`, inicialização do contador, execuções repetidas de `collectScript`, `resolveNodeIds`, `resolveNodeIdResult`, navegação entre telas em `main()` e limpeza de recursos temporários; (c) implementação delimitada; (d) execução integral em Chromium headless real; (f) verificação independente de integridade.
- **Ferramentas utilizadas:** `node --check`, `chromium-browser --headless=new --no-sandbox --remote-debugging-port=9222` com `chrome-remote-interface`, `python3 -m http.server 8000`, `sha256` via `node:crypto`, `git`.
- **Arquivos examinados:** `evidencias-r2-5-6/c4-v05-b-r2-5-6.cjs` (924 linhas), `c4-v05-b-r2-5-6-core.cjs` (1.357 linhas), `c4-v05-b-r2-5-6-test.cjs` (3.515 linhas), `c4-v05-b-r2-5-6-test-fixtures.html` (820 linhas), `c4-v05-b-r2-5-6-test.log`, `c4-v05-b-r2-5-6-test-results.json`, `DIAGNOSTICO-R2-5-6.md`, `RELATORIO-FINAL-R2.5.6.md`, `INDICE-EVIDENCIAS-R2-5-6.md`, `c4-v05-b-r2-5-6-integrity.json`, `docs/padroes/MODELO-RELATORIO-AUDITORIA.md`, `AGENTS.md`.
- **Procedimentos executados:** cópia isolada do harness, da suíte e da fixture; aplicação da correção F-04; adaptação mecánica dos call sites dos testes Y à nova assinatura; criação do grupo Z (Z1–Z10); execução integral; geração do JSON por script; geração do manifesto; verificação por rotina independente.
- **Limitações metodológicas:** (i) a distribuição real por `<slot>` não é observável neste build do Chromium (L-01); (ii) a coleta completa contra a aplicação não foi executada (L-03).

---

## 4. Inventário de evidências

Todos os artefatos residem em `docs/auditorias/c4-v05-b/evidencias-r2-5-7/`. O manifesto `c4-v05-b-r2-5-7-integrity.json` é a fonte única dos hashes.

| ID | Arquivo | Finalidade | Origem | Integridade | Verificação realizada |
|---|---|---|---|---|---|
| EV-01 | `c4-v05-b-r2-5-7.cjs` | Harness com a identidade de execução | Cópia da R2.5.6 + F-04 | SHA-256 no manifesto | `node --check` aprovado; diff funcional de 6 pontos |
| EV-02 | `c4-v05-b-r2-5-7-test.cjs` | Suíte: 360 asserções herdadas + 33 novas | Cópia da R2.5.6 + acréscimos | SHA-256 no manifesto | `node --check` aprovado; execução integral |
| EV-03 | `c4-v05-b-r2-5-7-test-fixtures.html` | Fixture da R2.5.7 | Cópia da R2.5.6 | SHA-256 no manifesto | Sem alteração funcional: as views do teste Z são criadas em tempo de execução |
| EV-04 | `c4-v05-b-r2-5-7-test.log` | Log textual das 393 asserções | Execução da suíte | SHA-256 no manifesto | Parser: 0 linhas não parseadas |
| EV-05 | `c4-v05-b-r2-5-7-test-results.json` | 393 registros individuais e contagens recalculadas | `gerar-resultados-r2-5-7.cjs` | SHA-256 no manifesto | `summaryMatchesLog: true`; `groupsMatchSummary: true`; 0 duplicidades |
| EV-06 | `gerar-resultados-r2-5-7.cjs` | Consolida o log em registros individuais | Implementação desta etapa | SHA-256 no manifesto | `node --check` aprovado |
| EV-07 | `gerar-manifesto-r2-5-7.cjs` | Gera o manifesto após o último artefato | Implementação desta etapa | SHA-256 no manifesto | `node --check` aprovado |
| EV-08 | `verificar-manifesto-r2-5-7.cjs` | Recálculo independente dos hashes | Implementação desta etapa | SHA-256 no manifesto | `node --check` aprovado; execução concluída |
| EV-09 | `DIAGNOSTICO-R2-5-7.md` | Diagnóstico com trechos reais e limitações | Implementação desta etapa | SHA-256 no manifesto | Revisão textual |
| EV-10 | `INDICE-EVIDENCIAS-R2-5-7.md` | Índice das evidências | Implementação desta etapa | SHA-256 no manifesto | Revisão textual |
| EV-11 | `RELATORIO-FINAL-R2-5-7.md` | Este relatório | Implementação desta etapa | SHA-256 no manifesto | Revisão textual |
| EV-12 | `c4-v05-b-r2-5-7-integrity.json` | Manifesto SHA-256 dos 11 artefatos | `gerar-manifesto-r2-5-7.cjs` | **Não declara o próprio hash** | Recálculo por `verificar-manifesto-r2-5-7.cjs` |

**Núcleo compartilhado:** não é artefato desta etapa. O hash do núcleo em uso é o registrado no manifesto da R2.5.6 (`c4-v05-b-r2-5-6-integrity.json`, 12/12 conformes), que permanece intacto.

---

## 5. Achados

### F-04 — Colisão de identificadores `data-c4-audit` entre execuções da coleta

- **ID:** F-04 (R25.7-01 a R25.7-04)
- **Gravidade:** alta
- **Localização:** `evidencias-r2-5-6/c4-v05-b-r2-5-6.cjs`, `collectScript` (linhas 389, 402–403, 424) e `resolveNodeIds` (linhas 429–464)
- **Problema observado:** o índice local `i` reiniciava a cada execução, de modo que a chave `c4-<i>` era reutilizada. Com as views anteriores ainda montadas, o seletor `[data-c4-audit="<chave>"]` casava dois elementos e a associação era classificada como `ambiguous-node-association` — a linha perdia as regras CSS vencedoras e a evidência de ancestralidade.
- **Causa-raiz:** a identidade da amostra era derivada apenas do índice local, sem qualquer componente que distinguisse execuções dentro do mesmo documento; a limpeza dos atributos ocorre apenas no `finally` final da coleta, nunca entre execuções.
- **Impacto:** perda silenciosa de associação na maior parte das linhas de uma coleta real, com o agravante de que o consumo dos recursos do elemento falhava.
- **Evidência:** Z1 (reprodução pelo caminho real de resolução), Z2, Z3, Z4, Z5, Z8.
- **Reprodução:** no harness da R2.5.6, a segunda execução em diante produz `ambiguous-node-association` para as linhas cujos índices colidem com elementos de execuções anteriores.
- **Correção aplicada:** identificador de execução monotônico no contexto da página, chave composta `c4-<runId>-<i>`, e `resolveNodeIds` restrito à execução corrente.
- **Critério de encerramento:** nenhuma chave se repete entre execuções e nenhuma associação atual é ambígua — verificado por Z2, Z3, Z4 e Z5.

### F-05 — `resolveNodeIds` sem escopo de execução resolvia chaves antigas

- **ID:** F-05 (R25.7-03)
- **Gravidade:** média
- **Localização:** `evidencias-r2-5-6/c4-v05-b-r2-5-6.cjs`, `resolveNodeIds`
- **Problema observado:** mesmo com chaves compostas, uma chave de execução anterior pasada explicitamente à resolução ainda casaria o elemento antigo, ainda presente no DOM.
- **Causa-raiz:** a resolução não carregava nenhuma noção de execução corrente.
- **Impacto:** uma associação poderia ser resolvida contra um elemento de outra execução, com o `nodeId` incorreto.
- **Evidência:** Z8 (chave antiga recusada, com causa explícita) e Z10 (sem identificador de execução, nenhuma associação é resolvida).
- **Correção aplicada:** guarda de prefixo em `resolveNodeIds`; `resolveNodeIdResult` do núcleo **não** foi alterado.
- **Critério de encerramento:** chaves de outras execuções nunca são resolvidas — verificado por Z8 e Z10.

---

## 6. Testes e verificações

### 6.1 Contagens — registros, identificadores e duplicidades

| Métrica | Valor |
|---|---|
| Registros individuais (asserções) | 393 |
| Identificadores distintos | 134 |
| PASS | 392 |
| FAIL | 0 |
| BLOCKED | 1 |
| NOT RUN | 0 |
| Duplicidades de identificador | 0 (nenhum identificador aparece em dois registros) |
| Duplicidades de par `(id, nome)` | 0 |
| `summaryMatchesLog` | `true` |
| `groupsMatchSummary` | `true` |

Distribuição por grupo: A:16 · B:17 · C:21 · D:27 · V:164 · P:19 · R:12 · E:7 · F:11 · G:11 · H:4 · X:21 · Y:30 · **Z:33**.

### 6.2 Preservação da herança

| Métrica | Resultado |
|---|---|
| Asserções históricas da R2.5.6 | 360 (359 PASS + 1 BLOCKED) |
| Asserções históricas **ausentes** na R2.5.7 | **0** |
| Asserções históricas alteradas | 0 |
| Asserções novas | 33 (33 PASS) |

Comparação assertion a assertion entre o log publicado da R2.5.6 e o log da
R2.5.7. Nenhuma expectativa foi removida, renomeada, reescrita ou enfraquecida.

**Adaptação declarada.** Os testes Y da R2.5.6 chamavam
`harness.resolveNodeIds(DOM, rows, cdpErrors)`. Com a nova assinatura, os
quatro call sites passaram a informar `raw.runId`, e o auxiliar `runRealCollect`
passou a devolver o resultado completo da execução (linhas e `runId`). O texto
das 30 asserções do grupo Y é **idêntico** ao da R2.5.6, e todas continuam
aprovadas. A adaptação é mecânica e corresponde à integração exigida por T3.

### 6.3 Testes novos — grupo Z

| ID | Objetivo | Resultado esperado | Resultado observado | Status |
|---|---|---|---|---|
| Z1 | Reprodução de F-04 pelo caminho real | 2 elementos para a mesma chave; `ambiguous-node-association`; nenhum `nodeId` escolhido | idem | PASS (3) |
| Z2 | Identidade por execução | identificadores distintos e monotônicos; nenhuma chave reutilizada; chaves carregam o `runId` | idem | PASS (4) |
| Z3 | Elementos antigos não contaminam | todas as linhas resolvidas com 1 `nodeId`; o `nodeId` pertence ao elemento da chave; o atributo antigo é preservado e não recebe a chave atual | idem | PASS (5) |
| Z4 | Três execuções sucessivas | identificadores distintos e crescentes; nenhuma chave repetida; todas as linhas resolvidas; nenhuma ambígua; chave anterior não resolvida na atual | idem | PASS (6) |
| Z5 | View anterior oculta e montada | resolução sem ambiguidade; chave não reutilizada; consumidor oculto não descoberto; atributo antigo preservado | idem | PASS (4) |
| Z6 | Negativo: chave inexistente | `node-not-found`, sem `nodeId` | idem | PASS (2) |
| Z7 | Negativo: chave duplicada na execução atual | `ambiguous-node-association`, `idCount` 2, nenhum `nodeId` | idem | PASS (2) |
| Z8 | Negativo: chave antiga de outra execução | `node-not-found`, sem `nodeId`, causa explícita | idem | PASS (3) |
| Z9 | Negativo: erro CDP na resolução | `cdp-error`, sem `nodeId`, erro registrado | idem | PASS (3) |
| Z10 | Negativo: resolução sem `runId` | nenhuma associação resolvida | idem | PASS (1) |

**Total do grupo Z:** 33 asserções, 33 PASS, 0 FAIL, 0 BLOCKED.

### 6.4 Verificações estáticas

| Verificação | Resultado |
|---|---|
| `node --check` nos cinco arquivos `.cjs` | Aprovado em todos |
| Núcleo compartilhado | **Não alterado** — `CORE_PATH` aponta para `evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs` |
| `resolveNodeIdResult` do núcleo | **Não alterado** |
| Diff funcional do harness (normalizado) | 6 pontos: `CORE_PATH`, contador de execução, composição da chave, `runId` no retorno, assinatura e guardas de `resolveNodeIds`, três call sites |
| Diff da fixture | Apenas os comentários renomeados; nenhuma alteração funcional |
| Busca por remoção indiscriminada de `data-c4-audit` | Nenhuma remoção introduzida; a limpeza existente no `finally` final foi preservada |

### 6.5 Verificações runtime

| Verificação | Resultado |
|---|---|
| Suíte completa em Chromium headless real | Exit code 0 |
| Comparação assertion a assertion com o log da R2.5.6 | 360/360 presentes e aprovadas |
| Reprodução de F-04 pelo caminho real de resolução | Z1: 2 elementos para a mesma chave, `ambiguous-node-association` |
| Três execuções sucessivas sem colisão | Z4: 6 asserções aprovadas |
| Recálculo dos hashes por rotina separada | 11/11 artefatos conformes |

---

## 7. Consistência e integridade

- **Contagens:** 393 registros individuais extraídos do log; 392 PASS, 0 FAIL, 1 BLOCKED, 0 NOT RUN, em 134 identificadores distintos. Todas as contagens derivam dos registros, nunca de valores digitados.
- **Divergências:** nenhuma divergência entre log, JSON, índice e relatório. O único item não aprovado é **V32**, BLOCKED com causa específica, declarado como tal no log, no JSON, no índice e neste relatório.
- **Hashes:** SHA-256 sobre o conteúdo completo de cada artefato, recalculado por rotina independente que não reutiliza a rotina geradora.
- **Manifestos:** `c4-v05-b-r2-5-7-integrity.json`, 11 artefatos, gerado por último, sem auto-referência. `integrityVerification.allHashesMatch` permanece `null` na geração e é preenchido pela verificação com o resultado real do recálculo.
- **Logs:** `c4-v05-b-r2-5-7-test.log` é a saída integral da execução; o parser consumiu 393 linhas de resultado, com 0 linha não parseada e 0 duplicidade de par `(id, nome)`.
- **Identificação do ambiente:** commit-base `a790d61612566185d42d24a9d1678faa7f466cf9`, branch `feat/app-navigation-redesign`, Node `v26.12.1`, Chromium `156.0.8078.79` headless, plataforma `android (Termux/Android)`, data/hora de execução registradas no manifesto e no JSON.
- **Verificações independentes:** o manifesto foi conferido por rotina separada, com o resultado registrado no próprio manifesto. A auditoria independente da R2.5.7 **não** foi realizada por este agente e permanece pendente.

---

## 8. Limitações e incertezas

- **Itens não verificados:**
  1. A distribuição real de elemento por `<slot>` — o build não computa a tabela de slots. V32 permanece BLOCKED; V32b é evidência da *precedência*, **não** da distribuição real.
  2. A coleta completa de consumidores `--accent` contra a aplicação — não executada nesta rodada.
  3. O comportamento do harness com dezenas de execuções contra o aplicativo real — não executado.
  4. A coexistência de duas execuções **simultâneas** (interleaving) sobre o mesmo documento — não exercitada; a proteção atual é por identidade de execução, não por exclusão mútua.
- **Testes bloqueados:** V32 — distribuição real por slot não observável no Chromium 156.0.8078.79 (build Termux/Android). Causa específica registrada no log, no JSON e no índice.
- **Testes não executados:** nenhum.
- **Incertezas:**
  - O atributo `data-c4-audit` guarda apenas a chave da última execução que desenhou o elemento. O fluxo de produção resolve as associações imediatamente após cada execução, de modo que a perda da chave anterior é inofensiva; a observação está registrada como L-02 no diagnóstico.
  - `window.__c4AuditRunCounter` é estado de instrumentação persistido na página. Uma recarga completa o zera — e zera também os elementos antigos.
  - A recusa de uma chave de outra execução usa o status `node-not-found`, com um campo `reason` adicional. `resolveNodeIdResult` do núcleo não foi alterado; o vocabulário de status existente foi preservado.
- **Dependências externas:** Chromium 156.0.8078.79 headless via CDP (porta 9222) e servidor HTTP local (porta 8000) para a fixture.

---

## 9. Veredito

- **APROVADA / REPROVADA / INCONCLUSIVA:** **APROVADA NA VALIDAÇÃO INTERNA.**
- **Fundamentação:** a falha foi reproduzida pelo caminho real de resolução (Z1) e a correção foi verificada por 33 asserções novas que exercitam o `collectScript` real e o `resolveNodeIds` real. As 360 asserções históricas da R2.5.6 permanecem inalteradas e aprovadas. Um teste permanece BLOCKED, com causa ambiental específica e documentada.
- **Critérios de aceite da especificação:**

| # | Critério | Verificado por |
|---|---|---|
| 1 | As chaves são exclusivas por execução | Z2, Z4 |
| 2 | Elementos antigos no DOM não contaminam a resolução atual | Z3, Z4, Z8 |
| 3 | O teste de duas telas reproduz e corrige a falha | Z1, Z3, Z5 |
| 4 | Três ou mais execuções sucessivas sem colisão | Z4 |
| 5 | Associações ambíguas continuam sendo rejeitadas | Z1, Z7 |
| 6 | Os testes históricos permanecem preservados | 360/360 comparados e aprovados |
| 7 | Resultados coerentes entre JSON, log, relatório e índice | `summaryMatchesLog`, `groupsMatchSummary`, 0 divergências |
| 8 | Hashes verificados independentemente pelo script | `verificar-manifesto-r2-5-7.cjs` |
| 9 | Nenhuma alteração de produção | `git status --short`: apenas o diretório novo |

- **Critérios não atendidos:** nenhum dos 9 critérios de aceite.
- **Condições para nova avaliação:** execução da auditoria independente pelo ChatGPT, com acesso direto ao código publicado e aos artefatos. Este agente **não** declara aprovação independente: a validação interna demonstra apenas o resultado dos testes executados por ele (seção 61 do `AGENTS.md`).

---

---

## 10. Retificação pós-publicação — estado definitivo da R2.5.7

Esta seção retifica as informações de estado do repositório registradas durante a execução inicial da auditoria.

### 10.1. Identificação definitiva

- **Commit-base:** `a790d61612566185d42d24a9d1678faa7f466cf9`
- **Commit publicado:** `ad9188964b5c5a68e380c77af95c8f688fd1dec2`
- **Mensagem:** `docs(audit): C.4-V05-B-R2.5.7 identidade de execucao da coleta (F-04)`
- **Branch:** `feat/app-navigation-redesign`. Na conferência independente realizada após a publicação do commit `ad9188964b5c5a68e380c77af95c8f688fd1dec2`, a branch `feat/app-navigation-redesign` apontava para esse commit. Posteriormente, a branch recebeu a retificação documental `6c27c94f34420b9ed2b45da174ed73930ee19589`.
- **Push:** concluído para `origin/feat/app-navigation-redesign`.
- **Estado da branch:** sincronizada com o remoto.
- **Working tree após publicação:** limpa, conforme registro da execução.

### 10.2. Confirmação independente

A auditoria independente confirmou diretamente no GitHub:

1. O commit `ad9188964b5c5a68e380c77af95c8f688fd1dec2` existe no repositório.
2. Seu commit-pai é `a790d61612566185d42d24a9d1678faa7f466cf9`.
3. A branch `feat/app-navigation-redesign` aponta para `ad9188964b5c5a68e380c77af95c8f688fd1dec2`.
4. O commit contém 12 arquivos, todos restritos a `docs/auditorias/c4-v05-b/evidencias-r2-5-7/`.
5. Não foram identificadas alterações em arquivos de produção ou no núcleo compartilhado da R2.5.6.

### 10.3. Resultado técnico preservado

A publicação não alterou os resultados técnicos registrados nesta rodada:

- 393 registros de teste.
- 392 PASS.
- 0 FAIL.
- 1 BLOCKED.
- 360 verificações históricas preservadas.
- 33 verificações novas do grupo Z.
- Nenhuma duplicidade de pares `(id, nome)`.
- Nenhum registro não parseado.

A limitação relativa à ausência de teste de execuções simultâneas permanece explicitamente não verificada. A limitação L-02, relativa à sobrescrita do atributo `data-c4-audit`, também permanece registrada.

### 10.4. Retificação do estado documental

As afirmações anteriores de que a R2.5.7 não havia sido commitada, de que os arquivos permaneciam não rastreados e de que commit/push não foram executados descrevem exclusivamente o estado anterior à publicação.

Para fins de rastreabilidade, prevalecem os dados definitivos desta seção e a confirmação independente do commit remoto.

Esta retificação é documental. Não altera código, testes, fixtures, resultados ou evidências técnicas da R2.5.7.

---

## 11. Próximos passos

- **Correções necessárias:** nenhuma dentro do escopo da R2.5.7. Permanecem para decisão do auditor: (a) se a semântica de `data-c4-audit` — que guarda apenas a chave da última execução — deve ser explicitada no contrato do harness; (b) se a proteção deve cobrir interleaving de execuções simultâneas; (c) se a limpeza final dos atributos, hoje no `finally`, deve ser mantida.
- **Evidências adicionais:** execução do harness contra a aplicação em etapa posterior autorizada, para validar a identidade de execução em escala real; reexecução de V32 em ambiente cujo Chromium compute a tabela de slots.
- **Próxima etapa autorizada:** nenhuma. A publicação da rodada (commit e push) foi concluída — ver a seção 10.

---

## Histórico de uso

| Data | Auditoria | Commit-base | Veredito | Responsável |
|---|---|---|---|---|
| 2026-11-15 | C.4-V05-B-R2.5.7 | `a790d61612566185d42d24a9d1678faa7f466cf9` | Aprovada na validação interna | Agente de implementação (OpenCode) |
