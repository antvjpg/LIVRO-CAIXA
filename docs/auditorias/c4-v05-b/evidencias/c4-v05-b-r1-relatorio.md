# C.4-V05-B-R1 — Relatório consolidado (auditoria runtime somente leitura)

**Status:** concluído — inspeção somente leitura, sem alterar o repositório.
**Ambiente:** Chromium headless + CDP porta 9222, app `http://127.0.0.1:8000/index.html`, viewports 390×844 (mobile) e 1440×900 (desktop), temas claros 1–5 + escuros como controle de regressão.
**Limiares (sem arredondar):** texto normal 4,5:1; texto grande (≥24px ou ≥18,66px e ≥700) 3:1; componentes gráficos / indicadores funcionais e foco WCAG 1.4.11 3:1.

## Evidências (fora do repositório)
- JSON: `/data/data/com.termux/files/usr/tmp/opencode/c4-v05-b-r1.json` (hash `3f795f6014732465`, 10.161 linhas amostradas, 960 sondas de estado, 0 erros, 0 exceções, 0 pulos)
- Log execução: `/data/data/com.termux/files/usr/tmp/opencode/c4-v05-b-r1-run.log`
- Log auditoria: `/data/data/com.termux/files/usr/tmp/opencode/c4-v05-b-r1.log`

**Repositório:** `git status --short` vazio — nenhum arquivo alterado, criado, removido, commitado ou enviado.

## Resumo por consumidor (seletor CSS)

