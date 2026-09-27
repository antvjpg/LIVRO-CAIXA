# C.O.D.E. — Controle Operacional de Diagnóstico e Execução

Infraestrutura de QA/E2E/auditoria do LIVRO-CAIXA. Fase própria (`feature/code-qa`):
nenhuma alteração em código de produção (`index.html`, dados persistidos ou worker).

> **Estado desta entrega:** ambiente QA autônomo (identidade efêmera por run,
> criação pela UI real, exclusão no teardown, relatório com seção
> `QA ENVIRONMENT`, zero GitHub Secret). Os testes **ainda não executaram em
> navegador real**: não existe Chromium no Termux e o CI só roda após `push`.
> Pré-condição para a validação real: fluxo E-mail/senha funcional (estado
> informado no Console em 27/09/2026: **ATIVADO** — ver §3); a confirmação
> definitiva continua sendo a execução E2E.

## 1. Organização

```
package.json               scripts code:* + devDependency @playwright/test (só dev)
playwright.config.js       setup → smoke → movimentacoes; globalSetup/globalTeardown
e2e/
  AUDITORIA.md             FASE 0 — auditoria arquivo:linha (auth, persistência, seletores)
  auth/qa.setup.js         provisiona sessão QA pela UI real e grava storageState
  smoke/smoke.spec.js      aplicação operacional + Visão Geral
  movimentacoes/           banco → entrada → saída → UI × oracle × Firestore → reload
  helpers/
    identity.js            identidade efêmera da run (gera, mascara, decide exclusão)
    cleanup.js             cleanup em 2 camadas (Firestore + Auth) → qa-summary.json
    global-setup.js        1× por run: gera e-mail/senha efêmeros (só em process.env)
    global-teardown.js     o "finally": roda sempre, nunca derruba a run
    qa-account.js          login/criação pela UI real + registro de propriedade
    firestore-rest.js      REST somente no escopo livrocaixa/{uid} + deleteOwnAccount
    env.js                 resolução de credenciais + guarda isQaEmail
    app.js, console-watch  page object e evidência de erros de console
    sanitize.js            mascarador de e-mail/senha/token para relatórios
  fixtures/fixtures.js     dados determinísticos (marcadores CODE_TEST_*)
  oracles/                 cálculo INDEPENDENTE do app + testes unitários (node:test)
  security/security.test.mjs  28 garantias auditáveis do próprio C.O.D.E.
  seeds/reset.cjs          cleanup manual de dados (só Firestore)
  seeds/cleanup.cjs        cleanup manual completo (Firestore + Auth efêmera)
  reports/generate-report.cjs  relatório + QA ENVIRONMENT (gitignored)
  scripts/list-tests.cjs   listagem de testes no Termux (shim, sem browser)
  .env.example             contrato do fallback manual (opcional)
.github/workflows/code-e2e.yml  CI sem secrets: oracles → segurança → chromium →
                                suítes → relatório → confirmação de limpeza → artefatos
```

Princípios: oracles nunca importam código do app (coincidência = evidência, não cópia);
nenhum segredo no Git nem em artefato; bloqueio aparece como `BLOCKED`, nunca some;
**a conta é da run e só a run pode excluí-la**.

## 2. Comandos

| Comando | O que faz | Roda no Termux? |
|---|---|---|
| `npm run code:oracles` | testes unitários dos oracles (sem browser) | sim |
| `npm run code:list` | descobre/lista os testes (shim de plataforma) | sim |
| `npm run code:security` | 28 garantias do próprio C.O.D.E. (offline) | sim |
| `npm run code:test` | suítes + relatório `--strict` (sai 1 se FAIL/BLOCKED) | **não** |
| `npm run code:smoke` / `code:movimentacoes` | suíte individual | **não** |
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
| `FAIL` | divergência/erro real; evidência anexada (trace, screenshot, `console-evidencia.txt`, `ui-vs-oracle.txt`) |
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

| Área | Teste | Oracle unitário | Executado em navegador |
|---|---|---|---|
| Abertura/carregamento/Visão Geral | `smoke` | — | não (CI/PC pendente) |
| Sessão QA (login/criação) | `auth/qa.setup` | — | não |
| Criar banco + entrada + saída + saldo | `movimentacoes` | `balance`, `movement`, `money` | não |
| Persistência (reload + Firestore REST) | `movimentacoes` | idem | não |
| Segurança do C.O.D.E. (escopo, propriedade, cleanup, sanitização) | `security` (28) | — | não precisa |
| Edição/exclusão de lançamentos | pendente | pendente | — |
| Caixinhas, metas, investimentos | pendente | pendente | — |
| Cartões/faturas, orçamentos, contas | pendente | pendente | — |

## 6. Limitações conhecidas

1. Termux: Playwright aborta com `Unsupported platform: android` (sem Chromium) —
   por isso `code:list` usa shim só para validação local; execução real é CI/PC.
2. Reset: máximo de 20 páginas × 300 docs (6.000) por coleção; estourou ⇒ recusa
   ruidosa (nunca reset incompleto silencioso).
3. Nenhum `data-testid` novo foi criado: usamos os seletores já existentes
   mapeados em `AUDITORIA.md` (zero mudança no app).
4. Oracles de caixinhas/metas/investimentos/cartões serão escritos **depois** de
   auditar a semântica real de cada um (nada de inventar regra financeira).
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

1. Confirmar no Console que E-mail/senha segue ATIVADO e que *Authorized
   domains* cobre o runner (estado informado: ATIVADO) — verificação manual.
2. Autorizar commit/push de `feature/code-qa`.
3. Ler o resultado em *Actions → C.O.D.E. E2E* (relatório + `QA ENVIRONMENT`
   + evidências anexados).
4. Novas fases: edição/exclusão, caixinhas/metas, cartões/faturas.
