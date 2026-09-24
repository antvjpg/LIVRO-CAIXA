# AGENTS.md — LIVRO-CAIXA

## 1. Propósito deste arquivo

Este arquivo define as regras de engenharia, segurança, manutenção e comportamento que agentes de código devem seguir ao trabalhar no repositório LIVRO-CAIXA.

O objetivo principal é:

- preservar funcionalidades existentes;
- evitar regressões;
- evitar duplicação de lógica;
- reduzir alterações desnecessárias;
- impedir refatorações não solicitadas;
- manter compatibilidade com os dados existentes;
- tornar mudanças rastreáveis e reversíveis;
- fazer o agente verificar o estado atual do código antes de assumir qualquer coisa;
- separar fatos atuais do projeto de regras permanentes de engenharia.

> **Regra fundamental:** o conteúdo deste arquivo não deve ser tratado como uma descrição eterna do código. A arquitetura real do repositório sempre tem precedência sobre descrições históricas contidas neste documento.

---

## 2. Regra de precedência

Ao trabalhar no projeto, siga esta ordem de autoridade:

1. instrução explícita do usuário para a tarefa atual;
2. comportamento real e código atualmente presente no repositório;
3. contratos públicos existentes e dados persistidos;
4. este "AGENTS.md";
5. documentação histórica, comentários, análises e auditorias antigas.

Se houver conflito entre uma informação deste arquivo e o código atual:

> **não assuma que o código está errado. Verifique primeiro.**

Se houver conflito entre uma instrução antiga e uma instrução explícita atual do usuário:

> **a instrução atual do usuário vence.**

Se a alteração solicitada entrar em conflito com uma dependência existente ou puder causar perda de dados:

> **pare antes de implementar e explique o conflito.**

---

## 3. Princípio de estado atual

Informações como:

- quantidade de arquivos;
- quantidade de linhas;
- nomes de funções;
- IDs de elementos;
- coleções;
- versões de bibliotecas;
- quantidade de módulos;
- arquitetura de navegação;
- sistemas de diagnóstico;
- nomes de variáveis;
- estratégias de sincronização;
- versões de Service Worker;
- APIs disponíveis;

podem mudar com o desenvolvimento.

Portanto:

**Nunca considere esses dados imutáveis apenas porque aparecem neste arquivo.**

Antes de modificar uma área, o agente deve:

1. localizar a implementação atual;
2. verificar se ela ainda existe;
3. verificar se existem novas implementações substitutas;
4. identificar consumidores e dependências;
5. somente então decidir como alterar o código.

---

## 4. Snapshot arquitetural

O projeto é atualmente conhecido como uma aplicação financeira web/PWA denominada:

**LIVRO-CAIXA**

O repositório está hospedado no GitHub e atualmente possui uma arquitetura predominantemente client-side.

A descrição abaixo é um snapshot, não um contrato permanente.

### Estado arquitetural conhecido

O projeto historicamente possui:

- uma aplicação SPA;
- JavaScript vanilla;
- HTML/CSS/JavaScript concentrados em arquivos principais;
- Firebase;
- Firestore;
- autenticação por Firebase;
- Service Worker;
- funcionalidades offline/parcialmente offline;
- persistência local;
- módulos de domínio isolados em determinados pontos;
- funcionalidades financeiras como contas, lançamentos, investimentos, caixinhas, metas, cartões, faturas, boletos/contas, valores a receber e orçamentos.

### Regra

Antes de assumir que qualquer uma dessas características permanece igual:

**INSPECIONE O REPOSITÓRIO ATUAL.**

O agente deve trabalhar com o estado encontrado no momento da tarefa.

---

## 5. Regra de descoberta antes de implementação

Para qualquer tarefa que envolva código existente, o agente deve seguir:

```
LOCALIZAR
↓
ENTENDER
↓
VERIFICAR DEPENDÊNCIAS
↓
PLANEJAR
↓
IMPLEMENTAR
↓
VALIDAR
```

Não começar diretamente escrevendo código.

Antes de adicionar uma função, componente, listener, patch, estado, helper ou sistema:

