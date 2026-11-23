# C.6.1 — Auditoria dinâmica da aba Início via OpenCode + CDP

## 1. Resumo executivo

- Auditoria dinâmica executada somente leitura sobre a aba Início (`#viewInicio`).
- Nenhum arquivo de produção, CSS, token, HTML ou JavaScript foi alterado.
- Nenhuma movimentação financeira foi criada, editada ou excluída.
- Nenhum dado do Firestore foi alterado. Nenhum login ou sessão QA real foi usado.
- Foram capturados 56 screenshots: 1 baseline de página completa, 50 combinações de viewport/tema e 5 capturas de indicadores específicos.
- A matriz visual não apresentou overflow horizontal do documento, sobreposição entre cards ou falha de aplicação de paleta.
- **Problema confirmado:** o botão local “Adicionar” no rodapé de `#viewInicio` não possui listener CDP observável e não abre o painel de novo lançamento ao ser clicado. O FAB global abre `#panelNovo` corretamente na mesma aba.
- **Limitação relevante:** não havia sessão QA real disponível. Os valores financeiros naturais eram vazios (`—`, `R$ 0,00`, “Nenhum pagamento pendente”). Estados com dados populados, valores monetários extensos e conteúdo longo não foram fabricados.

## 2. HEAD, branch e baseline efetivo

- Repositório: `antvjpg/LIVRO-CAIXA`.
- Branch: `feat/app-layout-redesign`.
- HEAD: `82b9e1beb12395d4ae9a0c513d4cdb09bb683d2d`.
- URL auditada: `http://127.0.0.1:8000/index.html`.
- Origem: `http://127.0.0.1:8000`.
- View ativa no baseline: `#viewInicio`, com `body.dataset.tab = "inicio"`.
- Viewport do baseline: 1280×800, DPR 1.
- Tema do baseline: oliva claro; `--accent = #5f7a43`, `--paper = #f7f5ef`.
- Header global presente: `header.app-header`.
- `#balanceStrip` presente e visível em Início.
- `#viewInicio` presente e ativo.
- Cards presentes: Patrimônio Total, Saúde Financeira e Próximo Pagamento.
- Canvas `#patrimonySparklineInicio` presente.

## 3. Endpoint e metodologia CDP

### 3.1 Endpoint realmente disponível

Não havia endpoint CDP persistente no ambiente OpenCode no início:

- nenhuma variável de ambiente `CDP`, `CHROME`, `BROWSER`, `PLAYWRIGHT`, `PORT` ou `DEBUG`;
- nenhum processo Chromium/Chrome ativo;
- nenhuma porta em `LISTEN` em `/proc/net/tcp` ou `/proc/net/tcp6`;
- apenas arquivos `DevToolsActivePort` residuais de sondas temporárias antigas, com portas fechadas.

A conexão foi estabelecida com o mesmo mecanismo documentado no repositório para auditorias visuais C.4/C.3:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
chromium-browser --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --remote-debugging-port=9222 --user-data-dir=<perfil-temporario> about:blank
```

O endpoint usado foi `http://127.0.0.1:9222`, descoberto nas referências do próprio repositório (`AGENTS.md`, `playwright.config.cjs`, `e2e/scripts/run-c4-r26.cjs`, `e2e/visual/*`), não presumido aleatoriamente.

### 3.2 Mecanismo de conexão

- Conexão externa ao Chromium com `chrome-remote-interface`, via `CDP({ port: 9222 })`.
- Não foi usado `chromium.connectOverCDP()` do Playwright; Playwright não é suportado neste ambiente Android/Termux.
- Não foi confundido `context.newCDPSession(page)` com conexão externa: o harness conectou diretamente ao endpoint HTTP/CDP do navegador.
-Domínios CDP habilitados: `Page`, `Runtime`, `DOM`, `DOMDebugger` e `Log`.
- Console e exceções capturados por `Runtime.consoleAPICalled`, `Runtime.exceptionThrown` e `Log.entryAdded`.
- Screenshots capturados com `Page.captureScreenshot`, incluindo `captureBeyondViewport` no baseline.
- Viewports aplicados com `Emulation.setDeviceMetricsOverride`.
- Telemetria e DOM lidos com `Runtime.evaluate`.
- Listeners acessíveis quando possível via `DOMDebugger.getEventListeners`.
- O navegador e o servidor HTTP foram provisionados pelo harness, usados exclusivamente para esta auditoria e encerrados ao final. Nenhum navegador do usuário foi tocado.
- Portas `8000` e `9222` estavam fechadas após a execução.

