# Validação da skill — v1.1.1

## Histórico preservado

A v1.0.0 e a v1.1.0 foram validadas anteriormente. Seus resultados permanecem em `tests/self-check-v1.1.0.json`, `tests/project-scan-v1.1.0.json`, `tests/project-scan-v1.1.0.txt` e nos relatórios em `tmp-c13/c6-3/refinamento-visual/`.

Esta página registra a validação da v1.1.1, que corrige pontos identificados na auditoria do commit `24d16fb`.

## Testes automatizados

Comando:

```bash
node --test .opencode/skills/anti-ai-ui-review/tests/detect.test.mjs
```

Resultado: **20/20 PASS**.

Conjuntos cobertos:

- sincronização de versão e `--self-check`;
- metadados e IDs únicos;
- `transition: all` simples, multilinha e em comentário;
- foco com e sem `:focus-visible`;
- `prefers-reduced-motion` relacionado, não relacionado e ausente;
- fonte opcional, principal e local;
- glassmorphism justificado e não justificado;
- sombra zero-offset em foco e repouso;
- padrões estéticos INFO;
- conteúdo visível, atributos, comentários, script e texto dinâmico;
- parser com chaves dentro de strings;
- filtros `--scope`, `--view` e estilos compartilhados;
- arquivos descobertos vs analisados;
- JSON/Markdown coerentes;
- códigos de saída;
- ausência de duplicatas;
- documentação com gatilho, limitações e validação.

## Validação adicional

| Verificação | Resultado |
|---|---|
| `node --check scripts/detect.mjs` | PASS |
| `node --check scripts/rules.mjs` | PASS |
| `detect.mjs --self-check` | PASS — 19 regras documentadas, 19 implementadas/marcadas |
| Detector em 5 arquivos-base | exit 0 — P0 0, P1 0, P2 19, INFO 46 |
| Status no scan de projeto | confirmed 0, candidate 42, inconclusive 3, false_positive 20 |
| JSON gerado | válido |
| Markdown gerado | coerente com JSON |
| Arquivos funcionais da aplicação alterados | nenhum |

Saídas: `tests/self-check-v1.1.1.json`, `tests/project-scan-v1.1.1.json`, `tests/project-scan-v1.1.1.txt`, `tests/test-results-v1.1.1.txt`.

## Limitações que permanecem

- O detector é triagem estática; não analisa imagem, pixels ou cascata completa.
- Regras `rendered` não são suportadas pelo comando.
- Texto dinâmico de JavaScript não é coberto.
- Entidades HTML em texto visível não são decodificadas antes da correspondência.
- `outline: none` e movimento reduzido continuam dependentes de validação renderizada.
- Um achado `candidate` exige revisão técnica antes de qualquer mudança.
