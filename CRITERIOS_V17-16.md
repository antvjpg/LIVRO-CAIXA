# Matriz de critérios — Livro-Caixa V17-16 independente

Esta matriz registra a conferência do prompt V17-16 na cópia independente baseada no arquivo V17-15CLAUDE-beta. O status **Validado localmente** significa que o critério foi conferido por inspeção do código, smoke test sem Firebase ou prévia headless. O status **Pendente de sessão real** é reservado para persistência, autenticação, sincronização e dados que dependem do Firestore.

| Critério | Implementação conferida | Evidência | Status |
|---|---|---|---|
| Plus Jakarta Sans padronizada | Tokens tipográficos e refinamentos usam Plus Jakarta Sans; números financeiros mantêm leitura tabular quando aplicável. | Inspeção de CSS e prévias clara/escura. | Validado localmente |
| Hierarquia financeira | Patrimônio, valores de cards e valores de lançamentos recebem pesos e contraste prioritários. | CSS V17-16 e prévias móveis. | Validado localmente |
| Espaçamentos revisados | Ações, cards, metadados, rodapé e safe area receberam escala de respiro sem aumentar indiscriminadamente os elementos. | Prévia de 390×844 px. | Validado localmente |
| Menos sensação de excesso de cards | Ações secundárias têm superfície mais leve e hierarquia inferior à ação principal. | Prévia clara e escura. | Validado localmente |
| Novo lançamento como ação principal | O botão permanece visualmente dominante sobre os atalhos auxiliares. | Prévia móvel. | Validado localmente |
| Ações secundárias | Banco, Categoria, Transferência, Colar texto, Importar PDF, exportações e backup permanecem presentes e com ícones/rótulos compactos. | Inspeção do DOM e prévia. | Validado localmente |
| Lançamentos mais fáceis de ler | Descrição e valor recebem prioridade; data, banco e categoria permanecem como metadados. | CSS de cards e markup renderizado. | Validado localmente; dados reais pendentes |
| Gráfico mais limpo | As seis maiores categorias são mostradas individualmente; categorias menores são agregadas em “Outras” quando há mais de sete. | Teste DOM com dez categorias: 7 linhas exibidas e total R$ 2.840,00 preservado. | Validado localmente |
| Legenda sem truncamento inadequado | A legenda usa colunas Categoria, Valor e %; nomes são renderizados com `escapeHTML` e não são cortados por ellipsis. | Captura rolada em 390 px com sete linhas completas. | Validado localmente |
| Sistema de ícones | Atalhos, navegação, Perfil e ações beta têm contêineres, alinhamento, espessura e áreas de toque normalizados. | CSS comum para `quick-action-icon`, `profile-item-icon`, `nav-icon` e `beta-icon-button`; prévias. | Validado localmente |
| Liquid Glass refinado | Barra mantém blur, transparência, sombra, borda sutil, safe area e indicador por destino. | Smoke test dos quatro destinos e prévia Investimentos. | Validado localmente |
| Transição do item ativo | Estado é centralizado em `switchTab`; o indicador usa `data-active` e transição de 220 ms entre quatro posições. | Smoke test caixa, caixinhas, investimentos e Perfil; prévia Investimentos. | Validado localmente |
| Microanimações | Transições discretas para entrada de telas, botões, cards e atualização de valores, com respeito a `prefers-reduced-motion` quando aplicável. | Inspeção de CSS e smoke visual. | Validado localmente |
| Atualização visual de saldos | Classe `value-refresh` e marcação de atualização sutil estão presentes sem alteração do cálculo. | Inspeção do fluxo de atualização e CSS. | Validado localmente; dados reais pendentes |
| Skeleton loading | Skeleton cobre cards financeiros, gráfico, ledger, caixinhas e investimentos, incluindo `#pocketBalanceStrip` e `#pocketGrid`. | Auditoria de seletores e sintaxe. | Validado localmente; carregamento autenticado pendente |
| Modo claro e escuro | Refinamentos usam variáveis do tema e foram pré-visualizados nos dois modos. | Pré-visualizações clara e escura. | Validado localmente |
| Responsividade | Largura móvel, safe area, modal de categorias, rodapé e overflow horizontal foram conferidos. | Medição `DOC=500; VIEW=500; BODYOVERFLOWX=hidden`; prévias mobile. | Validado localmente |
| Funcionalidades preservadas | Nenhum handler financeiro ou estrutura de dados foi removido; a cópia é independente. | `node --check`, isolamento de arquivos e revisão de eventos. | Validado localmente; regressão autenticada pendente |
| Dados financeiros preservados | Alterações de V17-16 são CSS, microinterações e agregação apenas de apresentação; o total do gráfico permanece integral. | Código e teste local do total. | Validado localmente; persistência real pendente |
| Importar PDF | Limites de 12 MB e 80 páginas, extração por linhas, prévia e duplicidades permanecem no código. | Inspeção de constantes e fluxo PDF.js. | Validado por código; teste com PDF e Firestore pendente |
| Autenticação e Firestore | Não foi possível validar sessão, sincronização offline/online e persistência sem credencial/sessão real. | Limite registrado no README e relatório de validação. | Pendente de sessão real |

