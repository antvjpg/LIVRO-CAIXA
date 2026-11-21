# R2.6 — Fase 2: inline e valores (C05/C06)

**Data:** 21/11/2026 · **HEAD:** `adce77e306576a1c52a3bc21d92e2cc6f9055134`.

## Evidência

- Script: `tmp-c13/r2-6-4/verificar-fase2.cjs`
- Resultado: `tmp-c13/r2-6-4/fase2-inline-valores.json` — SHA `0d587140a8a7b4333a89ac436842971df973e82d1fe37c18b56fb775ac155487`
- Resumo: **2 PASS / 0 FAIL / 0 erros CDP**.

| ID | Origem | Valor declarado (bruto) | Valor resolvido | Computado CDP | Status |
|---|---|---|---|---|---|
| C05 | inline | `#FF0000` | `rgb(255, 0, 0)` | `rgb(255, 0, 0)` | PASS |
| C06 | inline | `var(--inline-accent)` | `rgb(0, 0, 255)` | `rgb(0, 0, 255)` | PASS |

Em C06, as declarações inline lidas foram `--inline-accent: #0000FF` e `color: var(--inline-accent)`; o núcleo preservou `var(--inline-accent)` como valor declarado e registrou o valor resolvido separadamente.

## Verificações

- `CSS.getInlineStylesForNode()` é chamado em `r2-6-core.cjs:698`.
- Candidatos inline entram no conjunto com `source: 'inline'` e `specificity {a:1,b:0,c:0}`.
- `resolvedValue` é obtido do navegador em `r2-6-core.cjs:729-738`; `computedValue` continua sendo o valor declarado, preservando o contrato histórico.
- Nenhuma confusão entre declarado e computado foi observada nos dois cenários.

**Aceite G2: PASS.** Gate R2.6 permanece inconclusivo; sem commit ou push.
