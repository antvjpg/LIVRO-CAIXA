# Catálogo de regras — Anti-AI UI Review v1.1.1

Todas as regras implementadas e não implementadas possuem ID único. O detector e este catálogo são comparados por `detect.mjs --self-check`, incluindo ID, severidade, escopo, gatilho, limitações e validação.

| ID | Severity | Scope | Implemented | Trigger | Limitations | Validation |
|---|---|---|---|---|---|---|
| CSS-MOTION-001 | P2 | global | yes | Declaração CSS transition: all. | Não prova impacto visual; estados reais precisam ser revisados. | Verificar hover/active/focus e substituir por propriedades explícitas. |
| CSS-LAYOUT-MOTION-001 | P2 | global | yes | Declaração CSS transition ou animation com propriedade de layout. | Não mede desempenho real nem intenção da animação. | Confirmar estado animado e avaliar substituição por transform/opacity. |
| CSS-FOCUS-OUTLINE-001 | P2 | global | yes | Declaração CSS outline: none. | Não avalia cascata, especificidade, visibilidade ou contraste do foco substituto. | Navegar por teclado e medir o indicador de foco no elemento real. |
| CSS-REDUCED-MOTION-001 | P2 | global | yes | Animação detectada sem cobertura comprovada por prefers-reduced-motion. | A análise estática não consegue provar quais animações são afetadas pela media query. | Ativar prefers-reduced-motion no navegador e observar a animação real. |
| CSS-FONT-PRIMARY-001 | INFO | global | yes | Variável --font-family-ui com Inter, Sora ou Geist. | Presença da declaração não prova que a fonte esteja efetivamente aplicada na view auditada. | Consultar getComputedStyle no elemento de texto principal. |
| CSS-FONT-LOCAL-001 | INFO | component | yes | font-family explícita com Inter, Sora ou Geist. | Não sabe se a escolha é intencional ou herdada do design system. | Comparar com tokens tipográficos e com a intenção do componente. |
| CSS-GLASS-001 | INFO | component | yes | Declaração CSS backdrop-filter. | Não determina se há camada real sob a superfície. | Verificar se o elemento realmente cobre conteúdo rolável ou camada inferior. |
| CSS-THREE-COL-001 | INFO | component | yes | grid-template-columns com repeat(3). | Três colunas podem ser métricas de dados, não cards genéricos. | Inspecionar o conteúdo das três colunas no DOM renderizado. |
| CSS-SHADOW-GLOW-001 | INFO | component | yes | box-shadow zero-offset com cor de acento. | Pode ser indicador de foco ou efeito intencional. | Observar o elemento em repouso, hover e foco. |
| CSS-FINGERNAIL-001 | INFO | component | yes | Borda lateral maior que 1px. | Bordas laterais podem carregar significado semântico. | Verificar se a borda comunica estado ou apenas decora. |
| CSS-PALETTE-001 | INFO | global | yes | Purple, indigo ou violet em declaração CSS. | Uma cor pode pertencer à marca; a regra não prova AI look. | Comparar com o design system e com o contexto de uso. |
| CSS-GRADIENT-TEXT-001 | INFO | component | yes | background-clip: text em CSS. | Não classifica automaticamente como defeito ou risco de contraste. | Medir contraste real e verificar se o gradiente substitui hierarquia. |
| CONTENT-HYPE-001 | INFO | content | yes | Termo de hype em texto visível. | Detecta apenas texto visível extraído estaticamente; não avalia intenção. | Confirmar no DOM renderizado e avaliar com o copy do produto. |
| CONTENT-MIDDLE-DOT-001 | INFO | content | yes | Separador · ou • em texto visível. | Sinal estético; não é defeito por si só. | Confirmar se o separador prejudica hierarquia ou leitura. |
| RENDER-TARGET-SIZE-001 | P2 | rendered | no | Requer medição em navegador. | Fora do detector estático; exige CDP, Playwright ou teste manual. | Medir largura, altura e espaçamento entre alvos. |
| RENDER-FOCUS-VISUAL-001 | P1 | rendered | no | Requer navegação por teclado no DOM renderizado. | Não pode ser provado por busca de texto em CSS. | Tabular até o elemento e medir visibilidade e contraste do indicador. |
| RENDER-FLASH-001 | P0 | rendered | no | Requer medição temporal de pixels. | Animação lenta não implica violação de flash. | Medir ciclos por segundo, área e variação luminosa. |
| RENDER-HERO-THREE-CARDS-001 | INFO | rendered | no | Requer inspeção visual da tela. | Não é detectável por arquivo CSS isolado. | Teste da silhueta e revisão visual. |
| RENDER-CARD-NESTING-001 | INFO | rendered | no | Requer inspeção visual do DOM. | Bordas e sombras em CSS não provam aninhamento visual. | Verificar superfície, borda e sombra no render. |

## Escopos

- `global`: estilos ou padrões compartilhados.
- `view`: view selecionada por `--view` ou por seletor `#view...`.
- `component`: componente local.
- `content`: somente texto apresentado ao usuário.
- `rendered`: exige DOM/navegador; não suportado pelo detector estático.

## Relação com a view

Quando `--view` é usado, cada achado recebe `viewRelation`:

- `exclusive`: seletor ou caminho pertence explicitamente à view.
- `shared`: regra global ou de componente que pode afetar a view.
- `unrelated`: seletor aponta para outra view.

Regras compartilhadas não são descartadas apenas por não conterem `#viewInicio`.

## Exceções conhecidas do LIVRO-CAIXA

- `--paper`/`--surface` próximos fazem parte dos temas; não implicam defeito.
- `backdrop-filter` em overlay, modal, nav, drawer e bottom-nav é justificável.
- Labels uppercase com tracking fazem parte da linguagem visual existente.
- Gradiente suave do Patrimônio Total é decisão aprovada.
- Três indicadores da Saúde Financeira são métricas reais.
- Rodapé global com `·` é pré-existente e fora da composição da Início.

## Mudanças em relação à v1.0.0

IDs antigos T1–T20 foram substituídos por IDs estáveis por domínio. Nenhum ID antigo foi reutilizado com outro significado. Regras rendered-only foram explicitamente marcadas como não implementadas, em vez de serem simuladas por regex.

## Mudanças em relação à v1.1.0

- `prefers-reduced-motion` exige relação entre seletor animado e regra de redução; presença isolada não basta.
- Texto visível preserva mapeamento com a posição original no HTML.
- Texto dinâmico gerado por JavaScript é explicitamente fora de cobertura.
- `--view` distingue regras exclusivas, compartilhadas e não relacionadas.
- `--self-check` valida também gatilho, limitações e validação documentadas.
