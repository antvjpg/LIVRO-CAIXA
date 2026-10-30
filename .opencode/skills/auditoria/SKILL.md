---
name: auditoria
description: Executa auditoria técnica cruzada do LIVRO-CAIXA. Investiga regras financeiras, fluxos de dados, dependências entre funcionalidades, persistência, sincronização, segurança, interface e infraestrutura. Utilizar em auditorias completas, auditorias de funcionalidades, investigação de bugs, análise de regressões e revisão técnica antes de implementar correções. Somente leitura: não implementa alterações.
---

# SKILL — AUDITORIA TÉCNICA CRUZADA DO LIVRO-CAIXA

## 1. Missão

Realizar auditorias técnicas profundas do LIVRO-CAIXA, tratando-o como um sistema financeiro integrado, com dados persistentes, regras de domínio, funcionalidades interdependentes e funcionamento online/offline.

O objetivo não é apenas encontrar problemas em arquivos isolados.

É identificar inconsistências entre:

- funcionalidades;
- camadas de arquitetura;
- regras financeiras;
- fontes de dados;
- implementações;
- persistência;
- cálculos derivados;
- interface;
- infraestrutura;
- testes e comportamento real.

A auditoria deve descobrir não somente se cada parte funciona individualmente, mas se todas trabalham corretamente em conjunto.

Princípio central: auditar as relações entre as partes, e não somente as partes isoladas.

A auditoria é somente leitura. Não implementar correções nem modificar o comportamento do aplicativo.

## 2. Entendimento obrigatório do produto

O LIVRO-CAIXA é uma aplicação de controle financeiro pessoal, construída como SPA/PWA utilizando HTML, CSS e JavaScript vanilla, sem framework ou etapa de build do aplicativo.

Sua arquitetura pode incluir:

- Firebase Authentication;
- Cloud Firestore;
- persistência e cache offline;
- sincronização entre cliente e Firestore;
- Service Worker;
- módulos JavaScript;
- módulos de domínio;
- patches de compatibilidade;
- Cloudflare Worker;
- serviços externos de indicadores financeiros;
- integração com IA e OCR;
- infraestrutura própria de testes C.O.D.E.

As funcionalidades financeiras incluem, conforme a implementação atual:

- contas e bancos;
- lançamentos de entradas e saídas;
- transferências;
- cartões;
- compras parceladas;
- faturas;
- pagamentos;
- investimentos;
- histórico e rentabilidade;
- caixinhas;
- metas;
- orçamentos;
- contas a receber;
- boletos e pagamentos;
- importação e exportação;
- dashboard e patrimônio.

Essa lista é um mapa inicial, não uma garantia de que todos os componentes permanecem iguais. Verificar sempre o repositório atual.

### Regra de domínio

O LIVRO-CAIXA não deve ser tratado como um CRUD genérico.

Uma operação financeira pode produzir consequências em várias partes do sistema.

Exemplo:

Uma compra parcelada pode afetar simultaneamente:

- compra original;
- parcelas;
- faturas;
- vencimentos;
- pagamentos;
- limite do cartão;
- saldo disponível;
- indicadores;
- persistência;
- histórico.

Uma alteração em qualquer um desses elementos exige investigar as relações relevantes.

## 3. Definição de auditoria cruzada

A auditoria cruzada consiste em acompanhar uma regra ou operação através de diferentes dimensões e confrontar seus resultados.

Toda auditoria deve considerar cinco eixos:

### Eixo A — Cruzamento entre camadas

Investigar a relação entre:

HTML/UI → JavaScript → domínio → estado → persistência → sincronização → renderização.

Quando aplicável, incluir:

- Firebase;
- Firestore;
- Cloudflare Worker;
- serviços externos;
- Service Worker;
- cache;
- APIs de IA.

### Eixo B — Cruzamento entre funcionalidades

Identificar funcionalidades que compartilham dados ou dependem umas das outras.

Exemplos:

- contas ↔ lançamentos ↔ transferências ↔ patrimônio;
- cartões ↔ compras ↔ parcelas ↔ faturas ↔ pagamentos ↔ limites;
- investimentos ↔ movimentações ↔ rentabilidade ↔ patrimônio;
- caixinhas ↔ metas ↔ aportes ↔ progresso;
- lançamentos ↔ categorias ↔ orçamentos;
- contas a receber ↔ recebimentos ↔ saldos;
- dashboard ↔ totais e indicadores de todas essas funcionalidades.

Não presumir que todas as relações estão implementadas. Descobrir e documentar os relacionamentos reais.

### Eixo C — Cruzamento entre fontes de verdade

Confrontar, quando acessível:

- estado em memória;
- documentos no Firestore;
- cache offline;
- dados legados;
- valores derivados;
- valores exibidos;
- dados retornados por serviços externos.

Identificar:

- divergência;
- duplicação de estado;
- valores desatualizados;
- sobrescritas;
- perda de atualização;
- sincronização incompleta;
- cálculos realizados a partir de cópias inconsistentes.

### Eixo D — Cruzamento entre implementações

Investigar:

- funções duplicadas;
- módulos com responsabilidades semelhantes;
- adapters;
- patches de compatibilidade;
- aliases;
- cálculos repetidos;
- diferentes caminhos para a mesma operação;
- versões antigas e novas de uma regra.

Verificar se diferentes caminhos produzem resultados equivalentes.

### Eixo E — Cruzamento entre código, testes e comportamento

