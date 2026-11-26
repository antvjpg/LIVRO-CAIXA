# C6-INICIO-03 — Refinamento visual, tipografia e tokens semânticos

## 1. Identificação

- **SHA inicial:** `ef2b0b113a3b6900c323d59ad81932b595f14f30`
- **SHA final:** `ef2b0b113a3b6900c323d59ad81932b595f14f30`
- **Branch:** `feat/app-layout-redesign`
- **Estado Git final:** `M e2e/smoke/inicio.spec.js`; `M style/features.css`; `?? tmp-c13/c6-3/`
- **Commit/push/merge/release/deploy:** nenhum.

A posição, a ordem, a composição da grade, os componentes removidos/preservados e o DOM da aba Início permanecem exatamente como no SHA aprovado. Nenhuma alteração estrutural foi feita.

## 2. Diagnóstico dos tokens existentes

### Superfícies

- Página: `--paper` (`main`/`body`).
- Cards genéricos: `--surface`.
- Superfície elevada: `--surface-raised`.
- Superfície secundária: `--paper-2`.
- Destaque: `--surface-accent` + `--accent`.
- Bordas/divisores: `--line` e variações com `--accent`.
- Interação: `--hover-soft`, `--color-gold` (foco) e `--accent`.

### Tipografia

- Escala disponível: `--font-size-caption` (10px), `--font-size-body` (13px), `--font-size-title` (18px), `--font-size-heading` (27px), `--line-height-tight`, pesos existentes.
- Antes do ajuste: rótulos entre 9–11px, valor do Patrimônio em 22px, valores dos cards em 18–32px conforme viewport.
- Foram identificados valores literais em componentes da Início em vez de tokens (`9px`, `10px`, `22px`), sem uma escala paralela nova.

### Cores semânticas

- Positivo: `--success` / `--success-subtle` / `--success-foreground`.
- Negativo: `--danger` / `--danger-subtle` / `--danger-foreground`.
- Atenção: `--warning`.
- Destaque/ação: `--accent` / `--accent-subtle` / `--accent-foreground`.
- Texto principal/secundário: `--ink` / `--ink-soft`.

### Inconsistências encontradas

1. O card Patrimônio Total usava o tratamento genérico de `.balance-card` (`--paper`), enquanto o card total do Livro-Caixa usa gradiente `--surface-accent → --accent` (claro) ou `--surface-accent → --accent-subtle` (escuro).
2. Cards de saldo e Saúde Financeira usavam superfícies muito próximas do fundo da página: separação luminosa de apenas 1,05–1,12.
3. Texto pequeno (`balance-share`, `next-pay-kicker`) usava `--accent`, com contraste insuficiente em temas claros.
4. Textos secundários da Saúde Financeira usavam `--ink-soft`; no tema claro-4 isso resultava em 4,12:1.
5. A Saúde Financeira usava `--paper`, enquanto os demais cards usavam `--surface`, criando diferença de superfície não intencional.
6. Espaçamento interno superior (20–22px) e margem do cabeçalho (10px) afastavam título e conteúdo.

## 3. Mapeamento aplicado aos componentes da Início

| Componente | Tokens/estratégia após ajuste |
|---|---|
| Patrimônio Total | Gradiente `--surface-accent → --accent` (claro) / `--surface-accent → --accent-subtle` (escuro); foreground `--header-foreground` / `--ink`; borda e sombra derivadas de `--accent`. |
| Bancos/Caixinhas/Investimentos | `color-mix(in srgb, var(--paper-2) 72%, var(--accent-subtle))`; borda `--accent + --line`; sombra derivada de `--accent`. |
| Percentuais | Texto `--ink`; fundo `--accent-subtle`; borda `--accent + --line`. |
| Saúde Financeira | Mesma superfície dos cards de saldo; eyebrow, descrição e legenda em `--ink`; score mantém `--accent`; indicadores mantêm `--success`/`--danger`. |
| Próximo Pagamento | Mesma superfície; kicker em `--ink`; inner levemente misturado com `--accent-subtle`. |
| Tipografia | `--font-size-caption`, `--font-size-body`, `--font-size-heading`, `--line-height-tight`. |

