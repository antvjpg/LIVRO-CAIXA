# Phase B — Consolidação Estrutural da ABA Início

> **Nota de atualização (D-06, 20/11/2026):** este documento descreve originalmente a
> consolidação estrutural da Fase B. O conteúdo histórico foi preservado, mas a seção
> "Estado atual" foi atualizada para refletir a branch `feat/app-navigation-redesign`
> após as divergências D-01 a D-05. IDs legados permanecem nas views legadas; a view
> Início utiliza hosts próprios por classe.

## Contexto histórico (Fase B)

### Branch
`feat/app-navigation-redesign` (SHA histórico da Fase B: `9181d0d`)

### HEAD (histórico)
- Inicial: `9181d0d Merge pull request #9 from antvjpg/feat/tabler-icon-foundation`

### Arquivos Modificados na Fase B (3 files, +37/-3 lines)

#### 1. `index.html`
- Inserida view `viewInicio` com estrutura de cards para Patrimônio Total, Saúde
  Financeira e Próximos Pagamentos
- FAB `#fabAdd` mantido no shell global

#### 2. `js/99-init.js`
- Adicionado `'inicio'` ao array `TAB_NAMES`
- Habilita persistência da última aba via `sessionStorage`

#### 3. `js/20-dashboard.js`
- Corrigida referência quebrada: `document.getElementById('tabBtnDashboard')?.click`
- Substituído por `window.switchTab('dashboard')`

---

## Estado atual (verificado em 20/11/2026 — HEAD `9dfdda6`)

### Identificação
- **Branch:** `feat/app-navigation-redesign`
- **Commit verificado:** `9dfdda6fb4bd3a98434d4b8d965a9b7e15661639`
- **Base comum com `main`:** `f513611afb5195b501a896f66ed5b7c7848c2986`
- **Origem:** auditoria de conformidade `feat/app-navigation-redesign × Notion — 20/11/2026`

### Hosts reais (correção do registro histórico)

O registro histórico afirmava que `#advancedDashboard` e `#dashboardNextPayment`
estavam "dentro da view Início". **Isso não corresponde ao HTML atual.** A realidade
verificada:

| Conteúdo | Host legado (view antiga) | Host da view Início |
|---|---|---|
| Saúde Financeira | `#advancedDashboard` (em `#viewDashboard`) | `.advanced-dashboard` (em `.inicio-card.advanced-dashboard-card`) |
| Próximo Pagamento | `#dashboardNextPayment` (em `#viewDashboard`) | `.next-pay-inner` (em `.inicio-card.dashboard-next-payment-card`) |
| Resumo do Fluxo | `#cashflowMiniSummary` (em `#viewCaixa`) | `.cashflow-mini-summary` (em `.inicio-footer`) |

**Nenhum ID foi duplicado** para fazer o texto coincidir. Início usa seletores de
classe; os IDs legados permanecem em suas views originais.

### Integrações concluídas (D-01 a D-05)

| Divergência | Integração | Evidência |
|---|---|---|
| D-01 | Início na barra inferior (substitui `dashboard` na 1ª posição) | 13/13 validações CDP PASS |
| D-02 | Início no Drawer (`data-drawer-action="inicio"`) | 9/9 validações CDP PASS |
| D-03 | Próximo Pagamento em Início (reutiliza o cálculo de `renderAdvancedDashboard`) | 6/6 validações CDP PASS |
| D-04 | Resumo do Fluxo em Início (reutiliza o cálculo, sem duplicar ID) | 8/8 validações CDP PASS |
| D-05 | Composição CSS da view Início (grid responsivo, tokens existentes) | 19/19 validações CDP PASS |

**Já integrados e funcionando:** Patrimônio Total (`renderBalances()`), gráfico
patrimonial (instâncias `inicio` e `strip`), Saúde Financeira, Próximo Pagamento e
Resumo do Fluxo.

### Ainda pendente / fora de escopo

- **Sincronização ponta a ponta com Firebase Auth/Firestore:** não validada neste
  ciclo (ambiente de teste usa stub; dados sintéticos determinísticos — ver
  `docs/padroes/METODOLOGIA-VALIDACAO-NAVEGACAO-CDP.md`, seção 5.1).
- **D-06 a D-08:** documentação (este arquivo, comentário CSS e roadmap) — em execução.
- **Coleta completa de consumidores `--accent`:** bloqueada; depende de aprovação
  independente.

## Regras de proteção (preservadas)

- ✅ Nenhum redesign visual amplo; alterações restritas à view Início
- ✅ Nenhum elemento movido indevidamente de `#viewCaixa`
- ✅ `#universalPeriodBar` não movido para Início (compartilhado com Investimentos e Caixinhas)
- ✅ Motores financeiros preservados (`renderBalances()`, `renderAdvancedDashboard()`)
- ✅ IDs legados preservados; hosts de Início por classe
- ✅ Nenhuma alteração de lógica financeira

## Acceptance Criteria

### Fase B (histórico)
- [x] view Início possui estrutura DOM explícita e coerente
- [x] Patrimônio pertence estruturalmente à view correta
- [x] Elementos de conteúdo não dependem de exceções frágeis
- [x] Motores financeiros continuam sendo reutilizados
- [x] Filtros e períodos preservam semântica atual
- [x] Dashboard analítico continua independente
- [x] Navegação e atalhos não apontam para IDs inexistentes
- [x] FAB continua funcionando
- [x] Gráficos preservam ciclo de vida
- [x] Nenhuma perda de funcionalidades

### Estado atual (D-01 a D-05)
- [x] Início acessível pela barra inferior e pelo Drawer
- [x] Próximo Pagamento e Resumo do Fluxo renderizados em Início reutilizando cálculos
- [x] Composição CSS da view Início com grid responsivo e tokens existentes
- [x] Sem overflow horizontal em mobile/tablet/desktop; sem regressão nas demais views
- [ ] Validação ponta a ponta com Firebase autenticado (fora de escopo — ver pendências)

## Resumo das Alterações

### Fase B (histórico)
- 3 arquivos modificados, 37 linhas adicionadas e 3 removidas
- Estrutura DOM da view Início criada
- Nova aba `inicio` registrada em `TAB_NAMES`

### D-01 a D-05 (atual)
- `index.html`: botão Início na bottom nav (D-01) e no Drawer (D-02)
- `js/99-init.js`: mapeamento `inicio` no dispatcher do Drawer (D-02)
- `js/20-dashboard.js`: hosts de Início para Próximo Pagamento (D-03) e Resumo do Fluxo (D-04), reutilizando o mesmo HTML/cálculo
- `style/features.css`: composição/grid/responsividade da view Início (D-05), apenas tokens existentes
- Evidências: scripts e JSONs de validação CDP em `tmp-c13/`; screenshots antes/depois do baseline em `tmp-c13/d05-*.png`
