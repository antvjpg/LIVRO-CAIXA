# C.O.D.E. — Controle Operacional de Diagnóstico e Execução

Infraestrutura de QA/E2E/auditoria do LIVRO-CAIXA. Fase própria (`feature/code-qa`):
nenhuma alteração em código de produção (`index.html`, dados persistidos ou worker).

> **Estado atual (07/11/2026):** ambiente QA autônomo (identidade
> efêmera por run, criação pela UI real, exclusão no teardown, relatório com
> seção `QA ENVIRONMENT`, zero GitHub Secret) e execução real validada:
> run `42397573276` (commit `a44c74b`) terminou **success —
> `PASS=34 FAIL=0 BLOCKED=0 SKIPPED=0 FLAKY=0`** com
> `QA CREATED=SIM | FIRESTORE=PASS | AUTH=PASS` e cleanup `PASS`
> (artefato `code-e2e-evidencias`), gate `--strict` aprovado. No Termux não há
> `playwright install` (`Unsupported platform: android`), mas o Chromium do
> sistema + spoof de plataforma habilita inspeção local — usado pelo harness
> `e2e/visual/audit-modais.cjs`; o caminho validado da suíte completa
> continua sendo CI/PC.
>
> Nota: o histórico de runs 1–7 e do ciclo corretivo (até `42397573276`) está
> registrado na página “Proteção local — Plano de execução por fases” do Notion.
> A LIA (assistente de IA), o OCR assistido e a integração MCP foram removidos
> em novembro de 2026; qualquer referência histórica a eles neste arquivo é
> contexto, não estado atual.

## 1. Organização

```
package.json               scripts code:* + devDependency @playwright/test (só dev)
playwright.config.cjs      setup → suítes; globalSetup/globalTeardown
e2e/
  visual/                  auditoria visual dos modais (harness local, sem CI)
    audit-modais.cjs       abre cada modal em Chromium, mede tamanho/overflow
    saida/                 RELATORIO.md + auditoria-modais.json (gerados)
  auth/qa.setup.js         provisiona sessão QA (signup + logout/login reais) e
                           grava storageState (só cookies/localStorage)
  smoke/smoke.spec.js      aplicação operacional + Visão Geral
  movimentacoes/           banco → entrada → saída → UI × oracle × Firestore → reload
  caixinhas/               caixinhas (aporte, resgate, progresso)
  cartoes/                 cartões (cadastro, limites)
  categorias/              categorias e subcategorias
  integracao/cartao-fatura.spec.js      cartão/fatura: total, limite, pagamento
  integracao/movimentacao-dashboard.spec.js  movimentações agregadas no dashboard
  investimentos/           agrupamento por instituição, CRUD serial, persistência
  metas/                   metas (criação, fontes, progresso, edição, exclusão)
  orcamento/               orçamentos por categoria
  seguranca/               regras do Firestore em produção
  helpers/
    identity.js            identidade efêmera da run (gera, mascara, decide exclusão)
    cleanup.js             cleanup em 2 camadas (Firestore + Auth) → qa-summary.json
    global-setup.js        1× por run: gera e-mail/senha efêmeros (só em process.env)
    global-teardown.js     o "finally": roda sempre, nunca derruba a run
    qa-account.js          login/criação + logout/login reais + ensureUiSession
                           (refaz a sessão em cada suíte, com trace pausado)
    firestore-rest.js      REST somente no escopo livrocaixa/{uid} + deleteOwnAccount
    env.js                 resolução de credenciais + guarda isQaEmail
    app.cjs, console-watch.cjs  page object e evidência de erros de console
    sanitize.js            mascarador de e-mail/senha/token para relatórios
  fixtures/fixtures.js     dados determinísticos (marcadores CODE_TEST_*)
  fixtures/v20-01-fixtures.js  documentos sintéticos V.20-01 (CODE_V2001_*)
  oracles/                 cálculo INDEPENDENTE do app + testes unitários (node:test)
    document.js            oráculo por LINHA do documento (algoritmo distinto)
    bank.test.mjs, goal.test.mjs, investment.test.mjs, invoice-cycle.test.mjs,
    oracle.test.mjs, pin-divergence.test.mjs, pin-protection.test.mjs,
    pocket.test.mjs, receivable.test.mjs, v20-02-*.test.mjs
  security/security.test.mjs  garantias auditáveis do próprio C.O.D.E.
  security/v20-02-budget-status.test.mjs, v20-02-prompt-injection.test.mjs,
    v20-02-contextual-suggestions.test.mjs
  seeds/reset.cjs          cleanup manual de dados (só Firestore)
  seeds/cleanup.cjs        cleanup manual completo (Firestore + Auth efêmera)
  reports/generate-report.cjs  relatório + QA ENVIRONMENT (gitignored)
  reports/history.jsonl    histórico persistente de runs (gitignored)
  scripts/list-tests.cjs   listagem de testes no Termux (shim, sem browser)
  scripts/syntax-check.cjs sintaxe dos módulos js/ (inclui js/domain e js/legacy),
                           js/data/emoji-catalog.js e sw.js
                           (index.html é HTML puro desde 208c0eb)
  .env.example             contrato do fallback manual (opcional)
worker/test/               testes do Worker (node:test): financial, financial-client,
                           audit-trail, simple-log, style-layout
.github/workflows/code-e2e.yml  CI sem secrets: sintaxe → oracles → segurança →
                                chromium → suítes → relatório → limpeza → artefatos
```

