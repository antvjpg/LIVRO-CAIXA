# LIVRO-CAIXA — Checklist de Testes (alterações implementadas)

Este documento lista **tudo que foi alterado/implementado** na sessão atual, para servir como roteiro de teste funcional e de regressão. Todas as alterações estão **locais** (sem commit/push).

## 1. Gráfico de pizza — fatia mínima para porcentagens pequenas

- **Arquivo**: `js/18-render-core.js`
- **Mudança**: `groupCategoryRowsForChart` agora aceita `minPct` (padrão 2%). Slices abaixo de 2% são agrupadas em "Outras".
- **Testar**:
  - [ ] Abrir a tela de resumo de categorias (gastos/entradas por categoria).
  - [ ] Com muitas categorias de valor pequeno, verificar se slices minúsculas somam "Outras".
  - [ ] Verificar se o total ainda confere com a soma das categorias listadas + "Outras".

## 2. Linha tracejada entre gráfico de barras e legenda

- **Arquivo**: `style/components.css` (`.cat-bars-list`)
- **Mudança**: `border-top:1px dashed var(--line)`, `margin-top:12px`, `padding-top:12px`.
- **Testar**:
  - [ ] Abrir gráfico de categoria no modo barras.
  - [ ] Verificar linha tracejada separando o gráfico da lista de barras.

## 3. Card de período ativo — espaçamento reduzido

- **Arquivo**: `style/components.css` (`.period-bar`)
- **Mudança**: `padding:10px 12px` → `8px 12px`; `margin-bottom:18px` → `12px`; gap `10px` → `8px`; mobile `padding:11px` → `8px 10px`.
- **Testar**:
  - [ ] Abrir a barra de período (topo da tela Caixa).
  - [ ] Verificar que o card está mais compacto.

## 4. Barra de pesquisa universal — contorno menos forte

- **Arquivo**: `style/layout.css` (`.header-search-bar` no mobile)
- **Mudança**: `border-color:var(--gold)` → `border:1px solid color-mix(in srgb,var(--gold) 45%,transparent)`; `box-shadow` reduzido.
- **Testar**:
  - [ ] Abrir o app no mobile (ou simular largura ≤680px).
  - [ ] Clicar na barra de busca no header.
  - [ ] Verificar que o contorno está mais suave, não "evidente".

## 5. Barra de navegação inferior (BNI) — sem nomes, ícones maiores

- **Arquivo**: `index.html` + `style/layout.css`
- **Mudança**: spans de texto removidos dos botões da BNI; ícone 21→24px; svg 20→22px; padding ajustado; `grid-template-rows:28px`.
- **Testar**:
  - [ ] Abrir no mobile.
  - [ ] Verificar que a BNI mostra apenas ícones (sem texto "Visão geral", "Caixinhas", etc.).
  - [ ] Verificar que os ícones estão maiores e centralizados.

## 6. Botão atualizar cotações (investimentos) — ícone | texto, rotação

- **Arquivo**: `index.html` + `style/components.css` + `js/29-invest-movements.js`
- **Mudança**: Botão agora `[ícone de atualização] | Atualizar Cotações`; ícone gira (animação `quoteRefreshSpin`) durante a atualização; contorno do botão suave.
- **Testar**:
  - [ ] Abrir aba Investimentos.
  - [ ] Clicar "Atualizar Cotações".
  - [ ] Verificar ícone girando durante o processo.
  - [ ] Verificar retorno da mensagem de sucesso/erro.

## 7. Mini card de rendimento — texto ao lado do valor

- **Arquivo**: `js/18-render-core.js` + `style/components.css`
- **Mudança**: `rentabilityHTML` agora retorna `<span class="yield-inline">• +R$0,01 (rendimento)</span>` ao lado do valor, fonte menor (10px), cor suave. Aplicado a investimentos e caixinhas.
- **Testar**:
  - [ ] Abrir aba Investimentos e Caixinhas.
  - [ ] Verificar que cada item mostra `Valor • +R$X,XX (rendimento)` na mesma linha.
  - [ ] Verificar que a fonte do rendimento é menor que a do valor principal.

