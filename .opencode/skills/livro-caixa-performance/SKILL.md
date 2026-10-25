---
name: livro-caixa-performance
description: Skill de desenvolvimento focada em desempenho e otimização para o LIVRO-CAIXA. Ajuda a identificar gargalos, evitar regressões de performance e aplicar otimizações seguras.
---

# Skill: livro-caixa-performance

Skill de desenvolvimento para otimização de desempenho do LIVRO-CAIXA.

## Quando usar

Use quando:
- Identificar lentidão na renderização de telas (dashboard, cards, fatura, investimentos)
- Precisar otimizar loops sobre grandes volumes de lançamentos
- Querer evitar regressões de performance ao alterar JS/CSS
- Precisar medir/profiling de funções críticas

## Estrutura de arquivos grandes (pontos de atenção)

Arquivos JS com maior quantidade de linhas — focar revisão de performance aqui (contagens em 25/10/2026):

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `js/99-init.js` | 3417 | Dispatcher de inicialização (`DOMContentLoaded`) |
| `js/18-render-core.js` | 2192 | Renderização núcleo |
| `js/20-dashboard.js` | 1797 | Dashboard principal |
| `js/domain/card-engine-v3-combined.js` | 1639 | Motor de cartões (domínio) |
| `js/27-cards.js` | 1030 | Cartões / faturas |
| `js/25-bills-receivables.js` | 784 | Contas a receber |
| `js/31-import-export.js` | 644 | Import/export |

## Padrões a evitar (performance)

1. **Re-renderização completa em cada evento** — não reconstruir toda a lista/tabela a cada mudança pequena; usar atualização incremental quando possível.
2. **Loops aninhados sobre lançamentos** — evitar O(n²) em listas de transações.
3. **QuerySelector em loop** — cachear referências DOM fora de loops frequentes.
4. **Event listeners duplicados** — remover listeners anteriores antes de adicionar novos (especialmente em modais e tabs).
5. **Leitura repetida de `localStorage`/`IndexedDB`** em loops — cachear em variável local.
6. **CSS global pesado** — `style/features.css` (212KB / 6.856 linhas) e `style/layout.css` (57KB) são grandes; evitar regras `!important` e seletores complexos.

## Checklist de otimização

- [ ] Funções críticas executam em < 16ms (60fps)
- [ ] Nenhum loop aninhado desnecessário sobre lançamentos
- [ ] Referências DOM cacheadas fora de loops
- [ ] Event listeners não duplicados
- [ ] Debounce/throttle em inputs de busca e scroll
- [ ] Imagens/assets otimizadas (ícones em `icon-*.png`)
- [ ] Service Worker (`sw.js`) não bloqueia navegação
- [ ] Build/tests passam: `npm run code:syntax` e `npm run code:test`

## Comandos de validação

```bash
# Sintaxe dos JS alterados
node --check js/<arquivo>.js

# Testes E2E + oracles
npm run code:test

# Apenas sintaxe do projeto
npm run code:syntax

# Servidor local para teste manual
npm run code:serve
```

## Fluxo de alteração segura

1. Identificar a função/lógica lenta
2. Medir antes (`console.time` / performance.now) — remover medições antes de commitar
3. Aplicar otimização mínima
4. Medir depois
5. Validar com `npm run code:test`
6. Remover instrumentação temporária
7. Revisar `git diff`

## Regra de ouro

**Não otimizar prematuramente.** Primeiro identificar problema real, medir impacto, então aplicar a menor alteração que resolva. Preservar comportamento financeiro existente (saldos, parcelas, faturas).

## Não fazer

- Não remover listeners de autenticação (`onAuthStateChanged`)
- Não alterar schema do Firestore sem migração
- Não excluir arquivos de backup (`*.backup-*`, `*.bak-*`)
- Não alterar regras de cálculo do `card-engine-v3-combined.js` sem verificar consumidores
