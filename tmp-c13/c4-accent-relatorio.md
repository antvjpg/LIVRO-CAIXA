# C.4 — Coleta completa de consumidores de `--accent`

**Data:** 21/11/2026 · **Branch:** `feat/app-layout-redesign` · **HEAD coletado:** `245a5a007d665999af0c38970c906eed79c04d9b`.
**Natureza:** gate específico da C.4, somente leitura. Nenhum arquivo de produção, CSS, autenticação ou pacote histórico C.4 foi alterado.

## 1. Escopo e definição

Foi mantida a **definição histórica** de consumidor de `--accent` para preservar comparabilidade: propriedades computadas que correspondem **exatamente** ao valor de `--accent` lido de `document.body` em `color`, `backgroundColor`, `borderTopColor`, `outlineColor`, pseudoelementos `::before`/`::after` e SVG (`fill`/`stroke`/`currentColor`). Tokens derivados (`--accent-to`, `--accent-rgb`, `--accent-foreground`, `--accent-subtle`, `--surface-accent`) **não** entram na população; `color-mix()`, gradientes e sombras continuam fora do critério exato.

**Fora de escopo:** R2.6, R2.7, V32, CSS de produção, alteração do harness histórico e publicação de artefatos.

## 2. Matriz executada

| Dimensão | Cobertura |
|---|---|
| Viewports | mobile 390×844 (DPR 1) e desktop 1440×900 |
| Temas | 5 claros + 5 escuros |
| Telas/painéis | 33 estados: 11 tabs + Drawer + 21 painéis |
| Estados amostrados | **660** = 2 viewports × 10 temas × 33 telas |
| Linhas de consumo | **7.388** |
| Skips | 0 |
| Erros de console / exceções | 0 / 0 |

Distribuição por viewport: mobile 4.800, desktop 2.588. Por modo: claro 4.006, escuro 3.382.

## 3. Resultado por propriedade

| Propriedade consumida | Ocorrências |
|---|---:|
| `color` | 5.654 |
| `backgroundColor` | 1.584 |
| `borderTopColor` | 130 |
| `outlineColor` | 20 |

Nenhum consumidor SVG exato foi encontrado no DOM atual. As telas com mais ocorrências foram `dash` (534), `caixa` (354), `panelInvest` (347), `panelNovo` (334), `panelPurchase` (327), `drawer` (326), `panelReceivable` (307) e `panelFiltros` (307).

## 4. Regras vencedoras

Foram capturadas declarações vencedoras candidatas em **5.724 / 7.388** registros (77,5%). Nos **1.664** restantes o CDP retornou `no-matching-declaration`; isso é consistente com a limitação histórica de que `CSS.getMatchedStylesForNode` não resolve plenamente herança, `color-mix()`, gradientes ou declarações inline. Esses casos são **INCONCLUSIVO** quanto à regra vencedora, não falha de consumo.

## 5. Integridade

- Diretório: `tmp-c13/c4-accent-245a5a0/`
- Artefato: `resultado.json` (15,84 MB)
- Script: `tmp-c13/c4-accent-coleta.cjs`
- Logs: `tmp-c13/c4-accent-http.log`, `tmp-c13/c4-accent-chromium.log`
- SHA-256 declarado e recalculado: `5cd3546547725a5d3e1f7370ce7ef62dad8c0062dd663cf2f632469544fb5fc6`
- `verification.hashMatches = true` com 7.388 linhas.

## 6. Comparação com o histórico

A última coleta completa registrada tinha 6.660 consumidores (R2.1+, com 12 SVG). A nova coleta tem 7.388. **Os números não são diretamente comparáveis**: o HEAD atual contém mudanças de D-01 a D-08 e C.0–C.3 (nova navegação, composição de Início, baseline visual), e a matriz cobre 33 estados no presente. A definição de consumidor, porém, é a mesma.

## 7. Veredito

| Critério | Estado |
|---|---|
| Coleta completa no HEAD atual | PASS |
| 660 estados coletados sem skip | PASS |
| 7.388 consumidores exatos registrados | PASS |
| Hash determinístico verificado | PASS |
| Metadados de branch/HEAD/ambiente | PASS |
| Captura de regra vencedora | PARCIAL (77,5%; restante INCONCLUSIVO) |
| Aprimoramento de `getWinningRule` | NOT RUN (R2.6, fora de escopo) |
| Metodologia WCAG | NOT RUN (R2.7, fora de escopo) |
| V32 / Shadow DOM | BLOCKED (fora de escopo) |
| CSS de produção | NÃO LIBERADO |

**Gate "coleta completa de `--accent`": PASS.** A macro C.4 permanece **PARTIAL / GATED**: este resultado não libera R2.6, R2.7, V32, correções de CSS nem publicação de novos artefatos no pacote histórico.

## 8. Limitações e próximos passos

- Recursos externos foram bloqueados; ícones via CDN não foram avaliados.
- A definição foi preservada; ampliar para tokens derivados exige nova rodada e novo critério.
- Próximos gates dependem de escopo e autorização próprios: R2.6 (cascata real/inline), R2.7 (WCAG), V32 (slot/simultaneidade) e auditoria independente do resultado.
- Nenhum commit/push foi feito para esta evidência.
