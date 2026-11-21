# R2.6 — Fase 4: pseudoelementos (C10)

**Data:** 21/11/2026 · **HEAD:** `adce77e306576a1c52a3bc21d92e2cc6f9055134`.

## Evidência

- Script: `tmp-c13/r2-6-4/verificar-fase4.cjs`
- Resultado: `tmp-c13/r2-6-4/fase4-pseudoelemento.json` — SHA `924345e02a5517dbba906144dca5fc79fc799020d4c9a926f81a44172dd9f8dc`
- Resultado: **PASS**, 0 erros CDP.

| Consulta | Seletor | Origem | Declarado | Resolvido | Status |
|---|---|---|---|---|---|
| `::before` | `#r261-pseudo::before` | stylesheet | `var(--accent)` | `rgb(95, 122, 67)` | PASS |
| owner | `#r261-pseudo` | stylesheet | `rgb(17, 17, 17)` | `rgb(17, 17, 17)` | PASS |

## Verificações

- `pseudoElements[].matches` do CDP contém 1 regra; `getWinningRule` com `options.pseudoElement = '::before'` selecionou essa regra.
- O campo `pseudoElement` do vencedor é `::before`.
- A consulta ao elemento proprietário sem `options` continuou isolada, com a cor `#111111` do owner.
- O valor resolvido do pseudo foi obtido via `getComputedStyle(el, '::before')`, pois o parâmetro `pseudoElement` do CDP devolveu as regras do owner neste ambiente.

**Aceite G4: PASS.** Gate R2.6 permanece inconclusivo; sem commit ou push.
