# Phase B — Consolidação Estrutural da ABA Início

> **Nota de atualização (F1.2, 20/11/2026):** este documento descreve originalmente a
> consolidação estrutural da Fase B. O conteúdo histórico foi preservado, mas a seção
> "Estado atual" foi reconciliada no HEAD `23444f0`, após as divergências D-01 a D-08.
> A branch foi renomeada para `feat/app-layout-redesign`; o nome anterior
> `feat/app-navigation-redesign` permanece apenas em registros históricos. IDs legados permanecem nas views legadas;
> a view Início utiliza hosts próprios por classe. A conclusão de D-01 a D-08 **não**
> implica a conclusão das divergências macro C.1 a C.8.

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

## Estado em 20/11/2026 — HEAD `23444f0` (recorte histórico)

> Para a composição vigente, ver `tmp-c13/c6-3`, `tmp-c13/c6-4` e `tmp-c13/c6-5`; Patrimônio saiu de `#viewInicio`, Resumo do Fluxo não pertence à Início e Orçamentos foi adicionado em `f14955d`.

### Identificação
- **Branch:** `feat/app-layout-redesign` (renomeada de `feat/app-navigation-redesign`)
- **Commit verificado:** `23444f0a62f5e5c2b45eed0905442a6e6069ca44`
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

### Integrações concluídas (D-01 a D-08)

| Divergência | Integração | Commit | Evidência |
|---|---|---|---|
| D-01 | Início na barra inferior (substitui `dashboard` na 1ª posição) | `94afc3e` | 13/13 validações CDP PASS |
| D-02 | Início no Drawer (`data-drawer-action="inicio"`) | `dc16497` | 9/9 validações CDP PASS |
| D-03 | Próximo Pagamento em Início (reutiliza o cálculo de `renderAdvancedDashboard`) | `86d7229` | 6/6 validações CDP PASS |
| D-04 | Resumo do Fluxo em Início (reutiliza o cálculo, sem duplicar ID) | `8a2f4c9` | 8/8 validações CDP PASS |
| D-05 | Composição CSS da view Início (grid responsivo, tokens existentes) | `9dfdda6` | 19/19 validações CDP PASS |
| D-06 | Documentação auxiliar da Fase B reconciliada | `23444f0` | hosts reais e HEAD verificado |
| D-07 | Comentário obsoleto de `style/themes.css` corrigido | `23444f0` | diff restrito ao comentário |
| D-08 | Registro da branch no roadmap do Notion | `23444f0` | seção 20/11 verificada no Notion |

**Total:** 55 verificações CDP PASS, 0 FAIL, nos itens D-01 a D-05; D-06 a D-08 são documentais e foram verificados por inspeção.

**Já integrados e funcionando:** Patrimônio Total (`renderBalances()`), gráfico
patrimonial (instâncias `inicio` e `strip`), Saúde Financeira, Próximo Pagamento e
Resumo do Fluxo.

### Ainda pendente / fora de escopo

- **Sincronização ponta a ponta com Firebase Auth/Firestore:** não validada neste
  ciclo (ambiente de teste usa stub; dados sintéticos determinísticos — ver
  `docs/padroes/METODOLOGIA-VALIDACAO-NAVEGACAO-CDP.md`, seção 5.1).
- **C.1 a C.8:** a conclusão de D-01 a D-08 **não** conclui as divergências macro da
  auditoria. Elas permanecem com seus próprios estados e evidências.
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

### Estado atual (D-01 a D-08)
- [x] Início acessível pela barra inferior e pelo Drawer
- [x] Próximo Pagamento e Resumo do Fluxo renderizados em Início reutilizando cálculos
- [x] Composição CSS da view Início com grid responsivo e tokens existentes
- [x] Sem overflow horizontal em mobile/tablet/desktop; sem regressão nas demais views
- [x] Documentação auxiliar, comentário CSS e roadmap atualizados
- [ ] Validação ponta a ponta com Firebase autenticado (fora de escopo — ver pendências)
- [ ] Divergências macro C.1 a C.8 (fora de escopo; não concluídas por D-01 a D-08)

## Resumo das Alterações

### Fase B (histórico)
- 3 arquivos modificados, 37 linhas adicionadas e 3 removidas
- Estrutura DOM da view Início criada
- Nova aba `inicio` registrada em `TAB_NAMES`

### D-01 a D-08 (atual)
- `index.html`: botão Início na bottom nav (D-01) e no Drawer (D-02)
- `js/99-init.js`: mapeamento `inicio` no dispatcher do Drawer (D-02)
- `js/20-dashboard.js`: hosts de Início para Próximo Pagamento (D-03) e Resumo do Fluxo (D-04), reutilizando o mesmo HTML/cálculo
- `style/features.css`: composição/grid/responsividade da view Início (D-05), apenas tokens existentes
- `style/themes.css`: comentário de ordem de carregamento corrigido (D-07)
- `docs/implementacoes/navegacao/NOTION_PHASE_B_CONTENT.md`: hosts, HEAD e divergências reconciliados (F1.2/D-06)
- Roadmap no Notion: seção "Atualização da branch de redesign — 20/11/2026" (D-08)
- Evidências: scripts e JSONs de validação CDP em `tmp-c13/`; screenshots antes/depois do baseline em `tmp-c13/d05-*.png`
