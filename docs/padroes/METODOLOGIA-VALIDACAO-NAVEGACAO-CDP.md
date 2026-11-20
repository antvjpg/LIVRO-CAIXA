# METODOLOGIA — Validação funcional da navegação via CDP (Termux/Android)

> Documento de método reutilizável para as divergências D-01 a D-08 do plano
> `Plano de implementação — divergências D-01 a D-08 — App Navigation Redesign`.
> Registra o procedimento que produziu evidências reais no D-01 (13 PASS / 0 FAIL),
> de modo que D-02 em diante possam reproduzir o mesmo rigor.

## 1. Por que esta metodologia existe

O ambiente Termux/Android não tem rede para os CDNs usados pelo `index.html`
(Firebase, Flaticon, jsPDF, Chart.js etc.). Os scripts externos são **síncronos**
no `<head>`, então o parser HTML trava antes de chegar na `<nav>` (que fica no fim
do `<body>`). Consequência observada no diagnóstico:

```json
{"readyState":"loading","hasNav":false,"navButtons":0,"bodyStart":"<div id=\"authOverlay\"..."}
```

Além disso, sem Firebase a linha `firebase.initializeApp(firebaseConfig)` em
`js/00-bootstrap.js` lança, e as globais da aplicação (`currentUser`, `TAB_NAMES`,
`window.switchTab`) nunca são declaradas. Tentar validar sem tratar isso gera
falso negativo (`currentUser is not defined`) — exatamente o tipo de erro que
levou a C.4 a ser reprovada na auditoria independente.

**Princípio:** não simular o harness nem fabricar nós DOM. O que se faz é
**preparar o ambiente de execução** para que o **código real da aplicação**
inicialize e seja inspecionado no contexto correto da página.

## 2. Regra de ouro (aplicável a toda divergência D)

| Fazer | Não fazer |
|---|---|
| Rodar o **JS real** da aplicação (`switchTabOriginal`, `updateNavIndicator`, listeners) | Reimplementar funções do app dentro do script de teste |
| Usar `Runtime.evaluate` para consultar DOM **no contexto da página** | Usar objetos `DOM.Node` do CDP como se fossem elementos JavaScript (`tagName`, `className`) |
| Ler estilos com `getComputedStyle(el)` **dentro da página** | Usar `CSS.getComputedStyleForNode(...).style` (a resposta é `.computedStyle`) |
| Abortar apenas recursos externos; servir arquivos locais pelo HTTP :8000 | Bloquear os scripts locais do app |
| Injzar stub **mínimo e sem dados** do Firebase para destravar o bootstrap | Colocar credenciais reais, dados financeiros ou `onAuthStateChanged` falso com usuário |
| Derivar contagens dos registros individuais | Informar contagens manualmente |
| Declarar BLOCKED / NOT RUN quando o ambiente não permitir | Declarar PASS sem execução real |

## 3. Ambiente

- Servidor HTTP local já ativo: `python3 -m http.server 8000 --bind 127.0.0.1`
  (verificar com `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/index.html` → `200`).
- Chromium headless com CDP na porta 9222.
- Node.js com `chrome-remote-interface` (`node_modules` da raiz).

### 3.1 Inicialização que funciona no Termux

O processo Chromium **morre quando o comando bash retorna**. Portanto, iniciar o
browser e executar a validação **no mesmo comando**:

```bash
chromium-browser --headless=new --no-sandbox --remote-debugging-port=9222 \
  --user-data-dir=/data/data/com.termux/files/home/.cache/c4-chrome-d01X \
  & CHROME_PID=$!; sleep 10; node ./tmp-c13/<script>.cjs; \
  kill $CHROME_PID 2>/dev/null; pkill -f "remote-debugging-port=9222" 2>/dev/null
```

Use um `--user-data-dir` diferente por execução para evitar conflito de perfil.

## 4. Procedimento padrão (copiar e adaptar por divergência)

### Passo A — Bloquear recursos externos

```js
const { Page, Runtime, Network, Fetch } = client;
await Runtime.enable();
await Page.enable();
await Network.enable();
await Fetch.enable({ patterns: [{ urlPattern: '*', requestStage: 'Request' }] });

Fetch.requestPaused(async ({ requestId, request }) => {
  const isLocal = request.url.startsWith('http://127.0.0.1:8000') ||
                  request.url.startsWith('data:') ||
                  request.url.startsWith('about:');
  try {
    isLocal ? await Fetch.continueRequest({ requestId })
            : await Fetch.failRequest({ requestId, errorReason: 'Failed' });
  } catch (e) {}
});
```