Confrontar:

- implementação real;
- documentação;
- testes unitários;
- oráculos independentes;
- testes de segurança;
- testes E2E;
- inspeção visual;
- comportamento observável.

Um teste aprovado não significa que toda a funcionalidade está correta.

Um teste ausente não prova que existe um defeito.

Registrar precisamente o que foi demonstrado e o que permanece sem validação.

## 4. Preservação do repositório

Antes de iniciar:

1. Ler "AGENTS.md".
2. Ler a documentação relevante.
3. Executar "git status --short".
4. Identificar branch e commit atual.
5. Preservar alterações locais e arquivos não rastreados.
6. Determinar o escopo da auditoria.
7. Identificar os testes e ferramentas disponíveis.

Não executar:

- modificações de código;
- formatação automática;
- migrações;
- exclusões;
- alterações de dados;
- commits;
- push;
- deploy.

Não sobrescrever alterações locais.

## 5. Fase 1 — Reconstrução da arquitetura real

Antes de avaliar defeitos, reconstruir a arquitetura atual da área investigada.

Identificar:

1. Entradas e pontos de inicialização.
2. Arquivos HTML e componentes relacionados.
3. Funções JavaScript envolvidas.
4. Módulos de domínio.
5. Estado utilizado.
6. Persistência.
7. Serviços externos.
8. Eventos e listeners.
9. Consumidores.
10. Testes existentes.

Mapear o fluxo real, sem confiar cegamente em documentação histórica.

Atenção especial a:

- módulos "js/";
- "js/domain/";
- "js/legacy/";
- "js/99-init.js";
- "worker/";
- "sw.js";
- "style/";
- "e2e/";
- ".github/workflows/".

Não assumir que os caminhos ou nomes acima permanecem inalterados.

## 6. Fase 2 — Reconstrução das regras financeiras

Para cada funcionalidade financeira relevante, determinar:

- entidade envolvida;
- fonte de verdade;
- entradas;
- validações;
- regra de negócio;
- cálculo;
- resultado;
- persistência;
- efeitos derivados;
- consumidores;
- comportamento após reload.

Representar o fluxo:

ENTRADA
↓
VALIDAÇÃO
↓
REGRA DE DOMÍNIO
↓
ESTADO
↓
PERSISTÊNCIA
↓
SINCRONIZAÇÃO
↓
CÁLCULOS DERIVADOS
↓
INTERFACE

Quando houver caminhos alternativos, reconstruir cada um e compará-los.

### Integridade financeira

Verificar:

- precisão decimal;
- arredondamento;
- sinais;
- valores positivos, negativos e zero;
- datas;
- timezone;
- vencimentos;
- parcelamentos;
- pagamentos parciais;
- liquidação;
- saldos;
- limites;
- transferências;
- rentabilidade;
- valores acumulados;
- consistência dos totais.

Não inventar regras financeiras. Determinar a semântica a partir do código, dos contratos e do comportamento existente.

Se a regra esperada não puder ser determinada, registrar a ambiguidade.

## 7. Fase 3 — Auditoria cruzada por funcionalidade

Selecionar os relacionamentos relevantes de acordo com o escopo.

### Contas e lançamentos

Confrontar:

- criação de banco;
- saldo inicial;
- entrada;
- saída;
- transferência;
- edição;
- exclusão;
- saldo calculado;
- patrimônio;
- dashboard;
- persistência.

### Cartões e faturas

Confrontar:

- cadastro do cartão;
- compra;
- parcelamento;
- motor de domínio;
- adapter;
- geração das parcelas;
- fechamento;
- vencimento;
- pagamento;
- limite;
- faturas;
- persistência;
- histórico.

Não duplicar regras do motor de cartões na interface.

### Investimentos

Confrontar:

- cadastro;
- instituição;
- ativo;
- tipo;
- movimentações;
- aportes;
- resgates;
- rentabilidade;
- histórico;
- totais;
- patrimônio;
- renderização;
- persistência.

### Caixinhas e metas

Confrontar:

- objetivo;
- valor acumulado;
- aportes;
- vínculos;
- atualização automática;
- progresso;
- remoção de vínculo;
- exclusão;
- renderização.

Não presumir que meta e caixinha são a mesma entidade.

### Orçamentos

Confrontar:

- categorias;
- lançamentos;
- período;
- limites;
- gastos considerados;
- cálculo do consumo;
- alertas;
- atualização;
- persistência.

### Dashboard e patrimônio

Confrontar os valores exibidos com suas fontes de origem.

Identificar se o dashboard utiliza:

- cálculo próprio;
- valor armazenado;
- função compartilhada;
- cache;
- agregação de outras funcionalidades.

Verificar se diferentes telas representam a mesma grandeza financeira de forma consistente.

## 8. Fase 4 — Persistência, sincronização e funcionamento offline

Investigar o fluxo completo do Firestore.

Verificar:

- isolamento por UID;
- caminhos de documentos;
- coleções;
- carregamento;
- listeners;
- alterações;
- gravação;
- batches;
- exclusões;
- conflitos;
- cache offline;
- recuperação de conexão;
- atualização após reload;
- migração de dados legados.

Investigar também:

- localStorage;
- IndexedDB;
- Service Worker;
- estratégia de cache;
- atualizações de versão;
- dados desatualizados.

Não presumir que a interface reflete imediatamente a persistência ou vice-versa.

Distinguir:

