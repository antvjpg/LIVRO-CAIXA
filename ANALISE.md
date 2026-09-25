# Análise Técnica — LIVRO-CAIXA

> Análise somente leitura. Nenhum arquivo de código foi alterado.

---

## 1. Estrutura geral do projeto

Aplicação **estática/PWA** (sem `package.json`, sem build, sem node_modules). Arquivos na raiz:

| Arquivo | Papel |
|---|---|
| `index.html` (~11.168 linhas, ~565 KB) | Aplicação inteira: HTML + CSS inline + JS embutido |
| `styles.css` (~293 KB) | Estilos globais |
| `card-engine-v3.js` (~1.046 linhas) | Motor de cálculo de cartão de crédito (biblioteca pura) |
| `sw.js` | Service Worker (offline/cache PWA) |
| `manifest.webmanifest` | Manifest do PWA |
| `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | Ícones |
| Vários `*.backup-*` / `*.bak-*` | Backups manuais históricos (não são parte da runtime) |
| `backup-card-engine-legacy-20260923-110303/` | Pasta de backup legado |
| `.git/`, `.gitignore` | Controle de versão |

O `index.html` está organizado em **10 blocos lógicos** comentados (`[JS 01]` a `[JS 10]`):

- **[JS 01]** Config/Firebase bootstrap
- **[JS 02]** Estado global / coleções
- **[JS 03]** Utilitários/DOM/formatação
- **[JS 04]** Domínio financeiro/cálculos
- **[JS 05]** Autenticação/sessão
- **[JS 06]** Firebase/sincronização/migrações
- **[JS 07]** Backup/import/export/diagnóstico
- **[JS 08]** Renderização/views
- **[JS 09]** Eventos/interações/modais
- **[JS 10]** Inicialização/bootstrap

Quase toda a lógica (~398 funções) está em **um único `<script>` inline** (linhas 1339–10916), mais alguns blocos avulsos no final (App Check + Firebase AI, patch de navegação de Metas).

---

## 2. Framework e principais tecnologias

**Framework: nenhum** — SPA vanilla (HTML + CSS + JavaScript sem React/Vue/Angular).

Tecnologias e bibliotecas (carregadas por CDN no `<head>`):

| Tecnologia | Versão | Uso |
|---|---|---|
| Firebase (compat) | 10.12.2 | Auth + Firestore (app, auth, firestore) |
| Firebase (modular) | 12.19.0 | App Check (ReCaptcha Enterprise) + Firebase AI |
| Google Gemini (via Firebase AI) | modelo `gemini-3.7-flash` | Recursos de IA |
| jsPDF | 2.5.1 | Exportação PDF |
| pdf.js | 3.11.174 | Importação/leitura de PDF |
| SheetJS (XLSX) | 0.18.5 | Exportação/importação Excel |
| docx | 8.5.0 | Exportação Word |
| mammoth | 1.8.0 | Importação Word |
| Chart.js | (latest CDN) | Gráficos |
| Google Fonts — Plus Jakarta Sans | — | Tipografia |
| Flaticon Uicons | 3.0.0 | Ícones |
| API CoinGecko | v3 | Cotações de cripto |
| PWA | — | `manifest.webmanifest` + `sw.js` |

---

## 3. Onde os dados financeiros são armazenados

**Fonte de verdade: Cloud Firestore**, no path:

```
livrocaixa/{uid}/{coleção}/{docId}
```

13 coleções definidas em `COLLECTIONS` (`index.html:2294`):

```js
['banks', 'categories', 'entries', 'investments', 'pockets', 'yieldsLog',
 'recurringBills', 'receivables', 'budgets', 'goals', 'cards', 'purchases',
 'invoiceLaunches']
