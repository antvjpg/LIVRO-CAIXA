# RELATÓRIO TÉCNICO DE AUDITORIA — C6-INICIO-06

> Auditoria e correção pontual da cascata CSS da Início. Não é auditoria independente.

## 1. Identificação

- **Auditoria:** C6-INICIO-06 — cascata CSS da aba Início.
- **Base:** `bdfb965` (`feat/app-layout-redesign`).
- **Estado inicial:** árvore limpa, sincronizada com `origin/feat/app-layout-redesign`.
- **Data:** 2026-11-26.
- **Responsável:** OpenCode (validação interna).
- **Escopo:** `#balanceStrip`, cards da Início, `.balance-share`, canvas da evolução patrimonial, ordem de folhas e documentação relacionada.
- **Fora do escopo:** redesenho visual, novas abas, C6-INICIO-07/09, C.O.D.E. remoto.

## 2. Metodologia

1. Confirmação de HEAD/árvore.
2. Leitura das folhas `themes.css`, `base.css`, `components.css`, `layout.css`, `features.css`, `dashboard-chat.css` e da ordem em `index.html:34-42`.
3. Mapeamento estático de especificidade e ordem para R01/R02/R03 por exploração paralela.
4. Leitura dos `.md` relacionados para detectar informações desatualizadas.
5. Correção mínima: apenas remoção de declarações mortas/redundantes.
6. Validação CDP headless em 359/360/600/601/680/681/1024 px, temas claro/escuro e abas `inicio`/`caixa`.
7. `git diff --check`, `code:syntax`, `code:oracles`, `code:security`.

## 3. Achados e correções

### C06-R01 — conflito de breakpoint em `#balanceStrip`

**Observado:** `components.css` definia 1 coluna até 600 px; `layout.css` definia 3 colunas até 680 px e carrega depois. A regra de 1 coluna era inalcançável em qualquer aba. A regra específica `body[data-tab="inicio"] #balanceStrip` já garantia 3 colunas na Início.

**Correção:** removida a declaração morta e o comentário obsoleto em `style/components.css`:
```css
/* removido */
#balanceStrip{grid-template-columns:minmax(0, 1fr);}
```

**Preservado:** `base.css`, `layout.css:47-48`, `features.css:4530-4535` e todas as regras `.balance-strip`.

### C06-R02 — padding redundante nos cards da Início

**Observado:** `#viewInicio .inicio-card{padding:22px}` era sobrescrito por igual especificidade e ordem posterior:
```css
padding:18px 20px 20px;
```
aplicável aos três cards existentes.

**Correção:** removida apenas `padding:22px;` de `#viewInicio .inicio-card`.

**Preservado:** a declaração vencedora `features.css:4602` e as três classes de card.

### C06-R03 — regras repetidas

**Observado e removido:**
- `#balanceStrip .balance-share{font-size:10px;margin-top:2px;}` — totalmente morta.
- `#balanceStrip .balance-share{margin-top:8px;}` — totalmente morta.
- `body[data-tab="inicio"] #balanceStrip .balance-share{font-size:9px;}` dentro de `@media(max-width:680px)` — duplicata exata da regra incondicional.
- `main > .inicio-patrimony-evolution .patrimony-spark-box canvas{display:block;}` — duplicata da regra mais ampla `main > .inicio-patrimony-evolution canvas{display:block;}`.

**Preservado:** regras efetivas de `.balance-share`, incluindo a específica da Início e o fallback de `border-color` em modo escuro.

## 4. Evidências CDP após correção

Arquivos:
- `tmp-c13/c6-6/cascata-css.json`
- `tmp-c13/c6-6/cascata-share.json`
- `tmp-c13/c6-6/prints/*.png`

### 4.1 Colunas e espaçamento

