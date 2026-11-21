# R2.6.1 — Inspeção do mecanismo atual de regra vencedora

**Data:** 21/11/2026 · **Branch:** `feat/app-layout-redesign` · **Commit-base:** `c04b6d7838201785442bd3e361f00e1d7697f7f1`.
**Natureza:** auditoria somente leitura. Nenhum arquivo de produção, harness, documento versionado, commit ou push foi alterado.

## 1. Escopo

Verificar `getWinningRule()` e `captureWinningRules()` no núcleo compartilhado e no harness C.4 da branch atual, identificando: origens de declaração capturadas, tratamento de `inlineStyle`, especificidade, ordem, `!important`, cobertura herdada e o que já foi efetivamente testado nas etapas R2.5.

Fora de escopo: R2.6.2 (matriz de fixtures), R2.6.3 (validação CDP), R2.6.4 (relatório final), correção do harness, R2.7, CSS de produção.

## 2. Artefatos inspecionados

| Artefato | SHA-256 | Função |
|---|---|---|
| `docs/auditorias/c4-v05-b/evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs` | `43b0039e491096fa5497ec6bc4c6e2f29efe86665491b51d741ed0b4b832f006` | Núcleo compartilhado vigente. |
| `e2e/c4/original/docs/auditorias/c4-v05-b/evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs` | `43b0039e...` | Cópia preservada; idêntica. |
| `docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7.cjs` | `a35db1d585de0a46f2919a4c6b4e7b852b7129fdc1b8c232778865aca2b9b999` | Harness histórico aprovado; consome o núcleo. |
| `e2e/c4/original/docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7.cjs` | `a35db1d...` | Cópia preservada; idêntica. |
| `e2e/c4/playwright-cdp-bridge.spec.js` | — | Consome `createCDPAuditCore` e cruza 2 propriedades com CDP/computedStyle. |
| `tmp-c13/c4-accent-coleta.cjs` | — | Script da coleta C.4; implementação paralela e mais fraca. |
| `tmp-c13/c4-accent-245a5a0/resultado.json` | `5cd35465...` | Evidência da coleta C.4. |

O núcleo R2.5.1 a R2.5.6 não sofreu alteração funcional em `getWinningRule`/`captureWinningRules`: o `diff` entre as versões mostra apenas diferenças de pontuação e formatação. As correções R25-01…R25-09 incidiram sobre sampleId, visibilidade, geometria, atributos e erros CDP, não sobre cascata.

## 3. Como o mecanismo funciona hoje

1. `getWinningRule(nodeId, property)` chama somente `CSS.getMatchedStylesForNode({ nodeId })`.
2. Percorre `matchedCSSRules` e lê `rule.style.cssProperties`; há fallback para `property(j)/value(j)`.
3. Para cada declaração com o nome da propriedade, cria um candidato com `value`, `important`, `selectorText`, `origin`, `styleSheetId`, `disabled` e `parsedOk`.
4. **A cada candidato habilitado, parseado e com valor, `winningDeclaration` é sobrescrito.** Não há comparação de especificidade, origem, camada, ordem de folha, `!important` ou inline. O “vencedor” é, portanto, o último candidato na ordem do array `matchedCSSRules`.
5. `computedValue` recebe `winningDeclaration.value`, ou seja, o **valor declarado**, não o valor computado pelo navegador. Isso está codificado em `playwright-cdp-bridge.spec.js:1187`.
6. `captureWinningRules(c, nodeId)` repete a leitura para 10 propriedades: `color`, `background-color`, quatro bordas, `outline-color`, `fill` e `stroke`. O parâmetro `c` não é utilizado pela função.

## 4. Mapa de cobertura