- pesquisar se já existe algo equivalente;
- pesquisar nomes semelhantes;
- verificar se existe implementação parcial;
- verificar se existe implementação antiga;
- verificar consumidores;
- verificar chamadas;
- verificar IDs relacionados;
- verificar se existe fluxo de persistência;
- verificar se existe renderização correspondente.

---

## 6. Regra contra duplicação

Não criar uma segunda implementação de uma funcionalidade que já existe sem justificativa explícita.

Antes de criar:

- "renderX()";
- "saveX()";
- "loadX()";
- "updateX()";
- "handleX()";
- "validateX()";
- "calculateX()";
- "openX()";
- "closeX()";
- "switchX()";
- "persistX()";
- "diagnosticX()";

pesquisar o projeto.

Se já existir uma função equivalente:

1. reutilizar;
2. estender;
3. corrigir;
4. substituir conscientemente;

em vez de criar uma cópia.

### Exceção

Uma segunda implementação somente deve existir quando:

- as responsabilidades forem realmente diferentes; ou
- houver uma migração planejada; ou
- o usuário solicitar explicitamente.

Nesse caso, documentar a razão.

---

## 7. Não fazer refatoração ampla durante uma feature

Se o usuário pedir:

> **"implemente X"**

isso significa implementar X.

Não significa automaticamente:

- reorganizar todo o projeto;
- dividir "index.html";
- reescrever a navegação;
- trocar Firebase;
- trocar bibliotecas;
- migrar framework;
- refazer CSS;
- substituir o sistema de persistência;
- reescrever autenticação;
- remover código antigo;
- alterar o modelo de dados;
- criar uma arquitetura nova.

Se uma refatoração for necessária para realizar a tarefa:

1. identifique o motivo;
2. explique o impacto;
3. faça somente a refatoração necessária;
4. preserve o comportamento existente.

Se a refatoração não for necessária:

> **não faça.**

---

## 8. Regra de mudanças mínimas

Preferir:

**menor alteração que resolve corretamente o problema**

em vez de:

**maior alteração que deixa o código "mais bonito"**

Uma alteração pequena e localizada é preferível quando produz o mesmo resultado.

Não alterar código não relacionado apenas por estilo.

---

## 9. Autenticação

Autenticação é uma área sensível.

Não alterar o fluxo de autenticação sem solicitação explícita ou necessidade comprovada pela tarefa.

Isso inclui:

- login;
- logout;
- Google;
- email/senha;
- "onAuthStateChanged";
- criação de usuário;
- sessão;
- recuperação de sessão;
- PIN local;
- WebAuthn;
- Firebase Auth;
- listeners de autenticação.

### Regra específica

Se uma tarefa não envolver autenticação:

> **não modificar o fluxo de autenticação.**

### Google Auth

O funcionamento do login Google existente deve ser preservado.

Não substituir:

- "signInWithPopup";
- provider;
- callbacks;
- listeners;

por outra estratégia simplesmente por preferência arquitetural.

Se o código atual tiver sido alterado desde a criação deste documento, considerar o fluxo encontrado no repositório como fonte de verdade.

---

## 10. Firebase e Firestore

Firebase/Firestore são áreas críticas porque podem afetar dados persistidos.

Antes de alterar:

- inicialização;
- autenticação;
- Firestore;
- listeners;
- gravação;
- carregamento;
- coleções;
- documentos;
- sincronização;
- regras de segurança;
- App Check;

o agente deve primeiro mapear o fluxo atual.

### Nunca presumir

Não assumir que:

- uma coleção pode ser renomeada;
- um campo pode ser removido;
- um documento pode mudar de estrutura;
- um ID pode mudar;
- dados podem ser apagados;
- dados podem ser reconstruídos automaticamente.

### Mudança de schema

Qualquer alteração de estrutura persistida deve considerar:

- dados antigos;
- dados novos;
- compatibilidade;
- migração;
- rollback;
- documentos incompletos;
- usuários que ainda possuem dados antigos.

Se a migração for necessária e não estiver definida:

