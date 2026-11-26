# C6-INICIO-02 — Ajuste da hierarquia visual e simplificação da Início

## 1. Identificação

- **SHA inicial:** `124e6004106e7b006745f194e7ea2c77515dbdf7`
- **SHA final:** `124e6004106e7b006745f194e7ea2c77515dbdf7`
- **Branch:** `feat/app-layout-redesign`
- **Estado Git final:** 4 arquivos de produção/teste modificados e diretório `tmp-c13/c6-2/ajuste-hierarquia/` criado.
- **Commit/push/merge/release/deploy:** nenhum.

## 2. Diagnóstico da estrutura anterior

Antes da alteração, a ordem visual era:

1. Cabeçalho Início.
2. `#balanceStrip` com Bancos, Caixinhas, Investimentos e `#investBreakdownBox`.
3. `#viewInicio .inicio-grid` com Patrimônio Total, Saúde Financeira e Próximo Pagamento.
4. `#viewInicio .inicio-footer` com Resumo do Fluxo e botão Adicionar.

O card Patrimônio Total já existia como markup estático dentro da view; não era necessário recriá-lo. `#balanceStrip` também é usado pelo Livro-Caixa, por isso foi preservado como irmão da view, fora dela.

As capturas anteriores em `tmp-c13/c6-2/prints-temas/` mostravam também um card “Detalhamento por instituição”. Ele não é um produto final autônomo: trata-se de `#investBreakdownBox`, controlado por `toggleInvestBreakdown()` e preenchido por `renderInvestBreakdown()` com agrupamentos por instituição. O estado padrão é recolhido (`aria-hidden="true"`); o harness anterior forçou a exibição para documentação, daí a aparência de card vazio. A funcionalidade foi preservada.

## 3. Arquivos modificados e justificativas

| Arquivo | Alteração | Justificativa |
|---|---|---|
| `index.html` | Movido o card existente de Patrimônio Total para antes de `#balanceStrip`; removido apenas o `.cashflow-mini-summary` do footer da Início. | Corrigir a hierarquia sem duplicar componentes e eliminar a redundância do Resumo do Fluxo. |
| `js/18-render-core.js` | Atualizados os seletores do card de Patrimônio e o listener do gráfico para `main > .inicio-patrimonio`. | O card mudou de posição no DOM; valores, gráfico, toggle e listeners precisam continuar apontando para o mesmo elemento. |
| `style/features.css` | Ajustados espaçamentos da faixa, visibilidade do card fora da view e remoção da regra que exibia o Resumo do Fluxo na Início. | Aproximar Patrimônio/Bancos/Caixinhas/Investimentos e evitar espaço residual. |
| `e2e/smoke/inicio.spec.js` | Atualizados seletores e acrescentadas assertions de ordem, ausência do Resumo do Fluxo e estado do detalhamento. | Proteger a nova hierarquia sem remover verificações anteriores. |

## 4. Reposicionamento do Patrimônio Total

O markup original foi movido de `#viewInicio .inicio-grid` para `main`, imediatamente após o cabeçalho e antes de `#balanceStrip`, com a classe adicional `inicio-patrimonio`. Não foi criado um novo componente.

- Em Início: `main > .inicio-patrimonio` é exibido antes da faixa.
- Em Livro-Caixa: permanece oculto; `#balanceStrip` continua com os quatro cards, inclusive Patrimônio Total.
- `renderBalances()` continua atualizando o valor, o gráfico e os atributos ARIA do mesmo card.
- O listener de teclado/mouse do gráfico foi movido para o host estático do card.

## 5. Espaçamentos ajustados

| Elemento | Antes | Depois |
|---|---|---|
| Cabeçalho → Patrimônio | 24px | 18px |
| Patrimônio → faixa | 26px | 16px (10px em ≤680px) |
| Gap interno da faixa | 15px | 13px (12px em ≤680px) |
| Row-gap de Saúde/Próximo | 24px | 16px (14px em ≤680px) |
| Footer → botão Adicionar | 24px | 16px |

A redução foi restrita ao conjunto financeiro da Início. Respiro interno dos cards, raios, bordas, sombras e tokens foram preservados.

## 6. Remoção do Resumo do Fluxo

