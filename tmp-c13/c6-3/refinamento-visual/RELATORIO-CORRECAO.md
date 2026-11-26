# C6-INICIO-03B — Correção de superfícies, contraste e identidade dos temas

## 1. HEAD e estado

- **SHA analisado:** `0798356052a96ee26843897faf60ba08c76ae6e9`
- **SHA final:** `0798356052a96ee26843897faf60ba08c76ae6e9`
- **Branch:** `feat/app-layout-redesign`
- **Estado final:** `M e2e/smoke/inicio.spec.js`; `M index.html`; `M style/features.css`; artefatos em `tmp-c13/c6-3/refinamento-visual/`.
- **Commit/push/merge/release/deploy:** nenhum.

A estrutura, a ordem, o posicionamento e as dimensões dos cards da Início foram preservados.

## 2. Diagnóstico das alterações anteriores

Comparação `ef2b0b1..0798356` em `style/features.css`:

1. Cards de saldo e Saúde Financeira passaram a usar `color-mix(in srgb, var(--paper-2) 72%, var(--accent-subtle))`. Isso injetou 28% da cor sutil do tema na superfície, produzindo coloração brusca nos claros e aparência neon nos escuros.
2. Patrimônio Total passou a usar gradiente integral `--surface-accent → --accent` (claro) e `--surface-accent → --accent-subtle` (escuro), com borda e sombra derivadas de `--accent`.
3. Bordas dos cards usavam `--accent` diretamente (12–30%), reforçando o brilho.
4. O seletor de correção do modo escuro estava inválido: `body.dark-mode body[data-tab="inicio"]` (dois `body`), portanto não aplicava a neutralização.
5. Os textos pequenos haviam sido ajustados para `--ink` para corrigir contraste real; esses ajustes foram preservados.

A versão `ef2b0b1` usava `--surface` com borda `--line` e sombra `--shadow-sm`, com aparência considerada mais sóbria. Essa foi a referência visual, não um alvo de restauração integral.

## 3. Tokens e mudanças por tema

Foi criado apenas um token local, escopo `main` na Início:

```css
body[data-tab="inicio"] main{
  --inicio-card-border: color-mix(in srgb, var(--accent) 16%, var(--line));
}
body.dark-mode[data-tab="inicio"] main{
  --inicio-card-border: color-mix(in srgb, var(--line) 60%, var(--surface));
}
```

Ele é usado por Patrimônio Total, Bancos, Caixinhas, Investimentos, Saúde Financeira e Próximo Pagamento. Nenhum token global foi alterado; nenhuma paleta nova foi criada.

Superfícies:

- Antes (`0798356`): `--paper-2 72% + --accent-subtle`.
- Depois: `--surface 92% + --accent-subtle`, ou seja, 8% de tintura sutil sobre a superfície original.

Patrimônio Total:

- Antes: gradiente integral de accent.
- Depois: gradiente suave entre `color-mix(--surface 86%, --accent-subtle)` e `color-mix(--surface 94%, --accent-subtle)` no claro; equivalente com `--surface-raised`/`--surface` no escuro.
- Texto `--ink` e ícone `--accent-subtle`/`--accent`.

Modo escuro:

- Borda e sombra neutras (`--inicio-card-border` + `--shadow-sm`).
- Seletor corrigido para `body.dark-mode[data-tab="inicio"]`.
- Ícone do Patrimônio sem brilho de accent.

Temas claros:

- Verde não foi considerado aprovado; todos os cinco temas foram tratados pela mesma redução de saturação.
- Oliva, lima, terracota e laranja perderam a coloração brusca; a identidade cromática permanece nos swatches, header e ícones.

## 4. Contraste e superfícies

O harness de contraste foi corrigido para compor o fundo transparente do `.next-pay-inner` sobre a superfície do card, evitando falsos negativos.

- Pares com contraste insuficiente antes da correção: 0 (após o commit `0798356`, os textos já tinham sido corrigidos para `--ink`).
- Pares com contraste insuficiente depois: **0**, com limites WCAG 2.2 aplicados por tamanho de fonte.
- Os menores valores finais (3,52–3,79) pertencem ao score, que é texto grande (21px/800), limite 3:1.

Spread cromático (max−min por canal) dos cards:

| Tema | ef2b0b1 | 0798356 | final |
|---|---:|---:|---:|
| claro-1-oliva | 5,0 | 13,8 | 5,5 |
| claro-2-verde | 5,0 | 6,3 | 4,4 |
| claro-3-lima | 0,0 | 19,9 | 3,8 |
| claro-4-terracota | 7,0 | 22,3 | 8,3 |
| claro-5-laranja | 0,0 | 6,4 | 1,8 |
| escuro-1-oliva | 3,0 | 5,8 | 3,5 |
| escuro-2-verde | 2,0 | 7,8 | 2,6 |
| escuro-3-bege | 11,0 | 9,5 | 9,6 |
| escuro-4-terracota | 8,0 | 14,6 | 9,2 |
| escuro-5-laranja | 0,0 | 18,5 | 5,3 |