> **parar e solicitar definição antes de executar uma alteração destrutiva.**

---

## 11. Persistência e sincronização

A persistência é uma área de alto risco.

Antes de modificar qualquer fluxo de salvamento:

1. localizar o ponto de entrada;
2. localizar o carregamento;
3. localizar listeners;
4. localizar estado intermediário;
5. localizar debounce/throttle;
6. localizar controle de concorrência;
7. localizar tratamento de erros;
8. localizar atualização da UI;
9. verificar se existe proteção contra sobrescrita de dados.

Não substituir um fluxo de persistência por outro sem compreender o ciclo completo.

### Regra de ouro

Uma alteração de UI não deve modificar a persistência apenas porque isso parece conveniente.

---

## 12. Estado global

Se o projeto utilizar estado global, não criar novos estados globais sem necessidade.

Antes de adicionar:

- `window.algumaCoisa`

ou uma nova variável global:

1. procurar estado equivalente;
2. procurar estado relacionado;
3. verificar se o estado já existe em outro escopo;
4. avaliar se o novo estado pode ser derivado do estado existente.

Preferir:

```
estado existente → transformação → UI
```

em vez de:

```
novo estado duplicado → sincronização manual → UI
```

---

## 13. Interface e DOM

IDs, classes, atributos e elementos existentes podem ser utilizados por:

- JavaScript;
- CSS;
- listeners;
- automações;
- testes;
- acessibilidade;
- Service Worker;
- outras partes do aplicativo.

Portanto:

> **não renomear ou remover IDs/classes existentes sem verificar seus consumidores.**

Antes de remover um elemento:

**buscar todas as referências**

Antes de alterar um ID:

**buscar JavaScript + CSS + referências indiretas**

---

## 14. Navegação

A navegação entre abas é uma área sensível.

O projeto pode possuir funções principais, aliases, patches ou listeners adicionais relacionados à navegação.

Não presumir que uma única função é responsável por toda a navegação.

Antes de alterar:

- "switchTab";
- navegação mobile;
- estado ativo;
- abas;
- drawer;
- patches de navegação;

localizar todas as definições e todas as chamadas.

### Regra

Não criar uma nova camada de navegação para corrigir uma existente sem primeiro entender a cadeia atual.

---

## 15. Sistema de diagnóstico

O projeto possui ou pode possuir múltiplas camadas de diagnóstico.

Não assumir que:

**diagnóstico = uma única coisa**

Podem existir, dependendo do estado atual:

- console técnico;
- LOG geral;
- verificação de consistência;
- diagnóstico por IA;
- logs locais;
- logs persistidos;
- logs relacionados à autenticação.

Antes de criar outro sistema de diagnóstico:

1. localizar os sistemas existentes;
2. determinar qual problema cada um resolve;
3. determinar onde seus dados são armazenados;
4. determinar quem os consome;
5. avaliar se a funcionalidade solicitada pertence a um sistema existente.

Não criar um quinto sistema apenas porque o quarto não foi localizado.

---

## 16. Logs

Logs não devem conter informações sensíveis desnecessárias.

Nunca registrar deliberadamente:

- senhas;
- tokens;
- credenciais;
- chaves privadas;
- códigos de autenticação;
- dados financeiros completos desnecessários;
- informações pessoais desnecessárias;
- dados que permitam acesso à conta.

Ao registrar objetos:

```
logInfo("evento", objeto);
```

avaliar se o objeto contém dados sensíveis.

Preferir logs sanitizados.

---

## 17. Diagnóstico técnico não deve alterar comportamento

Ferramentas de diagnóstico devem observar o sistema.

Não inserir instrumentação temporária que altere:

- autenticação;
- sincronização;
- persistência;
- navegação;
- valores financeiros;
- estado da aplicação.

Se instrumentação temporária for necessária para investigar um problema:

1. identificar claramente como temporária;
2. utilizá-la somente durante a investigação;
3. removê-la antes da conclusão;
4. verificar o diff final.

Não deixar:

```
TESTE DO BOTÃO
DEBUG TEMPORÁRIO
alert(...)
console.log(...)
```

