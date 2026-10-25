# Livro-Caixa

[![C.O.D.E. E2E](https://github.com/antvjpg/LIVRO-CAIXA/actions/workflows/code-e2e.yml/badge.svg)](https://github.com/antvjpg/LIVRO-CAIXA/actions/workflows/code-e2e.yml)

Controle financeiro pessoal sincronizado e disponível offline. PWA completo — funciona no celular e no desktop, com ou sem conexão.

**App:** https://antvjpg.github.io

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
- **OCR com LIA** — leitura de extratos e sugestões contextuais por IA
- **Personalização** — temas claro/escuro, moedas (BRL/USD/BTC) e fontes
- **Offline-first** — PWA instalável com cache via Service Worker

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML/CSS/JavaScript vanilla (sem build) |
| Autenticação | Firebase Auth (e-mail/senha e Google) |
| Persistência | Cloud Firestore (sincronização + cache offline) |
| IA / indicadores | Cloudflare Worker [`livro-caixa-ai`](worker/) — LIA + endpoints `/financial` (BCB/Tesouro) |
| PWA | Service Worker (`sw.js`) + `manifest.webmanifest` |
| Deploy | GitHub Pages + Cloudflare Workers (CI automático) |

## Como executar

O aplicativo é estático — basta servir a raiz do repositório:

```bash
npm run code:serve          # http://127.0.0.1:8000
```

ou qualquer servidor estático (`python3 -m http.server`, `npx serve` etc.). Não há etapa de build. Para desenvolver, use uma conta de teste — o signup é feito pela própria tela de login.

> As dependências de `package.json` (`@playwright/test`) são apenas para a infraestrutura de QA descrita abaixo; o app em si não depende de npm.

## Estrutura do projeto

```
index.html            SPA única (HTML puro)
manifest.webmanifest  PWA
sw.js                 Service Worker (shell precache, network-first)
js/                   26 módulos (00-bootstrap … 33-mcp-bridge + 99-init)
  js/domain/          domínio isolado (card engine, cliente financeiro)
  js/legacy/          patches de compatibilidade
  js/data/            catálogo de emojis
style/                temas, base, layout, componentes, features, dashboard/chat
worker/               Cloudflare Worker (IA + indicadores financeiros)
e2e/                  infraestrutura de QA C.O.D.E. (ver e2e/README.md)
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
- Última execução de referência: `43 passed` (25/10/2026).
- Detalhes, cobertura e limitações: [`e2e/README.md`](e2e/README.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Regras de engenharia, segurança e manutenção do repositório |
| [`CHECKLIST_TESTES.md`](CHECKLIST_TESTES.md) | Roteiro de teste funcional das alterações implementadas |
| [`DOCUMENTACAO_VARIAVEIS_CSS.md`](DOCUMENTACAO_VARIAVEIS_CSS.md) | Variáveis CSS e como criar temas |
| [`e2e/AUDITORIA.md`](e2e/AUDITORIA.md) | Auditoria de arquitetura, auth e persistência |
| [`e2e/visual/AUDITORIA-VISUAL-MODAIS.md`](e2e/visual/AUDITORIA-VISUAL-MODAIS.md) | Auditoria visual dos modais (achados e revisões) |

## Privacidade e segurança

- Dados particionados por usuário em `livrocaixa/{uid}/*` — sem caminho de leitura/escrita cruzada no cliente.
- Nenhum segredo no repositório: a chave da API do Worker vive em *Wrangler secret*; o `firebaseConfig` é público por definição do SDK web.
- Logs e relatórios de QA passam por sanitização (e-mail mascarado, tokens ocultos).
- Não use dados financeiros reais em exemplos, fixtures ou issues.

## Licença

Uso pessoal — todos os direitos reservados (`UNLICENSED`).
