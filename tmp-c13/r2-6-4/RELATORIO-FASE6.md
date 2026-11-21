# R2.6 — Fase 6: regressão histórica dos 393 registros

**Data:** 21/11/2026 · **HEAD:** `adce77e306576a1c52a3bc21d92e2cc6f9055134`.

## Execução

Foram criadas cópias controladas, sem alterar os originais:

- `tmp-c13/r2-6-4/regressao/harness-r2-6.cjs` — SHA `f6367ef735606813534624d6675a3c2dac644ce726cd758a98c06ed02a708ef4`, com `CORE_PATH` apontando para o núcleo R2.6.
- `tmp-c13/r2-6-4/regressao/test-r2-6.cjs` — SHA `1e047da2cd5dbfebaa70f7fc7f97ffdd4315aaa265bf8747eaf7c32515644c03`, com `CORE_PATH` e `harness` ajustados às cópias.
- Original R2.5.7 preservado: harness `a35db1d5…`, teste `6c0a7e80…`.

Comando executado com Chromium headless + CDP, servidor local `:8000`:

```
C4_URL=http://127.0.0.1:8000/index.html C4_CDP_PORT=9222 \
node tmp-c13/r2-6-4/regressao/test-r2-6.cjs
```

Resultado: `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, exit code 0.

## Comparação

Evidência: `tmp-c13/r2-6-4/regressao/resultado-comparativo.json`.

- Log da reexecução: SHA `5762bcb4f232c260988a56dfc8e4c9cbe5e1d9549fa4fbca83995f87882beb9f`.
- Log declarado no baseline R2.5.7: **o mesmo SHA** → log byte-identico. Isso prova igualdade de status e ordem dos 393 testes; **não** prova igualdade de todos os campos de dados, pois não foi retido JSON `C4_OUT` da nova execução.
- 393 registros comparados posição a posição: **393 correspondências / 0 divergências**.
- Multiconjunto `(id, status)`: idêntico.
- 14 grupos, mesma distribuição: A16, B17, C21, D27, E7, F11, G11, H4, P19, R12, V164, X21, Y30, Z33.
- BLOCKED remanescente: V32, preservado do histórico.
- Classificações exigidas pelo plano: correções esperadas = nenhuma divergência; regressões = 0; mudanças intencionais = 0; inconclusivas = 0.

**Aceite G6: PASS (com ressalva de evidência).** A compatibilidade do harness foi demonstrada nas cópias controladas quanto a status/ordem; o harness histórico não foi modificado. Não há JSON `C4_OUT` da nova execução para comparação registro completo.

Gate R2.6 segue inconclusivo até Fase 7 (CI/revisão independente/relatório final). Sem commit ou push.