Princípios: oracles nunca importam código do app (coincidência = evidência, não cópia);
nenhum segredo no Git nem em artefato; bloqueio aparece como `BLOCKED`, nunca some;
**a conta é da run e só a run pode excluí-la**.

## 2. Comandos

| Comando | O que faz | Roda no Termux? |
|---|---|---|
| `npm run code:oracles` | testes unitários dos oracles (sem browser) | sim |
| `npm run code:list` | descobre/lista os testes (shim de plataforma) | sim |
| `npm run code:security` | 52 garantias do próprio C.O.D.E. (offline) | sim |
| `npm run code:syntax` | valida sintaxe dos módulos `js/`, `js/data/emoji-catalog.js`, `sw.js` | sim |
| `npm run code:test` | suítes + relatório `--strict` (sai 1 se FAIL/BLOCKED/FLAKY) | **não** |
| `npm run code:smoke` / `code:movimentacoes` / `code:orcamento` / `code:metas` / `code:investimentos` | suíte individual (projeto Playwright) | **não** |
| `npx playwright test --project=<nome>` | qualquer suíte (caixinhas, cartoes, categorias, integracao, seguranca…) | **não** |
| `npm run code:test:headed` | idem com navegador visível | não |
| `npm run code:report` | gera `e2e/reports/CODE-relatorio-<data>.md` | sim |
| `npm run code:report:strict` | idem + exit 1 se houver `FAIL`/`BLOCKED` | sim |
| `npm run code:reset` | apaga dados sob `livrocaixa/{uid-qa}` (idempotente) | sim (rede) |
| `npm run code:cleanup` | Firestore + exclusão da conta efêmera (se for da run) | sim (rede) |
| `npm run code:serve` | servidor estático `:8000` | sim |

No PC/CI: `npm ci && npx playwright install --with-deps chromium && npm run code:test`.

## 3. Identidade QA efêmera (autonomia do ambiente)

- **Geração (FASE 3):** o `global-setup` roda uma vez por run e injeta em
  `process.env`: `CODE_TEST_EMAIL=code-qa-<run-id>-<sufixo>@livrocaixa.test`
  + senha forte aleatória. A senha existe **só na memória** (nunca em arquivo,
  nunca em log, nunca em artefato, nunca no Git). `run-id` = `gh<run>[-a<n>]`
  no Actions, `loc<timestamp>` local.
- **Criação real (FASE 4):** o projeto `setup` cria/entra na conta pela
  **interface do aplicativo** (o mesmo `createUserWithEmailAndPassword` do
  app) e grava `createdByCode = true` **somente** quando o signup teve
  sucesso (`how === 'signup'`). Login/sessão reutilizada = preexistente.
- **Exclusão (FASE 6):** no `globalTeardown` (roda sempre), a conta é excluída
  via `accounts:delete` usando **apenas o `idToken` do próprio usuário** — a
  forma documentada da API para fim de usuário. Sem `localId`, sem credencial
  administrativa, sem chave de serviço. Antes disso o `canDeleteIdentity`
  exige: `createdByCode === true` **e** UID/e-mail da sessão confere com o
  registrado na run. Conta preexistente ⇒ `SKIP-PREEXISTENTE`, nunca excluída.
- **Limpeza em 2 camadas (FASE 7):** 1) Firestore — apaga somente
  `livrocaixa/{uid-da-sessão}` (lista fechada de coleções, paginação
  fail-closed, `assertScoped`); 2) Auth — só se a guarda acima passar.
  Sem senha em memória / UID divergente ⇒ **`BLOCKED` visível**, não silêncio.
  O resultado vira `e2e/.state/qa-summary.json` e entra no relatório.
- **Segredo no CI (FASE 3):** o workflow **não usa** GitHub Secrets, environment
  nem credencial em texto. Fallback manual (opcional): `CODE_TEST_EMAIL` /
  `CODE_TEST_PASSWORD` por variável de ambiente ou `e2e/.env.local` — nesse
  caso a conta é preexistente e não é excluída. Contrato em `e2e/.env.example`.
