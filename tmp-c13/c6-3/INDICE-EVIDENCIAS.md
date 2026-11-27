# Índice de metodologia e evidências — C6-INICIO-03

**Base inicial:** `db5bdb9` · **Base da resolução:** `0ce0085`
**Branch:** `feat/app-layout-redesign`  
**Data:** 2026-11-26  
**Finalidade:** documentar como o isolamento Início ↔ Visão Geral e o bloco de Orçamentos foram investigados, implementados e validados.

## 1. Metodologia

1. **Inspeção estática**
   - Mapeamento de `renderAdvancedDashboard()`, `renderBalances()`, `render()`, `switchTabOriginal()`, `dashBudgetRows()`, `budgetFor()`, `budgetSpent()` e `currentFinancialCycleKey()`.
   - Verificação de hosts em `index.html`, consumidores em `js/` e asserções existentes em `e2e/`.
   - Classificação dos fluxos em `shared-safe`, `shared-risk` e `isolated`.

2. **Implementação isolada**
   - Host novo somente em `#viewInicio`.
   - Renderer somente leitura `renderInicioBudgets()` em `js/18-render-core.js`.
   - Hooks guardados por `document.body.dataset.tab === 'inicio'`, sem alterar a saída de `renderAdvancedDashboard()`.

3. **Validação local por CDP**
   - Chromium headless `156.0.8078.79`, servidor estático local em `127.0.0.1:8000`.
   - Dados financeiros **fictícios** injetados apenas em memória (`budgets`, `entries`, `categories`), sem escrita no Firestore e sem uso de dados reais.
   - Medições com `getBoundingClientRect()` e `getComputedStyle()`.
   - Alternância Início → Visão Geral → Início repetida 5 vezes para verificar duplicação/resíduo.
   - Capturas com `Page.captureScreenshot()` em 320×720, 360×800, 390×844 e 1280×800.
   - Abertura do modal existente por clique no action do card.

4. **Validações automatizadas disponíveis**
   - `node --check` nos arquivos JS alterados.
   - `npm run code:syntax`.
   - `npm run code:oracles`.
   - `npm run code:security`.
   - `git diff --check`.

## 2. Resultados consolidados

| Item | Estado | Resultado observado |
|---|---|---|
| Isolamento estático | INCONCLUSIVA | Acoplamentos preexistentes mapeados; nenhum agravado pela nova implementação. |
| Renderização do bloco | PASS | 53%, R$ 2.670,00 / R$ 5.000,00 / R$ 2.330,00 no fixture CDP. |
| Prioridade de categorias | PASS | 105% Excedido, 80% Atenção, 64% Normal; quarta categoria excluída do topo. |
| Percentual acima de 100% | PASS | Texto 105%, `data-real-percent=105.00`, `aria-valuenow=100`. |
| Estado vazio | PASS | Mensagem “Você ainda não tem orçamentos...”, sem percentual e sem barras. |
| Limite zero | PASS | Mensagem “Defina limites...”, sem percentual e sem barras. |
| Modal existente | PASS | `#panelOrcamento` aberto pelo botão do card. |
| Alternância repetida | PASS | Hosts/resumo/ações/barras permanecem 1/1/1/4 após 5 ciclos. |
| Responsividade | PASS | Sem overflow e sem sobreposição com a nav nos quatro viewports. |
| Tipografia final | PASS | Rótulo 13px, percentual 20/24px, status 11px, categoria e ação 12px. |
| Valores em uma linha | PASS | Mesmo `y` em 320/360/390/1280. |
| Playwright local | BLOCKED | `Unsupported platform: android`; `sh: 1: playwright: not found`. |
| C.O.D.E. remoto | NOT RUN | Workflow manual não disparado. |
| Firebase real | NOT RUN | Sem credenciais reais; fixture fictícia em memória. |
| Auditoria independente | NOT RUN | Não realizada. |

## 3. Evidências

### Relatórios
- `tmp-c13/c6-3/RELATORIO-AUDITORIA-C6-INICIO-03.md` — auditoria de isolamento e classificação dos acoplamentos.
- `tmp-c13/c6-3/RELATORIO-IMPLEMENTACAO-C6-03-ORCAMENTOS.md` — implementação, validações, limitações e diff.
- `tmp-c13/c6-3/validacao-c6-03.json` — snapshot CDP de cálculo, modal, alternância e layout.
- `tmp-c13/c6-3/evidencias-finais.json` — medidas finais de tipografia, valores em linha e lista de capturas.
- `tmp-c13/c6-3/RELATORIO-RESOLUCAO-C6-INICIO-03.md` — diagnóstico A-05 a A-08, P-01/P-02, correções e parecer final.
- `tmp-c13/c6-3/diagnostico-pre-correcao.json` — estado CDP observado antes das correções.
- `tmp-c13/c6-3/diagnostico-pos-correcao.json` — estado CDP observado depois das correções.
- `tmp-c13/c6-3/validacao-estado-vazio-ciclo.json` — distinção entre sem orçamento, orçamento antigo, limite zero e limite positivo.

### Bloco de Orçamentos
- `prints/orcamento-final-320.png`
- `prints/orcamento-final-360.png`
- `prints/orcamento-final-390.png`
- `prints/final-320-orcamento-bni.png`
- `prints/final-390-orcamento-bni.png`
- `prints/orcamento-final-1280.png`
- `prints/orcamento-390-fontes.png` — comparação após primeiro ajuste tipográfico.
- `prints/orcamento-320-valores-linha.png` — validação dos três valores em uma linha em 320px.
- `prints/p01-status-apos-390.png` — status geral corrigido (`53% · Limite excedido`).
- `prints/a07-alertas-apos-390.png` — alertas da Visão Geral estáveis após correção.

### Barra de navegação inferior
- `prints/nav-final-320.png`
- `prints/nav-final-360.png`
- `prints/nav-final-390.png`
- `prints/nav-final-390-caixa.png`
- `prints/nav-final-390-dashboard.png`
- `prints/nav-final-390-escuro.png`
- `prints/nav-uniformizada-320.png`
- `prints/nav-uniformizada-360.png`
- `prints/nav-uniformizada-390.png`
- `nav-uniformizada.json` — gaps, largura do ativo e alinhamento da pílula após uniformização.

### Testes
- `e2e/smoke/inicio-orcamentos.spec.js` — cálculo, estado vazio/zero, navegação, alternância, duplicação, responsividade, P-01, A-07 e P-02.

## 4. Limitações

- Os prints e medições CDP usam fixture fictícia em memória; não representam dados financeiros reais.
- O spec E2E foi escrito, mas não executado localmente por indisponibilidade do Playwright no Android.
- A-05 e A-06 permanecem documentados como acoplamentos com `dash` e Livro-Caixa, fora do escopo desta resolução.
- O veredito definitivo de isolamento depende de CI/PC, C.O.D.E. e revisão independente.
- C6-INICIO-02 permanece preservada em `db5bdb9`, com pendências P-01/P-03/P-04 registradas.