no código de produção sem justificativa.

---

## 18. Card Engine

Se existir um módulo de domínio dedicado ao cálculo de cartões/faturas:

- tratá-lo como componente de domínio;
- localizar sua API pública;
- verificar consumidores;
- não duplicar seus cálculos no código principal;
- não alterar sua API sem verificar todos os consumidores.

Antes de modificar regras financeiras do motor:

1. localizar funções relacionadas;
2. identificar entradas;
3. identificar saídas;
4. identificar consumidores;
5. verificar casos de parcelamento;
6. verificar faturas;
7. verificar pagamentos;
8. verificar titulares;
9. verificar limites;
10. validar regressões.

Cálculos financeiros não devem ser alterados apenas por aparência ou simplificação.

---

## 19. Regras financeiras

LIVRO-CAIXA manipula dados financeiros.

Qualquer cálculo deve ser tratado como lógica de domínio.

Não alterar silenciosamente:

- saldos;
- entradas;
- saídas;
- limites;
- faturas;
- parcelas;
- investimentos;
- rendimentos;
- metas;
- caixinhas;
- valores a receber;
- orçamentos;
- vencimentos.

Antes de alterar uma regra financeira, identificar:

```
entrada
↓
regra
↓
resultado
↓
persistência
↓
renderização
```

Se a mudança alterar um resultado financeiro existente, demonstrar pelo menos um caso antes/depois.

---

## 20. Metas e Caixinhas

Metas e Caixinhas são conceitos distintos.

Uma funcionalidade nova deve respeitar a separação conceitual existente.

Uma meta pode possuir relacionamento com uma caixinha, caso essa seja a regra atualmente implementada.

Porém:

> **não assumir que a barra de progresso de uma caixinha e o progresso de uma meta representam a mesma entidade.**

Antes de alterar essa área, localizar a implementação atual e determinar:

- origem do valor;
- objetivo;
- progresso;
- vínculo;
- atualização automática;
- comportamento quando a caixinha muda;
- comportamento quando a meta muda;
- comportamento quando o vínculo é removido.

Não duplicar valores quando eles podem ser derivados de uma fonte existente.

---

## 21. Valores derivados

Quando uma informação pode ser calculada a partir de uma fonte de verdade, preferir derivação.

Exemplo conceitual:

```
fonte de verdade
        ↓
      cálculo
        ↓
      display
```

Evitar:

```
fonte A
   ↓
valor armazenado B
   ↓
valor armazenado C
   ↓
sincronização manual
```

Isso é especialmente importante para:

- progresso;
- saldos;
- percentuais;
- totais;
- limites;
- status;
- contadores;
- valores de fatura;
- valores de metas.

Entretanto, não converter automaticamente um campo persistido em valor derivado sem avaliar compatibilidade com dados existentes.

---

## 22. Service Worker e PWA

O Service Worker deve ser tratado como parte crítica do funcionamento da aplicação.

Antes de alterar:

- cache;
- estratégia de atualização;
- "CACHE_NAME";
- arquivos precacheados;
- fetch handlers;
- instalação;
- ativação;

verificar o comportamento atual.

Não incrementar a versão do cache arbitrariamente.

Não alterar a estratégia offline apenas para resolver um problema de desenvolvimento local sem entender o impacto em produção.

---

## 23. Dependências externas

Antes de atualizar uma biblioteca:

1. verificar versão atual;
2. localizar todos os consumidores;
3. verificar compatibilidade;
4. verificar breaking changes;
5. testar as funcionalidades afetadas.

Não atualizar bibliotecas "porque estão antigas" durante uma tarefa não relacionada.

Também não substituir CDN, biblioteca ou fornecedor sem solicitação ou justificativa técnica necessária.

---

## 24. Segurança

Nunca adicionar segredos reais ao código.

Não criar commits contendo:

- senhas;
- tokens privados;
- service account keys;
- chaves privadas;
- credenciais;
- arquivos ".env" sensíveis;
- dumps de banco;
- dados pessoais de usuários.