- valor ainda não sincronizado;
- erro de gravação;
- erro de leitura;
- dado antigo;
- divergência real;
- limitação de observabilidade.

## 9. Fase 5 — Segurança e privacidade

Auditar:

- autenticação;
- autorização;
- isolamento de usuários;
- regras Firestore;
- validação de entradas;
- XSS;
- injeção;
- tratamento de arquivos;
- exposição de dados;
- logs;
- credenciais;
- APIs;
- Worker;
- CORS;
- App Check;
- integração com IA;
- prompt injection.

Para IA e OCR, identificar:

- quais dados são enviados;
- finalidade;
- serviço destinatário;
- validação de entrada;
- tratamento de resposta;
- possíveis instruções maliciosas;
- exposição de dados financeiros.

Usar OWASP ASVS como referência de verificação de segurança, selecionando os controles aplicáveis ao projeto. Não transformar o padrão inteiro em checklist obrigatório sem avaliar relevância.

## 10. Fase 6 — C.O.D.E. e validação independente

O C.O.D.E. é a infraestrutura de Controle Operacional de Diagnóstico e Execução do LIVRO-CAIXA.

Não substituí-lo nem criar outra infraestrutura paralela de QA.

Utilizar o que já existe:

- testes de sintaxe;
- oráculos;
- testes unitários;
- testes de segurança;
- testes E2E;
- testes visuais;
- fixtures;
- identidade QA;
- comparação UI × oracle × Firestore;
- relatórios;
- CI.

Antes de propor novos testes:

1. localizar a cobertura existente;
2. verificar se o teste realmente cobre o comportamento;
3. verificar se o oráculo é independente;
4. identificar lacunas;
5. propor a menor extensão necessária.

### Independência dos oráculos

Um oráculo não deve importar o cálculo que pretende verificar.

A implementação independente deve representar a regra de negócio esperada, e não copiar mecanicamente a lógica de produção.

A coincidência entre dois resultados não é suficiente se ambos compartilham o mesmo erro conceitual.

### Classificação de validação

- PASS: executado e aprovado.
- FAIL: executado e apresentou divergência.
- BLOCKED: impedido por ambiente, credenciais ou dependência.
- SKIPPED: não executado intencionalmente, com justificativa.
- FLAKY: comportamento instável entre execuções.
- NOT RUN: não executado.

Não declarar cobertura que não foi efetivamente demonstrada.

## 11. Fase 7 — Análise de impacto e regressões

Para cada achado, identificar:

- funcionalidade de origem;
- módulos diretamente afetados;
- consumidores;
- funcionalidades dependentes;
- dados persistidos envolvidos;
- efeitos financeiros;
- riscos de regressão;
- testes que poderiam detectar o problema.

Criar um mapa de impacto.

Não considerar uma alteração isolada quando ela modifica uma fonte compartilhada.

## 12. Severidade e confiança

### Severidade

- CRÍTICO: corrupção financeira grave, exposição relevante de dados ou comprometimento de contas.
- ALTO: perda de dados, falha de segurança ou funcionalidade essencial comprometida.
- MÉDIO: erro funcional reproduzível ou divergência relevante entre funcionalidades.
- BAIXO: inconsistência localizada com impacto limitado.
- INFORMATIVO: melhoria, dívida técnica ou oportunidade de prevenção.

### Confiança

- ALTA: evidência direta, fluxo demonstrado ou reprodução.
- MÉDIA: evidência no código, mas condições incompletas.
- BAIXA: hipótese dependente de ambiente, configuração ou informação externa.

Nunca confundir severidade com confiança.

## 13. Evidências obrigatórias

Todo achado deve apresentar:

1. ID.
2. Severidade.
3. Confiança.
4. Arquivo e linha.
5. Função ou componente.
6. Fluxo envolvido.
7. Evidência técnica.
8. Condição de ocorrência.
9. Impacto financeiro ou funcional.
10. Funcionalidades relacionadas.
11. Teste ou reprodução.
12. Correção recomendada.

Separar claramente:

- defeito confirmado;
- risco potencial;
- ausência de cobertura;
- melhoria opcional;
- limitação do ambiente.

Não transformar uma hipótese em defeito confirmado.

## 14. Relatório final

### Auditoria Técnica Cruzada — LIVRO-CAIXA

#### 1. Escopo

- Objetivo;
- commit e branch;
- arquivos investigados;
- funcionalidades abrangidas;
- limitações.

#### 2. Arquitetura encontrada

Apresentar o fluxo real da área investigada e suas dependências.

#### 3. Mapa de relacionamentos

Mostrar as funcionalidades, módulos, dados e camadas que dependem uns dos outros.

#### 4. Achados

Tabela com ID, severidade, confiança, localização, evidência e impacto.

#### 5. Auditoria cruzada

Demonstrar quais fluxos foram acompanhados e quais resultados foram confrontados.

#### 6. Integridade financeira

Apresentar as regras investigadas, resultados esperados, resultados observados e divergências.

#### 7. Persistência e segurança

Apresentar os resultados específicos dessas áreas.

#### 8. C.O.D.E. e cobertura

Informar testes existentes, executados, pendentes e lacunas encontradas.

#### 9. Mapa de impacto

Identificar funcionalidades que seriam afetadas por cada problema.

#### 10. Plano de correção recomendado

Priorizar:

- correções críticas;
- correções funcionais;
- prevenção de regressões;
- melhorias estruturais;
- melhorias opcionais.

