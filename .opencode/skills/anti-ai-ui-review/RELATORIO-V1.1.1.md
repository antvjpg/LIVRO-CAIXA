# RELATÓRIO — v1.1.1 da skill Anti-AI UI Review

## 1. Identificação

- **SHA inicial:** `24d16fb1438749175b69386fa1a374356ceaf7df`
- **HEAD final:** `24d16fb1438749175b69386fa1a374356ceaf7df`
- **Estado final:** alterações pendentes apenas em `.opencode/skills/anti-ai-ui-review/`.
- **Commit/push:** nenhum.
- **Escopo:** atualização corretiva da skill, sem tocar no código funcional do LIVRO-CAIXA.

## 2. Correções aplicadas

| Ponto da auditoria da v1.1.0 | Correção na v1.1.1 |
|---|---|
| `prefers-reduced-motion` no mesmo arquivo não provava cobertura | Exige relação entre seletor animado e seletor da regra de redução; presença isolada vira `inconclusive`. |
| Texto visível podia ser localizado em atributo | `visibleSegments()` preserva mapeamento com a posição original e ignora tags/atributos. |
| Texto dinâmico de JavaScript não era declarado | Limitação explícita no relatório e nos testes. |
| `--view` podia ocultar estilos compartilhados | Achados passam a ter `viewRelation`: `exclusive`, `shared` ou `unrelated`. |
| Arquivos coletados eram confundidos com analisados | Resumo separa `filesDiscovered`, `filesAnalyzed` e `ignoredExtensions`. |
| `--self-check` comparava campos limitados | Agora compara também gatilho, limitações e validação documentados. |
| Relatórios v1.1.0 com trechos em inglês e publicação omitted | Corrigido; v1.1.0 marcada como publicada em `24d16fb`. |

## 3. Arquivos alterados

- `SKILL.md`
- `VALIDACAO.md`
- `references/TELLS.md`
- `references/SCORING.md`
- `references/REPORT-FORMAT.md`
- `references/CHANGELOG.md`
- `scripts/detect.mjs`
- `scripts/rules.mjs`
- `scripts/version.mjs`
- `RELATORIO-V1.1.0.md`
- `tests/detect.test.mjs`
- novas fixtures e saídas em `tests/`.

## 4. Testes

| Verificação | Resultado |
|---|---|
| `node --test tests/detect.test.mjs` | **20/20 PASS** |
| `node --check scripts/detect.mjs` | PASS |
| `node --check scripts/rules.mjs` | PASS |
| `detect.mjs --self-check` | PASS — 19/19 regras sincronizadas |
| Scan em 5 arquivos-base | exit 0 — P0 0, P1 0, P2 19, INFO 46 |
| Status | confirmed 0, candidate 42, inconclusive 3, false_positive 20 |
| JSON/Markdown | válidos e coerentes |

Saídas em `tests/test-results-v1.1.1.txt`, `tests/self-check-v1.1.1.json`, `tests/project-scan-v1.1.1.json` e `tests/project-scan-v1.1.1.txt`.

## 5. Revisão crítica da própria v1.1.1

- O parser de CSS agora ignora chaves dentro de strings; teste adicionado.
- A relação de texto visível usa posição original; atributos e scripts não são considerados; teste adicionado.
- A classificação de movimento reduzido usa relação de seletor, não apenas presença da media query; teste adicionado.
- O filtro de view mantém estilos compartilhados; teste adicionado.
- A documentação do catálogo foi gerada a partir das regras para evitar divergência de trigger, limitação e validação.
- Versão centralizada em `version.mjs`; frontmatter e documentação atualizados para 1.1.1.
- Relatório v1.1.0 corrigido para indicar que foi produzido antes do commit de publicação.

## 6. Limitações

- Detectores estáticos não provam defeitos visuais ou de acessibilidade.
- Regras `rendered` permanecem não suportadas.
- HTML entities não são decodificadas antes da busca em texto visível.
- Texto dinâmico de JavaScript permanece fora de cobertura.
- Candidatos não devem ser usados como lista de correção automática da interface.

## 7. Confirmações

- Nenhum arquivo funcional da aplicação foi modificado.
- Nenhuma view, token, cor, tipografia ou espaçamento foi alterado.
- Nenhum commit, push, merge, release ou deploy foi executado.
- Histórico da v1.0.0 e da v1.1.0 preservado.

## 8. Veredito

**v1.1.1 pronta para auditoria independente.** Todos os testes locais passaram; a aprovação final depende da revisão do usuário antes de qualquer publicação.