| Dimensão | Cobertura atual | Evidência | Estado |
|---|---|---|---|
| Declarações de stylesheet | Sim, via `matchedCSSRules` | core:591-643 | COBERTO |
| Leitura `cssProperties` e fallback `property(j)` | Sim | core:609-622 | COBERTO |
| Filtragem `disabled`/`parsedOk` | Sim | core:639 | COBERTO |
| Registro de seletor, origem e `styleSheetId` | Sim, como metadado | core:627-637 | COBERTO |
| `!important` | Flag registrada, **não usada na escolha** | core:630,639-641 | PARCIAL |
| Especificidade | Não calculada; depende da ordem do array | core:605-642 | NÃO COBERTO |
| Ordem/source order | Apenas ordem de iteração do CDP | core:605 | PARCIAL |
| `inlineStyle`/`attributesStyle` | Ignorados; sem `getInlineStylesForNode` | core:591; docs METODOLOGIA-R2-5.md:204 | NÃO COBERTO |
| Herança | Sem leitura de `inherited` nem ancestral de estilo | core:591; teste R2.4 A8 só aceita status | NÃO COBERTO |
| Pseudoelementos `::before`/`::after` | Sem parâmetro de pseudoelemento | assinatura core:589 | NÃO COBERTO |
| Origem/CAS (user-agent/user/layers) | `origin` registrado, não aplicado | core:632 | PARCIAL |
| Associação de nó inválida | Sim | core:674-677; teste R2.5.7 Y4 | COBERTO |
| Erros CDP | Sim | core:662-670 | COBERTO |
| Confrontação com `computedStyle` | 2 propriedades em fixture determinística | bridge spec:1145-1199 | PARCIAL |

O teste R2.4 A5 verifica a flag `important` apenas quando já existe uma declaração vencedora; A6 verifica candidatos para especificidade sem afirmar qual regra devia vencer; A7 (inline) e A8 (héritage) aceitam `captured` **ou** `no-matching-declaration`, portanto não provam captura correta. O bridge spec cobre apenas `background-color` e `color` de uma fixture com regras determinísticas e não disputa real entre `!important`, inline e diferentes origens.

## 5. Achados

### R2.6.1-01 — Escolha do vencedor por ordem de array
- **Gravidade:** MÉDIO · **Confiança:** ALTA · **Classificação:** risco potencial (confirmação depende de R2.6.3).
- **Local:** `c4-v05-b-r2-5-6-core.cjs:602-642`.
- **Evidência:** `winningDeclaration` é sobrescrito sem comparator de cascata.
- **Impacto:** `winningDeclaration` pode divergir da declaração efetivamente aplicada; isso invalida a interpretação do campo como prova de cascata real.
- **Encerramento:** matriz R2.6.2/3 com regras concorrentes, ordem invertida, origens e `!important`, confrontando com `getComputedStyle`.

### R2.6.1-02 — `!important` não participa da decisão
- **Gravidade:** MÉDIO · **Confiança:** ALTA · **Classificação:** defeito de critério no mecanismo (impacto prático ainda não medido).
- **Local:** `core:630,639-641`.
- **Evidência:** `important` é lido e registrado, mas a atribuição do vencedor não o considera.
- **Impacto:** uma declaração posterior sem `!important` pode sobrescrever uma anterior com `!important` no registro.
- **Encerramento:** teste controlado com `!important` vencendo apesar de ordem/especificidade contrárias.

### R2.6.1-03 — Nenhuma captura de inline/attributes style
- **Gravidade:** MÉDIO · **Confiança:** ALTA.
- **Local:** `core:591`, documentado como limitação em `METODOLOGIA-R2-5.md:204`.
- **Evidência:** apenas `matchedCSSRules`; nenhum `CSS.getInlineStylesForNode`.
- **Impacto:** estilos inline não podem ser apontados como vencedores; o código pode reportar `no-matching-declaration` mesmo havendo estilo aplicado.
- **Encerramento:** R2.6.3 confrontar `inlineStyle` com valor computado.

### R2.6.1-04 — Cobertura herdade ausente
- **Gravidade:** MÉDIO · **Confiança:** ALTA.
- **Local:** `core:589-672`; teste R2.4 A8.
- **Evidência:** não há uso do array `inherited` do CDP nem resolução de propriedade herdada no ancestral.
- **Impacto:** propriedades herdadas não têm regra vencedora rastreável no nó examinado.
- **Encerramento:** R2.6.2 incluir herança e variáveis encadeadas.

### R2.6.1-05 — Sem suporte a pseudoelementos
- **Gravidade:** BAIXO · **Confiança:** ALTA.
- **Local:** assinatura `getWinningRule(nodeId, property)` em `core:589`.
- **Evidência:** nenhum parâmetro `pseudoElement`; `captureWinningRules` não varre `::before`/`::after`.
- **Impacto:** a captura de regra vencedora não cobre consumidores de pseudoelemento, embora a detecção de consumo de `--accent` os inclua.
- **Encerramento:** decidir em R2.6.2 se pseudoelementos entram no comparator.