### 3.3 Autenticação e sessão QA

- `e2e/.state/qa-session.json` não existe.
- `CODE_TEST_EMAIL` e `CODE_TEST_PASSWORD` não estão disponíveis.
- `e2e/.state/qa-summary.json` contém apenas resumo mascarado de execução histórica.
- Para permitir a inspeção visual, `#authOverlay`, `#syncOverlay`, `#appDrawerOverlay` e `#panelThemePicker` foram ocultados **apenas em runtime via CDP**.
- Isso não constitui autenticação. A aplicação permaneceu em estado não autenticado/empty.

### 3.4 Arquivos de execução

- Harness: `tmp-c13/c6-1/audit-c6-inicio.cjs`.
- Evidências estruturadas: `tmp-c13/c6-1/evidencias.json`.
- Screenshots: `tmp-c13/c6-1/screenshots/`.

## 4. Matriz de viewports e temas executados

Foram executadas 50 combinações: 5 viewports × 10 temas.

| Contexto | Viewport | DPR |
|---|---:|---:|
| Mobile compacto | 320×720 | 2 |
| Mobile | 360×800 | 2 |
| Mobile amplo | 390×844 | 3 |
| Tablet | 768×1024 | 2 |
| Desktop | 1280×800 | 1 |

Temas claros: oliva, verde, lima, terracota e laranja.  
Temas escuros: oliva, verde, bege, terracota e laranja.

Resultados agregados:

- Paleta aplicada corretamente: 50/50.
- `#viewInicio` ativo: 50/50.
- Overflow horizontal do documento: 0/50.
- Sobreposição entre cards: 0/50.
- Elementos cortados: 10/50, todos em 320×720.
- Contraste aparente do valor principal contra o card: mínimo 7.88, máximo 19.95.

Dimensões representativas:

| Viewport | Cards Início (largura×altura) | Header | Faixa financeira | Gap do grid |
|---|---|---:|---:|---:|
| 320×720 | 292×170, 292×288, 292×144 | 237 px | 279 px | 14 px |
| 360×800 | 332×170, 332×288, 332×144 | 238 px | 279 px | 14 px |
| 390×844 | 362×170, 362×275, 362×144 | 240 px | 279 px | 14 px |
| 768×1024 | 353×192, 353×279, 353×146 | 140 px | 264 px | 14 px |
| 1280×800 | 348×192, 348×292, 348×146 | 152 px | 278 px | 14 px |

Em 320 px, o único elemento sinalizado como cortado foi `#patrimonySparklineInicio`: `x=29`, `largura=300`, `right=329`, ou seja, 9 px além da viewport. O documento não apresentou scroll horizontal porque o excesso ocorre dentro do card/container.

## 5. Screenshots identificados e organizados

Total: 56 PNGs, 16.882.700 bytes.

| Grupo | Quantidade | Local/padrão |
|---|---:|---|
| Baseline antes das interações de teste | 1 | `baseline-inicio-antes-interacao.png` |
| Matriz visual | 50 | `matriz-<viewport>-<tema>.png` |
| C6-INICIO-02 | 1 | `c6-inicio-02-hierarquia-patrimonio.png` |
| C6-INICIO-03 | 1 | `c6-inicio-03-isolamento.png` |
| C6-INICIO-07 | 2 | `c6-inicio-07-botao-local-click.png`, `c6-inicio-07-fab-click.png` |
| C6-INICIO-09 | 1 | `c6-inicio-09-grafico.png` |

Cada screenshot possui nome de arquivo, tamanho e SHA-256 registrados em `evidencias.json`.

Hashes principais:

| Artefato | SHA-256 |
|---|---|
| `audit-c6-inicio.cjs` | `b27c74c5f9ef89390da0e4fcf48b3b4d593bcaba91208d62beb01ff48e203248` |
| `evidencias.json` | `b9bcc8aed00ee39915dc1278e26b2c31f8ca3bfa8c480dc2705a7006fb8f821b` |
| `baseline-inicio-antes-interacao.png` | `de0147475bf851bfd91f23d8771db1d8849316a78caab3880f02cf55ea039c91` |
| `c6-inicio-07-botao-local-click.png` | `75de2fe781a2f968d691d321412b6bce097e8c62d267098255f8f037d1cc5707` |
| `c6-inicio-07-fab-click.png` | `fd0fd8e35cceef08da63ea931e93310adfe53c425ad4e40e4df0afb15f7434ac` |
| `c6-inicio-02-hierarquia-patrimonio.png` | `99e45dc3fb8cd09b8fa8541e097397361fbb5a99d72303976ee5fe933eed4186` |