Indicar a menor solução adequada e os testes necessários.

#### 11. Conclusão

Classificar a área como:

- APROVADA;
- APROVADA COM RESSALVAS;
- REPROVADA;
- INCONCLUSIVA.

Justificar com evidências.

#### 12. Preservação

Confirmar que não houve alterações no repositório, dados, commits, push ou deploy.

## 15. Eficiência

A profundidade deve ser proporcional ao escopo.

- Começar pela funcionalidade solicitada.
- Expandir a investigação seguindo dependências reais.
- Evitar ler repetidamente arquivos não relacionados.
- Reutilizar documentação e testes existentes.
- Não repetir verificações já comprovadas sem motivo.
- Não executar toda a suíte quando testes direcionados forem suficientes.
- Em auditoria completa, ampliar a cobertura para as funcionalidades e relações relevantes.
- Registrar o que não foi possível investigar.

Não confundir auditoria completa com leitura indiscriminada de todos os arquivos.

## 16. Critério de conclusão

Uma auditoria cruzada somente pode ser considerada concluída quando:

1. A implementação real foi identificada.
2. As regras de domínio relevantes foram reconstruídas.
3. Os principais consumidores foram mapeados.
4. Os fluxos entre camadas foram investigados.
5. As dependências entre funcionalidades foram avaliadas.
6. As fontes de verdade foram confrontadas quando possível.
7. Os testes existentes foram avaliados.
8. As lacunas de cobertura foram registradas.
9. Os achados possuem evidências.
10. Os impactos e riscos foram priorizados.
11. As limitações foram explicitadas.
12. O repositório permaneceu intacto.

---

## Módulo 1 — Auditoria da Infraestrutura C.O.D.E.

O C.O.D.E. (Controle Operacional de Diagnóstico e Execução) é a infraestrutura de QA e diagnóstico do LIVRO-CAIXA. Esta seção instrui a skill a auditar sua implementação real, reconstruindo a arquitetura antes de emitir conclusões.

### 1. Arquitetura

Identificar todos os componentes que integram o C.O.D.E.:

- `AGENTS.md` — regras de precedência, prioridade de fontes, regra de estado atual;
- Documentação do C.O.D.E. — `AGENTS.md`, `e2e/AUDITORIA.md`, `e2e/README.md`;
- Oráculos — `e2e/oracles/*.js`, `e2e/oracles/*.test.mjs`, testes de sintaxe;
- Fixtures — `e2e/fixtures/fixtures.js`, `e2e/fixtures/v20-01-fixtures.js`, `e2e/seeds/`;
- Testes — `worker/test/*.test.mjs`, `e2e/oracles/*.test.mjs`, `e2e/security/*.test.mjs`;
- Scripts de diagnóstico — `e2e/scripts/*.cjs`, `.livro-caixa-index.diff`, `checklist_testes.md`;
- Relatórios — `e2e/reports/generate-report.cjs`, `AUDIT_important_summary.md`, `notion_summary.md`;
- Logs — `.livro-caixa-index.diff`, arquivos `*.backup-*`, `*.bak-*`;
- Workflows — `.github/workflows/code-e2e.yml`, `.github/workflows/worker.yml`, `.github/workflows/pages.yml`, `.github/workflows/eol-check.yml`, `.github/workflows/model-failed-alert.yml`;
- Configurações — `package.json`, `playwright.config.js`, `firebase.json`, `wrangler.toml`;
- Ferramentas auxiliares — Chromium headless, CDP, `chrome-remote-interface`, `firebase-tools`.

Mapear responsabilidades, dependências, entradas e saídas de cada componente.

Não confiar exclusivamente na documentação. Confrontar a documentação com a implementação real encontrada nos arquivos.

### 2. Oráculos

Verificar cada oráculo quanto a:

- **Independência em relação à implementação**: o oráculo não deve importar o cálculo que pretende verificar;
- **Correção das regras financeiras**: aritmética própria, sem copiar mecanicamente a lógica de produção;
- **Precisão decimal**: valores monetários sem perda de precisão;
- **Arredondamentos**: comportamento definido e consistente;
- **Casos-limite**: zero, negativo, valores extremos, datas de vencimento;
- **Premissas**: suposições declaradas vs. reais;
- **Comparações**: fonte de verdade independente para cada comparação;
- **Falsos positivos e falsos negativos**: dois resultados iguais não são prova de correção quando ambos dependem da mesma implementação.

Cada oráculo deve ser executado independentemente antes de ser considerado válido.

### 3. Testes e Fixtures

Investigar:

- **Cobertura**: quais funcionalidades possuem testes, quais não possuem;
- **Isolamento**: testes não dependem de estado compartilhado;
- **Reprodutibilidade**: mesmos dados e condições produzem mesmos resultados;
- **Dependências**: cada teste declara e respeita suas dependências;
- **Dados de teste**: fixtures determinísticas, prefixo `CODE_TEST_*`, valores redondos;
- **Falsas aprovações**: testes que aprovam mas não detectam defeitos;
- **Testes que não detectam os defeitos pretendidos**: lacuna entre intenção e execução.

### 4. Diagnósticos e Relatórios

Verificar:

