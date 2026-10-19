# Auditoria visual dos modais — desktop

> Documento técnico da auditoria e das alterações realizadas.
> Data: 19/10/2026 · Viewport: **1440×900** · Chromium 153 (Playwright) · Tema claro.

---

## 1. Escopo

Validação visual dos **26 modais** do aplicativo em desktop, com captura de tela e
medições objetivas de layout. O objetivo foi encontrar problemas reais — conteúdo
cortado, overflow, controles inacessíveis, inconsistências — e não apenas gerar imagens.

Modais cobertos: todos os `panel*` abertos por `openModal()` (`js/24-automation-render.js:279`),
incluindo `panelCustomPeriod`, que **não existe no `index.html`**: é criado dinamicamente
em `js/24-automation-render.js:300` e por isso não aparece numa varredura estática do HTML.

---

## 2. O que foi alterado no repositório

| Arquivo | Ação | Situação | Resumo |
|---|---|---|---|
| `AGENTS.md` | alterado | commit `d7b1579` (main) | §4: removida a afirmação de que existe `app.js`; registrado o split real em `js/00-bootstrap.js`…`js/33-mcp-bridge.js`, `js/99-init.js`, `patches.js` e CSS em `style/*.css` |
| `index.html` | alterado | **commitado** | 4 correções visuais (ver §3) |
| `style/features.css` | alterado | **commitado** | 5 correções visuais (ver §3) |
| `style/components.css` | alterado | **commitado** | 1 estado vazio (ver §3) |
| `e2e/visual/audit-modais.cjs` | criado | **commitado** | harness de auditoria visual (417 linhas) |
| `e2e/visual/saida/auditoria-modais.json` | gerado | **commitado** | métricas por modal |
| `e2e/visual/saida/RELATORIO.md` | gerado | **commitado** | resumo tabular da execução |
| `e2e/visual/AUDITORIA-VISUAL-MODAIS.md` | criado | **commitado** | este documento |

**Alterações de produção restritas a apresentação:** `index.html` + `style/features.css` +
`style/components.css`. Nenhum ID, classe, listener, regra financeira ou fluxo de
persistência foi alterado. Não houve push.

Os prints (PNGs) foram **apagados após a análise**, conforme solicitado. Eles são
regenerados a qualquer momento pela execução do harness.

---

## 3. Correções aplicadas

### 3.1 `index.html:1393` — botão Word sozinho na segunda linha

O modal "Exportar Extrato" usa `grid-template-columns: 1fr 1fr` com **três** botões.
O terceiro (Word) caía sozinho na segunda linha, ocupando metade da largura e deixando
um vazio à direita.

```diff
- <button class="primary" id="btnExportFormatDocx">…Word (.docx)</button>
+ <button class="primary" id="btnExportFormatDocx" style="grid-column:1/-1;">…Word (.docx)</button>
```

Resultado: PDF e Excel lado a lado; Word em largura total. Validado por screenshot.

### 3.2 `index.html:1527` — rótulo duplicado no chat da LIA

O campo tinha rótulo `Pergunte sobre suas finanças` **e** placeholder quase idêntico
(`Pergunte sobre suas finanças…`), repetindo a mesma frase duas vezes na mesma linha.

```diff
- placeholder="Pergunte sobre suas finanças…"
+ placeholder="Ex: quanto gastei em mercado este mês?"
```

O `<label>` foi mantido (acessibilidade); apenas o placeholder passou a dar um exemplo.

### 3.3 `style/features.css` — campos de filtro com aparência de botão

O trigger de banco/categoria tinha 52px contra 48px dos selects vizinhos, herdava
`text-transform:uppercase` da regra global `button` (`style/components.css:44`) e usava
seta verde de 15px em vez do chevron neutro dos campos.

```diff
- min-height:52px;
+ min-height:48px;
+ text-transform:none;
+ #panelFiltros .filter-choice-trigger>b{color:var(--ink-soft);font-size:13px;}
+ #panelFiltros .filter-choice-trigger>b i{font-size:13px;}
```

