# R266-AUD-C — Relatório de implementação controlada

## 1. Baseline

- Repositório: `antvjpg/LIVRO-CAIXA`.
- Branch: `feat/app-layout-redesign`.
- HEAD inicial/final: `19eebffa87d303e75afcb010e4d357f0aabf005d`.
- Working tree limpa no início; alterações permaneceram locais.
- Commit anterior: `cd526d3` (R266-AUD-B).

CI remoto real do baseline:

| Workflow | Run | SHA | Conclusão |
|---|---|---|---|
| C.4 — R2.6 | `45101620918` | `19eebff…` | `success`, tentativa 1 |
| C.O.D.E. E2E | `45101620867` | `19eebff…` | `success`, tentativa 1 |

Artefato C.4 de `19eebff`: `c4-r2-6-evidencias`, ID `14785572922`, SHA-256 `ec948eb4d3f62b6b1281a5460ff304cd3331d16256ac5ea975d3b606431f18d3`.

Esses resultados pertencem ao baseline B e não são apresentados como resultados da R266-AUD-C.

## 2. Diagnóstico B-05

`propImportant()` do núcleo B retornava `false` quando `p.important` estava ausente e o texto não continha `!important`. Isso transformava ausência de metadado em afirmação positiva de declaração normal e permitia que candidato com importância desconhecida participasse da ordenação como `normal`.

A02B já preservava tri-estado no helper de disputa, mas o núcleo não.

## 3. Diagnóstico B-06

`originRank()` retornava `-1` para qualquer candidato com `source === 'inherited'`. Isso apagava a origem CSS da regra fornecedora dentro do ancestral relevante, fazendo user-agent/user/author herdados empatarem e competirem apenas por especificidade/ordem.

A proximidade da herança já era resolvida separadamente por `grupoDecisao`; portanto a correção não deve fundir ancestrais nem reintroduzir competição entre níveis.

## 4. Implementação

### B-05

- `readImportance()` substitui `propImportant()` como fonte de verdadede.
- Estados: `explicit`, `text`, `explicit-with-ambiguous-text`, `unknown`, `ambiguous`, `contradiction`.
- Valores: `true`, `false` ou `null`.
- Contradição metadado/texto gera `importance-contradiction` e nenhum vencedor.
- Importância desconhecida:
  - se puder alterar a disputa → `importance-insufficient`, sem vencedor;
  - se comprovadamente irrelevante → vencedor mantido com `winnerConfidence: condicionado`.
- `authoredProp()` passou a ignorar propriedades sem metadado de importância e sem texto, em vez de presumir normalidade.
- `provenanceMatches()` não casa proveniência com importância desconhecida.

### B-06

- Ranking de origem considera apenas a origem CSS da declaração, não `source === 'inherited'`.
- Ordem normal: author < user < user-agent (maior precedência por último no rank interno).
- Ordem `!important`: user-agent > user > author.
- `origin: "regular"` do CDP é normalizado para `author`; `cdpOrigin` preserva o valor bruto.
- Proximidade continua determinada pelo primeiro ancestral com declaração.
- Origem desconhecida relevante gera `origin-insufficient`; isolada, rebaixa confiança.
- Proveniência USER passa a ser resolvida também em regras do ancestral fornecedor.

### Integração

- Núcleo C integrado à etapa principal R2.6.6.
- Núcleo B e núcleo histórico preservados em execuções comparativas separadas.
- Pins SHA e gates anti-reversão adicionados ao runner.
- Mapa `nucleos` publicado no summary.

## 5. Arquivos criados/alterados

### Criados

- `docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud-c/c4-v05-b-r2-6-6-r266-aud-c-core.cjs`
- `tmp-c13/r2-6-6-r266-aud-c/fixture.html`
- `tmp-c13/r2-6-6-r266-aud-c/casos.json`
- `tmp-c13/r2-6-6-r266-aud-c/teste-r266-aud-c.cjs`
- `tmp-c13/r2-6-6-r266-aud-c/validacao-r266-aud-c.cjs`
- `tmp-c13/r2-6-6-r266-aud-c/resultados/` com evidências atuais e cópias de `19eebff`
- `tmp-c13/r2-6-6-r266-aud-c/RELATORIO-R266-AUD-C.md`

### Modificado

- `e2e/scripts/run-c4-r26.cjs`.

### Preservados

- Núcleos histórico, R266-AUD e R266-AUD-B.
- Validadores e critérios A-01..A-03B.
- Evidências de `19eebff`.
- `V32` como `BLOCKED`.

## 6. Testes unitários

Comando integrado no runner:

```sh
node e2e/scripts/run-c4-r26.cjs
```

Resultado: `33 PASS / 0 FAIL`.

Cobertura:

- I01–I10: tríade `true/false/null`, texto, ausência, tipo inválido e contradição.
- I11–I13: incerteza relevante, irrelevante e contradição com bloqueio.
- O01–O12: matriz completa de origens normais e `!important`.
- H01–H08: herança com origens concorrentes, ancestral relevante/irrelevante e metadados incompletos.

## 7. Testes Chromium

