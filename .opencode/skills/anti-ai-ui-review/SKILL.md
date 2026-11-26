---
name: anti-ai-ui-review
description: "Detecta candidatos a padrões visuais genéricos de AI look no LIVRO-CAIXA, com rastreabilidade, contexto e classificação explícita. Use para auditar ou refinar a aba Início, cards, temas, tipografia, superfícies, contraste e acessibilidade sem reabrir decisões aprovadas. Modos: detect (somente leitura), refine (ajuste cirúrgico), rebuild (somente com autorização explícita)."
version: "1.1.0"
argument-hint: "[detect|refine|rebuild] [alvo]"
license: MIT
---

# Anti-AI UI Review — LIVRO-CAIXA v1.1.0

Skill local derivada de práticas de `impeccable`, `hallmark`, `superdesign`, `avoid-ai-design`, `frontend-slop-guard`, `ui-craft` e `anti-ai-slop-ui`, adaptada ao design system existente.

A v1.1.0 corrige a metodologia da v1.0.0: heurística não é defeito confirmado, sinal estético não é violação WCAG e contagem de padrões não é nota de qualidade.

## Regras de ouro

1. O brief, o design system e as decisões aprovadas vencem a preferência estética.
2. `detect` é somente leitura e produz candidatos, não ordens de mudança.
3. `refine` exige evidência contextual e aprovação; preserva estrutura, dados, cálculos e navegação.
4. `rebuild` exige autorização explícita e plano de direção.
5. Corrigir a origem com tokens existentes, não com exceções visuais.
6. Separar severidade, confiança e status.
7. Separar contraste textual de contraste entre superfícies.
8. Verificar o render com Chromium/CDP no Termux; Playwright não é disponível localmente.
9. Não declarar aprovação oficial com base apenas em auditoria local.
10. Preferir precisão sobre quantidade de alertas.

## Modos

- `detect`: executa detector estático, inspeção contextual e revisão de capturas; não edita arquivos.
- `refine`: aplica ajustes mínimos após evidência e autorização.
- `rebuild`: somente quando solicitado; nunca como consequência de score.

## Três camadas independentes

### 1. Detecção estática

Encontra candidatos em código e CSS com `arquivo:linha`, seletor e trecho.

```bash
node .opencode/skills/anti-ai-ui-review/scripts/detect.mjs [paths]
node .opencode/skills/anti-ai-ui-review/scripts/detect.mjs --json [paths]
node .opencode/skills/anti-ai-ui-review/scripts/detect.mjs --self-check
```

Opções: `--scope global|view|component|content|rendered`, `--view <nome>`, `--json`, `--help`.

O detector não analisa imagens. Ele não possui leitor de pixels nem avalia capturas. Inspeção visual é etapa separada.

### 2. Análise contextual e visual

Para cada candidato:

- determine se pertence à view/componente auditado;
- verifique se é escolha intencional do design system;
- observe o tema e o viewport;
- compare com capturas e, quando possível, com o DOM renderizado;
- classifique como `confirmed`, `candidate`, `inconclusive` ou `false_positive`.

### 3. Validação

Só chamar um achado de confirmado quando houver evidência funcional, visual ou de acessibilidade. Usar CDP, medições e testes. C.O.D.E. é gate complementar.

## Fluxo

1. **Gate:** branch, HEAD, `git status --short`, alterações alheias.
2. **Contexto:** ler `docs/design-system/`, CSS de tema/base/layout/features, HTML/componente alvo e capturas existentes. Classificar a superfície como `operate`, `read` ou `persuade`. A Início é `operate`.
3. **Scan estático:** executar `detect.mjs`. Rodar `--self-check` quando houver suspeita de divergência documental.
4. **Render:** capturar viewport/full-page nos temas aplicáveis. Fazer teste da silhueta quando a questão for estrutural.
5. **Auditoria:** preencher ID, severidade, confiança, status, evidência, impacto, limitação e validação.
6. **Refine:** somente com autorização; uma mudança por problema comprovado; reescanear e recapturar.

## Escopos

- `global`: estilos compartilhados.
- `view`: view selecionada por `--view` ou seletor `#view...`.
- `component`: componente local.
- `content`: somente texto visível.
- `rendered`: não suportado pelo detector estático; exige navegador.

Quando o detector não consegue determinar o escopo, declara a limitação.

## Critérios de saída

Um bom relatório:

- rastreia cada achado a uma regra documentada;
- separa defeitos confirmados de candidatos e observações;
- explica por que um padrão é problemático no contexto;
- não converte score em aprovação;
- preserva decisões aprovadas sem evidência contrária.

## Referências

- `references/TELLS.md` — catálogo sincronizado com o detector.
- `references/SCORING.md` — severidade, confiança, status e códigos de saída.
- `references/REPORT-FORMAT.md` — esquema JSON e Markdown.
- `references/SOURCES.md` — fontes e natureza das regras.
- `references/CHANGELOG.md` — histórico v1.0.0 → v1.1.0.
- `VALIDACAO.md` — testes e resultados.