### 3.4 `style/features.css` — raios divergentes em "Colar texto do extrato"

Três botões no mesmo modal com raios `999px`, `4px` e `11px`. O botão de área de
transferência passou a usar `4px`, igual ao "Cancelar" ao lado.

```diff
+ #panelPaste .emoji-native-toggle{border-radius:4px;}
```

### 3.5 `style/features.css` — "Cancelar" do compartilhamento era link solto

Era o único modal em que a ação de cancelar não tinha borda nem fundo. Passou a usar
o mesmo tratamento dos botões secundários (borda `--action-border`, fundo
`--surface-raised`, raio 4px).

```diff
- .bill-share-cancel{...background:transparent;border:0;color:var(--ink-soft);...}
+ .bill-share-cancel{...background:var(--surface-raised);border:1px solid var(--action-border);border-radius:4px;color:var(--ink);...}
```

### 3.6 `index.html` — campo espremido em "Conciliar com a corretora"

O `<div>` do saldo ocupava 1 de 4 colunas do `form-grid` (153px num modal de 700px) e
o rótulo quebrava em duas linhas. Passou a ocupar a linha inteira, com o input limitado
a 320px para não virar uma barra desproporcional.

```diff
- <div>
+ <div style="grid-column:1/-1;">
-   <input type="number" id="crSaldoReal" ...>
+   <input type="number" id="crSaldoReal" ... style="max-width:320px">
```

### 3.7 `index.html` + `style/features.css` — vazio lateral na calculadora do LABS

Benchmark e "Taxa personalizada" ocupavam 1 coluna cada num grid de 4, deixando duas
colunas inteiras vazias e 4 linhas de altura. Ambos passaram a ocupar a linha inteira;
os checkboxes ficam em uma única linha.

```diff
+ .compound-calc .ci-benchmark-cell,
+ .compound-calc .ci-custom-rate-cell{grid-column:1/-1;}
+ .compound-calc .ci-custom-rate-cell input{max-width:320px;}
```

### 3.8 `style/features.css` + `style/components.css` — caixas vazias sem mensagem

`#exportPreview` e `#importSummary` têm borda e padding e apareciam como retângulos
vazios. Agora exibem um estado vazio real, que desaparece automaticamente quando o JS
injeta conteúdo (`:empty` deixa de valer).

```diff
+ #exportPreview:empty::before{content:"Sem movimentações no período selecionado.";...}
+ #importSummary:empty::before{content:"Nenhum arquivo analisado ainda.";...}
```

---

## 4. Como o harness funciona

`e2e/visual/audit-modais.cjs` é **infraestrutura de QA**: não altera o app.

- **Servidor HTTP embutido** (porta efêmera). Não depende de `python`, de `npx` nem de
  processo externo — processos em background são mortos quando o ambiente reinicia.
- **Abre cada painel pelo abridor real do app** (`ABRIDORES`), e só usa manipulação de
  classe como fallback, registrando `via: "classe-forcada"`.
- **Espera o app ficar pronto** (`window.openModal` + `body[data-tab]`) antes de abrir,
  para não competir com o `closeAllPanels()` do `js/99-init.js`.
- **Espera a transição de opacidade** do overlay terminar (`0.2s`) antes de medir.
- **Mede**: modal realmente exposto, overflow X, elementos fora da viewport, controles
  sem altura, fonte < 11px, **containers de rolagem internos**, estilos computados dos
  controles (altura, raio, borda, fundo, fonte).
- **Captura o fim da rolagem** quando há conteúdo rolável, para não confundir rolagem
  normal com conteúdo inacessível.
- **Limpa os PNGs antes de cada execução**, para não herdar imagem de painel bloqueado.

### 4.1 Defeitos encontrados no próprio harness (corrigidos)

