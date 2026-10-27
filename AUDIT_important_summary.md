# Auditoria de `!important` no Código-fonte LIVRO-CAIXA

> **Status:** CICLO CONCLUÍDO em 2026-10-27.
> **Resultado final:** 274 → 2 `!important` em `style/features.css` (redução de 99,3%).
> **Teste visual:** 9/9 fases aprovadas pelo usuário.

---

## 1. Resultado Final

| Arquivo | Início | Final | Redução |
|---------|--------|-------|---------|
| `style/features.css` | **274** | **2** | **99,3%** |
| `style/components.css` | 0 | 0 | — |
| `style/layout.css` | 1 | 1 | — (mantido) |
| **Total** | **275** | **3** | **98,9%** |

### Restantes (intencionais)

| Linha | Regra | Razão para manter |
|-------|-------|-------------------|
| 786 | `@media (prefers-reduced-motion:reduce){...transition:none!important;animation:none!important}` | Acessibilidade — desativa animações |
| 967 | `.filter-state-select{position:absolute!important;...}` | Padrão screen-reader (esconder do visual) |

### Commits realizados (sem push)

1. `dd65f70` — remove !important (274→46)
2. `6c99996` — remove more !important (46→33)
3. `01e6fef` — remove !important with specificity fixes (46→2)

### Teste visual: 9/9 fases aprovadas

1. ✅ Navegação entre abas (Perfil, Metas, Caixa)
2. ✅ Modais e Overlays (Nova Meta, Filtros)
3. ✅ Saldo oculto (••••••)
4. ✅ Perfil (grupos, proteção local)
5. ✅ Barra de Período (eyebrow, active-label)
6. ✅ Formulário Nova Meta (display:flex)
7. ✅ Filtros (busca min-height)
8. ✅ Header mobile (safe-area-inset)
9. ✅ Acessibilidade (reduced-motion)

---

## 2. Correções de Especificidade Aplicadas

Para cada `!important` removido, verificou-se se havia regra conflitante. Quando havia, a solução foi garantir que a regra alvo tivesse especificidade maior ou viesse depois na cascata.

| Regra | Conflito potencial | Correção |
|-------|-------------------|----------|
| `body.balances-hidden .balance-card .amount` | base.css L9-25 mesmo efeito | Removido — base.css já cobre |
| `.profile-group[hidden]` | base.css L2 `[hidden]` | Removido — base.css já cobre |
| `#universalPeriodBar .period-eyebrow` | components.css `.period-eyebrow` (0,1,0) | Especificidade (1,3,0) maior — removido |
| `.modal-overlay` z-index | layout.css `.modal-overlay` (0,1,0) | Especificidade (0,2,1) maior — removido |
| `.goals-form-sheet.open` | components.css `.panel.open` (0,2,0) | Mesma especificidade, features.css carrega depois — removido |
| `.filter-choice-sheet` left/bottom | features.css L947 (0,1,0) | Especificidade (1,2,0) maior — removido |
| `#viewProfile` toggles | Nenhum conflito | Removido |
| `#viewGoals` toggles | Nenhum conflito | Removido |
| `.filter-choice-search` min-height | Nenhum conflito | Removido |
| `header.app-header` safe-area | Nenhum conflito | Removido |
| `.bill-value-block input` outline | Nenhum conflito | Removido |

---

## 3. Princípios de Classificação

**Remover `!important` é SEGURO quando:**
- A regra é **duplicata exata** de outra regra (mesmo seletor, propriedade, valor)
- A propriedade **não se aplica** ao elemento (ex.: `gap` em `display:block`)
- O valor é **idêntico** ao que a cascata já fornece sem `!important`
- A regra alvo tem **especificidade maior** que a conflitante
- A regra alvo **vem depois** na cascata com mesma especificidade

**Remover `!important` é INSEGURO quando:**
- Outra regra com `!important` conflitante assumiria o controle
- A propriedade **não existe em nenhuma outra regra** (remover faria o estilo sumir)
- A declaração **é a própria feature** (ex.: `color:transparent` na feature "ocultar saldos")
- O `!important` vence estilos de framework/UA

---

## 4. Lições

1. **Contagens de `!important` mudam** — sempre re-verificar antes de agir
2. **Uma auditoria não é especificação** — classificações "seguras" precisam ser validadas contra o código real
3. **Regras duplicatas** são o caso mais comum de `!important` realmente seguro remover
4. **Análise de cascata** encontra redundâncias que a comparação simples não vê
5. **`min-height` inópudio** quando `height` base é maior — verificar o valor base
6. **Especificidade importa** — ID > class > element; mesma especificidade = ordem de carga vence
7. **Teste visual é obrigatório** para display toggles, z-index e position

---

*Arquivo: `AUDIT_important_summary.md`*
*Concluído em: 2026-10-27*
*Total: 275 → 3 `!important` (98,9% redução)*