- **Rastreabilidade**: cada achado vinculado a arquivo, linha, evidência;
- **Identificação de falhas**: detecção precoce de defeitos financeiros e de integração;
- **Classificação**: severidade (Crítico, Alto, Médio, Baixo, Informativo) e confiança (Alta, Média, Baixa);
- **Evidências**: capturas de tela, traces, vídeos, logs, consultas Firestore;
- **Correlação**: relação entre execução de teste e resultado no relatório;
- **Histórico**: comparativos entre execuções, regressões detectadas;
- **Consistência entre execução e relatório**: o que o relatório afirma corresponde ao que foi executado.

### 5. CI

Investigar:

- **Workflows**: `code-e2e.yml`, `worker.yml`, `pages.yml`, `eol-check.yml`, `model-failed-alert.yml`;
- **Gatilhos**: push, pull_request, workflow_dispatch, schedule;
- **Dependências**: pacotes instalados, versões fixadas, variáveis de ambiente;
- **Testes executados**: suítes rodadas em cada workflow;
- **Propagação de falhas**: como uma falha em uma etapa afeta as próximas;
- **Condições de aprovação**: critérios para marcar um workflow como bem-sucedido;
- **Artefatos**: relatórios, screenshots, logs publicados;
- **Compatibilidade com execução local**: comandos que podem ser rodados fora do CI (Termux, PC).

### 6. Critérios de Conclusão

A auditoria do C.O.D.E. deve apresentar:

1. Arquitetura identificada;
2. Componentes mapeados;
3. Oráculos avaliados;
4. Testes confrontados;
5. Fixtures investigadas;
6. Relatórios verificados;
7. CI investigado;
8. Lacunas documentadas;
9. Evidências dos achados.

---

## Módulo 2 — Auditoria dos Testes End-to-End (E2E)

Audita os testes E2E como camada independente de validação comportamental do LIVRO-CAIXA. Não presumir que testes aprovados comprovam que toda a funcionalidade está correta.

### 1. Arquitetura

Investigar a estrutura real de:

- `playwright.config.js` — configuração de projetos, dispositivos, reporters;
- `e2e/auth/` — testes de autenticação (login, Google, signup, sessão);
- `e2e/smoke/` — testes smoke (funcionalidades críticas);
- `e2e/movimentacoes/` — fluxos de lançamentos de entrada/saída/transferência;
- `e2e/orcamento/` — fluxos de categorias, limites, alertas de orçamento;
- `e2e/lia/` — fluxos de IA/OCR (LIA);
- `e2e/seguranca/` — fluxos de segurança e validação;
- `e2e/caixinhas/` — fluxos de caixinhas, aportes, progresso;
- `e2e/metas/` — fluxos de metas financeiras;
- `e2e/investimentos/` — fluxos de cadastro, aportes, resgates, rentabilidade;
- `e2e/helpers/` — utilitários de teste, provisionamento, storageState;
- `e2e/fixtures/` — fixtures de teste determinísticas;
- `e2e/oracles/` — scripts de oracle independentes;
- `e2e/reports/` — geração de relatórios de teste;
- `e2e/visual/` — auditoria visual (Chromium, CDP, screenshots);
- `.github/workflows/code-e2e.yml` — CI para testes E2E.

Não presumir que todos os caminhos continuam iguais. Verificar a existência de cada arquivo.

### 2. Cenários

Para cada cenário, identificar:

- Funcionalidade testada;
- Comportamento reproduzido;
- Condições iniciais;
- Entradas;
- Resultado esperado;
- Forma de observação;
- Fontes independentes;
- Consequências financeiras verificadas.

Distinguir cobertura integral de cobertura parcial.

### 3. Interface

Auditar:

- Seletores (IDs, classes, atributos);
- Navegação entre abas, modais, drawers;
- Formulários e validações;
- Estados de carregamento;
- Alertas e diálogos;
- Erros de console;
- Comportamento após reload.

Confrontar os seletores com a interface real (`index.html`, módulos `js/`).

Não recomendar `data-testid` sem demonstrar necessidade.

### 4. Fluxos Financeiros

Acompanhar cada ação do usuário:

```
AÇÃO DO USUÁRIO
↓
INTERFACE
↓
REGRA DE NEGÓCIO
↓
ATUALIZAÇÃO DE ESTADO
↓
PERSISTÊNCIA (Firestore)
↓
RECARREGAMENTO
↓
CONFERÊNCIA INDEPENDENTE (oracle / Firestore REST)
```

Quando aplicável, incluir Worker, Firebase e serviços externos.

### 5. Autenticação QA

Investigar:

- Provisionamento de conta QA;
- Signup e login;
- UID do usuário autenticado;
- Sessão e `onAuthStateChanged`;
- Isolamento entre usuários (partição `livrocaixa/{uid}`);
- StorageState (reutilização de sessão);
- Credenciais (nunca expostas);
- Cleanup de contas de teste;
- Contas preexistentes;
- Proteção de evidências.

Nenhuma execução pode atingir contas reais ou dados de outros usuários.

A exclusão de contas deve depender de propriedade comprovada.

Não executar operações destrutivas durante a auditoria.

### 6. Evidências e Estabilidade

Investigar:

- Screenshots;
- Traces;
- Vídeos;
- Logs;
- Diálogos (alert/confirm);
- Falhas;
- Sanitização de dados sensíveis;
- Timeouts;
- Retries;
- Paralelismo;
- Corridas (race conditions);
- Estado compartilhado entre testes;
- Cache;
- Service Worker.

Uma repetição aprovada não elimina uma falha anterior: classificá-la como possível instabilidade.

### 7. Cobertura