- 5 cenários reais, 0 sintéticos.
- Chrome/156.0.8078.79, protocolo CDP 1.3.
- Oráculos: núcleo, `CSS.getComputedStyleForNode()` e `getComputedStyle()` via `Runtime.callFunctionOn()`.
- Resultado: `5 PASS / 0 FAIL / 0 BLOCKED`.
- `erros.cdp`, `erros.console` e `erros.excecoes`: vazios.

Cenários:

| ID | Prova |
|---|---|
| C1 | `author !important` vence `author normal` no ancestral imediato |
| C2 | `author normal` vence `user-agent normal` no ancestral `h1` |
| C3 | disputa de origem/importância no avô fornecedor |
| C4 | declaração própria do filho não é confundida com disputa do ancestral |
| C5 | ancestral imediato vence ancestral distante com `!important` |

## 8. Matriz de precedência

| Origem | Normal | `!important` |
|---|---:|---:|
| Author | vence user e UA | perde para user e UA |
| User | perde para author, vence UA | vence author, perde para UA |
| User-agent | perde para author e user | vence author e user |

Verificada em O01–O12 e, no Chromium, em C1/C2.

## 9. Primeira execução e correção

A primeira execução local falhou com:

- `importance-insufficient` e `origin-insufficient` na matriz R2.6.6;
- C1 com injeção USER não confirmada.

Causas observadas por sonda CDP:

- propriedades implícitas sem `important` e sem `text`;
- `rule.origin === "regular"` no CDP;
- extensão USER fixada na fixture antiga.

Correções aplicadas sem enfraquecer testes:

- `authoredProp()` passou a exigir metadado de importância ou texto;
- `regular` normalizado para `author`;
- cenário USER substituído por disputa real author/user-agent no Chromium, mantendo USER coberto na matriz unitária.

Nenhum teste histórico foi removido ou relaxado.

## 10. Regressão

| Etapa | Resultado |
|---|---|
| Matriz original | `10 PASS / 0 FAIL / 0 BLOCKED` |
| R2.6.5 | `10 PASS / 0 FAIL / 3 BLOCKED` |
| R2.6.6 com núcleo C | `11 PASS / 0 FAIL / 0 BLOCKED` |
| R2.6.6 histórico | `11 PASS / 0 FAIL / 0 BLOCKED` |
| R2.6.6 B comparativo | `11 PASS / 0 FAIL / 0 BLOCKED` |
| A-01/A-01B | `11/11` |
| A-02/A-02B | `11/11`, `15/15`, `20/20` |
| A-03/A-03B | `12/12` unitário e navegador |
| R266-AUD | `25/25`, `7/7` |
| R266-AUD-B | `24/24`, `7/7` |
| R266-AUD-C | `33/33`, `5/5` |
| Regressão R2.5.7 | `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, 0 divergências |
| Veredito local | `PASS`, `problems: []` |

## 11. CI remoto

- Runs existentes pertencem a `19eebff`.
- Não há CI remoto para o working tree de R266-AUD-C.
- C.O.D.E. local: `NOT RUN` por ambiente.
- Pendência: publicar e verificar C.4 e C.O.D.E. no SHA C.

## 12. Artefatos e hashes

| Artefato | SHA-256 |
|---|---|
| núcleo C | `11999fd9f7531d536c01b3b4b5ccfddb849155aadf6edab9735dcbdc38127323` |
| `casos.json` | `93f87652e459881028c383fb33e60d6a8baedb74da1785e76b773bbccf8bd7b0` |
| `fixture.html` | `71ffa6054d9b81e7bbaf416b1ce7d73d31e73905dc8c70d891342001b5629734` |
| `teste-r266-aud-c.cjs` | `bffbdc826c992f22a266ce05c1ca95e4d446ee1e4b863375717dae530ae5afc3` |
| `validacao-r266-aud-c.cjs` | `bf9e684c9b5c072f78d32651d9c6b0346a5879f7900263507d21b00c20a648ed` |
| `run-c4-r26.cjs` | `08ae8446103589f5865de7f1a2ec77232ba3044d5b21b77795fa332261ac3f6d` |
| unitário C | `9f5993fe2bf74d55bd97d690c920498fef362dc87464661b2efd3d8b3c9f99f3` |
| matriz C | `85cfdf10d9b5c4249fbb4292b48312457f5b0cbad241b05dd9d76c0823b608fd` |
| B comparativo | `38e41833cbe7f0f7d5757c2bc62932eda4f05b1968c759f8d7a0a49fc933d5b7` |
| matriz R2.6.6 | `1df57726da635171c551639f01385bd2f02737917524f1a054ee0e9c87e69bce` |
| summary | `bbcbcd1e9bb5403b000df7c26f515769c39b0a30b640d2391d49ee7f849d4cd4` |

## 13. Notion

Atualizadas sem apagar histórico:

- Plano de correção R2.6 — `41fcf6c0-c0bd-8112-8069-fbbfaf1b4d01`.
- C.O.D.E. — Histórico técnico — `41ccf6c0-c0bd-8144-b0bd-fb3ccb32241a`.

## 14. Parecer e pendências

Verificação cruzada: **APROVADA COM RESSALVAS**, sem bloqueio funcional.

Pendências:

1. Publicar o working tree para gerar CI no SHA C.
2. Executar e conferir C.4 e C.O.D.E. no SHA exato.
3. Auditoria independente final da R2.6.6.

R2.6.6 permanece **sem promoção oficial**. `V32` permanece `BLOCKED`.
