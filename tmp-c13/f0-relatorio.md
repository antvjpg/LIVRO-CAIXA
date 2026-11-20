# Fase 0 — Congelamento e inventário do baseline

> Execução da Fase 0 do **Plano de implantação — Correção documental e organização funcional de `docs/`**.
> Esta fase **não modifica nenhum documento**. Nenhuma correção, movimentação, commit ou push foi realizado.

## 1. Identificação

| Campo | Valor observado |
| --- | --- |
| Executado em (UTC) | 2026-11-20T19:08:48.181814+00:00 |
| Branch | `feat/app-navigation-redesign` |
| HEAD | `23444f0a62f5e5c2b45eed0905442a6e6069ca44` |
| Merge-base com `origin/main` | `f513611afb5195b501a896f66ed5b7c7848c2986` (0 atrás / 83 à frente) |
| Merge-base com `main` local | `9181d0d02ce5c702851923574c67509b33f4a196` (`main` local está 46 commits atrás de `origin/main`) |
| Working tree antes | limpo (`git status --short` vazio) |
| Responsável | agente de código (implementação); revisão independente **NÃO** realizada |

## 2. Baseline observado

| Item | Valor do plano | Valor medido | Resultado |
| --- | --- | --- | --- |
| HEAD | `23444f0…` | `23444f0…` | CONFERE |
| Arquivos em `docs/` | 155 | 155 | CONFERE |
| Pacote C.4 | 142 | 142 | CONFERE |
| `docs/padroes/` | 2 | 2 | CONFERE |
| Documentos na raiz | 11 | 11 | CONFERE |

Distribuição por extensão: .cjs = 45, .html = 11, .json = 21, .log = 18, .md = 60.

Tamanho total dos arquivos de `docs/`: 100,627,804 bytes (valor recalculado no inventário).

## 3. Inventário e hashes

Cada um dos 155 arquivos foi registrado com caminho relativo, extensão, tamanho em bytes e SHA-256 em `tmp-c13/f0-inventario-baseline.json`.

| Evidência | SHA-256 |
| --- | --- |
| `tmp-c13/f0-inventario-baseline.json` | `402fd5581434167ac6a165f522a2875b600566de42547e534d6aa7c79bab8a17` |
| `tmp-c13/f0-mapeamento-referencias.json` | `91e82795717a00ca50b00639c76203377a154c702226818cf1a28562d155e83e` |

## 4. Referências mapeadas

Foram encontrados 133 arquivos de texto no repositório com alguma referência a documentos de `docs/`. 152 de 155 documentos são referenciados; 3 não possuem referência entrante:

- `docs/NOTION_PHASE_B_CONTENT.md`
- `docs/OPENGOALS_PANEL_FIX_SUMMARY.md`
- `docs/auditorias/c4-v05-b/DIAGNOSTICO-R2-5.md`

Referências aos 13 documentos fora do pacote C.4 (relevantes para a Fase 3):

| Documento | Ocorrências | Arquivos de origem |
| --- | ---: | ---: |
| `docs/AUDITORIA-ARQUITETURA-AUTH-PERSISTENCIA.md` | 4 | 4 |
| `docs/AUDITORIA-GROQ-EXCLUSIVA.md` | 1 | 1 |
| `docs/AUDITORIA-IA-RESUMO.md` | 1 | 1 |
| `docs/AUDITORIA-VISUAL-MODAIS.md` | 3 | 3 |
| `docs/AUTHOVERLAY-EVOLUCAO-VISUAL.md` | 1 | 1 |
| `docs/COBERTURA-FLUXOS-FINANCEIROS.md` | 1 | 1 |
| `docs/CORRECOES-GROQ-EXCLUSIVO.md` | 1 | 1 |
| `docs/DOCUMENTACAO_VARIAVEIS_CSS.md` | 2 | 2 |
| `docs/NOTION_PHASE_B_CONTENT.md` | 0 | 0 |
| `docs/OPENGOALS_PANEL_FIX_SUMMARY.md` | 0 | 0 |
| `docs/REFATORACAO-AUTENTICACAO-RELATORIO.md` | 2 | 2 |
| `docs/padroes/METODOLOGIA-VALIDACAO-NAVEGACAO-CDP.md` | 5 | 5 |
| `docs/padroes/MODELO-RELATORIO-AUDITORIA.md` | 19 | 13 |