Construir matriz:

| Funcionalidade | Cenário | Interface | Oracle | Firestore | Reload | Evidência |
|---|---|---|---|---|---|---|

Classificar cada célula:

- Cobertura completa demonstrada;
- Cobertura parcial;
- Somente interface;
- Sem persistência;
- Sem oráculo;
- Sem cobertura identificada.

Considerar explicitamente lacunas documentadas, incluindo **cartões, faturas e contas a receber**.

### 8. Ambiente

Distinguir:

- Testes Node.js (`node --test`);
- Listagem com shim de plataforma (Termux/Android);
- Inspeção visual com Chromium headless;
- Execução Playwright (CI/PC);
- Limitações do Termux (`Unsupported platform: android`);
- Execução em PC e CI.

Não confundir limitação de plataforma com defeito funcional.

---

## Módulo 3 — Auditoria do Cloudflare Worker

Auditar integralmente o Worker como infraestrutura independente, integrada ao frontend.

### 1. Arquitetura

Investigar:

- `worker/wrangler.toml` — configuração, variáveis de ambiente, bindings;
- `worker/src/index.js` — handler principal (602 linhas, tabela de rotas);
- `worker/src/ai/` — integração OpenRouter (autenticação, quota, rate limit, modelos, fallback);
- `worker/src/financial/` — gateway financeiro (BCB SGS, Tesouro Nacional);
- `worker/src/mcp/` — protocolo MCP (snapshot, token, OAuth, bridge);
- `worker/src/push/` — dispatch de push (Firestore → preferências → FCM);
- `worker/src/shared/` — utilitários HTTP, validação, rate limit KV/memory;
- `worker/test/` — testes do Worker (21 arquivos, `node:test`, sem rede);
- `worker/package.json` — dependências (miniflare);
- `.github/workflows/worker.yml` — CI do Worker (testes, dry-run, deploy, smoke `/health`).

Mapear rotas, handlers, dependências, variáveis, secrets, bindings e serviços externos.

### 2. Endpoints HTTP

Para cada endpoint, identificar:

- Método (GET, POST, OPTIONS, DELETE);
- Autenticação (Firebase ID Token, MCP token, OAuth, none);
- App Check;
- CORS;
- Validação de entrada;
- Limite de corpo (maxBytes);
- Rate limit;
- Contrato de resposta;
- Tratamento de exceções.

Construir matriz endpoint × segurança.

Endpoints a auditar:

| Endpoint | Método | Autenticação | App Check | CORS | Rate Limit |
|---|---|---|---|---|---|
| OPTIONS * | OPTIONS | none | Não | Allowlist | Não |
| GET /health | GET | none | Não | Sim | Não |
| GET /quota | GET | Firebase | Sim | Sim | Sim |
| GET /openrouter-usage | GET | Firebase admin | Sim | Sim | Sim |
| POST /ai | POST | Firebase | Sim | Sim | Sim |
| GET /financial/ | GET | none | Não | Allowlist | Sim |
| POST /mcp | POST | MCP token | Não | Não | Sim |
| GET /.well-known/oauth-* | GET | none | Não | Sim | Não |
| POST /register | POST | none | Não | Sim | Sim |
| GET/POST /authorize | GET/POST | OAuth | Não | Sim | Não |
| POST /token | POST | OAuth code/PKCE | Não | Sim | Sim |
| POST /bridge/snapshot | POST | Firebase | Sim | Sim | Sim |
| POST/DELETE /bridge/token | POST/DELETE | Firebase | Sim | Sim | Sim |

### 3. Inteligência Artificial

Auditar:

- Firebase ID Token (claims, issuer, audience, expiração, assinatura, JWKS);
- App Check;
- Chave OpenRouter (segredo, rotação);
- Seleção de modelos (lista de modelos, fallback);
- Prompts (system prompt, contexto financeiro);
- Imagens e PDFs (upload, validação, tamanho);
- Limites (cota diária, max tokens, timeout do provedor);
- Cotas (consumo, remaining, resetAt);
- Rate limit (por usuário, por IP);
- Falhas externas (OpenRouter indisponível, erros 402/404/429/5xx).

Confrontar contratos do Worker com os consumidores reais do frontend (`js/domain/ai-chat-contract.js`, `js/domain/mcp-financial-contract.js`).

### 4. Indicadores Financeiros

Investigar integração com:

- Banco Central (BCB SGS — Selic, CDI, IPCA);
- Tesouro Nacional (títulos públicos).

Verificar:

- URLs (baseUrl configurada, nunca embutir host);
- Parsing (resposta JSON, validação de contrato);
- Datas (ISO 8601, fuso horário, windowDays);
- Unidades (percent_per_day, percent_per_month);
- Precisão (valores finitos, sem NaN/Infinity);
- Cache (TTL, backoff após falha, restoreFromPersisted);
- Timeout (REQUEST_TIMEOUT_MS);
- Limites de leitura (MAX_TITLES_PER_DATE);
- Redirecionamentos;
- SSRF (validação de origem, allowlist);
- Respostas inválidas (código inválido → indicador indisponível).

Confrontar: `Worker → financial-client.js → interface`.

Indicadores externos não podem alterar saldos, lançamentos ou patrimônio financeiro.

### 5. MCP e OAuth

Auditar o fluxo:

```
APLICATIVO → SNAPSHOT → KV → AUTENTICAÇÃO → MCP → FERRAMENTA → AGENTE EXTERNO
```