```

- **Leitura:** `loadState()` assina `onSnapshot` em cada coleção (tempo real) com persistência offline habilitada (`enablePersistence`).
- **Escrita:** `persistNow()` → `commitDiff()` grava apenas **diffs** (JSON.stringify comparison) em `db.batch()` (máx. 400 ops por batch).
- **Race control:** `snapshotBuffer` descarta snapshots recebidos enquanto `pendingSaveCount > 0`.
- **Migração:** formato legado (documento único) → subcoleções automaticamente na primeira carga vazia.

**localStorage** guarda apenas preferências/auxiliares — **não** os dados financeiros principais:

- período visível, tema claro/escuro, alertas de orçamento
- logs/diagnóstico de sincronização, config de features ("LABS")
- oclusão de saldos, cache de cotações (`lc_last_quotes`)
- **PIN local** (hash SHA-256) e credencial WebAuthn/biometria

---

## 4. Como a autenticação está implementada

**Firebase Authentication** (SDK compat 10.12.2):

- **E-mail/senha:** `auth.createUserWithEmailAndPassword` / `signInWithEmailAndPassword` (`index.html:10772–10773`)
- **Google:** `auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())` (`index.html:10806–10819`)
- **Ciclo de sessão:** `auth.onAuthStateChanged` (`index.html:10870`) — no login: esconde `authOverlay`, inicia segurança de sessão, chama `loadState()`; no logout: zera todos os arrays em memória, cancela listeners `onSnapshot`, limpa memória da sessão.
- **Camada local adicional (lock de UI):**
  - **PIN** de 4–8 dígitos (hash em localStorage) com overlay `pinOverlay`
  - **Biometria/WebAuthn** opcional (credencial em localStorage)
  - **Auto-lock por inatividade** (`startSessionSecurity`, `lockSessionForInactivity`)
- **App Check:** ReCaptchaEnterpriseProvider configurado em script `type="module"` (Firebase 12.19.0), com `FIREBASE_APPCHECK_DEBUG_TOKEN` presente no HTML (limitado a localhost).
- **Diagnóstico de login:** console embutido na tela de auth (`authDiagnosticPanel`, `loginDebugLog`).

Obs.: as Security Rules do Firestore não estão neste repositório — a proteção real dos dados depende delas.

---

## 5. Como as telas/abas principais estão organizadas

SPA de abas via `switchTab(nome)` + views `.tab-content`:

| Aba (`switchTab`) | View | Conteúdo |
|---|---|---|
| `dashboard` | `viewDashboard` | Visão geral |
| `caixa` | `viewCaixa` | Livro-Caixa (ativa por padrão) |
| `pockets` | `viewPockets` | Caixinhas |
| `cards` | `viewCards` | Cartões/faturas |
| `receivables` | `viewReceivables` | A receber |
| `invest` | `viewInvest` | Investimentos |
| `goals` | `viewGoals` | Metas |
| `bills` | `viewBills` | Contas & Calendário (acessível pelo drawer lateral) |
| `profile` | `viewProfile` | Perfil/configurações |

Elementos de navegação:

- **Desktop/topo:** `.nav-tabs` com botões `onclick="switchTab('...')"`
- **Mobile:** `.mobile-bottom-nav` com `data-destination` + indicador animado (`updateNavIndicator`)
- **Drawer lateral:** ações `data-drawer-action` (inclui `bills`, `pockets`, `goals`, `investments`)
- **Overlays:** `authOverlay` (login), `pinOverlay` (PIN), `syncOverlay` (carregando), drawer de notificações

**Navegação em camadas:** `switchTabOriginal` (definida ~linha 2242) + **wrapper/patch** redefinindo `window.switchTab` no script final (~11049) para isolar a aba Metas — ordem de carregamento dos scripts é crítica.

---

## 6. Onde estão contas, investimentos, caixinhas e metas

| Funcionalidade | View/aba | Funções principais (index.html) | Dados (Firestore) |
|---|---|---|---|
| **Contas (recorrentes/calendário)** | `viewBills` | `renderBills` (~6809), `billsExportRows`, `exportBillsXlsx/Pdf`, `budgetFor`, `budgetSpent`, `financialCycle*` | `recurringBills`, `budgets` |
| **Investimentos** | `viewInvest` | `renderInvestments` (~3991), `cryptoValueFromUnits`, `syncDerivedCryptoValue`, `rentabilityHTML`, `renderPriceCharts`, cotações CoinGecko (~9030) | `investments`, `yieldsLog` |
| **Caixinhas** | `viewPockets` | `renderPockets` (~4066), `renderPocketBalances`, `pocketCurrentBalance`, `pocketMovementTotal`, `normalizePockets` | `pockets` |
| **Metas** | `viewGoals` | `renderGoalsList` (~4834), `goalMarkup`, `goalCurrentAmount`, `normalizeGoals`, `normalizeAllGoalStatuses`, `refreshGoalCaixinhaOptions` | `goals` |

Notas:

- **Metas** estão ligadas às **Caixinhas** (fonte de dinheiro) — "sem criar saldo paralelo".
- **Cartões** ficam em `viewCards` com `renderCards` (~8265) + `card-engine-v3.js`.
- **Contas & Calendário** é acessada pelo drawer (não pela nav principal de abas).

---

## 7. Principais arquivos responsáveis pela lógica

| Arquivo | Responsabilidade |
|---|---|
| **`index.html`** | Toda a aplicação: estado, auth, sync Firestore, regras financeiras, render, eventos, export/import, PWA bootstrap (~398 funções) |
| **`card-engine-v3.js`** | Motor de cartão de crédito: períodos, parcelas, faturas, pagamentos por titular, limite comprometido, validações, auditoria de órfãos — biblioteca pura UMD (`LivroCaixaCardEngineV3`), zero dependências |
| **`sw.js`** | Cache/offline (Service Worker) |
| **`styles.css`** | Todo o visual/temas |
| **`manifest.webmanifest`** | Metadados PWA |

Dentro do `index.html`, os pontos mais críticos:

- `COLLECTIONS` / `setStateArray` / `getStateArray` / `currentStateSnapshot` — modelo de dados
- `loadState` / `persistNow` / `commitDiff` — sincronização
- `auth.onAuthStateChanged` — ciclo de vida da sessão
- `switchTab` (+ patch de Metas) — navegação
- `render*` — renderização das views
- `buildBackupPayload` / `sanitizeBackupData` — importação de backup

---

## 8. Pontos de atenção / riscos técnicos

1. **God-file:** ~11k linhas / ~400 funções num único script, sem bundler/módulos/testes — blast radius amplo em qualquer edição.
2. **Estado global compartilhado:** 13 arrays mutáveis acessados por sync + render + eventos, sem store tipada ou imutabilidade.
3. **Diff por `JSON.stringify`** no `commitDiff` — sensível a ordem de chavras/serialização; pode gerar escritas desnecessárias ou diffs perdidos.
4. **Camada de patches de navegação:** `switchTabOriginal` + wrapper no script final + reforços de `data-active`/`data-tab` — ordem de scripts crítica; regressões de aba prováveis.
5. **Dependência de CDNs** (Firebase, jsPDF, XLSX, Chart.js…) sem fallback global (o card engine tem guards pontuais); quebra parcial offline se o SW não cachear tudo.
6. **Versões Firebase mistas:** 10.12.2 (compat) para Auth/Firestore e 12.19.0 (modular) para App Check/AI no mesmo app.
7. **Segurança:** config Firebase e site key do ReCaptcha hardcoded no HTML; PIN/WebAuthn são lock de UI local (não protegem dados — dependem das Security Rules do Firestore, fora do repo); `FIREBASE_APPCHECK_DEBUG_TOKEN` presente no código.
8. **Re-render completo** (`render()`) a cada snapshot — risco de performance com bases grandes; handlers `onclick=` inline e drag-and-drop espalhados.
9. **Concorrência de sessão:** `loadGeneration` + checagens de `currentUser` por todo o load são corretas, mas frágeis a mudanças; logout zia arrays manualmente em vários pontos.
10. **Import/backup** (`sanitizeBackupData`) é caminho de entrada de dados externos — superfície crítica a validar a cada mudança de schema.
11. **Mistura de responsabilidades** no mesmo escopo: export PDF, regras de metas, cripto e sync convivem no mesmo script.
12. **Backups manuais na raiz** (`*.backup-*`, `*.bak-*`) poluem o diretório e podem confundir deploys se forem servidos.

---

## Resumo da arquitetura

**Livro-Caixa** é um **PWA monolítico client-side** (HTML/CSS/JS vanilla, sem framework):

- **UI:** SPA de abas (`switchTab` + `.tab-content`), drawer mobile, modais; estilos em `styles.css` separado.
- **Domínio:** lógica de cartão isolada em `card-engine-v3.js` (biblioteca pura UMD, sem dependências); demais regras financeiras embutidas no script do `index.html`.
- **Estado:** memória global (13 coleções) sincronizada em **tempo real com Firebase Firestore** (`livrocaixa/{uid}/...`) via `onSnapshot` + gravação por **diff em batches**.
- **Auth:** Firebase Auth (e-mail/senha + Google), overlay de login, lock local por PIN/WebAuthn, auto-lock por inatividade, App Check.
- **Local:** localStorage apenas para prefs, PIN, logs e cache; offline via Firestore persistence + Service Worker.
- **Extras:** export/import (PDF/XLSX/DOCX), gráficos (Chart.js), cotações cripto (CoinGecko), IA (Firebase AI/Gemini).

Em essência: **camada única de apresentação + estado + persistência acopladas num arquivo HTML**, com o módulo de cartão como única extração bem-sucedida — modelo funcional, porém de alto risco para evolução sem refatoração progressiva (extrair store, sync e demais domínios para módulos separados).
