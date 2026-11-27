# Candidatos a renomeação/consolidação de `.md`

**Data:** 2026-11-26  
**Estado:** levantamento somente leitura. Nenhum arquivo foi renomeado, movido ou mesclado.

Foram inventariados 171 arquivos Markdown do projeto. A proposta abaixo prioriza nomes que hoje contradizem o conteúdo ou documentos sempre consumidos em conjunto.

## Baixo risco — bons candidatos

| Atual | Ação sugerida | Motivo |
|---|---|---|
| `tmp-c13/c6-2/saude-financeira/MATRIZ.md` | mesclar em `RELATORIO.md` | Matriz pequena, sempre citada pelo relatório e com linhas repetidas. |
| `tmp-c13/c6-5/INDICE-EVIDENCIAS.md` | mesclar em `RELATORIO-C6-INICIO-05.md` | 25 linhas; apenas repete o relatório, evidência e limitações. |
| `tmp-c13/c6-2/complementar/diag-allow/diagnosticos/MATRIZ-diag-allow-allow.md` e `.../diag-block/.../MATRIZ-diag-block-block.md` | mesclar em `DIAGNOSTICO-ICONS.md` | Diferem só no título e nos caminhos das capturas. |
| `tmp-c13/r2-6-2/LEIA-ME.md` | renomear para `RELATORIO-R2-6-2.md` | Único `LEIA-ME.md`; conteúdo é um relatório. |
| `tmp-c13/r2-6-4/relatorio-correcoes.md` | renomear para `RELATORIO-CORRECOES-R2-6.md` | Padronização com o restante do diretório. |
| `tmp-c13/r2-6-4/RELATORIO-FASE0.md` … `FASE7.md` | renomear para `R2-6-4-FASE0.md` … `FASE7.md` | Mantém a precedência declarada em `RELATORIO-R2-6-4.md:172`; só normaliza o nome. |
| `e2e/reports/CODE-relatorio-2026-11-{07,16,17}.md` | mesclar em `CODE-relatorio-2026-11-07-17-historico.md` | Mesma execução de teste; diferem só em metadados gerados. São ignorados pelo Git. |

## Médio risco — exigem atualizar índices/referências

| Atual | Ação sugerida | Motivo |
|---|---|---|
| `tmp-c13/c6-4/finalizacao/RELATORIO-FINALIZACAO-C6-INICIO-02.md` | mover para `tmp-c13/c6-2/finalizacao/` ou renomear com sufixo `-ARQUIVADO-EM-C6-04` | Nome declara C6-02, mas está em `c6-4/`. Sem referências de entrada. |
| `docs/implementacoes/correcoes/OPENGOALS_PANEL_FIX_SUMMARY.md` | renomear para `RESUMO-CORRECAO-OPENGOALS-PANEL.md` | Nome em inglês, divergente da convenção. Exige atualizar `docs/README.md`, validadores e referências históricas. |
| `docs/referencias/financeiro/COBERTURA-FLUXOS-FINANCEIROS.md` | renomear para `COBERTURA-FLUXOS-FINANCEIROS-HISTORICO.md` | `docs/README.md` já classifica como histórico; nome sugere cobertura vigente. |
| `docs/arquitetura/ia/AUDITORIA-IA-RESUMO.md` | renomear para `AUDITORIA-IA-HISTORICO.md` | 424 linhas não são “resumo” e descrevem arquitetura removida. |
| `.opencode/skills/anti-ai-ui-review/RELATORIO-V1.1.0.md` | mesclar o distinto em `references/CHANGELOG.md` | V1.1.1 substitui V1.1.0. |
| `AUDIT_DOCUMENTATION_REPORT.md` + `docs/implementacoes/navegacao/NOTION_PHASE_B_CONTENT.md` | consolidar como `RELATORIO-FASE-B-CONSOLIDACAO-INICIO-HISTORICO.md` | Mesmo tema e mesmo SHA antigo; um é 4.286 linhas, o outro é o resumo reconciliado. |
| `R2-relatorio.md` | renomear para `R2-QUINTA-RETIFICACAO-C4-HISTORICO.md` | Nome genérico, preso a branch/SHA antigos. |

## Alto risco — não recomendar por conveniência

- `docs/auditorias/c4-v05-b/**` e o espelho `e2e/c4/original/**`: nomes e hashes são validados por `*integrity.json` e scripts `gerar-manifesto-*`. `docs/README.md` pede explicitamente preservação.
- `.opencode/skills/anti-ai-ui-review/SKILL.md` e `references/TELLS.md`: lidos por `scripts/detect.mjs` e testes.
- `AGENTS.md`, `README.md`, `docs/README.md`, `docs/padroes/MODELO-RELATORIO-AUDITORIA.md`: índices/contratos centrais.
- `e2e/README.md` e `AUDITORIA-ARQUITETURA-AUTH-PERSISTENCIA.md`: lidos por `e2e/security/security.test.mjs`.

## Observação sobre `.md` órfãos

Vários arquivos em `tmp-c13/` não têm referências de entrada reais; são seguros para mesclar. Porém muitos basenames são genéricos (`RELATORIO.md`, `MATRIZ.md`, `INDICE-EVIDENCIAS.md`) e devem ser manipulados com cuidado para não quebrar referências relativas implícitas.

Nenhuma dessas ações foi executada.
