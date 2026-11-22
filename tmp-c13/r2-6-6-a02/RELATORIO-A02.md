# A-02 — Validação bilateral obrigatória das disputas de precedência

## 1. Arquivos examinados e modificados

### Examinados

- `tmp-c13/r2-6-6-a01b/validacao-a01b.cjs` — ponto exato da verificação: `registro.divergencias.push(...compareWinner(observeWinner, expected.vencedor))`, que validava apenas o vencedor.
- `tmp-c13/r2-6-6-a01b/casos.json` — continha `esperado.vencedor`, mas não declarava os dois concorrentes das disputas.
- `e2e/.artifacts/r2-6-a01b-matriz.json` — confirmou que os concorrentes estavam disponíveis em `nucleo.candidatos`, mas não eram exigidos pela validação.
- Núcleo A-01B e runner C.4 — preservados quanto à lógica já aprovada.

### Criados

- `tmp-c13/r2-6-6-a02/validacao-bilateral.cjs` — helper puro `validateDisputa`, que exige exatamente dois concorrentes, presença, origem, valor declarado, estado de `!important`, e rejeita duplicatas e contradições.
- `tmp-c13/r2-6-6-a02/casos.json` — casos derivados da A-01B com blocos `disputa` para `R265-O3`, `R265-O4` e `R265-U1`.
- `tmp-c13/r2-6-6-a02/teste-bilateral-a02.cjs` — 15 testes sintéticos (3 positivos e 12 negativos).
- `tmp-c13/r2-6-6-a02/validacao-a02.cjs` — validador de navegador que usa o helper e grava `registro.disputa`.
- `tmp-c13/r2-6-6-a02/resultados/` — evidências locais versionadas.
- `e2e/.artifacts/r2-6-a02-matriz.json` e `e2e/.artifacts/r2-6-a02-bilateral.json` — artefatos gerados pelo runner.

### Modificado

- `e2e/scripts/run-c4-r26.cjs` — acrescenta a etapa A-02 após A-01B, sem alterar etapas anteriores.

### Preservados

- A-01 e A-01B: núcleos, validadores, comparadores, relatórios e artefatos.
- R2.6.5, R2.6.6, matriz original e regressão histórica.
- Extensão, fixture, CSS de produção e V32.
- A-03 não foi implementado.

## 2. Comportamento anterior e comportamento corrigido

### Anterior

```js
registro.divergencias.push(...compareWinner(observeWinner, expected.vencedor));
registro.status = registro.divergencias.length ? 'FAIL' : 'PASS';
```

Mesmo que apenas o vencedor estivesse presente, o caso podia passar.

### Corrigido

```js
if (caso.disputa) {
  const disputaResultado = validateDisputa(caso.disputa, observeCandidates);
  registro.disputa = { ...disputaResultado, vencedor: observeWinner };
  if (disputaResultado.status !== 'PASS') {
    registro.divergencias.push(...disputaResultado.divergencias.map((item) => `disputa: ${item}`));
  }
}
```

## 3. Critérios de validação bilateral implementados

Para cada disputa, o helper exige:

1. Exatamente dois concorrentes declarados.
2. Presença de um candidato compatível para cada concorrente.
3. Correspondência exata de origem CSS normalizada (`author`, `user-agent`, `user`).
4. Correspondência do valor declarado.
5. Correspondência do estado de `!important`.
6. Correspondência de seletor, origem CDP, proveniência e folha de estilo quando declaradas.
7. Rejeição de candidato duplicado para o mesmo concorrente.
8. Rejeição de candidato contraditório com mesmo seletor/importância, mas origem ou valor diferente, desde que não seja um dos dois concorrentes esperados.
9. Ausência de qualquer concorrente produz divergência explícita.

## 4. Testes executados e resultados

| Teste | Resultado |
|---|---|
| P1 — O3 com os dois concorrentes corretos | PASS |
| N1 — O3 sem concorrente author | PASS (rejeitado) |
| N2 — O3 sem concorrente user-agent | PASS (rejeitado) |
| P2 — O4 com os dois concorrentes important | PASS |
| N3 — O4 sem concorrente author | PASS (rejeitado) |
| N4 — O4 sem concorrente user-agent | PASS (rejeitado) |
| N5 — O4 com author sem `!important` | PASS (rejeitado) |
| P3 — U1 com user important e author important | PASS |
| N6 — U1 sem concorrente user | PASS (rejeitado) |
| N7 — U1 sem concorrente author | PASS (rejeitado) |
| N8 — U1 com origem user incorreta | PASS (rejeitado) |
| N9 — U1 com author sem `!important` | PASS (rejeitado) |
| N10 — O3 com valor author incorreto | PASS (rejeitado) |
| N11 — O3 com evidência author duplicada | PASS (rejeitado) |
| N12 — O3 com evidência contraditória | PASS (rejeitado) |