## Decisão de entrega

A cópia está pronta como **versão independente de testes locais**, não como substituição de produção. A entrega não deve ser descrita como aprovação completa de autenticação, Firestore, persistência ou sincronização. Para fechar essa última camada, é necessário abrir a cópia em um navegador com uma sessão Firebase real e testar lançamentos, gráfico com dados existentes, importação de PDF, edição/exclusão e offline/online.

## Referências diretas no código

| Área | Referências diretas |
|---|---|
| Legenda sem truncamento | `.cat-summary-content`, `.cat-bars-list`, `.cat-row`, `.cat-row .cat-name`, `.cat-row .cat-amt` e `.cat-row .cat-pct`; as regras usam `min-width:0`, `white-space:normal`, `overflow-wrap:anywhere`, `overflow:visible`, `text-overflow:clip` e `white-space:nowrap` para valores/percentuais. |
| Agregação do gráfico | `renderCategorySummary()`, `chartSpend`, `name: 'Outras'`, `chartSpend.map(...)`; o cálculo original permanece em `spend` e `totalSpend`. |
| Ícones dos atalhos | `.quick-action-icon`, `.quick-action-icon svg`. |
| Ícones da navegação | `.nav-icon`, `.nav-icon svg`, `.mobile-bottom-nav::before`, `[data-active="pockets"]`, `[data-active="invest"]` e `[data-active="profile"]`. |
| Ícones do Perfil | `.profile-avatar svg`, `.profile-item-icon`, `.profile-item-icon svg`. |
| Ações de item | `.beta-icon-button`, `.beta-icon-button.edit::after`, `.beta-icon-button.move::after`, `.beta-icon-button.delete::after`. |
| Ícones financeiros | `.category-dot`, `.movement-category-icon`, `.card-category`, `categoryIcon(cat, e.type)` e `categoryColor(cat)`. |
| Skeleton | `body.is-data-loading`, `#categorySummary`, `#ledgerBody`, `#pocketBalanceStrip`, `#pocketGrid` e `#viewInvest .invest-grid`. |
| Navegação | `switchTab(tabName)` e `data-destination="caixa|pockets|invest|profile"`. |

As referências acima são verificáveis por busca estática e estão separadas das validações que exigem autenticação Firebase ou dados persistidos reais.

## Referências diretas dos cards patrimoniais

| Grupo | Referências diretas | Estado |
|---|---|---|
| Patrimônio Total | `.balance-card.total`, `.balance-symbol`, `.balance-symbol svg`, `renderBalances()`, `financialIcon('wallet')` | Padronizado |
| Caixa/Bancos | `.bank-summary-card`, `financialIcon('bank')`, `body.dark-mode .balance-card:not(.total) .balance-symbol` | Padronizado |
| Investido/Cripto | `.invest-summary-card`, `financialIcon('growth')`, `body.dark-mode .invest-summary-card .balance-symbol` | Padronizado |
| Total investido | `renderInvestments()`, `#investBalanceStrip`, `financialIcon('growth')` | Padronizado |
| Total em Caixinhas | `renderPocketBalances()`, `#pocketBalanceStrip`, `financialIcon('wallet')` | Padronizado |
| Saldos individuais de caixinhas | `.balance-card` gerado dentro de `renderPocketBalances()` | Sem ícone próprio; não há símbolo provisório oculto. |
