# A-01B — Association exclusiva da proveniência USER

## 1. Diagnóstico complementar

A auditoria independente apontou que a prova A-01 ainda permitia associar a proveniência USER a mais de uma regra quando os campos seletor, propriedade, valor, `!important` e origem CDP fossem idênticos.

Verificação realizada antes da alteração:

- O CDP devolve a regra injetada sem `styleSheetId` e sem `rule.id`.
- `CSS.getAllStyleSheets` e `CSS.getStyleSheetIdsForURL` não estão disponíveis na versão de `chrome-remote-interface` usada pelo harness.
- Existiam **duas** regras USER idênticas porque `sw.js` injetava automaticamente a cada carregamento da fixture e `inject.js` voltava a injetar explicitamente.
- O hash determinístico da A-01 documentava a combinação de campos, mas não garantia exclusividade.

Conclusão: não havia identificador forte vindo do CDP. A associação precisava ser conservadora e a duplicação precisava ser removida na origem.

## 2. Arquivos alterados e justificativa

### Alterados

- `tmp-c13/r2-6-6/extension/sw.js` — removida a auto-injeção que duplicava a folha USER. O service worker permanece como arquivo válido e inerte (`void 0;`); a injeção real continua exclusivamente em `inject.js`, com `chrome.scripting.insertCSS({ origin: 'USER' })`.
- `tmp-c13/r2-6-6-a01/teste-comparador-a01.cjs` — acrescentado `--out` para o runner escrever o artefato A-01 diretamente em `e2e/.artifacts/` e não sobrescrever a evidência versionada da A-01.

### Criados

- `docs/auditorias/c4-v05-b/evidencias-r2-6-6-a01b/c4-v05-b-r2-6-6-a01b-core.cjs` — núcleo A-01B. Mantém a separação `origin`/`cdpOrigin`, mas só promove uma regra a USER quando exatamente uma candidata é compatível. Se houver zero, a proveniência fica ausente; se houver mais de uma, o resultado registra `proveniencia-ambigua` e nenhuma é promovida.
- `tmp-c13/r2-6-6-a01b/validacao-a01b.cjs` — validador de navegador A-01B. Exige `status: 'unica'` e `matchCount: 1` para `R265-U1`, e registra a resolução completa no artefato.
- `tmp-c13/r2-6-6-a01b/teste-comparador-a01b.cjs` — Teste A ampliado com caso de duas regras indistinguíveis.
- `tmp-c13/r2-6-6-a01b/casos.json` — casos derivados da A-01.
- `tmp-c13/r2-6-6-a01b/resultados/` — evidências locais versionadas.
- `e2e/.artifacts/r2-6-a01b-matriz.json` e `e2e/.artifacts/r2-6-a01b-comparador.json` — artefatos do runner.

### Alterado

- `e2e/scripts/run-c4-r26.cjs` — acrescenta a etapa A-01B após a A-01, preservando todas as etapas anteriores.

### Preservados

- Núcleos e evidências R2.6.5, R2.6.6, A-01.
- Extensão `inject.js`, fixture e demais arquivos da extensão.
- CSS de produção, V32, A-02 e A-03.

## 3. Mecanismo de proveniência adotado

A proveniência USER continua sendo baseada em três evidências: operação `chrome.scripting.insertCSS` com `origin: 'USER'`, confirmação `r266-inject:ok` e valor computado observado.

A novidade é a resolução conservadora:

1. O núcleo varre todas as regras candidatas antes de atribuir a proveniência.
2. Conta quantas regras satisfazem exatamente seletor, propriedade, valor, `!important`, origem CDP e `styleSheetId` quando disponível.
3. Se `matchCount === 1`, a regra recebe `origin: 'user'` e `provenance: 'user'`, mantendo `cdpOrigin: 'user-agent'`.
4. Se `matchCount === 0`, nada é promovido.
5. Se `matchCount > 1`, o resultado registra `status: 'ambigua'` e nenhuma regra é promovida a USER.
6. A remoção da auto-injeção elimina a duplicação real observada no navegador.

## 4. Trecho anterior e trecho corrigido

### Atribuição anterior (A-01)

```js
for (const entry of list) {
  if (provenanceMatches(entry, selector, prop, meta)) return entry;
}
return null;
```

### Atribuição corrigida (A-01B)

