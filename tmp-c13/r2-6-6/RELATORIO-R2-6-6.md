# Relatório de implementação — R2.6.6

## Identificação da tarefa e da versão-base

- Tarefa: R2.6.6 — validação de origens CSS genuínas e auditoria complementar de especificidade.
- Repositório: `antvjpg/LIVRO-CAIXA`.
- Branch: `feat/app-layout-redesign`.
- Versão-base: `abf76fe11f5af15178ffdf5db4010ea11ab5af8f` (`fix(c4): implementa R2.6.5 e publica evidencias`).
- Núcleo R2.6.5 preservado: `docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs`, SHA `3bfbebc61a2ca8bbe09c40bd1d9db1315f39db322cc49ed7c3d128c242dbd7db`.
- Núcleo R2.6.6 derivado: `docs/auditorias/c4-v05-b/evidencias-r2-6-6/c4-v05-b-r2-6-6-core.cjs`, SHA `8a6e08d3982c201ad36bd5973f05da7580182f70d0c42691b2279754de0636c4`.
- Data/hora da execução local final: `2026-11-22T02:10:03.830Z` a `2026-11-22T02:10:39.795Z`.

## Objetivo, escopo e exclusões

- Objetivo: substituir os três cenários `BLOCKED` da R2.6.5 (`R265-O3`, `R265-O4`, `R265-U1`) por evidências com origens CSS realmente existentes:
  - `user-agent` normal;
  - `user-agent` com `!important`;
  - `user` com `!important`.
- Escopo adicional: auditar `:is()`, `:where()`, `:not()`, `:has()`, `::before` e `::after`.
- Preservado:
  - núcleo R2.6.5;
  - runner C.4 e suas etapas matriz original/R2.6.5/regressão;
  - artefatos publicados da R2.6.5;
  - comportamento da aplicação.
- Excluído:
  - alterações em `index.html`, `js/`, `style/`, `sw.js` ou `worker/`;
  - autenticação, persistência, regras financeiras e Service Worker;
  - commit, push ou merge (não autorizados nesta sessão).
- Solicitação atendida: o README já continha o link do GitHub Pages em `README.md:12`; nenhuma alteração foi necessária.

## Inspeção inicial e dependências

- runner local/CI: `e2e/scripts/run-c4-r26.cjs`.
- workflow: `.github/workflows/c4-r26.yml`.
- validador R2.6.5: `tmp-c13/r2-6-5/validacao-r2-6-5.cjs`.
- núcleo R2.6.5: `docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs`.
- baseline histórico: `docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-test-results.json`.
- Ambiente local: Termux/Android, Chromium headless `--headless=new`, CDP na porta `9222`, servidor HTTP Python na porta `8000`.
- Versão do navegador observada: `Chrome/156.0.8078.79`, UA `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36`.
- Playwright continua indisponível localmente (`Unsupported platform: android`); o runner usa `CHROME_BIN`/`findChromium()`.

## Diagnóstico dos problemas

### 1. Não existe CDP para injetar user-agent stylesheet neste Chromium

Tentativas com `CSS.setUserAgentStylesheet`, via `chrome-remote-interface` e via WebSocket bruto, falharam com:

```text
-32601: 'CSS.setUserAgentStylesheet' wasn't found
```

Nenhum flag CLI confiável foi encontrado para stylesheet user-agent customizada.

### 2. A UA stylesheet embutida contém as regras genuínas necessárias

Observado via `CSS.getMatchedStylesForNode`:

```css
/* origin: user-agent */
h1 { font-size: 2em; }

/* origin: user-agent, important */
input[type="hidden" i] { display: none !important; }
```

Isso permite `R265-O3` e `R265-O4` sem simulação.

### 3. User origin exige extensão

`chrome.scripting.insertCSS` aceita `origin: 'USER'` (maiúsculas). Primeira tentativa com `origin: 'user'` falhou:

```text
Value must be one of AUTHOR, USER.
```

Após corrigir para `origin: 'USER'`, a página da extensão reportou `r266-inject:ok` e o valor computado passou a `rgb(200, 10, 20)`.

### 4. O CDP rotula CSS injetado como origem `USER` com `origin: user-agent`

O valor injetado pela API `scripting.insertCSS({ origin: 'USER' })` aparece no CDP como `origin: "user-agent"`. Isso foi registrado como limitação do protocolo/navegador; a prova de origem user é a chamada da API com `origin: 'USER'`, o status `r266-inject:ok` e o efeito computado, não o rótulo CDP.

### 5. Divergências reais no núcleo R2.6.5

Execução baseline com o núcleo R2.6.5 (`tmp-c13/r2-6-6/resultado-baseline.json`):

```text
total 11 | PASS 6 | FAIL 5 | BLOCKED 0
origemPASS 1 | especificidadePASS 5
```

Falhas:

