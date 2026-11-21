# RELATÓRIO TÉCNICO DE AUDITORIA — R2.6.4

> Gate R2.6 — Cascata CSS real e declaração vencedora no harness C.4.

---

## 1. Identificação

- **Auditoria:** R2.6.4 — Relatório e revisão do mecanismo de regra vencedora.
- **Data:** 21/11/2026.
- **Repositório:** `antvjpg/LIVRO-CAIXA`.
- **Branch:** `feat/app-layout-redesign`.
- **Commit-base:** `678117667cbf17c11178c418fe78a34b7a13dff5`.
- **Commit examinado:** o mesmo commit-base; as alterações da correção estão no working tree, ainda não comitadas.
- **Responsável pela execução:** agente opencode (executor). **Não é auditor independente.**
- **Estado do working tree:** validador `tmp-c13/r2-6-2/validacao-r2-6-3.cjs` modificado; núcleo `docs/auditorias/c4-v05-b/evidencias-r2-6/` e diretório `tmp-c13/r2-6-4/` novos; logs e scripts exploratórios não rastreados. Nenhum commit ou push foi feito.

---

## 2. Objetivo e escopo

- **Objetivo:** consolidar as evidências das etapas R2.6.1–R2.6.3, avaliar a correção mínima aplicada e definir se o Gate R2.6 reúne condições para ser declarado suficiente.
- **Escopo:** mecanismo `getWinningRule()` / `captureWinningRules()` do núcleo C.4, matriz de 10 cenários de cascata, comparação entre núcleo histórico e núcleo corrigido.
- **Fora do escopo:** R2.7 (metodologia WCAG), V32, CSS de produção, consolidação de tokens, alterações em autenticação/persistência, redesign visual, promoção automática do novo núcleo ao harness histórico.
- **Critérios de aprovação considerados:** R2.6.1 (inspeção), R2.6.2 (matriz com esperado conhecido), R2.6.3 (validação CDP), ausência de regressão nos 10 cenários, revisão independente, regressão da suíte histórica e aceite formal registrado.

---

## 3. Metodologia

- **Estratégia:** auditoria de harness, com comparação controlada antes/depois no mesmo ambiente.
- **Ferramentas:** Chromium headless + CDP (`chrome-remote-interface`), servidor local `python3 -m http.server 8000`, Node.js 24, `node --check`, `sha256sum`, comparação JSON por script Python.
- **Arquivos examinados:**
  - `docs/auditorias/c4-v05-b/evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs`
  - `docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs`
  - `tmp-c13/r2-6-2/fixture.html`
  - `tmp-c13/r2-6-2/matriz.json`
  - `tmp-c13/r2-6-2/validacao-r2-6-3.cjs`
  - `tmp-c13/r2-6-4/resultado-correcao.json`
  - `tmp-c13/r2-6-4/resultado-historico-reexecucao.json`
- **Procedimentos executados:** inspeção estática, coleta CDP, comparação com oráculo independente, reexecução do núcleo histórico, reexecução do núcleo corrigido, verificação de hash e comparação cenário a cenário.
- **Limitações metodológicas:** o oráculo é independente do código do núcleo, mas foi escrito pelo mesmo executor; não houve auditoria independente nem execução em CI/Linux.

---

## 4. Inventário de evidências

| ID | Artefato | Finalidade | SHA-256 |
|---|---|---|---|
| E-01 | `tmp-c13/r2-6-2/fixture.html` | 10 cenários isolados de cascata | `385d364bc624799af8ead55ba15514101b2e3e13770237146d7fbb7a8654e024` |
| E-02 | `tmp-c13/r2-6-2/matriz.json` | esperado independente e critérios | `e7e7142c08c906e7aafb9b70f3694786b6153e0892d2d67252e7a819614ef5e5` |
| E-03 | `tmp-c13/r2-6-2/validacao-r2-6-3.cjs` | validador CDP com `--core`/`--out` | `6f10c234cdcae20ac830998d3fec5416ea0847b0745800fc461567d9aeff7ce5` |
| E-04 | núcleo histórico R2.5.6 | baseline preservado | `43b0039e491096fa5497ec6bc4c6e2f29efe86665491b51d741ed0b4b832f006` |
| E-05 | núcleo corrigido R2.6 | correção mínima versionada | `a373707ae029b0c7465d66959f9ae02aea36c8486953ecedc1fb6c2245232a70` |
| E-06 | `tmp-c13/r2-6-4/resultado-correcao.json` | execução com núcleo corrigido | arquivo `02bc71e…`; hash interno `27ea2e549144fde8c3582140c382f3c434299441deb1c6e8d7cfb6eaae41b878` |
| E-07 | `tmp-c13/r2-6-4/resultado-historico-reexecucao.json` | baseline no mesmo ambiente | arquivo `a3fdb4e…`; hash interno `f0f0571036fb7e5bcd13301ab154161e9ac98a87acd092a71c5737f6eba858a7` |

