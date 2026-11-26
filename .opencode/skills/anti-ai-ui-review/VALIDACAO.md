# Validação da skill local

## Arquivos criados

- `.opencode/skills/anti-ai-ui-review/SKILL.md`
- `.opencode/skills/anti-ai-ui-review/references/TELLS.md`
- `.opencode/skills/anti-ai-ui-review/references/SOURCES.md`
- `.opencode/skills/anti-ai-ui-review/scripts/detect.mjs`

## Validações executadas

| Verificação | Resultado |
|---|---|
| `node --check .opencode/skills/anti-ai-ui-review/scripts/detect.mjs` | PASS |
| Frontmatter `SKILL.md` (`name`, `description`, `version`) | PASS |
| Detector sobre `index.html` + 4 CSS principais | exit 2 — 61 findings |
| Resumo do detector | P0 0 · P1 2 · P2 59 |

Os dois P1 são `transition:all` em `style/base.css:163` e `style/features.css:463`. São padrões existentes fora da composição da Início; a skill apenas os sinaliza. Nenhum P0 foi encontrado nos arquivos auditados.

## Escopo

A skill é local ao repositório, descoberta em `.opencode/skills/`. Nada foi instalado globalmente, nenhum hook foi criado e nenhum arquivo de aplicação foi alterado.

## Uso

```bash
node .opencode/skills/anti-ai-ui-review/scripts/detect.mjs index.html style/features.css
node .opencode/skills/anti-ai-ui-review/scripts/detect.mjs --json .
```

Para uma revisão completa, siga `SKILL.md`: gate → contexto → scan → render → auditoria → refine opcional. O modo padrão é `detect`, somente leitura.

## Observação

A ferramenta `skill` do OpenCode falhou com `ripgrep execution failed`, então o carregamento foi feito por leitura direta do `SKILL.md`. As skills externas foram baixadas apenas em `/data/data/com.termux/files/usr/tmp/opencode/skills/` para estudo e comparação; a skill criada não copia scripts de terceiros.