O resultado final volta a ficar próximo da suavidade anterior, mantendo leve diferença em relação ao fundo (`pageVsCard` 1,04–1,14).

## 5. Ajustes adicionais solicitados

- Ícone de Saúde Financeira trocado de `fi-rr-heart` para `fi-rr-financial-health`, reaproveitando ícone já usado no domínio.
- Mini seletor de temas adicionado ao cabeçalho da Início: 5 claros + 5 escuros, reaproveitando `.light-theme-option`, `.dark-theme-option` e os handlers existentes em `js/99-init.js`. Nenhum JS novo foi criado.
- Botão sem utilidade abaixo de Próximo Pagamento removido; `.inicio-footer` removido do DOM e do CSS.
- Títulos de Saúde Financeira e Próximo Pagamento aumentados para `--font-size-body` (13px).
- Contorno interno de Próximo Pagamento removido (`border:0`, fundo transparente); conteúdo realinhado.
- Bordas de Bancos/Caixinhas/Investimentos unificadas com a borda de Patrimônio Total via `--inicio-card-border`.
- Respiro aumentado entre a faixa e Saúde Financeira (22px desktop / 18px mobile).
- Respiro reduzido dentro do grupo Patrimônio/Bancos/Caixinhas/Investimentos: cabeçalho 14px, Patrimônio 8px, gap da faixa 10px desktop / 9px mobile.
- Espaço excessivo abaixo de “livro-caixa · dados sincronizados…” reduzido: `main` com 24px no desktop e 8px no mobile; `body[data-tab="inicio"]` com 88px + safe-area no mobile.

## 6. Validação visual

- 10 temas × 4 viewports (320×720, 360×800, 390×844, 1280×800).
- 40 combinações, 50 capturas: 40 viewport + 10 full-page em 390×844.
- 40/40 PASS para overflow, ordem, ausência do botão removido, score, borders unificadas e estabilidade da composição.
- Integração real via CDP com JS habilitado: `MINI-TEMA-FINAL.json` e `ISOLAMENTO-FINAL.json`.
  - Mini seletor: 5 botões claros + 5 escuros; clique altera tema e sincroniza `aria-pressed` em todos os botões.
  - `footerButtons=0`, `healthIcon=fi fi-rr-financial-health`, `borderPatrimonio === borderBank`, `nextInnerBorder=0px`, títulos 13px.

Capturas: `corrigido4/prints/` (finais), `corrigido/prints/` e `corrigido2/prints/` (intermediárias). Matriz: `corrigido4/prints/MATRIZ.md`.

Harness sintético foi usado para a matriz de temas/viewports; o app integrado foi verificado separadamente por CDP com JavaScript habilitado.

## 7. Testes

| Comando/verificação | Resultado |
|---|---|
| `node --check js/18-render-core.js` (implícito em `code:syntax`) | PASS |
| `node --check e2e/smoke/inicio.spec.js` | PASS |
| `git diff --check` | PASS |
| `npm run code:syntax` | PASS |
| `npm run code:oracles` | PASS — 149/149 |
| `npm run code:security` | PASS — 94/94 |
| `npm run code:list` | BLOCKED — `playwright: not found` |
| `npm run code:smoke` | BLOCKED — exit 127, `playwright: not found` |
| `npm run code:movimentacoes` | BLOCKED — exit 127 |
| `npm run code:test` | BLOCKED — exit 127 |

E2E remoto não foi executado: sem commit/push, o workflow validaria o SHA anterior. Último run verde disponível: `45628939621` (baseline não relacionado a esta correção).

## 8. Skills e limitações

- Skills externas encontradas para detecção de “AI look”: `funboy322/avoid-ai-design`, `airtaxi/frontend-slop-guard`, `XSW-1123/ui-craft`, `pbakaus/impeccable`, `rwcod/anti-ai-slop-ui`.
- Skill local `web-design-guidelines` carregada manualmente (a ferramenta `skill` falhou com `ripgrep execution failed`); conteúdo de `avoid-ai-design` também lido para referência.
- Limitação: nenhuma sessão QA autenticada local; contraste e temas medidos com tokens reais e dados fictícios no harness.

## 9. Veredito

**APROVADO COM RESSALVAS.** A saturação excessiva e a borda neon foram removidas, os contornos foram unificados, o mini seletor funciona com os handlers existentes e os ajustes de ícone/títulos/espaçamento foram aplicados sem alterar a estrutura aprovada. A aprovação plena depende da execução oficial do C.O.D.E. com as novas alterações publicadas.