- **Guarda de conta (evita tocar a conta real do usuário):** `isQaEmail()`
  só aceita e-mail iniciado por `code-qa-` ou domínio de
  `CODE_TEST_EMAIL_DOMAINS` (padrão `livrocaixa.test`); outro e-mail ⇒
  credencial recusada com motivo claro. Override deliberado:
  `CODE_TEST_ALLOW_ANY_EMAIL=1`. Testado em `security.test.mjs`.
- **Isolamento:** todo dado fica em `livrocaixa/{uid}/*`; o reset só acessa o
  uid devolvido pela autenticação da própria conta QA.
- **Sessão por suíte (descoberto na primeira execução no Actions):** o
  Firebase 10 (compat) persiste a sessão em **IndexedDB** (`firebaseLocalStorageDb`),
  e o `storageState` do Playwright exporta **apenas cookies + localStorage** —
  o arquivo gravado pelo `setup` não contém a sessão. Por isso cada suíte que
  depende da sessão chama `ensureUiSession()`, que refaz o **login real** na
  própria página. Para a senha nunca virar artefato, o **trace é pausado
  durante o login** (`tracing.stop()` → login → `tracing.start()`) e a senha é
  removida do DOM logo em seguida. A prova de logout/login real continua no
  projeto `setup` (FASE 4), que já roda com `trace/screenshot/video: off`.
- **Provedores — estado atual informado (Firebase Console, 27/09/2026):**
  E-mail/senha **ATIVADO** · Smartphone **ATIVADO** · Google **ATIVADO**.
  O diagnóstico anterior registrava o e-mail/senha como desabilitado com base
  em erro observado em execução anterior (`PASSWORD_LOGIN_DISABLED` /
  `OPERATION_NOT_ALLOWED`); isso é **erro histórico**, não evidência do estado
  atual — a causa exata não foi determinada sem evidência adicional
  (hipóteses: provider desabilitado à época, configuração ainda não aplicada,
  ambiente divergente, inconsistência transitória, falha de roteamento).
- **Provider do fluxo do C.O.D.E. = E-mail/senha.** Google e Smartphone
  ativos são positivos para o projeto, mas **não substituem** o fluxo de
  signup do C.O.D.E. (o app sequer possui fluxo de telefone). Evidência
  relevante: E-mail/senha ATIVADO **+** signup real com sucesso **+** login
  real com sucesso.
- **Diagnóstico sem conclusão apressada:** `PASSWORD_LOGIN_DISABLED` /
  `OPERATION_NOT_ALLOWED` são tratados como **sinais** — a orientação é
  verificar o estado atual no Console e validar numa execução controlada.
  O C.O.D.E. **não** classifica o provider como desabilitado sem confirmação
  contemporânea (Console, API autorizada ou execução real). Erros continuam
  traduzidos em `BLOCKED` + instrução, sem expor segredo; domínio autorizado
  segue sendo verificável em *Settings → Authorized domains*.

## 4. Classificação dos resultados

| Classe | Significado |
|---|---|
| `PASS` | executou e bateu (UI × oracle × persistência) |
| `FAIL` | divergência/erro real; evidência anexada em **`afterEach`** (trace, screenshot, `console-evidencia.txt` — o corpo do anexo é embutido no relatório) |
| `BLOCKED` | **não rodou** por ambiente/credenciais/provider (ou skip sem motivo registrado) |
| `SKIPPED` | pulado intencionalmente com motivo explícito |
| `FLAKY` | falhou e passou na repetição — instabilidade a investigar |

Console: `pageerror` (exceção não tratada) ⇒ FAIL; `console.error` ⇒ evidência visível
não fatal; token/senha em log aparecem mascarados.

**Segredo e artefatos:** o projeto `setup` roda com `trace/screenshot/video: off`
(porque o trace grava o corpo da requisição de login). Toda saída do relatório
passa por `sanitizeText` (e-mail mascarado, `chave=valor` oculto, token longo
reduzido). Os artefatos do CI incluem apenas `e2e/reports/`,
`playwright-report/` e `test-results/` — **nunca** `e2e/.state/` nem `.env*`.

**Seção `QA ENVIRONMENT` do relatório:** modo da identidade, conta/UID
mascarados, "Criada pelo C.O.D.E." (SIM/NÃO), limpeza Firestore (docs), exclusão
da conta Auth (`PASS`/`SKIP-PREEXISTENTE`/`FAIL`), run id, observações e se
sobrou arquivo de identidade (run abortada).

## 5. Cobertura atual (matriz honesta)

Execução de referência: **CI run `42397573276` (07/11/2026, commit `a44c74b`) — `PASS=34 FAIL=0 BLOCKED=0 SKIPPED=0 FLAKY=0`**, gate `--strict` aprovado.

