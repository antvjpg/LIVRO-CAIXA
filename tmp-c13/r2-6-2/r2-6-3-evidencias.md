# R2.6.3 — Validação CDP da cascata controlada

**Data:** 21/11/2026 · **Branch:** `feat/app-layout-redesign` · **HEAD durante a validação:** `a0aaeb3`. O campo `head` dentro de `matriz.json` permanece `7c7a898`, pois a matriz foi escrita antes do commit que a publicou; o conteúdo da fixture e da matriz é idêntico nos dois commits.
**Natureza:** execução controlada em Chromium headless + CDP. Nenhum harness, CSS de produção ou documento versionado foi alterado.

## 1. Objetivo

Confrontar `getWinningRule()` do núcleo C.4 com um oráculo independente montado diretamente de `CSS.getMatchedStylesForNode`, `CSS.getInlineStylesForNode`, `inherited` e `pseudoElements`, usando os 10 cenários da matriz R2.6.2.

## 2. Resultado consolidado

| Métrica | Valor |
|---|---:|
| Cenários executados | 10 |
| Oráculo independente PASS | 10/10 |
| Cor computada conforme esperado | 10/10 |
| Mecanismo do núcleo PASS | 5/10 |
| Mecanismo do núcleo FAIL | 5/10 |
| BLOCKED / NOT RUN | 0 / 0 |
| Erros CDP / console / exceções | 0 / 0 / 0 |
| SHA-256 do resultado | `db1647b0003430fb2badd66a8185fc62e8945beb977a2cbb1a6aa8102b2f84eb` |

`verification.hashMatches = true`.

## 3. Cenários

| ID | Cenário | Computado | Oráculo | Mecanismo |
|---|---|---|---|---|
| C01 | baseline | PASS | PASS | PASS |
| C02 | source-order | PASS | PASS | PASS |
| C03 | specificity-invertida | PASS | PASS | PASS |
| C04 | important-invertido | PASS | PASS | **FAIL** |
| C05 | inline-vs-stylesheet | PASS | PASS | **FAIL** |
| C06 | custom-property-inline | PASS | PASS | **FAIL** |
| C07 | inherit-explicito | PASS | PASS | PASS |
| C08 | herda-implicita | PASS | PASS | **FAIL** |
| C09 | variaveis-encadeadas | PASS | PASS | PASS |
| C10 | pseudoelemento | PASS | PASS | **FAIL** |

## 4. Falhas confirmadas do mecanismo

- **C04 — `!important`:** o esperado era `.r261-important` / `var(--accent)` / `important=true`. O núcleo retornou `#r261-important` / `rgb(17, 17, 17)` / `important=false`. Confirmado: a flag é lida, mas não ordena a cascata.
- **C05 — inline:** o esperado era a declaração inline `#FF0000`. O núcleo retornou a regra de stylesheet `#r261-inline` com `var(--accent)`. Confirmado: `inlineStyle` não é consultado.
- **C06 — custom property inline:** o esperado era `color: var(--inline-accent)` inline, resolvendo para `rgb(0, 0, 255)`. O núcleo retornou a regra de stylesheet com `rgb(17, 17, 17)`. Confirmado: propriedade customizada inline fora do escopo do mecanismo.
- **C08 — herança implícita:** o esperado era a declaração herdada de `.r261-parent-implicit`. O núcleo retornou `no-matching-declaration`. Confirmado: `inherited` não é consultado.
- **C10 — pseudoelemento:** o esperado era `#r261-pseudo::before` / `var(--accent)` / `::before`. O núcleo retornou a cor do elemento owner (`#r261-pseudo` / `rgb(17, 17, 17)` / sem pseudo). Confirmado: ausência de parâmetro de pseudoelemento.

## 5. PASS que não devem ser superinterpretados

- **C03:** o CDP devolveu `.r261-spec` antes de `button.r261-spec`; a última regra era justamente a de maior especificidade. O PASS ocorreu porque a ordem do array favoreceu o mecanismo de última declaração; ele **não** demonstra comparator de especificidade.
- **C02:** duas regras com o mesmo seletor; a ordem do array coincidiu com a ordem da folha. PASS válido apenas para source-order.
- **C07:** `color: inherit` é uma declaração própria; o núcleo acerta o vencedor, mas isso não prova suporte a herança implícita (ver C08).
- **C09:** `var(--chain-a)` permanece como valor declarado vencedor; a resolução da cadeia foi feita pelo navegador no `computedStyle`, não pelo núcleo.

## 6. Limitações e inconclusivos

- Nenhum caso ficou inconclusivo: todos os 10 oráculos confirmaram o esperado.
- `CSS.getMatchedStylesForNode` com `pseudoElement` retornou as regras do elemento owner; o oráculo usou `pseudoElements[].matches`, e o computed do pseudo via `getComputedStyle(el, '::before')`.
- `computedValue` do núcleo continua sendo o valor declarado, por contrato explícito no bridge histórico.
- A validação cobre apenas as propriedades e cenários da matriz; não avalia `@layer`, origem user-agent, `!important` em estilo inline nem transições/animações.
- A correção do núcleo não foi executada: depende de R2.6.4 e aprovação explícita.

## 7. Veredito

**R2.6.3 — EXECUTADA COM SUCESSO como validação.** Os dados são suficientes para a R2.6.4: 5 falhas reproduzíveis do mecanismo, 5 acertos parciais/favoráveis e 0 bloqueios.

O **Gate R2.6 permanece ABERTO**. Este resultado não autoriza alteração do harness nem de CSS de produção. Nenhuma alteração de código de produção, commit de harness, push ou deploy foi feita nesta etapa.