### Passo B — Injetar stub mínimo do Firebase **antes** dos scripts da página

```js
await Page.addScriptToEvaluateOnNewDocument({ source: `
  (function(){
    function noop(){ return { catch(){return this;}, then(){return this;} }; }
    var stubAuth = {
      onAuthStateChanged: function(cb){ try{ cb(null); }catch(e){} return function(){}; },
      currentUser: null,
      signInWithPopup: function(){ return Promise.reject(new Error('stub')); },
      signOut: function(){ return Promise.resolve(); }
    };
    stubAuth.GoogleAuthProvider = function(){ this.addScope = function(){ return this; }; };
    var firestoreStub = {
      enablePersistence: function(){ return { catch: noop }; },
      collection: function(){ return { doc: function(){ return {
        get: function(){ return Promise.resolve({ exists:false, data:function(){return {};} }); },
        set: function(){ return Promise.resolve(); },
        onSnapshot: function(){ return function(){}; }
      }; } }; }
    };
    window.firebase = {
      initializeApp: function(){},
      auth: function(){ return stubAuth; },
      firestore: function(){ return firestoreStub; },
      apps: []
    };
  })();
` });
```

Isso permite que `00-bootstrap.js` e `99-init.js` rodem **de verdade**. Não há
usuário autenticado, logo funções que dependem de `currentUser.uid` não devem ser
invocadas nestes testes (ex.: renderização financeira completa).

### Passo C — Avaliar no contexto da página

```js
async function evalInPage(expression) {
  const r = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
```

Helper de espera (o DOM pode levar até ~12 s com os CDNs abortados):

```js
let ready = false;
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 300));
  try { ready = await evalInPage(`!!document.querySelector('.mobile-bottom-nav button[data-destination]')`); }
  catch (e) {}
  if (ready) break;
}
if (!ready) throw new Error('Elemento alvo não apareceu no DOM');
```

### Passo D — Registrar evidências

Cada verificação deve gerar um registro com:
`id`, `descrição`, `resultado esperado`, `resultado observado`, `status` (PASS / FAIL / BLOCKED / NOT RUN).

Salvar:
- JSON individual em `tmp-c13/<d-xx>-validacao-resultados.json`
- (quando aplicável) log bruto em `tmp-c13/<d-xx>-validacao.log`
- `meta` com: task, URL, timestamp, browser/versão, método, **nota sobre externos bloqueados e stub Firebase**

### Passo E — Revisar diff e erros de console

```bash
git diff --stat HEAD
git diff
```

Filtrar erros de console relacionados ao escopo (ex.: `/nav|tab|switch|indicator|destination/i`).
Erros de recursos externos abortados **não** contam como regressão — registrá-los na nota metodológica.

## 5. Aplicação no D-01 (referência de resultado)

Script: `tmp-c13/d01-validacao.cjs`
Resultado: `tmp-c13/d01-validacao-resultados.json`

| ID | Verificação | Status |
|---|---|---|
| V1 | Barra com exatamente 5 destinos (`inicio,pockets,caixa,invest,profile`) | PASS |
| V2 | Primeiro destino `inicio`, ícone `fi fi-rr-home`, `aria-label="Início"` | PASS |
| V3 | `#viewInicio` existe no DOM | PASS |
| V3b | `window.switchTab` disponível | PASS |
| V4 | `switchTab('inicio')` → view ativa, `is-active`, `navActive=inicio`, indicador `0%` | PASS |
| V5-* | `pockets`, `caixa`, `invest`, `profile` navegam e marcam `is-active` | PASS |
| V6a | `sessionStorage['livrocaixa_last_tab'] === 'inicio'` | PASS |
| V6b | Após reload, Início é restaurado | PASS |
| V7 | `dashboard` legado acessível via `switchTab` | PASS |
| V8 | 0 erros de console relacionados à navegação | PASS |

**Total: 13 PASS / 0 FAIL / 13 verificações.**

Evidência da associação elemento↔nodeId↔view: o próprio `Runtime.evaluate`
retorna `viewInicioActive` (view), `isActive`/`navActive` (elemento) e `indicatorX`
(posição) no mesmo objeto atômico, lido no contexto da página real.

## 5.1 Decisão sobre acesso ao Firebase (registrada 20/11/2026)

Foi investigado se o ambiente poderia ter acesso real ao Firebase para validar
renderizadores com dados autênticos. Achados (fatos observados):