| Viewport | Início (`columns` / `gap` / `margin-bottom`) | Caixa (`columns` / `gap`) |
|---|---|---|
| 359 | 3 tracks / 6px / 21px | 3 tracks / 9px |
| 360 | 3 tracks / 8px / 21px | 3 tracks / 9px |
| 600 | 3 tracks / 8px / 21px | 3 tracks / 9px |
| 601 | 3 tracks / 8px / 21px | 3 tracks / 9px |
| 680 | 3 tracks / 8px / 21px | 3 tracks / 9px |
| 681 | 3 tracks / 10px / 23px | 3 tracks / 12px |
| 1024 | 3 tracks / 10px / 23px | 3 tracks / 12px |

Sem overflow horizontal em nenhum caso.

### 4.2 Cards e canvas

- Saúde Financeira, Próximo Pagamento e Orçamentos: `padding: 18px 20px 20px` em todos os viewports.
- `#patrimonySparklineInicio`: `display:block` em todos os viewports.

### 4.3 `.balance-share` (sonda temporária via CDP)

| Contexto | Fonte | Valores observados |
|---|---|---|
| Início, claro/escuro, 390/600/681 | `body[data-tab="inicio"] #balanceStrip .balance-share` | `font-size:9px`, `margin-top:4px`, `padding:4px 6px`, `opacity:.9` |
| Caixa, claro, ≤680 | regra genérica | `font-size:9px`, `margin-top:4px`, `padding:2px 7px`, `opacity:.9` |
| Caixa, escuro, ≤680 | regra genérica + fallback | `border-color` com 30% do `--accent`; demais valores inalterados |

## 5. Documentação revisada

Atualizações pontuais aplicadas para evitar informação desatualizada:

- `docs/design-system/DOCUMENTACAO_VARIAVEIS_CSS.md` — grid da Início: 1 coluna ≤680 px, 2 colunas acima, 3 cards.
- `docs/design-system/ESPECIFICACAO-VISUAL.md` — critério `view-inicio` revisado (sem Resumo do Fluxo; Orçamentos incluído).
- `docs/arquitetura/navegacao/ESPECIFICACAO-NAVEGACAO.md` — indicador em px, BNI uniformizada, refs de arquivos/linhas e status parcial de ARIA.
- `README.md` — contagens 149 oracles, 94 garantias e 18 specs.
- `docs/README.md` — índice da C6-06; `NOTION_PHASE_B_CONTENT.md` marcado como histórico.
- Relatórios `c6-1`, `c6-3` e `c6-4`: notas de recorte histórico e SHAs finais para não confundir baseline com estado atual.
- `c6-5`: SHAs de implementação (`bdfb965`) e esclarecimento de que ARIA é estático; teclado/foco seguem em C6-09.

## 6. Validações

| Validação | Estado | Resultado |
|---|---|---|
| `git diff --check` | PASS | Sem erros. |
| `npm run code:syntax` | PASS | `SINTAXE: OK (0 bloco(s) inline de index.html + 31 arquivo(s) .js)`. |
| `npm run code:oracles` | PASS | 149/149. |
| `npm run code:security` | PASS | 94/94. |
| CDP — colunas/gaps/margens | PASS | Valores idênticos aos esperados em 7 viewports. |
| CDP — padding dos cards | PASS | `18px 20px 20px` em todos. |
| CDP — `.balance-share` | PASS | Início e Caixa preservados em claro/escuro. |
| CDP — canvas | PASS | `display:block`; sem overflow. |
| Playwright local | BLOCKED | `Unsupported platform: android`. |
| C.O.D.E. remoto | NOT RUN | Não autorizado. |
| Auditoria independente | NOT RUN | Aguardando revisão externa. |

## 7. Limitações

- CDP usou sessão local sem Firebase autenticado; `.balance-share` foi medido com sonda temporária.
- Não houve execução de suíte E2E local.
- Nenhuma declaração efetiva foi renomeada ou movida; apenas regras mortas/duplicadas foram removidas.

## 8. Veredito

As três ressalvas C06-R01/R02/R03 foram corrigidas com remoção mínima de CSS morto/redundante, sem alteração visual medida. A documentação relacionada foi atualizada. C6-INICIO-06 fica pronta para revisão; aceite final depende de C.O.D.E./revisão independente.

**Não foi feito commit, push, merge, release ou deploy.**