Verificar:

- Isolamento por UID;
- Sanitização de dados sensíveis;
- Limite de tamanho (64 KB snapshot, 8 KB token);
- TTL (snapshot TTL 1 hora);
- Consistência (hash vs token bruto);
- Tokens (emissão, revogação, um token ativo por conta);
- Hashes (KV armazena apenas hash);
- Emissão (token bruto aparece uma vez);
- Revogação (gerar novo revoga anteriores);
- Concorrência (rate limit antes da autenticação);
- OAuth Discovery (RFC 9728/8414);
- PKCE S256;
- Redirect URI;
- Authorization Code;
- Refresh Token;
- Rotação;
- Audience.

Confirmar que a V1 permanece somente leitura.

Qualquer possibilidade de escrita deve ser tratada como mudança de segurança e escopo.

### 6. Push

Investigar:

`Firestore → preferências → planejamento → FCM → pushMeta`.

Verificar:

- Conta de serviço;
- Escopos;
- Isolamento por usuário;
- Preferências de notificação;
- Duplicidade de envio;
- Idempotência;
- Tokens inválidos (cleanup);
- Falhas parciais;
- Execuções interrompidas;
- Limites de operações (cron).

### 7. KV

Mapear namespaces, prefixos e chaves.

Para cada chave, identificar:

- Responsabilidade;
- Dados armazenados;
- Vínculo com usuário (UID);
- TTL;
- Operação de leitura;
- Operação de escrita;
- Operação de exclusão;
- Tratamento de falhas.

Investigar concorrência, colisões, consistência e comportamento de falha aberta ou fechada.

Não presumir atomicidade de operações KV.

### 8. Segurança e Testes

Auditar:

- Secrets (chaves OpenRouter, credenciais Firebase);
- Tokens (MCP, OAuth, Firebase ID Token);
- Logs (sem credenciais, sem dados financeiros);
- CORS (allowlist de origens);
- SSRF (validação de baseUrl);
- Injeção (validação de corpo JSON, sanitização);
- Autenticação (Firebase ID Token, MCP token, OAuth);
- Autorização (admin emails para /openrouter-usage);
- Rate limit (por usuário, por IP, por rota);
- Abuso de endpoints (limites de corpo, janelas de tempo);
- Manipulação de headers (Origin, cf-connecting-ip).

Confrontar todos os testes com a implementação.

Mocks não comprovam isoladamente integração real.

### 9. Deploy

Investigar:

- Wrangler (deploy, dry-run, bindings);
- Bindings (variáveis de ambiente, secrets);
- Secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, OPENROUTER_API_KEY);
- CI (`.github/workflows/worker.yml`);
- Dry-run (empacota sem publicar);
- Deploy real (apenas em `main` com environment production);
- Smoke test (GET /health obrigatório após deploy);
- Cron (push dispatch);
- Observabilidade (logs estruturados, GITHUB_STEP_SUMMARY);
- Rollback (procedimento de reversão).

Verificar se GET /health é suficiente para detectar falhas funcionais após publicação.

---

## Módulo 4 — Auditoria da Infraestrutura Externa, Publicação e PWA

Auditar a infraestrutura responsável por hospedar, distribuir, atualizar e executar o LIVRO-CAIXA.

### 1. GitHub Pages

Investigar:

- `.github/workflows/pages.yml` (permissões, gatilhos, branch, configuração Pages);
- Diretório publicado;
- Artefatos publicados;
- Concorrência entre deploys;
- Integridade da versão publicada.

Verificar:

- Validação antes do deploy (testes necessários aprovados);
- Arquivos publicados indevidamente (backups, dados sensíveis, relatórios de QA);
- Materiais de QA (screenshots, traces, evidências);
- Propagação de falhas entre workflows;
- Integridade da versão publicada (corresponde ao validado em CI).

### 2. PWA

Investigar:

- `sw.js` — Service Worker (CACHE_NAME, APP_SHELL, estratégia network-first);
- `manifest.webmanifest` — manifesto PWA (nome, ícones, start_url, display);
- `index.html` — HTML puro da aplicação shell;
- Registro do Service Worker;
- Instalação (prompt de instalação PWA);
- Ativação (service worker ativo);
- Atualização (nova versão do SW, skipWaiting, clients.claim);
- Cache (cache versionado, APP_SHELL, estratégias de cache);
- Navegação offline (recursos disponíveis offline);
- Notificações (push, FCM).

Verificar:

- Cache versionado (CACHE_NAME=livro-caixa-shell-v20-35);
- APP_SHELL (módulos js/, patches, emoji, CSS — ocr/ fora do APP_SHELL);
- Estratégias de cache (network-first para HTML/JS/CSS);
- Recursos ausentes (módulos não precacheados);
- Arquivos obsoletos (versões antigas no cache);
- Atualização interrompida (falha ao instalar novo SW);
- Compatibilidade entre versões (dados de versões diferentes);
- Logout (limpeza de estado do SW);
- Troca de usuário (isolamento de cache por sessão);
- Recuperação offline (dados persistidos localmente).

Investigar especificamente módulos OCR e outros recursos que possam não integrar o precache.

### 3. Firebase

Auditar:

