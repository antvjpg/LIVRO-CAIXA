# R266-AUD-B — Relatório de correção complementar

## 1. Baseline e estado inicial

- Repositório: `antvjpg/LIVRO-CAIXA`.
- Branch: `feat/app-layout-redesign`.
- HEAD inicial e final: `cd526d3474774166bc0f61423646452de76303b3`.
- Árvore limpa no início; todas as alterações abaixo permanecem locais.
- Commit R266-AUD publicado: `cd526d3`, com 7 arquivos, 2905 inserções e 1 remoção.
- CI remoto real por SHA:
  - C.4 — R2.6: run `45086424795`, tentativa 1, `success`, SHA `cd526d3…`.
  - C.O.D.E. E2E: run `45086424842`, tentativa 1, `success`, SHA `cd526d3…`.
- Nenhum resultado de SHA anterior foi atribuído ao SHA `cd526d3`. A execução remoto do working tree de R266-AUD-B não existe porque commit/push não foram autorizados.

## 2. Diagnóstico das ressalvas

| Ressalva | Diagnóstico observado |
|---|---|
| B-01 | `CORE_266` apontava para o núcleo histórico; `CORE_R266AUD` era executado apenas em etapa adicional. O resumo não identificava qual núcleo cada etapa usava, permitindo confundir aprovação do candidato com aprovação do fluxo principal. |
| B-02 | `inheritanceProvider()` comparava `nodeId`, `parentNodeId` e `backendNodeId` em um mesmo `Set`, tratando namespaces CDP distintos como identificadores equivalentes. `parentNodeId` também era indevidamente promovido a identidade do ancestral. |
| B-03 | A checagem de `specificityStatus` percorria todos os candidatos, incluindo ancestrais distantes que não participavam da decisão. Isso podia transformar incerteza irrelevante em falha global. |
| B-04 | `cascadeLimitations()` usava ausência de metadado como ausência do mecanismo e sempre devolvia vencedor confiável, mesmo quando layers, animações, escopo, encapsulamento ou regras condicionais não podiam ser verificados. |

## 3. Decisão arquitetural (B-01)

A arquitetura anterior era de **candidato isolado pré-promoção**, conforme `RELATORIO-R266-AUD.md`. Entretanto, o objetivo desta etapa exige demonstrar uso efetivo no fluxo principal. A decisão adotada foi:

- integrar o núcleo corrigido `c4-v05-b-r2-6-6-r266-aud-b-core.cjs` à etapa principal R2.6.6;
- preservar o núcleo histórico `8a6e08d3…` em uma etapa separada de comparação;
- manter a linhagem R266-AUD original intacta;
- publicar no resumo um mapa `nucleos` com caminho e SHA-256 de cada etapa;
- fixar SHAs esperados no runner e falhar se o fluxo principal reverter ao núcleo antigo.

Assim, a matriz principal R2.6.6 e a matriz histórica são inequívocas e têm artefatos distintos.

## 4. Arquivos alterados e criados

### Criados

- `docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud-b/c4-v05-b-r2-6-6-r266-aud-b-core.cjs`
- `tmp-c13/r2-6-6-r266-aud-b/casos.json`
- `tmp-c13/r2-6-6-r266-aud-b/fixture.html`
- `tmp-c13/r2-6-6-r266-aud-b/teste-r266-aud-b.cjs`
- `tmp-c13/r2-6-6-r266-aud-b/validacao-r266-aud-b.cjs`
- `tmp-c13/r2-6-6-r266-aud-b/resultados/` com evidências atuais e preservadas de `cd526d3`
- `tmp-c13/r2-6-6-r266-aud-b/RELATORIO-R266-AUD-B.md`

### Modificado

- `e2e/scripts/run-c4-r26.cjs`: integração do núcleo B, etapa histórica, pins SHA, mapa de núcleos, gates e etapa R266-AUD-B.

### Preservados

- Núcleos R2.6.6 histórico, A-01, A-01B e R266-AUD.
- Validadores e critérios A-01/A-01B, A-02/A-02B e A-03/A-03B.
- Evidências de `cd526d3`, copiadas para `resultados/`.
- `V32` como `BLOCKED`.

## 5. Correções implementadas

### B-01