```js
provenanceResolution = resolveProvenance(ruleMatches, options, property);
uniqueEntries = provenanceResolution
  .filter((item) => item.status === 'unica')
  .map((item) => item.entry);
const provenance = findProvenance(selector, prop, meta, { provenance: uniqueEntries });
```

### Service worker anterior

```js
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !tab.url.startsWith(ALVO)) return;
  inject(tabId).catch(() => {});
});
```

### Service worker corrigido

```js
void 0;
```

## 5. Testes executados e resultados

| Teste | Resultado |
|---|---|
| A1 — USER importante vence AUTHOR importante | PASS |
| A2 — UA importante vence USER importante | PASS |
| A3 — USER não é classificado como UA | PASS |
| A4 — duas regras indistinguíveis não recebem proveniência USER | PASS |
| Rastreabilidade dos candidatos do Teste A | PASS |
| Teste A completo | `5 PASS / 0 FAIL` |
| Teste B — navegador real | `11 PASS / 0 FAIL / 0 BLOCKED` |
| Teste B — `provenienciaPASS` | `1` |
| Teste B — `provenienciaAmbigua` | `0` |
| Teste B — `userBranchExercised` | `true` |
| Matriz original | `10/10` |
| R2.6.5 | `10 PASS / 0 FAIL / 3 BLOCKED` |
| R2.6.6 | `11 PASS / 0 FAIL / 0 BLOCKED` |
| A-01 | `11 PASS / 0 FAIL / 0 BLOCKED` |
| Regressão | `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, `0 divergências` |
| Runner local | `verdict: PASS`, `problems: []` |
| CI GitHub | `NOT RUN` — sem commit/push nesta entrega |

Hashes:

- `sw.js`: `903de0737ff5d035e8de2cdf4700e52a6f76b0ad9b3febec5aaf092725a664f7`
- comparador A-01: `379c3adfff0f0a8b557f5a94c3b16f61bd7f4a2f2fa1be47f02392f7175bae84`
- núcleo A-01B: `a3ad862fb5033493bb9573b1a6eee70d545a855e689e4911739fca66b0cd9a05`
- comparador A-01B: `b75a769b4fc368d0e7d3284d09b428a5770ac3539a17d95cba725783278a5952`
- validador A-01B: `c9f757594e0b4c65d9d037c3daca565f08b41d46177af0ff00ac1a4669bd5593`
- matriz A-01B: `0617623fa81887bb85f5268ad316829a05ab631daca9d2c91b208332ba96058d`
- comparador final A-01B: `c304868c20d7fa0ec3f58188e5f4f29c54512cbf400c07271d717f45d73012c8`
- resumo do runner: `5d566858f238a716aa0cde2a937cd7479fe6d13c85e74b615d43e2f8dbd9e2c1`

## 6. Evidências da injeção USER real

- Operação: `chrome.scripting.insertCSS`
- Origem informada: `USER`
- Confirmação: `r266-inject:ok`
- CSS: `#r266-user-important { color: rgb(200, 10, 20) !important; }`
- Valor computado: `rgb(200, 10, 20)`
- Metadado CDP: `user-agent`
- Resolução da proveniência: `status: unica`, `matchCount: 1`
- Regra compatível: `#r266-user-important`, `rgb(200,10,20) !important`, `cdpOrigin=user-agent`, `styleSheetId=null`, `ruleId=null`
- Vencedor: `origin=user`, `cdpOrigin=user-agent`, `provenance=user`, `rgb(200,10,20)`
- Concorrente: `origin=author`, `cdpOrigin=regular`, `rgb(10,20,30)`

## 7. Limitações

- O CDP não forneceu identificador forte para a folha injetada; a exclusividade agora é garantida pela contagem de candidatas compatíveis, não por um ID.
- `dataset` e demais atributos arbitrários não são usados para marcar a regra, evitando mutar a página além da própria folha USER.
- CI GitHub não foi executado porque não houve autorização de commit/push nesta etapa.
- A-02 e A-03 permanecem pendentes; a R2.6.6 não está sendo promovida oficialmente.

## 8. Parecer final

**A-01B: APROVADO COM RESSALVA.** A ressalva da auditoria independente foi endereçada: associação exclusiva passou a ser exigida, ambiguidade não promove nenhuma regra e um teste sintético demonstra esse comportamento. Permanece apenas a ressalva operacional de CI não executado nesta entrega.
