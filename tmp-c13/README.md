# README — `tmp-c13/`

Este diretório concentra **artefatos de auditoria, validação, evidência e rastreabilidade** do trabalho T13/APP LAYOUT REDESIGN. Ele **não contém código de produção** e não é carregado pela aplicação.

## Convenções de nomenclatura

| Prefixo / pasta | Conteúdo |
|---|---|
| `c0-*`, `c1-*`, `c2-*`, `c3-*`, `c4-*` | Coletas e auditorias iniciais: scripts CDP/Node, JSON de resultados, logs de servidor/Chromium e relatórios. |
| `c6-1/` … `c6-9/` | Relatórios e evidências dos indicadores da aba Início. Não existe `c6-7/`; a sequência registrada salta de `c6-6` para `c6-8`. |
| `d01-*` … `d05-*` | Validações dinâmicas com antes/depois, incluindo screenshots desktop/mobile claro/escuro. |
| `f0-*` … `f7-*` | Inventários de baseline, mapeamento de referências, validações de documentação e auditorias F. `f0-*` são registros históricos congelados. |
| `r2-6-*` | Relatórios e adendos da rodada R2.6. |
| `RELATORIO-FINAL-IMPLANTACAO.md`, `C4-FINAL-RECORD.md`, `c4-relatorio-tecnico.md` | Sínteses consolidadas de fases anteriores. |
| `*.png`, `prints/`, `screenshots/` | Evidências visuais. |
| `*.json` | Resultados brutos, snapshots e medições. |
| `*.log` | Logs locais de Chromium e servidor HTTP. |

## Índice por área

### Fase C6 — aba Início

| Pasta | Finalidade |
|---|---|
| `c6-1/` | Auditoria dinâmica inicial da Início (`RELATORIO-C6-1-INICIO.md`, `audit-c6-inicio.cjs`, `evidencias.json`, `screenshots/`). |
| `c6-2/` | Matriz e complementações: hierarquia, E2E, Saúde Financeira, harness, temas e `SHA256-COMPLEMENTAR.sha256`. |
| `c6-3/` | Isolamento Início ↔ Visão Geral, bloco de Orçamentos, ajustes visuais, BNI e acessibilidade do gráfico. |
| `c6-4/` | Auditoria visual e finalização da composição da Início (`auditoria/`, `finalizacao/`, `prints/`). |
| `c6-5/` | Acessibilidade semântica do gráfico patrimonial. |
| `c6-6/` | Cascata CSS: ressalvas R01/R02/R03, evidências CDP e levantamento de `.md` para renomear/mesclar. |
| `c6-8/` | Cobertura E2E do FAB global na Início. |
| `c6-9/` | Validação dinâmica de teclado/ARIA do gráfico; inclui `c9-resultados-v1.json` preservado e script CDP reproduzível. |

### Coletas e validações anteriores

- `c0-baseline-ficha.*`, `c0-baseline.cjs` — baseline inicial.
- `c1-ampliacao.*`, `c1-auditoria-css.*` — ampliação e auditoria de CSS.
- `c2-navegacao.*` — navegação mobile/desktop.
- `c3-*` — coleta visual com temas claro/escuro.
- `c4-accent-*`, `c4-control-validation.cjs`, `c4-ci-e2e.log` — fase C4 e integração CI.
- `d01-*` a `d05-*` — validações dinâmicas e pares antes/depois.
- `f0-*` a `f7-*` — inventários, validação de documentação e auditorias independentes.
- `r2-6-*` — relatórios faseados da rodada R2.6.

## Regras de uso

1. **Não apagar arquivos antigos por conveniência.** Muitos são registros históricos com SHA, hash ou evidência associada.
2. **`f0-*` e o pacote C4 são congelados.** `docs/README.md` define que esses inventários e nomes não devem ser reescritos.
3. Arquivos com SHA no conteúdo descrevem aquele baseline; para estado atual, procurar o relatório da fase mais recente.
4. Scripts `*.cjs`/`*.mjs` aqui são harnesses locais de auditoria, não infraestrutura de produção.
5. Logs e screenshots são evidências; prefira adicionar novos arquivos a sobrescrever os antigos.

## Como localizar informação

- Composição vigente da Início: começar por `c6-6/`, `c6-8/` e `c6-9/`.
- Orçamentos na Início: `c6-3/`.
- Navegação/BNI: `c6-3/` e `c6-6/`.
- Acessibilidade do gráfico: `c6-5/` (estrutura) e `c6-9/` (dinâmico).
- Documentação e referências: `f0-*`, `f5-*`, `f7-*` e `MD-RENOMEAR-MESCLAR.md` em `c6-6/`.