| # | Defeito | Efeito | Correção |
|---|---|---|---|
| 1 | Abria o painel antes do `99-init.js` terminar | `panelNovo` media `0×0` e o overlay ficava sem `.open` | espera sinal de prontidão |
| 2 | Media durante a transição de opacidade | overlay em `0.87` era lido como invisível | espera `opacity === '1'` |
| 3 | Media só a rolagem do painel | não via `.goals-form-body` rolando 657/617 | detecta containers roláveis internos |
| 4 | Abria por classe, ignorando o abridor real | selects apareciam vazios (falso positivo) | usa `ABRIDORES` primeiro |
| 5 | Não limpava prints antigos | painel bloqueado herdava PNG da execução anterior | limpa `*.png` no início |

---

## 5. Cobertura

| Modal | Aberto por | Tamanho | Campos | Rolagem |
|---|---|---|---|---|
| `panelNovo` | `openNewEntryModal` | **bloqueado** | — | — |
| `panelBanco` | `openBankManagementPanel` | 640×350 | 2 | não |
| `panelCategoria` | classe (forçado) | 640×346 | 2 | não |
| `panelFiltros` | classe (forçado) | 640×630 | 7 | não |
| `panelFeatureProfile` | `openFeatureProfile` | 880×467 | 11 | não |
| `panelDiagnostico` | `openDiagnostics` | 640×280 | 3 | não |
| `panelTransferencia` | classe (forçado) | 640×520 | 6 | não |
| `panelBill` | `openBillModal` | 640×828 | 13 | 993→826 |
| `panelBillLaunch` | classe (forçado) | 640×263 | 1 | não |
| `panelReceivable` | `openReceivableModal` | 640×729 | 7 | não |
| `panelBillShare` | classe (forçado) | 700×511 | 1 | não |
| `panelCard` | `openCardModal` | 640×735 | 8 | não |
| `panelPurchase` | `openPurchaseModal` | **bloqueado** | — | — |
| `panelInvest` | `openNewInvestModal` | 640×820 | 13 | 916→818 |
| `panelPocket` | `openNewPocketModal` | 640×662 | 6 | não |
| `panelPocketMovement` | classe (forçado) | 640×462 | 3 | não |
| `panelInvestMovement` | classe (forçado) | 640×629 | 5 | não |
| `panelCryptoReconcile` | classe (forçado) | 700×253 | 1 | não |
| `panelExportFormat` | classe (forçado) | 640×314 | 0 | não |
| `panelEntryHistory` | classe (forçado) | 700×97 | 0 | não |
| `panelPaste` | classe (forçado) | 640×464 | 1 | não |
| `panelImport` | classe (forçado) | 700×286 | 0 | não |
| `panelGoalForm` | `openNewGoalModal` | 440×810 | 9 | interna 657→617 |
| `panelAiChat` | `openAiChat` | 640×558 | 2 | não |
| `panelOcrReview` | classe (forçado) | 700×220 | 0 | não |
| `panelCustomPeriod` | `openCustomPeriodModal` | 700×216 | 2 | não |

**Resultado automático:** 0 overflows horizontais, 0 elementos fora da viewport,
0 controles sem altura, 0 fontes < 11px.

---

## 6. Achados

### 6.1 Corrigidos

Oito correções de apresentação, detalhadas em §3: botão Word em largura total,
placeholder do chat, campos de filtro, raio do botão de colar, "Cancelar" do
compartilhamento, campo da conciliação, grid do LABS e estados vazios.

### 6.2 Falsos positivos identificados e descartados

Registro importante: a primeira execução apontou **selects em branco** em
`panelNovo`, `panelCard`, `panelPurchase`, `panelTransferencia` e `panelBillLaunch`.
Isso era **artefato do harness**, não defeito do app:

| Modal | Abridor real | Regra que protege |
|---|---|---|
| `panelNovo` | `openNewEntryModal` (`js/26-receipts.js:770`) | sem banco → `alert` + abre `panelBanco` |
| `panelPurchase` | `openPurchaseModal` (`js/27-cards.js:81`) | sem cartão ativo → `alert` e não abre |
| `panelTransferencia` | handler `btnTransferencia` (`js/99-init.js:1898`) | menos de 2 destinos → `alert` e não abre |
| `panelBillLaunch` | `openBillLaunchPanel` (`js/25-bills-receivables.js:307`) | sem banco → `alert` e não abre |
| `panelCard` | `openCardModal` (`js/27-cards.js:64`) | já injeta `<option value="">Não informado</option>` |