### R2.6.1-06 — `computedValue` é valor declarado
- **Gravidade:** BAIXO · **Confiança:** ALTA.
- **Local:** `core:648`; `playwright-cdp-bridge.spec.js:1187`.
- **Evidência:** o próprio teste afirma `computedValue === winningDeclaration.value`; `var(--accent)` é resolvido à parte no bridge.
- **Impacto:** risco de interpretação errada do campo como valor computado final; não é uma falha funcional, pois o contrato atual já é esse.
- **Encerramento:** corrigir nomenclatura/documentação somente se aprovado.

### R2.6.1-07 — Evidência C.4 usa implementação paralela e superestima o que capturou
- **Gravidade:** MÉDIO · **Confiança:** ALTA.
- **Local:** `tmp-c13/c4-accent-coleta.cjs:113-137`; `tmp-c13/c4-accent-245a5a0/resultado.json`.
- **Evidência:** a função local filtra candidatos com `accent`/`var(--` e retorna `captureStatus: 'captured'` se qualquer candidato existe; não produz `winningDeclaration`. Os 7.388 registros têm apenas `candidates` e `captureStatus`.
- **Impacto:** a frase “regras vencedoras capturadas em 5.724/7.388 (77,5%)”, presente no relatório C.4 e no Notion, significa na prática “candidatos encontrados”; não comprova vencedor de cascata.
- **Encerramento:** corrigir a redação e, se necessário, reprocessar a coleta com o núcleo aprovado após R2.6.3. Não alterar o artefato original.

### R2.6.1-08 — `origin` registrado, mas sem precedência
- **Gravidade:** MÉDIO · **Confiança:** ALTA.
- **Local:** `core:632`.
- **Evidência:** `origin` é salvo no candidato, mas não influencia a escolha.
- **Impacto:** regras de user-agent/user/autor/layers não são ordenadas por precedência real.
- **Encerramento:** R2.6.3 cobrir origem e, se aplicável, layered cascade.

## 6. O que já está correto e deve ser preservado

- Leitura de estilos de stylesheet, inclusive `cssProperties` e fallback legado.
- Registro de candidatos com seletor, origem, `styleSheetId`, `important`, `disabled` e `parsedOk`.
- Filtragem de declarações desabilitadas/ilegíveis.
- Falha explícita quando `nodeId` não existe.
- Registro estruturado de erros CDP.
- Lista de 10 propriedades em `captureWinningRules`.
- Cópia histórica intacta: núcleo e harness em `docs/` e `e2e/c4/original/` têm hashes idênticos.
- Nenhuma duplicação deve ser criada: a correção deve ocorrer no núcleo compartilhado, não em um novo módulo.

## 7. Verificações executadas

| ID | Objetivo | Status | Evidência |
|---|---|---|---|
| R2.6.1-V1 | Localizar definições e consumidores do núcleo | PASS | `grep` em `docs/`, `e2e/`, `tmp-c13/` |
| R2.6.1-V2 | Confirmar integridade das cópias históricas | PASS | SHA-256 idêntico |
| R2.6.1-V3 | Comparar R2.5.1–R2.5.6 | PASS | `diff` sem mudança funcional |
| R2.6.1-V4 | Confrontardocumentação de limitações | PASS | `METODOLOGIA-R2-5.md:201-208` |
| R2.6.1-V5 | Avaliar testes R2.4/R2.5.7/bridge | PASS | A2–A10; Y4; bridge:1145-1199 |
| R2.6.1-V6 | Reproduzir fixtures competindo regras | NOT RUN | Pertence a R2.6.2/R2.6.3 |
| R2.6.1-V7 | Corrigir harness | NOT RUN | Condicionado a R2.6.4 + aprovação |

## 8. Veredito

**R2.6.1 — CONCLUÍDA como inspeção.** O mecanismo atual é um extrator de declarações de stylesheet com escolha por última ocorrência, não um resolvedor de cascata. Há lacunas confirmadas por código em `!important`, inline, herança, pseudoelementos, origem/especificidade e semântica de `computedValue`. O impacto prático dessas lacunas permanece **INCONCLUSIVO até R2.6.3**.

**Gate R2.6 permanece ABERTO.** Nenhuma modificação de harness, CSS de produção, commit ou push foi executada. O próximo passo autorizado é R2.6.2 — matriz de fixtures controladas.
