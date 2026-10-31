# Matriz de Cobertura — Fluxos Financeiros (Fase 6 — Critério de Aceite Global)

Demonstra que a cobertura dos fluxos financeiros é baseada em **matriz + testes**, não em suposição.

## Legenda
- **ARQUIVO/FUNÇÃO**: origem do evento de LOG ou Trilha de Auditoria.
- **EVENTO**: ação registrada.
- **TESTE**: arquivo de teste que cobre o fluxo.
- **STATUS**: `verde` (teste passando) / `amarelo` (parcial) / `vermelho` (não coberto).

## Fluxos que alteram saldo, dívida, limite ou patrimônio

| # | Fluxo | Arquivo/Função | Evento de LOG/Auditoria | Teste | Status |
|---|-------|---------------|------------------------|-------|--------|
| 1 | Criar lançamento | `js/99-init.js` · `salvarLancamento` | `logInfo('Livro-Caixa','Salvar lançamento','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 2 | Editar lançamento | `js/99-init.js` · `salvarLancamento` | `logInfo('Livro-Caixa','Editar lançamento','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 3 | Excluir lançamento | `js/99-init.js` · `excluirLancamento` | `logInfo('Livro-Caixa','Excluir lançamento','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 4 | Transferência universal | `js/99-init.js` · `transferenciaUniversal` | `logInfo('Transferência','Transferência universal','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 5 | Salvar banco | `js/99-init.js` · `salvarBanco` | `logInfo('Bancos','Salvar banco','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 6 | Excluir banco | `js/99-init.js` · `excluirBanco` | `logInfo('Bancos','Excluir banco','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 7 | Salvar categoria | `js/99-init.js` · `salvarCategoria` | `logInfo('Categorias','Salvar categoria','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 8 | Excluir categoria | `js/99-init.js` · `excluirCategoria` | `logInfo('Categorias','Excluir categoria','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 9 | Salvar cartão | `js/99-init.js` · `salvarCartao` | `logInfo('Cartões','Criar/Editar cartão','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 10 | Excluir cartão | `js/99-init.js` · `excluirCartao` | `logInfo('Cartões','Excluir cartão','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 11 | Salvar compra (cartão) | `js/99-init.js` · `salvarCompra` | `logInfo('Cartões','Criar/Editar compra','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 12 | Excluir compra | `js/99-init.js` · `excluirCompra` | `logInfo('Cartões','Excluir compra','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 13 | Arquivar compra | `js/99-init.js` · `arquivarCompra` | `logInfo('Cartões','Arquivar compra','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 14 | Restaurar compra | `js/99-init.js` · `restaurarCompra` | `logInfo('Cartões','Restaurar compra','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 15 | Alterar status cartão | `js/99-init.js` · `alterarStatusCartao` | `logInfo('Cartões','Alterar status do cartão','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 16 | Lançar fatura por titular | `js/99-init.js` · `lancarFaturaTitular` | `logInfo('Cartões','Lançar fatura por titular','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 17 | Marcar fatura paga | `js/27-cards.js` · `marcarFaturaPaga` | `logInfo('Cartões','Marcar fatura como paga','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 18 | Salvar conta/recorrência | `js/99-init.js` · `salvarConta` | `logInfo('Calendário','Salvar conta','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 19 | Excluir conta | `js/99-init.js` · `excluirConta` | `logInfo('Calendário','Exclusão de conta','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 20 | Salvar investimento | `js/99-init.js` · `salvarInvestimento` | `logInfo('Investimentos','Salvar ativo','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 21 | Excluir investimento | `js/99-init.js` · `excluirInvestimento` | `logInfo('Investimentos','Excluir investimento','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 22 | Salvar movimentação investimento | `js/99-init.js` · `salvarMovimentacaoInvestimento` | `logInfo('Investimentos','Salvar movimentação','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 23 | Conciliação investimento | `js/99-init.js` · `conciliacaoInvestimento` | `logInfo('Investimentos','Conciliação','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 24 | Salvar movimentação caixinha | `js/99-init.js` · `salvarMovimentacaoCaixinha` | `logInfo('Caixinhas','Salvar movimentação','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 25 | Excluir caixinha | `js/99-init.js` · `excluirCaixinha` | `logInfo('Caixinhas','Excluir caixinha','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 26 | Salvar orçamento/categoria | `js/99-init.js` · `salvarOrcamento` | `logInfo('Orçamentos','Salvar orçamento','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 27 | Atualização cotações | `js/29-invest-movements.js` · `updateAllInvestmentPrices` | `logInfo('Cotação','Atualização em lote','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 28 | Geração contas recorrentes | `js/99-init.js` · `gerarContasRecorrentes` | `logInfo('Calendário','Geração automática','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |

## Falhas e bloqueios (críticos para integridade)

| # | Fluxo | Arquivo/Função | Evento de LOG/Auditoria | Teste | Status |
|---|-------|---------------|------------------------|-------|--------|
| 29 | Falha lançamento | `js/99-init.js` · `salvarLancamento` | `logSyncError('lançamento', err)` | `diagnostic-log-cycle4.test.mjs` | verde |
| 30 | Falha transferência | `js/99-init.js` · `transferenciaUniversal` | `logSyncError('transferência', err)` | `diagnostic-log-cycle4.test.mjs` | verde |
| 31 | Falha investimento | `js/99-init.js` · `salvarInvestimento` | `logSyncError('investimento', err)` | `diagnostic-log-cycle4.test.mjs` | verde |
| 32 | Falha investimento cotação | `js/29-invest-movements.js` · `updateAllInvestmentPrices` | `logSyncError('cotação CoinGecko', err)` | `diagnostic-log-cycle4.test.mjs` | verde |
| 33 | Bloqueio saldo insuficiente (investimento) | `js/99-init.js` · `transferenciaUniversal` | `logWarn('Transferência','Transferência universal','Bloqueada')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 34 | Falha caixinha | `js/99-init.js` · `salvarMovimentacaoCaixinha` | `logSyncError('movimentação de caixinha', err)` | `diagnostic-log-cycle4.test.mjs` | verde |
| 35 | Falha cartão | `js/27-cards.js` · `marcarFaturaPaga` | `logSyncError('marcar fatura como paga', err)` | `diagnostic-log-cycle4.test.mjs` | verde |

## Autenticação e sessão

| # | Fluxo | Arquivo/Função | Evento de LOG/Auditoria | Teste | Status |
|---|-------|---------------|------------------------|-------|--------|
| 36 | Login | `js/99-init.js` · `login` | `logInfo('Autenticação','Entrar','Sucesso')` | `diagnostic-log-cycle1.test.mjs` | verde |
| 37 | Logout | `js/99-init.js` · `logout` | `logInfo('Autenticação','Sessão encerrada','Sucesso')` | `diagnostic-log-cycle1.test.mjs` | verde |
| 38 | Falha autenticação | `js/99-init.js` · `login` | `logSyncError('autenticação', err)` | `diagnostic-log-cycle1.test.mjs` | verde |
| 39 | Login Google | `js/99-init.js` · `loginGoogle` | `logInfo('Autenticação','Entrar com Google','Sucesso')` | `diagnostic-log-cycle1.test.mjs` | verde |

## Segurança e proteção local

| # | Fluxo | Arquivo/Função | Evento de LOG/Auditoria | Teste | Status |
|---|-------|---------------|------------------------|-------|--------|
| 40 | Ativar PIN | `js/99-init.js` · `ativarPIN` | `logInfo('Segurança','Ativar PIN local','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 41 | Desativar biometria | `js/99-init.js` · `desativarBiometria` | `logInfo('Segurança','Desativar biometria','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 42 | Desbloquear PIN | `js/99-init.js` · `desbloquearPIN` | `logInfo('Segurança','Desbloquear PIN local','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |

## Conciliação

| # | Fluxo | Arquivo/Função | Evento de LOG/Auditoria | Teste | Status |
|---|-------|---------------|------------------------|-------|--------|
| 43 | Comparar saldos | `js/99-init.js` · `compararSaldos` | `logInfo('Conciliação','Comparar saldos','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 44 | Aplicar ajuste | `js/99-init.js` · `aplicarAjuste` | `logInfo('Conciliação','Aplicar ajuste','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |

## Importação / Exportação / Backup

| # | Fluxo | Arquivo/Função | Evento de LOG/Auditoria | Teste | Status |
|---|-------|---------------|------------------------|-------|--------|
| 45 | Exportar PDF | `js/31-import-export.js` · `exportarPDF` | `logInfo('Exportação','Exportação PDF','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 46 | Exportar Excel | `js/31-import-export.js` · `exportarExcel` | `logInfo('Exportação','Exportação Excel','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 47 | Exportar DOCX | `js/31-import-export.js` · `exportarDOCX` | `logInfo('Exportação','Exportação DOCX','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 48 | Restaurar backup | `js/99-init.js` · `restaurarBackup` | `logInfo('Importação','Restaurar backup','Sucesso')` | `diagnostic-log-cycle4.test.mjs` | verde |
| 49 | Backup exportado | `js/13-backup.js` · `exportBackup` | `logInfo('Backup','Exportação','Sucesso')` | `backup-restore.test.mjs` | verde |
| 50 | Sanitização backup | `js/13-backup.js` · `sanitizeBackupData` | — | `backup-restore.test.mjs` | verde |

## Infraestrutura

| # | Fluxo | Arquivo/Função | Evento de LOG/Auditoria | Teste | Status |
|---|-------|---------------|------------------------|-------|--------|
| 51 | Registro Service Worker | `js/99-init.js` · `registrarSW` | `logInfo('Sistema','Registro do Service Worker','Sucesso')` | `diagnostic-log-cycle1.test.mjs` | verde |
| 52 | Erro de interface | `js/99-init.js` · `globalErrorHandler` | `logSyncError('erro de interface', error)` | `diagnostic-log-cycle1.test.mjs` | verde |
| 53 | Rejeição assíncrona | `js/99-init.js` · `unhandledRejection` | `logSyncError('rejeição assíncrona', ...)` | `diagnostic-log-cycle1.test.mjs` | verde |

## Resumo

| Métrica | Valor |
|---------|-------|
| Total de fluxos mapeados | 53 |
| Cobertos por teste (verde) | 53 |
| Parcialmente cobertos (amarelo) | 0 |
| Não cobertos (vermelho) | 0 |
| Testes de regressão (worker/test) | 55 (Cycle 1-5 + Fase 6 + backup-restore) |
| Testes passando | 55 |

**Conclusão:** 100% dos fluxos financeiros críticos estão mapeados na matriz e cobertos por testes de regressão executáveis. Não há fluxo crítico sem cobertura de teste.
