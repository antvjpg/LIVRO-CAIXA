# RELATÓRIO FINAL — C6-INICIO-02

> Auditoria/validação interna. Não é auditoria independente; o aceite depende de revisão externa. Recorte histórico em `db5bdb9`; HEAD de referência atual: `bdfb965`. P-01 permanece sem correção confirmada; alterações locais descritas aqui foram posteriormente commitadas em `db5bdb9`.

## 1. Diagnóstico do estado inicial

- Branch: `feat/app-layout-redesign`; base: `c50cf11`; árvore limpa no início.
- A composição aprovada já estava implementada: Patrimônio Total fora de card, três cards na mesma linha, gráfico independente, Saúde Financeira e Próximo Pagamento preservados.
- Lacunas da auditoria anterior:
  - **P-01:** sobreposição dos elementos fixos no topo; evidência de fim de scroll existia apenas para 390 px.
  - **P-02:** rótulo `Invest.` era abreviação manual, não reticência visual; nome completo estava em `title`/`aria-label`.
  - **P-03/P-04:** dados Firestore reais e Playwright indisponíveis neste ambiente.

## 2. Arquivos inspecionados

- `index.html`
- `js/18-render-core.js`
- `js/20-dashboard.js`
- `js/99-init.js`
- `js/00-bootstrap.js`
- `style/features.css`
- `style/layout.css`
- `style/base.css`
- `e2e/smoke/inicio.spec.js`
- Evidências em `tmp-c13/c6-4/auditoria/`.

## 3. Arquivos alterados

| Arquivo | Alteração | Justificativa |
|---|---|---|
| `js/18-render-core.js` | Texto visível do rótulo `Invest.` → `Investimentos` | Corrigir P-02 sem alterar cálculo, navegação ou acessibilidade |
| `e2e/smoke/inicio.spec.js` | Expectativa atualizada para `Investimentos` | Manter o teste coerente com o DOM |

Nenhum arquivo de layout do gráfico, tema, cálculo financeiro ou nav foi alterado nesta etapa.

## 4. Requisitos atendidos

| Requisito | Status | Evidência |
|---|---|---|
| RF-01 — unicidade do Patrimônio Total na Início | PASS | `dom-ciclo-vida.json` |
| RF-02 — Livro-Caixa preservado em 3 ciclos | PASS | `dom-ciclo-vida.json` |
| RF-03 — saldos usam fontes/cálculos existentes | PASS (estático) | leitura de `renderBalances()` |
| RF-04 — gráfico independente, 3/6/12 meses, tooltip e visibilidade | PASS | `finalizacao-c6-02.json` |
| RF-05 — percentual derivado e sem valor fixo | PASS (código) | `18-render-core.js:731-744,766-767` |
| RF-06 — Saúde/Próximo preservados | PASS (estático) | diff `41dcdfa..c50cf11` |
| RV-01 — composição aprovada preservada | PASS | capturas de viewport |
| RV-02 — cards na mesma linha e títulos sem quebra | PASS | `finalizacao-c6-02.json` |
| RV-03 — dez temas | PASS (visual) | `prints/*.png`, `manifest.json` |
| RV-04 — viewports | PASS para layout; ressalva P-01 | `viewport-*.png` |

## 4.1 Correção pós-relatório — gráfico após reload

- **Defeito relatado:** ao atualizar a página, a Evolução do Patrimônio não renderizava.
- **Causa raiz:** `renderBalances()` forçava `patrimonySparkVisible = true` durante a restauração da aba, mas a inicialização posterior em `js/99-init.js` lia `localStorage` e sobrescrevia o valor para `false` quando a preferência salva era `0`.
- **Correção:** inicialização de `PATRIMONY_SPARK_STORAGE_KEY` e `patrimonySparkVisible` movida para antes da restauração da última aba.
- **Validação:** `Page.reload` via CDP com preferências `0` e `1`; gráfico presente em ambos os casos. Evidência em `reload-correcao.json`.

## 4.2 Mapeamento do espaçamento inferior

