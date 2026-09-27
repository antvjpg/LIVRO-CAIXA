# C.O.D.E. — FASE 0: AUDITORIA (somente leitura)

Data: 2026-09-27 · Repositório: `antvjpg/LIVRO-CAIXA` · Branch: `feature/code-qa` · HEAD `1152fbc`
Método: inspeção direta de código (nenhuma alteração no aplicativo foi feita nesta fase).

---

## 1. Arquitetura encontrada

| Camada | Achado | Onde |
|---|---|---|
| Frontend | SPA única: `index.html` (675 KB, inline JS/CSS referenciando `styles.css`) | `index.html` |
| PWA | Service Worker network-first HTML, shell precacheado | `sw.js:2` (`CACHE_NAME=livro-caixa-shell-v20-opencode1`) |
| Backend | Cloudflare Worker `livro-caixa-ai` (IA + indicadores `/financial`) | `worker/wrangler.toml`, `worker/src/index.js` |
| Indicadores | `financial-client.js` (BCB SGS + Tesouro) — única porta de entrada do FE para `/financial` | `financial-client.js:1-35` |
| Cartões | Motor próprio: `card-engine-v3-combined.js` + `card-adapter.js` | raiz |
| Build | **Não existe** — app estático servido direto (dev em `http://127.0.0.1:8000`) | `worker/wrangler.toml:10` (`ALLOW_ORIGINS` inclui `localhost:8000`) |
| Publicação | GitHub Pages `https://antvjpg.github.io` + Worker (deploy automático) | `.github/workflows/worker.yml` |

## 2. Autenticação

- Firebase Auth (compat SDK), projeto `livro-caixa-54357` — config é pública em `index.html:1361-1369`.
- **E-mail/senha**: `auth.signInWithEmailAndPassword` / `createUserWithEmailAndPassword` (`index.html:13460-13461`), ligados ao `#authSubmit`.
- **Google**: `signInWithPopup` (`index.html:13507`) — **não usado pelo C.O.D.E.** (popup + conta real).
- Modo inicial é **login**: `isSignupMode = false` (`index.html:2095`); troca via `#authToggleLink`.
- Erros traduzidos em PT-BR em `translateAuthError()` (`index.html:13400-13417`) → mensagens úteis para detectar estado: `Conta não encontrada. Crie uma conta.`, `Já existe uma conta com esse e-mail.`, `Este domínio não está autorizado no Firebase.`
- Sessão: `auth.onAuthStateChanged` (`index.html:13564`) → esconde `#authOverlay` (classe `hidden`), chama `loadState()`.
- Aparece `#userBar` com e-mail do usuário (`renderUserBar`, `index.html:13363-13367`) e `#profileEmail` (`index.html:7432`).
- Logout: `auth.signOut()` em `#btnLogout` / `#btnProfileLogout` / `#btnPinLogout`.

## 3. Persistência e isolamento de dados

- Firestore: **todo dado fica em `livrocaixa/{uid}/*`** (`index.html:2705`, `docRef()`).
- 13 subcoleções (`COLLECTIONS`, `index.html:2711`): `banks, categories, entries, investments, pockets, yieldsLog, recurringBills, receivables, budgets, goals, cards, purchases, invoiceLaunches` + `diagnostics` (`index.html:3512`).
- Escrita: `persistNow() → commitDiff()` com batch diff set/delete (`index.html:3569-3649`).
- Leitura: `onSnapshot` por coleção com cache offline (`loadState`, `index.html:3227-3270`); gate de prontidão `body.is-data-loading` removido em `index.html:3361-3362` e `#syncOverlay.hidden`.
- localStorage usado só para estado não financeiro (`theme`, `livrocaixa_sync_errors`, `lc_last_quotes`, período da view).
- **Conclusão de isolamento**: dados são particionados por `uid`. Uma conta QA dedicada isola tudo em `livrocaixa/{uid-qa}`; não há caminho de leitura/escrita cruzada entre usuários no código do cliente.
- Migração legada: documento único `livrocaixa/{uid}` com arrays (`index.html:3290+`) — existe para contas antigas; contas novas ficam só nas subcoleções.

## 4. Módulos e cálculos relevantes

| Conceito | Cálculo | Onde |
|---|---|---|
| Saldo de conta | `initial + Σ in − Σ out` | `bankBalance()` `index.html:3663-3667` |
| Patrimônio | bancos + caixinhas + investimentos (**não** usa lançamentos direto) | `renderBalances()` `index.html:3924-3949` |
| Investimentos | valor por tipo (renda fixa/crypto/mercado) | `totalInvestBalance()` `index.html:3673-3682` |
| Cartões/faturas | motor dedicado | `card-engine-v3-combined.js` |
| Estados | `currentStateSnapshot()` `index.html:3197-3199` | **não exposto em `window`** |

Selectors estáveis encontrados (usados pelo C.O.D.E., todos existentes — nenhum atributo novo foi adicionado ao app):