| seletor | amostras | aprovado | falha | inconclusivo | N.A. | pior razão | pior valor (limiar) | exemplo de falha |
|---|---:|---:|---:|---:|---:|---|---|---|
| .profile-item-icon | 952 | 0 | 952 | 0 | 0 | superfície 1.177 (3.0) | Tdark5 mobile profile · '' · fg=False bg=rgb(232, 80, 2) |
| label | 480 | 96 | 384 | 0 | 0 | texto 3.373 (4.5) | Tlight4 mobile panel:panelNovo · 'TIPO' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-search | 246 | 246 | 0 | 0 | 0 | — | — |
| #block1-circle | 240 | 240 | 0 | 0 | 0 | — | — |
| #btnRunReconciliation | 240 | 50 | 190 | 0 | 0 | superfície 1.128 (3.0) | Tlight4 mobile profile · 'Comparar saldos' · fg=False bg=rgb(198, 111, 80) |
| .feature-profile-switch | 240 | 140 | 100 | 0 | 0 | ícone 1.517 (3.0) | Tdark1 mobile profile · '' · fg=False bg=rgb(241, 237, 225) |
| .fi.fi-rr-lock | 240 | 240 | 0 | 0 | 0 | — | — |
| #btnOpenAvatarGrid | 238 | 0 | 238 | 0 | 0 | superfície 1.112 (3.0) | Tlight5 desktop profile · '' · fg=False bg=rgb(232, 80, 2) |
| img | 238 | 238 | 0 | 0 | 0 | — | — |
| .nav-icon | 184 | 0 | 0 | 0 | 184 | — | — |
| .balance-symbol | 181 | 0 | 181 | 0 | 0 | superfície 1.056 (3.0) | Tlight5 mobile inicio · '' · fg=False bg=rgb(232, 80, 2) |
| .is-active | 180 | 12 | 8 | 0 | 160 | texto 3.626 (4.5) | Tlight4 mobile dash · '30 DIAS' · fg=False bg=rgb(255, 255, 255) |
| #fabAdd | 130 | 130 | 0 | 0 | 0 | — | — |
| span | 130 | 16 | 44 | 0 | 70 | superfície 1.004 (3.0) | Tlight1 mobile panel:panelCard · '◷' · fg=False bg=rgb(95, 122, 67) |
| .fi.fi-rr-credit-card | 129 | 106 | 23 | 0 | 0 | ícone 2.97 (3.0) | Tlight4 mobile profile · '' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-user | 129 | 129 | 0 | 0 | 0 | — | — |
| .dash-section-index | 120 | 72 | 48 | 0 | 0 | texto 1.746 (4.5) | Tdark1 mobile dash · '06' · fg=False bg=rgb(157, 208, 139) |
| .fi.fi-rr-bell | 119 | 96 | 23 | 0 | 0 | ícone 2.97 (3.0) | Tlight4 mobile profile · '' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-calculator-money | 119 | 96 | 23 | 0 | 0 | ícone 2.97 (3.0) | Tlight4 mobile profile · '' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-calendar | 119 | 96 | 23 | 0 | 0 | ícone 2.97 (3.0) | Tlight4 mobile profile · '' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-file-code | 119 | 96 | 23 | 0 | 0 | ícone 2.97 (3.0) | Tlight4 mobile profile · '' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-palette | 119 | 96 | 23 | 0 | 0 | ícone 2.97 (3.0) | Tlight4 mobile profile · '' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-tags | 119 | 96 | 23 | 0 | 0 | ícone 2.97 (3.0) | Tlight4 mobile profile · '' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-text-size | 119 | 96 | 23 | 0 | 0 | ícone 2.97 (3.0) | Tlight4 mobile profile · '' · fg=False bg=rgb(198, 111, 80) |
| .quick-action-icon | 108 | 0 | 108 | 0 | 0 | superfície 1.011 (3.0) | Tlight5 mobile caixa · '' · fg=False bg=rgb(232, 80, 2) |
| .dash-kpi.dash-kpi-main | 100 | 0 | 0 | 0 | 100 | — | — |
| .dash-section-meta | 100 | 0 | 100 | 0 | 0 | superfície 1.047 (3.0) | Tlight1 mobile dash · '15/10 a 13/11/2026' · fg=False bg=rgb(95, 122, 67) |
| small | 100 | 0 | 100 | 0 | 0 | texto 1.655 (4.5) | Tdark1 mobile dash · 'ENTRADAS' · fg=False bg=rgb(157, 208, 139) |
| .fi.fi-rr-chat-arrow-grow | 55 | 53 | 2 | 0 | 0 | ícone 2.982 (3.0) | Tlight4 mobile inicio · '' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-piggy-bank | 51 | 49 | 2 | 0 | 0 | ícone 2.982 (3.0) | Tlight4 mobile inicio · '' · fg=False bg=rgb(198, 111, 80) |
| .period-eyebrow | 50 | 32 | 18 | 0 | 0 | texto 3.567 (4.5) | Tlight4 mobile caixa · 'PERÍODO ATIVO' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-book-bookmark | 47 | 47 | 0 | 0 | 0 | — | — |
| .drawer-item-icon | 40 | 0 | 0 | 0 | 40 | — | — |
| .fi.fi-rr-calendar-day | 40 | 40 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-bank | 36 | 34 | 2 | 0 | 0 | ícone 2.982 (3.0) | Tlight4 mobile inicio · '' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-wallet | 28 | 19 | 9 | 0 | 0 | ícone 1.493 (3.0) | Tlight3 desktop inicio · '' · fg=False bg=rgb(64, 145, 108) |
| #btnExpandInvestTotal | 20 | 12 | 8 | 0 | 0 | texto 3.373 (4.5) | Tlight4 mobile invest · 'Expandir' · fg=False bg=rgb(198, 111, 80) |
| #dashRangeLabel | 20 | 0 | 20 | 0 | 0 | superfície 1.122 (3.0) | Tlight4 mobile dash · '15/10 a 13/11/2026 · comparação 15/09 a 14/10/2026' · fg=False bg=rgb(198, 111, 80) |
| .bill-choice-icon | 20 | 0 | 20 | 0 | 0 | superfície 1.117 (3.0) | Tlight4 mobile panel:panelBill · '↻' · fg=False bg=rgb(198, 111, 80) |
| .dash-expand-btn | 20 | 0 | 20 | 0 | 0 | superfície 1.047 (3.0) | Tlight1 mobile dash · 'EXPANDIR' · fg=False bg=rgb(95, 122, 67) |
| .dash-segmented-pill | 20 | 20 | 0 | 0 | 0 | — | — |
| .emoji-trigger-chevron | 20 | 6 | 14 | 0 | 0 | texto 3.373 (4.5) | Tlight4 desktop panel:panelGoalForm · '⌃' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-heart | 20 | 20 | 0 | 0 | 0 | — | — |
| .goals-v2-kicker | 20 | 5 | 15 | 0 | 0 | texto 3.373 (4.5) | Tlight4 mobile goals · 'PLANEJAMENTO' · fg=False bg=rgb(198, 111, 80) |
| .modal-close | 20 | 0 | 20 | 0 | 0 | superfície 1.112 (3.0) | Tlight5 mobile panel:panelThemePicker · '×' · fg=False bg=rgb(232, 80, 2) |
| .primary | 20 | 20 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-cloud-download-alt | 18 | 18 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-cloud-upload-alt | 18 | 18 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-file-export | 18 | 18 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-file-import | 18 | 18 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-money-bill-transfer | 18 | 18 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-paste | 18 | 18 | 0 | 0 | 0 | — | — |
| #ledgerCount | 15 | 11 | 4 | 0 | 0 | texto 3.567 (4.5) | Tlight4 mobile caixa · '0' · fg=False bg=rgb(198, 111, 80) |
| .balance-card.total | 15 | 0 | 0 | 0 | 15 | — | — |
| .fi.fi-rr-layout-fluid | 14 | 14 | 0 | 0 | 0 | — | — |
| #btnNewReceivable | 10 | 4 | 6 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile receivables · 'NOVO VALOR A RECEBER' · fg=False bg=rgb(255, 255, 255) |
| #btnQuickCat | 10 | 0 | 10 | 0 | 0 | superfície 1.053 (3.0) | Tlight3 mobile panel:panelNovo · '+' · fg=False bg=rgb(64, 145, 108) |
| #btnReadClipboard | 10 | 0 | 10 | 0 | 0 | superfície 1.053 (3.0) | Tlight3 mobile panel:panelPaste · '⌘ LER ÁREA DE TRANSFERÊNCIA' · fg=False bg=rgb(64, 145, 108) |
| #btnUpdateAllPrices | 10 | 0 | 10 | 0 | 0 | superfície 1.056 (3.0) | Tlight5 mobile invest · 'Atualizar Cotações' · fg=False bg=rgb(232, 80, 2) |
| #cardSalvar | 10 | 2 | 8 | 0 | 0 | texto 1 (4.5) | Tlight3 desktop panel:panelCard · 'SALVAR CARTÃO' · fg=False bg=rgb(250, 249, 246) |
| #crSaldoRealLabel | 10 | 2 | 8 | 0 | 0 | texto 3.373 (4.5) | Tlight4 mobile panel:panelCryptoReconcile · 'SALDO NA CORRETORA (QUANTIDADE)' · fg=False bg=rgb(198, 111, 80) |
| #iCotacaoLabel | 10 | 2 | 8 | 0 | 0 | texto 3.373 (4.5) | Tlight4 mobile panel:panelInvest · 'COTAÇÃO (R$ POR UNIDADE)' · fg=False bg=rgb(198, 111, 80) |
| #iUnidadesAtualLabel | 10 | 2 | 8 | 0 | 0 | texto 3.373 (4.5) | Tlight4 mobile panel:panelInvest · 'SALDO FINAL' · fg=False bg=rgb(198, 111, 80) |
| #iUnidadesLabel | 10 | 2 | 8 | 0 | 0 | texto 3.373 (4.5) | Tlight4 mobile panel:panelInvest · 'SALDO INICIAL' · fg=False bg=rgb(198, 111, 80) |
| #imAporte | 10 | 4 | 6 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelInvestMovement · 'APORTE' · fg=False bg=rgb(255, 255, 255) |
| #imDataLabel | 10 | 2 | 8 | 0 | 0 | texto 3.373 (4.5) | Tlight4 mobile panel:panelInvestMovement · 'DATA' · fg=False bg=rgb(198, 111, 80) |
| #imQuantidadeLabel | 10 | 2 | 8 | 0 | 0 | texto 3.373 (4.5) | Tlight4 mobile panel:panelInvestMovement · 'QUANTIDADE' · fg=False bg=rgb(198, 111, 80) |
| #pmAporte | 10 | 4 | 6 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelPocketMovement · 'APORTE' · fg=False bg=rgb(255, 255, 255) |
| #pmDataLabel | 10 | 2 | 8 | 0 | 0 | texto 3.373 (4.5) | Tlight4 mobile panel:panelPocketMovement · 'DATA' · fg=False bg=rgb(198, 111, 80) |
| #tglIn | 10 | 8 | 2 | 0 | 0 | superfície 2.996 (3.0) | Tlight4 mobile panel:panelNovo · 'ENTRADA' · fg=False bg=rgb(17, 17, 17) |
| .bill-bank-mark | 10 | 0 | 10 | 0 | 0 | superfície 1.117 (3.0) | Tlight4 mobile panel:panelBill · 'P' · fg=False bg=rgb(198, 111, 80) |
| .bill-day.today | 10 | 0 | 10 | 0 | 0 | superfície 1.053 (3.0) | Tlight3 mobile bills · '13' · fg=False bg=rgb(49, 87, 44) |
| .dashboard-period | 10 | 0 | 10 | 0 | 0 | superfície 1.112 (3.0) | Tlight5 mobile dashboard · 'Novembro / 2026' · fg=False bg=rgb(232, 80, 2) |
| .fi.fi-rr-arrow-down-triangle-square | 10 | 10 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-ballot | 10 | 10 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-blood-test-tube | 10 | 10 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-bullseye-arrow | 10 | 10 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-caret-down | 10 | 10 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-clipboard | 10 | 10 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-file-excel | 10 | 10 | 0 | 0 | 0 | — | — |
| .fi.fi-rr-file-pdf | 10 | 10 | 0 | 0 | 0 | — | — |
| .light-theme-option | 10 | 8 | 2 | 0 | 0 | superfície 2.996 (3.0) | Tlight4 mobile panel:panelThemePicker · '' · fg=False bg=rgb(52, 44, 37) |
| .next-pay-kicker | 10 | 4 | 6 | 0 | 0 | texto 3.567 (4.5) | Tlight4 mobile dashboard · 'PRÓXIMO PAGAMENTO' · fg=False bg=rgb(198, 111, 80) |
| b | 10 | 0 | 0 | 0 | 10 | — | — |
| #bSalvar | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelBanco · 'ADICIONAR' · fg=False bg=rgb(255, 255, 255) |
| #billLaunchConfirm | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelBillLaunch · 'CONFIRMAR LANÇAMENTO' · fg=False bg=rgb(255, 255, 255) |
| #billSalvar | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelBill · 'SALVAR CONTA / FATURA' · fg=False bg=rgb(255, 255, 255) |
| #btnApplyFilters | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelFiltros · 'APLICAR FILTROS' · fg=False bg=rgb(255, 255, 255) |
| #btnExportFormatDocx | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelExportFormat · 'WORD (.DOCX)' · fg=False bg=rgb(255, 255, 255) |
| #btnExportFormatPdf | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelExportFormat · 'PDF' · fg=False bg=rgb(255, 255, 255) |
| #btnExportFormatXlsx | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelExportFormat · 'EXCEL (.XLSX)' · fg=False bg=rgb(255, 255, 255) |
| #btnOpenFilters | 5 | 0 | 5 | 0 | 0 | superfície 1.112 (3.0) | Tlight5 mobile caixa · '' · fg=False bg=rgb(232, 80, 2) |
| #btnProcessPaste | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelPaste · 'GERAR PRÉVIA' · fg=False bg=rgb(255, 255, 255) |
| #btnSaveGoal | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelGoalForm · 'SALVAR META' · fg=False bg=rgb(255, 255, 255) |
| #cSalvar | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelCategoria · 'ADICIONAR' · fg=False bg=rgb(255, 255, 255) |
| #crConfirmar | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelCryptoReconcile · 'APLICAR AJUSTE' · fg=False bg=rgb(255, 255, 255) |
| #iSalvar | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelInvest · 'SALVAR ATIVO' · fg=False bg=rgb(255, 255, 255) |
| #imSalvar | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelInvestMovement · 'REGISTRAR LANÇAMENTO' · fg=False bg=rgb(255, 255, 255) |
| #pSalvar | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelPocket · 'SALVAR CAIXINHA' · fg=False bg=rgb(255, 255, 255) |
| #pmSalvar | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelPocketMovement · 'REGISTRAR APORTE' · fg=False bg=rgb(255, 255, 255) |
| #purchaseSalvar | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelPurchase · 'SALVAR COMPRA' · fg=False bg=rgb(255, 255, 255) |
| #recvSalvar | 5 | 2 | 3 | 0 | 0 | texto 3.626 (4.5) | Tlight4 mobile panel:panelReceivable · 'SALVAR' · fg=False bg=rgb(255, 255, 255) |
| .fi.fi-rr-chart-line-up | 5 | 1 | 4 | 0 | 0 | ícone 1.493 (3.0) | Tlight3 desktop invest · '' · fg=False bg=rgb(64, 145, 108) |
| .fi.fi-rr-filter-list | 5 | 4 | 1 | 0 | 0 | ícone 2.982 (3.0) | Tlight4 mobile caixa · '' · fg=False bg=rgb(198, 111, 80) |
| .fi.fi-rr-refresh | 5 | 4 | 1 | 0 | 0 | ícone 2.982 (3.0) | Tlight4 mobile invest · '' · fg=False bg=rgb(198, 111, 80) |
| .quote-refresh-icon | 5 | 0 | 0 | 0 | 5 | — | — |
| .quote-refresh-label | 5 | 0 | 5 | 0 | 0 | texto 2.982 (4.5) | Tlight4 mobile invest · 'Atualizar Cotações' · fg=False bg=rgb(198, 111, 80) |
| #fSalvar | 2 | 2 | 0 | 0 | 0 | — | — |
| #tSalvar | 2 | 2 | 0 | 0 | 0 | — | — |
| .dark-theme-option | 2 | 2 | 0 | 0 | 0 | — | — |

## Falhas detalhadas (piores por seletor)
### .profile-item-icon — 952 falha(s)

- Tlight 1 · mobile · profile · `.profile-item-icon` · texto='' · superfície **1.247** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 228.75999, 'g': 230.24000999999998, 'b': 218.36007, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · profile · `.profile-item-icon` · texto='' · superfície **1.247** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 228.75999, 'g': 230.24000999999998, 'b': 218.36007, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · profile · `.profile-item-icon` · texto='' · superfície **1.247** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 228.75999, 'g': 230.24000999999998, 'b': 218.36007, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · profile · `.profile-item-icon` · texto='' · superfície **1.247** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 228.75999, 'g': 230.24000999999998, 'b': 218.36007, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · profile · `.profile-item-icon` · texto='' · superfície **1.247** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 228.75999, 'g': 230.24000999999998, 'b': 218.36007, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · profile · `.profile-item-icon` · texto='' · superfície **1.247** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 228.75999, 'g': 230.24000999999998, 'b': 218.36007, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- … e mais 946 amostras (mesmo padrão em outros temas/viewports/abas).