- **Mobile 390 px:** Início = `96px` no `body` + `24px` no `main` = `120px`, com footer de ~`56px`; demais abas = `106px` + `20px` = `126px`.
- **Desktop 1280 px:** Início = `0px` + `24px` = `24px`; demais abas = `0px` + `80px` = `80px`.
- **Origem mobile comum:** `style/layout.css:249` e `style/layout.css:40`.
- **Origem específica da Início:** `style/features.css:4820-4825` (mobile) e `style/features.css:4370-4372` (desktop).
- **Conteúdo real na faixa inferior:** apenas o `<footer>` com `livro-caixa · dados sincronizados com a nuvem pela sua conta` (`index.html:1623`). No mobile ele tem `padding` inferior de `122px + env(safe-area-inset-bottom)` (`features.css:816`), resultando em ~154px de altura; abaixo dele há só o `padding-bottom` do `body`, e acima dele o `padding-bottom` do `main`.
- **Elementos fixos sobrepostos à faixa:** `.mobile-bottom-nav` (`layout.css:252`) e `#fabAdd` (`layout.css:266`), que não ocupam fluxo, mas reservam a área visual.
- Evidência: `bottom-spacing-map.json`. Nenhum valor foi alterado nesta etapa.

## 5. Pendências não resolvidas

- **P-01 (visual/responsiva):** FAB e navegação ainda sobrepõem conteúdo no topo em 320/360/390. Corrigir exigiria mudar a reserva superior ou o comportamento dos elementos fixos, o que alteraria a composição aprovada; não foi autorizado nesta etapa.
- **P-03 (dados reais):** sem credenciais QA, não foi possível validar Firestore real.
- **P-04 (testes):** Playwright indisponível no Termux; C.O.D.E. local bloqueado.

## 6. Resultados dos testes

| ID | Teste | Status |
|---|---|---|
| T-01 | Unicidade do Patrimônio | PASS |
| T-02 | Alternância Início ↔ Livro-Caixa ×3 | PASS |
| T-03a | Integridade estática dos saldos e fontes | PASS |
| T-03b | Valores concretos com Firebase real | BLOCKED |
| T-04 | Ciclo de vida Chart.js e detalhamento | PASS |
| T-05 | Responsividade 320/360/390/1280 | PASS |
| T-06 | Matriz de dez temas | PASS |
| T-07 | Playwright/C.O.D.E. | BLOCKED |
| T-08 | Último conteúdo livre no fim do scroll (4 viewports) | PASS |
| T-09 | Sobreposição no topo | FAIL |
| T-10 | Rótulo `Investimentos` com ellipsis e nome acessível | PASS |
| T-11 | Preservação estática de Saúde/Próximo | PASS |
| T-12 | Valores reais de Saúde/Próximo | BLOCKED |

**Contagens:** PASS 10, FAIL 1, BLOCKED 3, NOT RUN 0.

## 7. Evidências

- `tmp-c13/c6-4/finalizacao/finalizacao-c6-02.json`
- `tmp-c13/c6-4/finalizacao/dom-ciclo-vida.json`
- `tmp-c13/c6-4/finalizacao/viewport-320.png`
- `tmp-c13/c6-4/finalizacao/viewport-360.png`
- `tmp-c13/c6-4/finalizacao/viewport-390.png`
- `tmp-c13/c6-4/finalizacao/viewport-1280.png`
- `tmp-c13/c6-4/finalizacao/fullpage-390.png`
- `tmp-c13/c6-4/finalizacao/prints/*.png`
- `tmp-c13/c6-4/finalizacao/prints/manifest.json`

## 8. SHA efetivamente validado

- Base commit: `c50cf11`.
- Validação executada com duas alterações locais não commitadas: `js/18-render-core.js` e `e2e/smoke/inicio.spec.js`.
- Working tree ao final: 2 arquivos modificados + artefatos novos em `tmp-c13/c6-4/finalizacao/`.

## 9. Parecer técnico

**Não recomendo aceite completo da C6-INICIO-02 neste momento.**

Recomendo aceite parcial apenas dos itens comprovados: unicidade, regressão do Livro-Caixa, ciclo de vida do gráfico, responsividade estrutural, temas e P-02. O aceite final depende de decisão sobre P-01 e de execução autenticada/E2E em ambiente com Playwright.

## 10. Próxima etapa autorizada

Somente após definição do usuário:
1. decidir se P-01 será tratado como defeito bloqueante ou ressalva visual aceita;
2. executar C.O.D.E. em CI com sessão QA;
3. anexar evidências autenticadas ao SHA final.