- Auth: `#authOverlay`, `#authTitle`, `#authEmail`, `#authPass`, `#authSubmit`, `#authError`, `#authToggleLink`, `#authGoogle`.
- Navegação: `#tabBtnDashboard` → `#viewDashboard`, `#tabBtnCaixa` → `#viewCaixa`, etc. (`index.html:156-163`).
- Carregamento: `body.is-data-loading`, `#syncOverlay`, `#userBar`, `#profileEmail`.
- Saldos: `#balanceStrip` (card `total` = Patrimônio; `.bank-summary-card` = Bancos), `#ledgerBody`, `#ledgerCount`.
- Lançamentos: `#fabAdd` (abre `#panelNovo` na aba Livro-Caixa), `#tglIn`/`#tglOut`, `#fData`, `#fDesc`, `#fBanco`, `#fCategoria`, `#fValor`, `#fSalvar` (`index.html:538-591`).
- Bancos: `.bank-summary-card` → `openBankManagementPanel()` (`index.html:11224`), `#bNome`, `#bSaldo`, `#bSalvar`.
- Modais: `#modalOverlay` + `.panel.open` (aberto por `openModal()`, `index.html:8855`).
- **Atenção**: `openNewEntryModal()` exige ≥1 banco senão abre `alert` + painel de bancos (`index.html:10446-10449`).
- **Atenção**: app usa `alert()`/`confirm()` (`index.html:11295-11301`) — Playwright descarta diálogos por padrão; o C.O.D.E. precisa **aceitá-los**.

## 5. Worker e testes existentes

- Testes do Worker: `worker/test/*.test.mjs` (6 arquivos, `node:test`, **sem rede**, executados por CI).
- CI: `.github/workflows/worker.yml` — roda `node --test worker/test/*.test.mjs` + dry-run do deploy; deploy real só em `main` com `environment: production`.
- **Não existe** `package.json` em lugar nenhum, nem config de testes frontend, nem Playwright/Cypress/Jest.

## 6. Ambiente (limitações verificadas)

| Verificação | Resultado |
|---|---|
| Node/npm | `v24.18.0` / `11.20.0` ✓ |
| Browser no Termux | **nenhum** (`pkg` sem chromium/firefox) |
| `npx playwright install chromium` | **`Unsupported platform: android`** (falhou — teste executado) |
| `npx playwright test --list` | falha igual (playwright-core rejeita `platform=android` no load) |
| Workaround local de listagem | `Object.defineProperty(process,'platform',{value:'linux'})` via `--require` faz `--list` funcionar (**só listagem, sem browser**) |
| Espaço em disco | 75 GB livres ✓ |
| `gh` CLI | ausente |

**Conclusão §38**: execução E2E real **não acontece no Termux**. Estratégia: CI GitHub Actions (Linux) + execução manual em máquina Linux/Windows do usuário. Local no Termux fica limitado a validação de sintaxe, testes unitários de oracles e listagem de specs.

## 7. Riscos e pontos de atenção

1. **Provedor e-mail/senha** — *hipótese registrada na auditoria, não é estado confirmado*: se estiver desabilitado no console Firebase, o signup falharia (`auth/operation-not-allowed`) com mensagem genérica ("Não foi possível concluir"). Estado informado no Console em 27/09/2026: **ATIVADO** (ver `e2e/README.md` §3). É passo manual documentado.
2. **Domínio autorizado**: `localhost`/`127.0.0.1` precisa estar em "Authorized domains" (padrão do Firebase já inclui localhost; se não, erro `auth/unauthorized-domain` aparece traduzido).
3. **PWA/Service Worker**: pode servir HTML antigo em execução local sobre porta já usada — mitigar com contexto novo/`storageState` limpo e porta dedicada.
4. **Estado exposto**: `banks/entries/...` **não** estão em `window` → a comparação "UI vs estado JS" exigiria injetar observabilidade no app (não feito; documentado como lacuna). Alternativa usada: UI ↔ Firestore REST ↔ oracle.
5. **Contas repetidas**: como `workers_dev` e Pages são públicos, o C.O.D.E. só grava na conta QA; reset via REST limitado ao uid autenticado.
6. Valores externos (BCB/Tesouro) são dinâmicos → asserts devem checar schema/faixa, nunca valor fixo.

## 8. Propostas desta fase

- **Ambiente**: conta QA dedicada no mesmo projeto Firebase (únicos caminhos possíveis sem trocar `firebaseConfig` = alterar o app); isolamento garantido por `livrocaixa/{uid-qa}`. Autoprovisionamento via signup/login do próprio app; identidade QA efêmera por run gerada em memória (senha nunca em arquivo/Git/Secret); fallback manual em `.env.local` gitignored.
- **Fixtures**: prefixo `CODE_TEST_*`, valores redondos (1000/250/200), determinísticas.
- **Oracles**: implementação independente (`e2e/oracles/*.js`) — aritmética própria (ex.: `initial + Σin − Σout`) sem importar código do app; validados por `node --test` localmente.
- **Selectors**: apenas IDs/seletores já existentes (lista da seção 4). Nenhum `data-testid` novo criado — nenhum foi necessário até aqui.