### label — 384 falha(s)

- Tlight 1 · mobile · panel:panelNovo · `label` · texto='TIPO' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelNovo · `label` · texto='DATA' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelNovo · `label` · texto='DESCRIÇÃO' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelNovo · `label` · texto='BANCO' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelNovo · `label` · texto='CATEGORIA' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelTransferencia · `label` · texto='DATA' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 378 amostras (mesmo padrão em outros temas/viewports/abas).

### #btnOpenAvatarGrid — 238 falha(s)

- Tlight 1 · mobile · profile · `#btnOpenAvatarGrid` · texto='' · superfície **1.191** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 232.600035, 'g': 235.52004, 'b': 224.38011, 'a': 1} · fs=12 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · drawer · `#btnOpenAvatarGrid` · texto='' · superfície **1.191** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 232.600035, 'g': 235.52004, 'b': 224.38011, 'a': 1} · fs=12 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelNovo · `#btnOpenAvatarGrid` · texto='' · superfície **1.191** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 232.600035, 'g': 235.52004, 'b': 224.38011, 'a': 1} · fs=12 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelTransferencia · `#btnOpenAvatarGrid` · texto='' · superfície **1.191** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 232.600035, 'g': 235.52004, 'b': 224.38011, 'a': 1} · fs=12 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelThemePicker · `#btnOpenAvatarGrid` · texto='' · superfície **1.191** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 232.600035, 'g': 235.52004, 'b': 224.38011, 'a': 1} · fs=12 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelCard · `#btnOpenAvatarGrid` · texto='' · superfície **1.191** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 232.600035, 'g': 235.52004, 'b': 224.38011, 'a': 1} · fs=12 fw=400 · large=False hasText=False icon=False · incerto=[]
- … e mais 232 amostras (mesmo padrão em outros temas/viewports/abas).

### #btnRunReconciliation — 190 falha(s)

- Tlight 1 · mobile · profile · `#btnRunReconciliation` · texto='Comparar saldos' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 229.40004, 'g': 232.88002500000002, 'b': 220.72009500000001, 'a': 1} · fs=12 fw=650 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · drawer · `#btnRunReconciliation` · texto='Comparar saldos' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 229.40004, 'g': 232.88002500000002, 'b': 220.72009500000001, 'a': 1} · fs=12 fw=650 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelNovo · `#btnRunReconciliation` · texto='Comparar saldos' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 229.40004, 'g': 232.88002500000002, 'b': 220.72009500000001, 'a': 1} · fs=12 fw=650 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelTransferencia · `#btnRunReconciliation` · texto='Comparar saldos' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 229.40004, 'g': 232.88002500000002, 'b': 220.72009500000001, 'a': 1} · fs=12 fw=650 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelThemePicker · `#btnRunReconciliation` · texto='Comparar saldos' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 229.40004, 'g': 232.88002500000002, 'b': 220.72009500000001, 'a': 1} · fs=12 fw=650 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelCard · `#btnRunReconciliation` · texto='Comparar saldos' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 229.40004, 'g': 232.88002500000002, 'b': 220.72009500000001, 'a': 1} · fs=12 fw=650 · large=False hasText=True icon=False · incerto=[]
- … e mais 184 amostras (mesmo padrão em outros temas/viewports/abas).

### .balance-symbol — 181 falha(s)

- Tlight 1 · mobile · inicio · `.balance-symbol` · texto='' · superfície **1.223** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · inicio · `.balance-symbol` · texto='' · superfície **1.223** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · inicio · `.balance-symbol` · texto='' · superfície **1.223** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · inicio · `.balance-symbol` · texto='' · superfície **1.223** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · inicio · `.balance-symbol` · texto='' · superfície **1.183** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 225.71988, 'g': 227.780025, 'b': 214.92012, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · inicio · `.balance-symbol` · texto='' · superfície **1.183** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 225.71988, 'g': 227.780025, 'b': 214.92012, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- … e mais 175 amostras (mesmo padrão em outros temas/viewports/abas).

### .quick-action-icon — 108 falha(s)

- Tlight 1 · mobile · caixa · `.quick-action-icon` · texto='' · superfície **1.263** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 225.71988, 'g': 227.780025, 'b': 214.92012, 'a': 1} · fs=9 fw=700 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · caixa · `.quick-action-icon` · texto='' · superfície **1.263** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 225.71988, 'g': 227.780025, 'b': 214.92012, 'a': 1} · fs=9 fw=700 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · caixa · `.quick-action-icon` · texto='' · superfície **1.263** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 225.71988, 'g': 227.780025, 'b': 214.92012, 'a': 1} · fs=9 fw=700 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · caixa · `.quick-action-icon` · texto='' · superfície **1.263** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 225.71988, 'g': 227.780025, 'b': 214.92012, 'a': 1} · fs=9 fw=700 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · caixa · `.quick-action-icon` · texto='' · superfície **1.263** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 225.71988, 'g': 227.780025, 'b': 214.92012, 'a': 1} · fs=9 fw=700 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · mobile · caixa · `.quick-action-icon` · texto='' · superfície **1.263** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 225.71988, 'g': 227.780025, 'b': 214.92012, 'a': 1} · fs=9 fw=700 · large=False hasText=False icon=False · incerto=[]
- … e mais 102 amostras (mesmo padrão em outros temas/viewports/abas).

### .dash-section-meta — 100 falha(s)

- Tlight 1 · mobile · dash · `.dash-section-meta` · texto='Todas as contas' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · dash · `.dash-section-meta` · texto='5 bloco(s)' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · dash · `.dash-section-meta` · texto='Ciclo 2026-11' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · dash · `.dash-section-meta` · texto='tudo em dia' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · dash · `.dash-section-meta` · texto='15/10 a 13/11/2026' · superfície **1.047** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=['dash-section dash-health-section', 'dash-section dash-health-section']
- Tlight 2 · mobile · dash · `.dash-section-meta` · texto='Todas as contas' · superfície **1.131** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 94 amostras (mesmo padrão em outros temas/viewports/abas).

### .feature-profile-switch — 100 falha(s)

- Tlight 2 · mobile · profile · `.feature-profile-switch` · texto='' · ícone **2.53** (limiar 3.0) · cor=rgb(25, 53, 42) bg={'r': 50, 'g': 121, 'b': 87, 'a': 1} · fs=11 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 2 · mobile · drawer · `.feature-profile-switch` · texto='' · ícone **2.53** (limiar 3.0) · cor=rgb(25, 53, 42) bg={'r': 50, 'g': 121, 'b': 87, 'a': 1} · fs=11 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 2 · mobile · panel:panelNovo · `.feature-profile-switch` · texto='' · ícone **2.53** (limiar 3.0) · cor=rgb(25, 53, 42) bg={'r': 50, 'g': 121, 'b': 87, 'a': 1} · fs=11 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 2 · mobile · panel:panelTransferencia · `.feature-profile-switch` · texto='' · ícone **2.53** (limiar 3.0) · cor=rgb(25, 53, 42) bg={'r': 50, 'g': 121, 'b': 87, 'a': 1} · fs=11 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 2 · mobile · panel:panelThemePicker · `.feature-profile-switch` · texto='' · ícone **2.53** (limiar 3.0) · cor=rgb(25, 53, 42) bg={'r': 50, 'g': 121, 'b': 87, 'a': 1} · fs=11 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 2 · mobile · panel:panelCard · `.feature-profile-switch` · texto='' · ícone **2.53** (limiar 3.0) · cor=rgb(25, 53, 42) bg={'r': 50, 'g': 121, 'b': 87, 'a': 1} · fs=11 fw=400 · large=False hasText=False icon=True · incerto=[]
- … e mais 94 amostras (mesmo padrão em outros temas/viewports/abas).

### small — 100 falha(s)

- Tlight 1 · mobile · dash · `small` · texto='ENTRADAS' · texto **4.102** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=['dash-kpi dash-kpi-main', 'dash-kpi dash-kpi-main']
- Tlight 1 · mobile · dash · `small` · texto='SAÍDAS' · texto **4.102** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=['dash-kpi dash-kpi-main', 'dash-kpi dash-kpi-main']
- Tlight 1 · mobile · dash · `small` · texto='RESULTADO' · texto **4.102** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=['dash-kpi dash-kpi-main', 'dash-kpi dash-kpi-main']
- Tlight 1 · mobile · dash · `small` · texto='SALDO DISPONÍVEL' · texto **4.102** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=['dash-kpi dash-kpi-main', 'dash-kpi dash-kpi-main']
- Tlight 1 · mobile · dash · `small` · texto='PROJEÇÃO FIM DE MÊS' · texto **4.102** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=['dash-kpi dash-kpi-main', 'dash-kpi dash-kpi-main']
- Tlight 2 · mobile · dash · `small` · texto='ENTRADAS' · texto **4.408** (limiar 4.5) · cor=rgb(50, 121, 87) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=['dash-kpi dash-kpi-main', 'dash-kpi dash-kpi-main']
- … e mais 94 amostras (mesmo padrão em outros temas/viewports/abas).

### .dash-section-index — 48 falha(s)

- Tlight 1 · mobile · dash · `.dash-section-index` · texto='06' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=700 · large=False hasText=True icon=False · incerto=['dash-section dash-health-section', 'dash-section dash-health-section']
- Tlight 3 · mobile · dash · `.dash-section-index` · texto='01' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · dash · `.dash-section-index` · texto='02' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · dash · `.dash-section-index` · texto='03' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · dash · `.dash-section-index` · texto='04' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · dash · `.dash-section-index` · texto='05' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=700 · large=False hasText=True icon=False · incerto=[]
- … e mais 42 amostras (mesmo padrão em outros temas/viewports/abas).