## 8. Botão de conciliar — Flaticon

- **Arquivo**: `js/18-render-core.js` + `style/components.css`
- **Mudança**: Texto "Conciliar" substituído por ícone `fi-rr-money-bill-wave`; botão quadrado 34×34px com contorno suave.
- **Testar**:
  - [ ] Abrir aba Investimentos.
  - [ ] Verificar botão de conciliar com ícone (sem texto).
  - [ ] Clicar e verificar que abre o modal de conciliação.

## 9. Botão de movimentação — "Expandir" (sem função)

- **Arquivo**: `index.html` + `style/components.css`
- **Mudança**: Botão "Expandir" adicionado nos modais de movimentação de caixinhas e investimentos.
- **Testar**:
  - [ ] Abrir modal de movimentação (caixinha ou investimento).
  - [ ] Verificar botão "Expandir" presente.
  - [ ] Clicar — não deve haver erro (função ainda não implementada).

## 10. Modal banco — não abrir teclado automaticamente

- **Arquivo**: `index.html`
- **Mudança**: `autocomplete="off"` adicionado ao input `bNome`.
- **Testar**:
  - [ ] Abrir modal "Gerenciar Bancos".
  - [ ] Verificar que o teclado não sobe automaticamente no mobile.

## 11. Modal categoria — botões padronizados

- **Arquivo**: `style/features.css` (`.cat-sub-add-btn`, `.cat-sub-input`)
- **Mudança**: Botão "+" agora 30×30px; input com `min-height:28px`; ambos com mesma altura/contorno.
- **Testar**:
  - [ ] Abrir modal "Gerenciar Categorias".
  - [ ] Adicionar subcategoria.
  - [ ] Verificar que o botão "+" e o input estão alinhados e com mesmo tamanho.

## 12. Renomear `beta-icon-button` → `icon-button`

- **Arquivo**: `js/18-render-core.js`, `js/27-cards.js`, `style/features.css`
- **Mudança**: Todas as ocorrências da classe `beta-icon-button` renomeadas para `icon-button`; mantida a classe antiga como fallback em `features.css`.
- **Testar**:
  - [ ] Abrir telas com botões de editar/excluir/mover (bancos, categorias, investimentos, caixinhas, lançamentos, cartões).
  - [ ] Verificar que todos os botões de ação (ícone-only) funcionam e têm o estilo correto.

## 13. Drag-handle — cantos arredondados

- **Arquivo**: `style/features.css` (`.drag-handle`)
- **Mudança**: `border-radius:9px` → `999px` (contorno totalmente arredondado).
- **Testar**:
  - [ ] Abrir aba Investimentos ou Caixinhas.
  - [ ] Verificar o ícone de arrastar (canto superior direito do card) com cantos totalmente arredondados.

## 14. Perfil — troca de moeda (BRL/USD/BTC)

- **Arquivo**: `index.html` + `js/99-init.js`
- **Mudança**: Select "Moeda do app" com opções BRL, USD, BTC; `setMoneyCurrency()` recria o `Intl.NumberFormat`.
- **Testar**:
  - [ ] Abrir aba Perfil → Configurações gerais.
  - [ ] Alterar para USD e BTC.
  - [ ] Verificar que valores em todo o app mudam o símbolo da moeda.

## 15. Perfil — troca de fonte (Google Fonts)

- **Arquivo**: `index.html` + `style/features.css` + `js/99-init.js`
- **Mudança**: Select "Fonte do app" com Plus Jakarta Sans, Inter, Roboto, Open Sans; Google Fonts carregado no `<head>`; `body[data-font="..."]` aplica a fonte.
- **Testar**:
  - [ ] Abrir aba Perfil → Configurações gerais.
  - [ ] Alterar a fonte.
  - [ ] Verificar que o texto do app muda de tipografia.

## 16. Perfil — grouped list com linha tracejada parcial

