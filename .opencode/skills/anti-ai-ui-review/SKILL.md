---
name: anti-ai-ui-review
description: "Detecta e corrige padrões visuais de 'AI look' no LIVRO-CAIXA. Use para auditar, revisar ou refinar a aba Início, cards, temas, tipografia, superfícies, contraste e acessibilidade sem reabrir decisões aprovadas. Modos: detect (somente leitura), refine (ajuste cirúrgico), rebuild (somente com autorização explícita)."
version: "1.0.0"
argument-hint: "[detect|refine|rebuild] [alvo]"
license: MIT
---

# Anti-AI UI Review — LIVRO-CAIXA

Skill local derivada das práticas de `impeccable`, `hallmark`, `superdesign`, `avoid-ai-design`, `frontend-slop-guard`, `ui-craft` e `anti-ai-slop-ui`, adaptada ao design system existente do LIVRO-CAIXA.

## Regras de ouro

1. **O brief e o design system vencem.** Tokens, temas, identidade e decisões já aprovadas não são substituídas por preferência estética.
2. **Detectar não é editar.** O modo `detect` é somente leitura; achados são candidatos, não prova de autoria nem defeito confirmado.
3. **Refinar preserva.** O modo `refine` mantém estrutura, ordem, dados, interações e cálculos; muda somente apresentação comprovadamente problemática.
4. **Rebuild exige autorização.** Nunca reconstrua uma tela existente sem pedido explícito.
5. **Corrija a origem.** Prefira tokens semânticos e regras existentes a exceções por tema ou cores literais.
6. **Contraste textual ≠ contraste de superfície.** Avalie separadamente; não aumente saturação para diferenciar cards.
7. **Verifique o renderizado.** No Termux, use Chromium headless + CDP; Playwright não é disponível localmente.
8. **Não declare aprovação oficial** com base apenas em auditoria local.

## Modos

- `detect` (padrão): escaneia código e capturas, produz relatório, não altera arquivos.
- `refine`: aplica correções mínimas em superfície, tipografia, contraste e espaçamento após evidência reprodutível.
- `rebuild`: somente quando o usuário pedir substituição visual completa; exige plano de direção antes de editar.

## Fluxo obrigatório

### 1. Gate

Confirme branch, HEAD, `git status --short` e presença de alterações alheias. Não sobrescreva nada.

### 2. Contexto

Leia:

- `docs/design-system/`;
- `style/themes.css`, `style/base.css`, `style/layout.css`, `style/features.css`;
- o HTML/componente alvo;
- capturas em `tmp-c13/` quando existirem.

Classifique a superfície: `operate` (dashboard/app financeiro), `read` ou `persuade`. A aba Início é `operate`.

### 3. Scan

Execute o detector local:

```bash
node .opencode/skills/anti-ai-ui-review/scripts/detect.mjs [arquivos]
node .opencode/skills/anti-ai-ui-review/scripts/detect.mjs --json [arquivos]
```

Use `references/TELLS.md` para os sinais que o detector não consegue provar por código.

### 4. Render

Capture viewport e full-page nos temas claros/escuros aplicáveis. Faça o teste da silhueta: reduza a captura a 25%, converta em preto e branco e pergunte se a forma poderia pertencer a qualquer produto. Compare com a matriz anterior antes de concluir.

### 5. Auditoria

Para cada achado, registre:

- ID e severidade (P0/P1/P2/INFO);
- `arquivo:linha` ou região da captura;
- por que lê como default;
- evidência: código, render ou inferência;
- decisão: corrigir, manter com justificativa ou levar ao usuário.

### 6. Refine (quando autorizado)

- Uma mudança por problema comprovado.
- Nenhuma paleta nova.
- Nenhum seletor específico de tema sem justificativa.
- Preserve funções, cálculos, navegação, IDs e contratos E2E.
- Reescaneie e recapture após a edição.

## Critérios de saída

Um bom resultado não é “sem gradientes”. É:

- **Justificado:** cada decisão remonta ao produto/design system.
- **Coerente:** tipografia, cor, superfície e espaço reforçam uma ideia.
- **Não convergente:** não cai em clusters de segunda ordem (creme+terracota, preto+neon, mono-all-caps, hero+três cards).
- **Consistente:** usa os mesmos tokens das views irmãs.
- **Verificado:** medido em tema claro/escuro e viewport real.

## Referências

- `references/TELLS.md` — catálogo adaptado.
- `references/SOURCES.md` — fontes, stars e conceitos incorporados.