## 6. Resultados por indicador C6-INICIO-01 a 09

### C6-INICIO-01 — cobertura/navegação da aba Início

- Navegação controlada executada por `window.switchTab('inicio')`.
- `#viewInicio` ficou ativo; `body.dataset.tab = "inicio"`.
- Evidência estática confirmada: `e2e/helpers/app.cjs` não declara a aba `inicio`; smoke não navega para Início.
- Resultado: **problema de cobertura confirmado estaticamente; navegação runtime da aba funcionou**.

### C6-INICIO-02 — hierarquia do patrimônio

- `#balanceStrip` visível em Início, com “Patrimônio Total — Bancos — Caixinhas — Invest.”.
- `#viewInicio` também contém card “Patrimônio Total”.
- Ambos exibem `—` no estado vazio.
- Em 360 px: valor da faixa com `37.8px`/peso 700; valor do card local com `19px`/peso 700.
- A faixa ocupa 332×279; o card local 332×94.
- Resultado: **repetição confirmada visualmente e por DOM**, com relevância visual maior na faixa. A decisão de hierarquia fica para a próxima etapa de proposta visual.

### C6-INICIO-03 — isolamento dos renderizadores

- Antes e depois de navegar para Visão Geral e voltar, os hosts permaneceram idênticos:
  - Saúde Financeira: 1 filho, mesmo texto e altura 182 px.
  - Resumo do Fluxo: 2 filhos, mesmo texto e altura 157 px.
  - Próximo Pagamento: 2 filhos, mesmo texto e altura 58 px.
- Não houve duplicação de conteúdo nos hosts de Início.
- `DOMDebugger` não encontrou listeners adicionais nos botões de aba antes/depois. Isso é uma observação limitada: handlers delegados/framework podem não aparecer no domínio CDP.
- Resultado: **sem regressão de conteúdo observada; duplicação de listeners não detectada**.

### C6-INICIO-04 — baseline visual e estados

- Baseline de página completa capturado em 1280×800.
- Matriz completa de 50 combinações executada.
- Estado carregado natural: cards e labels presentes.
- Estado vazio natural: `—`, `R$ 0,00` e “Nenhum pagamento pendente”.
- Conteúdo longo, valores monetários extensos e quebras de texto não ocorreram naturalmente; não foram fabricados.
- Resultado: **baseline capturado; estados dependentes de dados bloqueados pela ausência de sessão QA**.

### C6-INICIO-05 — CSS/cascata e computed styles

- Seis folhas locais carregadas na ordem documentada: `themes.css`, `base.css`, `components.css`, `layout.css`, `features.css`, `dashboard-chat.css`.
- Também carregadas fontes externas e CSS de ícones.
- Breakpoint `@media (max-width:360px)` aplicável ao grid de Início confirmado estaticamente.
- Computed styles coletados para header, faixa, cards, labels, valores e canvas em todas as combinações.
- Resultado: **cascata observada; nenhuma divergência funcional de layout detectada além do canvas em 320 px**.

### C6-INICIO-06 — computed styles/breakpoints

- Ver item C6-INICIO-05.
- Em 320 px, o canvas ultrapassa a viewport em 9 px, sem gerar overflow no documento.
- Resultado: **ponto de atenção confirmado em 320 px**.

### C6-INICIO-07 — botão local Adicionar

- Seletor auditado: `#viewInicio .inicio-footer button.primary[title="Adicionar"][aria-label="Adicionar"]`.
- Quantidade: 1.
- HTML: `<button type="button" class="primary" title="Adicionar" aria-label="Adicionar">...`.
- `DOMDebugger.getEventListeners`: nenhum listener no botão local.
- FAB global `#fabAdd`: 1 listener `click`.
- Clique no botão local: nenhum painel/modal abriu.
- Clique no FAB na mesma aba: abriu `#panelNovo` (`role="dialog"`, 328×550 em 360 px).
- O painel foi fechado sem salvar, sem submissão de formulário.
- Nenhum erro de console decorrente dos cliques.
- Resultado: **defeito funcional confirmado — botão local é inerte e não reutiliza o fluxo do FAB**.

### C6-INICIO-08 — cobertura E2E do botão local

- Não existe teste E2E dedicado ao botão local Adicionar.
- O runtime confirma a lacuna funcional do indicador C6-INICIO-07.
- Resultado: **lacuna de cobertura confirmada; consequência funcional também confirmada**.

