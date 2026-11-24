# C6-INICIO-02 — Saúde Financeira em superfície única

## Estado

- Branch: `feat/app-layout-redesign`
- HEAD base: `f24154a1173841bde7695c627af7af3b730398ac`
- Alterações locais, **sem commit/push**.

## Arquivos alterados

- `js/20-dashboard.js` — substituído somente o bloco `if (inicioHealthHost)` dentro de `renderAdvancedDashboard()`.
- `style/features.css` — adicionado o bloco `C6-INICIO-02 — Saúde Financeira em superfície única` junto às regras de `#viewInicio`.

Nenhum outro arquivo de produção foi modificado. Visão Geral, Próximo Pagamento e Resumo do Fluxo permanecem com a estrutura atual.

## Validações executadas

| Verificação | Resultado |
|---|---|
| `node --check js/20-dashboard.js` | PASS |
| `git diff --check` | PASS |
| `npm run code:syntax` | PASS |
| `npm run code:oracles` | PASS — 149/149 |
| `npm run code:security` | PASS — 94/94 |
| Harness CDP 360/390/1280 × claro-1/escuro-1 | PASS — 6/6 cenários, 0 exceções JS |

## Matriz visual

| Viewport/Tema | Overflow | Score | Indicadores |
|---|---|---|---|
| 360×800 claro-1 | PASS | visível | 3 colunas |
| 360×800 escuro-1 | PASS | visível | 3 colunas |
| 390×844 claro-1 | PASS | visível | 3 colunas |
| 390×844 escuro-1 | PASS | visível | 3 colunas |
| 1280×800 claro-1 | PASS | visível | 3 colunas |
| 1280×800 escuro-1 | PASS | visível | 3 colunas |

Detalhes e captures: `MATRIZ.md`, `viewport/`, `fullpage/` e `card/`.

## Limitações

- Validação visual cobriu um tema claro e um escuro por viewport, conforme recomendação recebida; os dez temas não foram percorridos nesta rodada.
- C.O.D.E. não foi reexecutado após esta alteração; o último run verde (`45450323163`) é anterior a ela.
- Valores usados no harness são fictícios e servem apenas para comprovar layout; a implementação usa `fmt(monthIncome)`, `fmt(monthExpense)` e `fmt(monthNet)`.