- Etapa principal R2.6.6 agora executa `VALIDATOR_266 --core=CORE_R266AUDB`.
- Gate falha se `CORE_266` e `CORE_R266AUDB` forem o mesmo arquivo.
- Gate falha se o SHA de qualquer núcleo pinado mudar.
- Gate falha se `r2-6-6-matriz.json` não registrar `meta.nucleoSha256` igual ao núcleo B.
- Etapa histórica executa o validador com `CORE_266_HISTORICO` e grava `r2-6-6-historico-matriz.json`.
- `summary.nucleos` registra caminho e SHA de r26, r265, r266, r266Histórico, a01, a01b, r266aud e r266audb.

### B-02

- `normalizeCdpIdentity()` agrupa identificadores por `(namespace, papel)`.
- `DOM.NodeId`, `DOM.BackendNodeId`, `Runtime.RemoteObjectId`, `CSS.RuleId` e `CSS.StyleSheetId` são preservados em campos separados.
- `parentNodeId` é relação parental, nunca identidade do provider.
- Igualdade numérica entre namespaces diferentes não corrobora nem contradiz.
- Conflito real só é declarado entre fontes equivalentes do mesmo namespace e papel.
- Sem `DOM.NodeId` confirmado, o resultado é `inconclusivo` com `orderHint='cdp-ordem'`.
- `winnerConfidence` é rebaixado para `condicionado` quando a identidade é inconclusiva.

### B-03

- O conjunto de decisão é calculado antes dos gates:
  - pseudo-elemento;
  - declaração própria;
  - primeiro ancestral herdado com declaração.
- Somente esse conjunto é validado e ordenado.
- Candidatos fora do conjunto aparecem em `ignorados` com motivo.
- Ancestral distante com metadado ruim não invalida vencedor sustentado por nível relevante.
- Incerteza no grupo relevante continua produzindo `specificity-insufficient` ou `inheritance-insufficient`.

### B-04

- `avaliarLimitacoes()` produz, para cada mecanismo, `sinal`, `verificacao` e `fontes`.
- Ausência de sinal não é declarada ausência do mecanismo.
- Verificações `ausente-confiavel`, `confirmado` e `indisponivel` são distinguidas.
- `winnerConfidence` é `confiavel` somente quando todos os mecanismos são verificados como ausentes.
- Sinal de layer, scoping, regra condicional, animação/transição ou encapsulamento rebaixa a confiança.
- Divergência entre valor declarado e computado com sinal de animação gera diagnóstico explícito.

## 6. Testes unitários

Comando:

```sh
node e2e/scripts/run-c4-r26.cjs
```

Resultado do módulo unitário: `24 PASS / 0 FAIL`.

Cobertura:

- N01–N10: namespaces CDP, colisão numérica, conflito interno, campos ausentes e tipos inválidos.
- D01–D06: conjunto de decisão, ancestrais relevantes e irrelevantes, pseudo-elemento.
- L01–L06: layers, evidência explícita de ausência, animação, API indisponível, scoping e regras condicionais.
- P01–P02: parser removido, índice estrito e proveniência USER.

O artefato registra `coreSha256` e o runner valida esse valor contra o pino do núcleo B.

## 7. Testes Chromium

- 6 cenários reais reaproveitados de H1–H6.
- 1 cenário sintético de metadado sem namespace identificável.
- Resultado: `7 PASS / 0 FAIL / 0 BLOCKED`.
- Oráculos confrontados: núcleo, `CSS.getComputedStyleForNode()` e `getComputedStyle()` via `Runtime.callFunctionOn()`.
- `erros.cdp`, `erros.console` e `erros.excecoes`: vazios.
- Cada caso registra `identityStatus`, `winnerConfidence`, `decisionSet`, `ignorados` e os cinco mecanismos de cascata.
- Cenários reais com CDP sem `nodeId` são marcados como `inconclusivo` e `condicionado`, não como aprovação plena.

## 8. Testes de integração

| Verificação | Resultado |
|---|---|
| Core principal R2.6.6 | `f92d7016…`, núcleo B |
| Core histórico | `8a6e08d3…`, etapa separada |
| Pin anti-reversão | PASS |
| Mapa `nucleos` no summary | PASS |
| Metadado do núcleo na matriz principal | PASS |
| Metadado do núcleo na matriz histórica | PASS |
| R266-AUD-B unitário/navegador | `24/24` e `7/7` |
| `problems` | `[]` |
| `verdict` | `PASS` |

## 9. Regressão histórica