- **Arquivo**: `index.html` + `style/components.css`
- **Mudança**: Itens Aparência, Categorias, Dia de virada, Avisar fatura, Aviso contas, Notificações push envolvidos em `.profile-grouped-list` com `::after` tracejado parcial (não vai de ponta a ponta).
- **Testar**:
  - [ ] Abrir aba Perfil → Configurações gerais.
  - [ ] Verificar que os 6 itens estão agrupados com linha tracejada entre eles (não nas extremidades).

## 17. Diagnóstico + Análise assistida — mesclados

- **Arquivo**: `js/99-init.js`
- **Mudança**: Botão "Detectar anomalias" agora também executa `renderDiagnosticResults()` e exibe o resultado no card de análise.
- **Testar**:
  - [ ] Abrir aba Perfil → Análise assistida.
  - [ ] Clicar "Detectar anomalias".
  - [ ] Verificar que aparece tanto a anomalia quanto o diagnóstico de consistência no card de resultado.

## 18. Análise assistida — card tracejado arredondado

- **Arquivo**: `index.html` + `style/features.css`
- **Mudança**: `.analysis-result-card` com `border:2px dashed var(--line)`, `border-radius:16px`, fundo do tema.
- **Testar**:
  - [ ] Gerar uma análise (anomalias ou diagnóstico).
  - [ ] Verificar card com borda tracejada e cantos arredondados.

## 19. Foto de perfil — grid de avatares predefinidos

- **Arquivo**: `index.html` + `style/features.css` + `js/99-init.js`
- **Mudança**: Grupo "Foto de perfil" com avatar clicável e grid de 12 avatares (DiceBear API, sem download de imagens). Seleção persistida em `localStorage`.
- **Testar**:
  - [ ] Abrir aba Perfil → Dados da conta → Foto de perfil.
  - [ ] Clicar "Escolher foto".
  - [ ] Selecionar um avatar.
  - [ ] Verificar que o avatar muda e persiste após recarregar.

## 20. Card de conciliação — layout 4 linhas

- **Arquivo**: `index.html`
- **Mudança**: Header alterado para "Conciliação Bancária"; balanços movidos abaixo dos botões; estrutura Linha 1 (título), Linha 2 (Banco | Saldo informado), Linha 3 (campos), Linha 4 (botões).
- **Testar**:
  - [ ] Abrir aba Perfil → Conciliação bancária.
  - [ ] Verificar o novo layout em 4 linhas.

## 21. Análise assistida — texto simplificado

- **Arquivo**: `index.html`
- **Mudança**: Texto de "Auto-categorização simples" encurtado.
- **Testar**:
  - [ ] Abrir aba Perfil → Análise assistida.
  - [ ] Ler o texto simplificado.

## 22. Orçamento — mini cards em 3 linhas

- **Arquivo**: `js/20-dashboard.js` + `style/layout.css` + `style/features.css`
- **Mudança**: `feature-budget-row` agora em coluna com 3 linhas: (1) Nome da categoria | Campo de Valor, (2) valor gasto e porcentagem, (3) barra de progresso.
- **Testar**:
  - [ ] Abrir aba Perfil → Orçamento.
  - [ ] Verificar que cada categoria tem 3 linhas distintas.
  - [ ] Verificar barra de progresso preenchendo conforme o gasto.
  - [ ] Verificar status (Normal / Atenção / Excedido).

## 23. Skill ponytail (agente de código)

- **Arquivo**: `.opencode/skills/ponytail/SKILL.md` (novo)
- **Mudança**: Skill adicionada para reforçar mudanças mínimas / YAGNI.
- **Testar**: Não aplica (afeta apenas o agente de código).

## 24. Documentação de variáveis CSS

- **Arquivo**: `DOCUMENTACAO_VARIAVEIS_CSS.md` (novo)
- **Mudanda**: Documento criado com todas as variáveis `--*` e instruções de tema.

## Validação técnica executada

- [ ] `npm run code:syntax` → `SINTAXE: OK (0 bloco(s) inline de index.html + 42 arquivo(s) .js)`
- [ ] `node --check` em `js/99-init.js`, `js/18-render-core.js`, `js/20-dashboard.js`, `js/29-invest-movements.js` → OK