Conclusão: o app **impede** esses estados. O harness anterior abria por classe e
mostrava um formulário que o usuário nunca alcança. Corrigido em §4.1 (item 4).

### 6.3 Cosméticos — **corrigidos nesta rodada**

| # | Modal | Achado | Correção aplicada |
|---|---|---|---|
| 1 | `panelFiltros` | trigger de 52px contra 48px dos selects; texto em caixa alta herdado de `button`; seta verde | 48px, `text-transform:none`, chevron neutro de 13px |
| 2 | `panelPaste` | raios `999px` / `4px` / `11px` no mesmo modal | botão de área de transferência em `4px`, igual ao Cancelar |
| 3 | `panelBillShare` | "Cancelar" era link de texto sem borda | botão secundário com borda, fundo e raio 4px |
| 4 | `panelCryptoReconcile` | input de 153px num modal de 700px, rótulo em 2 linhas | linha inteira, input limitado a 320px |
| 5 | `panelFeatureProfile` | benchmark e taxa personalizada em 2 colunas de 4, deixando 2 colunas vazias | ambos em linha inteira; checkboxes em 1 linha |
| 6 | `panelExportFormat` / `panelImport` | caixas com borda renderizavam vazias | mensagem de estado vazio via `:empty::before` |

Nenhum item quebrava uso ou escondia informação. Todas as correções são de HTML/CSS,
sem alteração de IDs, classes funcionais, listeners ou regras de negócio.

### 6.4 Não validável sem dados

`panelEntryHistory`, `panelOcrReview`, `panelBillShare`, `panelImport`,
`panelCryptoReconcile`, `panelExportFormat` e as listas de `panelCategoria`/`panelBanco`
dependem de registros existentes. Nesta execução foram abertos por classe e mostraram
estado vazio — **não é possível afirmar que estão corretos com dados reais**.

---

## 7. Limitações desta auditoria

1. **Sem autenticação.** O harness esconde `#authOverlay` apenas no navegador de teste.
   Portanto valida **estrutura e geometria**, não o conteúdo preenchido.
2. **Firestore indisponível.** A cota do projeto `livro-caixa-54357` está esgotada
   (`HTTP 429`), o que impede a conta QA efêmera e o `waitForDataReady()`.
3. **Tema claro apenas.** Tema escuro não foi validado nesta rodada.
4. **Painéis forçados.** 11 dos 26 foram abertos por classe (sem abridor próprio ou
   exigindo argumentos). Estão marcados na tabela do §5.

---

## 8. Como reproduzir

```powershell
cd C:\Users\janaina.sousa\LIVRO-CAIXA
node --check e2e/visual/audit-modais.cjs
node e2e/visual/audit-modais.cjs
```

Saída:

- `e2e/visual/saida/modais/*.png` — screenshots (apagados após a análise)
- `e2e/visual/saida/auditoria-modais.json` — métricas completas
- `e2e/visual/saida/RELATORIO.md` — resumo tabular

O harness sobe o próprio servidor; não é necessário `python` nem `npx`.

---

## 9. Impacto e risco

- **Risco das alterações:** baixo. Oito mudanças de apresentação em `index.html`,
  `style/features.css` e `style/components.css`, sem alteração de IDs funcionais,
  listeners, persistência ou regras financeiras.
- **Rollback:** `git revert <commit>`.
- **Compatibilidade:** nenhum seletor usado por JS/CSS/testes foi renomeado.

---

## 10. Pendências

1. Reexecutar a auditoria **com dados reais** quando a cota do Firestore normalizar
   (reset diário à meia-noite do Pacífico ≈ **04:00 BRT**), validando os modais do §6.4.
2. Reexecutar o workflow `C.O.D.E. E2E`, que falhou por `HTTP 429` e não por código.
3. Validar as alterações de CSS em tema escuro e em telas estreitas (a auditoria cobriu
   apenas desktop, tema claro).