### span — 44 falha(s)

- Tlight 1 · mobile · dash · `span` · texto='EXPANDIR' · texto **4.23** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=9 fw=600 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelCard · `span` · texto='◷' · superfície **1.004** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=15 fw=900 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelCard · `span` · texto='✓' · superfície **1.004** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=15 fw=900 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · panel:panelCard · `span` · texto='◷' · superfície **1.043** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=15 fw=900 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · panel:panelCard · `span` · texto='✓' · superfície **1.043** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=15 fw=900 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · dash · `span` · texto='EXPANDIR' · texto **3.356** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=9 fw=600 · large=False hasText=True icon=False · incerto=[]
- … e mais 38 amostras (mesmo padrão em outros temas/viewports/abas).

### .fi.fi-rr-bell — 23 falha(s)

- Tlight 4 · mobile · profile · `.fi.fi-rr-bell` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · drawer · `.fi.fi-rr-bell` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelNovo · `.fi.fi-rr-bell` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelTransferencia · `.fi.fi-rr-bell` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelThemePicker · `.fi.fi-rr-bell` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelCard · `.fi.fi-rr-bell` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- … e mais 17 amostras (mesmo padrão em outros temas/viewports/abas).

### .fi.fi-rr-calculator-money — 23 falha(s)

- Tlight 4 · mobile · profile · `.fi.fi-rr-calculator-money` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · drawer · `.fi.fi-rr-calculator-money` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelNovo · `.fi.fi-rr-calculator-money` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelTransferencia · `.fi.fi-rr-calculator-money` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelThemePicker · `.fi.fi-rr-calculator-money` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelCard · `.fi.fi-rr-calculator-money` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- … e mais 17 amostras (mesmo padrão em outros temas/viewports/abas).

### .fi.fi-rr-calendar — 23 falha(s)

- Tlight 4 · mobile · profile · `.fi.fi-rr-calendar` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · drawer · `.fi.fi-rr-calendar` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelNovo · `.fi.fi-rr-calendar` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelTransferencia · `.fi.fi-rr-calendar` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelThemePicker · `.fi.fi-rr-calendar` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelCard · `.fi.fi-rr-calendar` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- … e mais 17 amostras (mesmo padrão em outros temas/viewports/abas).

### .fi.fi-rr-credit-card — 23 falha(s)

- Tlight 4 · mobile · profile · `.fi.fi-rr-credit-card` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · drawer · `.fi.fi-rr-credit-card` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelNovo · `.fi.fi-rr-credit-card` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelTransferencia · `.fi.fi-rr-credit-card` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelThemePicker · `.fi.fi-rr-credit-card` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelCard · `.fi.fi-rr-credit-card` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- … e mais 17 amostras (mesmo padrão em outros temas/viewports/abas).

### .fi.fi-rr-file-code — 23 falha(s)

- Tlight 4 · mobile · profile · `.fi.fi-rr-file-code` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · drawer · `.fi.fi-rr-file-code` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelNovo · `.fi.fi-rr-file-code` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelTransferencia · `.fi.fi-rr-file-code` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelThemePicker · `.fi.fi-rr-file-code` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelCard · `.fi.fi-rr-file-code` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- … e mais 17 amostras (mesmo padrão em outros temas/viewports/abas).

### .fi.fi-rr-palette — 23 falha(s)

- Tlight 4 · mobile · profile · `.fi.fi-rr-palette` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · drawer · `.fi.fi-rr-palette` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelNovo · `.fi.fi-rr-palette` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelTransferencia · `.fi.fi-rr-palette` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelThemePicker · `.fi.fi-rr-palette` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelCard · `.fi.fi-rr-palette` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- … e mais 17 amostras (mesmo padrão em outros temas/viewports/abas).

### .fi.fi-rr-tags — 23 falha(s)

- Tlight 4 · mobile · profile · `.fi.fi-rr-tags` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · drawer · `.fi.fi-rr-tags` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelNovo · `.fi.fi-rr-tags` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelTransferencia · `.fi.fi-rr-tags` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelThemePicker · `.fi.fi-rr-tags` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelCard · `.fi.fi-rr-tags` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- … e mais 17 amostras (mesmo padrão em outros temas/viewports/abas).

### .fi.fi-rr-text-size — 23 falha(s)

- Tlight 4 · mobile · profile · `.fi.fi-rr-text-size` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · drawer · `.fi.fi-rr-text-size` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelNovo · `.fi.fi-rr-text-size` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelTransferencia · `.fi.fi-rr-text-size` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelThemePicker · `.fi.fi-rr-text-size` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · panel:panelCard · `.fi.fi-rr-text-size` · texto='' · ícone **2.97** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 244.640115, 'g': 229.800135, 'b': 219.919905, 'a': 1} · fs=20 fw=400 · large=False hasText=False icon=True · incerto=[]
- … e mais 17 amostras (mesmo padrão em outros temas/viewports/abas).

### #dashRangeLabel — 20 falha(s)

- Tlight 1 · mobile · dash · `#dashRangeLabel` · texto='15/10 a 13/11/2026 · comparação 15/09 a 14/10/2026' · superfície **1.131** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · dash · `#dashRangeLabel` · texto='15/10 a 13/11/2026 · comparação 15/09 a 14/10/2026' · superfície **1.131** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · dash · `#dashRangeLabel` · texto='15/10 a 13/11/2026 · comparação 15/09 a 14/10/2026' · superfície **1.141** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · dash · `#dashRangeLabel` · texto='15/10 a 13/11/2026 · comparação 15/09 a 14/10/2026' · superfície **1.122** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · dash · `#dashRangeLabel` · texto='15/10 a 13/11/2026 · comparação 15/09 a 14/10/2026' · superfície **1.141** (limiar 3.0) · cor=rgb(232, 80, 2) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=10 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tdark 1 · mobile · dash · `#dashRangeLabel` · texto='15/10 a 13/11/2026 · comparação 15/09 a 14/10/2026' · superfície **1.317** (limiar 3.0) · cor=rgb(157, 208, 139) bg={'r': 24, 'g': 60, 'b': 46, 'a': 1} · fs=10 fw=400 · large=False hasText=True icon=False · incerto=[]
- … e mais 14 amostras (mesmo padrão em outros temas/viewports/abas).

### .bill-choice-icon — 20 falha(s)

- Tlight 1 · mobile · panel:panelBill · `.bill-choice-icon` · texto='↻' · superfície **1.124** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelBill · `.bill-choice-icon` · texto='▤' · superfície **1.124** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · panel:panelBill · `.bill-choice-icon` · texto='↻' · superfície **1.125** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · panel:panelBill · `.bill-choice-icon` · texto='▤' · superfície **1.125** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelBill · `.bill-choice-icon` · texto='↻' · superfície **1.136** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelBill · `.bill-choice-icon` · texto='▤' · superfície **1.136** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 14 amostras (mesmo padrão em outros temas/viewports/abas).

### .dash-expand-btn — 20 falha(s)

- Tlight 1 · mobile · dash · `.dash-expand-btn` · texto='EXPANDIR' · superfície **1.047** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=9 fw=600 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · dash · `.dash-expand-btn` · texto='EXPANDIR' · superfície **1.064** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=9 fw=600 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · dash · `.dash-expand-btn` · texto='EXPANDIR' · superfície **1.084** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=9 fw=600 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · dash · `.dash-expand-btn` · texto='EXPANDIR' · superfície **1.061** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=9 fw=600 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · dash · `.dash-expand-btn` · texto='EXPANDIR' · superfície **1.084** (limiar 3.0) · cor=rgb(232, 80, 2) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=9 fw=600 · large=False hasText=True icon=False · incerto=[]
- Tdark 1 · mobile · dash · `.dash-expand-btn` · texto='EXPANDIR' · superfície **1.443** (limiar 3.0) · cor=rgb(157, 208, 139) bg={'r': 24, 'g': 60, 'b': 46, 'a': 1} · fs=9 fw=600 · large=False hasText=True icon=False · incerto=[]
- … e mais 14 amostras (mesmo padrão em outros temas/viewports/abas).

### .modal-close — 20 falha(s)

- Tlight 1 · mobile · panel:panelThemePicker · `.modal-close` · texto='×' · superfície **1.223** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=20 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelGoalForm · `.modal-close` · texto='×' · superfície **1.223** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=20 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelOrcamento · `.modal-close` · texto='×' · superfície **1.223** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=20 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · mobile · panel:panelLOG · `.modal-close` · texto='×' · superfície **1.223** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=20 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · panel:panelThemePicker · `.modal-close` · texto='×' · superfície **1.162** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 239, 'b': 232, 'a': 1} · fs=20 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · panel:panelGoalForm · `.modal-close` · texto='×' · superfície **1.162** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 239, 'b': 232, 'a': 1} · fs=20 fw=400 · large=False hasText=True icon=False · incerto=[]
- … e mais 14 amostras (mesmo padrão em outros temas/viewports/abas).

### .period-eyebrow — 18 falha(s)