Nenhuma cor fixa nova foi introduzida. Nenhuma regra por tema foi criada além das já existentes para claro/escuro no próprio card de Patrimônio, espelhando o tratamento do Livro-Caixa.

## 4. Comparação com os cards do Livro-Caixa

O Livro-Caixa foi usado apenas como referência:

- `.balance-card.total` usa `--surface-accent`/`--accent` e `--header-foreground` no claro, e `--surface-accent`/`--accent-subtle` e `--ink` no escuro.
- Os cards de saldo usam `--surface` com borda `--line`.

Na Início, o Patrimônio Total passou a reproduzir o mesmo tratamento do card total, sem tocar em `.balance-card.total` global. Os cards de saldo receberam uma mistura secundária de `--paper-2` com `--accent-subtle` para recuperar distinção em relação ao fundo da página, sem alterar Livro-Caixa.

## 5. Contraste e legibilidade

Referência WCAG 2.2: 4,5:1 para texto normal e 3:1 para texto grande/componentes gráficos. Medições com `getComputedStyle` nos dez temas, em viewport 1280×800, antes e depois.

- Pares abaixo do limite antes: **10**.
- Pares abaixo do limite depois: **0**.

| Tema | bankShare antes→depois | nextKicker antes→depois | healthEyebrow antes→depois | healthScore antes→depois | pageVsCard antes→depois |
|---|---|---|---|---|---|
| claro-1-oliva | 6,20→12,44 | 4,43→13,18 | 6,66→13,18 | 4,43→3,96 | 1,08→1,12 |
| claro-2-verde | 4,15→11,57 | 4,88→11,58 | 4,58→11,58 | 4,88→4,58 | 1,06→1,07 |
| claro-3-lima | 4,43→7,41 | 3,64→7,19 | 4,82→7,19 | 3,64→3,32 | 1,05→1,10 |
| claro-4-terracota | 3,82→11,39 | 3,37→11,34 | 4,12→11,34 | 3,37→3,00 | 1,06→1,12 |
| claro-5-laranja | 5,07→15,65 | 3,57→15,37 | 5,62→15,37 | 3,57→3,32 | 1,05→1,08 |
| escuro-1-oliva | 4,74→8,85 | 9,90→12,28 | 6,74→12,28 | 9,90→8,10 | 1,10→1,22 |
| escuro-2-verde | 4,97→12,43 | 8,22→15,79 | 6,68→15,79 | 8,22→6,93 | 1,10→1,19 |
| escuro-3-bege | 4,99→10,61 | 8,07→13,39 | 6,81→13,39 | 8,07→6,81 | 1,10→1,19 |
| escuro-4-terracota | 5,49→10,62 | 6,48→13,60 | 7,32→13,60 | 6,48→5,39 | 1,11→1,20 |
| escuro-5-laranja | 6,95→13,65 | 5,58→16,91 | 8,73→16,91 | 5,58→4,73 | 1,12→1,18 |

`healthScore` é texto grande (21px/800), então o limite aplicado é 3:1. O valor 3,00 no tema claro-4 atende ao limite; nenhum outro par ficou abaixo do respectivo mínimo.

Dados completos: `metricas/contraste-antes.json` e `metricas/contraste-depois.json`.

## 6. Tipografia e espaçamento interno

| Propriedade | Antes | Depois |
|---|---|---|
| Label Patrimônio | 11px | `--font-size-body` (13px) |
| Valor Patrimônio | 22px (desktop) | `--font-size-heading` (27px), `clamp(27px, 4vw, 40px)` no desktop |
| Label Bancos/Caixinhas/Invest. | 9–10px | `--font-size-caption` (10px) em todos os viewports |
| Valor Bancos | 22–32px | 22–34px |
| Valor Caixinhas/Invest. | 18–22px | 18–26px |
| Indicadores da Saúde | 10–13px | 11–14px |
| Padding superior | 20–22px | 16px nos cards da Início |
| Margem do cabeçalho interno | 10px | 6px nos cards da Início |