Configurações públicas necessárias ao frontend podem existir no código, mas isso não autoriza adicionar novos segredos.

Nunca copiar credenciais encontradas durante uma investigação para:

- "AGENTS.md";
- documentação;
- logs;
- issues;
- respostas;
- arquivos de teste.

---

## 25. Dados financeiros e privacidade

O LIVRO-CAIXA pode conter informações financeiras pessoais.

Ao criar:

- logs;
- exemplos;
- fixtures;
- testes;
- screenshots;
- documentação;

não utilizar dados financeiros reais se dados fictícios forem suficientes.

Quando necessário, anonimizar ou substituir valores.

---

## 26. Arquivos de backup

Arquivos como:

- `*.backup-*`
- `*.bak-*`

podem existir durante o desenvolvimento.

- Não remover automaticamente.
- Não adicionar backups ao Git.
- Não alterar backups para "manter tudo atualizado".

Se houver necessidade de restaurar um backup:

1. identificar a origem;
2. comparar com o estado atual;
3. verificar a diferença;
4. restaurar conscientemente.

---

## 27. Git

O agente deve tratar Git como mecanismo de segurança.

Antes de alterações significativas:

```
git status --short
```

Depois das alterações:

```
git status --short
git diff --stat
git diff
```

Nunca executar automaticamente:

```
git push
```

Nunca criar commit automaticamente.

**a menos que o usuário peça explicitamente.**

O agente deve deixar claro:

- arquivos alterados;
- arquivos criados;
- arquivos removidos;
- resumo das mudanças;
- validações realizadas.

---

## 28. Não sobrescrever trabalho do usuário

Se "git status" mostrar alterações existentes antes da tarefa:

> **não assumir que essas alterações pertencem ao agente.**

Não:

- apagar;
- resetar;
- checkoutar;
- sobrescrever;
- restaurar;

alterações pré-existentes sem autorização.

Se uma alteração existente entrar em conflito com a tarefa:

> **informar o conflito antes de modificar a área.**

---

## 29. Backups antes de alterações arriscadas

Para alterações extensas ou de alto risco, criar backup somente quando isso realmente aumentar a segurança.

Exemplos de alto risco:

- grande edição em "index.html";
- alteração do modelo de dados;
- alteração de persistência;
- migração;
- alteração de autenticação;
- alteração de Service Worker;
- alteração extensa de CSS.

Não criar dezenas de backups redundantes.

---

## 30. Validação JavaScript

Sempre que JavaScript for alterado, validar sintaxe.

Para arquivos ".js" compatíveis com Node:

```
node --check arquivo.js
```

Para JavaScript inline dentro de HTML, extrair ou utilizar um método apropriado para validar o conteúdo antes de considerar a tarefa concluída.

Uma alteração de sintaxe não pode ser considerada concluída apenas porque o editor não mostrou erro.

---

## 31. Validação funcional

Sempre que possível, validar:

### Sintaxe

- JavaScript válido

### Estrutura

- IDs existentes
- funções existentes
- listeners conectados
- referências válidas

### Fluxo

```
entrada
→ processamento
→ estado
→ persistência
→ UI
```

### Regressão

Verificar especialmente funcionalidades próximas da área modificada.

---

## 32. Testes quando não houver suíte formal

Se o projeto não possuir testes automatizados para determinada área:

**não interpretar isso como ausência de necessidade de validação.**

Criar uma estratégia de teste proporcional à alteração.

### Exemplos:

**Alteração de UI** — Verificar:

- desktop;
- mobile;
- tema claro;
- tema escuro;
- estados vazio/preenchido;
- modal/drawer quando aplicável.

**Alteração financeira** — Verificar:

- valor zero;
- valor positivo;
- valor negativo quando aplicável;
- limite;
- arredondamento;
- datas;
- estado inicial;
- estado após alteração.

**Alteração de persistência** — Verificar:

- criação;
- atualização;
- carregamento;
- reload;
- sincronização;
- ausência de duplicação.

**Alteração de autenticação** — Verificar:

- login;
- logout;
- sessão;
- usuário não autenticado;
- usuário autenticado.

