# RELATÓRIO TÉCNICO DE AUDITORIA — C6-INICIO-04

> Auditoria interna somente leitura. Não é auditoria independente, pois o mesmo agente executou a implementação avaliada. Recorte histórico no SHA `9cc8e7c`; HEAD de referência atual: `bdfb965`. AUD-01 não foi corrigido nesses commits.

## 1. Identificação

- **Auditoria:** C6-INICIO-04 — composição visual e hierarquia dos saldos.
- **Data:** 2026-11-26.
- **Repositório:** LIVRO-CAIXA.
- **Branch:** `feat/app-layout-redesign`.
- **Commit-base:** `41dcdfa118636774a5fa4bd18721bfea5aa8223a`.
- **Commit examinado:** `9cc8e7c15de86a091a9be6905e9e4092c7823f6c`.
- **Responsável:** OpenCode (validação interna).
- **Estado do working tree:** limpo no início; ao final, apenas novos artefatos de evidência em `tmp-c13/c6-4/auditoria/`. Nenhum arquivo de aplicação foi alterado.

## 2. Objetivo e escopo

- **Objetivo:** verificar os quatro pontos propostos sem alterar a composição aprovada.
- **Escopo:**
  1. largura dos três cards;
  2. Patrimônio Total e percentual;
  3. gráfico patrimonial independente;
  4. Saúde Financeira e Próximo Pagamento.
- **Fora do escopo:** correções, refatoração, commit, push, deploy e Notion.
- **Critérios:** capturas de viewport, rastreabilidade de dados, interação e preservação funcional.

## 3. Metodologia

- **Estratégia:** inspeção estática cruzada + medições reais de DOM via Chromium/CDP + capturas de viewport.
- **Ferramentas:** `git diff`, leitura de arquivos, `grep`, Chromium headless com CDP, Node.js.
- **Limitações:** Playwright indisponível no Termux; credenciais QA ausentes (`resolveCredentials()` retornou vazio); dados exibidos nas capturas são de demonstração injetados somente na sessão CDP, não Firestore real.

## 4. Inventário de evidências

| ID | Arquivo | Finalidade |
|---|---|---|
| E1 | `tmp-c13/c6-4/auditoria/viewport-320.png` | Responsividade 320×720 |
| E2 | `tmp-c13/c6-4/auditoria/viewport-360.png` | Responsividade 360×800 |
| E3 | `tmp-c13/c6-4/auditoria/viewport-390.png` | Responsividade 390×844 |
| E4 | `tmp-c13/c6-4/auditoria/viewport-1280.png` | Responsividade 1280×800 |
| E5 | `tmp-c13/c6-4/auditoria/fullpage-390.png` | Distribuição vertical |
| E6 | `tmp-c13/c6-4/auditoria/auditoria-c6-04.json` | Medições e interações |
| E7 | `tmp-c13/c6-4/auditoria/fixed-bottom-390.json` | Elementos fixos no fim do scroll |
| E8 | `tmp-c13/c6-4/prints/*.png` | 10 temas, 390×844 |
| E9 | `tmp-c13/c6-4/prints/manifest.json` | Tema/modo/cor das barras por captura |

## 5. Achados

### AUD-01 — Elementos fixos cobrem conteúdo no topo do viewport

- **Gravidade:** baixa/média, dependente de decisão de produto.
- **Localização:** FAB `#fabAdd` e `.mobile-bottom-nav`.
- **Problema observado:** em 320/360/390, no topo do scroll, houve sobreposição entre elementos fixos e a seção de Saúde Financeira; em 320 também houve sobreposição com a Evolução.
- **Causa-raiz:** controles `position:fixed`; área útil reservada apenas no fim do documento.
- **Impacto:** informação pode parecer cortada até o usuário rolar.
- **Evidência:** E6 (`fixed.overlapTop`) e capturas E1–E3.
- **Reprodução:** reproduzido em CDP.
- **Correção recomendada:** não executada; avaliar apenas se desejar nova rodada.
- **Critério de encerramento:** nova medição com sobreposição zero no topo, se aprovado.

