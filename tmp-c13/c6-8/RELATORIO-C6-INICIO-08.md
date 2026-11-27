# RELATÓRIO DE IMPLEMENTAÇÃO — C6-INICIO-08

**Base:** `d0e9be2` (`feat/app-layout-redesign`)  
**Data:** 2026-11-26  
**Escopo:** cobertura E2E do fluxo `Início → FAB global → novo lançamento`.  
**Restrição respeitada:** C.O.D.E. e suíte Smoke **não executados**; sem commit/push.

## 1. Diagnóstico inicial

| Arquivo | Achado |
|---|---|
| `e2e/smoke/inicio.spec.js` | Já verificava `#viewInicio .inicio-footer button` com contagem 0, mas não acionava o FAB na Início. |
| `e2e/smoke/smoke.spec.js` | Verificava apenas `#fabAdd` visível (`smoke.spec.js:53`). |
| `e2e/helpers/app.cjs` | `openNewEntry()` já clica `#fabAdd`, trata `#panelBanco.open` e espera `#panelNovo.open` (`app.cjs:207-220`). |
| `js/99-init.js` | Handler do FAB (`js/99-init.js:3642-3655`) chama `openNewEntryModal()` para `inicio`; não há controle local na Início. |
| `index.html` | `#fabAdd` em `:711`; `#panelNovo` em `:714+`. |

Conclusão: a funcionalidade continua necessária; a cobertura estava desatualizada em relação à interface. Nenhuma lógica de produção foi alterada.

## 2. Implementação

### Código anterior (trecho representativo)

```js
// e2e/smoke/inicio.spec.js
await expect(page.locator('#viewInicio .inicio-footer button')).toHaveCount(0);
// não havia acionamento do #fabAdd na aba Início
```

### Código novo

Adicionado em `e2e/smoke/inicio.spec.js`:

- import `fixtures` (`:10`);
- teste **`FAB global abre novo lançamento na aba Início`** (`:494`).

Trecho representativo:

```js
await app.openTab(page, 'inicio');
await expect(page.locator('#viewInicio')).toHaveClass(/active/);
await expect(page.locator('body')).toHaveAttribute('data-tab', 'inicio');
await expect(page.locator('#viewInicio .inicio-footer button')).toHaveCount(0);

await app.ensureBankExists(page, fixtures.bank.name, fixtures.bank.initial);
const ledgerAntes = await app.ledgerCount(page);

await app.openNewEntry(page, fixtures.bank.name);

await expect(page.locator('#panelNovo')).toHaveClass(/open/);
await expect(page.locator('#panelNovoTitle')).toContainText('Novo lançamento');
await expect(page.locator('body')).toHaveAttribute('data-tab', 'inicio');
```

Fechamento sem salvar:

```js
await page.evaluate(() => window.closeAllPanels?.());
await expect(page.locator('#panelNovo')).not.toHaveClass(/open/);
expect(await app.ledgerCount(page), 'nenhum lançamento deve ser salvo ao fechar o painel').toBe(ledgerAntes);
```

## 3. Justificativa do helper

`app.openNewEntry(page, bankName)` foi reutilizado porque:

- já aciona `#fabAdd`;
- detecta `#panelBanco.open` no fluxo de primeira utilização;
- cria banco com marcador `CODE_TEST_*` quando necessário;
- espera `#panelNovo.open`.

Não foi criado novo helper. `app.ensureBankExists()` foi usado antes do teste para tornar o cenário determinístico e evitar depender da abertura de `#panelBanco` durante a validação principal. Ambos usam a conta QA efêmera.

## 4. Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `e2e/smoke/inicio.spec.js` | Import de fixtures e novo teste do FAB global na Início. |
| `tmp-c13/c6-8/RELATORIO-C6-INICIO-08.md` | Este relatório. |

Nenhum arquivo de produção foi alterado.

## 5. Critérios de aceite

| Critério | Evidência estática | Estado |
|---|---|---|
| Teste identificável para o FAB na Início | `inicio.spec.js:494` | PASS estático |
| `#panelNovo.open` | expectativa no novo teste | PASS estático |
| Aba Início permanece ativa | `body[data-tab]` e `#viewInicio.active` após abertura | PASS estático |
| Formulário fechado sem salvar | `closeAllPanels()` + comparação de `ledgerCount` | PASS estático |
| Cenário sem banco tratado | `ensureBankExists()` + `openNewEntry()` | PASS estático com ressalva dinâmica |
| Ausência do botão local preservada | contagem 0 no teste existente e no novo | PASS estático |
| Nenhum controle duplicado | nenhuma alteração em `index.html`/`js/` | PASS |
| Lógica de produção inalterada | `git status` mostra apenas spec e relatório | PASS |
| Infraestrutura reutilizada | `openNewEntry`, `ensureBankExists`, `ledgerCount`, QA/fixtures | PASS |
| Execução E2E real | Playwright indisponível no Android; C.O.D.E. não executado por restrição | NOT RUN / BLOCKED |

`testInfo.attach('inicio-fab-novo-lancamento.txt')` registra URL, usuário, aba, estado do painel, contagem do ledger e contadores de console/dialog quando o teste for executado em ambiente compatível.

## 6. Validação estática

| Comando | Resultado |
|---|---|
| `node --check e2e/smoke/inicio.spec.js` | PASS — sem erro de sintaxe. |
| `git diff --check` | PASS — sem erros. |
| `npm run code:syntax` | Não executado nesta etapa por restrição de escopo. |
| C.O.D.E. / Smoke / suíte completa | NOT RUN — explicitamente não executados. |

## 7. Pendências

- Executar o spec em CI/PC com Playwright disponível e sessão QA.
- Confirmar dinamicamente o caminho sem banco (`#panelBanco.open` → criação → reabertura do FAB).
- Confirmar que `closeAllPanels()` não dispara efeito colateral de persistência.
- Revisão independente do teste pelo usuário.

## 8. Parecer

**PASS COM RESSALVAS.** A cobertura E2E específica foi escrita com reutilização da infraestrutura existente e validação estática aprovada. O aceite final depende da execução dinâmica e da auditoria independente.

**Não foi feito commit ou push.**
