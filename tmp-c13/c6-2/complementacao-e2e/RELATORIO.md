# C6-INICIO-02 — Complementação da cobertura E2E

## 1. Identificação

- **SHA inicial/final:** `2910075078029de3ac8cf14be4dbf17d7764a7ff` (`2910075`)
- **Branch:** `feat/app-layout-redesign`
- **Estado Git inicial:** limpo
- **Estado Git final:** `M e2e/smoke/inicio.spec.js`; `?? tmp-c13/c6-2/complementacao-e2e/`
- **Commit/push/merge/release/deploy:** nenhum, conforme solicitado.

## 2. Arquivos alterados

- `e2e/smoke/inicio.spec.js` — apenas complementação de assertions; nenhuma verificação existente foi removida ou enfraquecida.
- `tmp-c13/c6-2/complementacao-e2e/` — relatório, logs oficiais, diff do teste e estado Git.

Não houve alteração de produção: `index.html`, `js/20-dashboard.js` e `style/features.css` permanecem exatamente como no SHA informado.

## 3. Assertions novas

Dentro do teste existente `abre a sessão QA e renderiza a aba Início`, foram acrescentadas verificações para:

- Presença e visibilidade de:
  - `.inicio-health-content`
  - `.inicio-health-status`
  - `.inicio-health-copy`
  - `.inicio-health-eyebrow`
  - `.inicio-health-label`
  - `.inicio-health-metrics`
  - `.inicio-health-metric`
- Texto exato do eyebrow: `Seu momento financeiro`.
- Diagnóstico e descrição com texto não vazio.
- Existência de exatamente três indicadores.
- Rótulos `Entradas`, `Saídas` e `Resultado`.
- Superfície única da Saúde Financeira, via `getComputedStyle`:
  - `backgroundColor` transparente;
  - `borderWidth: 0px`;
  - `boxShadow: none`;
  - `padding: 0px`;
  - `borderRadius: 0px`.
- Anexo `saude-financeira.json` com o snapshot estrutural completo.

## 4. Score financeiro

O teste não fixa valor fictício. Quando `.inicio-health-score` existe, valida:

- valor numérico no `<strong>`;
- presença do texto `de 100`;
- `role="img"`;
- `aria-label` exatamente `Score de saúde financeira: <valor> de 100`.

Quando o score não é calculado, o teste aceita a ausência do elemento e afirma `toHaveCount(0)`. Isso reflete o comportamento real de `renderAdvancedDashboard()`, que só insere o score quando `visaoScore` é truthy.

## 5. Indicadores e cálculos reais

Não foi duplicada regra de negócio no teste. Os valores dos três indicadores da Saúde Financeira foram comparados diretamente com os valores já renderizados pelo próprio aplicativo no Resumo do Fluxo da aba Início:

- `Entradas` ↔ `Entradas`
- `Saídas` ↔ `Saídas`
- `Resultado` ↔ `Saldo do mês`

Essa comparação usa a sessão QA real e a saída do mesmo renderizador, sem criar dados financeiros artificiais.

## 6. Proteção da Visão Geral

O teste existente de navegação Início → Visão Geral → Início foi preservado e reforçado:

- `#viewDashboard .dashboard-health-card` deve existir antes e depois da navegação.
- `#viewDashboard .inicio-health-content` deve ter contagem `0` antes e depois.
- O texto do card da Visão Geral deve permanecer idêntico após a ida e volta.
- Ao retornar a Início, deve existir exatamente um `.inicio-health-content`.

Nenhuma alteração foi feita em `renderAdvancedDashboard()` para facilitar o teste.

## 7. Comandos oficiais do C.O.D.E. executados

Scripts identificados em `package.json` e etapas confirmadas em `.github/workflows/code-e2e.yml`.

| Comando | Resultado | Evidência |
|---|---|---|
| `node --check e2e/smoke/inicio.spec.js` | PASS | saída direta |
| `npm run code:syntax` | PASS | `01-syntax.txt` |
| `npm run code:list` | BLOCKED — `playwright: not found` | `02-list.txt` |
| `npm run code:oracles` | PASS — 149/149 | `03-oracles.txt` / `oracles.txt` |
| `npm run code:security` | PASS — 94/94 | `04-security.txt` / `security.txt` |
| `npm run code:smoke` | BLOCKED — exit 127, `playwright: not found` | `smoke.txt` |
| `npm run code:movimentacoes` | BLOCKED — exit 127, `playwright: not found` | `movimentacoes.txt` |
| `npm run code:test` | BLOCKED — exit 127, `playwright: not found` | `full.txt` |
| `git diff --check` | PASS | `diff-check.txt` |

O workflow `C.O.D.E. E2E` possui `workflow_dispatch` e executa sintaxe, oráculos, segurança e Playwright completo. O último run verde disponível é `45450323163` (`success`, SHA `f24154a`), em https://github.com/antvjpg/LIVRO-CAIXA/actions/runs/45450323163 — anterior a esta complementação.

## 8. Execução remota do novo teste

**NOT RUN.** O workflow remoto sempre executa o código publicado no ref informado. Como a complementação está apenas no working tree e commit/push foram explicitamente proibidos, disparar `gh workflow run code-e2e.yml --ref feat/app-layout-redesign` validaria o SHA `2910075` sem incluir as novas assertions. Fazer isso e apresentar o resultado como aprovação da nova cobertura seria enganoso.

Para validar a nova cobertura no C.O.D.E. remoto será necessário autorizar commit e push e, em seguida, disparar manualmente o workflow na branch.

## 9. Falhas, bloqueios e limitações

- Playwright não está instalado no ambiente local (`playwright: not found`), portanto smoke, movimentações, suite completa e listagem de testes estão **BLOCKED**, não FAIL.
- A execução remota da nova cobertura está **NOT RUN**, não aprovada.
- Nenhuma falha de teste foi observada nas etapas executadas.
- Os logs `oracles.txt` e `security.txt` são as execuções corretas dos scripts oficiais; tentativa anterior com nomes incorretos de script foi sobrescrita e não deve ser considerada.

## 10. Evidências

- `test-diff.txt` — diff integral da complementação.
- `git-status.txt` — estado final do Git.
- `diff-check.txt` — resultado de `git diff --check`.
- `01-syntax.txt`, `02-list.txt`, `oracles.txt`, `security.txt`, `smoke.txt`, `movimentacoes.txt`, `full.txt` — saídas dos comandos oficiais.

## 11. Confirmação de escopo

Nenhuma alteração de produção foi realizada. Nenhuma regra financeira, cálculo, persistência, autenticação, Visão Geral, tema, ícone, workflow ou dependência foi modificado. Nenhum commit, push, merge, release, deploy ou atualização do Notion foi executado.

## 12. Veredito técnico

**APROVADO COM RESSALVAS.** A complementação de cobertura está implementada e preserva integralmente os testes anteriores; sintaxe, validação de oráculos, segurança e `git diff --check` passaram. A aprovação plena depende da execução oficial do C.O.D.E. remoto com o novo teste publicado, atualmente bloqueada pela proibição de commit/push nesta etapa. A C6-INICIO-02 não é declarada encerrada.
