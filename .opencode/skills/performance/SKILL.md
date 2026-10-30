---
name: performance
description: "Skill especializada em desempenho e otimização para o LIVRO-CAIXA. Identifica gargalos, mede impacto, orienta otimizações seguras e colabora com a skill de auditoria. Somente diagnóstico e orientação: não implementa otimizações sem autorização explícita."
---

# Skill: performance

Skill de desenvolvimento para otimização de desempenho do LIVRO-CAIXA, especializada na arquitetura real do projeto. Complementar à skill de auditoria: a auditoria identifica suspeitas, esta skill investiga a fundo, mede e orienta correções.

## 1. Quando usar

Use quando:

- A skill de auditoria encaminhar suspeitas de gargalo de desempenho;
- Identificar lentidão na renderização de telas (dashboard, cards, fatura, investimentos);
- Precisar otimizar loops sobre grandes volumes de lançamentos;
- Querer evitar regressões de performance ao alterar JS/CSS;
- Precisar medir/profiling de funções críticas.

Não use para substituir a skill de auditoria. Esta skill não faz diagnóstico cruzado, não avalia integridade financeira e não classifica severidade de defeitos fora do escopo de desempenho.

---

## 2. Classificação do conhecimento

### A. Conhecimento estrutural (permanente)

Pode permanecer documentado:

- Arquitetura SPA/PWA do LIVRO-CAIXA: HTML puro (`index.html`) + módulos JS (`js/00-bootstrap.js` … `js/33-mcp-bridge.js`, `js/99-init.js`) + CSS (`style/*.css`) + Service Worker (`sw.js`);
- Backend: Cloudflare Worker (`worker/`) + Firebase (Auth, Firestore, Messaging, App Check);
- QA: C.O.D.E. (`e2e/`, `worker/test/`, `.github/workflows/`);
- Módulos de domínio: `js/domain/` (card-engine, financial-client, ai-chat-contract, mcp-financial-contract, chat-persistence);
- Regras financeiras que não podem ser alteradas por otimizações (saldos, parcelas, faturas, limites, rentabilidade);
- Princípios de segurança (isolamento por UID, App Check, CORS, rate limit).

### B. Pontos de referência (caminhos iniciais, verificar sempre)

São caminhos de investigação, não inventário definitivo. Sempre verificar se existem e se suas responsabilidades mudaram:

- `js/99-init.js` — dispatcher de inicialização (`DOMContentLoaded`);
- `js/18-render-core.js` — renderização núcleo;
- `js/20-dashboard.js` — dashboard principal;
- `js/domain/card-engine-v3-combined.js` — motor de cartões (domínio);
- `js/27-cards.js` — cartões / faturas;
- `js/25-bills-receivables.js` — contas a receber;
- `js/31-import-export.js` — import/export;
- `js/28-ocr-lia.js` — OCR / LIA;
- `js/21-ai-features.js` — funcionalidades de IA;
- `js/23-ai-chat.js` — chat de IA;
- `js/17-sync-persistence.js` — sincronização e persistência;
- `style/features.css` — CSS de funcionalidades (arquivo grande);
- `style/layout.css` — CSS de layout;
- `sw.js` — Service Worker;
- `manifest.webmanifest` — manifesto PWA;
- `index.html` — HTML shell da aplicação;
- `worker/src/` — Cloudflare Worker (ai, financial, mcp, push, shared);
- `worker/test/` — testes do Worker;
- `.github/workflows/` — CI/CD;
- `e2e/` — testes E2E e oráculos;
- `AGENTS.md` — regras de precedência do projeto.

### C. Informações dinâmicas (nunca como valores fixos)

Nunca depender de valores fixos quando eles podem mudar. Descobrir no repositório durante a execução:

- Quantidade de arquivos e linhas (ex: contagens de `js/99-init.js`, `js/18-render-core.js` são exemplos ilustrativos, não critérios de aprovação);
- Versões de cache (`CACHE_NAME` em `sw.js`);
- Nomes e quantidades de endpoints do Worker;
- Quantidade de subcoleções do Firestore;
- Versões de dependências (`package.json`);
- Estrutura atual de diretórios;
- Configurações de ambiente;
- Nomes de funções e contratos que podem ter sido alterados.

**Regra:** exemplos documentados não devem ser confundidos com o estado atual do projeto. Quando um dado variável for necessário, descobri-lo no repositório no momento da execução.

---

## 3. Conhecimento técnico específico do LIVRO-CAIXA

