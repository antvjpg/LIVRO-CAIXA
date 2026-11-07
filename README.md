# Livro-Caixa

[![C.O.D.E. E2E](https://github.com/antvjpg/LIVRO-CAIXA/actions/workflows/code-e2e.yml/badge.svg)](https://github.com/antvjpg/LIVRO-CAIXA/actions/workflows/code-e2e.yml)

Controle financeiro pessoal sincronizado e disponível offline. PWA completo — funciona no celular e no desktop, com ou sem conexão.

**App:** https://antvjpg.github.io/LIVRO-CAIXA/

## Sobre

O Livro-Caixa é uma aplicação financeira pessoal em forma de SPA/PWA, construída com HTML, CSS e JavaScript puros — **sem build, sem framework**. Os dados de cada usuário ficam isolados no Firestore (`livrocaixa/{uid}/*`) e sincronizam automaticamente; o Service Worker mantém o shell disponível offline.

## Recursos

- **Contas e bancos** — saldos, patrimônio e conciliação bancária
- **Lançamentos** — entradas, saídas, recorrências e transferências
- **Cartões e faturas** — motor próprio de parcelamento e fechamento de fatura
- **Caixinhas e metas** — reservas com progresso, aportes e integração entre si
- **Investimentos** — renda fixa, cripto e mercado, com rentabilidade e histórico
- **Orçamentos** — limites por categoria com barra de progresso e alertas
- **Contas a receber e boletos** — controle de valores a vencer e pagamentos
- **Importação/exportação** — extratos, backups e transferência de dados
- **Personalização** — temas claro/escuro, moedas (BRL/USD/BTC) e fontes
- **Offline-first** — PWA instalável com cache via Service Worker

### Funcionalidades em detalhe

- **Cartões** (`js/27-cards.js`, domínio em `js/domain/card-engine-v3-combined.js`): titulares, limites, fatura mensal com corte, parcelas e pagamento da fatura; oráculos de limite e fatura em `e2e/oracles/card.js` / `cartao-fatura.js`.
- **Investimentos** (`js/29-invest-movements.js`, `js/18-render-core.js`): quatro tipos (renda fixa, cripto, mercado e outros), agrupamento por instituição (expansível/colapsável), rentabilidade positiva/negativa/zero, movimentações com/sema quantidade, histórico auditável anterior → posterior e deduplicação de documentos de rendimento; verificação tripla UI × oráculo (`e2e/oracles/investment.js`) × Firestore REST.
- **Metas e caixinhas** (`js/19-goals.js`): progresso derivado da fonte de verdade (aporte ou vínculo com caixinha/investimento), sem valores duplicados armazenados; vínculo entre caixinha e meta sem fundir os conceitos.
- **Boletos e recebíveis** (`js/25-bills-receivables.js`, `js/26-receipts.js`): vencimentos, pagamentos, valores a receber e comprovantes.
- **Transferências e recibos** (`js/30-transfer-receipts.js`), **backup e importação/exportação** (`js/13-backup.js`, `js/31-import-export.js`), **automação** (`js/24-automation-render.js`) e **indicadores no perfil** (`js/21-ai-features.js`, `js/22-profile.js` — categorização, anomalias, revisão mensal e juros compostos, sem serviço de IA externo).
- **Proteção local** (`js/domain/pin-protection.js`, `js/domain/secure-storage.js`): PIN fail-closed (registro corrompido nunca libera o app), isolamento por UID, grace period por conta, foco/inert/trap no modal e biometria WebAuthn como conveniência local; `evaluateLock()` decide o bloqueio com auth e preferências resolvidos.
- **Sincronização** (`js/17-sync-persistence.js`): `commitDiff()` diferencial por coleção (set/delete), `persistNow()` com pendências rastreadas, `snapshotBuffer` para writes concorrentes e listeners em tempo real; dados particionados em `livrocaixa/{uid}/*`.

> Nota: o assistente conversacional LIA, o OCR assistido e a integração MCP foram removidos do projeto em novembro de 2026; o modal de chat no HTML é apenas estrutura visual sem funcionalidade.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML/CSS/JavaScript vanilla (sem build) |
| Autenticação | Firebase Auth (e-mail/senha e Google) |
| Persistência | Cloud Firestore (sincronização + cache offline) |
| Gateway financeiro | Cloudflare Worker [`livro-caixa-ai`](worker/) — endpoint `/financial` (BCB/Tesouro, rate limit próprio) |
| PWA | Service Worker (`sw.js`) + `manifest.webmanifest` |
| Deploy | GitHub Pages + Cloudflare Workers (CI automático) |

### Arquitetura do frontend

Sem build: o `index.html` é HTML puro e o JS vive em módulos carregados em ordem:

```
js/00-bootstrap.js        utilitários e inicialização
js/10-state-utils.js      estado e utilidades
js/11-financial-domain.js domínio financeiro (agrupamento, formatação)
js/12-auth-session.js     sessão e estado de auth
js/13-backup.js           backup/importação
js/14-theme.js            temas
js/15-tabs-nav.js         navegação
js/16-events-modals.js    modais e eventos
js/17-sync-persistence.js Firestore, listeners e sincronização
js/18-render-core.js      renderização principal (investimentos, PIN)
js/19-goals.js            metas e caixinhas
js/20-dashboard.js        dashboard e indicadores
js/21-ai-features.js      categorização, anomalias, juros compostos
js/22-profile.js          perfil e snapshot financeiro
js/24-automation-render.js automações
js/25-bills-receivables.js boletos e contas a receber
js/26-receipts.js         recibos/comprovantes
js/27-cards.js            cartões e faturas
js/29-invest-movements.js movimentações de investimento
js/30-transfer-receipts.js transferências
js/31-import-export.js    importação/exportação
js/32-auth-wiring.js      wiring do login
js/99-init.js             dispatcher de DOMContentLoaded
js/domain/                card engine, cliente financeiro, PIN, storage seguro, logs
js/legacy/patches.js      remendos de compatibilidade
js/data/emoji-catalog.js  catálogo de emojis
```

## Como executar

O aplicativo é estático — basta servir a raiz do repositório:

```bash
npm run code:serve          # http://127.0.0.1:8000
```

ou qualquer servidor estático (`python3 -m http.server`, `npx serve` etc.). Não há etapa de build. Para desenvolver, use uma conta de teste — o signup é feito pela própria tela de login.

> As dependências de `package.json` (`@playwright/test`) são apenas para a infraestrutura de QA descrita abaixo; o app em si não depende de npm.

### Pré-requisitos para QA local no Android (Termux)

O Playwright não roda no Android (`Unsupported platform: android`); em Termux, usar Chromium headless + CDP para auditoria visual. E2E completo roda no CI (Ubuntu) — ver abaixo.

## Estrutura do projeto

```
index.html            SPA única (HTML puro)
manifest.webmanifest  PWA
sw.js                 Service Worker (shell precache, network-first)
js/                   módulos 00-bootstrap … 32-auth-wiring + 99-init
  js/domain/          card engine, cliente financeiro, PIN, storage seguro, logs
  js/legacy/          patches de compatibilidade
  js/data/            catálogo de emojis
style/                temas, base, layout, componentes, features, dashboard/chat
worker/               Cloudflare Worker (gateway financeiro: BCB/Tesouro)
  worker/src/financial/   gateway /financial (BCB, Tesouro)
  worker/src/push/        push
  worker/src/shared/      compartilhados
  worker/test/            testes do Worker (node --test)
e2e/                  infraestrutura de QA C.O.D.E. (ver e2e/README.md)
  e2e/helpers/        identidade QA, Firestore REST, sanitize, console watch
  e2e/fixtures/       dados de referência (metas, investimento, caixinhas…)
  e2e/oracles/        modelos de referência independentes + testes unitários
  e2e/reports/        relatório C.O.D.E. (generate-report.cjs, history.jsonl)
  e2e/visual/         auditoria visual dos modais (harness local)
.github/workflows/    CI: E2E, Pages, Worker, alertas
```

## QA e testes (C.O.D.E.)

O repositório possui uma infraestrutura de testes E2E própria — **C.O.D.E.** (Controle Operacional de Diagnóstico e Execução):

```bash
npm ci
npm run code:syntax    # sintaxe dos módulos
npm run code:oracles   # testes unitários dos oráculos (sem browser)
npm run code:security  # garantias de segurança do próprio QA
npm run code:test      # suítes E2E completas (requer Chromium)
```

- Roda no CI a cada push (workflow `C.O.D.E. E2E`) com identidade QA efêmera — **zero secrets**, conta criada e excluída por run.
- Suítes: smoke/auth, movimentações, investimentos (agrupamento, CRUD serial, persistência no Firestore), metas, caixinhas, cartões, orçamento, categorias, integrações (cartão-fatura, movimentação-dashboard) e regras de segurança do Firestore — **14 arquivos `.spec.js`, ~34 testes**.
- O relatório C.O.D.E. (`e2e/reports/generate-report.cjs`) mostra PASS/FAIL/BLOCKED/SKIPPED/FLAKY, resumo por suíte, top 10 mais lentos e histórico persistente de runs; o gate `--strict` reprova a run se houver qualquer FAIL, BLOCKED ou FLAKY.
- Testes usam oráculos independentes (`e2e/oracles/`): os valores esperados são calculados por modelos de referência, não pela mesma função de produção — divergência entre UI, oráculo e Firestore é falha real.
- Última execução de referência: `34 passed` (07/11/2026) — run `42397573276`, PASS=34 FAIL=0 BLOCKED=0 FLAKY=0, gate `--strict`.
- Detalhes, cobertura e limitações: [`e2e/README.md`](e2e/README.md).

### Cobertura atual e lacunas conhecidas

Exigência de qualidade: sinal verde de CI não substitui cobertura de ponta a ponta. Lacunas já documentadas (não cobertas pela suíte de 34 testes):

- Boletos/contas a pagar, valores a receber, conciliação e notificações — sem spec E2E dedicado.
- Proteção local (PIN) — sem spec E2E que falhe se o fail-closed regredir.
- Service Worker/offline, PWA e responsividade mobile — fora do gate estrito do CI (auditoria visual manual via Chromium headless + CDP).

## Documentação

| Documento | Conteúdo |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Regras de engenharia, segurança e manutenção do repositório |
| [`e2e/README.md`](e2e/README.md) | C.O.D.E.: organização, comandos, identidade QA, classificação de resultados e matriz de cobertura |
| [`docs/DOCUMENTACAO_VARIAVEIS_CSS.md`](docs/DOCUMENTACAO_VARIAVEIS_CSS.md) | Variáveis CSS e como criar temas |
| [`e2e/AUDITORIA.md`](e2e/AUDITORIA.md) | Auditoria de arquitetura, auth e persistência |
| [`e2e/visual/AUDITORIA-VISUAL-MODAIS.md`](e2e/visual/AUDITORIA-VISUAL-MODAIS.md) | Auditoria visual dos modais (achados e revisões; histórico de outubro/2026) |
| [`docs/COBERTURA-MATRIZ.md`](docs/COBERTURA-MATRIZ.md) | Matriz de fluxos financeiros (histórico das fases do LOG; localidades desatualizadas) |
| [`docs/AUTHOVERLAY-EVOLUCAO-VISUAL.md`](docs/AUTHOVERLAY-EVOLUCAO-VISUAL.md) | Entrega visual do AuthOverlay (histórico, 03/11/2026) |
| [`docs/REFATORACAO-AUTENTICACAO-RELATORIO.md`](docs/REFATORACAO-AUTENTICACAO-RELATORIO.md) | Relatório da refatoração de autenticação (histórico) |
| [`docs/AUDITORIA-IA-RESUMO.md`, `AUDITORIA-GROQ-EXCLUSIVA.md`, `CORRECOES-GROQ-EXCLUSIVO.md`](docs/) | Auditorias do período da IA/Groq (histórico — removidos em nov/2026) |
| [`.opencode/skills/auditoria/SKILL.md`](.opencode/skills/auditoria/SKILL.md) | Skill de auditoria técnica cruzada — arquitetura, regras financeiras, C.O.D.E., E2E, Worker, Firebase, PWA + auditoria cruzada |
| [`.opencode/skills/performance/SKILL.md`](.opencode/skills/performance/SKILL.md) | Skill de desempenho — diagnóstico de gargalos, processo de medição e otimização segura, integração com auditoria |

## Privacidade e segurança

- Dados particionados por usuário em `livrocaixa/{uid}/*` — sem caminho de leitura/escrita cruzada no cliente.
- Nenhum segredo no repositório: a chave da API do Worker vive em *Wrangler secret*; o `firebaseConfig` é público por definição do SDK web.
- Logs e relatórios de QA passam por sanitização (e-mail mascarado, tokens ocultos).
- Não use dados financeiros reais em exemplos, fixtures ou issues.
- Proteção local fail-closed: PIN corrompido, ilegível ou com erro de storage nunca autoriza a abertura do aplicativo; tolerância de sessão e credenciais são isoladas por conta.

## Licença

Uso pessoal — todos os direitos reservados (`UNLICENSED`).