---

## 33. Alterações destrutivas

Considerar destrutivas:

- apagar dados;
- remover campos persistidos;
- renomear coleções;
- substituir IDs;
- remover funcionalidades;
- eliminar listeners;
- eliminar compatibilidade;
- mudar significado de um campo existente.

Não executar mudanças destrutivas sem confirmação quando elas não forem claramente exigidas pela tarefa.

---

## 34. Migrações

Quando uma alteração exigir migração, documentar:

```
ESTADO ANTIGO
↓
TRANSFORMAÇÃO
↓
ESTADO NOVO
```

A migração deve considerar:

- dados incompletos;
- dados antigos;
- usuários que ainda não abriram a versão nova;
- execução repetida;
- falha durante migração;
- compatibilidade;
- rollback quando possível.

Uma migração deve ser idempotente sempre que tecnicamente possível.

---

## 35. Compatibilidade retroativa

Ao adicionar novos campos:

**preferir defaults seguros.**

Exemplo conceitual:

```js
const value = existing.value ?? defaultValue;
```

em vez de presumir que todos os documentos existentes possuem o novo campo.

Ao adicionar novas estruturas:

- documento antigo → continua funcionando
- documento novo → usa recurso novo

sempre que possível.

---

## 36. Feature flags e comportamento opcional

Quando uma funcionalidade experimental ou nova precisar coexistir com a antiga:

preferir uma estratégia explícita de controle.

Não espalhar condições arbitrárias pelo código.

Se houver uma configuração ou feature flag existente, reutilizá-la.

Não criar outra configuração com finalidade equivalente.

---

## 37. HTML, CSS e JavaScript

Quando uma alteração envolver os três:

identificar claramente:

- **HTML** → estrutura
- **CSS** → apresentação
- **JS** → comportamento

Não utilizar JavaScript para substituir CSS sem necessidade.

Não duplicar estilos inline quando existir uma classe apropriada.

Não criar dezenas de classes apenas para uma alteração simples.

Ao alterar CSS global:

verificar possíveis efeitos em outras telas.

---

## 38. Responsividade

O LIVRO-CAIXA deve continuar utilizável em:

- telas pequenas;
- dispositivos móveis;
- desktop;
- diferentes orientações quando aplicável.

Uma alteração visual não deve ser validada somente em desktop.

Especialmente verificar:

- cards;
- tabelas;
- modais;
- drawers;
- navegação;
- botões;
- inputs;
- gráficos;
- textos longos.

---

## 39. Acessibilidade

Ao criar ou modificar componentes:

considerar:

- foco;
- teclado;
- contraste;
- labels;
- aria quando necessário;
- botões semanticamente corretos;
- estados de abertura/fechamento;
- leitura de mensagens de erro.

Não remover atributos de acessibilidade existentes sem justificativa.

---

## 40. Internacionalização e formato financeiro

Valores monetários devem respeitar o padrão utilizado pelo aplicativo.

Não introduzir formatos diferentes para a mesma informação.

Antes de alterar formatação:

localizar a função utilitária existente.

Não criar outro:

```
formatCurrency()
```

se já existir um formatador equivalente.

---

## 41. Datas

Datas são especialmente sensíveis em:

- contas;
- vencimentos;
- parcelas;
- faturas;
- investimentos;
- metas;
- recorrências.

Antes de modificar tratamento de datas:

verificar:

- timezone;
- formato persistido;
- formato exibido;
- comparação;
- vencimento;
- recorrência;
- início/fim do mês.

Não substituir automaticamente datas locais por UTC ou vice-versa.

---

## 42. Performance

Não otimizar prematuramente.

Primeiro identificar:

```
problema real
↓
causa
↓
impacto
↓
solução
```

Não introduzir:

- cache;
- memoização;
- debounce;
- throttle;
- virtualização;
- workers;

sem necessidade demonstrável ou sem compreender os efeitos sobre consistência.

---

## 43. Código legado

Código antigo não deve ser removido simplesmente porque parece desnecessário.

Antes de remover:

1. procurar referências;
2. verificar consumidores;
3. verificar compatibilidade;
4. verificar dados antigos;
5. verificar se é fallback;
6. verificar se é usado por versões anteriores;
7. verificar se é código morto de fato.

Se não for possível provar que é seguro remover:

> **não remover silenciosamente.**

---

## 44. Patches e compatibilidade

Se o projeto possuir patches aplicados posteriormente no carregamento:

não removê-los automaticamente.

Primeiro entender:

```
implementação original
↓
patch
↓
consumidores
```

Se a intenção for eliminar um patch:

1. localizar a causa original;
2. incorporar a correção na implementação correta;
3. validar consumidores;
4. remover o patch somente após garantir equivalência.

---

## 45. Auditorias

Auditorias são documentos de diagnóstico.

Uma auditoria antiga:

> **não é automaticamente uma especificação.**

Ela pode estar desatualizada.

Antes de usar uma auditoria para implementar algo:

1. verificar o código atual;
2. verificar se o problema ainda existe;
3. verificar se já foi corrigido;
4. verificar se a arquitetura mudou.

---

## 46. Como lidar com informações conflitantes

Se encontrar:

```
AGENTS.md diz X
código diz Y
```

não corrigir automaticamente o código.

Primeiro determinar:

- X está desatualizado?
- Y é uma regressão?
- houve migração?
- existe implementação paralela?
- existe compatibilidade intencional?

Quando a resposta não for evidente:

> **reportar a ambiguidade ao usuário.**

---

## 47. Regra para tarefas ambíguas

Se a solicitação do usuário puder ser interpretada de duas maneiras e as duas produzirem resultados significativamente diferentes:

**não escolher arbitrariamente.**

Exemplo:

> **"remova o diagnóstico"**

Isso pode significar:

- remover botão;
- remover UI;
- remover logs;
- remover sistema técnico;
- remover diagnóstico por IA;
- remover todos os sistemas.

O agente deve identificar a ambiguidade.

Se houver uma interpretação claramente indicada pelo contexto, seguir essa interpretação e declarar o entendimento.

---

## 48. Regra para pedidos de "melhorar"

Pedidos genéricos como:

> **"melhore o código"**

não autorizam:

- reescrever arquitetura;
- remover funcionalidades;
- alterar comportamento financeiro;
- migrar framework;
- mudar banco;
- alterar autenticação.

Primeiro realizar uma análise.

Apresentar:

- problema
- impacto
- proposta
- arquivos afetados
- risco

e só então implementar após definição do escopo.

---

## 49. Uso de IA dentro do aplicativo

Se houver integração com IA/Gemini ou outro serviço:

não assumir que a integração existente é a única fonte de inteligência.

Antes de alterar:

- provider;
- modelo;
- prompts;
- chamadas;
- autenticação;
- App Check;
- tratamento de respostas;

localizar a implementação atual.

Não expor chaves privadas no frontend.

Não enviar dados financeiros para serviços externos sem que isso faça parte explicitamente do comportamento autorizado do recurso.

---

## 50. Regra de privacidade para IA

Antes de enviar dados financeiros para uma API de IA:

identificar exatamente:

```
quais dados
↓
por que são enviados
↓
para qual serviço
↓
em qual momento
↓
qual resposta é esperada
```

Evitar enviar dados que não sejam necessários para a tarefa.

---

## 51. Documentação

Documentação deve explicar:

- decisões;
- contratos;
- comportamentos;
- limitações;
- migrações;
- motivos importantes.

Não transformar documentação em cópia integral do código.

Não registrar informações que envelhecem rapidamente como se fossem regras permanentes.

Quando uma informação for temporal, usar linguagem como:

> **"No momento desta documentação..."**

ou:

> **"Verifique o código atual antes de assumir..."**

---

## 52. Regra para este AGENTS.md

O próprio "AGENTS.md" deve ser mantido pequeno o suficiente para continuar útil.

Não adicionar ao arquivo:

- cada bug corrigido;
- cada commit;
- cada alteração visual;
- cada nome de função temporário;
- versões passageiras;
- detalhes que mudam semanalmente.