- **Authentication**: Firebase Auth compat SDK, e-mail/senha, Google signInWithPopup, onAuthStateChanged, configuração pública (em `js/` módulos);
- **Cloud Firestore**: todos os dados em `livrocaixa/{uid}/*`, 13 subcoleções (banks, categories, entries, investments, pockets, yieldsLog, recurringBills, receivables, budgets, goals, cards, purchases, invoiceLaunches, diagnostics);
- **Cloud Messaging**: FCM para push notifications;
- **App Check**: proteção contra abuso de APIs;
- **Configuração pública**: firebaseConfig exposta no frontend (não é credencial administrativa);
- **Persistência offline**: cache local, IndexedDB, localStorage;
- **Sincronização**: listeners onSnapshot, batches, commitDiff;
- **Regras de segurança**: isolamento por UID, permissões por coleção.

Verificar:

- Isolamento entre usuários (partição por uid);
- Leitura e escrita por coleção;
- Permissões por coleção (regras de segurança);
- Migrações (documento único legacado vs. subcoleções);
- Exclusão (operaciones deletes);
- Sessões (onAuthStateChanged, signOut);
- Comportamento offline (dados cacheados vs. remotos).

Se `firestore.rules`, `storage.rules` ou `firebase.json` não estiverem presentes no repositório, investigar se as configurações estão disponíveis em outro local (Console Firebase, CI secrets).

Não presumir que a ausência desses arquivos no GitHub significa ausência de regras em produção.

Registrar o que pode e o que não pode ser comprovado.

Não confundir configuração pública do Firebase com credenciais administrativas.

### 4. Dependências Externas

Mapear:

- Google Fonts;
- cdnjs;
- jsDelivr;
- Firebase SDK;
- OpenRouter;
- Outros serviços encontrados no código.

Verificar:

- Versões (fixadas ou flutuantes);
- Integridade (SRI — Subresource Integrity);
- Dependências sem versão fixada;
- Disponibilidade dos serviços;
- Falhas de carregamento (timeout, erro de rede);
- Impacto de indisponibilidade (degradação graciosa);
- Exposição de dados (dados enviados para serviços externos).

### 5. Segurança da Publicação

Investigar:

- Permissões GitHub Actions (contents: read, environment: production);
- Actions fixadas por SHA (ex: `actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09`);
- Secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, OPENROUTER_USAGE_ADMIN_EMAIL);
- Arquivos publicados (o que vai para GitHub Pages);
- Artefatos (o que é armazenado como artifact do CI);
- Recursos externos (CDNs, APIs externas);
- Políticas de segurança (App Check, CORS, rate limit).

---

## Auditoria Cruzada — Integração entre Infraestruturas

A auditoria cruzada investiga as fronteiras entre as quatro infraestruturas. Cada origem deve ser verificada em relação a cada destino relevante.

### Matriz de Auditoria Cruzada

| Origem | Destino | O que Verificar |
|---|---|---|
| C.O.D.E. | E2E | Correspondência entre diagnósticos do C.O.D.E. e cenários E2E |
| C.O.D.E. | Worker | Cobertura das regras do Worker pelos testes e oráculos do C.O.D.E. |
| C.O.D.E. | PWA | Validação de publicação e cache pela infraestrutura C.O.D.E. |
| E2E | Worker | Contratos e respostas reais dos endpoints do Worker |
| E2E | Firebase | Persistência de dados e identidade de usuário nos testes E2E |
| E2E | GitHub Pages | Correspondência entre versão testada em E2E e versão publicada |
| Worker | Firebase | Autenticação Firebase e isolamento por UID no Worker |
| Worker | Frontend | Compatibilidade de contratos (IA, financeiro, MCP, bridge) |
| Worker | Push | Consistência entre planejamento de push e execução real |
| PWA | Firebase | Sessão de usuário e sincronização offline com Firestore |
| PWA | Worker | Atualização do PWA e compatibilidade de endpoints do Worker |
| GitHub Pages | C.O.D.E. | Integridade da publicação em relação aos diagnósticos C.O.D.E. |

### Investigações Especiais

Investigar especialmente:

1. **Código aprovado em testes, mas não publicado** — lacuna entre CI e deploy;
2. **Código publicado diferente do validado em CI** — alterações entre build e publicação;
3. **Frontend utilizando contrato antigo do Worker** — incompatibilidade de versão;
4. **Cache entregando versões incompatíveis** — Service Worker servindo assets desatualizados;
5. **Dados offline divergentes da persistência remota** — inconsistência entre cache local e Firestore;
6. **Testes que não detectam falhas nas integrações** — lacunas de cobertura entre camadas;
7. **Diferenças entre ambiente local, CI e produção** — comportamento diferente por ambiente;
8. **Dependências externas que comprometem funcionalidades** — CDN, OpenRouter, BCB, Tesouro indisponíveis;
9. **Problemas de identidade e isolamento entre serviços** — vazamento de dados entre usuários;
10. **Falhas de propagação de erros entre camadas** — erro em uma camada não é reportado corretamente.

### Formato de Cada Achado Cruzado

Cada achado deve identificar:

- Componente de origem;
- Componente afetado;
- Evidência técnica;
- Consequência;
- Severidade (Crítico, Alto, Médio, Baixo, Informativo);
- Grau de confiança (Alta, Média, Baixa);
- Recomendação.

Não classificar hipóteses como vulnerabilidades confirmadas.

---

### Princípio final

Não basta provar que cada módulo funciona. É necessário verificar se o LIVRO-CAIXA, como sistema financeiro integrado, produz resultados coerentes em todas as partes que participam de uma mesma operação.