### 3.1 Complexidade algorítmica e operações repetidas

Investigar:

- Loops sobre listas de lançamentos (entradas, saídas, transferências);
- Ordenações de transações por data;
- Filtros sobre grandes volumes de dados;
- Cálculos financeiros repetidos em cada renderização (saldos, patrimônio, totais de fatura);
- Motor de cartões (`card-engine-v3-combined.js`) — parcelamento, fechamento, vencimento, pagamento;
- Cálculo de rentabilidade de investimentos;
- Agregações do dashboard (bancos + caixinhas + investimentos).

### 3.2 Renderização e DOM

Investigar:

- Re-renderização completa de listas/tabelas a cada mudança pequena (usar atualização incremental quando possível);
- `querySelector`/`getElementById` dentro de loops frequentes (cachear referências DOM fora do loop);
- Manipulação de grandes listas e tabelas no dashboard e extrato;
- Atualizações desnecessárias do DOM após reload ou sincronização;
- Modais e drawers (abertura/fechamento, limpeza de estado).

### 3.3 Event listeners

Investigar:

- Listeners duplicados (adicionar sem remover o anterior, especialmente em modais e tabs);
- Listeners sem limpeza (não removidos ao destruir componente ou mudar de aba);
- `onAuthStateChanged` — **não remover nem alterar** (crítico para autenticação);
- Listeners de scroll, resize, input sem debounce/throttle.

### 3.4 Estado e persistência

Investigar:

- Leitura repetida de `localStorage`/`IndexedDB` em loops (cachear em variável local);
- Estado em memória crescendo sem limpeza;
- Leituras e escritas no Firestore (listeners `onSnapshot`, batches, `commitDiff`);
- Sincronização cliente↔Firestore (dados desatualizados, sobrescritas, perda de atualização);
- Cache offline e recuperação de conexão.

### 3.5 Worker e APIs externas

Investigar:

- Chamadas ao Cloudflare Worker (`/ai`, `/financial`, `/mcp`, `/bridge/snapshot`, `/bridge/token`);
- Latência de APIs externas (OpenRouter, BCB SGS, Tesouro Nacional);
- Cache de indicadores financeiros (TTL, backoff após falha);
- Rate limit por usuário/IP no Worker;
- Tamanho de payload (snapshot até 64 KB, token até 8 KB).

### 3.6 Carregamento inicial e PWA

Investigar:

- Service Worker (`sw.js`) — estratégia network-first, APP_SHELL, cache versionado;
- Recursos fora do precache (módulo OCR e outros);
- Arquivos obsoletos no cache (versões antigas);
- Atualização interrompida do SW;
- CSS grande (`style/features.css`, `style/layout.css`) — impacto no render inicial;
- Imagens/assets (`icon-192.png`, `icon-512.png`, `ocr/`).

### 3.7 Concorrência e assíncrono

Investigar:

- Debounce/throttle em inputs de busca e scroll;
- Operações assíncronas em paralelo vs. sequencial;
- Promises pendentes sem tratamento de erro;
- Race conditions entre sincronização e renderização.

---

## 4. Processo obrigatório de otimização

Toda investigação de performance deve seguir este ciclo:

1. **Identificar**: localizar o fluxo ou componente suspeito (usando pontos de referência da seção 2.B).
2. **Medir**: estabelecer uma referência antes de qualquer alteração (`console.time`, `performance.now`, profiling do navegador).
3. **Diagnosticar**: demonstrar a causa ou apresentar evidências suficientes no código.
4. **Planejar**: propor a menor alteração capaz de resolver o problema.
5. **Preservar**: identificar regras financeiras, contratos e comportamentos que não podem mudar (saldos, parcelas, faturas, limites, isolamento por UID, App Check).
6. **Implementar**: somente quando houver autorização explícita do usuário.
7. **Validar**: executar testes funcionais, financeiros e técnicos pertinentes (`npm run code:syntax`, `npm run code:test`, testes de oráculo).
8. **Comparar**: medir novamente nas mesmas condições da referência.
9. **Documentar**: registrar resultados, limitações e possíveis regressões.

Não classificar código como lento apenas por aparência ou complexidade visual.

Não propor otimizações especulativas como se fossem problemas comprovados.

---

## 5. Contrato de integração com a skill de auditoria

### 5.1 Auditoria → Performance

A skill de auditoria pode:

- Identificar suspeitas de gargalos de desempenho;
- Registrar evidências e contexto no relatório de auditoria;
- Classificar impacto e prioridade (severidade e confiança);
- Solicitar investigação especializada à skill de performance.