O valor do Patrimônio não provoca overflow em 320px (ver captura `viewport/inicio-320x720-claro-1-oliva.png`).

## 7. Arquivos modificados

| Arquivo | Alteração | Justificativa |
|---|---|---|
| `style/features.css` | Ajustes de superfície, tipografia, contraste e padding somente na seção C6-INICIO-02 / `#viewInicio` / `main > .inicio-patrimonio`. | Corrigir a origem das inconsistências sem alterar componentes compartilhados. |
| `e2e/smoke/inicio.spec.js` | Novo `surfaceSnapshot` com assertions de gradiente, superfície distinta, superfície igual entre cards de saldo e Saúde, fonte do Patrimônio e padding/margem internos. | Proteger o refinamento com estilos computados, sem remover verificações anteriores. |

Nenhum outro arquivo de produção foi modificado. `index.html`, JavaScript de domínio, temas, Livro-Caixa e Visão Geral permanecem intactos.

## 8. Matriz visual

- Viewports: 320×720, 360×800, 390×844 e 1280×800.
- Temas: claro-1..5 e escuro-1..5.
- 40 combinações, 50 capturas (40 viewport + 10 full-page em 390×844).
- Resultado: 40/40 PASS para overflow, ordem, ausência do Resumo do Fluxo, detalhamento recolhido, score visível e hierarquia preservada.

Matriz: `depois/prints/MATRIZ.md`. Capturas: `depois/prints/viewport/` e `depois/prints/fullpage/`.

### Natureza das verificações

- Harness CDP com dados fictícios e CSS real: matriz de temas/viewports, contraste e capturas.
- Aplicativo integrado via CDP com JavaScript habilitado: `ISOLAMENTO.json` confirma Início, Livro-Caixa e Visão Geral após navegação real.
- Não houve sessão QA autenticada local; cores e tipografia dependem somente dos tokens CSS, não dos dados.

## 9. Capturas antes/depois

- `antes/fullpage-claro-1.png` × `depois/fullpage-claro-1.png`
- `antes/fullpage-escuro-3.png` × `depois/fullpage-escuro-3.png`
- Série completa anterior: `tmp-c13/c6-2/ajuste-hierarquia/prints/`
- Série completa atual: `depois/prints/`

## 10. Testes e C.O.D.E.

| Comando/verificação | Resultado |
|---|---|
| `git diff --check` | PASS |
| `npm run code:syntax` | PASS |
| `npm run code:oracles` | PASS — 149/149 |
| `npm run code:security` | PASS — 94/94 |
| `npm run code:list` | BLOCKED — `playwright: not found` |
| `npm run code:smoke` | BLOCKED — exit 127, `playwright: not found` |
| `npm run code:movimentacoes` | BLOCKED — exit 127, `playwright: not found` |
| `npm run code:test` | BLOCKED — exit 127, `playwright: not found` |

O C.O.D.E. remoto não foi executado nesta etapa: sem commit/push, o workflow validaria o SHA anterior e não incluiria as novas assertions. Último run verde disponível como baseline: `45628939621` (`success`, SHA `2f76dac`), em https://github.com/antvjpg/LIVRO-CAIXA/actions/runs/45628939621.

## 11. Preservação e limitações

- Posição, ordem, larguras e composição dos cards preservadas.
- Livro-Caixa e Visão Geral preservados conforme `ISOLAMENTO.json`.
- Dez temas preservados; nenhuma paleta nova criada.
- Limitação: E2E local e remoto com as novas assertions não executados.
- Limitação: validação de contraste feita em harness sintético; a sessão QA autenticada não estava disponível localmente.

## 12. Veredito

**APROVADO COM RESSALVAS.** Tokens auditados, 10 inconsistências de contraste corrigidas, superfícies diferenciadas, tipografia e espaçamento interno refinados, estrutura preservada e matriz 40/40 aprovada. A aprovação plena depende da execução oficial do C.O.D.E. com o novo teste publicado. Esta etapa não encerra a C6-INICIO-02 nem representa aceite macro do C.6.