- `R265-O4`: o núcleo escolheu `#r266-ua-important { display:block !important }` (author) em vez de `input[type="hidden" i] { display:none !important }` (user-agent), embora `resolvedValue` já fosse `none`.
- `R265-U1`: o núcleo escolheu a declaração author em vez da declaração user injetada, embora `resolvedValue` já fosse `rgb(200, 10, 20)`.
- `R266-S6`: `:where(#id)::before` recebeu especificidade `a=1`; o correto é `a=0,b=1,c=0` para a regra vencedora `.classe::before`.
- `R266-S7`: `:is(#id)::before` recebeu `b=1`; o correto é `a=1,b=0,c=0`.
- `R266-S8`: `#id:not(.classe)::before` recebeu `b=2`; o correto é `a=1,b=1,c=0`.

Causas:

- `authoredProp()` descartava declarações sem `text` e com `implicit`, o que exclui regras user-agent e user.
- Para seletores com `::`, `ruleSpecificity()` usava heurística textual própria em vez da especificidade fornecida pelo CDP, errando `:is()`/`:where()`/`:not()`.

## Implementação e justificativas

### Origens CSS

- `tmp-c13/r2-6-6/fixture.html`:
  - UA normal: `<h1 id="r266-ua-normal">` com author `font-size: 14px`.
  - UA importante: `<input type="hidden" id="r266-ua-important">` com author `display: block !important`.
  - user importante: `#r266-user-important` com author `color: rgb(10,20,30) !important` e injeção via extensão.
- `tmp-c13/r2-6-6/extension/`: extensão MV3 mínima, com `manifest.json`, service worker `sw.js`, página `inject.html` e script `inject.js`.
- A extensão usa `chrome.scripting.insertCSS({ origin: 'USER' })`; o service worker expõe o ID da extensão para o validador.

### Especificidade

- Oito casos adicionais cobrindo `:is()`, `:where()`, `:not()`, `:has()`, `::after` e três combinações com pseudoelementos.
- Especificidade esperada usa a semântica CSS: o pseudoelemento não contribui para `a/b/c`; por isso a especificidade CDP (`c=1` para `::before`/`::after`) tem `c` decrementado em 1.

### Núcleo R2.6.6

Arquivo novo derivado do R2.6.5; o R2.6.5 não foi alterado.

Trecho anterior:

```js
function authoredProp(p) {
  return Boolean(p && (p.implicit === false || (typeof p.text === 'string' && p.text.trim().length > 0)));
}
```

Novo trecho:

```js
function authoredProp(p, origin) {
  if (origin === 'user-agent' || origin === 'user') return true;
  return Boolean(p && (p.implicit === false || (typeof p.text === 'string' && p.text.trim().length > 0)));
}
```

Trecho anterior:

```js
if (!authoredProp(prop) || prop.name !== property || prop.disabled === true || prop.parsedOk === false) continue;
```

Novo trecho:

```js
if (!authoredProp(prop, meta.origin) || prop.name !== property || prop.disabled === true || prop.parsedOk === false) continue;
```

Trecho anterior (resumo):

```js
if (text && /::[\w-]+/.test(String(text))) {
  spec = specificityFromSelector(text);
} else if (sel.specificity) {
  spec = { a: ..., b: ..., c: ... };
}
```

Novo trecho (resumo):

```js
if (sel.specificity) {
  spec = { a: ..., b: ..., c: ... };
  if (pseudoElement) spec.c = Math.max(0, spec.c - pseudoElementCount(text));
} else {
  spec = specificityFromSelector(text);
}
```

Chamadas atualizadas para `ruleSpecificity(rule, match, pseudoElement)` e `ruleSpecificity(rule, match, null)`.

### Validador e runner

- `tmp-c13/r2-6-6/validacao-r2-6-6.cjs`:
  - descobre o service worker da extensão;
  - cria a página `inject.html`, aguarda `r266-inject:ok` e registra o ID da extensão;
  - consulta o navegador via CDP e `getComputedStyle`;
  - compara `computedValue`, `resolvedValue`, `resolveStatus`, vencedor, origem, `!important` e especificidade;
  - registra `origem`, `seletor`, `valor`, `importante` e `especificidade` das regras candidatas;
  - grava hash SHA-256 de verificação.
- `e2e/scripts/run-c4-r26.cjs`:
  - novas constantes `CORE_266`, `VALIDATOR_266`, `EXTENSION_266`, `MATRIZ_266_OUT`;
  - Chromium passa a iniciar com `--disable-extensions-except` e `--load-extension`;
  - nova etapa R2.6.6 com expected `11 PASS / 0 FAIL / 0 BLOCKED`;
  - resumo e GitHub Step Summary passam a incluir R2.6.6;
  - etapas anteriores continuam usando o núcleo R2.6.5.

## Arquivos alterados, criados e removidos

### Alterados

- `e2e/scripts/run-c4-r26.cjs` — integração da etapa R2.6.6 e flags da extensão.

### Criados

