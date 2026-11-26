# Varredura profunda — padrões visuais, acessibilidade e design web

## 1. Metodologia

Executada sobre HEAD `1e78e2d2625756bb85512cb949d12a478734de86`, branch `feat/app-layout-redesign`, com alterações locais pendentes desta revisão.

Fontes aplicadas:

1. Skill local `.opencode/skills/anti-ai-ui-review/` (modo `detect`).
2. Vercel Web Interface Guidelines (via `command.md` oficial).
3. `avoid-ai-design` (`detect.mjs`, modo somente leitura).
4. `ui-craft` (`audit.mjs`/`score.mjs` sobre cópia dos arquivos da Início).
5. CDP com Chromium headless para fatos renderizados: `lang`, `color-scheme`, meta, skip links, overflow, alvos de toque, regras de foco/motion e estilos computados.
6. Capturas viewport/full-page em 320×720, 360×800, 390×844 e 1280×800 nos dez temas.
7. Teste da silhueta: captura reduzida a 25%, bordas em preto e branco.
8. Medições WCAG de contraste em 14 pares por tema, incluindo Patrimônio Total.

Artefatos em `tmp-c13/c6-3/refinamento-visual/profundo/`.

## 2. Achados corrigidos nesta revisão

| Achado da auditoria anterior | Ação |
|---|---|
| Bordas de Saúde/Próximo ainda com accent direto | Unificadas com `--inicio-card-border` em `style/features.css` |
| `RELATORIO-CORRECAO.md` com SHA final errado | SHA publicado corrigido para `1e78e2d…` |
| Matriz final com título antigo | Título e SHA atualizados |
| Skill com `allowed-tools` incompatível | Restrição removida do frontmatter |
| `ui-craft-score.json` inválido | Substituído por JSON válido com status e sumários |
| Contraste do Patrimônio sem evidência | Medido nos dez temas: 8,17–17,15:1 |
| Mini seletor sem teste de interação no E2E | Acrescentados clique claro/escuro, verificação de `aria-pressed` e restauração do tema |

Nenhuma dessas ações altera estrutura, ordem ou cálculos da Início.

## 3. Achados em aberto

### P1 — recomendável corrigir

1. **Alvo de toque do mini seletor é pequeno demais.** `fatos-cdp.json`: 10 botões com `14×14px`. WCAG 2.2 SC 2.5.8 recomenda no mínimo 24×24 px; 44×44 é a boa prática comum. Visual pode permanecer 14px, mas a área clicável deve ser ampliada via `::after` absoluto ou padding invisível. Evidência: `profundo/fatos-cdp.json`.
2. **`color-scheme` não está declarado.** `getComputedStyle(document.documentElement).colorScheme` retorna `normal` inclusive em tema escuro. Isso afeta scrollbars, inputs nativos e form controls. Recomendação: `html { color-scheme: light dark; }` ou sincronizar com `body.dark-mode`.
3. **Não há skip link.** `skipLinks: []`. Recomendação: link “Pular para conteúdo” antes do header, com `scroll-margin-top` no `main`.
4. **`transition: all` em `style/base.css:163` e `style/features.css:463`.** Detectado pelo skill local e pela regra T3 do Vercel. Substituir por propriedades explícitas.
5. **E2E oficial ainda não executado.** O novo teste de interação do mini seletor está local, mas `playwright` não está disponível; C.O.D.E. remoto permanece pendente.

### P2 — reforçar/validar

6. **`outline: none` em 9 regras.** Existem 31 regras `:focus-visible`, portanto a maioria provavelmente tem substituto. Ainda assim, requer verificação de teclado nos componentes da Início, especialmente mini seletor e cards com `role="button"`.
7. **`prefers-reduced-motion` existe em apenas 8 regras.** Para cada animação do escopo, confirmar fallback. Fora do escopo imediato da Início, mas é um ponto sistêmico de acessibilidade.
8. **`text-wrap` do título é `wrap`.** `main > .inicio-header h2` pode usar `text-wrap: balance`; impacto pequeno, útil em telas estreitas.
9. **`touch-action: auto` nos botões/cards.** `touch-action: manipulation` reduz atraso de double-tap em controles.
10. **Dois botões ícone sem `aria-label` no documento.** Foram contados fora da composição da Início; localizar e corrigir em rodada própria.
11. **Separador `·` no rodapé global.** Sinal dos detectors; é texto pré-existente e fora da composição da aba.
12. **Diferenciação fundo/card baixa (1,04–1,14).** Não é falha WCAG de texto; borda e sombra fazem a separação. Se o usuário quiser mais separação, usar tone shift um pouco maior ou borda levemente mais presente — não saturar.

## 4. Pontos que passaram

- Patrimônio Total: contraste 8,17–17,15:1 para título e valor sobre o gradiente nos dez temas.
- Score: 3,52–8,77:1; acima do limite de 3:1 para texto grande.
- Legendas do score: 8,22–17,57:1.
- Percentuais: 7,41–15,65:1.
- Kicker de Próximo Pagamento: 8,22–17,57:1.
- `lang="pt-BR"` presente.
- Viewport meta sem `user-scalable=no`.
- Ícones decorativos usam `aria-hidden="true"`.
- Mini seletor reusa handlers existentes; `aria-pressed` sincroniza entre perfil e Início (`mini-tema.json`).
- Bordas unificadas: `borderPatrimonio === borderBank`.
- Sem P0 real de AI look; o P0 do `avoid-ai-design` é o conhecido falso positivo de Inter opcional.
- Silhueta da aba Início é de dashboard financeiro com pesos diferentes, não “hero + três cards”.

## 5. Matriz e evidências

- 40 combinações (4 viewports × 10 temas), 50 capturas finais: `prints/`.
- Contraste completo: `metricas/contraste-profundo.json`.
- Fatos renderizados: `fatos-cdp.json`.
- Detectores: `skill-local.txt`, `avoid-ai-design.txt`, `ui-craft-audit.json`, `ui-craft-score.json`.
- Testes locais: `testes-syntax.txt`, `testes-oracles.txt` (149/149), `testes-security.txt` (94/94), `testes-smoke.txt` (BLOCKED — `playwright: not found`).

## 6. Veredito

**Aprovado com ressalvas.** A correção visual e a rastreabilidade estão consistentes; os pontos realmente novos desta varredura são sobretudo de acessibilidade e robustez (alvo de toque, `color-scheme`, skip link, `transition: all` e verificação de foco). Nenhum deles exige reabrir a composição aprovada. Recomenda-se tratá-los como pequena rodada de acessibilidade, com execução oficial do C.O.D.E. após publicação.