## Observações

- Todas as alterações estão **locais** (sem `git commit` / `git push`).
- O E2E não roda localmente no Termux/Android (`Unsupported platform: android`); a validação real depende do CI do GitHub.
- Não houve alteração de schema do Firestore, autenticação ou regras financeiras.
- Backups `*.backup-*` e `*.bak-*` não foram tocados.

## Ciclo pós-f0d4280 — correção dos gaps restantes

Os itens 1–17 acima passaram por um ciclo de correção dos gaps/bugs ainda
abertos. Correções aplicadas (arquivos tocados neste ciclo):

| # | Gap | Correção | Arquivos |
|---|---|---|---|
| 1 | Pizza: fatias <2% invisíveis em % | `groupCategoryRowsForChart(rows, total, 2)` no HTML e no doughnut de entradas (agrupa em "Outras") | `js/20-dashboard.js` |
| 2 | Sem tracejado entre gráfico e legenda | Plugin `dashLegendDividerPlugin` (traço `[5,4]`, `afterDraw`) ligado a `dashFlowChart` e `dashIncomeCatChart` | `js/20-dashboard.js` |
| 3 | Busca universal com contorno forte | Bordas gold suavizadas (`color-mix` 45%) em light/dark | `style/base.css`, `style/layout.css` |
| 4 | Botão mover sem ícone | `.action-btn.icon-button.move::after` com mask SVG (padrão do delete) | `style/features.css` |
| 5 | `drag-placeholder` sem raio herdado | `border-radius: 15px` (raio real dos cards) | `style/features.css` |
| 6 | Modal banco/categoria abria teclado | `data-no-autofocus` + `openModal` foca o painel (`tabindex=-1`) nesses painéis | `index.html`, `js/24-automation-render.js` |
| 7 | Moeda BRL/USD/BTC | Exibição convertida (CoinGecko + cache `livrocaixa_fx_brl`, stale-while-revalidate); **inputs/digitação seguem BRL**; sem cotação → revert + toast | `js/10-state-utils.js`, `js/99-init.js` + símbolo residual em 5 arquivos |
| 8 | Fonte do app sem efeito | `--font-ui` vencendo `!important` de base.css; persistência `livrocaixa_display_font` | `style/features.css`, `js/99-init.js` |
| 9 | Barra de período visível no Perfil | `#universalPeriodBar.section-hidden{display:none}` + toggle no `switchTab` | `style/features.css` |
| 10 | Switches invisíveis no dark | Thumb claro (`#F2F3F1`) no dark-mode (unchecked) | `style/features.css` |
| 11 | Card de análise sem anomalias | "Detectar anomalias" renderiza anomalias **e** diagnóstico no card (checklist 17); `runAnomalyScan` retorna o array | `js/99-init.js`, `js/21-ai-features.js` |

Decisões de escopo (deliberadas):

- **Moeda**: apenas exibição; armazenamento e inputs (`MONEY_FORMATTER`,
  `readMoneyInput`/`setMoneyInput`) continuam em BRL — evita drift de
  arredondamento no round-trip dos inputs (especialmente BTC).
- **Persistência das prefs de exibição** (moeda/fonte): somente `localStorage`
  (aplicam pré-login e não dependem do perfil no Firestore).
- `beta-icon-button` órfão em `layout.css` mantido como fallback (legado).

Validação deste ciclo:

- `npm run code:syntax` → OK (42 arquivos).
- Auditoria de modais (`e2e/visual/audit-modais.cjs`, chromium do sistema):
  24/26 painéis medidos, sem overflow/corte; 2 bloqueios são guards reais do
  app (sem banco / sem cartão).
- Probe funcional (26/26 checks): foco dos modais; USD/BTC/BRL na exibição
  (fmt, storage, revert de rede); fonte Inter; barra oculta no Perfil;
  card com "Anomalias" + "Diagnóstico"; pizza com fatia "Outras"; plugin
  tracejado nos dois gráficos; switches dark; busca com borda gold; sem
  erros de página relevantes.