- `docs/auditorias/c4-v05-b/evidencias-r2-6-6/c4-v05-b-r2-6-6-core.cjs`
- `tmp-c13/r2-6-6/fixture.html`
- `tmp-c13/r2-6-6/casos.json`
- `tmp-c13/r2-6-6/validacao-r2-6-6.cjs`
- `tmp-c13/r2-6-6/resultado-baseline.json`
- `tmp-c13/r2-6-6/resultado-correcao.json`
- `tmp-c13/r2-6-6/extension/manifest.json`
- `tmp-c13/r2-6-6/extension/sw.js`
- `tmp-c13/r2-6-6/extension/inject.html`
- `tmp-c13/r2-6-6/extension/inject.js`
- `e2e/.artifacts/r2-6-6-matriz.json`
- `e2e/.artifacts/r2-6-ci-summary.json` (atualizado pelo runner)

### Removidos

- Nenhum.

## Validações executadas e respectivos resultados

| Validação | Estado | Resultado |
|---|---|---|
| `node --check` runner, núcleo R2.6.6 e validador | PASS | Sintaxe válida |
| Baseline R2.6.5 sobre novos casos | PASS (diagnóstico) | `6 PASS / 5 FAIL / 0 BLOCKED`; falhas documentadas |
| Validador R2.6.6 com núcleo R2.6.6 | PASS | `11 PASS / 0 FAIL / 0 BLOCKED`; `origemPASS=3`, `especificidadePASS=8` |
| Matriz original C.4 | PASS | `10/10`, oráculo `10/10` |
| R2.6.5 preservada no runner | PASS | `10 PASS / 0 FAIL / 3 BLOCKED`; IDs `R265-O3,R265-O4,R265-U1` preservados |
| Regressão R2.5.7 | PASS | `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, 0 divergências |
| Runner C.4 completo local | PASS | `verdict: PASS`, `problems: []`, 35.965 ms |
| Segurança C.O.D.E. | PASS (histórico) | `94/94` na R2.6.5; código da aplicação não foi alterado nesta tarefa |
| CI GitHub Actions da R2.6.6 | NOT RUN | Exige commit/push autorizados |

Hashes:

- baseline R2.6.6: `5f6626a64cabc55d40ab35eeaa04a396dc0c8536c7599adeaaf51f54cf3e71db`.
- correção R2.6.6 avulsa: `190fb6054652a3438c729f8411fc561f081795a35e48f9bb49f4bf2093b00f67`.
- artefato final do runner `e2e/.artifacts/r2-6-6-matriz.json`: `993e866ccc22ec90d5d2ada97e8f08473c635006f785115f0211b9f8d29bf94a`.
- resumo final `e2e/.artifacts/r2-6-ci-summary.json`: `2504c7c204d5a4ea937465e6f4a14b93f5bd8347367f88653e5bd52da3c167e8`.

Os hashes diferem entre execuções porque o JSON inclui timestamp; a verificação interna `hashMatches` foi `true` em todos os artefatos.

## Revisão do diff

- Nenhum arquivo de aplicação foi alterado.
- Nenhuma credencial, token ou dado financeiro real foi adicionado.
- Nenhum `alert`, `console.log` de depuração ou instrumentação temporária permaneceu em código de produção.
- O núcleo R2.6.5 permanece byte a byte com SHA `3bfbebc6…`.
- O runner manteve todas as verificações anteriores; apenas acrescentou a etapa R2.6.6.
- A extensão MV3 é mínima e existe apenas como infraestrutura de teste.

## Limitações e riscos

- CI Linux/GitHub Actions da R2.6.6 não foi executado localmente; a validação foi feita apenas no Chromium headless do Termux.
- O suporte a extensões em `--headless=new` depende da versão do Chromium instalada no CI; o runner falha explicitamente se a extensão não existir ou se o service worker/injeção não responder.
- O CDP rotula CSS injetado por `origin: 'USER'` como `user-agent`; a distinção é preservada pelo registro da chamada da API e pelo efeito computado.
- `V32` permanece `BLOCKED` e não foi reclassificado.
- A R2.6.5 continua com três `BLOCKED` em seu próprio validador por preservação histórica; a R2.6.6 resolve esses cenários em novo validador/núcleo.
- O aviso `MaxListenersExceededWarning` aparece no log do validador devido a múltiplos `loadEventFired`; não afeta resultados nem artefatos.

## Resultado da implementação

R2.6.6 concluída localmente:

- Os três cenários anteriormente bloqueados foram validados com origens CSS genuínas.
- A auditoria de especificidade encontrou duas classes de divergência no núcleo R2.6.5 e ambas foram corrigidas no núcleo derivado R2.6.6.
- O runner C.4 completo permaneceu `PASS`, com matriz original `10/10`, R2.6.5 preservada `10/13`, R2.6.6 `11/11` e regressão `392/393` sem divergências.
- Nenhuma alteração foi aplicada ao código da aplicação.

## Pendências e próximos passos

1. Commit/push somente após autorização explícita do usuário.
2. Executar o CI GitHub Actions `c4-r26.yml` após o push e conferir o artefato `c4-r2-6-evidencias` com `r2-6-6-matriz.json`.
3. Atualizar o plano no Notion com o resultado da R2.6.6.
4. Auditoria independente do novo núcleo e da extensão antes de usar a R2.6.6 como substituta oficial da R2.6.5.