O hash interno difere do SHA do arquivo porque, por construção, exclui `meta.hash` e `verification`. Ambos os arquivos têm `verification.hashMatches = true`.

---

## 5. Achados

### A-01 — Correção técnica eficaz nos 10 cenários
- **Gravidade:** INFORMATIVO · **Confiança:** ALTA.
- **Local:** `c4-v05-b-r2-6-core.cjs`, `getWinningRule()`.
- **Problema observado:** não é defeito; é o resultado da correção.
- **Evidência:** C04, C05, C06, C08 e C10 passaram de FAIL para PASS; total 10/10.
- **Impacto:** as cinco lacunas confirmadas em R2.6.3 deixaram de ocorrer na matriz.
- **Classificação:** fato observado.

### A-02 — Harness histórico ainda não consome o novo núcleo
- **Gravidade:** MÉDIO · **Confiança:** ALTA.
- **Local:** `docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7.cjs`.
- **Problema observado:** o harness aprovado continua importando `r2-5-6-core.cjs`.
- **Impacto:** a correção existe como núcleo versionado candidato; o fluxo histórico não foi alterado.
- **Classificação:** ausência de promoção, não defeito do novo núcleo.

### A-03 — Regressão da suíte histórica não executada com o novo núcleo
- **Gravidade:** MÉDIO · **Confiança:** ALTA.
- **Problema observado:** apenas a matriz de 10 cenários foi reexecutada.
- **Impacto:** não há evidência de que os 393 registros R2.5.7 permaneçam estáveis com o novo núcleo.
- **Status do teste:** **NOT RUN**.

### A-04 — Escopo limitado da matriz
- **Gravidade:** MÉDIO · **Confiança:** ALTA.
- **Problema observado:** não cobertos `@layer`, origem user-agent, `!important` inline, animações, transições, `color-mix()`, shorthand complexo, `:after`, Shadow DOM.
- **Impacto:** o 10/10 não prova correção geral da cascata.

### A-05 — Comportamento CDP dependente da versão do Chromium
- **Gravidade:** MÉDIO · **Confiança:** ALTA.
- **Problema observado:** `CSS.getMatchedStylesForNode({ pseudoElement })` retornou regras do owner; o oráculo usou `pseudoElements[].matches` e `getComputedStyle(el, '::before')`.
- **Impacto:** necesario confirmar em Chromium do CI/Linux antes de generalizar.

### A-06 — Divergência documental da C.4 ainda não reconciliada
- **Gravidade:** BAIXO · **Confiança:** ALTA.
- **Problema observado:** relatório/Notion da coleta `--accent` chamaram 5.724 candidatos de “regras vencedoras”.
- **Impacto:** superestima o que a coleta C.4 comprovou.
- **Correção recomendada:** redação controlada, sem alterar o artefato original.

---

## 6. Testes e verificações