| Etapa | Resultado |
|---|---|
| Matriz original | `10 PASS / 0 FAIL / 0 BLOCKED` |
| R2.6.5 | `10 PASS / 0 FAIL / 3 BLOCKED` históricos |
| R2.6.6 com núcleo B | `11 PASS / 0 FAIL / 0 BLOCKED` |
| R2.6.6 histórico | `11 PASS / 0 FAIL / 0 BLOCKED` |
| A-01/A-01B | `11/11` |
| A-02/A-02B | `11/11` navegador; `15/15` e `20/20` unitários |
| A-03/A-03B | `12/12` unitários e `12/12` navegador |
| R266-AUD original | `25/25` unitário; `7/7` navegador |
| Regressão R2.5.7 | `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, 0 divergências |
| C.O.D.E. local | NOT RUN — Playwright/ambiente remoto |
| C.O.D.E. remoto | baseline `cd526d3`: run `45086424842`, `success`, 72 PASS / 0 FAIL |

## 10. Estado do CI remoto

- C.4 no SHA `cd526d3`: `45086424795`, `success`.
- C.O.D.E. no SHA `cd526d3`: `45086424842`, `success`.
- Não existe CI remoto para o working tree de R266-AUD-B.
- Não foi feito commit, push, merge, release ou publicação.
- A validação remoto do código B depende de publicação autorizada pelo responsável.

## 11. Evidências e hashes

| Artefato | SHA-256 |
|---|---|
| núcleo B | `f92d7016de979d30c34083f8cb320f9e0f74f4ab7d9916513db467e7c1d43926` |
| `casos.json` | `eef93bfe563e39dd09e62eaea576ae36e60180f6012b3d86a5ffa5a952d835f3` |
| `fixture.html` | `eb522a92c32178530b76b1b8baf9e52658adc841ba9601384fd1977edbd8dc51` |
| `teste-r266-aud-b.cjs` | `7b912b9180c92b88c22b2e41fa0eee23577ae08e6e938db4b2cad9bb70ffa9f3` |
| `validacao-r266-aud-b.cjs` | `bf51bea88fd33c941a7891457ac0e941ee73c33f0c5241802d5e980b992b1d00` |
| `run-c4-r26.cjs` | `acfaff2cfdf67fdd3ec4790aa0a30186f612b7a7ded05154aac56ae78a67751b` |
| `r2-6-r266-aud-b-unitario.json` | `579e7c42205ad2dfcfcce1f2dddd4d59da083c2fc62296e676a6db07919e9f99` |
| `r2-6-r266-aud-b-matriz.json` | `8e43cd6ae57128350aab00f71dbce64b03b2a06575d339fb2e30daf787c41a18` |
| `r2-6-6-historico-matriz.json` | `61e7832af7d1178be1f3121aea4a36eee57b0d4ccb5aaf4462a36e04879fb7cd` |
| `r2-6-6-matriz.json` | `2837d892650e486fa899132b60bae0aff81b54dc625be913a2fb602176767b19` |
| `r2-6-ci-summary.json` | `2eaa9f648948cacaa48af19a81600ad595e07c769cf8ded5d76582f552445912` |

Cópias dos artefatos de `cd526d3` e da execução atual ficaram em `tmp-c13/r2-6-6-r266-aud-b/resultados/`.

## 12. Atualizações no Notion

Serão atualizadas, sem apagar histórico:

- Plano de correção R2.6 — `41fcf6c0-c0bd-8112-8069-fbbfaf1b4d01`.
- C.O.D.E. — Histórico técnico, auditorias e execuções — `41ccf6c0-c0bd-8144-b0bd-fb3ccb32241a`.

Cada seção conterá callout no topo com as páginas relacionadas.

## 13. Parecer e pendências

Verificação cruzada independente: **APROVADA COM RESSALVAS**, sem bloqueio funcional remanescente após a correção das lacunas de rastreabilidade apontadas.

Ressalvas remanescentes:

- integração ainda não versionada; CI limpo depende de commit/push autorizado;
- cobertura adicional opcional para assertar diretamente refs preservados em D05 e `verificacao='confirmado'` em L01;
- execução remota das alterações locais ainda não realizada;
- auditoria independente final da R2.6.6 permanece como gate separado;
- R2.6.6 continua sem promoção oficial;
- `V32` permanece `BLOCKED`.
