# Fases 2–4 — Estrutura funcional, movimentação e índice

**Identificação:** branch `feat/app-navigation-redesign` · HEAD `23444f0` · 20/11/2026 · execução por agente de código; revisão independente em F6.

## Escopo autorizado
Reorganizar a raiz de `docs/` por função, mover 11 documentos com `git mv`, atualizar referências e criar `docs/README.md`. Fora de escopo: C.4 (142 artefatos), `padroes/` (2), código de produção.

## Estrutura-alvo executada
```
docs/
├── README.md                        (novo)
├── arquitetura/ia/                  (1)
├── auditorias/autenticacao/         (1)
├── auditorias/ia/                   (1)
├── auditorias/visual/               (1)
├── auditorias/c4-v05-b/             (142 — intacto, 14 dirs)
├── design-system/                   (1)
├── design-system/auth-overlay/      (1)
├── implementacoes/autenticacao/     (1)
├── implementacoes/correcoes/        (1)
├── implementacoes/ia/               (1)
├── implementacoes/navegacao/        (1)
├── padroes/                         (2 — intacto)
└── referencias/financeiro/          (1)
```
`auditorias/navegacao/` e `arquitetura/autenticacao/` da proposta ficam como pastas reservadas (Git não versiona diretórios vazios); declarado no índice.

## Movimentações (11 `git mv`, nomes preservados)
| Origem | Destino |
|---|---|
| `docs/AUDITORIA-IA-RESUMO.md` | `docs/arquitetura/ia/` |
| `docs/AUDITORIA-ARQUITETURA-AUTH-PERSISTENCIA.md` | `docs/auditorias/autenticacao/` |
| `docs/AUDITORIA-GROQ-EXCLUSIVA.md` | `docs/auditorias/ia/` |
| `docs/AUDITORIA-VISUAL-MODAIS.md` | `docs/auditorias/visual/` |
| `docs/DOCUMENTACAO_VARIAVEIS_CSS.md` | `docs/design-system/` |
| `docs/AUTHOVERLAY-EVOLUCAO-VISUAL.md` | `docs/design-system/auth-overlay/` |
| `docs/REFATORACAO-AUTENTICACAO-RELATORIO.md` | `docs/implementacoes/autenticacao/` |
| `docs/OPENGOALS_PANEL_FIX_SUMMARY.md` | `docs/implementacoes/correcoes/` |
| `docs/CORRECOES-GROQ-EXCLUSIVO.md` | `docs/implementacoes/ia/` |
| `docs/NOTION_PHASE_B_CONTENT.md` | `docs/implementacoes/navegacao/` |
| `docs/COBERTURA-FLUXOS-FINANCEIROS.md` | `docs/referencias/financeiro/` |

## Referências atualizadas
- `README.md` (raiz): 8 linhas da tabela de documentação, com links para os novos caminhos e entrada para `docs/README.md`.
- `AUDIT_DOCUMENTATION_REPORT.md`: 1 referência.
- `.opencode/skills/auditoria/SKILL.md`: 1 referência.
- `e2e/README.md`: 2 referências.
- `e2e/security/security.test.mjs`: 1 referência (caminho lido em tempo de teste).
- `e2e/helpers/app.cjs`: 1 referência em comentário.
- 7 documentos movidos: autorreferências e referências cruzadas trocadas para caminhos completos `docs/...`.
- Evidências `tmp-c13/f0-*` e `f1.*-relatorio.md` **não** foram reescritas: são registros do estado no momento da execução.

## Índice criado
`docs/README.md` contém finalidade, mapa por área, tabela com 13 documentos (link/finalidade/estado temporal/área), entrada separada para o pacote C.4, regras de adição, nomenclatura, distinção entre auditoria/implementação/padrão/referência, orientação de links ao mover arquivos e a precedência GitHub→Notion.

## Comandos e resultados
`mkdir -p` para os destinos; 11 × `git mv`; varredura Python de referências; edições com `Edit`; `node --check` em `security.test.mjs` e `app.cjs` (OK); `node --test e2e/security/security.test.mjs` → **44/44 PASS, 0 FAIL**, incluindo o teste que lê o documento movido.

## Estado por critério
| Critério | Estado |
|---|---|
| Git reconhece as movimentações (R) | PASS (11 renames) |
| Arquivos existem no destino | PASS |
| Nenhum ID/classe/arquivo renomeado | PASS |
| Referências internas atualizadas | PASS |
| README cobre a árvore final | PASS |
| C.4 e `padroes/` preservados | PASS |

## Riscos e limitações
Links preexistentes quebrados dentro de índices C.4 foram registrados como BLOCKED em F5 e não corrigidos (pacote protegido). Diretórios vazios da proposta não são versionados pelo Git.
