# Catálogo de regras — Anti-AI UI Review v1.1.0

Todas as regras implementadas e não implementadas possuem ID único. O detector e este catálogo são comparados por `detect.mjs --self-check`.

| ID | Severity | Scope | Implemented | Trigger | Limitations | Validation |
|---|---|---|---|---|---|---|
| CSS-MOTION-001 | P2 | global | yes | `transition: all` em CSS | Não prova impacto visual ou intenção. | Verificar estados reais e substituir por propriedades explícitas quando fizer sentido. |
| CSS-LAYOUT-MOTION-001 | P2 | global | yes | `transition`/`animation` com width, height, top ou left | Não mede desempenho real. | Confirmar estado animado e considerar `transform`/`opacity`. |
| CSS-FOCUS-OUTLINE-001 | P2 | global | yes | `outline: none` em CSS | Não avalia cascata, visibilidade ou contraste do foco substituto. | Navegar por teclado e medir o indicador de foco. |
| CSS-REDUCED-MOTION-001 | P2 | global | yes | Animação/keyframes sem evidência de fallback | Presença de media query não prova cobertura efetiva. | Ativar `prefers-reduced-motion` e observar a animação. |
| CSS-FONT-PRIMARY-001 | INFO | global | yes | `--font-family-ui` com Inter, Sora ou Geist | Presença não prova aplicação efetiva. | `getComputedStyle` no texto principal. |
| CSS-FONT-LOCAL-001 | INFO | component | yes | `font-family` explícita com Inter, Sora ou Geist | Não sabe se a escolha é intencional. | Comparar com tokens e intenção do componente. |
| CSS-GLASS-001 | INFO | component | yes | `backdrop-filter` | Não prova sobreposição real. | Verificar se há camada sob a superfície. |
| CSS-THREE-COL-001 | INFO | component | yes | `grid-template-columns: repeat(3, ...)` | Pode ser métrica de dados, não card template. | Inspecionar o conteúdo das colunas no DOM. |
| CSS-SHADOW-GLOW-001 | INFO | component | yes | `box-shadow` zero-offset com cor | Pode ser foco/estado intencional. | Observar repouso, hover e foco. |
| CSS-FINGERNAIL-001 | INFO | component | yes | Borda lateral maior que 1px | Pode ser semântica. | Verificar se a borda comunica estado. |
| CSS-PALETTE-001 | INFO | global | yes | purple/indigo/violet em declaração CSS | Cor pode ser decisão de marca. | Comparar com design system. |
| CSS-GRADIENT-TEXT-001 | INFO | component | yes | `background-clip: text` | Não mede contraste real. | Medir contraste e avaliar hierarquia. |
| CONTENT-HYPE-001 | INFO | content | yes | Hype copy em texto visível | Não avalia intenção de marketing legítimo. | Confirmar no DOM e revisar copy. |
| CONTENT-MIDDLE-DOT-001 | INFO | content | yes | `·` ou `•` em texto visível | Sinal estético, não defeito automático. | Confirmar impacto na leitura/hierarquia. |
| RENDER-TARGET-SIZE-001 | P2 | rendered | no | Medição de alvo interativo | Fora do detector estático. | CDP/Playwright ou teste manual. |
| RENDER-FOCUS-VISUAL-001 | P1 | rendered | no | Foco por teclado no render | Não pode ser provado por busca em CSS. | Tabular e medir visibilidade/contraste. |
| RENDER-FLASH-001 | P0 | rendered | no | Frequência/área/luminância de flash | Requer medição temporal de pixels. | Medir ciclos por segundo, área e variação luminosa. |
| RENDER-HERO-THREE-CARDS-001 | INFO | rendered | no | Estrutura visual hero + três cards | Requer inspeção visual. | Teste da silhueta. |
| RENDER-CARD-NESTING-001 | INFO | rendered | no | Card dentro de card | Requer inspeção visual do DOM. | Verificar superfície, borda e sombra no render. |

## Escopos

- `global`: estilos ou padrões compartilhados.
- `view`: view selecionada por `--view` ou por seletor `#view...`.
- `component`: componente local.
- `content`: somente texto apresentado ao usuário.
- `rendered`: exige DOM/navegador; não suportado pelo detector estático.

## Exceções conhecidas do LIVRO-CAIXA

- `--paper`/`--surface` próximos fazem parte dos temas; não implicam defeito.
- `backdrop-filter` em overlay, modal, nav, drawer e bottom-nav é justificável.
- Labels uppercase com tracking fazem parte da linguagem visual existente.
- Gradiente suave do Patrimônio Total é decisão aprovada.
- Três indicadores da Saúde Financeira são métricas reais.
- Rodapé global com `·` é pré-existente e fora da composição da Início.

## Mudanças em relação à v1.0.0

IDs antigos T1–T20 foram substituídos por IDs estáveis por domínio. Nenhum ID antigo foi reutilizado com outro significado. As regras rendered-only foram explicitamente marcadas como não implementadas, em vez de serem simuladas por regex.
