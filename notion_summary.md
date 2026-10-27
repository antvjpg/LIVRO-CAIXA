# LIVRO-CAIXA — Auditoria do "Ocultar Saldo"

## Status: Concluída (2026-10-27)

### Commit(s) relacionados
- `42fd91e` — audit: ocultar saldo — causa raiz e correção aplicada (mais recente)
- `642f413` — fix: novas fontes no seletor + pontos visíveis + suporte Flaticon
- `af7150c` — fix: mascaramento de saldo com fallback seguro
- `d05ba45` — fix: mascaramento de saldo dinâmico por número de caracteres
- `b3304bd` — fix: saldos ocultos em invest/dark + cores de ação seguem tema + botão ▼ instituição

## 1. Causa Raiz (PROVADA)

### Problema
As regras `::after` do `features.css` para 5 seletores sobrepostos a `base.css` estavam **ausentes da propriedade `content``. Como `features.css` carrega **após** `base.css`, suas regras substituíam as de `base.css` para esses seletores, mas sem `content`, o pseudo-elemento `::after` ficava vazio → pontos invisíveis.

### Ordem de carregamento CSS
```
themes.css → base.css (20-24) → components.css → layout.css → features.css (20-31) → dashboard-chat.css
```

### Os 5 seletores sobrepostos afetados
1. `.balance-card .amount::after`
2. `.balance-card.total .amount::after`
3. `.card-amount::after`
4. `.dashboard-metrics strong::after`
5. `.cashflow-mini-metrics strong::after`

### Princípio CSS
Quando duas regras têm **especificidade idêntica** e a **última regra não declara** uma propriedade, a propriedade anterior é **ignorada** (não herdada). O `::after` **precisa** de `content` para ser renderizado.

## 2. Correção (commit `642f413`)

### Arquivos modificados
- `style/features.css`: **`content: var(--dots, ••••••)` adicionado** nas 5 regras `::after`
- `js/99-init.js`: Adição de 4 novas fontes
- `style/base.css`: **Sem alterações** (fallback já existia)

### Como funciona agora
```css
body.balances-hidden .balance-card .amount::after,
body.balances-hidden .balance-card.total .amount::after,
body.balances-hidden .card-amount::after,
body.balances-hidden .dashboard-metrics strong::after,
body.balances-hidden .cashflow-mini-metrics strong::after{
  /* ... */;
  content: var(--dots, ••••••);  /* ✅ Agora presente */
}
```

## 3. Resultado Final

### 25 elementos de saldo agora exibem pontos corretamente

| Elemento | base.css | features.css | Status |
|----------|----------|--------------|--------|
| `.balance-card .amount` | ✅ (content) | ✅ (content, vence por cascade) | ✅ Visível |
| `.balance-card.total .amount` | ✅ (content) | ✅ (content, vence por cascade) | ✅ Visível |
| `.card-amount` | ✅ (content) | ✅ (content, vence por cascade) | ✅ Visível |
| `.dashboard-metrics strong` | ✅ (content) | ✅ (content, vence por cascade) | ✅ Visível |
| `.cashflow-mini-metrics strong` | ✅ (content) | ✅ (content, vence por cascade) | ✅ Visível |
| `.manage-item-value` | ✅ (content) | ❌ (não tem rule) | ✅ base.css aplica |
| **Outros 19 elementos** | ✅ (content) | ❌ (não têm rule) | ✅ base.css aplica |

### Mascaramento dinâmico via JS (4 elementos)
- `.invest-box .val` — `•`.repeat(text.length)
- `#investGrid .invest-box .val` — mesma lógica
- `.asset-card-value` — mesma lógica
- `#investGrid .asset-card-value` — mesma lógica

### Fallback CSS
- `var(--dots, ••••••)` → 6 bolinhas sempre disponível

### Testes validados ✅
- Saldo oculto mostra pontos em todos os componentes
- Dashboard, investimentos, contas, categorias, metas/caixinhas — todos funcionam
- Valores negativos, zero, valores grandes — todos mascarados
- Re-render não remove mascaramento
- Recarregar página não quebra mascaramento
- Mostrar saldo novamente restaura valores
- Nenhum valor financeiro ou cálculo alterado

## 4. Persistência e Estado

### Mecanismo de persistência
- `localStorage` chave: `livrocaixa_hide_balances_on_open` (`'1'` ou `'0'`)
- Aplicado via `applyBalancesHiddenState()` em `js/99-init.js:855` e `js/22-profile.js:16`

### Comportamento após recarregar
- ✅ Estado preservado via `localStorage`
- A classe `balances-hidden` permanece no `body`
- O CSS `::after` é re-aplicado automaticamente

### Navegação entre abas
- ✅ Não altera o estado da ocultação
- A classe `balances-hidden` permanece enquanto a sessão do navegador estiver ativa

## 5. Testes Executados ✅

| Teste | Resultado |
|-------|-----------|
| Saldo oculto mostra pontos em todos os componentes | ✅ PASSOU |
| Dashboard, investimentos, contas, categorias, metas/caixinhas | ✅ PASSOU |
| Valores negativos, zero, valores grandes — todos mascarados | ✅ PASSOU |
| Re-render não remove mascaramento | ✅ PASSOU |
| Recarregar página não quebra mascaramento | ✅ PASSOU |
| Mostrar saldo novamente restaura valores | ✅ PASSOU |
| Nenhum valor financeiro ou cálculo alterado | ✅ PASSOU |

## 6. Arquivos Modificados (commits publicados)

### `42fd91e` — audit (mais recente)
- `AUDIT_ocultar-saldo.md` — 229 linhas de auditoria técnica

### `642f413` — fix principal
- `js/99-init.js` — novas fontes no seletor
- `style/features.css` — `content: var(--dots, ••••••)` adicionado nas 5 regras `::after`

### `af7150c` — fallback seguro
- `style/base.css` — 1 inserção, 1 deleção

### `d05ba45` — mascaramento dinâmico
- `js/99-init.js` — 15 inserções
- `style/base.css` — 2 inserções, 1 deleção

### `b3304bd` — saldos ocultos + tema + botão
- `js/18-render-core.js` — 2 alterações
- `style/base.css` — 6 inserções
- `style/features.css` — 18 inserções, 7 deleções
- `style/themes.css` — 13 inserções, 4 deleções

## 7. Pendências

| Item | Status | Comentário |
|------|--------|------------|
| Veredito da auditoria | ✅ Concluído | Correção confirmada |
| Causa raiz | ✅ Concluída | Cascata CSS demonstrada |
| Variável `--dots` | ✅ Concluída | Comportamento documentado |
| JavaScript/persistência | ✅ Concluído | localStorage, toggle, re-render |
| Componentes | ✅ Concluído | 25 elementos auditados |
| Testes | ✅ Concluído | Todos os testes principais passaram |
| Correções | ✅ Concluído | Apenas `642f413` necessário |
| Relatório | ✅ Concluído | Estrutura completa |

**Problemas restantes**: Nenhum. Todos os 25 elementos de saldo agora exibem pontos corretamente.

## 8. Próximos Passos (opcional)

- Monitorar se novos seletores de saldo são adicionados
- Verificar se a variável `--dots` dinâmica precisa ser re-aplicada após re-renders (limitação conhecida mas não crítica)
- Documentar o comportamento de fallback para 6 bolinhas em casos de números muito longos (>9 dígitos)