- Tlight 3 · mobile · caixa · `.period-eyebrow` · texto='PERÍODO ATIVO' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · invest · `.period-eyebrow` · texto='PERÍODO ATIVO' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · pockets · `.period-eyebrow` · texto='PERÍODO ATIVO' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · caixa · `.period-eyebrow` · texto='PERÍODO ATIVO' · texto **3.567** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · invest · `.period-eyebrow` · texto='PERÍODO ATIVO' · texto **3.567** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · pockets · `.period-eyebrow` · texto='PERÍODO ATIVO' · texto **3.567** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 12 amostras (mesmo padrão em outros temas/viewports/abas).

### .goals-v2-kicker — 15 falha(s)

- Tlight 1 · mobile · goals · `.goals-v2-kicker` · texto='PLANEJAMENTO' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · goals · `.goals-v2-kicker` · texto='PLANEJAMENTO' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelGoalForm · `.goals-v2-kicker` · texto='PLANEJAMENTO' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · goals · `.goals-v2-kicker` · texto='PLANEJAMENTO' · texto **3.373** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 251, 'g': 246, 'b': 239, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelGoalForm · `.goals-v2-kicker` · texto='PLANEJAMENTO' · texto **3.567** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · goals · `.goals-v2-kicker` · texto='PLANEJAMENTO' · texto **3.575** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 249, 'g': 249, 'b': 249, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- … e mais 9 amostras (mesmo padrão em outros temas/viewports/abas).

### .emoji-trigger-chevron — 14 falha(s)

- Tlight 3 · mobile · panel:panelGoalForm · `.emoji-trigger-chevron` · texto='⌃' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=17 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelCategoria · `.emoji-trigger-chevron` · texto='⌄' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=17 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelGoalForm · `.emoji-trigger-chevron` · texto='⌃' · texto **3.567** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=17 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelCategoria · `.emoji-trigger-chevron` · texto='⌄' · texto **3.567** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=17 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelGoalForm · `.emoji-trigger-chevron` · texto='⌃' · texto **3.764** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=17 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelCategoria · `.emoji-trigger-chevron` · texto='⌄' · texto **3.764** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=17 fw=400 · large=False hasText=True icon=False · incerto=[]
- … e mais 8 amostras (mesmo padrão em outros temas/viewports/abas).

### #btnQuickCat — 10 falha(s)

- Tlight 1 · mobile · panel:panelNovo · `#btnQuickCat` · texto='+' · superfície **1.08** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=14 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · panel:panelNovo · `#btnQuickCat` · texto='+' · superfície **1.063** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=14 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelNovo · `#btnQuickCat` · texto='+' · superfície **1.053** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=14 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelNovo · `#btnQuickCat` · texto='+' · superfície **1.058** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=14 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelNovo · `#btnQuickCat` · texto='+' · superfície **1.053** (limiar 3.0) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=14 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelNovo · `#btnQuickCat` · texto='+' · superfície **1.08** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=14 fw=700 · large=False hasText=True icon=False · incerto=[]
- … e mais 4 amostras (mesmo padrão em outros temas/viewports/abas).

### #btnReadClipboard — 10 falha(s)

- Tlight 1 · mobile · panel:panelPaste · `#btnReadClipboard` · texto='⌘ LER ÁREA DE TRANSFERÊNCIA' · superfície **1.08** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=12 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · panel:panelPaste · `#btnReadClipboard` · texto='⌘ LER ÁREA DE TRANSFERÊNCIA' · superfície **1.063** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=12 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelPaste · `#btnReadClipboard` · texto='⌘ LER ÁREA DE TRANSFERÊNCIA' · superfície **1.053** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=12 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelPaste · `#btnReadClipboard` · texto='⌘ LER ÁREA DE TRANSFERÊNCIA' · superfície **1.058** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=12 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelPaste · `#btnReadClipboard` · texto='⌘ LER ÁREA DE TRANSFERÊNCIA' · superfície **1.053** (limiar 3.0) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=12 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelPaste · `#btnReadClipboard` · texto='⌘ LER ÁREA DE TRANSFERÊNCIA' · superfície **1.08** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=12 fw=700 · large=False hasText=True icon=False · incerto=[]
- … e mais 4 amostras (mesmo padrão em outros temas/viewports/abas).

### #btnUpdateAllPrices — 10 falha(s)

- Tlight 1 · mobile · invest · `#btnUpdateAllPrices` · texto='Atualizar Cotações' · superfície **1.132** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · invest · `#btnUpdateAllPrices` · texto='Atualizar Cotações' · superfície **1.093** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 239, 'b': 232, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · invest · `#btnUpdateAllPrices` · texto='Atualizar Cotações' · superfície **1.062** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 242, 'g': 246, 'b': 198, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · invest · `#btnUpdateAllPrices` · texto='Atualizar Cotações' · superfície **1.131** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · invest · `#btnUpdateAllPrices` · texto='Atualizar Cotações' · superfície **1.056** (limiar 3.0) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 240, 'b': 232, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tdark 1 · mobile · invest · `#btnUpdateAllPrices` · texto='Atualizar Cotações' · superfície **1.324** (limiar 3.0) · cor=rgb(241, 237, 225) bg={'r': 51, 'g': 48, 'b': 30, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]
- … e mais 4 amostras (mesmo padrão em outros temas/viewports/abas).

### .bill-bank-mark — 10 falha(s)

- Tlight 1 · mobile · panel:panelBill · `.bill-bank-mark` · texto='P' · superfície **1.124** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · panel:panelBill · `.bill-bank-mark` · texto='P' · superfície **1.125** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelBill · `.bill-bank-mark` · texto='P' · superfície **1.136** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelBill · `.bill-bank-mark` · texto='P' · superfície **1.117** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelBill · `.bill-bank-mark` · texto='P' · superfície **1.136** (limiar 3.0) · cor=rgb(232, 80, 2) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelBill · `.bill-bank-mark` · texto='P' · superfície **1.124** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 231, 'g': 243, 'b': 234, 'a': 1} · fs=18 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 4 amostras (mesmo padrão em outros temas/viewports/abas).

### .bill-day.today — 10 falha(s)

- Tlight 1 · mobile · bills · `.bill-day.today` · texto='13' · superfície **1.08** (limiar 3.0) · cor=rgb(26, 36, 23) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 2 · mobile · bills · `.bill-day.today` · texto='13' · superfície **1.063** (limiar 3.0) · cor=rgb(25, 53, 42) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 3 · mobile · bills · `.bill-day.today` · texto='13' · superfície **1.053** (limiar 3.0) · cor=rgb(49, 87, 44) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 4 · mobile · bills · `.bill-day.today` · texto='13' · superfície **1.058** (limiar 3.0) · cor=rgb(52, 44, 37) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 5 · mobile · bills · `.bill-day.today` · texto='13' · superfície **1.053** (limiar 3.0) · cor=rgb(26, 26, 26) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 1 · desktop · bills · `.bill-day.today` · texto='13' · superfície **1.08** (limiar 3.0) · cor=rgb(26, 36, 23) bg={'r': 255, 'g': 254, 'b': 250, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- … e mais 4 amostras (mesmo padrão em outros temas/viewports/abas).

### .dashboard-period — 10 falha(s)

- Tlight 1 · mobile · dashboard · `.dashboard-period` · texto='Novembro / 2026' · superfície **1.278** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 225.71988, 'g': 227.780025, 'b': 214.92012, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · dashboard · `.dashboard-period` · texto='Novembro / 2026' · superfície **1.135** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 232, 'g': 242, 'b': 235, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · dashboard · `.dashboard-period` · texto='Novembro / 2026' · superfície **1.12** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 242.29998, 'g': 245.699895, 'b': 197.60001, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · dashboard · `.dashboard-period` · texto='Novembro / 2026' · superfície **1.183** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 247, 'g': 231, 'b': 224, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · dashboard · `.dashboard-period` · texto='Novembro / 2026' · superfície **1.112** (limiar 3.0) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 240, 'b': 232, 'a': 1} · fs=9 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · dashboard · `.dashboard-period` · texto='Novembro / 2026' · superfície **1.278** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 225.71988, 'g': 227.780025, 'b': 214.92012, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 4 amostras (mesmo padrão em outros temas/viewports/abas).

### .fi.fi-rr-wallet — 9 falha(s)

- Tlight 4 · mobile · inicio · `.fi.fi-rr-wallet` · texto='' · ícone **2.982** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 1 · desktop · inicio · `.fi.fi-rr-wallet` · texto='' · ícone **2.142** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 58.06, 'g': 66.66, 'b': 55.480000000000004, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 1 · desktop · caixa · `.fi.fi-rr-wallet` · texto='' · ícone **2.142** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 58.06, 'g': 66.66, 'b': 55.480000000000004, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 2 · desktop · inicio · `.fi.fi-rr-wallet` · texto='' · ícone **1.634** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 57.2, 'g': 81.28, 'b': 71.82, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 2 · desktop · caixa · `.fi.fi-rr-wallet` · texto='' · ícone **1.634** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 57.2, 'g': 81.28, 'b': 71.82, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 3 · desktop · inicio · `.fi.fi-rr-wallet` · texto='' · ícone **1.493** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 77.84, 'g': 110.52, 'b': 73.53999999999999, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- … e mais 3 amostras (mesmo padrão em outros temas/viewports/abas).

### #btnExpandInvestTotal — 8 falha(s)

- Tlight 1 · mobile · invest · `#btnExpandInvestTotal` · texto='Expandir' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · invest · `#btnExpandInvestTotal` · texto='Expandir' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · invest · `#btnExpandInvestTotal` · texto='Expandir' · texto **3.373** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 251, 'g': 246, 'b': 239, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · invest · `#btnExpandInvestTotal` · texto='Expandir' · texto **3.575** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 249, 'g': 249, 'b': 249, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · invest · `#btnExpandInvestTotal` · texto='EXPANDIR' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · invest · `#btnExpandInvestTotal` · texto='EXPANDIR' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- … e mais 2 amostras (mesmo padrão em outros temas/viewports/abas).