| Área | Teste | Oracle unitário | Executado em navegador |
|---|---|---|---|
| Abertura/carregamento/Visão Geral | `smoke` | — | **sim (CI)** |
| Sessão QA (login/criação) | `auth/qa.setup` | — | **sim (CI)** |
| Criar banco + entrada + saída + saldo | `movimentacoes` | `balance`, `movement`, `money` | **sim (CI)** |
| Persistência (reload + Firestore REST) | `movimentacoes` | idem | **sim (CI)** |
| Regras do Firestore em produção | `seguranca/regras-firestore` | — | **sim (CI)** |
| Segurança do C.O.D.E. (escopo, propriedade, cleanup, sanitização) | `security` (52, offline) | — | não precisa |
| Oráculos unitários | `code:oracles` (116) | — | não precisa |
| Cartões/faturas (estado da fatura, limite, pagamento) | `integracao/cartao-fatura` | `cartao-fatura`, `card` | **sim (CI)** |
| Movimentações no dashboard | `integracao/movimentacao-dashboard` | `dashboard-movimento` | **sim (CI)** |
| Caixinhas | `caixinhas` | `pocket`, `money` | **sim (CI)** |
| Metas (criação, fontes, progresso, edição, exclusão) | `metas` | `goal`, `money` | **sim (CI)** |
| Investimentos (agrupamento, CRUD, movimentações, rentabilidade, histórico) | `investimentos*` (3 specs) | `investment`, `money` | **sim (CI)** |
| Orçamentos | `orcamento` | `v20-02-budget-status` | **sim (CI)** |
| Categorias | `categorias` | — | **sim (CI)** |
| Cartões (UI) | `cartoes` | `card` | **sim (CI)** |
| Boletos/contas a pagar, valores a receber, conciliação, notificações | pendente | pendente | — |

## 6. Limitações conhecidas

1. Termux: o fluxo padrão do Playwright aborta com `Unsupported platform:
   android` (sem `npx playwright install`) — por isso `code:list` usa shim.
   O Chromium do sistema (`chromium-browser`) + spoof de plataforma já
   habilita execução local em navegador (harness `e2e/visual/audit-modais.cjs`
   e sondas), mas o caminho **validado** da suíte completa é CI/PC.
2. Reset: máximo de 20 páginas × 300 docs (6.000) por coleção; estourou ⇒ recusa
   ruidosa (nunca reset incompleto silencioso). A recusa carrega a **trilha por
   página** (contagem de docs/sinal de token, sem token nem conteúdo) e detecta
   logo na 1ª página vazia com token ou token repetido.
3. Nenhum `data-testid` novo foi criado: usamos os seletores já existentes
   mapeados em `docs/AUDITORIA-ARQUITETURA-AUTH-PERSISTENCIA.md` (zero mudança no app).
4. Oracles de caixinhas (`pocket.js`), metas (`goal.js`) e investimentos
   (`investment.js`) já existem; os de cartões serão escritos **depois** de
   auditar a semântica real (nada de inventar regra financeira).
5. **Run abortada (kill/timeout do processo):** o teardown não roda e a senha
   efêmera (só em memória) se perde — a conta Auth pode sobrar. Mitigações:
   aviso no início da run seguinte, `::warning` no CI e linha no relatório
   ("arquivo de identidade remanescente"). Remoção manual: Console →
   Authentication (exclusão à mão; o C.O.D.E. não guarda senha).
6. **Fallback manual nunca é excluído** (`SKIP-PREEXISTENTE`): correto por
   design, mas a conta declarada continua existindo no Console.
7. Erro de autenticação compatível com o provider (ex.: `PASSWORD_LOGIN_DISABLED`)
   ⇒ suítes `BLOCKED` com instrução de verificação — **sem** classificar o
   provider como desabilitado sem evidência atual. Configuração do projeto não
   é contornável por código.

## 7. Próximos passos

1. ~~Confirmar no Console que E-mail/senha segue ATIVADO~~ — **concluído**:
   signup + login reais passaram no CI (`42397573276`: `AUTH=PASS`).
2. ~~Autorizar commit/push de `feature/code-qa`~~ — **concluído**: pipeline
   `C.O.D.E. E2E` verde em `main`.
3. ~~Ler o resultado em *Actions → C.O.D.E. E2E*~~ — **concluído**:
   `PASS=34 FAIL=0 BLOCKED=0 SKIPPED=0 FLAKY=0`, relatório + `QA ENVIRONMENT` +
   evidências no artefato `code-e2e-evidencias`.
4. Novas frentes (lacunas conhecidas): boletos/contas a pagar, valores a
   receber, conciliação, notificações, spec E2E da Proteção local (PIN) e
   offline/PWA/responsividade no CI.
5. Validações visuais pendentes dos modais: tema escuro e telas estreitas
   (ver `docs/AUDITORIA-VISUAL-MODAIS.md` §10).