### C6-INICIO-09 — controle do gráfico de patrimônio

- Controle local é `span[role="button"][tabindex="0"]`, primeiro elemento focável de `#viewInicio`.
- Estado inicial: `aria-expanded="true"`, `aria-label="Recolher gráfico do patrimônio"`, `aria-hidden="false"` no box.
- Foco: `outline: rgb(95, 122, 67) solid 2px` — foco visível confirmado.
- Clique: alternou para `aria-expanded="false"`, `aria-label="Mostrar gráfico ..."`, `aria-hidden="true"`, box colapsado.
- Enter: voltou para expandido.
- Espaço: recolheu novamente.
- Não houve erro de console durante as interações.
- O controle equivalente em `#balanceStrip` não foi encontrado no estado runtime auditado; portanto a sincronização entre os dois contextos não pôde ser comprovada.
- Canvas: atributos `300×150`; caixa CSS com altura variável (aprox. 63 px expandida, 0–1 px colapsada). Em 320 px, largura excede a viewport em 9 px.
- Após navegar para Visão Geral e voltar, o estado colapsado e as dimensões do canvas permaneceram consistentes.
- Resultado: **teclado, foco e ARIA locais aprovados; sincronização com a faixa bloqueada no estado sem dados; corte em 320 px confirmado**.

## 7. Console errors e exceções

- Exceções Runtime: 0.
- Erros de console: 0.
- Avisos: 1.
- Aviso observado: `@firebase/firestore: enableIndexedDbPersistence() will be deprecated in the future, you can use FirestoreSettings.cache instead.`

## 8. Problemas confirmados

1. **C6-INICIO-07 / 08:** botão local Adicionar sem listener e sem ação; FAB global funcional.
2. **C6-INICIO-02:** patrimônio total repetido entre faixa global e card local, com hierarquia visual distinta.
3. **C6-INICIO-06 / 09:** canvas do gráfico ultrapassa a viewport em 9 px no contexto 320×720.
4. **C6-INICIO-01:** aba Início ausente do helper E2E e do smoke (evidência estática).

## 9. Suspeitas não confirmadas

- Sincronização entre o controle do gráfico local e o controle da faixa global: o controle na faixa não estava presente no estado runtime auditado.
- Duplicação de listeners após navegação: nenhum listener adicional apareceu via `DOMDebugger`, mas handlers delegados podem não ser visíveis por CDP.
- Contraste real com dados financeiros: apenas o estado vazio foi observado; o contraste aparente calculado variou de 7.88 a 19.95.
- Comportamento visual com valores monetários extensos e conteúdo longo não foi exercitado.

## 10. Itens bloqueados

- Sessão QA autenticada indisponível.
- Dados financeiros reais/populados indisponíveis.
- Estados de carregamento e sincronização autenticada não observados.
- Sincronização do gráfico entre dois contextos não validada.
- C.O.D.E. E2E não executado nesta etapa; a auditoria foi CDP local.

## 11. Recomendações técnicas sem implementação

- Avaliar, na próxima etapa de proposta visual, se a faixa global deve manter o papel de síntese e o card local deve ser removido, condensado ou transformado em detalhe.
- Reutilizar o handler do FAB no botão local de Início, sem duplicar lógica de abertura do painel.
- Ajustar o dimensionamento responsivo do canvas para 320 px ou permitir scroll/overflow controlado.
- Incluir `inicio` no helper E2E de navegação e adicionar smoke específico da aba.
- Adicionar teste E2E do botão local Adicionar.
- Validar a sincronização do gráfico com uma sessão autenticada que renderize o controle da faixa.
- Registrar warnings do Firebase como dívida técnica separada, sem tratá-los como erro funcional desta auditoria.

## 12. Confirmação de preservação

- Nenhum arquivo de produção foi alterado.
- Nenhuma movimentação financeira foi criada, editada ou excluída.
- Nenhum dado Firestore foi alterado.
- Nenhum commit, push, merge, release ou deploy foi realizado.
- Nenhum navegador do usuário foi encerrado; o Chromium e o servidor HTTP usados foram temporários e próprios do harness, ambos encerrados ao final.
- Somente novos artefatos de auditoria foram criados em `tmp-c13/c6-1/`.

## Status final

**Auditoria dinâmica C.6.1 concluída com evidências suficientes para os critérios centrais e com limitações registradas.** Aguardando próxima etapa de C.6. Não foi elaborada proposta visual definitiva.
