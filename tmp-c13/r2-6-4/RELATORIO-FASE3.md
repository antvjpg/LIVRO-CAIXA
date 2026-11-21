# R2.6 — Fase 3: herança (C07/C08)

**Data:** 21/11/2026 · **HEAD:** `adce77e306576a1c52a3bc21d92e2cc6f9055134`.

## Evidência

- Script: `tmp-c13/r2-6-4/verificar-fase3.cjs`
- Resultado: `tmp-c13/r2-6-4/fase3-heranca.json` — SHA `dffacc572f50b819d7f7deeca3b9252fbd12233f373183dbd6eb22564c1ffca6`
- Resumo: **2 PASS / 0 FAIL / 0 erros CDP**.

| ID | Origem | Seletor | Declarado | Resolvido | Computado CDP | Status |
|---|---|---|---|---|---|---|
| C07 | stylesheet | `#r261-inherit` | `inherit` | `rgb(95, 122, 67)` | `rgb(95, 122, 67)` | PASS |
| C08 | inherited | `.r261-parent-implicit` | `var(--accent)` | `rgb(95, 122, 67)` | `rgb(95, 122, 67)` | PASS |

## Verificações

- `matched.inherited[].matchedCSSRules` é percorrido em `r2-6-core.cjs:710`.
- C07 continua vencendo pela declaração própria `color: inherit`; a cor do ancestral é resolvida pelo navegador.
- C08 não tem declaração própria de `color`; o vencedor é o candidato herdado real, com origem `inherited`.
- Nenhum vencedor fictício foi produzido: o candidato herdado corresponde a regra existente no CDP (`inheritedColorRules = 1`).

**Aceite G3: PASS.** Gate R2.6 permanece inconclusivo; sem commit ou push.
