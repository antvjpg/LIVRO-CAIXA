# Fontes incorporadas

Stars obtidos via GitHub Search API em `2026-11-26`. Star count mede distribuição, não qualidade; a seleção considerou também aplicabilidade ao LIVRO-CAIXA.

| Repositório | Stars | Conceito incorporado |
|---|---:|---|
| `pbakaus/impeccable` | 116.954 | Modos `operate/read/persuade`; `PRODUCT.md`/`DESIGN.md` como contexto; verbos de refinement (`quieter`, `typeset`, `layout`, `polish`); detecção determinística e severidades P0–P3; verificação no render. |
| `Nutlope/hallmark` | 61.166 | Floor/Reflex/Finish; cor e fonte via token; material antes de layout; uma ideia por tela; sloplint multi-viewport; reviewer em contexto fresco; proibição de eyebrow, gradient purple, card-in-card e métrica inventada. |
| `superdesigndev/superdesign-skill` | 1.077 | Preflight do codebase antes de propor; `design-system.md`/`theme.md`; resume antes de redescobrir; brand truth e imagens reais; iteração com contexto persistido. |
| `huytieu/COG-second-brain` | 1.524 | Paired anti-slop skills para marketing e product UI; ciclo de verificação onde o worker não avalia seu próprio trabalho. |
| `codeswithroh/tastemaker` | 621 | Taste profile persistente e referências reais em vez de defaults gerados. |
| `funboy322/avoid-ai-design` | 175 | Detect/rewrite; catálogo de first-order e second-order tells; scanner zero-dependency; ignore comments para decisões intencionais; teste da silhueta. |
| `gustavo-henriq/antislop-ui-ux-skill` | 56 | De-slop de tela existente sem substituir o design system. |
| `Vanszs/AntiSlopUI` | 41 | Filtro de paleta, acessibilidade e identidade de marca. |
| `airtaxi/frontend-slop-guard` | 2 | 19 tells com self-check: gradient abuse, rainbow, badges, fingernail cards, emoji slop, alinhamento, fontes preguiçosas, glassmorphism, hype, middle dot, card overuse, glows, ghost cards, eyebrows, backgrounds e motion falsa. |
| `XSW-1123/ui-craft` | 2 | Slop Index mensurável; floor WCAG; auditoria estática com BLOCKING/WARN/SLOP/INFO; token sprawl como sinal sistêmico. |
| `rwcod/anti-ai-slop-ui` | não consultado | Classificação da tarefa, direção visual antes do código, tokens antes dos componentes e quality gate anti-slop. |

## Síntese aplicada

- **Impeccable + Hallmark:** contexto escrito e verificação no render, não apenas scanner.
- **Superdesign:** preflight do projeto e continuidade de contexto.
- **Avoid-ai-design + frontend-slop-guard:** catálogo de tells e modo `detect` sem edição.
- **UI-craft:** métricas e separação entre candidato estático e defeito renderizado.
- **Anti-ai-slop-ui:** direção e tokens antes de qualquer mudança visual.

A skill local não copia scripts de terceiros. O detector em `scripts/detect.mjs` foi reescrito para o escopo do LIVRO-CAIXA e não instala dependências.

## Revisão periódica

Esta lista foi capturada em `2026-11-26`. Revisar anualmente ou quando uma nova geração de skills anti-slop aparecer. Não é necessário pesquisar na web para cada tarefa: consultar `TELLS.md` primeiro.