| ID | Objetivo | Resultado observado | Status |
|---|---|---|---|
| V-01 | Sintaxe do novo núcleo | `node --check` OK | PASS |
| V-02 | Preservação do núcleo histórico | SHA inalterado `43b0039e…` | PASS |
| V-03 | Reexecução do núcleo histórico | 5 PASS / 5 FAIL / 0 BLOCKED | PASS |
| V-04 | Reexecução do núcleo corrigido | 10 PASS / 0 FAIL / 0 BLOCKED | PASS |
| V-05 | Comparação antes/depois | 5 FAIL antigos corrigidos; 0 regressões; 0 falhas novas | PASS |
| V-06 | Cor computada pelo navegador | 10/10 conforme esperado | PASS |
| V-07 | `resolvedValueNucleo` | 10/10 conforme cor esperada | PASS |
| V-08 | Erros CDP/console/exceções | 0 / 0 / 0 em ambas as execuções | PASS |
| V-09 | Suíte R2.5.7 com novo núcleo | não executada | **NOT RUN** |
| V-10 | CI/Linux com novo núcleo | não executado | **NOT RUN** |
| V-11 | Revisão independente | não executada | **NOT RUN** |

---

## 7. Consistência e integridade

- **Contagens:** derivadas dos JSONs finais. Corrigido: `total=10, PASS=10, FAIL=0, BLOCKED=0, NOT_RUN=0`. Histórico: `total=10, PASS=5, FAIL=5, BLOCKED=0, NOT_RUN=0`.
- **Divergências:**
  - `matriz.json` registra `head=7c7a898…`, pois foi escrita antes do commit `a0aaeb3`; a execução ocorreu em `6781176…`, com fixture e matriz idênticas.
  - SHA interno dos resultados ≠ SHA do arquivo por exclusão intencional de `meta.hash`/`verification`.
  - Relatório C.4 e Notion usam “regras vencedoras” onde os dados provam apenas candidatos.
- **Hashes:** ver tabela de evidências; todos os hashes internos foram recalculados com `hashMatches = true`.
- **Logs:** `tmp-c13/r2-6-4/http.log` e `chromium.log` não registraram falhas; não há erros de console/exceções nos JSONs.
- **Verificações independentes:** nenhuma realizada até este relatório.

---

## 8. Limitações e incertezas

- **Itens não verificados:** R2.7, V32, CSS de produção, consolidação de tokens, mudanças financeiras.
- **Testes bloqueados:** nenhum.
- **Testes não executados:** V-09, V-10, V-11.
- **Incertezas:** equivalência do comportamento CDP em Chromium do CI/Linux; compatibilidade do novo `resolvedValue` com consumidores do harness; aceite de escopo para `@layer` e origens não testadas.
- **Dependências externas:** nenhuma; a fixture não carrega recursos externos.

---

## 9. Veredito

- **APROVADA / REPROVADA / INCONCLUSIVA:** **INCONCLUSIVA** para declarar o Gate R2.6 suficiente. A correção local do núcleo está **APROVADA COM RESSALVAS** para os 10 cenários.
- **Fundamentação:** as cinco falhas confirmadas em R2.6.3 não se repetiram; 10/10 cenários passaram com o núcleo corrigido; 0 regressões e 0 falhas novas. Porém, não há auditoria independente, regressão R2.5.7, validação em CI nem promoção do novo núcleo ao harness.
- **Critérios atendidos:** R2.6.1, R2.6.2, R2.6.3; correção mínima implementada; comparação antes/depois rastreável.
- **Critérios não atendidos:** revisão independente; regressão da suíte histórica; validação em CI/Linux; reconciliação documental da C.4; aceite formal e versionação.
- **Condições para nova avaliação:** executar V-09 a V-11, corrigir A-06, decidir a promoção do núcleo e registrar aceite no Notion.

---

## 10. Próximos passos

- **Correções necessárias:** nenhuma nova correção identificada no núcleo; apenas decisão de promoção e reconciliação documental.
- **Evidências adicionais:** suíte R2.5.7 com novo núcleo, execução no CI/Linux, reprodução por auditor independente.
- **Próxima etapa autorizada:** nenhuma automática. Depende de autorização explícita para promover o núcleo, rodar a regressão histórica e/ou corrigir a documentação C.4.

---

## Histórico de uso

| Data | Auditoria | Commit-base | Veredito | Responsável |
|---|---|---|---|---|
| 21/11/2026 | R2.6.4 — mecanismo de regra vencedora | `6781176` | Inconclusiva para gate; correção aprovada com ressalvas | opencode (executor, não auditor independente) |