- **Rede disponível**: CDN do Firebase (`gstatic.com/firebasejs/10.12.2/...`)
  responde HTTP 200 (~0,5 s); endpoints do Firestore/Google APIs são
  alcançáveis. O bloqueio anterior não era do Termux — era o `Fetch.failRequest`
  desta própria metodologia abortando recursos externos.
- **Infraestrutura QA existente (não utilizada)**: `e2e/helpers/identity.cjs` e
  `global-setup.cjs` geram conta efêmera `code-qa-<run>-<sufixo>@livrocaixa.test`
  com senha apenas em memória; `qa-account.cjs` faz signup/login pela UI real
  (`#authEmail`/`#authPass`/`#authSubmit`) usando Firebase Auth real
  (`createUserWithEmailAndPassword` / `signInWithEmailAndPassword` em
  `js/99-init.js:3534-3535`). As regras do Firestore exigem
  `request.auth.uid == userId`, isolando os dados por conta.
- **Bloqueio real**: Playwright falha com `Unsupported platform: android`. O que
  funciona é Chromium headless + CDP (`chrome-remote-interface`).
- **Sem emulator local**: `firebase CLI` não está instalado; não há Firebase
  Emulator Suite. Qualquer acesso real seria ao projeto **`livro-caixa-54357`**.

### Decisão adotada — Opção A (dados sintéticos determinísticos via CDP)

Para complementar a validação de renderizadores (D-03 em diante), adota-se a
injeção de **dados de teste controlados** no escopo da página via
`Runtime.evaluate`, preservando o renderizador **real** da aplicação.

**Justificativa:** é input de teste, não mock do renderizador nem do harness —
o código de cálculo/montagem continua sendo o da aplicação. É 100% reproduzível,
não exige credenciais, não escreve no Firebase e não expõe dados reais. Isso
cobre a lacuna declarada no D-03 (o caso "com pagamento" não havia sido
exercitado) sem os riscos da Opção B.

**Como aplicar:** antes de chamar `renderAdvancedDashboard()`, injetar dados
no escopo da página com `Runtime.evaluate`, por exemplo:

```js
await ev(`(function(){
  const bill = {
    id: 'qa-d04-bill', name: 'Conta QA sintética', amount: 123.45,
    active: true, dueDay: 15, /* campos conforme contrato de recurringBills */
  };
  recurringBills = [bill];
  window.__C4_SYNTHETIC_BILLS__ = true;
})()`);
await ev(`renderAdvancedDashboard()`);
```

Ao final, **limpar** os dados injetados (`recurringBills = []`) ou recarregar a
página, para não contaminar verificações seguintes. Registrar no JSON de
evidências: `meta.dados = 'sintéticos determinísticos (Opção A)'`.

**Opção B (não adotada sem autorização explícita):** carregar o SDK real e criar
conta QA + semear fatura via Firestore REST no projeto `livro-caixa-54357`, com
cleanup no teardown. Envolve escrita no projeto real — só mediante autorização
do usuário e com riscos de cleanup explicitamente aceitos.

## 6. Limitações conhecidas (declarar em todo relatório)

1. Firebase real não inicializa neste método: autenticação, Firestore e
   carregamento/persistência dependente de `currentUser.uid` **não são
   validados**. Renderizadores são exercitados com o código real da aplicação,
   mas com dados sintéticos determinísticos (Opção A, seção 5.1) — nunca com
   dados do Firestore. Sincronização ponta a ponta permanece fora de escopo até
   eventual autorização da Opção B.
2. Recursos externos (CDN) são abortados: fontes, ícones e bibliotecas de
   exportação não são carregados. Ícones são validados por presença da classe
   no HTML e no catálogo do projeto, não por renderização visual do CDN.
3. Validação visual (contraste, overflow, responsividade) pertence à **D-05** e
   exige baseline com rede/dispositivo — não deve ser inferida aqui.
4. Dados financeiros reais não são usados em nenhuma evidência.

## 7. Checklist rápido por divergência

- [ ] Branch `feat/app-navigation-redesign`, HEAD conferido, working tree limpo no início
- [ ] Arquivos autorizados pela D confirmados antes de editar
- [ ] Contrato existente rastreado (quem chama, quem renderiza,onde persiste)
- [ ] Diff mínimo, sem duplicar mecanismo
- [ ] `node --check` em todo `.js` alterado
- [ ] Validação CDP executada com este método (ou BLOCKED declarado)
- [ ] Contagens derivadas dos registros
- [ ] `git status --short` e `git diff` revisados
- [ ] Commit/push **somente com autorização explícita** do usuário