Essas informações pertencem a:

- commits;
- documentação específica;
- changelog;
- auditorias;
- issues;
- relatórios de implementação.

---

## 53. Fluxo obrigatório para implementação

Para uma tarefa normal:

### Fase 1 — Inspeção

```
git status
↓
identificar arquivos relevantes
↓
buscar implementação existente
↓
buscar consumidores
↓
entender fluxo
```

### Fase 2 — Planejamento

Definir:

- o que será alterado;
- o que não será alterado;
- dependências;
- riscos;
- validação.

### Fase 3 — Implementação

Alterar somente o necessário.

### Fase 4 — Validação

Executar:

- validação de sintaxe;
- testes disponíveis;
- verificações específicas;
- revisão de referências.

### Fase 5 — Diff

Verificar:

```
git status --short
git diff --stat
git diff
```

### Fase 6 — Relatório

Informar:

- **Arquivos alterados:**
- **Arquivos criados:**
- **Arquivos removidos:**

- **O que foi feito:**
- **O que não foi alterado:**
- **Validações:**
- **Resultado:**
- **Riscos conhecidos:**
- **Próximos passos, se houver:**

---

## 54. Regra de rollback

Toda alteração significativa deve ser reversível.

Antes de concluir uma alteração importante, o agente deve saber responder:

> **"Como voltar ao estado anterior?"**

Isso pode ser feito por:

- Git;
- backup;
- migração reversível;
- alteração isolada;
- feature flag.

Não executar mudanças irreversíveis sem necessidade.

---

## 55. Regra de parada

O agente deve parar e pedir orientação quando encontrar:

- risco de perda de dados;
- conflito entre duas fontes de verdade;
- alteração de schema não especificada;
- conflito com trabalho não commitado do usuário;
- autenticação afetada sem autorização;
- mudança financeira cujo comportamento esperado não esteja definido;
- remoção de funcionalidade sem autorização;
- ambiguidade relevante;
- necessidade de credenciais privadas;
- necessidade de alterar infraestrutura externa não disponível.

**Parar é preferível a assumir.**

---

## 56. O que o agente NÃO deve fazer por iniciativa própria

Sem solicitação explícita, não:

- trocar framework;
- trocar banco;
- trocar Firebase;
- trocar autenticação;
- alterar regras financeiras;
- remover funcionalidades;
- apagar dados;
- fazer migrações;
- alterar schema;
- atualizar dependências;
- reorganizar todo o projeto;
- dividir arquivos;
- criar uma nova arquitetura;
- criar sistemas paralelos;
- alterar o design global;
- mudar comportamento de telas não relacionadas;
- fazer "git push";
- criar commit;
- apagar alterações do usuário.

---

## 57. O que o agente DEVE fazer por iniciativa própria

Pode e deve:

- pesquisar antes de criar;
- verificar dependências;
- detectar duplicações;
- validar sintaxe;
- revisar o diff;
- apontar riscos;
- identificar regressões prováveis;
- preservar compatibilidade;
- criar testes quando apropriado;
- remover instrumentação temporária;
- informar limitações;
- informar quando uma decisão precisa do usuário.

---

## 58. Critério de conclusão

Uma tarefa não está concluída simplesmente porque:

**o código foi alterado**

Ela está concluída quando:

- requisito atendido
- **+**
- código válido
- **+**
- fluxo coerente
- **+**
- regressões relevantes verificadas
- **+**
- diff revisado
- **+**
- limitações informadas

---

## 59. Princípio final

O agente deve tratar o LIVRO-CAIXA como um sistema financeiro real, com dados persistentes e funcionalidades interdependentes.

Portanto:

> **entender antes de alterar.**

> **reutilizar antes de duplicar.**

> **preservar antes de refatorar.**

> **validar antes de concluir.**

> **perguntar antes de assumir quando houver risco.**

E, principalmente:

> **o estado atual do repositório é a fonte de verdade sobre a implementação atual. Este arquivo define como trabalhar no projeto, não uma fotografia permanente de como o projeto deve ser.**