### #cardSalvar — 8 falha(s)

- Tlight 3 · mobile · panel:panelCard · `#cardSalvar` · texto='SALVAR CARTÃO' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=850 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelCard · `#cardSalvar` · texto='SALVAR CARTÃO' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=850 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelCard · `#cardSalvar` · texto='SALVAR CARTÃO' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=850 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelCard · `#cardSalvar` · texto='SALVAR CARTÃO' · texto **1.036** (limiar 4.5) · cor=rgb(247, 250, 246) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=15 fw=850 · large=False hasText=True icon=False · incerto=['#cardSalvar']
- Tlight 2 · desktop · panel:panelCard · `#cardSalvar` · texto='SALVAR CARTÃO' · texto **1.062** (limiar 4.5) · cor=rgb(255, 254, 249) bg={'r': 248, 'g': 247, 'b': 242, 'a': 1} · fs=15 fw=850 · large=False hasText=True icon=False · incerto=['#cardSalvar']
- Tlight 3 · desktop · panel:panelCard · `#cardSalvar` · texto='SALVAR CARTÃO' · texto **1** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=15 fw=850 · large=False hasText=True icon=False · incerto=['#cardSalvar']
- … e mais 2 amostras (mesmo padrão em outros temas/viewports/abas).

### #crSaldoRealLabel — 8 falha(s)

- Tlight 1 · mobile · panel:panelCryptoReconcile · `#crSaldoRealLabel` · texto='SALDO NA CORRETORA (QUANTIDADE)' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelCryptoReconcile · `#crSaldoRealLabel` · texto='SALDO NA CORRETORA (QUANTIDADE)' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelCryptoReconcile · `#crSaldoRealLabel` · texto='SALDO NA CORRETORA (QUANTIDADE)' · texto **3.373** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 251, 'g': 246, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelCryptoReconcile · `#crSaldoRealLabel` · texto='SALDO NA CORRETORA (QUANTIDADE)' · texto **3.575** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 249, 'g': 249, 'b': 249, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelCryptoReconcile · `#crSaldoRealLabel` · texto='SALDO NA CORRETORA (QUANTIDADE)' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · panel:panelCryptoReconcile · `#crSaldoRealLabel` · texto='SALDO NA CORRETORA (QUANTIDADE)' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 2 amostras (mesmo padrão em outros temas/viewports/abas).

### #iCotacaoLabel — 8 falha(s)

- Tlight 1 · mobile · panel:panelInvest · `#iCotacaoLabel` · texto='COTAÇÃO (R$ POR UNIDADE)' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelInvest · `#iCotacaoLabel` · texto='COTAÇÃO (R$ POR UNIDADE)' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelInvest · `#iCotacaoLabel` · texto='COTAÇÃO (R$ POR UNIDADE)' · texto **3.373** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 251, 'g': 246, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelInvest · `#iCotacaoLabel` · texto='COTAÇÃO (R$ POR UNIDADE)' · texto **3.575** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 249, 'g': 249, 'b': 249, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelInvest · `#iCotacaoLabel` · texto='COTAÇÃO (R$ POR UNIDADE)' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · panel:panelInvest · `#iCotacaoLabel` · texto='COTAÇÃO (R$ POR UNIDADE)' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 2 amostras (mesmo padrão em outros temas/viewports/abas).

### #iUnidadesAtualLabel — 8 falha(s)

- Tlight 1 · mobile · panel:panelInvest · `#iUnidadesAtualLabel` · texto='SALDO FINAL' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelInvest · `#iUnidadesAtualLabel` · texto='SALDO FINAL' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelInvest · `#iUnidadesAtualLabel` · texto='SALDO FINAL' · texto **3.373** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 251, 'g': 246, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelInvest · `#iUnidadesAtualLabel` · texto='SALDO FINAL' · texto **3.575** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 249, 'g': 249, 'b': 249, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelInvest · `#iUnidadesAtualLabel` · texto='SALDO FINAL' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · panel:panelInvest · `#iUnidadesAtualLabel` · texto='SALDO FINAL' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 2 amostras (mesmo padrão em outros temas/viewports/abas).

### #iUnidadesLabel — 8 falha(s)

- Tlight 1 · mobile · panel:panelInvest · `#iUnidadesLabel` · texto='SALDO INICIAL' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelInvest · `#iUnidadesLabel` · texto='SALDO INICIAL' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelInvest · `#iUnidadesLabel` · texto='SALDO INICIAL' · texto **3.373** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 251, 'g': 246, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelInvest · `#iUnidadesLabel` · texto='SALDO INICIAL' · texto **3.575** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 249, 'g': 249, 'b': 249, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelInvest · `#iUnidadesLabel` · texto='SALDO INICIAL' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · panel:panelInvest · `#iUnidadesLabel` · texto='SALDO INICIAL' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 2 amostras (mesmo padrão em outros temas/viewports/abas).

### #imDataLabel — 8 falha(s)

- Tlight 1 · mobile · panel:panelInvestMovement · `#imDataLabel` · texto='DATA' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelInvestMovement · `#imDataLabel` · texto='DATA' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelInvestMovement · `#imDataLabel` · texto='DATA' · texto **3.373** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 251, 'g': 246, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelInvestMovement · `#imDataLabel` · texto='DATA' · texto **3.575** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 249, 'g': 249, 'b': 249, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelInvestMovement · `#imDataLabel` · texto='DATA' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · panel:panelInvestMovement · `#imDataLabel` · texto='DATA' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 2 amostras (mesmo padrão em outros temas/viewports/abas).

### #imQuantidadeLabel — 8 falha(s)

- Tlight 1 · mobile · panel:panelInvestMovement · `#imQuantidadeLabel` · texto='QUANTIDADE' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelInvestMovement · `#imQuantidadeLabel` · texto='QUANTIDADE' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelInvestMovement · `#imQuantidadeLabel` · texto='QUANTIDADE' · texto **3.373** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 251, 'g': 246, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelInvestMovement · `#imQuantidadeLabel` · texto='QUANTIDADE' · texto **3.575** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 249, 'g': 249, 'b': 249, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelInvestMovement · `#imQuantidadeLabel` · texto='QUANTIDADE' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · panel:panelInvestMovement · `#imQuantidadeLabel` · texto='QUANTIDADE' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 2 amostras (mesmo padrão em outros temas/viewports/abas).

### #pmDataLabel — 8 falha(s)

- Tlight 1 · mobile · panel:panelPocketMovement · `#pmDataLabel` · texto='DATA' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · panel:panelPocketMovement · `#pmDataLabel` · texto='DATA' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelPocketMovement · `#pmDataLabel` · texto='DATA' · texto **3.373** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 251, 'g': 246, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelPocketMovement · `#pmDataLabel` · texto='DATA' · texto **3.575** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 249, 'g': 249, 'b': 249, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 1 · desktop · panel:panelPocketMovement · `#pmDataLabel` · texto='DATA' · texto **4.427** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 247, 'g': 245, 'b': 239, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · panel:panelPocketMovement · `#pmDataLabel` · texto='DATA' · texto **3.637** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 250, 'g': 249, 'b': 246, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- … e mais 2 amostras (mesmo padrão em outros temas/viewports/abas).

### .is-active — 8 falha(s)

- Tlight 3 · mobile · dash · `.is-active` · texto='30 DIAS' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=10 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · dash · `.is-active` · texto='30 DIAS' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=10 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · dash · `.is-active` · texto='30 DIAS' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=10 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tdark 5 · mobile · dash · `.is-active` · texto='30 DIAS' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=10 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · dash · `.is-active` · texto='30 DIAS' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · desktop · dash · `.is-active` · texto='30 DIAS' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=700 · large=False hasText=True icon=False · incerto=[]
- … e mais 2 amostras (mesmo padrão em outros temas/viewports/abas).

### #btnNewReceivable — 6 falha(s)

- Tlight 3 · mobile · receivables · `#btnNewReceivable` · texto='NOVO VALOR A RECEBER' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=12 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · receivables · `#btnNewReceivable` · texto='NOVO VALOR A RECEBER' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=12 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · receivables · `#btnNewReceivable` · texto='NOVO VALOR A RECEBER' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=12 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · receivables · `#btnNewReceivable` · texto='NOVO VALOR A RECEBER' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=12 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · desktop · receivables · `#btnNewReceivable` · texto='NOVO VALOR A RECEBER' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=12 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · desktop · receivables · `#btnNewReceivable` · texto='NOVO VALOR A RECEBER' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=12 fw=400 · large=False hasText=True icon=False · incerto=[]

### #imAporte — 6 falha(s)

- Tlight 3 · mobile · panel:panelInvestMovement · `#imAporte` · texto='APORTE' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelInvestMovement · `#imAporte` · texto='APORTE' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelInvestMovement · `#imAporte` · texto='APORTE' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · panel:panelInvestMovement · `#imAporte` · texto='APORTE' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · desktop · panel:panelInvestMovement · `#imAporte` · texto='APORTE' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · desktop · panel:panelInvestMovement · `#imAporte` · texto='APORTE' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #pmAporte — 6 falha(s)