### 5.2 Performance → Auditoria

A skill de performance deve:

- Consultar a auditoria quando uma otimização envolver regras financeiras, integridade, segurança ou fluxos interdependentes;
- Considerar os oráculos e testes independentes do C.O.D.E.;
- Validar que uma melhoria de desempenho não alterou resultados financeiros;
- Registrar riscos de regressão e limitações de cobertura.

### 5.3 Limites de responsabilidade

- **Auditoria**: diagnóstico, investigação e recomendações.
- **Performance**: diagnóstico aprofundado, medição e orientação de otimizações.
- **Implementação**: somente mediante autorização explícita do usuário.
- **C.O.D.E.**: infraestrutura de validação e evidências, não substituto das metodologias das skills.

As duas skills não devem duplicar integralmente o conteúdo uma da outra.

---

## 6. Checklist de otimização

- [ ] Funções críticas executam em < 16ms (60fps) — medir, não presumir;
- [ ] Nenhum loop aninhado desnecessário sobre lançamentos;
- [ ] Referências DOM cacheadas fora de loops;
- [ ] Event listeners não duplicados (especialmente em modais e tabs);
- [ ] Debounce/throttle em inputs de busca e scroll;
- [ ] Imagens/assets otimizadas (ícones em `icon-*.png`);
- [ ] Service Worker (`sw.js`) não bloqueia navegação;
- [ ] Build/testes passam: `npm run code:syntax` e `npm run code:test`;
- [ ] Oráculos do C.O.D.E. continuam aprovados após a alteração;
- [ ] Resultados financeiros inalterados (saldos, parcelas, faturas, patrimônio).

---

## 7. Comandos de validação

```bash
# Sintaxe dos JS alterados
node --check js/<arquivo>.js

# Testes E2E + oracles
npm run code:test

# Apenas sintaxe do projeto
npm run code:syntax

# Servidor local para teste manual
npm run code:serve

# Testes do Worker
cd worker && node --test test/*.test.mjs
```

---

## 8. Fluxo de alteração segura

1. Identificar a função/lógica suspeita de desempenho;
2. Medir antes (`console.time` / `performance.now`) — remover medições antes de qualquer commit;
3. Aplicar otimização mínima;
4. Medir depois nas mesmas condições;
5. Validar com `npm run code:test` e oráculos do C.O.D.E.;
6. Remover instrumentação temporária (`console.time`, `console.log` de debug);
7. Revisar `git diff`;
8. Não realizar commit, push ou deploy sem autorização explícita.

---

## 9. Regras de trabalho (preservadas)

- Investigar antes de alterar.
- Preferir mudanças mínimas.
- Não criar arquivos desnecessários.
- Não modificar funcionalidades fora do escopo.
- Não presumir autorização para implementar.
- Não realizar commit, push ou deploy sem autorização explícita.
- Validar as alterações realizadas.
- Apresentar evidências e limitações.
- Evitar testes com dados financeiros reais.
- Preservar isolamento por UID e segurança.

---

## 10. Regra contra desatualização

Quando uma informação variável aparecer como exemplo (contagens de linhas, versões, nomes de endpoints, quantidade de subcoleções), ela deve ser identificada como ilustrativa, histórica ou sujeita a verificação.

Não utilizar números e versões fixos como critérios de aprovação.

Não reprovar uma otimização porque uma estrutura mudou de lugar, desde que a responsabilidade equivalente tenha sido localizada e examinada.

Não declarar que um recurso inexiste apenas porque o caminho anteriormente conhecido não foi encontrado.

Registrar quando uma conclusão não pôde ser confirmada.

---

## 11. Não fazer

- Não remover listeners de autenticação (`onAuthStateChanged`);
- Não alterar schema do Firestore sem migração;
- Não excluir arquivos de backup (`*.backup-*`, `*.bak-*`);
- Não alterar regras de cálculo do `card-engine-v3-combined.js` sem verificar consumidores;
- Não implementar otimizações sem autorização explícita do usuário;
- Não classificar código como lento apenas por aparência;
- Não propor otimizações especulativas como problemas comprovados.

---

### Princípio final

O desempenho do LIVRO-CAIXA não pode ser otimizado à custa da integridade financeira. Qualquer otimização deve preservar saldos, parcelas, faturas, limites, rentabilidade e isolamento por UID, com evidências de que os resultados financeiros permaneceram inalterados.