O `.cashflow-mini-summary` foi removido somente de `#viewInicio`. A verificação prévia mostrou que ele continha apenas Entradas, Saídas e Saldo do mês — todos já apresentados pela Saúde Financeira aprovada. Não havia informação exclusiva, como histórico de meses anteriores.

O cálculo e o renderizador compartilhado não foram alterados. `#cashflowMiniSummary` da Visão Geral permanece intacto, e `renderAdvancedDashboard()` continua escrevendo nele normalmente.

## 7. Detalhamento por instituição

O elemento é `#investBreakdownBox`, funcional e condicionado a `investBreakdownVisible`:

- Alternado pelo ícone do card Investimentos via `toggleInvestBreakdown()`.
- Preenchido por `renderInvestBreakdown()` com agrupamentos por instituição ou estado vazio.
- Padrão: recolhido (`is-collapsed`, `aria-hidden="true"`).

Não foi removido. O E2E agora afirma que começa recolhido e que a alternação funciona sem navegar para a aba Investimentos.

## 8. Preservação de Livro-Caixa e Visão Geral

Evidência em `ISOLAMENTO.json`, obtida com Chromium/CDP e o app real:

- Início: Patrimônio visível antes da faixa; faixa com Bancos/Caixinhas/Invest.; zero Resumo do Fluxo.
- Livro-Caixa: Patrimônio da Início oculto; faixa com Patrimônio Total/Bancos/Caixinhas/Invest.; cabeçalho da Início oculto.
- Visão Geral: faixa oculta; `.dashboard-health-card` presente; nenhum markup exclusivo da Início dentro dela.

## 9. Validação visual

- 4 viewports: 320×720, 360×800, 390×844 e 1280×800.
- 10 temas: claro-1..5 e escuro-1..5.
- 40 combinações, 50 capturas (40 viewport + 10 full-page em 390×844).
- Resultado: 40/40 PASS para overflow, ordem cabeçalho→Patrimônio→faixa, ausência do Resumo, detalhamento recolhido e score visível.

Matriz: `prints/MATRIZ.md`. Capturas: `prints/viewport/` e `prints/fullpage/`.
Comparação antes: `tmp-c13/c6-2/prints-temas/`.

## 10. Testes executados

| Comando/verificação | Resultado |
|---|---|
| `node --check js/18-render-core.js` | PASS |
| `node --check e2e/smoke/inicio.spec.js` | PASS |
| `npm run code:syntax` | PASS |
| `git diff --check` | PASS |
| `npm run code:oracles` | PASS — 149/149 |
| `npm run code:security` | PASS — 94/94 |
| `npm run code:list` | BLOCKED — `playwright: not found` |
| `npm run code:smoke` | BLOCKED — exit 127, `playwright: not found` |
| `npm run code:movimentacoes` | BLOCKED — exit 127, `playwright: not found` |
| `npm run code:test` | BLOCKED — exit 127, `playwright: not found` |

Evidências em `testes/`.

### C.O.D.E. remoto

**NOT RUN para esta alteração.** O workflow `C.O.D.E. E2E` tem `workflow_dispatch`, mas sempre executa o código publicado no ref. Como foi proibido fazer commit/push nesta etapa, um disparo remoto validaria o SHA antigo e não incluiria o novo teste. O último run verde remoto disponível é `45628939621` (`success`, SHA `2f76dac`), em https://github.com/antvjpg/LIVRO-CAIXA/actions/runs/45628939621 — anterior a esta mudança e usado apenas como baseline.

## 11. Evidências e limitações

- `prints/` — capturas depois da alteração.
- `ISOLAMENTO.json` — verificação de Início/Livro-Caixa/Visão Geral.
- `testes/` — logs dos comandos oficiais.
- Limitação: Playwright não está disponível localmente; E2E local e remoto com o novo teste não foram executados.
- Limitação: nenhum commit/push foi feito, portanto o C.O.D.E. remoto não pode validar o novo código.

## 12. Veredito

**APROVADO COM RESSALVAS.** A hierarquia, o espaçamento, a remoção do Resumo do Fluxo e a preservação dos componentes funcionais estão implementados e validados visualmente em 40 combinações. A aprovação plena depende da execução oficial do C.O.D.E. remoto com o novo teste publicado. A C6-INICIO-02 não é declarada encerrada automaticamente.