Observação metodológica: a busca é por **basename** em arquivos de texto (`.md`, `.js`, `.cjs`, `.json`, `.html`, `.log`, etc.), com até 5 linhas amostradas por origem. Basenames repetidos em diretórios diferentes podem gerar correspondência ambígua; a lista completa está no JSON. Isso é diagnóstico de caminhos, não validação de links Markdown — a validação de links está prevista na Fase 5.

## 5. Pacote C.4 e manifestos

Os 142 artefatos C.4 permanecem em `docs/auditorias/c4-v05-b/`, distribuídos em 14 diretórios (raiz do pacote + 13 subdiretórios), sem qualquer alteração.

Foram identificados 25 arquivos de integridade/índice/script dentro do pacote:

- indice de evidencias: 9
- manifesto de integridade: 8
- script gerador de manifesto: 4
- script verificador de manifesto: 4

Os 8 manifestos `*integrity.json` e os 8 scripts `gerar-*`/`verificar-*` são os mecanismos que calculam/confirmam hashes. Nenhum deles foi alterado; seus hashes constam do inventário.

Manifesto R2.5.7 verificado apenas quanto à estrutura (chaves presentes): `meta`, `artifacts`, `testSummary`, `groups`, `correctionsValidated`, `preservedFromR253`, `integrityVerification`. **Não** foi reexecutada a verificação criptográfica nesta fase — ela está prevista na Fase 5.3.

## 6. Alterações realizadas

**Nenhum arquivo existente foi modificado, renomeado, movido ou removido.** Foram criados apenas 3 arquivos de evidência fora de `docs/`:

- `tmp-c13/f0-inventario-baseline.json`
- `tmp-c13/f0-mapeamento-referencias.json`
- `tmp-c13/f0-relatorio.md` (este relatório)

Os arquivos de evidência ficam fora de `docs/` para que a contagem do baseline (155) permaneça exata e verificável.

## 7. Comandos executados (resumo)

- `git branch --show-current`; `git rev-parse HEAD`; `git log -1`; `git status --short`; `git merge-base HEAD main origin/main`; `git rev-list --left-right --count origin/main...HEAD`
- `find docs -type f | wc -l` → 155
- Scripts Python de varredura: SHA-256 por arquivo, contagem por área/extensão, varredura de referências por basename, contagem de hashes SHA-256 de 64 caracteres nos manifestos.

## 8. Verificações não executadas nesta fase

| Verificação | Estado | Motivo |
| --- | --- | --- |
| Correções semânticas F1.1–F1.5 | NOT RUN | Dependem da confirmação do escopo após F0 |
| Movimentações `git mv` (F3) | NOT RUN | Fase posterior |
| Criação de `docs/README.md` (F4) | NOT RUN | Fase posterior |
| Validação de links e hashes C.4 (F5) | NOT RUN | Fase posterior |
| Auditoria independente (F6) | NOT RUN | Não pode ser autoatribuída |
| `git diff --check` | NOT RUN | Sem alterações em arquivos versionados até o momento |

## 9. Estado por critério da Fase 0

| Critério de aceite | Estado | Evidência |
| --- | --- | --- |
| Inventário fechado | PASS | 155/155 arquivos no JSON |
| Todos os arquivos contabilizados | PASS | 142 + 2 + 11 = 155 |
| Baseline e limites registrados | PASS | Seção 1 e JSON |
| Nenhum arquivo alterado nesta fase | PASS | `git status --short` sem alterações em `docs/` |
| Revisão independente | NOT RUN | Fase 6 |

## 10. Riscos, limitações e próximo passo

- O inventário é um snapshot do HEAD `23444f0`; se a branch avançar, deve ser refeito.
- A varredura de referências por basename pode produzir correspondências ambíguas; a validação definitiva de links é da Fase 5.
- `main` local está desatualizada em relação a `origin/main`; a base de comparação adotada foi `origin/main`, conforme o plano.
- Os 3 documentos sem referência entrante não são, por si só, problema: podem ser órfãos legítimos ou resultado de índices ausentes. A decisão cabe às fases seguintes.

**Próxima ação:** apresentar este inventário para confirmação do escopo efetivo. O plano não autoriza automaticamente F1–F6; commit, push, PR e merge são gates independentes e seguem sem autorização.