- Tlight 3 · mobile · panel:panelPocketMovement · `#pmAporte` · texto='APORTE' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelPocketMovement · `#pmAporte` · texto='APORTE' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelPocketMovement · `#pmAporte` · texto='APORTE' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · panel:panelPocketMovement · `#pmAporte` · texto='APORTE' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · desktop · panel:panelPocketMovement · `#pmAporte` · texto='APORTE' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · desktop · panel:panelPocketMovement · `#pmAporte` · texto='APORTE' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### .next-pay-kicker — 6 falha(s)

- Tlight 3 · mobile · dashboard · `.next-pay-kicker` · texto='PRÓXIMO PAGAMENTO' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · dashboard · `.next-pay-kicker` · texto='PRÓXIMO PAGAMENTO' · texto **3.567** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · dashboard · `.next-pay-kicker` · texto='PRÓXIMO PAGAMENTO' · texto **3.764** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · desktop · dashboard · `.next-pay-kicker` · texto='PRÓXIMO PAGAMENTO' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · desktop · dashboard · `.next-pay-kicker` · texto='PRÓXIMO PAGAMENTO' · texto **3.567** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · desktop · dashboard · `.next-pay-kicker` · texto='PRÓXIMO PAGAMENTO' · texto **3.764** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=800 · large=False hasText=True icon=False · incerto=[]

### #btnOpenFilters — 5 falha(s)

- Tlight 1 · mobile · caixa · `#btnOpenFilters` · texto='' · superfície **1.223** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 2 · mobile · caixa · `#btnOpenFilters` · texto='' · superfície **1.162** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 239, 'b': 232, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 3 · mobile · caixa · `#btnOpenFilters` · texto='' · superfície **1.119** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 242, 'g': 246, 'b': 198, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 4 · mobile · caixa · `#btnOpenFilters` · texto='' · superfície **1.196** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 5 · mobile · caixa · `#btnOpenFilters` · texto='' · superfície **1.112** (limiar 3.0) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 240, 'b': 232, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=False · incerto=[]

### .quote-refresh-label — 5 falha(s)

