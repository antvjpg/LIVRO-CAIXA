# Validação da skill — v1.1.0

## Histórico preservado

A v1.0.0 foi validada com `node --check`, frontmatter, detector sobre arquivos-base e comparação com detectores externos. Seus resultados históricos permanecem nos relatórios em `tmp-c13/c6-3/refinamento-visual/`. A v1.1.0 substitui a metodologia, não apaga esse histórico.

## Testes automatizados

Comando:

```bash
node --test .opencode/skills/anti-ai-ui-review/tests/detect.test.mjs
```

Resultado: **13/13 PASS**.

Conjuntos cobertos:

- sincronização de versão e `--self-check`;
- metadados de regras: IDs únicos, severidades, escopos e statuses válidos;
- `transition: all` simples, multilinha e em comentário;
- foco com e sem `:focus-visible`;
- `prefers-reduced-motion` no mesmo arquivo e em arquivo separado;
- fonte opcional vs fonte principal vs fonte local;
- glassmorphism justificado e não justificado;
- sombra zero-offset em foco e em repouso;
- padrões estéticos INFO;
- conteúdo visível vs comentário/script;
- filtros `--scope` e `--view`;
- coerência JSON/Markdown;
- códigos de saída;
- ausência de duplicatas.

## Validação adicional

| Verificação | Resultado |
|---|---|
| `node --check scripts/detect.mjs` | PASS |
| `node --check scripts/rules.mjs` | PASS |
| `node detect.mjs --self-check` | PASS — 19 regras documentadas, 19 implementadas/marcadas como não suportadas |
| Detector sobre 5 arquivos-base | exit 0 — P0 0, P1 0, P2 17, INFO 48 |
| Status no scan de projeto | confirmed 0, candidate 42, inconclusive 1, false_positive 22 |
| JSON gerado | válido |
| Markdown gerado | coerente com JSON |
| Arquivos funcionais da aplicação alterados | nenhum |

Saídas salvas em `tests/self-check-v1.1.0.json`, `tests/project-scan-v1.1.0.json` e `tests/project-scan-v1.1.0.txt`.

## Limitações que permanecem

- O detector ainda é baseado em análise estática e expressões regulares sobre blocos CSS.
- Não analisa imagens, pixels, cascata completa, especificidade ou comportamento renderizado.
- Regras `rendered` estão documentadas como não suportadas.
- Um achado `candidate` ainda exige revisão humana ou medição no navegador.
- `prefers-reduced-motion` é avaliado por presença/contexto, não por cobertura real de cada animação.
- Alvos de toque e indicadores de foco exigem CDP/Playwright ou teste manual.