Resumo sintético: `15 PASS / 0 FAIL` — `3 positivos PASS` e `12 negativos PASS`.

Validação de navegador: `11 PASS / 0 FAIL / 0 BLOCKED`.

Regressão local:

- Matriz original: `10/10`.
- R2.6.5: `10 PASS / 0 FAIL / 3 BLOCKED`.
- R2.6.6: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-01: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-01B: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-02: `11 PASS / 0 FAIL / 0 BLOCKED`, `bilateralPASS=3`, `bilateralFAIL=0`, `disputasEsperadas=3`.
- Regressão histórica: `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, `0 divergências`.
- Runner local: `verdict=PASS`, `problems=[]`.

Hashes:

- helper bilateral: `d232d8040c3719e13047ce3dff646c26029951dde59b6895ac677366e1fb85c1`
- casos A-02: `d9b7ff9b0e9001852b6edd7d7f8bc304f382a13275073f6d3ae69a65194c318e`
- teste bilateral: `87192913ce69e0d049edd9929819cc3c13fb308e5908ddff6c2a8c6afa04aa18`
- validador A-02: `582239e058dee7cab0b865ea3b7a1c55f38ee9c4456946466c2eb109d0c6948f`
- matriz A-02: `6d454768523d231c0a794aa31813ed6b46bc24bc84b50384168b29129daf684c`
- teste bilateral final: `0a70caf9916b3184bf5517f905a4e2725aa5054b54903e389c39b2d49962b570`
- resumo do runner: `7c1abb09421a7d166015cfc7981617a01460373ec6e584d3bd570c580311b92e`

## 5. Evidência de que O3, O4 e U1 exigem os dois concorrentes

| Caso | Concorrente A | Concorrente B | Resultado da disputa |
|---|---|---|---|
| R265-O3 | `author`, `14px`, normal | `user-agent`, `2em`, normal | PASS |
| R265-O4 | `author`, `block`, `!important` | `user-agent`, `none`, `!important` | PASS |
| R265-U1 | `user`, `rgb(200,10,20)`, `!important`, proveniência USER | `author`, `rgb(10,20,30)`, `!important` | PASS |

Todos os três registros contêm `disputa.status=PASS` e `concorrentes` com exatamente dois elementos aprovados. Os testes negativos demonstram que remover qualquer um dos lados, trocar origem, valor ou `!important`, duplicar evidência ou introduzir contradição faz o validador falhar.

## 6. Confirmação de preservação de A-01/A-01B

- O runner manteve intactas as etapas A-01 e A-01B; apenas acrescentou A-02 depois delas.
- O núcleo A-01B foi reutilizado como dependência da validação A-02, sem alteração.
- A associação exclusiva de proveniência USER continua com `status=unica` e `matchCount=1` em A-01B e A-02.
- Nenhum arquivo de A-01/A-01B foi sobrescrito.
- `provenienciaAmbigua=0` em A-01B e A-02.

## 7. Limitações e casos BLOCKED

- **CI GitHub Actions: NOT RUN.** A execução dos workflows `c4-r26.yml` e `code-e2e.yml` sobre o código A-02 exige commit/push, explicitamente não autorizados nesta tarefa. O runner C.4 local foi executado integralmente como equivalente funcional, mas não substitui os workflows.
- `V32` permanece `BLOCKED` por limitação histórica do Chromium Termux/Android; não foi alterado.
- Não há auditoria independente de A-02 nesta entrega.
- A-03 permanece fora de escopo.
- A R2.6.6 não é promovida automaticamente.

## 8. Parecer final

**A-02: PRONTO PARA AUDITORIA INDEPENDENTE, COM RESSALVA DE CI NÃO EXECUTADO.**

A implementação atende aos requisitos funcionais: O3, O4 e U1 agora exigem evidência bilateral com origem, valor e `!important` corretos; os 12 testes negativos comprovam rejeição de falsos positivos. A-01 e A-01B foram preservados. A aprovação final depende da auditoria independente e da execução dos workflows após autorização de commit/push.

Identificadores de workflows: **pendentes** — não executados nesta entrega.