- Tlight 1 · mobile · invest · `.quote-refresh-label` · texto='Atualizar Cotações' · texto **3.91** (limiar 4.5) · cor=rgb(95, 122, 67) bg={'r': 223, 'g': 235, 'b': 216, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 2 · mobile · invest · `.quote-refresh-label` · texto='Atualizar Cotações' · texto **4.468** (limiar 4.5) · cor=rgb(50, 121, 87) bg={'r': 231, 'g': 239, 'b': 232, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 3 · mobile · invest · `.quote-refresh-label` · texto='Atualizar Cotações' · texto **3.423** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 242, 'g': 246, 'b': 198, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · invest · `.quote-refresh-label` · texto='Atualizar Cotações' · texto **2.982** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · invest · `.quote-refresh-label` · texto='Atualizar Cotações' · texto **3.384** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 240, 'b': 232, 'a': 1} · fs=9 fw=700 · large=False hasText=True icon=False · incerto=[]

### #ledgerCount — 4 falha(s)

- Tlight 3 · mobile · caixa · `#ledgerCount` · texto='0' · texto **3.829** (limiar 4.5) · cor=rgb(64, 145, 108) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · caixa · `#ledgerCount` · texto='0' · texto **3.567** (limiar 4.5) · cor=rgb(198, 111, 80) bg={'r': 255, 'g': 253, 'b': 248, 'a': 1} · fs=10 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · caixa · `#ledgerCount` · texto='0' · texto **3.764** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=400 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · desktop · caixa · `#ledgerCount` · texto='0' · texto **3.764** (limiar 4.5) · cor=rgb(232, 80, 2) bg={'r': 255, 'g': 255, 'b': 255, 'a': 1} · fs=10 fw=400 · large=False hasText=True icon=False · incerto=[]

### .fi.fi-rr-chart-line-up — 4 falha(s)

- Tlight 1 · desktop · invest · `.fi.fi-rr-chart-line-up` · texto='' · ícone **2.142** (limiar 3.0) · cor=rgb(95, 122, 67) bg={'r': 58.06, 'g': 66.66, 'b': 55.480000000000004, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 2 · desktop · invest · `.fi.fi-rr-chart-line-up` · texto='' · ícone **1.634** (limiar 3.0) · cor=rgb(50, 121, 87) bg={'r': 57.2, 'g': 81.28, 'b': 71.82, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 3 · desktop · invest · `.fi.fi-rr-chart-line-up` · texto='' · ícone **1.493** (limiar 3.0) · cor=rgb(64, 145, 108) bg={'r': 77.84, 'g': 110.52, 'b': 73.53999999999999, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · desktop · invest · `.fi.fi-rr-chart-line-up` · texto='' · ícone **2.419** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 80.42, 'g': 73.53999999999999, 'b': 67.52000000000001, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]

### #bSalvar — 3 falha(s)

- Tlight 3 · mobile · panel:panelBanco · `#bSalvar` · texto='ADICIONAR' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelBanco · `#bSalvar` · texto='ADICIONAR' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelBanco · `#bSalvar` · texto='ADICIONAR' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #billLaunchConfirm — 3 falha(s)

- Tlight 3 · mobile · panel:panelBillLaunch · `#billLaunchConfirm` · texto='CONFIRMAR LANÇAMENTO' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelBillLaunch · `#billLaunchConfirm` · texto='CONFIRMAR LANÇAMENTO' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelBillLaunch · `#billLaunchConfirm` · texto='CONFIRMAR LANÇAMENTO' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #billSalvar — 3 falha(s)

- Tlight 3 · mobile · panel:panelBill · `#billSalvar` · texto='SALVAR CONTA / FATURA' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelBill · `#billSalvar` · texto='SALVAR CONTA / FATURA' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelBill · `#billSalvar` · texto='SALVAR CONTA / FATURA' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #btnApplyFilters — 3 falha(s)

- Tlight 3 · mobile · panel:panelFiltros · `#btnApplyFilters` · texto='APLICAR FILTROS' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelFiltros · `#btnApplyFilters` · texto='APLICAR FILTROS' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelFiltros · `#btnApplyFilters` · texto='APLICAR FILTROS' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #btnExportFormatDocx — 3 falha(s)

- Tlight 3 · mobile · panel:panelExportFormat · `#btnExportFormatDocx` · texto='WORD (.DOCX)' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelExportFormat · `#btnExportFormatDocx` · texto='WORD (.DOCX)' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelExportFormat · `#btnExportFormatDocx` · texto='WORD (.DOCX)' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #btnExportFormatPdf — 3 falha(s)

- Tlight 3 · mobile · panel:panelExportFormat · `#btnExportFormatPdf` · texto='PDF' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelExportFormat · `#btnExportFormatPdf` · texto='PDF' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelExportFormat · `#btnExportFormatPdf` · texto='PDF' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #btnExportFormatXlsx — 3 falha(s)

- Tlight 3 · mobile · panel:panelExportFormat · `#btnExportFormatXlsx` · texto='EXCEL (.XLSX)' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelExportFormat · `#btnExportFormatXlsx` · texto='EXCEL (.XLSX)' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelExportFormat · `#btnExportFormatXlsx` · texto='EXCEL (.XLSX)' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #btnProcessPaste — 3 falha(s)

- Tlight 3 · mobile · panel:panelPaste · `#btnProcessPaste` · texto='GERAR PRÉVIA' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelPaste · `#btnProcessPaste` · texto='GERAR PRÉVIA' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelPaste · `#btnProcessPaste` · texto='GERAR PRÉVIA' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #btnSaveGoal — 3 falha(s)

- Tlight 3 · mobile · panel:panelGoalForm · `#btnSaveGoal` · texto='SALVAR META' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelGoalForm · `#btnSaveGoal` · texto='SALVAR META' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelGoalForm · `#btnSaveGoal` · texto='SALVAR META' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #cSalvar — 3 falha(s)

- Tlight 3 · mobile · panel:panelCategoria · `#cSalvar` · texto='ADICIONAR' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelCategoria · `#cSalvar` · texto='ADICIONAR' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelCategoria · `#cSalvar` · texto='ADICIONAR' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #crConfirmar — 3 falha(s)

- Tlight 3 · mobile · panel:panelCryptoReconcile · `#crConfirmar` · texto='APLICAR AJUSTE' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelCryptoReconcile · `#crConfirmar` · texto='APLICAR AJUSTE' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelCryptoReconcile · `#crConfirmar` · texto='APLICAR AJUSTE' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #iSalvar — 3 falha(s)

- Tlight 3 · mobile · panel:panelInvest · `#iSalvar` · texto='SALVAR ATIVO' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelInvest · `#iSalvar` · texto='SALVAR ATIVO' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelInvest · `#iSalvar` · texto='SALVAR ATIVO' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #imSalvar — 3 falha(s)

- Tlight 3 · mobile · panel:panelInvestMovement · `#imSalvar` · texto='REGISTRAR LANÇAMENTO' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelInvestMovement · `#imSalvar` · texto='REGISTRAR LANÇAMENTO' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelInvestMovement · `#imSalvar` · texto='REGISTRAR LANÇAMENTO' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #pSalvar — 3 falha(s)

- Tlight 3 · mobile · panel:panelPocket · `#pSalvar` · texto='SALVAR CAIXINHA' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelPocket · `#pSalvar` · texto='SALVAR CAIXINHA' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelPocket · `#pSalvar` · texto='SALVAR CAIXINHA' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #pmSalvar — 3 falha(s)

- Tlight 3 · mobile · panel:panelPocketMovement · `#pmSalvar` · texto='REGISTRAR APORTE' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelPocketMovement · `#pmSalvar` · texto='REGISTRAR APORTE' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelPocketMovement · `#pmSalvar` · texto='REGISTRAR APORTE' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #purchaseSalvar — 3 falha(s)

- Tlight 3 · mobile · panel:panelPurchase · `#purchaseSalvar` · texto='SALVAR COMPRA' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelPurchase · `#purchaseSalvar` · texto='SALVAR COMPRA' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelPurchase · `#purchaseSalvar` · texto='SALVAR COMPRA' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #recvSalvar — 3 falha(s)

- Tlight 3 · mobile · panel:panelReceivable · `#recvSalvar` · texto='SALVAR' · texto **3.637** (limiar 4.5) · cor=rgb(250, 249, 246) bg={'r': 64, 'g': 145, 'b': 108, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · mobile · panel:panelReceivable · `#recvSalvar` · texto='SALVAR' · texto **3.626** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 5 · mobile · panel:panelReceivable · `#recvSalvar` · texto='SALVAR' · texto **3.764** (limiar 4.5) · cor=rgb(255, 255, 255) bg={'r': 232, 'g': 80, 'b': 2, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### #tglIn — 2 falha(s)

- Tlight 4 · mobile · panel:panelNovo · `#tglIn` · texto='ENTRADA' · superfície **2.996** (limiar 3.0) · cor=rgb(17, 17, 17) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]
- Tlight 4 · desktop · panel:panelNovo · `#tglIn` · texto='ENTRADA' · superfície **2.996** (limiar 3.0) · cor=rgb(17, 17, 17) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=11 fw=800 · large=False hasText=True icon=False · incerto=[]

### .fi.fi-rr-bank — 2 falha(s)

- Tlight 4 · mobile · inicio · `.fi.fi-rr-bank` · texto='' · ícone **2.982** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · caixa · `.fi.fi-rr-bank` · texto='' · ícone **2.982** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]

### .fi.fi-rr-chat-arrow-grow — 2 falha(s)

- Tlight 4 · mobile · inicio · `.fi.fi-rr-chat-arrow-grow` · texto='' · ícone **2.982** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · caixa · `.fi.fi-rr-chat-arrow-grow` · texto='' · ícone **2.982** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]

### .fi.fi-rr-piggy-bank — 2 falha(s)

- Tlight 4 · mobile · inicio · `.fi.fi-rr-piggy-bank` · texto='' · ícone **2.982** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]
- Tlight 4 · mobile · caixa · `.fi.fi-rr-piggy-bank` · texto='' · ícone **2.982** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=16 fw=400 · large=False hasText=False icon=True · incerto=[]

### .light-theme-option — 2 falha(s)

- Tlight 4 · mobile · panel:panelThemePicker · `.light-theme-option` · texto='' · superfície **2.996** (limiar 3.0) · cor=rgb(52, 44, 37) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=12 fw=400 · large=False hasText=False icon=False · incerto=[]
- Tlight 4 · desktop · panel:panelThemePicker · `.light-theme-option` · texto='' · superfície **2.996** (limiar 3.0) · cor=rgb(52, 44, 37) bg={'r': 198, 'g': 111, 'b': 80, 'a': 1} · fs=12 fw=400 · large=False hasText=False icon=False · incerto=[]

### .fi.fi-rr-filter-list — 1 falha(s)

- Tlight 4 · mobile · caixa · `.fi.fi-rr-filter-list` · texto='' · ícone **2.982** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=18 fw=400 · large=False hasText=False icon=True · incerto=[]

### .fi.fi-rr-refresh — 1 falha(s)

- Tlight 4 · mobile · invest · `.fi.fi-rr-refresh` · texto='' · ícone **2.982** (limiar 3.0) · cor=rgb(198, 111, 80) bg={'r': 224, 'g': 236, 'b': 226, 'a': 1} · fs=16 fw=700 · large=False hasText=False icon=True · incerto=[]

## Estados forçados por CDP (temas claros 3–5, ambos viewports)
Sondas: normal, hover, focus-visible, active, disabled.

| seletor | estado | amostras | texto (mínimo) | limiar texto | foco/borda (mínimo) | limiar foco |
|---|---|---:|---:|---:|---:|---:|
| .dash-expand-btn | active | 24 | 1.722 | 4,5 | 1.722 | 3,0 |
| .dash-expand-btn | disabled | 24 | 1.722 | 4,5 | 1.722 | 3,0 |
| .dash-expand-btn | focus-visible | 24 | 1.722 | 4,5 | 1.722 | 3,0 |
| .dash-expand-btn | hover | 24 | 1.806 | 4,5 | 1.806 | 3,0 |
| .dash-expand-btn | normal | 24 | 1.722 | 4,5 | 1.722 | 3,0 |
| .drawer-nav button | active | 24 | 3.761 | 4,5 | 3.761 | 3,0 |
| .drawer-nav button | disabled | 24 | 3.761 | 4,5 | 3.761 | 3,0 |
| .drawer-nav button | focus-visible | 24 | 3.761 | 4,5 | 9.247 | 3,0 |
| .drawer-nav button | hover | 24 | 2.588 | 4,5 | 2.588 | 3,0 |
| .drawer-nav button | normal | 24 | 3.761 | 4,5 | 3.761 | 3,0 |
| .invest-total-expand-btn | active | 24 | 9.247 | 4,5 | 9.247 | 3,0 |
| .invest-total-expand-btn | disabled | 24 | 9.247 | 4,5 | 9.247 | 3,0 |
| .invest-total-expand-btn | focus-visible | 24 | 9.247 | 4,5 | 9.247 | 3,0 |
| .invest-total-expand-btn | hover | 24 | 9.247 | 4,5 | 9.247 | 3,0 |
| .invest-total-expand-btn | normal | 24 | 9.247 | 4,5 | 9.247 | 3,0 |
| .ledger-filter-button | active | 24 | 1.677 | 4,5 | 1.677 | 3,0 |
| .ledger-filter-button | disabled | 24 | 1.677 | 4,5 | 1.677 | 3,0 |
| .ledger-filter-button | focus-visible | 24 | 1.677 | 4,5 | 1.677 | 3,0 |
| .ledger-filter-button | hover | 24 | 1.806 | 4,5 | 1.806 | 3,0 |
| .ledger-filter-button | normal | 24 | 1.677 | 4,5 | 1.677 | 3,0 |
| .mobile-bottom-nav button | active | 24 | 3.761 | 4,5 | 3.761 | 3,0 |
| .mobile-bottom-nav button | disabled | 24 | 3.761 | 4,5 | 3.761 | 3,0 |
| .mobile-bottom-nav button | focus-visible | 24 | 3.761 | 4,5 | 9.247 | 3,0 |
| .mobile-bottom-nav button | hover | 24 | 8.865 | 4,5 | 8.865 | 3,0 |
| .mobile-bottom-nav button | normal | 24 | 3.761 | 4,5 | 3.761 | 3,0 |
| .profile-avatar | active | 24 | 1.685 | 4,5 | 1.685 | 3,0 |
| .profile-avatar | disabled | 24 | 1.685 | 4,5 | 1.685 | 3,0 |
| .profile-avatar | focus-visible | 24 | 1.685 | 4,5 | 1.685 | 3,0 |
| .profile-avatar | hover | 24 | 1.685 | 4,5 | 1.685 | 3,0 |
| .profile-avatar | normal | 24 | 1.685 | 4,5 | 1.685 | 3,0 |
| .toolbar button.primary | active | 24 | 1.806 | 4,5 | 1.806 | 3,0 |
| .toolbar button.primary | disabled | 24 | 1.806 | 4,5 | 1.806 | 3,0 |
| .toolbar button.primary | focus-visible | 24 | 1.806 | 4,5 | 1.0 | 3,0 |
| .toolbar button.primary | hover | 24 | 1.806 | 4,5 | 1.806 | 3,0 |
| .toolbar button.primary | normal | 24 | 1.806 | 4,5 | 1.806 | 3,0 |
| .toolbar button:not(.primary) | active | 24 | 2.62 | 4,5 | 2.62 | 3,0 |
| .toolbar button:not(.primary) | disabled | 24 | 2.62 | 4,5 | 2.62 | 3,0 |
| .toolbar button:not(.primary) | focus-visible | 24 | 2.588 | 4,5 | 1.685 | 3,0 |
| .toolbar button:not(.primary) | hover | 24 | 2.588 | 4,5 | 2.588 | 3,0 |
| .toolbar button:not(.primary) | normal | 24 | 2.62 | 4,5 | 2.62 | 3,0 |

## Inconclusivos / ressalvas
- Fundos com gradiente ou camadas não compósitas (ex.: `.dash-kpi.dash-kpi-main`, botões primários com `linear-gradient`) são marcados como incertos quando a composição não é determinística; não entram como falha nem como aprovação definitiva.
- Estados `disabled` reportados pelo CDP nem sempre refletem a interação real do usuário; validar interativamente antes de corrigir.
- Ícones `.fi` (pseudo-elemento `::before`) são amostrados sobre o fundo do elemento pai; se o ícone for decorativo, pode ser N.A., mas foi mantido para rastreamento.

## Conclusão
Houve falhas de contraste em consumidores de `--accent` nos temas claros 3 (Lima), 4 (Terracota) e 5 (Laranja), principalmente texto de botões/panels abaixo de 4,5:1 e superfícies/ícones abaixo de 3:1. Nenhuma alteração foi feita no repositório; este relatório é o insumo para a correção (C.4-V05-C, se solicitada).

---
Gerado em 2026-11-13T11:44:52.771Z UTC. Hash da evidência: 3f795f6014732465.