Nenhum outro problema funcional foi reproduzido nos quatro pontos auditados.

## 6. Testes e verificações

| ID | Objetivo | Status | Evidência |
|---|---|---|---|
| T1 | 320×720 — cards na mesma linha, títulos de uma linha, sem corte de valor | PASS | E1, E6 |
| T2 | 360×800 — mesma verificação | PASS | E2, E6 |
| T3 | 390×844 — mesma verificação | PASS | E3, E6 |
| T4 | 1280×800 — mesma verificação | PASS | E4, E6 |
| T5 | Título truncado mantém nome acessível | PASS | E6 — `Caixinhas` usa ellipsis em 320/360 e `title="Caixinhas"` |
| T6 | Patrimônio fora de card | PASS | E6 — `isCard=false`, `background=none` |
| T7 | Origem e período do percentual | PASS (código) | `18-render-core.js:731-744,766-767,821-822`; `20-dashboard.js:67-79` |
| T8 | Percentual com dados Firestore reais | BLOCKED | Sem credenciais QA |
| T9 | Gráfico independente, sem superfície/borda | PASS | E6 — `background=none`, `border=0`, gap 21/33px |
| T10 | Gráfico nos 10 temas | PASS (visual) | E8, E9 |
| T11 | Seletor 3m/6m/1y | PASS | E6 — 3/6/12 pontos |
| T12 | Tooltip por clique e clique fora | PASS | E6 — `hidden=false` após clique na barra; `hidden=true` após clique fora |
| T13 | Controle de visibilidade do gráfico | PASS | E6 — `aria-expanded` true→false e chart ativo→destruído |
| T14 | Ausência de sobreposição no topo | FAIL | AUD-01 |
| T15 | Ausência de sobreposição no fim do scroll | PASS | E7 — zeros para FAB e nav |
| T16 | Preservação estática de Saúde Financeira | PASS | Diff `41dcdfa..9cc8e7c`; E2E mantido |
| T17 | Preservação estática de Próximo Pagamento | PASS | Kicker duplicado removido; nome/valor/vencimento preservados |
| T18 | Execução do Playwright/C.O.D.E. | BLOCKED | `playwright: not found` |
| T19 | Valores concretos de Saúde/Próximo com dados reais | BLOCKED | Sem sessão QA |

**Contagens derivadas:** PASS 15, FAIL 1, BLOCKED 3, NOT RUN 0.

## 7. Consistência e integridade

- **Divergências:** fullpage foi usado apenas para distribuição vertical; não foi usado para provar ausência de sobreposição fixa.
- **Hashes:** commit examinado `9cc8e7c`; working tree limpo.
- **Manifestos:** E9 registra os 10 temas e as cores das barras.
- **Verificações independentes:** não houve auditoria independente; este documento é validação interna.

## 8. Limitações e incertezas

- Não foi possível validar dados Firestore reais.
- Não foi possível executar Playwright local.
- A hipótese de assimetria entre `current` ao vivo e `previous` em corte de fim de mês não foi confirmada com dataset real.
- Prints de tema usam valores de demonstração para visualização; não representam saldo do usuário.

## 9. Veredito

- **Veredito:** **INCONCLUSIVA**.
- **Fundamentação:** os critérios visuais e de interação foram atendidos, mas há um problema reproduzido (AUD-01) e verificações bloqueadas por falta de sessão QA/Playwright.
- **Critérios atendidos:** pontos 1, 3 e 4 no queDepende de layout/interação e preservação estática; ponto 2 na rastreabilidade do cálculo.
- **Critérios não atendidos:** sobreposição de elementos fixos no topo do viewport.
- **Condições para nova avaliação:** sessão QA real, execução do C.O.D.E. e decisão sobre AUD-01.

## 10. Próximos passos

- **Correções necessárias:** nenhuma executada nesta auditoria.
- **Evidências adicionais:** capturas com sessão QA real e execução remota do smoke.
- **Próxima etapa autorizada:** somente após decisão do usuário sobre AUD-01.
